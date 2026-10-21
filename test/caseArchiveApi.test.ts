// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/case-archive';

const CASE_ID = '00000000-0000-4000-8000-000000000100';
const FILE_ID = '1AbCdEfGhIjKlMnOpQrStUv';
const FOLDER = 'folder123';
const SHA = 'a'.repeat(64);
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=xyz';

const call = async (req: any) => {
  const res: any = { headers: {} as Record<string, string>, setHeader(name: string, value: string) { this.headers[name] = value; } };
  await new Promise<void>((resolve) => { res.end = (body?: any) => { res.body = body; resolve(); }; void handler(req, res); });
  return { status: res.statusCode, json: typeof res.body === 'string' ? JSON.parse(res.body) : res.body, headers: res.headers };
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

let routes: Array<[RegExp, (url: string, init: any) => Response]>;
const fetchMock = vi.fn(async (input: any, init: any = {}) => {
  const url = String(input);
  const route = routes.find(([pattern]) => pattern.test(`${init.method || 'GET'} ${url}`));
  if (!route) throw new Error(`Unexpected fetch ${init.method || 'GET'} ${url}`);
  return route[1](url, init);
});
const called = (pattern: RegExp) => fetchMock.mock.calls.some(([input, init]) => pattern.test(`${init?.method || 'GET'} ${input}`));

beforeEach(() => {
  Object.assign(process.env, {
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon',
    GOOGLE_DRIVE_CLIENT_ID: 'client',
    GOOGLE_DRIVE_CLIENT_SECRET: 'secret',
    GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh',
    GOOGLE_DRIVE_ARCHIVE_FOLDER_ID: FOLDER,
  });
  routes = [[/^POST https:\/\/oauth2\.googleapis\.com\/token$/, () => json({ access_token: 'google', expires_in: 3600 })]];
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); fetchMock.mockClear(); });

const auth = { authorization: 'Bearer user-jwt' };

describe('case archive API', () => {
  it('requires sign-in and lets the database decide who may archive', async () => {
    expect((await call({ method: 'POST', query: { action: 'start' }, headers: {}, body: {} })).status).toBe(401);

    routes.push([/rpc\/prepare_case_archive$/, () => json({ code: 'P0002', message: 'Case not found.' }, 400)]);
    const denied = await call({ method: 'POST', query: { action: 'start' }, headers: auth, body: { caseId: CASE_ID, size: 10, sha256: SHA } });
    expect(denied).toMatchObject({ status: 404, json: { error: 'Case not found.' } });
    expect(called(/upload\/drive/)).toBe(false);
  });

  it('starts a Drive upload in the archive folder with the checksum attached', async () => {
    routes.push(
      [/rpc\/prepare_case_archive$/, () => json({ title: 'Chest / CT: "x"' })],
      [/^POST https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/, () => new Response(null, { status: 200, headers: { Location: UPLOAD_URL } })],
    );
    const result = await call({ method: 'POST', query: { action: 'start' }, headers: auth, body: { caseId: CASE_ID, size: 10, sha256: SHA } });
    expect(result).toMatchObject({ status: 200, json: { uploadUrl: UPLOAD_URL } });
    const [, init] = fetchMock.mock.calls.find(([input]) => String(input).includes('upload/drive'))!;
    expect(JSON.parse(init.body)).toEqual({
      name: 'Chest CT x (00000000).pdf',
      mimeType: 'application/pdf',
      parents: [FOLDER],
      appProperties: { caseId: CASE_ID, sha256: SHA, size: '10' },
    });
  });

  it('only relays chunks to Google Drive upload sessions', async () => {
    routes.push([/auth\/v1\/user$/, () => json({ id: 'user' })]);
    const chunk = (url: string) => call({
      method: 'PUT', query: { action: 'chunk' }, body: Buffer.from('abc'),
      headers: { ...auth, 'x-upload-url': url, 'content-range': 'bytes 0-2/3' },
    });
    expect((await chunk('https://evil.example/upload/drive/v3/files?upload_id=1')).status).toBe(400);
    expect((await chunk('https://www.googleapis.com/drive/v3/files?upload_id=1')).status).toBe(400);
    routes.push([/^PUT https:\/\/www\.googleapis\.com\/upload/, () => json({ id: FILE_ID })]);
    expect((await chunk(UPLOAD_URL)).json).toEqual({ done: true, fileId: FILE_ID });
  });

  it('removes nothing when the Drive file does not match what was uploaded', async () => {
    routes.push(
      [/drive\/v3\/files\/1AbC/, () => json({ id: FILE_ID, size: '10', sha256Checksum: 'b'.repeat(64), parents: [FOLDER],
        appProperties: { caseId: CASE_ID, sha256: SHA, size: '10' } })],
      [/rpc\/complete_case_archive$/, () => json([])],
    );
    const result = await call({ method: 'POST', query: { action: 'finish' }, headers: auth, body: { caseId: CASE_ID, fileId: FILE_ID } });
    expect(result.status).toBe(409);
    expect(called(/complete_case_archive/)).toBe(false);
  });

  it('records the archive and removes the released images once Drive confirms the PDF', async () => {
    routes.push(
      [/drive\/v3\/files\/1AbC/, () => json({ id: FILE_ID, size: '10', sha256Checksum: SHA, parents: [FOLDER],
        appProperties: { caseId: CASE_ID, sha256: SHA, size: '10' } })],
      [/rpc\/complete_case_archive$/, () => json(['u1/a.png', 'u1/b.png'])],
      [/^DELETE .*storage\/v1\/object\/case-images$/, () => json([{ name: 'u1/a.png' }, { name: 'u1/b.png' }])],
    );
    const result = await call({ method: 'POST', query: { action: 'finish' }, headers: auth, body: { caseId: CASE_ID, fileId: FILE_ID } });
    expect(result).toMatchObject({ status: 200, json: { fileId: FILE_ID, sizeBytes: 10, removedImages: 2, imagesToRemove: 2 } });
    const [, init] = fetchMock.mock.calls.find(([input]) => String(input).includes('storage/v1'))!;
    expect(init.headers.Authorization).toBe('Bearer user-jwt');
    expect(JSON.parse(init.body)).toEqual({ prefixes: ['u1/a.png', 'u1/b.png'] });
  });

  it('serves the archived PDF only for cases the user can read', async () => {
    routes.push([/rest\/v1\/cases\?/, () => json([])]);
    expect((await call({ method: 'GET', query: { action: 'file', caseId: CASE_ID }, headers: auth })).status).toBe(404);
    routes.unshift(
      [/rest\/v1\/cases\?/, () => json([{ archive_drive_file_id: FILE_ID }])],
      [/alt=media/, () => new Response('%PDF', { status: 206, headers: { 'Content-Range': 'bytes 0-3/4' } })],
    );
    const result = await call({ method: 'GET', query: { action: 'file', caseId: CASE_ID, offset: '0' }, headers: auth });
    expect(result.status).toBe(200);
    expect(result.headers['X-Archive-Total']).toBe('4');
    expect(Buffer.from(result.json as any).toString()).toBe('%PDF');
  });
});
