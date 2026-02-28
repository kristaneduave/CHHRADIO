import React, { useEffect, useState } from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen, SubmissionType } from '../types';

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

  const buttonOrder = ['Upload Case', 'Case Library', 'Announcements', 'Calendar', 'Quiz', "Resident Hub"];
  const orderedActions = [...QUICK_ACTIONS].sort((a, b) => buttonOrder.indexOf(a.label) - buttonOrder.indexOf(b.label));

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
      <header className="pt-8 pb-4 px-6 relative z-10">
        <div className="relative mx-auto flex w-full items-center justify-center gap-3">
          <img
            src="/logo-radcore.svg"
            alt="CHH RadCore logo"
            className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]"
          />
          <h1 className="flex min-w-0 flex-col justify-center leading-none">
            <span className="text-xl font-black tracking-[0.2em] text-white uppercase drop-shadow-md">CHH RadCore</span>
          </h1>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 max-w-md mx-auto w-full pb-[max(5.75rem,calc(env(safe-area-inset-bottom)+4.75rem))] overflow-y-auto">
        <div className="flex flex-col pt-4 pb-6 gap-2">
          <div className="grid grid-cols-3 gap-3">
            {orderedActions.map((action, index) => {
              const style = NEW_BUTTON_STYLES[action.label] || {
                colorClass: 'text-slate-300',
                bgClass: 'bg-white/10',
                borderClass: 'border-white/10',
                shadowClass: '',
              };
              return (
                <button
                  key={action.label}
                  onClick={() => {
                    if (action.target === 'upload') {
                      setIsUploadTypePickerOpen(true);
                      return;
                    }
                    onNavigate(action.target);
                  }}
                  className={`bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center gap-3 aspect-square transition-all active:scale-95 text-center hover:bg-white/[0.06]`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${style.bgClass} ${style.borderClass} ${style.shadowClass}`}>
                    <span className={`material-icons text-xl ${style.colorClass}`}>
                      {action.icon}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold leading-tight">{BUTTON_LABELS[action.label] || action.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {isUploadTypePickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Choose upload type"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-app/90 backdrop-blur-md transition-opacity"
            onClick={() => setIsUploadTypePickerOpen(false)}
          ></div>
          {/* Modal Container */}
          <div
            className="w-full max-w-[320px] bg-[#0a0f18]/80 backdrop-blur-2xl border border-white/10 rounded-[1.75rem] shadow-[0_0_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden relative z-10 animate-in zoom-in-95 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Content Area */}
            <div className="p-5 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[50px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 space-y-2.5">
                <button
                  className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group"
                  onClick={() => {
                    setIsUploadTypePickerOpen(false);
                    onStartUpload('interesting_case');
                  }}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[0.85rem] bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shadow-[0_0_15px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_20px_rgba(56,189,248,0.25)] transition-all">
                      <span className="material-icons text-[20px]">library_books</span>
                    </div>
                    <span className="block text-[13px] font-bold text-sky-400 group-hover:text-sky-300 transition-colors tracking-widest uppercase">INTERESTING CASE</span>
                  </div>
                  <div className="flex items-center pr-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <span className="material-icons text-white text-[20px]">chevron_right</span>
                  </div>
                </button>

                <button
                  className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group"
                  onClick={() => {
                    setIsUploadTypePickerOpen(false);
                    onStartUpload('rare_pathology');
                  }}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[0.85rem] bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)] group-hover:shadow-[0_0_20px_rgba(244,63,94,0.25)] transition-all">
                      <span className="material-icons text-[20px]">biotech</span>
                    </div>
                    <span className="block text-[13px] font-bold text-rose-400 group-hover:text-rose-300 transition-colors tracking-widest uppercase">RARE PATHOLOGY</span>
                  </div>
                  <div className="flex items-center pr-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <span className="material-icons text-white text-[20px]">chevron_right</span>
                  </div>
                </button>

                <button
                  className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group"
                  onClick={() => {
                    setIsUploadTypePickerOpen(false);
                    onStartUpload('aunt_minnie');
                  }}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[0.85rem] bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all">
                      <span className="material-icons text-[20px]">psychology</span>
                    </div>
                    <span className="block text-[13px] font-bold text-amber-400 group-hover:text-amber-300 transition-colors tracking-widest uppercase">AUNT MINNIE</span>
                  </div>
                  <div className="flex items-center pr-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <span className="material-icons text-white text-[20px]">chevron_right</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
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

        @media (max-height: 760px) {
          .quick-link-grid {
            gap: 0.45rem;
          }

          .quick-link-card {
            min-height: 5.05rem;
          }

          .quick-link-icon {
            margin-bottom: 0.15rem;
            padding: 0.45rem;
          }

          .quick-link-icon .material-icons {
            font-size: 1.3rem;
          }

          .quick-link-label {
            font-size: 0.64rem;
          }

        }
      `}</style>
    </div>
  );
};

export default Dashboard;
