/* global process, console */
// Operator tooling. Lists Storage files that no database row links to, and deletes them only when
// run with --delete and the fingerprint of the list that was reviewed. Uses environment
// credentials, never command-line secrets.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const IMAGE_BUCKETS = ['case-images', 'avatars', 'quiz-images', 'announcements', 'announcement-images'];
// Endorsement and census files are records, so they are only cleaned when asked for.
const RECORD_BUCKETS = ['resident-endorsement-files', 'resident-census-evidence'];
const REMOVE_BATCH_SIZE = 100;

const args = process.argv.slice(2);
const unknown = args.filter((arg) => !/^--(delete|include-records|confirm=[0-9a-f]+|min-age-days=\d+)$/.test(arg));
if (unknown.length > 0) {
  console.error(`Unknown option: ${unknown.join(' ')}`);
  console.error('Options: --min-age-days=N (default 7), --include-records, --delete --confirm=FINGERPRINT');
  process.exit(1);
}
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in the operator environment.');
  process.exit(1);
}

const minAgeDays = Number(option('min-age-days') ?? 7);
const includeRecords = args.includes('--include-records');
const buckets = includeRecords ? [...IMAGE_BUCKETS, ...RECORD_BUCKETS] : IMAGE_BUCKETS;
const megabytes = (bytes) => `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
const csvField = (value) => `"${String(value).replace(/"/g, '""')}"`;

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: report, error } = await supabase.rpc('storage_cleanup_inventory', { p_min_age_days: minAgeDays });
if (error) {
  console.error(`Inventory failed (${error.message}). Apply supabase/migrations/202610070002_storage_cleanup.sql first.`);
  process.exit(1);
}

const candidates = report.unused.filter((file) => buckets.includes(file.bucket));
const candidateBytes = candidates.reduce((sum, file) => sum + Number(file.bytes), 0);
const totalBytes = report.buckets.reduce((sum, bucket) => sum + Number(bucket.bytes), 0);
const fingerprint = createHash('sha256')
  .update(candidates.map((file) => `${file.bucket}/${file.name}`).sort().join('\n'))
  .digest('hex').slice(0, 12);

console.table(report.buckets.map((bucket) => ({
  bucket: bucket.bucket,
  files: bucket.objects,
  size: megabytes(bucket.bytes),
  unused: bucket.unused_objects,
  'unused size': megabytes(bucket.unused_bytes),
  cleaned: buckets.includes(bucket.bucket) ? 'yes' : 'no',
})));
console.log(`Total stored: ${megabytes(totalBytes)}.`);
console.log(`Unused for over ${minAgeDays} days in cleaned buckets: ${candidates.length} files, ${megabytes(candidateBytes)}.`);

// File names include user ids, so the list goes to the Git-ignored operator directory.
const directory = resolve('security-artifacts.local', `storage-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(directory, { recursive: true });
const listPath = resolve(directory, 'unused-files.csv');
writeFileSync(listPath, ['bucket,name,bytes,created_at', ...candidates.map((file) =>
  [file.bucket, file.name, file.bytes, file.created_at].map(csvField).join(','))].join('\n'), { mode: 0o600 });
console.log(`Full list: ${listPath}`);

if (candidates.length === 0) {
  console.log('Nothing to delete.');
  process.exit(0);
}
if (!args.includes('--delete')) {
  console.log(`Dry run: nothing was deleted. After reviewing the list, delete these files with:`);
  console.log(`  node scripts/storage-cleanup.mjs --delete --confirm=${fingerprint}${minAgeDays === 7 ? '' : ` --min-age-days=${minAgeDays}`}${includeRecords ? ' --include-records' : ''}`);
  process.exit(0);
}
if (option('confirm') !== fingerprint) {
  console.error(`The unused list does not match --confirm (current fingerprint ${fingerprint}). Review the new list, then run again.`);
  process.exit(1);
}

let deleted = 0;
for (const bucket of buckets) {
  const names = candidates.filter((file) => file.bucket === bucket).map((file) => file.name);
  for (let start = 0; start < names.length; start += REMOVE_BATCH_SIZE) {
    const { data, error: removeError } = await supabase.storage.from(bucket).remove(names.slice(start, start + REMOVE_BATCH_SIZE));
    if (removeError) console.error(`${bucket}: ${removeError.message}`);
    else deleted += data?.length ?? 0;
  }
}
console.log(`Deleted ${deleted} of ${candidates.length} files.`);
if (deleted !== candidates.length) process.exitCode = 1;
