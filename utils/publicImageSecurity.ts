export const MAX_PUBLIC_IMAGE_BYTES = 20 * 1024 * 1024;

export const validatePublicImageUrl = (value: string, projectUrl: string): string => {
  const project = new URL(projectUrl);
  const url = new URL(value);
  const prefix = '/storage/v1/object/public/case-images/';
  if (project.protocol !== 'https:' || url.protocol !== 'https:' || url.origin !== project.origin
    || url.port || url.username || url.password || url.search || url.hash
    || !url.pathname.startsWith(prefix)) throw new Error('Unsupported image location');
  const path = decodeURIComponent(url.pathname.slice(prefix.length));
  if (!path || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Unsupported image path');
  }
  return url.href;
};

export const detectImageType = (bytes: Uint8Array): string | null => {
  const starts = (...values: number[]) => values.every((value, i) => bytes[i] === value);
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length < 12) return null;
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png';
  if (starts(255, 216, 255)) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp') {
    const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (boxSize >= 16 && boxSize <= bytes.length) {
      for (let offset = 8; offset + 4 <= boxSize; offset += 4) {
        if (offset !== 12 && ['avif', 'avis'].includes(ascii(offset, offset + 4))) return 'image/avif';
      }
    }
  }
  return null;
};

export const readVerifiedImage = async (response: Response): Promise<{ bytes: Uint8Array; contentType: string }> => {
  if (!response.ok || !response.body) throw new Error('Image unavailable');
  if (Number(response.headers.get('content-length')) > MAX_PUBLIC_IMAGE_BYTES) {
    await response.body.cancel();
    throw new Error('Image too large');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PUBLIC_IMAGE_BYTES) throw new Error('Image too large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const contentType = detectImageType(bytes);
  if (!contentType || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== contentType) {
    throw new Error('Unsupported image content');
  }
  return { bytes, contentType };
};

export const setPublicResponseHeaders = (res: { setHeader: (name: string, value: string) => void }) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
};
