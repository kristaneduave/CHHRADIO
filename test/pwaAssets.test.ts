import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PWA assets', () => {
  it('provides an installable standalone manifest', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8'));
    expect(manifest).toMatchObject({
      name: 'CHH Radiology Portal',
      short_name: 'RADCORE',
      display: 'standalone',
      start_url: '/',
    });
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/logo-radcore.png', sizes: '512x512' }),
    ]));
  });

  it('limits service-worker caching to the shell and trusted static origins', () => {
    const serviceWorker = readFileSync(resolve('public/sw.js'), 'utf8');
    expect(serviceWorker).toContain("url.pathname.startsWith('/api/')");
    expect(serviceWorker).toContain("url.pathname.startsWith('/assets/')");
    expect(serviceWorker).not.toContain('supabase.co');
    expect(serviceWorker).not.toContain('case-images');
  });
});
