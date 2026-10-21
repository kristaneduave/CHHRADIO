/* global process, console, URL, URLSearchParams, fetch */
// Operator tooling. Signs in to the department Google account once and prints the values that
// api/case-archive.ts needs, for pasting into Vercel's environment variables. Nothing is saved to
// disk. The app may only see files it creates (drive.file scope), so the archive folder is created
// here rather than picked from Drive.
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const FOLDER_NAME = 'CHH Radiology Case Archive';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET (a "Desktop app" OAuth client) first.');
  process.exit(1);
}

const base64url = (buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const verifier = base64url(randomBytes(32));
const state = base64url(randomBytes(16));

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/callback') { res.statusCode = 404; res.end(); return; }
    const done = (message) => { res.setHeader('Content-Type', 'text/plain'); res.end(message); server.close(); };
    if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
      done('Sign-in failed. Return to the terminal.');
      reject(new Error(url.searchParams.get('error') || 'Sign-in was not completed.'));
      return;
    }
    done('Signed in. You can close this tab and return to the terminal.');
    resolve({ value: url.searchParams.get('code'), redirectUri: `http://127.0.0.1:${server.address().port}/callback` });
  });
  server.listen(0, '127.0.0.1', () => {
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `http://127.0.0.1:${server.address().port}/callback`,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: base64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
    }).toString();
    console.log('Open this link and sign in with the DEPARTMENT Google account:\n');
    console.log(`${auth}\n`);
  });
});

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code.value,
    code_verifier: verifier,
    redirect_uri: code.redirectUri,
    grant_type: 'authorization_code',
  }),
});
const tokens = await tokenResponse.json();
if (!tokenResponse.ok || !tokens.refresh_token) {
  console.error(`Google did not return a refresh token (${tokens.error_description || tokens.error || tokenResponse.status}).`);
  process.exit(1);
}
const google = (path, init = {}) => fetch(`https://www.googleapis.com${path}`, {
  ...init,
  headers: { Authorization: `Bearer ${tokens.access_token}`, ...(init.headers || {}) },
});

const about = await (await google('/drive/v3/about?fields=user(emailAddress),storageQuota')).json();
const folderResponse = await google('/drive/v3/files?fields=id', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
});
const folder = await folderResponse.json();
if (!folderResponse.ok || !folder.id) {
  console.error('Signed in, but the archive folder could not be created.');
  process.exit(1);
}

const quota = about.storageQuota || {};
const gigabytes = (bytes) => `${(Number(bytes || 0) / 1024 ** 3).toFixed(1)} GB`;
console.log(`Signed in as ${about.user?.emailAddress}. Drive used ${gigabytes(quota.usage)} of ${quota.limit ? gigabytes(quota.limit) : 'unlimited'}.`);
console.log(`Created the folder "${FOLDER_NAME}" in that account's My Drive.\n`);
console.log('Add these to Vercel → Project → Settings → Environment Variables (Production), then redeploy:\n');
console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`);
console.log('GOOGLE_DRIVE_CLIENT_SECRET=(the client secret you already have)');
console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
console.log(`GOOGLE_DRIVE_ARCHIVE_FOLDER_ID=${folder.id}\n`);
console.log('Treat the refresh token like a password: it can read and add files the app created in that Drive.');
