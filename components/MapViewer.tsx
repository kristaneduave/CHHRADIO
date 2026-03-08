import React, { useMemo } from 'react';
import { CurrentWorkstationStatus, Floor, WorkspacePlayer } from '../types';
import LoadingState from './LoadingState';

interface MapViewerProps {
  floor: Floor;
  workstations: CurrentWorkstationStatus[];
  selectedWorkstationId?: string;
  players?: WorkspacePlayer[];
  onSelectWorkstation?: (ws: CurrentWorkstationStatus) => void;
  onPinClick?: (ws: CurrentWorkstationStatus) => void;
  onSetAreaPresence?: (floorId: string, x: number, y: number) => Promise<void>;
  isLoading?: boolean;
}

type PinTone = {
  dot: string;
  ring: string;
  glow: string;
  pulse: boolean;
  label: string;
};

const getPinTone = (status: string): PinTone => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'AVAILABLE') {
    return {
      dot: 'bg-emerald-400',
      ring: 'ring-emerald-300/70',
      glow: 'shadow-[0_0_16px_rgba(16,185,129,0.45)]',
      pulse: true,
      label: 'Available',
    };
  }
  if (normalized === 'IN_USE') {
    return {
      dot: 'bg-rose-400',
      ring: 'ring-rose-300/70',
      glow: 'shadow-[0_0_14px_rgba(244,63,94,0.35)]',
      pulse: false,
      label: 'In Use',
    };
  }
  return {
    dot: 'bg-slate-500',
    ring: 'ring-slate-300/50',
    glow: 'shadow-[0_0_10px_rgba(100,116,139,0.3)]',
    pulse: false,
    label: 'Offline',
  };
};

const clampPercent = (value: number): number => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const getInitial = (name?: string | null): string => {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
};

const MapViewer: React.FC<MapViewerProps> = ({
  floor,
  workstations,
  players,
  selectedWorkstationId,
  onSelectWorkstation,
  onPinClick,
  onSetAreaPresence,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="w-full aspect-[16/10] flex items-center justify-center rounded-2xl border border-white/10 bg-black/30">
        <LoadingState title="Loading map..." compact />
      </div>
    );
  }

  const floorWidth = Number(floor.width);
  const floorHeight = Number(floor.height);
  const hasValidDimensions = floorWidth > 0 && floorHeight > 0;

  if (!hasValidDimensions) {
    return (
      <div className="w-full aspect-[16/10] flex flex-col items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/10 text-rose-200 px-4 text-center">
        <span className="material-icons text-3xl mb-2">error_outline</span>
        <p className="text-sm font-semibold">Map dimensions are invalid for this floor.</p>
        <p className="text-xs text-rose-200/80 mt-1">Please update floor width/height configuration.</p>
      </div>
    );
  }

  const aspectRatio = `${floorWidth} / ${floorHeight}`;

  const pinLayouts = useMemo(
    () =>
      workstations.map((ws) => {
        const left = clampPercent((Number(ws.x) / floorWidth) * 100);
        const top = clampPercent((Number(ws.y) / floorHeight) * 100);
        const tone = getPinTone(ws.status);
        return { ws, left, top, tone };
      }),
    [workstations, floorWidth, floorHeight],
  );

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-0 sm:p-2">
      <div
        className="relative max-w-full max-h-full inline-block cursor-crosshair rounded-none sm:rounded-2xl overflow-hidden shadow-2xl bg-black/40 ring-0 sm:ring-1 ring-white/10"
        style={{ aspectRatio }}
        onClick={(e) => {
          if (!onSetAreaPresence) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
          const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
          const x = (xPercent / 100) * floorWidth;
          const y = (yPercent / 100) * floorHeight;
          void onSetAreaPresence(floor.id, Math.round(x), Math.round(y));
        }}
      >
        <img
          src={floor.image_url}
          alt={`${floor.name} workstation map`}
          className="w-full h-full max-w-full max-h-full object-cover select-none pointer-events-none"
          draggable={false}
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(56,189,248,0.1),transparent_35%),radial-gradient(circle_at_78%_72%,rgba(16,185,129,0.08),transparent_35%)] pointer-events-none" />

        {players && players.map((player) => {
          console.log('[MapViewer] Render player check:', player.id, player.displayName, 'x:', player.x, 'y:', player.y);
          if (typeof player.x !== 'number' || typeof player.y !== 'number') {
            console.log('[MapViewer] Skipping player due to missing x/y:', player.id);
            return null;
          }
          if (workstations.some(ws => ws.occupant_id === player.id && ws.status === 'IN_USE')) {
            console.log('[MapViewer] Skipping player because they are IN_USE at a workstation:', player.id);
            return null;
          }
          console.log('[MapViewer] Rendering player successfully!', player.id);

          const left = clampPercent((player.x / floorWidth) * 100);
          const top = clampPercent((player.y / floorHeight) * 100);
          return (
            <div
              key={`player-${player.id}`}
              className="absolute z-[5] -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-0.5"
              style={{ left: `${left}%`, top: `${top}%`, transition: 'left 0.3s ease-out, top 0.3s ease-out' }}
            >
              <div className="relative h-6 w-6 rounded-full border-2 border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.6)] overflow-hidden bg-[#0a1018]">
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} alt={player.displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-cyan-50">
                    {getInitial(player.displayName)}
                  </span>
                )}
              </div>
              <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm whitespace-nowrap">
                {player.displayName}
              </span>
            </div>
          );
        })}

        {pinLayouts.map(({ ws, left, top, tone }) => {
          const isSelected = selectedWorkstationId === ws.id;
          return (
            <button
              key={ws.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectWorkstation?.(ws);
                onPinClick?.(ws);
              }}
              aria-label={`${ws.label} - ${tone.label}`}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group focus-visible:outline-none"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <div
                className={`relative flex items-center justify-center rounded-full h-3 w-3 sm:h-4 sm:w-4 md:h-4 md:w-4 ring-[1px] sm:ring-[1.5px] ${tone.ring} ${tone.glow} ${isSelected ? 'scale-110' : 'scale-100 group-hover:scale-110'
                  } transition-transform duration-150`}
              >
                <span className={`absolute inset-0 rounded-full ${tone.dot} opacity-95`} />
                {tone.pulse && <span className="absolute inset-0 rounded-full bg-emerald-300/30 animate-ping [animation-duration:1800ms]" />}
                {ws.status === 'IN_USE' && ws.occupant_avatar_url ? (
                  <img
                    src={ws.occupant_avatar_url}
                    alt={ws.occupant_name || 'Occupant'}
                    className="relative h-[10px] w-[10px] sm:h-[12px] sm:w-[12px] md:h-[14px] md:w-[14px] rounded-full object-cover border border-white/35"
                  />
                ) : ws.status === 'IN_USE' ? (
                  <span className="relative text-white text-[5px] sm:text-[6px] md:text-[7px] font-bold tracking-tight">{getInitial(ws.occupant_name)}</span>
                ) : (
                  <span className="relative material-icons text-white text-[7px] sm:text-[8px] md:text-[9px]">desktop_windows</span>
                )}
                {ws.status === 'IN_USE' && ws.occupancy_mode && ws.occupancy_mode !== 'self' && (
                  <span className="absolute -right-[1px] -bottom-[1px] h-1 w-1 sm:h-1.5 sm:w-1.5 md:h-1.5 md:w-1.5 rounded-full bg-amber-400 border border-[#0a1018]" />
                )}
              </div>

              <span
                className={`mt-0.5 block rounded bg-[#030712]/90 border border-white/10 px-1 py-[1px] text-[4.5px] sm:text-[5px] md:text-[6px] font-bold tracking-wider backdrop-blur-md shadow-lg whitespace-nowrap ${isSelected
                  ? 'border-primary/60 bg-primary/25 text-white ring-[0.5px] ring-primary/20'
                  : 'text-slate-200'
                  }`}
              >
                {ws.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MapViewer;
