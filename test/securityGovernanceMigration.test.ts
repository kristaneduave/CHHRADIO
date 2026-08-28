import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260828_privileged_audit_events.sql'), 'utf8');

describe('privileged audit migration', () => {
  it('creates a protected audit table and staff-only paginated reader', () => {
    expect(migration).toContain('create table if not exists public.privileged_audit_events');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('privileged_audit_events_safe_metadata');
    expect(migration).toContain('revoke insert, update, delete');
    expect(migration).toContain('public.list_privileged_audit_events');
    expect(migration).toContain("array['admin', 'moderator', 'training_officer']");
    expect(migration).toContain('limit least(greatest(coalesce(p_limit, 30), 1), 100)');
  });

  it.each([
    'access_request_', 'primary_role_changed', 'account_status_changed', 'role_assigned', 'role_removed',
    'case_deleted', 'viber_marked_sent', 'viber_marked_not_sent',
    'case_share_created', 'case_share_revoked',
  ])('records the privileged action %s', (action) => {
    expect(migration).toContain(action);
  });

  it('does not add clinical content to audit metadata', () => {
    expect(migration).not.toMatch(/jsonb_build_object\([^)]*(patient|notes|image_url)/i);
  });
});
