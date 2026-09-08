# Security hardening: release and recovery runbook

## Status and scope

The code and forward migrations preserve guest case browsing, existing UUID/short/query share links,
approved-staff cover editing, existing public teaching content, and existing storage objects.
Anonymous responses omit structured patient/staff identifiers and demographics. Free text, titles,
references, captions, and burned-in image labels are **not automatically de-identified**; review them separately.

The SQL connector returned `Unauthorized` during implementation. Production policies, hook activation,
backups, storage inventory, and deployment have **not** been verified or changed. Do not treat local
tests as evidence that production has these protections. No historical repair SQL was applied.

## Baseline and release gates

1. Restore the Supabase SQL/management connection for the configured project. Confirm it matches the app URL.
2. On the operator machine install official PostgreSQL `pg_dump` and `psql`. Set `SECURITY_DATABASE_URL`,
   `SECURITY_PROJECT_REF`, and `SUPABASE_ACCESS_TOKEN` in the environment, then run
   `node scripts/security-baseline.mjs`. Never paste credentials into source files or command arguments.
   Output goes under ignored `security-artifacts.local/`; restrict its OS permissions to the operator.
   This captures schema/grants/functions/triggers, RLS policies, bucket metadata, Auth settings and
   backup status. Credential-like Auth fields are redacted; retain existing credentials in their vault.
   It does not create a new recovery point or prove restoration works.
3. Verify a recent restorable backup or PITR window in the captured recovery status; perform a restore
   rehearsal in an isolated project. Confirm the staff-approval hook is actually enabled and its URI
   references `hook_require_approved_access_request`. Stop if either check is unavailable.
4. Compare the snapshot to the migration assumptions: tables/columns, function signatures, RLS,
   role grants (including inherited grants), trigger ownership, multi-role rules and existing valid staff.
   Do not reclassify or delete legacy staff. Resolve schema drift through new reviewed migrations.
5. Inspect the metadata-only image report. Anything above 20 MiB, an unsupported/unknown MIME type,
   or an image URL outside the configured HTTPS case-images bucket blocks the image-proxy release.
   Object sizes/MIME alone do not prove image signatures; verify representative allowed formats in staging.
   Do not rewrite or delete incompatible originals automatically.

## Checkpoint order

**A — Additive database support.** Apply `202609080001_atomic_role_assignment.sql` first. Verify admin
role assignment, ordinary profile editing, and first-time/repeated approved onboarding with synthetic accounts.
It adds the atomic RPC without yet revoking existing role-write privileges.

**B — Compatible application.** Deploy the application with atomic admin role updates, attachment readers
that accept both legacy public URLs and `storage://bucket/path` references, and on-demand signed links.
Verify a pre-existing attachment and a newly uploaded attachment in each screen. Signed links are generated
on every opening, expire in 600 seconds, and are never stored in database rows or shared caches. Have clients
reload to this compatible release before privacy cutover; older clients cannot read private files directly.
The same release contains endpoint hardening, so the image inventory gate must pass first.

**C — Role and cover enforcement.** Apply `202609080002_role_and_cover_boundaries.sql`. Verify the complete
role matrix, denied direct role writes, ordinary self-profile editing, idempotent approval activation,
last-admin preservation, and cover create/edit/delete/status/note actions plus realtime updates.
Profiles without valid staff roles cannot read/write covers. Profile creation still requires staff approval.
Role changes preserve existing audit triggers and happen in one transaction.

**D — Public projection.** Apply `202609080003_public_case_projection.sql`. Guests and users without staff
profiles receive only allowlisted teaching fields; approved staff keep the internal list projection.
Public token resolution always returns the public projection, even for admins. Validate all three submission
types, image captions, references, reports/PDF export, and all existing link formats. Direct case table reads
by accounts without staff profiles are denied. New/unexpected columns remain null in public RPC results.

**E — Attachment policies and inventory.** Apply `202609080004_private_attachment_policies.sql` then
`202609080005_attachment_cutover_tools.sql`. These do not change bucket visibility. Restrictive policies
fence older permissive storage policies without affecting teaching images. Endorsements remain accessible
to residents/admins/moderators; census owners and authorized managers retain their appropriate access.
Uploads must use the caller's directory. Run:

```sql
select * from public.internal_attachment_inventory('https://YOUR_PROJECT.supabase.co');
```

Every `problem` must be null. Unknown origins, malformed references and missing objects block cutover.
Reports identify records and reference hashes, not patient content or full URLs. Correct mappings with
reviewed forward changes; preserve originals. After verifying the compatible readers and restore point,
run each bucket separately from a trusted operator SQL connection:

```sql
select public.activate_internal_attachment_privacy(
  'resident-endorsement-files', 'https://YOUR_PROJECT.supabase.co');
-- Verify endorsement opening/upload/denials before the next bucket.
select public.activate_internal_attachment_privacy(
  'resident-census-evidence', 'https://YOUR_PROJECT.supabase.co');
```

The function validates references and existing objects under locks, changes only bucket visibility,
and raises an error without changing the bucket if validation fails. API roles cannot execute it.
No file migration or deletion is necessary. Previously downloaded files cannot be recalled; previously
issued signed links remain valid until their expiry.

**F — Cache and release checks.** Purge pre-existing CDN entries for `/c/*`, `/shared/case/*`,
`/api/shared-case*` using the hosting provider's cache controls. New responses use `no-store` for browser,
CDN and Vercel CDN caches. Confirm a revoked/regenerated token no longer serves report or proxy content.
Public teaching image URLs remain public by design; share revocation does not make those originals private.

## Verification and operational recovery

Implementation validation on 2026-09-08: baseline `npm run ci` passed 258 tests; the completed suite
passed lint, typecheck, build, and 286 tests in 57 files. `git diff --check` passed. Browser checks covered
the local mobile login at 390×844 and desktop invalid-share screen at 1280×800. Synthetic component tests
covered all three case types, public-report rendering, and the existing library PDF export path.
Authenticated browser workflows against an isolated Supabase server remain a release gate.

`npm run ci` runs lint, typecheck, production build, UI/service tests, and PGlite tests executing the actual
five migrations against synthetic PostgreSQL tables. The fixture models Supabase roles, JWT helpers and
legacy permissive policies. It is not a clone of the deployed schema or a Supabase Storage/Auth/Realtime server.
The database tests exercise self-promotion, role replacement/rollback, approval replay, covers, public
projections, restrictive storage policies and guarded private-bucket activation. Endpoint tests cover
invalid tokens, short links, host restrictions, redirects, MIME/signature mismatches, byte limits and timeout.

Before production, additionally run two concurrent native PostgreSQL sessions demoting different admins:
one transaction must wait, and the operation that would remove the final admin must fail. The RPC obtains
profile and role-table locks in a fixed order. PGlite is single-connection and cannot demonstrate this race.
Role administration rejects non-read-committed transactions to avoid stale authorization/count snapshots.
Test actual Auth signup, Storage signed URLs/expiry, realtime delivery, uploads, and full mobile/desktop
authenticated workflows against the isolated Supabase project. Do not use real patient records as fixtures.

After each checkpoint monitor metadata-only counts of permission denials, attachment failures, proxy
rejections, and privileged audit events. Never log patient narratives, access tokens, signed URLs or raw
share tokens. Compare authorized workflow success to the baseline and stop on unexplained regressions.

Rollback the application only to checkpoint B or newer. Do not reopen private buckets, restore permissive
policies, or bypass failed authorization as a recovery tactic. Temporarily disable a failing action and
apply a forward fix. Keep the snapshots and verified restore point available for a data-loss incident;
these migrations do not delete application records or storage objects.

Operator API references: [Supabase Management API](https://supabase.com/docs/reference/api/introduction)
and [production security/recovery guidance](https://supabase.com/docs/guides/integrations/supabase-for-platforms).
