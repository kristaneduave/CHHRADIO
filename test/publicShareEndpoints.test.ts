// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import imageHandler from '../api/shared-case-image';
import reportHandler from '../api/shared-case';
import { shortenPublicCaseToken, normalizePublicCaseToken, getPublicCaseTokenFromPath } from '../utils/publicCaseLinks';

const token = '00000000-0000-4000-8000-000000000001';
const project = 'https://project.supabase.co';
const image = `${project}/storage/v1/object/public/case-images/user/image.png`;
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const response = () => ({ statusCode: 0, headers: {} as Record<string,string>,
  setHeader(name: string,value: string) { this.headers[name] = value; }, end: vi.fn() });
beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL',project); vi.stubEnv('VITE_SUPABASE_ANON_KEY','test-key'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('public endpoints', () => {
  it('preserves shortened and legacy tokens', () => {
    const shortened = shortenPublicCaseToken(token);
    expect(normalizePublicCaseToken(shortened)).toBe(token);
    expect(normalizePublicCaseToken(getPublicCaseTokenFromPath(`/shared/case/${token}`)!)).toBe(token);
    expect(normalizePublicCaseToken(getPublicCaseTokenFromPath(`/c/${shortened}`)!)).toBe(token);
    expect(normalizePublicCaseToken('x'.repeat(100000))).toBe('');
  });
  it('serves verified GET and HEAD images with no cache', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(url === image
      ? new Response(png,{headers:{'content-type':'image/png'}}) : Response.json([{image_url:image}])));
    vi.stubGlobal('fetch',fetchMock);
    for (const method of ['GET','HEAD']) {
      const res = response();
      await imageHandler({method,query:{token:shortenPublicCaseToken(token)}},res);
      expect(res.statusCode).toBe(200);
      expect(res.headers['Cache-Control']).toContain('no-store');
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.headers['Referrer-Policy']).toBe('no-referrer');
      if (method === 'HEAD') expect(res.end).toHaveBeenCalledWith(undefined);
    }
    expect(fetchMock.mock.calls[1][1].redirect).toBe('error');
  });
  it('rejects methods, invalid tokens, revoked links and upstream failures safely', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([])); vi.stubGlobal('fetch',fetchMock);
    const methodRes=response(); await imageHandler({method:'POST',query:{token}},methodRes); expect(methodRes.statusCode).toBe(405);
    const invalidRes=response(); await imageHandler({method:'GET',query:{token:'invalid'}},invalidRes); expect(invalidRes.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    const revoked=response(); await imageHandler({method:'GET',query:{token}},revoked); expect(revoked.statusCode).toBe(404);
    fetchMock.mockResolvedValueOnce(Response.json([{image_url:'http://127.0.0.1/internal'}]));
    const ssrf=response(); await imageHandler({method:'GET',query:{token}},ssrf); expect(ssrf.statusCode).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(ssrf.end.mock.calls)).not.toContain('127.0.0.1');
  });
  it('aborts stalled upstream work after ten seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn((_url,options) => new Promise((_resolve,reject) => {
      options.signal.addEventListener('abort',()=>reject(new Error('aborted')));
    })));
    const res=response(); const pending=imageHandler({method:'GET',query:{token}},res);
    await vi.advanceTimersByTimeAsync(10000); await pending; expect(res.statusCode).toBe(404);
  });
  it('does not cache HTML reports and preserves redirect routes', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json([{title:'Teaching <case>',findings:'Findings'}])));
    const res=response(); await reportHandler({method:'GET',headers:{host:'portal.example'},query:{token}},res);
    expect(res.statusCode).toBe(200); expect(res.headers['Cache-Control']).toContain('no-store');
    expect(res.end.mock.calls[0][0]).toContain('Teaching &lt;case&gt;');
    expect(res.end.mock.calls[0][0]).toContain(`/?publicCaseToken=${shortenPublicCaseToken(token)}`);
  });
});
