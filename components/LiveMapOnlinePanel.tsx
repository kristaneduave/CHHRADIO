import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LiveMapPerfSample, NewsfeedOnlineUser, WorkspacePlayer } from '../types';
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

const OnlineUserRow = React.memo(function OnlineUserRow({
  user,
  currentUserId,
  onSummon,
  onFocusFloor,
}: {
  user: UserWithLoc;
  currentUserId: string;
  onSummon: (user: UserWithLoc) => void;
  onFocusFloor: (floorId: string) => void;
}) {
  return (
    <div className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.02] transition-colors cursor-default border border-transparent hover:border-white/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-9 h-9 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold border border-primary/30">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0f1621] rounded-full"></span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-200 truncate flex items-center gap-2">
            {user.displayName}
          </p>
          <p className="text-xs text-slate-500 truncate">
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
              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all border border-emerald-500/20"
              title={`Summon ${user.displayName} to you`}
            >
              <span className="material-icons text-[16px]">notification_add</span>
            </button>
          )}
          <button
            onClick={() => onFocusFloor(user.floorId!)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-transparent"
            title="Focus Map"
          >
            <span className="material-icons text-[16px]">my_location</span>
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
    <div className="flex items-center justify-between p-2 rounded-xl border border-amber-400/20 bg-amber-500/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-9 h-9 rounded-full object-cover border border-white/10 opacity-80" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-700 text-slate-100 flex items-center justify-center font-bold border border-white/10">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-amber-500 border-2 border-[#0f1621] rounded-full"></span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-200 truncate">{user.displayName}</p>
          <p className="text-[11px] text-amber-300 truncate">No realtime heartbeat</p>
        </div>
      </div>
      <button
        onClick={() => onKick(user)}
        disabled={isKicking}
        className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-semibold disabled:opacity-50"
      >
        {isKicking ? 'Removing...' : 'Kick'}
      </button>
    </div>
  );
});

interface LiveMapOnlinePanelProps {
  loading: boolean;
  onlineUsersCount: number;
  groupedUsers: { name: string; users: UserWithLoc[] }[];
  stalePlayers: WorkspacePlayer[];
  currentUserId: string;
  kickingUserId: string | null;
  onSummon: (user: UserWithLoc) => void;
  onFocusFloor: (floorId: string) => void;
  onKick: (user: WorkspacePlayer) => void;
  onPerfSample?: (sample: LiveMapPerfSample) => void;
}

const LiveMapOnlinePanel: React.FC<LiveMapOnlinePanelProps> = ({
  loading,
  onlineUsersCount,
  groupedUsers,
  stalePlayers,
  currentUserId,
  kickingUserId,
  onSummon,
  onFocusFloor,
  onKick,
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
    groupedUsers.forEach((group) => {
      next.push({
        kind: 'group',
        key: `group:${group.name}`,
        label: group.name,
        showDot: group.name !== 'Elsewhere',
      });
      group.users.forEach((user) => {
        next.push({
          kind: 'user',
          key: `user:${user.id}`,
          user,
        });
      });
    });

    if (stalePlayers.length > 0) {
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
    }
    itemsMemoMsRef.current = Math.round(performance.now() - startedAt);
    return next;
  }, [groupedUsers, stalePlayers]);

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
    <div className="w-full xl:w-80 shrink-0 bg-[#0a0f18]/40 backdrop-blur-xl flex-col relative z-10 h-64 xl:h-auto border-t xl:border-t-0 xl:border-l border-white/5 hidden xl:flex shadow-2xl">
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-gradient-to-b from-[#0a0f18]/80 to-transparent">
        <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-[0.2em] text-slate-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          Online Now
        </h3>
        <span className="bg-white/10 text-slate-300 text-xs font-bold px-2 py-1 rounded-full">{onlineUsersCount}</span>
      </div>

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
                onSummon={onSummon}
                onFocusFloor={onFocusFloor}
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
    </div>
  );
};

export default React.memo(LiveMapOnlinePanel);
