// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

type ParsedChecklistItem = {
  id: string;
  label: string;
  section?: string | null;
  order: number;
  notes?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') || '';
const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = (Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY') || '').replace(/\\n/g, '\n');

const encoder = new TextEncoder();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toBase64Url = (input: ArrayBuffer | Uint8Array | string) => {
  const bytes =
    typeof input === 'string'
      ? encoder.encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const importPrivateKey = async (pem: string) => {
  const normalized = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const binary = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binary.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );
};

const createGoogleAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signingInput));
  const assertion = `${signingInput}.${toBase64Url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${response.status}`);
  }

  const data = await response.json();
  return String(data.access_token || '');
};

const parseEffectiveDate = (text: string) => {
  const match = text.match(/effective\s+date\s*[:\-]\s*([A-Za-z0-9,\-\/ ]+)/i);
  return match?.[1]?.trim() || null;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const cleanChecklistLabel = (line: string) => line.replace(/^[-*]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();

const parseGuidelineText = (text: string) => {
  const lines = text.split(/\r?\n/);
  const summaryLines: string[] = [];
  const noteLines: string[] = [];
  const checklistItems: ParsedChecklistItem[] = [];

  let section: 'intro' | 'summary' | 'checklist' | 'notes' = 'intro';
  let currentChecklistSection: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (section === 'summary') summaryLines.push('');
      continue;
    }

    if (/^summary\b/i.test(line)) {
      section = 'summary';
      continue;
    }
    if (/^checklist\b/i.test(line)) {
      section = 'checklist';
      continue;
    }
    if (/^(notes|caveats)\b/i.test(line)) {
      section = 'notes';
      continue;
    }

    if (section === 'checklist' && /:$/.test(line) && !/^[-*\d]/.test(line)) {
      currentChecklistSection = line.replace(/:$/, '').trim();
      continue;
    }

    if (section === 'checklist' && (/^[-*]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line))) {
      const label = cleanChecklistLabel(line);
      if (!label) continue;
      checklistItems.push({
        id: slugify(label) || `item-${checklistItems.length + 1}`,
        label,
        section: currentChecklistSection,
        order: checklistItems.length + 1,
      });
      continue;
    }

    if (section === 'summary') {
      summaryLines.push(line);
      continue;
    }

    if (section === 'notes') {
      noteLines.push(line);
    }
  }

  const richSummary = summaryLines.join('\n').trim();
  const parseNotes = noteLines.join('\n').trim() || null;

  if (!richSummary) {
    throw new Error('Drive document is missing a Summary section with content.');
  }
  if (!checklistItems.length) {
    throw new Error('Drive document is missing a Checklist section with bullet or numbered items.');
  }

  return { richSummary, checklistItems, parseNotes };
};

const createFailedVersion = async (
  adminClient: ReturnType<typeof createClient>,
  guidelineId: string,
  userId: string,
  sourceUrl: string,
  sourceTitle: string | null,
  issuingBody: string | null,
  errorMessage: string,
) => {
  await adminClient.from('pathology_guideline_versions').insert({
    guideline_id: guidelineId,
    sync_status: 'failed',
    origin: 'drive_sync',
    source_url: sourceUrl,
    source_title: sourceTitle,
    issuing_body: issuingBody,
    rich_summary_md: '',
    checklist_items: [],
    parse_notes: errorMessage,
    synced_by: userId,
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Supabase environment variables are missing.' }, 500);
    }
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      return json({ error: 'Google service account credentials are missing.' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header.' }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!['admin', 'moderator', 'training_officer'].includes(String(profile?.role || ''))) {
      return json({ error: 'Privileged role required.' }, 403);
    }

    const body = await req.json();
    const guidelineId = String(body?.guidelineId || '').trim();
    const publishAfterSync = Boolean(body?.publishAfterSync);
    if (!guidelineId) {
      return json({ error: 'guidelineId is required.' }, 400);
    }

    const { data: guideline, error: guidelineError } = await adminClient
      .from('pathology_guidelines')
      .select('*')
      .eq('id', guidelineId)
      .maybeSingle();

    if (guidelineError || !guideline) {
      return json({ error: 'Pathology guideline source not found.' }, 404);
    }
    if (String(guideline.source_kind || 'google_drive') !== 'google_drive') {
      return json({ error: 'Drive sync is only available for Google Drive sources.' }, 400);
    }

    const sourceUrl = String(guideline.google_drive_url || '');
    const sourceTitle = guideline.source_title ? String(guideline.source_title) : null;
    const issuingBody = guideline.issuing_body ? String(guideline.issuing_body) : null;

    try {
      const googleAccessToken = await createGoogleAccessToken();

      const metadataResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(guideline.google_drive_file_id))}?fields=id,name,mimeType,version,webViewLink`,
        { headers: { Authorization: `Bearer ${googleAccessToken}` } },
      );
      if (!metadataResponse.ok) {
        throw new Error(`Unable to read Google Drive metadata (${metadataResponse.status}).`);
      }

      const metadata = await metadataResponse.json();
      if (metadata.mimeType !== 'application/vnd.google-apps.document') {
        throw new Error('Only Google Docs sources are supported in v1.');
      }

      const exportResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(guideline.google_drive_file_id))}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${googleAccessToken}` } },
      );
      if (!exportResponse.ok) {
        throw new Error(`Unable to export Google Doc (${exportResponse.status}).`);
      }

      const rawText = await exportResponse.text();
      const parsed = parseGuidelineText(rawText);
      const effectiveDate = parseEffectiveDate(rawText);

      const { data: inserted, error: insertError } = await adminClient
        .from('pathology_guideline_versions')
        .insert({
          guideline_id: guidelineId,
          version_label: metadata.version ? `Drive v${metadata.version}` : null,
          effective_date: effectiveDate,
          sync_status: 'draft',
          origin: 'drive_sync',
          source_revision: metadata.version ? String(metadata.version) : null,
          source_title: metadata.name ? String(metadata.name) : sourceTitle,
          issuing_body: issuingBody,
          source_url: metadata.webViewLink ? String(metadata.webViewLink) : sourceUrl,
          rich_summary_md: parsed.richSummary,
          checklist_items: parsed.checklistItems,
          parse_notes: parsed.parseNotes,
          raw_text_excerpt: rawText.slice(0, 4000),
          synced_by: user.id,
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (publishAfterSync) {
        const { error: publishError } = await adminClient.rpc('publish_pathology_guideline_version', {
          p_version_id: inserted.id,
        });
        if (publishError) {
          throw publishError;
        }
      }

      return json({
        versionId: String(inserted.id),
        status: publishAfterSync ? 'published' : 'draft',
        pathologyName: String(guideline.pathology_name),
        sourceTitle: metadata.name ? String(metadata.name) : sourceTitle,
        effectiveDate,
        richSummary: parsed.richSummary,
        checklistItems: parsed.checklistItems,
        parseNotes: parsed.parseNotes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Drive sync failed.';
      await createFailedVersion(adminClient, guidelineId, user.id, sourceUrl, sourceTitle, issuingBody, message);
      return json({ error: message, status: 'failed' }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return json({ error: message }, 500);
  }
});
