/* global process, console, URL, fetch, AbortSignal */
// Read-only operator tooling. Uses environment credentials, never command-line secrets.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const databaseUrl = process.env.SECURITY_DATABASE_URL;
const managementToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SECURITY_PROJECT_REF;
if (!databaseUrl || !managementToken || !projectRef || !/^[a-z0-9-]+$/.test(projectRef)) {
  console.error('Set SECURITY_DATABASE_URL, SUPABASE_ACCESS_TOKEN, and SECURITY_PROJECT_REF in the operator environment.');
  process.exit(1);
}
const database = new URL(databaseUrl);
const env = { ...process.env, PGHOST: database.hostname, PGPORT: database.port || '5432',
  PGDATABASE: decodeURIComponent(database.pathname.slice(1)), PGUSER: decodeURIComponent(database.username),
  PGPASSWORD: decodeURIComponent(database.password), PGSSLMODE: 'verify-full' };
// Default output is ignored by Git. Treat it as confidential operational configuration.
const directory = resolve('security-artifacts.local', new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(directory,{recursive:true});
const run = (command,args,output) => {
  const result = spawnSync(command,args,{env,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true});
  if (result.error || result.status !== 0) throw new Error(`${command} failed; confirm installed PostgreSQL tools, trusted TLS roots, and database access.`);
  writeFileSync(resolve(directory,output),result.stdout,{mode:0o600});
};
const redactSecrets = (value) => {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,
    /secret|password|token|smtp_pass|private_key/i.test(key) ? '[REDACTED]' : redactSecrets(item)]));
};
try {
  run('pg_dump',['--schema-only','--no-owner'],'schema.sql');
  run('psql',['-X','--set','ON_ERROR_STOP=1','--set',`project_origin=https://${projectRef}.supabase.co`,
    '--file',resolve('supabase/rollout/security_preflight.sql')],'database-preflight.txt');
  for (const [endpoint,file] of [['config/auth','auth-config.json'],['database/backups','recovery-status.json']]) {
    const response=await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/${endpoint}`,{
      headers:{Authorization:`Bearer ${managementToken}`},redirect:'error',signal:AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Management inspection failed (${response.status}); recovery is not verified.`);
    // Snapshot operational settings without copying provider credentials into artifacts.
    writeFileSync(resolve(directory,file),JSON.stringify(redactSecrets(await response.json()),null,2),{mode:0o600});
  }
  console.log('Read-only snapshots captured. Review recovery readiness and auth-hook configuration locally before rollout.');
} catch(error) {
  console.error(error instanceof Error ? error.message : 'Baseline capture failed.');
  process.exitCode=1;
}
