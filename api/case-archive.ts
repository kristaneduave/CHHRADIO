// Archives a case's PDF export in the department Google Drive. The Drive credentials stay here;
// the browser builds the PDF and sends it in chunks because Vercel rejects request and response
// bodies over 4.5 MB. Who may archive a case, and which images are then removed, is decided by
// the database functions in supabase/migrations/202610210001_case_drive_archive.sql, called with
// the signed-in user's own token.

export const CHUNK_BYTES = 4 * 1024 * 1024; // Drive needs multiples of 256 KiB
const MAX_PDF_BYTES = 250 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const env = (name: string) => {
  const value = process.env[name] || '';
  if (!value) throw new HttpError(503, 'Case archiving is not set up yet.');
  return value;
};

const supabaseConfig = () => ({
  url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || env('SUPABASE_URL'),
  anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || env('SUPABASE_ANON_KEY'),
});

let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

const googleAccessToken = async () => {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) return cachedGoogleToken.token;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_DRIVE_CLIENT_ID'),
      client_secret: env('GOOGLE_DRIVE_CLIENT_SECRET'),
      refresh_token: env('GOOGLE_DRIVE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new HttpError(502, 'Google Drive refused the department account. Run scripts/google-drive-setup.mjs again.');
  }
  cachedGoogleToken = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return cachedGoogleToken.token;
};

const bearerToken = (req: any) => {
  const match = /^Bearer\s+(\S+)$/i.exec(String(req.headers?.authorization || ''));
  if (!match) throw new HttpError(401, 'Sign in required.');
  return match[1];
};

const supabaseFetch = (path: string, userToken: string, init: RequestInit = {}) => {
  const { url, anonKey } = supabaseConfig();
  return fetch(`${url}${path}`, {
    ...init,
    redirect: 'error',
    headers: { apikey: anonKey, Authorization: `Bearer ${userToken}`, ...(init.headers || {}) },
  });
};

const DATABASE_ERROR_STATUS: Record<string, number> = { '42501': 403, P0002: 404, '22023': 409 };

const rpc = async (name: string, userToken: string, args: Record<string, unknown>) => {
  const response = await supabaseFetch(`/rest/v1/rpc/${name}`, userToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await response.json().catch(() => null);
  if (response.ok) return data;
  if (response.status === 401) throw new HttpError(401, 'Sign in required.');
  const status = DATABASE_ERROR_STATUS[data?.code];
  throw new HttpError(status || 502, status ? String(data.message) : 'The database could not archive this case.');
};

const requireUser = async (userToken: string) => {
  const response = await supabaseFetch('/auth/v1/user', userToken);
  if (!response.ok) throw new HttpError(401, 'Sign in required.');
};

const jsonBody = (req: any) => {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
};

const rawBody = async (req: any): Promise<Buffer> => {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > CHUNK_BYTES) throw new HttpError(413, 'Chunk too large.');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const archiveFileName = (title: unknown, caseId: string) => {
  const cleaned = String(title || 'Case').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${cleaned || 'Case'} (${caseId.slice(0, 8)}).pdf`;
};

// Only Drive's own resumable upload sessions, so this cannot be used to reach other hosts.
const validUploadUrl = (value: unknown) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === 'www.googleapis.com'
      && url.pathname === '/upload/drive/v3/files' && Boolean(url.searchParams.get('upload_id'))
      ? url.toString() : null;
  } catch {
    return null;
  }
};

const startUpload = async (req: any) => {
  const userToken = bearerToken(req);
  const { caseId, size, sha256 } = jsonBody(req);
  if (!UUID.test(String(caseId)) || !Number.isInteger(size) || size < 1 || size > MAX_PDF_BYTES
    || !/^[0-9a-f]{64}$/.test(String(sha256))) {
    throw new HttpError(400, 'Invalid request.');
  }
  const { title } = await rpc('prepare_case_archive', userToken, { p_case_id: caseId });
  const response = await fetch(`${DRIVE_UPLOAD}?uploadType=resumable&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await googleAccessToken()}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/pdf',
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify({
      name: archiveFileName(title, caseId),
      mimeType: 'application/pdf',
      parents: [env('GOOGLE_DRIVE_ARCHIVE_FOLDER_ID')],
      appProperties: { caseId, sha256, size: String(size) },
    }),
  });
  const uploadUrl = validUploadUrl(response.headers.get('location'));
  if (!response.ok || !uploadUrl) throw new HttpError(502, 'Google Drive did not accept the upload.');
  return { uploadUrl, chunkBytes: CHUNK_BYTES };
};

const uploadChunk = async (req: any) => {
  await requireUser(bearerToken(req));
  const uploadUrl = validUploadUrl(req.headers?.['x-upload-url']);
  const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(String(req.headers?.['content-range'] || ''));
  if (!uploadUrl || !range) throw new HttpError(400, 'Invalid request.');
  const body = await rawBody(req);
  if (body.length !== Number(range[2]) - Number(range[1]) + 1 || body.length > CHUNK_BYTES) {
    throw new HttpError(400, 'Chunk does not match its range.');
  }
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Length': String(body.length), 'Content-Range': range[0] },
    body,
  });
  if (response.status === 308) return { done: false };
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !DRIVE_FILE_ID.test(String(data.id))) throw new HttpError(502, 'Google Drive rejected part of the PDF.');
  return { done: true, fileId: data.id };
};

const finishUpload = async (req: any) => {
  const userToken = bearerToken(req);
  const { caseId, fileId } = jsonBody(req);
  if (!UUID.test(String(caseId)) || !DRIVE_FILE_ID.test(String(fileId))) throw new HttpError(400, 'Invalid request.');

  const response = await fetch(
    `${DRIVE_API}/${fileId}?supportsAllDrives=true&fields=id,size,sha256Checksum,parents,appProperties,trashed`,
    { headers: { Authorization: `Bearer ${await googleAccessToken()}` } },
  );
  const file = await response.json().catch(() => ({}));
  const props = file.appProperties || {};
  const verified = response.ok && !file.trashed
    && Array.isArray(file.parents) && file.parents.includes(env('GOOGLE_DRIVE_ARCHIVE_FOLDER_ID'))
    && props.caseId === caseId && props.sha256 === file.sha256Checksum && props.size === String(file.size);
  if (!verified) throw new HttpError(409, 'The PDF in Google Drive does not match. No images were removed.');

  const names = await rpc('complete_case_archive', userToken, {
    p_case_id: caseId, p_drive_file_id: fileId, p_size_bytes: Number(file.size),
  });
  let removed = 0;
  if (Array.isArray(names) && names.length > 0) {
    // Best effort: anything left behind is found later by scripts/storage-cleanup.mjs.
    const removal = await supabaseFetch('/storage/v1/object/case-images', userToken, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: names }),
    }).catch(() => null);
    const deleted = removal?.ok ? await removal.json().catch(() => []) : [];
    removed = Array.isArray(deleted) ? deleted.length : 0;
  }
  return { fileId, sizeBytes: Number(file.size), removedImages: removed, imagesToRemove: Array.isArray(names) ? names.length : 0 };
};

const downloadChunk = async (req: any, res: any) => {
  const userToken = bearerToken(req);
  const caseId = String(req.query?.caseId || '');
  const offset = Number(req.query?.offset || 0);
  if (!UUID.test(caseId) || !Number.isInteger(offset) || offset < 0) throw new HttpError(400, 'Invalid request.');

  // Read with the user's own token, so the case's normal visibility rules apply.
  const lookup = await supabaseFetch(`/rest/v1/cases?id=eq.${caseId}&select=archive_drive_file_id`, userToken);
  const rows = lookup.ok ? await lookup.json().catch(() => []) : [];
  const fileId = String(rows?.[0]?.archive_drive_file_id || '');
  if (!DRIVE_FILE_ID.test(fileId)) throw new HttpError(404, 'Archived PDF not found.');

  const response = await fetch(`${DRIVE_API}/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${await googleAccessToken()}`, Range: `bytes=${offset}-${offset + CHUNK_BYTES - 1}` },
  });
  if (!response.ok) throw new HttpError(response.status === 416 ? 416 : 502, 'Could not read the archived PDF.');
  const bytes = Buffer.from(await response.arrayBuffer());
  const total = /\/(\d+)$/.exec(response.headers.get('content-range') || '')?.[1] || String(offset + bytes.length);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Archive-Total', total);
  res.end(bytes);
};

const sendJson = (res: any, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export default async function handler(req: any, res: any) {
  const action = String(req.query?.action || '');
  try {
    if (req.method === 'POST' && action === 'start') return sendJson(res, 200, await startUpload(req));
    if (req.method === 'PUT' && action === 'chunk') return sendJson(res, 200, await uploadChunk(req));
    if (req.method === 'POST' && action === 'finish') return sendJson(res, 200, await finishUpload(req));
    if (req.method === 'GET' && action === 'file') return await downloadChunk(req, res);
    return sendJson(res, 405, { error: 'Not allowed.' });
  } catch (error) {
    if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message });
    console.error('Case archive failed:', error);
    return sendJson(res, 502, { error: 'Case archive failed.' });
  }
}
