import React, { useEffect, useMemo, useState } from 'react';
import { QUICK_ACTIONS } from '../constants';
import { DashboardSnapshotData, Screen, SubmissionType } from '../types';
import DashboardSnapshotSheet from './DashboardSnapshotSheet';
import { fetchDashboardSnapshot } from '../services/dashboardSnapshotService';
import { toastError } from '../utils/toast';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
  onStartUpload: (submissionType: SubmissionType) => void;
}

const BUTTON_STYLES: Record<string, { text: string; border: string; badge: string; shadow: string; hover: string }> = {
  Announcements: {
    text: 'text-fuchsia-300',
    border: 'hover:border-fuchsia-300/35',
    badge: 'bg-fuchsia-500/10 group-hover:bg-fuchsia-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(217,70,239,0.22)]',
    hover: 'group-hover:text-fuchsia-200',
  },
  Calendar: {
    text: 'text-teal-300',
    border: 'hover:border-teal-300/35',
    badge: 'bg-teal-500/10 group-hover:bg-teal-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(45,212,191,0.22)]',
    hover: 'group-hover:text-teal-200',
  },
  'Case Library': {
    text: 'text-indigo-300',
    border: 'hover:border-indigo-300/35',
    badge: 'bg-indigo-500/10 group-hover:bg-indigo-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(99,102,241,0.22)]',
    hover: 'group-hover:text-indigo-200',
  },
  'Upload Case': {
    text: 'text-sky-300',
    border: 'hover:border-sky-300/35',
    badge: 'bg-sky-500/10 group-hover:bg-sky-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(56,189,248,0.22)]',
    hover: 'group-hover:text-sky-200',
  },
  Quiz: {
    text: 'text-rose-300',
    border: 'hover:border-rose-300/35',
    badge: 'bg-rose-500/10 group-hover:bg-rose-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(244,63,94,0.22)]',
    hover: 'group-hover:text-rose-200',
  },
  "Resident's Corner": {
    text: 'text-amber-300',
    border: 'hover:border-amber-300/35',
    badge: 'bg-amber-500/10 group-hover:bg-amber-500/15',
    shadow: 'group-hover:shadow-[0_0_24px_rgba(245,158,11,0.22)]',
    hover: 'group-hover:text-amber-200',
  },
};

const BUTTON_LABELS: Record<string, string> = {
  'Upload Case': 'Upload',
  'Case Library': 'Case Library',
  Announcements: 'News',
  Calendar: 'Calendar',
  Quiz: 'Quiz',
  "Resident's Corner": 'Resi Hub',
};

const BUTTON_SUBTITLES: Record<string, string> = {
  'Upload Case': 'Submit Interesting Cases',
  'Case Library': 'Browse Medical Records',
  Announcements: 'Stay Informed',
  Calendar: 'Leaves, Meetings & Events',
  Quiz: 'Test Your Knowledge',
  "Resident's Corner": 'Learning Resources',
};

const STALE_MS = 60_000;
const SNAPSHOT_MODAL_EVENT = 'dashboard-snapshot-visibility';

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onStartUpload }) => {
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const [isUploadTypePickerOpen, setIsUploadTypePickerOpen] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotData, setSnapshotData] = useState<DashboardSnapshotData | null>(null);
  const [snapshotErrors, setSnapshotErrors] = useState<
    Partial<Record<'announcements' | 'cases' | 'calendar' | 'leaveToday' | 'auth', string>>
  >({});
  const [lastSnapshotFetchAt, setLastSnapshotFetchAt] = useState<number>(0);
  const [nowLabel, setNowLabel] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const buttonOrder = ['Upload Case', 'Case Library', 'Announcements', 'Calendar', 'Quiz', "Resident's Corner"];
  const orderedActions = [...QUICK_ACTIONS].sort((a, b) => buttonOrder.indexOf(a.label) - buttonOrder.indexOf(b.label));

  const loadSnapshot = async () => {
    setSnapshotLoading(true);
    const { data, sectionErrors } = await fetchDashboardSnapshot();
    setSnapshotData(data);
    setSnapshotErrors(sectionErrors);
    setSnapshotLoading(false);
    setLastSnapshotFetchAt(Date.now());

    if (!data && Object.keys(sectionErrors).length > 0) {
      toastError('Today Snapshot unavailable', 'Some snapshot data could not be loaded.');
    }
  };

  useEffect(() => {
    loadSnapshot();
  }, []);

  useEffect(() => {
    if (!isSnapshotOpen) return;
    const stale = !lastSnapshotFetchAt || Date.now() - lastSnapshotFetchAt > STALE_MS;
    if (stale) loadSnapshot();
  }, [isSnapshotOpen, lastSnapshotFetchAt]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowLabel(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const shouldHideNav = isSnapshotOpen || isUploadTypePickerOpen;
    window.dispatchEvent(new CustomEvent(SNAPSHOT_MODAL_EVENT, { detail: shouldHideNav }));
    return () => {
      window.dispatchEvent(new CustomEvent(SNAPSHOT_MODAL_EVENT, { detail: false }));
    };
  }, [isSnapshotOpen, isUploadTypePickerOpen]);

  useEffect(() => {
    if (!isUploadTypePickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUploadTypePickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUploadTypePickerOpen]);

  const newAnnouncements = snapshotData?.newAnnouncementsCount || 0;
  const newCases = snapshotData?.newCaseLibraryCount || 0;
  const newEvents = snapshotData?.newCalendarCount || 0;
  const totalUnreadNotif = newAnnouncements + newCases + newEvents;
  const hasNewPosts = totalUnreadNotif > 0;

  const compactSummary = useMemo(() => {
    if (snapshotLoading) return 'Loading today snapshot...';
    if (snapshotErrors.auth) return 'Today Snapshot unavailable';
    if (!hasNewPosts) return `Today Snapshot • No updates • ${nowLabel}`;
    return `Today Snapshot • ${totalUnreadNotif} unread • ${nowLabel}`;
  }, [snapshotLoading, snapshotErrors.auth, hasNewPosts, totalUnreadNotif, nowLabel]);

  const hasSnapshotFailure = !snapshotLoading && (!snapshotData || Object.keys(snapshotErrors).length > 0);

  return (
    <div className="min-h-screen bg-app pb-28 flex flex-col text-text-primary relative overflow-hidden">
      <header className="pt-4 pb-2 px-5 relative z-10">
        <div className="header-panel relative overflow-hidden rounded-2xl border border-white/10 px-5 py-4 shadow-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.16),transparent_48%),radial-gradient(circle_at_85%_18%,rgba(99,102,241,0.16),transparent_52%)]" />
          <div className="pointer-events-none absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="relative mx-auto flex w-full items-center justify-center gap-1.5 -translate-x-3">
            <img
              src="/logo-radcore.svg"
              alt="CHH RadCore logo"
              className="h-[4.8rem] w-[4.8rem] shrink-0 object-contain"
            />
            <h1 className="flex min-w-0 flex-col items-center justify-center gap-1 leading-none">
              <span className="text-[1.62rem] font-extrabold tracking-[0.055em] text-white">CHH RadCore</span>
              <span className="text-[0.52rem] uppercase tracking-[0.24em] text-cyan-200/65">For doctors, by doctors</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-5 max-w-md mx-auto w-full">
        <div className="mb-2">
          <button
            onClick={() => setIsSnapshotOpen(true)}
            className={`w-full h-11 rounded-xl px-3 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 shadow-clinical ${
              hasNewPosts
                ? 'border border-rose-400/35 bg-rose-500/15 hover:bg-rose-500/20'
                : 'border border-border-default/70 bg-surface/80 hover:border-primary/40 hover:bg-surface-alt/90'
            }`}
            aria-label="Open Today Snapshot"
          >
            <div className="flex items-center justify-center">
              <p className={`truncate text-center text-[12px] font-normal ${hasNewPosts ? 'text-rose-100' : 'text-text-primary'}`}>
                {compactSummary}
              </p>
            </div>
          </button>

          {hasSnapshotFailure ? (
            <div className="mt-1 flex justify-end">
              <button
                onClick={loadSnapshot}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Retry snapshot load"
              >
                <span className="material-icons text-xs">refresh</span>
                Retry
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {orderedActions.map((action, index) => {
            const style = BUTTON_STYLES[action.label] || { text: 'text-text-secondary' };

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
                className={`group relative flex flex-col items-center justify-center h-[8.1rem] rounded-xl border border-border-default/80 bg-surface/85 px-2.5 transition-all duration-300 active:scale-[0.98] hover:-translate-y-0.5 hover:bg-surface-alt/95 shadow-clinical ${style.border} ${style.shadow}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className={`mb-1.5 rounded-xl p-2.5 transition-colors duration-300 ${style.badge}`}>
                  <span className={`material-icons text-[1.85rem] transition-transform duration-300 group-hover:scale-110 ${style.text}`}>
                    {action.icon}
                  </span>
                </div>

                <span className={`text-[0.73rem] font-semibold uppercase tracking-[0.1em] text-slate-400 transition-colors ${style.hover}`}>
                  {BUTTON_LABELS[action.label] || action.label}
                </span>
                <span className="mt-0.5 text-[9px] font-light text-slate-500 group-hover:text-slate-400 transition-colors">
                  {BUTTON_SUBTITLES[action.label] || 'Open'}
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <DashboardSnapshotSheet
        isOpen={isSnapshotOpen}
        loading={snapshotLoading}
        data={snapshotData}
        sectionErrors={snapshotErrors}
        onClose={() => setIsSnapshotOpen(false)}
        onRetry={loadSnapshot}
        onNavigate={onNavigate}
      />

      {isUploadTypePickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
          aria-label="Choose upload type"
          onClick={() => setIsUploadTypePickerOpen(false)}
        >
          <div
            className="w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#162235] p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[17px] font-bold text-white text-center mb-2.5">Choose Upload Type</h3>
            <div className="space-y-2">
              <button
                className="w-full rounded-xl bg-primary/20 border border-primary/40 px-3 py-3 text-[15px] font-semibold text-white hover:bg-primary/30 transition-colors"
                onClick={() => {
                  setIsUploadTypePickerOpen(false);
                  onStartUpload('interesting_case');
                }}
              >
                Interesting Case
              </button>
              <button
                className="w-full rounded-xl bg-rose-500/20 border border-rose-400/40 px-3 py-3 text-[15px] font-semibold text-white hover:bg-rose-500/30 transition-colors"
                onClick={() => {
                  setIsUploadTypePickerOpen(false);
                  onStartUpload('rare_pathology');
                }}
              >
                Rare Pathology
              </button>
              <button
                className="w-full rounded-xl bg-amber-500/20 border border-amber-400/40 px-3 py-3 text-[15px] font-semibold text-white hover:bg-amber-500/30 transition-colors"
                onClick={() => {
                  setIsUploadTypePickerOpen(false);
                  onStartUpload('aunt_minnie');
                }}
              >
                Aunt Minnie
              </button>
            </div>
            <button
              type="button"
              className="mt-2.5 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
              onClick={() => setIsUploadTypePickerOpen(false)}
            >
              Cancel
            </button>
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
      `}</style>
    </div>
  );
};

export default Dashboard;
