import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithCache } = vi.hoisted(() => ({
  fetchWithCache: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {},
}));

vi.mock('../utils/requestCache', () => ({
  fetchWithCache,
}));

describe('newsfeedPresenceService', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchWithCache.mockReset();
  });

  it('normalizes roles when hydrating online profiles', async () => {
    fetchWithCache.mockResolvedValue({
      data: [
        {
          id: 'user-1',
          full_name: 'Alex Reader',
          nickname: null,
          avatar_url: null,
          role: 'ADMIN',
        },
      ],
      error: null,
    });

    const { fetchOnlineProfiles } = await import('./newsfeedPresenceService');
    const result = await fetchOnlineProfiles(['user-1']);

    expect(result).toEqual([
      {
        id: 'user-1',
        displayName: 'Alex Reader',
        avatarUrl: null,
        role: 'admin',
      },
    ]);
  });

  it('preserves input order and falls back when a profile is missing', async () => {
    fetchWithCache.mockResolvedValue({
      data: [
        {
          id: 'user-2',
          full_name: null,
          nickname: 'Sky',
          avatar_url: 'https://example.com/avatar.png',
          role: 'resident',
        },
      ],
      error: null,
    });

    const { fetchOnlineProfiles } = await import('./newsfeedPresenceService');
    const result = await fetchOnlineProfiles(['user-2', 'user-9']);

    expect(result).toEqual([
      {
        id: 'user-2',
        displayName: 'Sky',
        avatarUrl: 'https://example.com/avatar.png',
        role: 'resident',
      },
      {
        id: 'user-9',
        displayName: 'User user-9',
        avatarUrl: null,
      },
    ]);
  });
});
