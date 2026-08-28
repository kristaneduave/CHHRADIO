# Security and governance rollout

## Apply

1. Deploy the application commit and confirm CI is green.
2. Run `20260828_privileged_audit_events.sql` in the Supabase SQL Editor.
3. Confirm the transaction reports success before staff use privileged actions.

## Production verification

- Confirm `privileged_audit_events` has RLS enabled.
- Confirm anonymous access to the table and `list_privileged_audit_events` is denied.
- As authorized staff, approve or reject a test access request and confirm one audit row appears.
- Change a test user's role and confirm only role names are stored in metadata.
- Mark a test Interesting Case sent/not sent and confirm the status event appears.
- Create and revoke a test public share and confirm both events appear.
- Delete a disposable test case and confirm the deletion event contains only status and submission type.
- Trigger the application error boundary in a non-production test and confirm no raw error or clinical content is displayed.
- Confirm the service-worker cache contains only shell/static assets and no Supabase URLs, case responses, or uploaded images.
- Confirm the current build replaces stale PWA caches after deployment.

## Verification SQL

```sql
select relrowsecurity from pg_class where oid = 'public.privileged_audit_events'::regclass;
select trigger_name, event_object_table from information_schema.triggers where trigger_name like 'trg_audit_%';
select routine_name from information_schema.routines where routine_schema = 'public' and routine_name in ('record_privileged_audit_event', 'list_privileged_audit_events');
```

## Rollback

Rollback removes governance coverage and deleting the table permanently removes its history. Export any audit history required for retention before the final statement.

```sql
begin;
drop trigger if exists trg_audit_access_request_review on public.account_access_requests;
drop trigger if exists trg_audit_profile_role_change on public.profiles;
drop trigger if exists trg_audit_user_role_assignment on public.user_roles;
drop trigger if exists trg_audit_case_delete on public.cases;
drop trigger if exists trg_audit_case_viber_status on public.cases;
drop trigger if exists trg_audit_case_share_change on public.case_shares;
drop function if exists public.audit_access_request_review();
drop function if exists public.audit_profile_role_change();
drop function if exists public.audit_user_role_assignment();
drop function if exists public.audit_case_delete();
drop function if exists public.audit_case_viber_status();
drop function if exists public.audit_case_share_change();
drop function if exists public.list_privileged_audit_events(integer, timestamptz);
drop function if exists public.record_privileged_audit_event(text, text, text, jsonb);
drop table if exists public.privileged_audit_events;
commit;
```
