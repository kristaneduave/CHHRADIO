import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QUICK_ACTIONS } from '../constants';
import { Screen, SubmissionType } from '../types';
import { UploadTypePickerModal } from './UploadTypePickerModal';
import { OrbitalButton } from './OrbitalButton';
import { toastSuccess } from '../utils/toast';
interface DashboardProps {
  onNavigate: (screen: Screen) => void;
  onStartUpload: (submissionType: SubmissionType) => void;
}

const NEW_BUTTON_STYLES: Record<string, { colorClass: string; bgClass: string; borderClass: string; shadowClass: string }> = {
  Announcements: {
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/20',
    shadowClass: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]',
  },
  Calendar: {
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/20',
    shadowClass: 'shadow-[0_0_15px_rgba(244,63,94,0.2)]',
  },
  Database: {
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    shadowClass: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
  },
  'Case Library': {
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    shadowClass: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
  },
  'Upload Case': {
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    shadowClass: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
  },
  Quiz: {
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
    shadowClass: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
  },
  "Resident Hub": {
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/20',
    shadowClass: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
  },
};

const BUTTON_LABELS: Record<string, string> = {
  'Upload Case': 'Upload',
  Database: 'Database',
  'Case Library': 'Database',
  Announcements: 'News',
  Calendar: 'Calendar',
  Quiz: 'Quiz',
  "Resident Hub": 'Resident Hub',
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onStartUpload }) => {
  const [isUploadTypePickerOpen, setIsUploadTypePickerOpen] = useState(false);
  const [isLogoSyncing, setIsLogoSyncing] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [isOverdrive, setIsOverdrive] = useState(false);
  const [hoveredActionIndex, setHoveredActionIndex] = useState<number | null>(null);
  const [radius, setRadius] = useState(135);

  const buttonOrder = ['Upload Case', 'Case Library', 'Announcements', 'Calendar', 'Quiz', "Resident Hub"];
  const orderedActions = [...QUICK_ACTIONS].sort((a, b) => buttonOrder.indexOf(a.label) - buttonOrder.indexOf(b.label));

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 400) {
        setRadius(115);
      } else if (window.innerWidth < 640) {
        setRadius(130);
      } else {
        setRadius(145);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isUploadTypePickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUploadTypePickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUploadTypePickerOpen]);

  return (
    <div className="h-full bg-app flex flex-col text-text-primary relative overflow-hidden">
      {/* Fiery Overdrive Screen Overlay (Optimized for mobile GPU) */}
      <div
        className={`pointer-events-none fixed inset-0 h-[100dvh] w-screen z-[999] transition-opacity duration-500 will-change-[opacity] ${isOverdrive ? 'opacity-100 animate-pulse' : 'opacity-0'}`}
        style={{
          boxShadow: 'inset 0 0 80px rgba(239, 68, 68, 0.3)',
          background: 'radial-gradient(circle at center, transparent 50%, rgba(220, 38, 38, 0.15) 100%)'
        }}
      >
        <div className="absolute inset-0 border-[2px] border-red-500/40" />
      </div>
      <header className="pt-10 pb-4 px-6 relative z-10 text-center flex flex-col items-center justify-center space-y-0">
        <motion.h1
          initial={{ opacity: 1, filter: 'drop-shadow(0 0 0 transparent)' }}
          animate={{
            x: [0, -4, 4, -2, 2, 0],
            filter: [
              'drop-shadow(0 0 0 transparent)',
              'drop-shadow(4px 0 0 rgba(239, 68, 68, 1)) drop-shadow(-4px 0 0 rgba(34, 211, 238, 1))',
              'drop-shadow(-4px 0 0 rgba(239, 68, 68, 1)) drop-shadow(4px 0 0 rgba(34, 211, 238, 1))',
              'drop-shadow(2px 0 0 rgba(239, 68, 68, 1)) drop-shadow(-2px 0 0 rgba(34, 211, 238, 1))',
              'drop-shadow(-1px 0 0 rgba(239, 68, 68, 1)) drop-shadow(1px 0 0 rgba(34, 211, 238, 1))',
              'drop-shadow(0 4px 10px rgba(0,0,0,0.5))'
            ]
          }}
          transition={{
            duration: 0.5,
            ease: "linear",
            times: [0, 0.2, 0.4, 0.6, 0.8, 1]
          }}
          className="text-5xl sm:text-6xl font-black text-white uppercase leading-none tracking-[0.1em] select-none"
        >
          RADCORE
        </motion.h1>
        <motion.p
          initial={{ opacity: 1, filter: 'drop-shadow(0 0 0 transparent)' }}
          animate={{
            x: [0, 6, -6, 3, -3, 0],
            filter: [
              'drop-shadow(0 0 0 transparent)',
              'drop-shadow(-4px 0 0 rgba(239, 68, 68, 1)) drop-shadow(4px 0 0 rgba(34, 211, 238, 1))',
              'drop-shadow(4px 0 0 rgba(239, 68, 68, 1)) drop-shadow(-4px 0 0 rgba(34, 211, 238, 1))',
              'drop-shadow(-2px 0 0 rgba(239, 68, 68, 1)) drop-shadow(2px 0 0 rgba(34, 211, 238, 1))',
              'drop-shadow(1px 0 0 rgba(239, 68, 68, 1)) drop-shadow(-1px 0 0 rgba(34, 211, 238, 1))',
              'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' /* matches default drop-shadow-md */
            ]
          }}
          transition={{
            duration: 0.5,
            delay: 0.1, /* slight offset for visual cascade */
            ease: "linear",
            times: [0, 0.2, 0.4, 0.6, 0.8, 1]
          }}
          className="text-[11px] sm:text-[13px] font-bold text-sky-400 uppercase tracking-[0.1em] opacity-90 mt-2 select-none"
        >
          CHH Radiology Residency Portal
        </motion.p>
      </header>

      <main className="relative z-10 flex-1 px-4 w-full flex flex-col items-center justify-start pt-16 overflow-y-auto w-[100vw] overflow-x-hidden">
        <div className="relative w-[320px] h-[320px] flex items-center justify-center mb-8">

          {/* Neural Network SVG Connecting Lines */}
          <svg className="absolute inset-0 m-auto w-[320px] h-[320px] pointer-events-none z-10" style={{ overflow: 'visible' }}>
            {orderedActions.map((action, index) => {
              const angle = (index * (360 / orderedActions.length)) - 90;
              const angleInRad = (angle * Math.PI) / 180;
              const targetX = 160 + Math.cos(angleInRad) * radius;
              const targetY = 160 + Math.sin(angleInRad) * radius;

              const isHovered = hoveredActionIndex === index;
              const style = NEW_BUTTON_STYLES[action.label];
              const strokeClass = (style?.colorClass || 'text-slate-300').replace('text-', 'stroke-');

              // Calculate SVG Start Point (Outside Central Logo: ~54px Radius)
              const startRadius = 54;
              const startX = 160 + Math.cos(angleInRad) * startRadius;
              const startY = 160 + Math.sin(angleInRad) * startRadius;

              // Calculate SVG End Point (Before Orbital Button: ~28px smaller than orbit radius)
              const endRadius = radius - 28;
              const endX = 160 + Math.cos(angleInRad) * endRadius;
              const endY = 160 + Math.sin(angleInRad) * endRadius;

              return (
                <line
                  key={`line-${action.label}`}
                  x1={startX} y1={startY} x2={endX} y2={endY}
                  strokeDasharray="2 4"
                  className={`transition-all duration-300 ${isHovered ? `${strokeClass} stroke-[1.5px] opacity-40 drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]` : 'stroke-white/5 stroke-[1px] opacity-10'}`}
                />
              )
            })}
          </svg>

          <button
            onClick={() => {
              const newCount = logoClickCount + 1;
              setLogoClickCount(newCount);

              if (newCount >= 3) { // Trigger on 3 or more
                setIsLogoSyncing(true);
                setTimeout(() => {
                  setLogoClickCount(0);
                  setIsLogoSyncing(false);
                }, 2500);
              }
            }}
            className="peer absolute inset-0 m-auto w-[120px] h-[120px] flex flex-col items-center justify-center z-50 outline-none transition-all duration-200 cursor-pointer select-none rounded-full group"
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
          >
            <img
              src="/logo-radcore.svg"
              alt="CHH RadCore logo"
              draggable={false}
              className={`h-[116px] w-[116px] object-contain transition-all duration-300 pointer-events-none select-none z-50 group-active:brightness-150 group-active:animate-glitch group-active:scale-[0.98] ${isLogoSyncing ? 'animate-glitch brightness-150' : 'drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]'}`}
            />
          </button>

          {/* Solid Dark Backdrop (hides lines passing underneath, perfectly matches app background) */}
          <div className="absolute inset-0 m-auto w-[112px] h-[112px] rounded-full bg-app z-40 pointer-events-none" />

          {/* Refined Premium Orbital Rings */}
          <div className={`absolute inset-0 m-auto w-[260px] h-[260px] rounded-full border-[1.5px] pointer-events-none transition-all duration-1000 z-10 peer-active:animate-[orbitalGlitch_0.35s_cubic-bezier(.25,.46,.45,.94)_infinite] ${isLogoSyncing ? 'animate-[orbitalGlitch_0.35s_cubic-bezier(.25,.46,.45,.94)_infinite]' : 'border-white/5 animate-[spin_160s_linear_infinite]'}`} />
          <div className={`absolute inset-0 m-auto w-[290px] h-[290px] rounded-full border-[1.5px] border-dashed pointer-events-none transition-all duration-1000 z-10 peer-active:animate-[orbitalGlitch_0.35s_cubic-bezier(.25,.46,.45,.94)_infinite_reverse] ${isLogoSyncing ? 'animate-[orbitalGlitch_0.35s_cubic-bezier(.25,.46,.45,.94)_infinite_reverse]' : 'border-white/5 animate-[spin_200s_linear_infinite_reverse]'}`} />
          <div className={`absolute inset-0 m-auto w-[210px] h-[210px] rounded-full border pointer-events-none transition-all duration-1000 z-10 border-white/5`} />

          {/* Orbiting Action Buttons */}
          {orderedActions.map((action, index) => {
            const style = NEW_BUTTON_STYLES[action.label] || {
              colorClass: 'text-slate-300',
              bgClass: 'bg-white/10',
              borderClass: 'border-white/10',
              shadowClass: '',
            };

            return (
              <OrbitalButton
                key={action.label}
                action={action}
                index={index}
                totalElements={orderedActions.length}
                isLogoSyncing={isLogoSyncing}
                onClick={() => {
                  if (action.target === 'upload') {
                    setIsUploadTypePickerOpen(true);
                    return;
                  }
                  onNavigate(action.target);
                }}
                radius={radius}
                onHover={() => setHoveredActionIndex(index)}
                onHoverEnd={() => setHoveredActionIndex(null)}
                displayLabel={BUTTON_LABELS[action.label] || action.label}
                styleConfig={style}
              />
            );
          })}
        </div>
      </main>

      <UploadTypePickerModal
        isOpen={isUploadTypePickerOpen}
        onClose={() => setIsUploadTypePickerOpen(false)}
        onSelect={onStartUpload}
      />

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes glitch {
          0% { transform: translate(0) scale(1); filter: drop-shadow(0 0 0 transparent); }
          20% { transform: translate(-1px, 1px) scale(1.02); filter: drop-shadow(2px 0 0 rgba(239, 68, 68, 0.7)) drop-shadow(-2px 0 0 rgba(34, 211, 238, 0.7)); }
          40% { transform: translate(1px, -1px) scale(1.02); filter: drop-shadow(-2px 0 0 rgba(239, 68, 68, 0.7)) drop-shadow(2px 0 0 rgba(34, 211, 238, 0.7)); }
          60% { transform: translate(-1px, -1px) scale(1); filter: drop-shadow(1px 0 0 rgba(239, 68, 68, 0.7)) drop-shadow(-1px 0 0 rgba(34, 211, 238, 0.7)); }
          80% { transform: translate(1px, 1px) scale(1.01); filter: drop-shadow(0 0 0 transparent); }
          100% { transform: translate(0) scale(1); filter: drop-shadow(0 0 0 transparent); }
        }

        @keyframes orbitalGlitch {
          0% { transform: scale(1); box-shadow: 0 0 0 transparent; border-color: rgba(255,255,255,0.05); }
          10% { transform: scale(1.01) translate(-1px, 1px); border-color: #22d3ee; box-shadow: 0 0 5px #22d3ee, inset 0 0 2px #22d3ee; }
          30% { transform: scale(0.99) translate(1px, -1px); border-color: #ef4444; box-shadow: 0 0 8px #ef4444, inset 0 0 2px #ef4444; }
          50% { transform: scale(1.01) translate(-1px, -1px); border-color: #22d3ee; box-shadow: 0 0 5px #22d3ee; opacity: 0.8; }
          70% { transform: scale(0.99) translate(1px, 1px); border-color: #ef4444; box-shadow: 0 0 8px #ef4444; opacity: 0.5; }
          100% { transform: scale(1); border-color: rgba(255,255,255,0.05); box-shadow: 0 0 0 transparent; }
        }

        .animate-glitch {
          animation: glitch 0.35s cubic-bezier(.25,.46,.45,.94) infinite;
        }

        .header-panel {
          background:
            linear-gradient(155deg, rgba(11, 19, 31, 0.94) 0%, rgba(18, 32, 51, 0.9) 42%, rgba(11, 19, 31, 0.96) 100%);
          box-shadow:
            inset 0 1px 0 rgba(186, 230, 253, 0.17),
            inset 0 -1px 0 rgba(148, 163, 184, 0.08),
            0 22px 48px rgba(2, 6, 23, 0.48);
          backdrop-filter: blur(14px) saturate(120%);
          -webkit-backdrop-filter: blur(14px) saturate(120%);
        }

        .material-icons {
          font-variation-settings:
            'FILL' 1,
            'wght' 500,
            'GRAD' 0,
            'opsz' 24;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
