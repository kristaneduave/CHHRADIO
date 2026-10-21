// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: PGlite;
const migration = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const asRole = async (role: string, user: number | null, sql: string, params: unknown[] = []) => {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user ? id(user) : null, role })]);
    await db.exec(`set local role ${role}`);
    const result = await db.query(sql, params);
    await db.exec('commit');
    return result.rows as Record<string, any>[];
  } catch (error) { await db.exec('rollback'); throw error; }
};
const asUser = (user: number | null, sql: string, params: unknown[] = []) =>
  asRole(user === null ? 'anon' : 'authenticated', user, sql, params);

const U1 = id(1);
const U2 = id(2);
const CASE_KEPT = id(100);
const CASE_DELETED = id(101);
const origin = 'https://project.supabase.co';
const publicUrl = (bucket: string, path: string) => `${origin}/storage/v1/object/public/${bucket}/${path}`;
const inventory = async () => (await asRole('service_role', null, 'select storage_cleanup_inventory() report'))[0].report;
const unusedKeys = (report: any) => report.unused.map((item: any) => `${item.bucket}/${item.name}`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text,
      created_at timestamptz default now() - interval '30 days', metadata jsonb);
    alter table storage.objects enable row level security;
    grant select, delete on storage.objects to anon, authenticated;
    create table cases(id uuid primary key, created_by uuid, image_url text, image_urls text[], educational_summary text);
    create table live_aunt_minnie_prompt_images(id serial primary key, image_url text);
    create table profiles(id uuid primary key, avatar_url text);
    create table resident_endorsements(id serial primary key, attachments jsonb);
    create table teaching_notes(id serial primary key, body varchar(500));
  `);
  const objects: Array<[string, string, number, boolean?]> = [
    ['case-images', `${U1}/kept.png`, 100],
    ['case-images', `${U1}/deleted-case.png`, 200],
    ['case-images', `${U1}/aunt-minnie.png`, 300],
    ['case-images', `${U1}/my photo.png`, 400],
    ['case-images', `${U1}/signed.png`, 50],
    ['case-images', `${U1}/prose.png`, 40],
    ['case-images', `${U1}/fresh.png`, 60, true],
    ['case-images', `${U1}/.emptyFolderPlaceholder`, 0],
    ['case-images', `${U2}/other.png`, 70],
    ['avatars', '0.111.png', 10],
    ['avatars', '0.222.png', 20],
    ['resident-endorsement-files', `${U1}/kept.pdf`, 30],
    ['resident-endorsement-files', `${U1}/old.pdf`, 40],
  ];
  for (const [bucket, name, size, fresh] of objects) {
    await db.query(`insert into storage.objects(bucket_id,name,metadata${fresh ? ',created_at' : ''}) values($1,$2,$3${fresh ? ',now()' : ''})`,
      [bucket, name, JSON.stringify({ size })]);
  }
  await db.query('insert into cases values($1,$2,$3,$4,$5),($6,$2,$7,$8,null)', [
    CASE_KEPT, U1, publicUrl('case-images', `${U1}/kept.png`), [publicUrl('case-images', `${U1}/kept.png`)],
    `<p>Prior study <img src="${publicUrl('case-images', `${U1}/my%20photo.png`)}"></p>`,
    CASE_DELETED, publicUrl('case-images', `${U1}/deleted-case.png`),
    [publicUrl('case-images', `${U1}/deleted-case.png`), publicUrl('case-images', `${U1}/aunt-minnie.png`)],
  ]);
  await db.query('insert into live_aunt_minnie_prompt_images(image_url) values($1)', [publicUrl('case-images', `${U1}/aunt-minnie.png`)]);
  await db.query('insert into profiles values($1,$2)', [U1, publicUrl('avatars', '0.111.png')]);
  await db.query('insert into resident_endorsements(attachments) values($1)',
    [JSON.stringify([{ name: 'Rota', file: { url: `storage://resident-endorsement-files/${U1}/kept.pdf` } }])]);
  await db.query('insert into teaching_notes(body) values($1),($2)', [
    `${origin}/storage/v1/object/sign/case-images/${U1}/signed.png?token=abc`,
    `See ${publicUrl('case-images', `${U1}/prose.png`)}, then compare.`,
  ]);
  await db.exec(migration('202610070002_storage_cleanup'));
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('storage cleanup', () => {
  it('lists only old files that no column links to, in any format', async () => {
    const report = await inventory();
    expect(unusedKeys(report)).toEqual([
      'avatars/0.222.png',
      `case-images/${U2}/other.png`,
      `resident-endorsement-files/${U1}/old.pdf`,
    ]);
    const caseImages = report.buckets.find((bucket: any) => bucket.bucket === 'case-images');
    expect(caseImages).toMatchObject({ objects: 9, bytes: 1220, unused_objects: 1, unused_bytes: 70 });
  });

  it('keeps the inventory away from app users', async () => {
    await expect(asUser(null, 'select storage_cleanup_inventory()')).rejects.toThrow('permission denied');
    await expect(asUser(1, 'select storage_cleanup_inventory()')).rejects.toThrow('permission denied');
    await expect(asUser(1, 'select * from storage_object_references()')).rejects.toThrow('permission denied');
    await expect(asRole('service_role', null, 'select storage_cleanup_inventory(0)')).rejects.toThrow('at least 1 day');
  });

  it('releases a deleted case\'s own images unless something else still links to them', async () => {
    const references = [
      publicUrl('case-images', `${U1}/deleted-case.png`),
      publicUrl('case-images', `${U1}/aunt-minnie.png`),
      publicUrl('case-images', `${U1}/missing.png`),
      publicUrl('case-images', `${U2}/other.png`),
    ];
    expect((await asUser(1, 'select releasable_case_images($1) names', [references]))[0].names).toEqual([]);
    await db.query('delete from cases where id=$1', [CASE_DELETED]);
    expect((await asUser(1, 'select releasable_case_images($1) names', [references]))[0].names).toEqual([`${U1}/deleted-case.png`]);
    expect((await asUser(2, 'select releasable_case_images($1) names', [references]))[0].names).toEqual([`${U2}/other.png`]);
    expect(unusedKeys(await inventory())).toContain(`case-images/${U1}/deleted-case.png`);
    expect(unusedKeys(await inventory())).not.toContain(`case-images/${U1}/aunt-minnie.png`);
  });

  it('rejects guests and oversized requests', async () => {
    await expect(asUser(null, `select releasable_case_images(array['x'])`)).rejects.toThrow();
    await expect(asUser(1, 'select releasable_case_images($1)', [Array.from({ length: 21 }, (_, i) => `x${i}`)]))
      .rejects.toThrow('Too many');
  });

  it('lets uploaders delete only their own case images', async () => {
    const remove = (user: number, bucket: string, name: string) =>
      asUser(user, 'delete from storage.objects where bucket_id=$1 and name=$2 returning name', [bucket, name]);
    expect(await remove(2, 'case-images', `${U1}/deleted-case.png`)).toEqual([]);
    expect(await remove(1, 'avatars', '0.222.png')).toEqual([]);
    expect(await remove(1, 'case-images', `${U1}/deleted-case.png`)).toEqual([{ name: `${U1}/deleted-case.png` }]);
  });
});
