import React, { useMemo } from 'react';
import { CurrentWorkstationStatus, Floor, LiveMapPerfSample, WorkspacePlayer } from '../types';
import VirtualWorkspaceRenderer, { ReleaseAndMoveIntent } from './VirtualWorkspaceRenderer';

interface LiveMapCanvasPanelProps {
  error: string | null;
  loading: boolean;
  floors: Floor[];
  expandedFloorId: string | null;
  filteredWorkstations: CurrentWorkstationStatus[];
  visibleWorkstationCountByFloorId: Map<string, number>;
  totalWorkstationCountByFloorId: Map<string, number>;
  floorUsersById: Map<string, WorkspacePlayer[]>;
  myLivePlayer: WorkspacePlayer | null;
  hydratedPlayers: WorkspacePlayer[];
  currentUserId: string;
  myOccupiedWorkstation: CurrentWorkstationStatus | null;
  onPinClick: (ws: CurrentWorkstationStatus) => void;
  onSetAreaPresence: (floorId: string, x: number, y: number) => Promise<void>;
  onCheckCurrentUserOccupancy: (workstationId: string) => Promise<boolean>;
  onRequestReleaseAndMove: (intent: ReleaseAndMoveIntent) => void;
  onToggleExpandedFloor: (floorId: string) => void;
  onPerfSample?: (sample: LiveMapPerfSample) => void;
}

const LiveMapCanvasPanel: React.FC<LiveMapCanvasPanelProps> = ({
  error,
  loading,
  floors,
  expandedFloorId,
  filteredWorkstations,
  visibleWorkstationCountByFloorId,
  totalWorkstationCountByFloorId,
  floorUsersById,
  myLivePlayer,
  hydratedPlayers,
  currentUserId,
  myOccupiedWorkstation,
  onPinClick,
  onSetAreaPresence,
  onCheckCurrentUserOccupancy,
  onRequestReleaseAndMove,
  onToggleExpandedFloor,
  onPerfSample,
}) => {
  const displayedFloorsComputeRef = React.useRef(0);
  const workstationsByFloorComputeRef = React.useRef(0);

  const displayedFloors = useMemo(
    () => {
      const startedAt = performance.now();
      const result = expandedFloorId ? floors.filter((f) => f.id === expandedFloorId) : floors;
      displayedFloorsComputeRef.current = Math.round(performance.now() - startedAt);
      return result;
    },
    [expandedFloorId, floors],
  );

  const filteredWorkstationsByFloor = useMemo(() => {
    const startedAt = performance.now();
    const map = new Map<string, CurrentWorkstationStatus[]>();
    filteredWorkstations.forEach((ws) => {
      const list = map.get(ws.floor_id) || [];
      list.push(ws);
      map.set(ws.floor_id, list);
    });
    workstationsByFloorComputeRef.current = Math.round(performance.now() - startedAt);
    return map;
  }, [filteredWorkstations]);

  React.useEffect(() => {
    onPerfSample?.({
      label: 'LiveMapCanvasPanel:render',
      durationMs: 0,
      at: new Date().toISOString(),
    });
    onPerfSample?.({
      label: 'LiveMapCanvasPanel:displayedFloorsMemo',
      durationMs: displayedFloorsComputeRef.current,
      at: new Date().toISOString(),
      meta: { floorCount: floors.length },
    });
    onPerfSample?.({
      label: 'LiveMapCanvasPanel:workstationsByFloorMemo',
      durationMs: workstationsByFloorComputeRef.current,
      at: new Date().toISOString(),
      meta: { workstationCount: filteredWorkstations.length },
    });
  });

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-slate-300 px-6">
        <span className="material-icons text-4xl mb-3 text-rose-400">error_outline</span>
        <p className="text-sm font-semibold text-white">Workspace unavailable</p>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <span className="material-icons animate-spin text-4xl mb-4 text-emerald-400">refresh</span>
        <p>Loading Workspace Maps...</p>
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-slate-300 px-6">
        <span className="material-icons text-4xl mb-3 text-amber-400">map</span>
        <p className="text-sm font-semibold text-white">No workspace maps configured</p>
        <p className="text-xs text-slate-400 mt-1">Ask admin to add a floor map and workstation points.</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 ${expandedFloorId ? '' : 'xl:grid-cols-2'} gap-4 md:gap-6 h-full min-h-[700px] xl:min-h-0`}>
      {displayedFloors.map((floor) => (
        <div key={floor.id} className="flex flex-col h-full bg-[#0a0f18]/80 shadow-[0_0_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden transition-all duration-300">
          <div className="px-4 py-3 bg-gradient-to-r from-black/20 to-transparent border-b border-white/5 flex items-center justify-between">
            <div className="min-w-0 flex items-center gap-2">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0"></span>
                <span className="truncate">{floor.name}</span>
                <span className="text-[10px] tracking-normal font-semibold text-slate-400">
                  {visibleWorkstationCountByFloorId.get(floor.id) || 0}/{totalWorkstationCountByFloorId.get(floor.id) || 0}
                </span>
              </h3>
              {myLivePlayer?.floorId === floor.id ? (
                <div
                  className="h-6 w-6 rounded-full border border-cyan-400/60 shadow-[0_0_0_2px_rgba(6,182,212,0.15)] overflow-hidden"
                  title="You are here"
                >
                  {myLivePlayer.avatarUrl ? (
                    <img
                      src={myLivePlayer.avatarUrl}
                      alt={myLivePlayer.displayName || 'You'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/30 text-primary text-[10px] font-bold">
                      {(myLivePlayer.displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ) : null}
              {(floorUsersById.get(floor.id)?.length || 0) > 0 && (
                <div className="flex items-center -space-x-1.5 pl-1">
                  {(floorUsersById.get(floor.id) || []).slice(0, 3).map((user) => (
                    user.avatarUrl ? (
                      <img
                        key={user.id}
                        src={user.avatarUrl}
                        alt={user.displayName}
                        title={user.displayName}
                        className="w-5 h-5 rounded-full object-cover border border-[#0f1621]"
                      />
                    ) : (
                      <div
                        key={user.id}
                        title={user.displayName}
                        className="w-5 h-5 rounded-full bg-primary/30 text-primary border border-[#0f1621] flex items-center justify-center text-[9px] font-bold"
                      >
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )
                  ))}
                  {(floorUsersById.get(floor.id)?.length || 0) > 3 && (
                    <span className="ml-1 text-[10px] font-semibold text-slate-400">
                      +{(floorUsersById.get(floor.id)?.length || 0) - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {floors.length > 1 && (
                <button
                  onClick={() => onToggleExpandedFloor(floor.id)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
                  title={expandedFloorId === floor.id ? 'Show All Maps' : 'Focus Map'}
                >
                  <span className="material-icons text-[18px]">
                    {expandedFloorId === floor.id ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 relative min-h-[320px] bg-white/[0.03]">
            <VirtualWorkspaceRenderer
              floor={floor}
              workstations={filteredWorkstationsByFloor.get(floor.id) || []}
              currentUserId={currentUserId}
              players={hydratedPlayers}
              onPinClick={onPinClick}
              onSetAreaPresence={onSetAreaPresence}
              occupiedWorkstation={myOccupiedWorkstation}
              onCheckCurrentUserOccupancy={onCheckCurrentUserOccupancy}
              onRequestReleaseAndMove={onRequestReleaseAndMove}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(LiveMapCanvasPanel);
