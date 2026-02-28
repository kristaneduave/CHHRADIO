import {
  PresenceSelectorCache,
  isPresenceRowStale,
  mergeWorkspacePresence,
  mergeWorkspacePresenceStable,
} from '../utils/liveMapPresence';

describe('liveMapPresence utils', () => {
  it('marks persistent-only old presence as stale', () => {
    const now = new Date('2026-02-28T10:00:00.000Z').getTime();
    const row = {
      userId: 'u-1',
      lastSeenAt: '2026-02-28T09:57:00.000Z',
    };
    const stale = isPresenceRowStale(row, new Set(), 90, now);
    expect(stale).toBe(true);
  });

  it('does not mark realtime users as stale', () => {
    const now = new Date('2026-02-28T10:00:00.000Z').getTime();
    const row = {
      userId: 'u-2',
      lastSeenAt: '2026-02-28T09:50:00.000Z',
    };
    const stale = isPresenceRowStale(row, new Set(['u-2']), 90, now);
    expect(stale).toBe(false);
  });

  it('merges realtime and persistent players and preserves source metadata', () => {
    const now = new Date('2026-02-28T10:00:00.000Z').getTime();
    const merged = mergeWorkspacePresence(
      [
        {
          id: 'row-1',
          userId: 'u-3',
          floorId: 'f-1',
          x: 20,
          y: 30,
          statusMessage: null,
          isPresent: true,
          lastSeenAt: '2026-02-28T09:59:30.000Z',
          clearedAt: null,
          createdAt: '2026-02-28T09:00:00.000Z',
          updatedAt: '2026-02-28T09:59:30.000Z',
          displayName: 'Persisted User',
          avatarUrl: null,
          role: 'resident',
        },
      ],
      [
        {
          id: 'u-3',
          displayName: 'Realtime User',
          avatarUrl: null,
          role: 'resident',
          floorId: 'f-1',
          x: 22,
          y: 33,
          isWalking: true,
          statusMessage: 'Here',
        },
      ],
      90,
      now,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].presenceSource).toBe('merged');
    expect(merged[0].isStale).toBe(false);
    expect(merged[0].displayName).toBe('Realtime User');
  });

  it('returns cached selector result when signatures are unchanged', () => {
    const areaRows = [
      {
        id: 'row-1',
        userId: 'u-1',
        floorId: 'f-1',
        x: 12,
        y: 18,
        statusMessage: null,
        isPresent: true,
        lastSeenAt: '2026-02-28T09:59:30.000Z',
        clearedAt: null,
        createdAt: '2026-02-28T09:00:00.000Z',
        updatedAt: '2026-02-28T09:59:30.000Z',
        displayName: 'Persisted User',
        avatarUrl: null,
        role: 'resident' as const,
      },
    ];
    const realtime = [
      {
        id: 'u-1',
        displayName: 'Persisted User',
        avatarUrl: null,
        role: 'resident' as const,
        floorId: 'f-1',
        x: 12,
        y: 18,
        isWalking: false,
        statusMessage: null,
      },
    ];

    const first = mergeWorkspacePresenceStable(areaRows, realtime, 90, null, new Date('2026-02-28T10:00:00.000Z').getTime());
    const second = mergeWorkspacePresenceStable(areaRows, realtime, 90, first, new Date('2026-02-28T10:00:10.000Z').getTime());

    expect(second).toBe(first);
    expect(second.result).toBe(first.result);
  });

  it('recomputes selector result when source rows change', () => {
    const areaRowsA = [
      {
        id: 'row-1',
        userId: 'u-5',
        floorId: 'f-1',
        x: 20,
        y: 20,
        statusMessage: null,
        isPresent: true,
        lastSeenAt: '2026-02-28T09:59:00.000Z',
        clearedAt: null,
        createdAt: '2026-02-28T09:00:00.000Z',
        updatedAt: '2026-02-28T09:59:00.000Z',
        displayName: 'User A',
        avatarUrl: null,
        role: 'resident' as const,
      },
    ];
    const areaRowsB = [{ ...areaRowsA[0], x: 24, updatedAt: '2026-02-28T09:59:10.000Z' }];
    const realtime = [] as any[];

    const first: PresenceSelectorCache = mergeWorkspacePresenceStable(areaRowsA, realtime, 90, null);
    const second = mergeWorkspacePresenceStable(areaRowsB, realtime, 90, first);

    expect(second).not.toBe(first);
    expect(second.result).not.toBe(first.result);
    expect(second.result[0].x).toBe(24);
  });
});
