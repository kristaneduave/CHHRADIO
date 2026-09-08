// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: PGlite;
const migration = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const asUser = async (user: number | null, sql: string, role = user === null ? 'anon' : 'authenticated') => {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user ? id(user) : null, role, email: `user${user}@example.test` })]);
    await db.exec(`set local role ${role}`);
    const result = await db.query(sql);
    await db.exec('commit');
    return result.rows as Record<string, any>[];
  } catch (error) { await db.exec('rollback'); throw error; }
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role supabase_auth_admin;
    create schema auth; create schema storage;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    grant usage on schema auth,storage,public to anon,authenticated;
    create table profiles(id uuid primary key, role text, full_name text, nickname text, username text, year_level text, updated_at timestamptz);
    create table user_roles(user_id uuid references profiles(id),role text,created_by uuid,primary key(user_id,role));
    create table account_access_requests(id uuid primary key, email text, requested_role text, status text, year_level text,
      reviewed_at timestamptz,created_at timestamptz default now(),claimed_by uuid,claimed_at timestamptz);
    create function current_user_has_role(target_role text) returns boolean language sql stable security definer set search_path=public as $$
      select exists(select 1 from profiles where id=auth.uid() and role=target_role)
      or exists(select 1 from user_roles where user_id=auth.uid() and role=target_role)$$;
    create function current_user_has_any_role(target_roles text[]) returns boolean language sql stable security definer set search_path=public as $$
      select exists(select 1 from profiles where id=auth.uid() and role=any(target_roles))
      or exists(select 1 from user_roles where user_id=auth.uid() and role=any(target_roles))$$;
    create function sync_roles() returns trigger language plpgsql security definer set search_path=public as $$begin
      insert into user_roles values(new.id,new.role,auth.uid()) on conflict do nothing; return new; end$$;
    create trigger sync_roles after insert or update of role on profiles for each row execute function sync_roles();
    alter table profiles enable row level security;
    create policy profile_update on profiles for update to authenticated using(id=auth.uid() or current_user_has_role('admin'));
    create policy profile_read on profiles for select to authenticated using(true);
    grant select,insert,update,delete on profiles,user_roles to authenticated;
    create table consultant_covers(id uuid primary key,doctor_name text);
    alter table consultant_covers enable row level security;
    grant all on consultant_covers to anon,authenticated;
    create policy unsafe_cover on consultant_covers for all using(true) with check(true);
    create table cases(id uuid primary key,title text,status text,created_at timestamptz,submission_type text,modality text,
      organ_system text,diagnosis text,clinical_history text,findings text,educational_summary text,radiologic_clinchers text,
      image_url text,image_urls text[],analysis_result jsonb,patient_initials text,patient_age text,patient_sex text,created_by uuid,
      viber_shared_at timestamptz,viber_shared_by uuid,unexpected_secret text);
    create table case_shares(case_id uuid,public_token uuid,is_active boolean,revoked_at timestamptz);
    alter table cases enable row level security;
    grant select on cases to authenticated,anon;
    create policy legacy_cases_select on cases for select using(status='published' or created_by=auth.uid());
    create table storage.objects(id uuid primary key,bucket_id text,name text);
    create table storage.buckets(id text primary key, public boolean);
    insert into storage.buckets values('resident-endorsement-files',true),('resident-census-evidence',true);
    create table resident_endorsements(id uuid primary key,attachments jsonb);
    create table resident_monthly_census(id uuid primary key,fuente_ct_evidence_url text,fuente_mri_evidence_url text,
      fuente_xray_evidence_url text,mandaue_ct_evidence_url text,mandaue_mri_evidence_url text,attendance_evidence_url text);
    alter table storage.objects enable row level security;
    grant all on storage.objects to anon,authenticated;
    create policy legacy_storage on storage.objects for all using(true) with check(true);
  `);
  for (const [i, role] of ['admin','admin','resident','consultant','fellow','moderator','training_officer','faculty'].entries()) {
    await db.query('insert into profiles(id,role,full_name) values($1,$2,$3)', [id(i + 1), role, `Test ${role}`]);
  }
  for (const name of ['202609080001_atomic_role_assignment','202609080002_role_and_cover_boundaries',
    '202609080003_public_case_projection','202609080004_private_attachment_policies','202609080005_attachment_cutover_tools']) await db.exec(migration(name));
  await db.query(`insert into cases values($1,'Teaching case','published',now(),'interesting_case','CT','Chest','Diagnosis',
    'History','Findings','Summary','Clinchers','https://project.supabase.co/storage/v1/object/public/case-images/image.png',
    array['image.png'],$2,'SECRET_INITIALS','42','F',$3,now(),$3,'SECRET_FUTURE_COLUMN')`, [id(100), JSON.stringify({
      patientId: 'SECRET_ID', patient_id: 'SECRET_ALIAS', impression: 'Teaching impression',
      imagesMetadata: [{ description: 'Caption', patientId: 'SECRET_CAPTION' }],
      references: [{ title: 'Book', sourceType: 'Textbook', page: '1', internal: 'SECRET_REFERENCE' }],
      arbitrary: { secret: 'SECRET_JSON' },
    }), id(1)]);
  await db.query('insert into case_shares values($1,$2,true,null)',[id(100),id(200)]);
  for (const bucket of ['resident-endorsement-files','resident-census-evidence','case-images']) {
    await db.query('insert into storage.objects values($1,$2,$3)',[id(bucket === 'case-images' ? 302 : bucket === 'resident-census-evidence' ? 301 : 300),bucket,`${id(3)}/file.pdf`]);
  }
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('PostgreSQL security boundaries (synthetic Supabase-compatible schema)', () => {
  it('blocks self promotion for every non-admin, including moderators and training officers', async () => {
    for (const user of [3,4,5,6,7,8,9]) {
      await expect(asUser(user,`select set_user_roles('${id(user)}','admin',array['admin'])`)).rejects.toThrow('Administrator');
      if (user !== 9) await expect(asUser(user,`update profiles set role='admin' where id='${id(user)}'`)).rejects.toThrow('role assignment');
    }
    await expect(asUser(1,`insert into user_roles(user_id,role) values('${id(3)}','admin')`)).rejects.toThrow();
  });
  it('retains normal profile editing and applies complete role sets atomically', async () => {
    await asUser(3,`update profiles set full_name='Updated' where id='${id(3)}'`);
    await asUser(1,`select set_user_roles('${id(4)}','consultant',array['consultant','faculty'])`);
    expect((await db.query('select role from user_roles where user_id=$1 order by role',[id(4)])).rows).toEqual([{role:'consultant'},{role:'faculty'}]);
    await expect(asUser(1,`select set_user_roles('${id(4)}','training_officer',array['training_officer','admin'])`)).rejects.toThrow('only role');
    expect((await db.query('select role from profiles where id=$1',[id(4)])).rows).toEqual([{role:'consultant'}]);
  });
  it('prevents losing the final admin and rolls back all changes on failure', async () => {
    await asUser(1,`select set_user_roles('${id(2)}','resident',array['resident'])`);
    await expect(asUser(1,`select set_user_roles('${id(1)}','resident',array['resident'])`)).rejects.toThrow('final administrator');
    expect((await db.query('select role from user_roles where user_id=$1',[id(1)])).rows).toEqual([{role:'admin'}]);
    await asUser(1,`select set_user_roles('${id(2)}','admin',array['admin'])`);
  });
  it('allows approved onboarding but never replays approval into an existing profile', async () => {
    await db.query(`insert into account_access_requests(id,email,requested_role,status) values($1,'user10@example.test','fellow','approved'),($2,'user3@example.test','consultant','approved')`,[id(500),id(501)]);
    await asUser(10,"select complete_approved_profile('New Fellow','Fellow')");
    await asUser(3,"select complete_approved_profile('Resident','Resident')");
    expect((await db.query('select role from profiles where id=$1',[id(3)])).rows).toEqual([{role:'resident'}]);
    expect((await db.query('select full_name from profiles where id=$1',[id(3)])).rows).toEqual([{full_name:'Resident'}]);
    await expect(asUser(9,"select complete_approved_profile('No Approval','No')")).rejects.toThrow('approval');
  });
  it('allows legacy staff cover CRUD but denies guests and users without profiles', async () => {
    await expect(asUser(null,'select * from consultant_covers')).rejects.toThrow();
    await expect(asUser(9,`insert into consultant_covers values('${id(400)}','Denied')`)).rejects.toThrow();
    for (const user of [1,3,4,5,6,7,8]) {
      await asUser(user,`insert into consultant_covers values('${id(400)}','Cover')`);
      await asUser(user,`update consultant_covers set doctor_name='Updated' where id='${id(400)}'`);
      expect(await asUser(user,'select doctor_name from consultant_covers')).toEqual([{doctor_name:'Updated'}]);
      await asUser(user,`delete from consultant_covers where id='${id(400)}'`);
    }
  });
  it('projects anonymous/unapproved lists and every public token response, including signed-in admins', async () => {
    await expect(asUser(null,'select * from cases')).rejects.toThrow('permission denied');
    expect(await asUser(9,'select * from cases')).toEqual([]);
    for (const user of [null,9]) {
      const result = await asUser(user,'select * from list_published_cases_for_viewer()');
      expect(JSON.stringify(result)).not.toContain('SECRET');
      expect(result[0].patient_age).toBeNull();
      expect(result[0].findings).toBe('Findings');
    }
    for (const user of [null,1,3]) expect(JSON.stringify(await asUser(user,`select * from resolve_public_case_by_token('${id(200)}')`))).not.toContain('SECRET');
    expect(JSON.stringify(await asUser(3,'select * from list_published_cases_for_viewer()'))).toContain('SECRET_ID');
    await db.exec(`update case_shares set is_active=false`);
    expect(await asUser(null,`select * from resolve_public_case_by_token('${id(200)}')`)).toEqual([]);
    await db.exec(`update case_shares set is_active=true; update cases set status='draft'`);
    expect(await asUser(null,'select * from list_published_cases_for_viewer()')).toEqual([]);
    expect(await asUser(null,`select * from resolve_public_case_by_token('${id(200)}')`)).toEqual([]);
    await db.exec(`update cases set status='published'`);
  });
  it('enforces storage boundaries even when legacy permissive policies exist', async () => {
    expect((await asUser(null,'select * from storage.objects')).map(row=>row.bucket_id)).toEqual(['case-images']);
    expect((await asUser(3,'select * from storage.objects')).length).toBe(3);
    expect((await asUser(4,"select * from storage.objects where bucket_id='resident-census-evidence'")).length).toBe(0);
    expect((await asUser(7,"select * from storage.objects where bucket_id='resident-census-evidence'")).length).toBe(1);
    await expect(asUser(4,`insert into storage.objects values('${id(700)}','resident-census-evidence','${id(3)}/forged.pdf')`)).rejects.toThrow();
    await asUser(4,`insert into storage.objects values('${id(700)}','resident-census-evidence','${id(4)}/own.pdf')`);
  });
  it('blocks privacy cutover until every legacy and canonical attachment resolves', async () => {
    const origin = 'https://project.supabase.co';
    await db.query('insert into resident_endorsements values($1,$2)',[id(800),JSON.stringify([{url:`${origin}/storage/v1/object/public/resident-endorsement-files/${id(3)}/file.pdf`},{url:'https://unknown.example/file.pdf'}])]);
    await expect(db.query(`select activate_internal_attachment_privacy('resident-endorsement-files',$1)`,[origin])).rejects.toThrow('unresolved');
    expect((await db.query(`select public from storage.buckets where id='resident-endorsement-files'`)).rows).toEqual([{public:true}]);
    await db.query('update resident_endorsements set attachments=$1',[JSON.stringify([{url:`storage://resident-endorsement-files/${id(3)}/file.pdf`}])]);
    await expect(asUser(1,`select activate_internal_attachment_privacy('resident-endorsement-files','${origin}')`)).rejects.toThrow('permission denied');
    await db.query(`select activate_internal_attachment_privacy('resident-endorsement-files',$1)`,[origin]);
    expect((await db.query(`select public from storage.buckets where id='resident-endorsement-files'`)).rows).toEqual([{public:false}]);
    expect((await db.query(`select count(*)::int n from storage.objects where bucket_id='resident-endorsement-files'`)).rows).toEqual([{n:1}]);
    const decoded = await db.query(`select internal_attachment_path('storage://resident-endorsement-files/u/file%20name.pdf','resident-endorsement-files',$1) path`,[origin]);
    expect(decoded.rows).toEqual([{path:'u/file name.pdf'}]);
  });
});
