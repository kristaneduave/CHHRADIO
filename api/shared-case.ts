type PublicCaseRecord = {
  title?: string | null;
  diagnosis?: string | null;
  modality?: string | null;
  organ_system?: string | null;
  findings?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  analysis_result?: {
    patientId?: string | null;
    impression?: string | null;
  } | null;
};

const getSupabaseConfig = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return { url, anonKey };
};

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const compactText = (value: string, maxLength: number) => {
  const normalized = collapseWhitespace(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getRepresentativeImage = (record: PublicCaseRecord | null) => {
  if (!record) return '';
  const imageUrls = Array.isArray(record.image_urls) ? record.image_urls : [];
  const firstImage = imageUrls.find((value) => typeof value === 'string' && value.trim().length > 0);
  if (firstImage) return firstImage.trim();
  return String(record.image_url || '').trim();
};

const buildDescription = (record: PublicCaseRecord | null) => {
  if (!record) {
    return 'Shared radiology case report from CHH Radiology.';
  }

  const findings = typeof record.findings === 'string' ? record.findings.trim() : '';
  const impression = typeof record.analysis_result?.impression === 'string'
    ? record.analysis_result.impression.trim()
    : '';
  const diagnosis = typeof record.diagnosis === 'string' ? record.diagnosis.trim() : '';
  const exam = [record.modality, record.organ_system]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(' - ');

  const parts = [
    exam,
    findings ? `Findings: ${findings}` : '',
    impression ? `Impression: ${impression}` : '',
    !impression && diagnosis ? `Diagnosis: ${diagnosis}` : '',
  ].filter(Boolean);

  return compactText(parts.join(' ') || 'Shared radiology case report from CHH Radiology.', 280);
};

const getExamLabel = (record: PublicCaseRecord | null) =>
  [record?.modality, record?.organ_system]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(' - ');

const buildHtml = (token: string, origin: string, record: PublicCaseRecord | null, notFound = false) => {
  const caseTitle = String(record?.title || record?.diagnosis || 'Shared Case').trim() || 'Shared Case';
  const pageTitle = notFound
    ? 'Shared Case Unavailable | CHH Radiology'
    : `${caseTitle} | CHH Radiology`;
  const description = notFound
    ? 'This shared radiology case link is invalid, disabled, or no longer available.'
    : buildDescription(record);
  const findings = compactText(String(record?.findings || '').trim(), 420);
  const impression = compactText(String(record?.analysis_result?.impression || record?.diagnosis || '').trim(), 220);
  const patientId = String(record?.analysis_result?.patientId || record?.diagnosis || '').trim();
  const examLabel = getExamLabel(record);
  const image = getRepresentativeImage(record);
  const sharedUrl = `${origin}/shared/case/${encodeURIComponent(token)}`;
  const appUrl = `${origin}/?publicCaseToken=${encodeURIComponent(token)}`;
  const appPath = `/?publicCaseToken=${encodeURIComponent(token)}`;
  const safeTitle = escapeHtml(pageTitle);
  const safeCaseTitle = escapeHtml(caseTitle);
  const safeDescription = escapeHtml(description);
  const safeSharedUrl = escapeHtml(sharedUrl);
  const safeAppUrl = escapeHtml(appUrl);
  const safeAppPath = escapeHtml(appPath);
  const safeImage = image ? escapeHtml(image) : '';
  const safeFindings = findings ? escapeHtml(findings) : '';
  const safeImpression = impression ? escapeHtml(impression) : '';
  const safePatientId = patientId ? escapeHtml(patientId) : '';
  const safeExamLabel = examLabel ? escapeHtml(examLabel) : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${safeSharedUrl}" />
    ${safeImage ? `<meta property="og:image" content="${safeImage}" />` : ''}
    <meta name="twitter:card" content="${safeImage ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    ${safeImage ? `<meta name="twitter:image" content="${safeImage}" />` : ''}
    <style>
      body {
        margin: 0;
        font-family: "Segoe UI", Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(14, 165, 233, 0.18), transparent 32%),
          linear-gradient(180deg, #071019 0%, #0b1420 100%);
        color: #e2e8f0;
        min-height: 100vh;
        padding: 24px 18px 40px;
      }
      .card {
        width: min(100%, 760px);
        margin: 0 auto;
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(15, 23, 42, 0.84);
        border-radius: 32px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);
      }
      .hero {
        ${safeImage ? `background-image: linear-gradient(rgba(7,16,25,0.18), rgba(7,16,25,0.58)), url('${safeImage}');` : 'background: linear-gradient(135deg, #0f2740, #0b1520);'}
        background-size: cover;
        background-position: center;
        min-height: 300px;
      }
      .content {
        padding: 28px;
      }
      .eyebrow {
        color: #7dd3fc;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 10px 0 0;
        font-size: 32px;
        line-height: 1.15;
      }
      p {
        margin: 16px 0 0;
        color: #cbd5e1;
        line-height: 1.6;
      }
      .meta {
        display: grid;
        gap: 12px;
        margin-top: 20px;
      }
      .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid rgba(125, 211, 252, 0.18);
        background: rgba(14, 165, 233, 0.08);
        color: #e0f2fe;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 8px 12px;
      }
      .section {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
      }
      .section-label {
        color: #93c5fd;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .section-copy {
        margin-top: 10px;
        color: #e2e8f0;
        font-size: 16px;
        line-height: 1.7;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }
      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #38bdf8;
        color: #082f49;
        text-decoration: none;
        font-weight: 800;
        padding: 13px 18px;
        border-radius: 999px;
      }
      .ghost-link {
        background: rgba(148, 163, 184, 0.08);
        color: #e2e8f0;
        border: 1px solid rgba(148, 163, 184, 0.18);
      }
    </style>
  </head>
  <body>
    <article class="card">
      <div class="hero"></div>
      <div class="content">
        <div class="eyebrow">CHH Radiology Portal</div>
        <h1>${notFound ? safeTitle : safeCaseTitle}</h1>
        <p>${safeDescription}</p>
        ${notFound ? '' : `
          <div class="meta">
            <div class="meta-row">
              ${safeExamLabel ? `<div class="pill">${safeExamLabel}</div>` : ''}
              ${safePatientId ? `<div class="pill">PACS Patient ID: ${safePatientId}</div>` : ''}
            </div>
          </div>
          ${safeFindings ? `
            <div class="section">
              <div class="section-label">Findings</div>
              <div class="section-copy">${safeFindings}</div>
            </div>
          ` : ''}
          ${safeImpression ? `
            <div class="section">
              <div class="section-label">Impression</div>
              <div class="section-copy">${safeImpression}</div>
            </div>
          ` : ''}
          <div class="actions">
            <a href="${safeAppPath}">Open Full Case Report</a>
            <a class="ghost-link" href="${safeSharedUrl}">Copy Share Link</a>
          </div>
        `}
      </div>
    </article>
  </body>
</html>`;
};

export default async function handler(req: any, res: any) {
  const token = String(req.query?.token || '').trim();
  if (!token) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(buildHtml('', `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`, null, true));
    return;
  }

  const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(buildHtml(token, origin, null, true));
    return;
  }

  try {
    const rpcResponse = await fetch(`${url}/rest/v1/rpc/resolve_public_case_by_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ p_public_token: token }),
    });

    if (!rpcResponse.ok) {
      throw new Error(`RPC failed with ${rpcResponse.status}`);
    }

    const data = await rpcResponse.json();
    const record = Array.isArray(data) ? (data[0] || null) : (data || null);
    const notFound = !record;

    res.statusCode = notFound ? 404 : 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.end(buildHtml(token, origin, record, notFound));
  } catch {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(buildHtml(token, origin, null, true));
  }
}
