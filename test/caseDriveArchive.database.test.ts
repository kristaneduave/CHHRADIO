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

const OWNER = 1;
const OTHER = 2;
const ADMIN = 3;
const CASE_A = id(100);
const CASE_B = id(101);
const CASE_EMPTY = id(102);
const DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUv';
const origin = 'https://project.supabase.co';
const imageUrl = (name: string) => `${origin}/storage/v1/object/public/case-images/${id(OWNER)}/${name}`;
const complete = (user: number, caseId: string, driveId: string | null = DRIVE_ID) =>
  asUser(user, 'select complete_case_archive($1,$2,1234) names', [caseId, driveId]);

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
    create table cases(id uuid primary key, created_by uuid, title text, created_at timestamptz default now(),
      image_url text, image_urls text[], educational_summary text);
    alter table cases enable row level security;
    grant select on cases to authenticated;
    create policy cases_read on cases for select to authenticated using (true);
    create table profiles(id uuid primary key, role text, nickname text, full_name text);
    create table quiz_questions(id serial primary key, image_url text);
    create function public.is_admin() returns boolean language sql stable security definer set search_path = public
      as $$select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')$$;
  `);
  await db.query(`insert into profiles values($1,'resident','Ana',null),($2,'resident',null,'Ben Cruz'),($3,'admin',null,null)`,
    [id(OWNER), id(OTHER), id(ADMIN)]);
  for (const [name, size] of [['a1.png', 100], ['a2.png', 200], ['quiz.png', 300], ['b1.png', 50]] as const) {
    await db.query(`insert into storage.objects(bucket_id,name,metadata) values('case-images',$1,$2)`,
      [`${id(OWNER)}/${name}`, JSON.stringify({ size })]);
  }
  await db.query('insert into cases(id,created_by,title,image_url,image_urls) values($1,$2,$3,$4,$5),($6,$2,$7,$8,$9),($10,$2,$11,null,$12)', [
    CASE_A, id(OWNER), 'Case A', imageUrl('a1.png'), [imageUrl('a1.png'), imageUrl('a2.png'), imageUrl('quiz.png')],
    CASE_B, 'Case B', imageUrl('b1.png'), [imageUrl('b1.png')],
    CASE_EMPTY, 'No images', [],
  ]);
  await db.query('insert into quiz_questions(image_url) values($1)', [imageUrl('quiz.png')]);
  await db.exec(migration('202610070002_storage_cleanup'));
  await db.exec(migration('202610210001_case_drive_archive'));
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('case Drive archive', () => {
  it('lets owners and admins prepare an archive, and nobody else', async () => {
    expect((await asUser(OWNER, 'select prepare_case_archive($1) r', [CASE_A]))[0].r).toEqual({ title: 'Case A' });
    expect((await asUser(ADMIN, 'select prepare_case_archive($1) r', [CASE_A]))[0].r).toEqual({ title: 'Case A' });
    await expect(asUser(OTHER, 'select prepare_case_archive($1)', [CASE_A])).rejects.toThrow('Case not found');
    await expect(asUser(null, 'select prepare_case_archive($1)', [CASE_A])).rejects.toThrow('permission denied');
    await expect(asUser(OWNER, 'select prepare_case_archive($1)', [CASE_EMPTY])).rejects.toThrow('no images');
    await expect(asUser(OWNER, 'select case_archive_target($1)', [CASE_A])).rejects.toThrow('permission denied');
  });

  it('lists candidates with their image storage for admins only', async () => {
    const rows = await asUser(ADMIN, 'select * from case_archive_candidates()');
    expect(rows.map((row) => [row.title, row.owner_name, row.image_count, Number(row.bytes)])).toEqual([
      ['Case A', 'Ana', 3, 600],
      ['Case B', 'Ana', 1, 50],
    ]);
    await expect(asUser(OWNER, 'select * from case_archive_candidates()')).rejects.toThrow('Admins only');
  });

  it('rejects other users and malformed Drive ids without touching the case', async () => {
    await expect(complete(OTHER, CASE_A)).rejects.toThrow('Case not found');
    await expect(complete(OWNER, CASE_A, '../../etc')).rejects.toThrow('Invalid Drive file');
    await expect(complete(OWNER, CASE_A, null)).rejects.toThrow('Only admins');
    const [row] = await asUser(OWNER, 'select archived_at, cardinality(image_urls) n from cases where id=$1', [CASE_A]);
    expect(row).toEqual({ archived_at: null, n: 3 });
  });

  it('unlinks the images and returns only those nothing else uses', async () => {
    expect((await complete(OWNER, CASE_A))[0].names).toEqual([`${id(OWNER)}/a1.png`, `${id(OWNER)}/a2.png`]);
    const [row] = await asUser(OWNER, 'select image_url, image_urls, archived_by, archive_drive_file_id, archive_size_bytes from cases where id=$1', [CASE_A]);
    expect(row).toMatchObject({ image_url: null, image_urls: [], archived_by: id(OWNER), archive_drive_file_id: DRIVE_ID });
    expect(Number(row.archive_size_bytes)).toBe(1234);
    await expect(complete(OWNER, CASE_A)).rejects.toThrow('already archived');
    expect((await asUser(ADMIN, 'select * from case_archive_candidates()')).map((r) => r.title)).toEqual(['Case B']);
  });

  it('lets admins archive and remove images of other people\'s cases', async () => {
    const remove = (user: number) => asUser(user, `delete from storage.objects where bucket_id='case-images' and name=$1 returning name`,
      [`${id(OWNER)}/b1.png`]);
    expect(await remove(OTHER)).toEqual([]);
    // Uploaded to Drive by hand: no Drive file id.
    expect((await complete(ADMIN, CASE_B, null))[0].names).toEqual([`${id(OWNER)}/b1.png`]);
    const [row] = await asUser(ADMIN, 'select archived_at is not null archived, archive_drive_file_id from cases where id=$1', [CASE_B]);
    expect(row).toEqual({ archived: true, archive_drive_file_id: null });
    expect(await remove(ADMIN)).toEqual([{ name: `${id(OWNER)}/b1.png` }]);
  });
});
