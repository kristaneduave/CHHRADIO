import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LiveMapModerationAction, LiveMapPerfSample, NewsfeedOnlineUser, WorkspacePlayer } from '../types';
import { parsePositiveInt } from '../utils/liveMapPresence';

type UserWithLoc = NewsfeedOnlineUser & { floorId?: string | null, statusMessage?: string | null };

type VirtualListItem =
  | { kind: 'group'; key: string; label: string; showDot: boolean }
  | { kind: 'user'; key: string; user: UserWithLoc }
  | { kind: 'stale-group'; key: string; label: string }
  | { kind: 'stale-user'; key: string; user: WorkspacePlayer };

const LIVE_MAP_PERF_LOG =
  String(import.meta.env?.VITE_LIVE_MAP_PERF_LOG ?? 'false').toLowerCase() === 'true';
const LIVE_MAP_VIRTUALIZE_THRESHOLD = parsePositiveInt(
  import.meta.env?.VITE_LIVE_MAP_VIRTUALIZE_THRESHOLD,
  50,
);
const VIRTUAL_ROW_HEIGHT = 56;
const VIRTUAL_OVERSCAN = 8;

type PresenceState = 'active' | 'stale' | 'elsewhere';

const statusBadgeClassByState: Record<PresenceState, string> = {
  active: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  stale: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  elsewhere: 'border-slate-400/20 bg-white/5 text-slate-300',
};

const statusLabelByState: Record<PresenceState, string> = {
  active: 'Active now',
  stale: 'Stale',
  elsewhere: 'Elsewhere/No floor',
};

const OnlineUserRow = React.memo(function OnlineUserRow({
  user,
  currentUserId,
  isModerator,
  isStale,
  summonState,
  onSummon,
  onFocusFloor,
  onKickByUserId,
}: {
  user: UserWithLoc;
  currentUserId: string;
  isModerator: boolean;
  isStale: boolean;
  summonState: 'idle' | 'sending' | 'sent';
  onSummon: (user: UserWithLoc) => void;
  onFocusFloor: (floorId: string) => void;
  onKickByUserId: (targetUserId: string, targetDisplayName: string, isStale: boolean) => void;
}) {
  const presenceState: PresenceState = isStale ? 'stale' : user.floorId ? 'active' : 'elsewhere';
  const summonDisabled = summonState !== 'idle';
  const summonLabel = summonState === 'sending' ? 'Sending...' : summonState === 'sent' ? 'Sent' : 'Summon';

  return (
    <div className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-black/40 transition-all cursor-default border border-white/5 hover:border-sky-500/30 hover:shadow-[0_0_15px_rgba(14,165,233,0.15)] bg-black/20">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-10 h-10 rounded-xl object-cover border border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-slate-100 flex items-center justify-center font-black text-lg border border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-[#0a0f18] rounded-full shadow-[0_0_8px_rgba(0,0,0,0.8)] ${presenceState === 'active' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]' :
              presenceState === 'stale' ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]' :
                'bg-slate-400'
            }`}></span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black tracking-wide text-slate-100 truncate flex items-center gap-2 drop-shadow-md">
            {user.displayName}
            <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusBadgeClassByState[presenceState]}`}>
              {statusLabelByState[presenceState]}
            </span>
          </p>
          <p className="text-[11px] text-slate-400 font-semibold truncate uppercase tracking-widest mt-0.5">
            {user.statusMessage ? (
              <span className="text-cyan-400">{user.statusMessage}</span>
            ) : (
              user.role || 'Staff'
            )}
          </p>
        </div>
      </div>
      {user.floorId && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all focus-within:opacity-100">
          {user.id !== currentUserId && (
            <button
              onClick={() => onSummon(user)}
              disabled={summonDisabled}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all border border-emerald-500/20 text-[10px] uppercase font-black tracking-widest disabled:opacity-50 hover:shadow-[0_0_10px_rgba(16,185,129,0.2)]"
              title={`Summon ${user.displayName} to you`}
            >
              {summonLabel}
            </button>
          )}
          {isModerator && user.id !== currentUserId ? (
            <button
              onClick={() => onKickByUserId(user.id, user.displayName, isStale)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all border border-rose-500/25 text-[10px] uppercase font-black tracking-widest hover:shadow-[0_0_10px_rgba(244,63,94,0.2)]"
              title={isStale ? 'Kick stale user' : 'Kick active user (extra confirmation)'}
            >
              Kick
            </button>
          ) : null}
          <button
            onClick={() => onFocusFloor(user.floorId!)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-white/10 hover:border-sky-500/30 hover:shadow-[0_0_10px_rgba(14,165,233,0.15)]"
            title="Focus Map"
          >
            <span className="material-icons text-[16px] drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">my_location</span>
          </button>
        </div>
      )}
    </div>
  );
});

const StalePresenceRow = React.memo(function StalePresenceRow({
  user,
  isKicking,
  onKick,
}: {
  user: WorkspacePlayer;
  isKicking: boolean;
  onKick: (user: WorkspacePlayer) => void;
}) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 shadow-[inset_0_0_20px_rgba(245,158,11,0.02)]">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-10 h-10 rounded-xl object-cover border border-amber-500/20 opacity-80 mix-blend-luminosity" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-black text-lg border border-amber-500/20 opacity-80">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 border-2 border-[#0a0f18] rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-black tracking-wide text-amber-100/80 truncate drop-shadow-md">{user.displayName}</p>
          <p className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest mt-0.5 truncate">Disconnected</p>
        </div>
      </div>
      <button
        onClick={() => onKick(user)}
        disabled={isKicking}
        className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] uppercase tracking-widest font-black disabled:opacity-50 transition-colors hover:shadow-[0_0_10px_rgba(244,63,94,0.15)]"
      >
        {isKicking ? 'Clearing...' : 'Wipe'}
      </button>
    </div>
  );
});

interface LiveMapOnlinePanelProps {
  loading: boolean;
  onlineUsersCount: number;
  groupedUsers: { name: string; users: UserWithLoc[] }[];
  stalePlayers: WorkspacePlayer[];
  staleUserIds: Set<string>;
  currentUserId: string;
  isModerator: boolean;
  staleFirstEnabled: boolean;
  staleTtlSeconds: number;
  kickingUserId: string | null;
  summonStateByUserId: Record<string, 'idle' | 'sending' | 'sent'>;
  moderationActions: LiveMapModerationAction[];
  isModerationLoading: boolean;
  moderationError: string | null;
  onSummon: (user: UserWithLoc) => void;
  onFocusFloor: (floorId: string) => void;
  onKick: (user: WorkspacePlayer) => void;
  onKickByUserId: (targetUserId: string, targetDisplayName: string, isStale: boolean) => void;
  onRefreshModerationActions: () => void;
  onPerfSample?: (sample: LiveMapPerfSample) => void;
}

const LiveMapOnlinePanel: React.FC<LiveMapOnlinePanelProps> = ({
  loading,
  onlineUsersCount,
  groupedUsers,
  stalePlayers,
  staleUserIds,
  currentUserId,
  isModerator,
  staleFirstEnabled,
  staleTtlSeconds,
  kickingUserId,
  summonStateByUserId,
  moderationActions,
  isModerationLoading,
  moderationError,
  onSummon,
  onFocusFloor,
  onKick,
  onKickByUserId,
  onRefreshModerationActions,
  onPerfSample,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const renderCountRef = useRef(0);
  const itemsMemoMsRef = useRef(0);
  const virtualRangeMemoMsRef = useRef(0);

  const onlineRenderMode: 'simple' | 'virtualized' = useMemo(
    () => (onlineUsersCount > LIVE_MAP_VIRTUALIZE_THRESHOLD ? 'virtualized' : 'simple'),
    [onlineUsersCount],
  );

  const items = useMemo<VirtualListItem[]>(() => {
    const startedAt = performance.now();
    const next: VirtualListItem[] = [];
    const pushStale = () => {
      if (stalePlayers.length === 0) return;
      next.push({
        kind: 'stale-group',
        key: 'stale:header',
        label: 'Stale Presence',
      });
      stalePlayers.forEach((user) => {
        next.push({
          kind: 'stale-user',
          key: `stale:${user.id}`,
          user,
        });
      });
    };

    if (isModerator && staleFirstEnabled) {
      pushStale();
    }

    groupedUsers.forEach((group) => {
      const visibleUsers = isModerator && staleFirstEnabled
        ? group.users.filter((user) => !staleUserIds.has(user.id))
        : group.users;
      if (!visibleUsers.length) return;
      next.push({
        kind: 'group',
        key: `group:${group.name}`,
        label: group.name,
        showDot: group.name !== 'Elsewhere',
      });
      visibleUsers.forEach((user) => {
        next.push({
          kind: 'user',
          key: `user:${user.id}`,
          user,
        });
      });
    });

    if (!(isModerator && staleFirstEnabled)) {
      pushStale();
    }
    itemsMemoMsRef.current = Math.round(performance.now() - startedAt);
    return next;
  }, [groupedUsers, isModerator, staleFirstEnabled, stalePlayers, staleUserIds]);

  const virtualizedRange = useMemo(() => {
    const startedAt = performance.now();
    if (onlineRenderMode !== 'virtualized') {
      const result = { startIndex: 0, endIndex: items.length };
      virtualRangeMemoMsRef.current = Math.round(performance.now() - startedAt);
      return result;
    }
    const viewportHeight = typeof window !== 'undefined' ? Math.max(320, Math.min(900, window.innerHeight - 220)) : 420;
    const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
    const endIndex = Math.min(items.length, startIndex + visibleCount);
    const result = { startIndex, endIndex };
    virtualRangeMemoMsRef.current = Math.round(performance.now() - startedAt);
    return result;
  }, [items.length, onlineRenderMode, scrollTop]);

  const visibleItems = useMemo(() => {
    if (onlineRenderMode !== 'virtualized') return items;
    return items.slice(virtualizedRange.startIndex, virtualizedRange.endIndex);
  }, [items, onlineRenderMode, virtualizedRange.endIndex, virtualizedRange.startIndex]);

  const virtualTopSpacer = onlineRenderMode === 'virtualized' ? virtualizedRange.startIndex * VIRTUAL_ROW_HEIGHT : 0;
  const virtualBottomSpacer =
    onlineRenderMode === 'virtualized'
      ? Math.max(0, (items.length - virtualizedRange.endIndex) * VIRTUAL_ROW_HEIGHT)
      : 0;

  const formatModerationTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    if (!LIVE_MAP_PERF_LOG) return;
    renderCountRef.current += 1;
    console.debug(
      '[live-map-perf] online-panel-render',
      renderCountRef.current,
      'mode',
      onlineRenderMode,
      'items',
      items.length,
    );
  }, [items.length, onlineRenderMode]);

  useEffect(() => {
    onPerfSample?.({
      label: 'LiveMapOnlinePanel:render',
      durationMs: 0,
      at: new Date().toISOString(),
      meta: { mode: onlineRenderMode, items: items.length },
    });
    onPerfSample?.({
      label: 'LiveMapOnlinePanel:itemsMemo',
      durationMs: itemsMemoMsRef.current,
      at: new Date().toISOString(),
      meta: { items: items.length },
    });
    onPerfSample?.({
      label: 'LiveMapOnlinePanel:virtualRangeMemo',
      durationMs: virtualRangeMemoMsRef.current,
      at: new Date().toISOString(),
      meta: { mode: onlineRenderMode },
    });
  });

  return (
    <div className="w-full xl:w-80 shrink-0 bg-[#0a0f18]/40 backdrop-blur-xl flex-col relative z-10 h-64 xl:h-auto border-t xl:border-t-0 xl:border-l border-white/5 hidden xl:flex shadow-2xl overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_100%_0%,rgba(6,182,212,0.05),transparent_40%),radial-gradient(circle_at_0%_100%,rgba(16,185,129,0.05),transparent_30%)] before:pointer-events-none">
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/40 relative z-10">
        <h3 className="text-[13px] font-black flex items-center gap-2 uppercase tracking-[0.2em] text-slate-200 drop-shadow-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
          </span>
          Roster
        </h3>
        <span className="bg-white/5 border border-white/10 text-cyan-300 text-[10px] font-black px-2.5 py-1 rounded-lg tracking-widest shadow-[0_0_10px_rgba(34,211,238,0.1)]">{onlineUsersCount} ONLINE</span>
      </div>
      {isModerator ? (
        <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
          <p className="text-[11px] text-slate-400">
            Stale means no realtime heartbeat for more than {staleTtlSeconds}s.
          </p>
        </div>
      ) : null}

      <div
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide"
        onScroll={(event) => {
          if (onlineRenderMode === 'virtualized') {
            setScrollTop(event.currentTarget.scrollTop);
          }
        }}
      >
        {onlineUsersCount === 0 && !loading && (
          <p className="text-sm text-slate-500 text-center py-8">No one else is online right now.</p>
        )}
        {onlineRenderMode === 'virtualized' && virtualTopSpacer > 0 ? (
          <div style={{ height: virtualTopSpacer }} aria-hidden />
        ) : null}
        {visibleItems.map((item) => {
          if (item.kind === 'group') {
            return (
              <h4 key={item.key} className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                {item.showDot && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></span>}
                {item.label}
              </h4>
            );
          }
          if (item.kind === 'user') {
            return (
              <OnlineUserRow
                key={item.key}
                user={item.user}
                currentUserId={currentUserId}
                isModerator={isModerator}
                isStale={staleUserIds.has(item.user.id)}
                summonState={summonStateByUserId[item.user.id] || 'idle'}
                onSummon={onSummon}
                onFocusFloor={onFocusFloor}
                onKickByUserId={onKickByUserId}
              />
            );
          }
          if (item.kind === 'stale-group') {
            return (
              <h4 key={item.key} className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {item.label}
              </h4>
            );
          }
          return (
            <StalePresenceRow
              key={item.key}
              user={item.user}
              isKicking={kickingUserId === item.user.id}
              onKick={onKick}
            />
          );
        })}
        {onlineRenderMode === 'virtualized' && virtualBottomSpacer > 0 ? (
          <div style={{ height: virtualBottomSpacer }} aria-hidden />
        ) : null}
      </div>
      {isModerator ? (
        <div className="px-4 py-3 border-t border-white/5 bg-black/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Recent Moderator Actions</p>
            <button
              onClick={onRefreshModerationActions}
              className="text-[11px] text-primary-light hover:text-primary"
            >
              Refresh
            </button>
          </div>
          {isModerationLoading ? <p className="text-xs text-slate-400">Loading...</p> : null}
          {moderationError ? <p className="text-xs text-rose-300">{moderationError}</p> : null}
          {!isModerationLoading && !moderationError && moderationActions.length === 0 ? (
            <p className="text-xs text-slate-500">No actions logged yet.</p>
          ) : null}
          {!isModerationLoading && !moderationError && moderationActions.length > 0 ? (
            <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-hide">
              {moderationActions.slice(0, 8).map((action) => (
                <div key={action.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                  <p className="text-[11px] text-slate-200">
                    <span className="font-semibold text-white">{action.actor_display_name}</span>{' '}
                    removed <span className="font-semibold text-white">{action.target_display_name}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatModerationTime(action.created_at)} - presence {action.cleared_presence_count}, sessions {action.released_workstation_count}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(LiveMapOnlinePanel);
