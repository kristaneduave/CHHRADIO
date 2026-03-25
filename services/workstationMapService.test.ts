import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => {
  const from = vi.fn((table: string) => {
    if (table !== 'profiles') {
      throw new Error(`Unexpected table ${table}`);
    }

    const state: Record<string, any> = {};
    const query = {
      select: vi.fn(() => query),
      in: vi.fn(async (_field: string, ids: string[]) => ({
        data: ids.map((id) => ({
          id,
          full_name: `User ${id}`,
          nickname: null,
          avatar_url: null,
          role: id === 'u1' ? 'MODERATOR' : 'resident',
          title: null,
          motto: null,
          work_mode: null,
          main_modality: null,
          faction: null,
          map_status: null,
          avatar_seed: null,
          active_badges: null,
        })),
        error: null,
      })),
      limit: vi.fn(() => query),
      or: vi.fn(async () => ({
        data: [
          {
            id: 'u1',
            full_name: 'Taylor Ray',
            nickname: null,
            avatar_url: null,
            role: 'TRAINING_OFFICER',
          },
        ],
        error: null,
      })),
      eq: vi.fn(() => query),
      single: vi.fn(async () => ({ data: null, error: null })),
    };

    return query;
  });

  return { from };
});

vi.mock('./supabase', () => ({
  supabase: {
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
    },
  },
}));

vi.mock('../utils/requestCache', () => ({
  fetchWithCache: vi.fn(),
  invalidateCacheByPrefix: vi.fn(),
}));

describe('workstationMapService', () => {
  beforeEach(() => {
    vi.resetModules();
    from.mockClear();
  });

  it('normalizes occupant roles when hydrating workstation occupants', async () => {
    const { workstationMapService } = await import('./workstationMapService');

    const result = await workstationMapService.hydrateWorkstationOccupants([
      {
        id: 'ws-1',
        label: 'WS-1',
        floor_id: 'floor-1',
        status: 'IN_USE',
        occupant_id: 'u1',
        occupant_name: null,
      } as any,
    ]);

    expect(result[0]).toMatchObject({
      occupant_id: 'u1',
      occupant_role: 'moderator',
      occupant_name: 'User u1',
    });
  });

  it('normalizes assignable occupant roles from profile search', async () => {
    const { workstationMapService } = await import('./workstationMapService');

    const result = await workstationMapService.searchAssignableOccupants('tay');

    expect(result).toEqual([
      {
        id: 'u1',
        displayName: 'Taylor Ray',
        role: 'training_officer',
        avatarUrl: null,
      },
    ]);
  });
});
