import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc } }));

import { fetchPrivilegedAuditEvents } from './auditService';

describe('auditService', () => {
  beforeEach(() => rpc.mockReset());

  it('requests a bounded page and maps database fields', async () => {
    rpc.mockResolvedValue({ data: [{
      id: 7,
      actor_id: 'actor-1',
      actor_name: 'Dr. Admin',
      action: 'case_deleted',
      target_type: 'case',
      target_id: 'case-1',
      metadata: { status: 'published' },
      created_at: '2026-08-28T00:00:00Z',
    }], error: null });

    await expect(fetchPrivilegedAuditEvents(500, '2026-08-29T00:00:00Z')).resolves.toEqual([expect.objectContaining({
      id: 7,
      actorName: 'Dr. Admin',
      action: 'case_deleted',
    })]);
    expect(rpc).toHaveBeenCalledWith('list_privileged_audit_events', {
      p_limit: 100,
      p_before: '2026-08-29T00:00:00Z',
    });
  });
});
