// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { detectImageType, MAX_PUBLIC_IMAGE_BYTES, readVerifiedImage, validatePublicImageUrl } from '../utils/publicImageSecurity';

const project = 'https://project.supabase.co';
const allowed = `${project}/storage/v1/object/public/case-images/user/image.png`;
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
describe('public image boundary', () => {
  it('allows only the configured HTTPS storage bucket', () => {
    expect(validatePublicImageUrl(allowed,project)).toBe(allowed);
    for (const url of [allowed.replace('https:','http:'),allowed.replace('project.','other.'),
      allowed.replace('case-images/','avatars/'),allowed.replace('project.supabase.co','project.supabase.co:444'),
      allowed.replace('https://','https://user:password@'),allowed+'?redirect=http://127.0.0.1',
      'http://127.0.0.1/private','http://169.254.169.254/latest/meta-data/',
      `${project}/storage/v1/object/public/case-images/user/%2e%2e%2fsecret`,
      `${project}/storage/v1/object/public/case-images/user/%5csecret`]) {
      expect(() => validatePublicImageUrl(url,project)).toThrow();
    }
  });
  it('checks declared type against signatures and rejects active content', async () => {
    expect((await readVerifiedImage(new Response(png,{headers:{'content-type':'image/png'}}))).contentType).toBe('image/png');
    await expect(readVerifiedImage(new Response(png,{headers:{'content-type':'text/html'}}))).rejects.toThrow();
    for (const content of ['<html><script>alert(1)</script></html>','<svg xmlns="http://www.w3.org/2000/svg"></svg>']) {
      await expect(readVerifiedImage(new Response(content,{headers:{'content-type':'image/png'}}))).rejects.toThrow();
    }
    expect(detectImageType(new Uint8Array([255,216,255,0,0,0,0,0,0,0,0,0]))).toBe('image/jpeg');
    expect(detectImageType(new TextEncoder().encode('GIF89a00000000'))).toBe('image/gif');
    expect(detectImageType(new TextEncoder().encode('RIFF0000WEBP0000'))).toBe('image/webp');
    const avif = new Uint8Array([0,0,0,20,...new TextEncoder().encode('ftypavif0000avif')]);
    expect(detectImageType(avif)).toBe('image/avif');
  });
  it('limits declared and streamed bytes without trusting content-length', async () => {
    await expect(readVerifiedImage(new Response(png,{headers:{'content-type':'image/png','content-length':String(MAX_PUBLIC_IMAGE_BYTES+1)}}))).rejects.toThrow('too large');
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(MAX_PUBLIC_IMAGE_BYTES)); controller.enqueue(new Uint8Array(1)); },
      cancel() { cancelled = true; },
    });
    await expect(readVerifiedImage(new Response(stream,{headers:{'content-type':'image/png'}}))).rejects.toThrow('too large');
    expect(cancelled).toBe(true);
  });
});
