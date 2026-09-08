import { isUuidPublicCaseToken, normalizePublicCaseToken } from '../utils/publicCaseLinks';
import { readVerifiedImage, setPublicResponseHeaders, validatePublicImageUrl } from '../utils/publicImageSecurity';

type PublicCaseRecord = {
  image_url?: string | null;
  image_urls?: string[] | null;
};

const getSupabaseConfig = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return { url, anonKey };
};

const getRepresentativeImage = (record: PublicCaseRecord | null) => {
  if (!record) return '';
  const imageUrls = Array.isArray(record.image_urls) ? record.image_urls : [];
  const firstImage = imageUrls.find((value) => typeof value === 'string' && value.trim().length > 0);
  if (firstImage) return firstImage.trim();
  return String(record.image_url || '').trim();
};

const sendNotFound = (res: any) => {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Representative image unavailable.');
};

export default async function handler(req: any, res: any) {
  setPublicResponseHeaders(res);
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end();
    return;
  }
  const token = normalizePublicCaseToken(String(req.query?.token || '').trim());
  if (!isUuidPublicCaseToken(token)) {
    sendNotFound(res);
    return;
  }

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    sendNotFound(res);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const rpcResponse = await fetch(`${url}/rest/v1/rpc/resolve_public_case_by_token`, {
      method: 'POST',
      signal: controller.signal,
      redirect: 'error',
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
    const imageUrl = getRepresentativeImage(record);

    if (!imageUrl) {
      sendNotFound(res);
      return;
    }

    const imageResponse = await fetch(validatePublicImageUrl(imageUrl, url), {
      signal: controller.signal,
      redirect: 'error',
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
      },
    });

    if (!imageResponse.ok) {
      throw new Error(`Image fetch failed with ${imageResponse.status}`);
    }

    const { bytes, contentType } = await readVerifiedImage(imageResponse);

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(bytes.byteLength));
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(bytes));
  } catch {
    sendNotFound(res);
  } finally {
    clearTimeout(timeout);
  }
}
