import React, { useMemo } from 'react';
import { CurrentWorkstationStatus, Floor } from '../types';
import LoadingState from './LoadingState';

interface MapViewerProps {
  floor: Floor;
  workstations: CurrentWorkstationStatus[];
  selectedWorkstationId?: string;
  onSelectWorkstation?: (ws: CurrentWorkstationStatus) => void;
  onPinClick?: (ws: CurrentWorkstationStatus) => void;
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
  selectedWorkstationId,
  onSelectWorkstation,
  onPinClick,
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
    <div className="relative w-full rounded-2xl border border-white/10 bg-black/25 p-2 backdrop-blur-sm shadow-[0_16px_40px_-18px_rgba(2,6,23,0.85)]">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a1018]"
        style={{ aspectRatio, touchAction: 'pan-y' }}
      >
        <img
          src={floor.image_url}
          alt={`${floor.name} workstation map`}
          className="absolute inset-0 h-full w-full object-contain select-none pointer-events-none"
          draggable={false}
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(56,189,248,0.1),transparent_35%),radial-gradient(circle_at_78%_72%,rgba(16,185,129,0.08),transparent_35%)] pointer-events-none" />

        {pinLayouts.map(({ ws, left, top, tone }) => {
          const isSelected = selectedWorkstationId === ws.id;
          return (
            <button
              key={ws.id}
              type="button"
              onClick={() => {
                onSelectWorkstation?.(ws);
                onPinClick?.(ws);
              }}
              aria-label={`${ws.label} - ${tone.label}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 group focus-visible:outline-none"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <div
                className={`relative flex items-center justify-center rounded-full h-7 w-7 ring-2 ${tone.ring} ${tone.glow} ${
                  isSelected ? 'scale-110' : 'scale-100 group-hover:scale-105'
                } transition-transform duration-150`}
              >
                <span className={`absolute inset-0 rounded-full ${tone.dot} opacity-95`} />
                {tone.pulse && <span className="absolute inset-0 rounded-full bg-emerald-300/30 animate-ping [animation-duration:1800ms]" />}
                {ws.status === 'IN_USE' && ws.occupant_avatar_url ? (
                  <img
                    src={ws.occupant_avatar_url}
                    alt={ws.occupant_name || 'Occupant'}
                    className="relative h-[22px] w-[22px] rounded-full object-cover border border-white/35"
                  />
                ) : ws.status === 'IN_USE' ? (
                  <span className="relative text-white text-[10px] font-bold">{getInitial(ws.occupant_name)}</span>
                ) : (
                  <span className="relative material-icons text-white text-[13px]">desktop_windows</span>
                )}
                {ws.status === 'IN_USE' && ws.occupancy_mode && ws.occupancy_mode !== 'self' && (
                  <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 border border-[#0a1018]" />
                )}
              </div>

              <span
                className={`mt-1 block rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wide backdrop-blur-sm ${
                  isSelected
                    ? 'border-primary/50 bg-primary/25 text-white'
                    : 'border-white/15 bg-black/45 text-slate-200'
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
