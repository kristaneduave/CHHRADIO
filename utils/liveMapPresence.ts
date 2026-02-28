import { WorkspaceAreaPresenceRow, WorkspacePlayer } from '../types';

export const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

export const isPresenceRowStale = (
  row: Pick<WorkspaceAreaPresenceRow, 'lastSeenAt' | 'userId'>,
  realtimeUserIds: Set<string>,
  staleTtlSeconds: number,
  nowMs = Date.now(),
): boolean => {
  if (realtimeUserIds.has(row.userId)) return false;
  const seenAtMs = new Date(row.lastSeenAt).getTime();
  if (!Number.isFinite(seenAtMs)) return true;
  return nowMs - seenAtMs > staleTtlSeconds * 1000;
};

export const mergeWorkspacePresence = (
  areaRows: WorkspaceAreaPresenceRow[],
  realtimePlayers: WorkspacePlayer[],
  staleTtlSeconds: number,
  nowMs = Date.now(),
): WorkspacePlayer[] => {
  const byId = new Map<string, WorkspacePlayer>();
  const realtimeIds = new Set(realtimePlayers.map((player) => player.id));

  areaRows.forEach((row) => {
    byId.set(row.userId, {
      id: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      role: row.role,
      floorId: row.floorId,
      x: row.x,
      y: row.y,
      isWalking: false,
      statusMessage: row.statusMessage,
      presenceSource: 'persistent',
      lastSeenAt: row.lastSeenAt,
      isStale: isPresenceRowStale(row, realtimeIds, staleTtlSeconds, nowMs),
    });
  });

  realtimePlayers.forEach((player) => {
    const existing = byId.get(player.id);
    byId.set(player.id, {
      ...existing,
      ...player,
      displayName:
        player.displayName && player.displayName !== 'User'
          ? player.displayName
          : existing?.displayName || player.displayName || 'User',
      avatarUrl: player.avatarUrl || existing?.avatarUrl || null,
      role: player.role || existing?.role,
      presenceSource: existing ? 'merged' : 'realtime',
      lastSeenAt: existing?.lastSeenAt || null,
      isStale: false,
    });
  });

  return [...byId.values()];
};

const buildAreaRowsSignature = (rows: WorkspaceAreaPresenceRow[]): string =>
  rows
    .map((row) =>
      [
        row.userId,
        row.floorId,
        row.x,
        row.y,
        row.statusMessage || '',
        row.lastSeenAt,
        row.updatedAt,
        row.isPresent ? 1 : 0,
      ].join('|'),
    )
    .sort()
    .join('||');

const buildRealtimePlayersSignature = (players: WorkspacePlayer[]): string =>
  players
    .map((player) =>
      [
        player.id,
        player.floorId || '',
        player.x,
        player.y,
        player.statusMessage || '',
        player.isWalking ? 1 : 0,
        player.displayName || '',
        player.role || '',
      ].join('|'),
    )
    .sort()
    .join('||');

export interface PresenceSelectorCache {
  signature: string;
  result: WorkspacePlayer[];
}

export const mergeWorkspacePresenceStable = (
  areaRows: WorkspaceAreaPresenceRow[],
  realtimePlayers: WorkspacePlayer[],
  staleTtlSeconds: number,
  cache?: PresenceSelectorCache | null,
  nowMs = Date.now(),
): PresenceSelectorCache => {
  const signature = [
    staleTtlSeconds,
    buildAreaRowsSignature(areaRows),
    buildRealtimePlayersSignature(realtimePlayers),
  ].join('###');

  if (cache && cache.signature === signature) {
    return cache;
  }

  return {
    signature,
    result: mergeWorkspacePresence(areaRows, realtimePlayers, staleTtlSeconds, nowMs),
  };
};
