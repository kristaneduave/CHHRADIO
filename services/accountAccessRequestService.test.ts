import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from, insert } = vi.hoisted(() => {
  const insert = vi.fn();
  const from = vi.fn(() => ({
    insert,
  }));
  const rpc = vi.fn();
  return { rpc, from, insert };
});

vi.mock('./supabase', () => ({
  supabase: {
    from,
    rpc,
  },
}));

describe('accountAccessRequestService', () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
    from.mockClear();
    insert.mockReset();
  });

  it('normalizes requested roles from the status RPC', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          public_token: 'token-1',
          email: 'user@example.com',
          requested_role: 'CONSULTANT',
          year_level: null,
          status: 'APPROVED',
          created_at: '2026-03-25T00:00:00.000Z',
          reviewed_at: '2026-03-25T01:00:00.000Z',
        },
      ],
      error: null,
    });

    const { fetchAccountAccessRequestStatus } = await import('./accountAccessRequestService');
    const result = await fetchAccountAccessRequestStatus('token-1');

    expect(result).toEqual({
      publicToken: 'token-1',
      email: 'user@example.com',
      requestedRole: 'consultant',
      yearLevel: null,
      status: 'approved',
      createdAt: '2026-03-25T00:00:00.000Z',
      reviewedAt: '2026-03-25T01:00:00.000Z',
    });
  });

  it('falls back unknown requested roles to resident', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          public_token: 'token-2',
          email: 'user@example.com',
          requested_role: 'training_officer',
          year_level: 'R2',
          status: 'pending',
          created_at: '2026-03-25T00:00:00.000Z',
          reviewed_at: null,
        },
      ],
      error: null,
    });

    const { fetchAccountAccessRequestStatus } = await import('./accountAccessRequestService');
    const result = await fetchAccountAccessRequestStatus('token-2');

    expect(result?.requestedRole).toBe('resident');
    expect(result?.status).toBe('pending');
  });
});
