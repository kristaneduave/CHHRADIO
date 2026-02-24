import React, { useEffect, useState } from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen, SubmissionType } from '../types';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
  onStartUpload: (submissionType: SubmissionType) => void;
}

const BUTTON_STYLES: Record<string, { text: string; border: string; badge: string; shadow: string; hover: string; indicator: string }> = {
  Announcements: {
    text: 'text-fuchsia-300',
    border: 'hover:border-fuchsia-300/35',
    badge: 'bg-fuchsia-500/10 group-hover:bg-fuchsia-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(217,70,239,0.22)]',
    hover: 'group-hover:text-fuchsia-200',
    indicator: 'bg-fuchsia-300/35',
  },
  Calendar: {
    text: 'text-teal-300',
    border: 'hover:border-teal-300/35',
    badge: 'bg-teal-500/10 group-hover:bg-teal-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(45,212,191,0.22)]',
    hover: 'group-hover:text-teal-200',
    indicator: 'bg-teal-300/35',
  },
  Database: {
    text: 'text-indigo-300',
    border: 'hover:border-indigo-300/35',
    badge: 'bg-indigo-500/10 group-hover:bg-indigo-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(99,102,241,0.22)]',
    hover: 'group-hover:text-indigo-200',
    indicator: 'bg-indigo-300/35',
  },
  'Case Library': {
    text: 'text-indigo-300',
    border: 'hover:border-indigo-300/35',
    badge: 'bg-indigo-500/10 group-hover:bg-indigo-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(99,102,241,0.22)]',
    hover: 'group-hover:text-indigo-200',
    indicator: 'bg-indigo-300/35',
  },
  'Upload Case': {
    text: 'text-sky-300',
    border: 'hover:border-sky-300/35',
    badge: 'bg-sky-500/10 group-hover:bg-sky-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(56,189,248,0.22)]',
    hover: 'group-hover:text-sky-200',
    indicator: 'bg-sky-300/35',
  },
  Quiz: {
    text: 'text-rose-300',
    border: 'hover:border-rose-300/35',
    badge: 'bg-rose-500/10 group-hover:bg-rose-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(244,63,94,0.22)]',
    hover: 'group-hover:text-rose-200',
    indicator: 'bg-rose-300/35',
  },
  "Resident's Corner": {
    text: 'text-amber-300',
    border: 'hover:border-amber-300/35',
    badge: 'bg-amber-500/10 group-hover:bg-amber-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(245,158,11,0.22)]',
    hover: 'group-hover:text-amber-200',
    indicator: 'bg-amber-300/35',
  },
};

const BUTTON_LABELS: Record<string, string> = {
  'Upload Case': 'Upload',
  Database: 'Database',
  'Case Library': 'Database',
  Announcements: 'News',
  Calendar: 'Calendar',
  Quiz: 'Quiz',
  "Resident's Corner": 'Resi Hub',
};

const BUTTON_SUBTITLES: Record<string, string> = {
  'Upload Case': 'Submit cases',
  Database: 'Browse files',
  'Case Library': 'Browse files',
  Announcements: 'Stay Informed',
  Calendar: 'Leaves, Meetings & Events',
  Quiz: 'Take exam',
  "Resident's Corner": 'Other resources',
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onStartUpload }) => {
  const [isUploadTypePickerOpen, setIsUploadTypePickerOpen] = useState(false);

  const buttonOrder = ['Upload Case', 'Case Library', 'Announcements', 'Calendar', 'Quiz', "Resident's Corner"];
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
      <header className="pt-3 pb-1 px-4 relative z-10">
        <div className="header-panel relative overflow-hidden rounded-xl border border-white/10 px-4 py-3.5 shadow-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.16),transparent_48%),radial-gradient(circle_at_85%_18%,rgba(99,102,241,0.16),transparent_52%)]" />
          <div className="pointer-events-none absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="relative mx-auto flex w-full items-center justify-center gap-1.5 -translate-x-2">
            <img
              src="/logo-radcore.svg"
              alt="CHH RadCore logo"
              className="h-[4.45rem] w-[4.45rem] shrink-0 object-contain"
            />
            <h1 className="flex min-w-0 flex-col items-center justify-center gap-1 leading-none">
              <span className="text-[1.62rem] font-extrabold tracking-[0.045em] text-white">CHH RadCore</span>
              <span className="text-[0.54rem] uppercase tracking-[0.22em] text-cyan-200/65">For doctors, by doctors</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 max-w-md mx-auto w-full pb-[max(5.75rem,calc(env(safe-area-inset-bottom)+4.75rem))]">
        <div className="h-full flex flex-col pt-2.5 pb-1">
          <div className="quick-link-grid grid h-full grid-cols-2 grid-rows-3 gap-2">
          {orderedActions.map((action, index) => {
            const style = BUTTON_STYLES[action.label] || {
              text: 'text-text-secondary',
              border: '',
              badge: '',
              shadow: '',
              hover: '',
              indicator: 'bg-white/30',
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
                className={`quick-link-card group relative flex h-full min-h-[5.35rem] flex-col items-center justify-center overflow-hidden rounded-b-xl rounded-t-none border border-border-default/75 bg-surface/85 px-2 transition-all duration-200 active:scale-[0.985] active:shadow-[0_6px_14px_rgba(2,6,23,0.45)] hover:-translate-y-0.5 hover:bg-surface-alt/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 shadow-clinical ${style.border} ${style.shadow}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.008)_38%,rgba(255,255,255,0)_100%)] opacity-65" />
                <span className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
                <span className={`pointer-events-none absolute left-0 right-0 top-0 h-[1px] ${style.indicator}`} />
                <span className="pointer-events-none absolute left-0 right-0 top-[1px] h-[1px] bg-[linear-gradient(90deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.14)_100%)]" />
                <div className={`quick-link-icon mb-1 rounded-xl p-2 transition-colors duration-300 ${style.badge}`}>
                  <span className={`material-icons text-[1.45rem] transition-transform duration-300 group-hover:scale-105 ${style.text}`}>
                    {action.icon}
                  </span>
                </div>

                <span className={`quick-link-label text-[0.71rem] font-semibold uppercase tracking-[0.08em] text-slate-300 transition-colors ${style.hover}`}>
                  {BUTTON_LABELS[action.label] || action.label}
                </span>
                <span className="quick-link-subtitle mt-0.5 text-center text-[8.6px] leading-[1.18] font-normal text-slate-400 group-hover:text-slate-300 transition-colors">
                  {BUTTON_SUBTITLES[action.label] || 'Open'}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </main>

      {isUploadTypePickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020617]/48 backdrop-blur-md p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
          aria-label="Choose upload type"
          onClick={() => setIsUploadTypePickerOpen(false)}
        >
          <div
            className="relative w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[1.25rem] border border-border-default/65 bg-[#111b2bd1] p-3 shadow-[0_10px_22px_rgba(2,6,23,0.35)] backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="pointer-events-none absolute inset-0 rounded-[1.25rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.01)_38%,rgba(255,255,255,0)_100%)]" />
            <span className="pointer-events-none absolute inset-[1px] rounded-[1.17rem] border border-border-default/40" />
            <span className="pointer-events-none absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <button
              type="button"
              aria-label="Close upload type picker"
              className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-default/70 bg-surface/80 text-slate-300 hover:bg-surface-alt/90 hover:text-white transition-colors"
              onClick={() => setIsUploadTypePickerOpen(false)}
            >
              <span className="material-icons text-[16px]">close</span>
            </button>

            <h3 className="relative text-[1.2rem] font-medium text-slate-100 text-center mb-2.5">Choose Upload Type</h3>
            <div className="relative space-y-2">
              <button
                className="relative w-full overflow-hidden rounded-[0.85rem] border border-border-default/65 bg-[#152235]/70 px-3 py-3 text-[0.98rem] font-normal text-slate-300 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-slate-100"
                onClick={() => {
                  setIsUploadTypePickerOpen(false);
                  onStartUpload('interesting_case');
                }}
              >
                <span className="relative">Interesting Case</span>
              </button>
              <button
                className="relative w-full overflow-hidden rounded-[0.85rem] border border-border-default/65 bg-[#152235]/70 px-3 py-3 text-[0.98rem] font-normal text-slate-300 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-slate-100"
                onClick={() => {
                  setIsUploadTypePickerOpen(false);
                  onStartUpload('rare_pathology');
                }}
              >
                <span className="relative">Rare Pathology</span>
              </button>
              <button
                className="relative w-full overflow-hidden rounded-[0.85rem] border border-border-default/65 bg-[#152235]/70 px-3 py-3 text-[0.98rem] font-normal text-slate-300 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-slate-100"
                onClick={() => {
                  setIsUploadTypePickerOpen(false);
                  onStartUpload('aunt_minnie');
                }}
              >
                <span className="relative">Aunt Minnie</span>
              </button>
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

          .quick-link-subtitle {
            margin-top: 0.15rem;
            font-size: 7.6px;
            line-height: 1.12;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
