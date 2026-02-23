import React, { useEffect, useRef } from 'react';
import { DashboardSnapshotData, Screen } from '../types';
import LoadingState from './LoadingState';

interface DashboardSnapshotSheetProps {
  isOpen: boolean;
  loading: boolean;
  data: DashboardSnapshotData | null;
  sectionErrors: Partial<Record<'announcements' | 'cases' | 'calendar' | 'leaveToday' | 'auth', string>>;
  onClose: () => void;
  onRetry: () => void;
  onNavigate: (screen: Screen) => void;
}

const DashboardSnapshotSheet: React.FC<DashboardSnapshotSheetProps> = ({
  isOpen,
  loading,
  data,
  sectionErrors,
  onClose,
  onRetry,
  onNavigate,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasAnnouncements = (data?.newAnnouncementsCount || 0) > 0;
  const hasCases = (data?.newCaseLibraryCount || 0) > 0;
  const hasCalendar = (data?.newCalendarCount || 0) > 0;
  const hasLeave = (data?.leaveToday.length || 0) > 0;
  const hasCards = hasAnnouncements || hasCases || hasCalendar || hasLeave;
  const hasAnySectionError = Object.keys(sectionErrors).some((key) => key !== 'auth');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" onClick={onClose} aria-label="Close today snapshot" />

      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-3.5 shadow-2xl max-h-[70vh] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-snapshot-title"
      >
        <div className="mb-2 flex items-start justify-between">
          <h2 id="today-snapshot-title" className="text-[1.2rem] leading-none font-bold text-white">
            Today Snapshot
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={onRetry} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors" aria-label="Refresh snapshot">
              <span className="material-icons text-sm">refresh</span>
            </button>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label="Close snapshot"
            >
              <span className="material-icons text-sm">close</span>
            </button>
          </div>
        </div>

        <div className="space-y-2.5 overflow-y-auto pr-1 max-h-[calc(70vh-78px)]">
          {loading ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <LoadingState title="Loading updates..." compact />
            </div>
          ) : (
            <>
              {hasAnnouncements ? (
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('announcements');
                  }}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="Open announcements"
                >
                  <h3 className="mb-1 text-xs font-bold text-slate-200">Announcements</h3>
                  <p className="text-sm font-semibold text-white">{data?.newAnnouncementsCount} new posts</p>
                  <p className="text-[11px] text-slate-400 truncate">{data?.latestAnnouncementTitle || 'New announcement'}</p>
                </button>
              ) : null}

              {hasCases ? (
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('search');
                  }}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="Open case library"
                >
                  <h3 className="mb-1 text-xs font-bold text-slate-200">Case Library</h3>
                  <p className="text-sm font-semibold text-white">{data?.newCaseLibraryCount} new published cases</p>
                  <p className="text-[11px] text-slate-400 truncate">{data?.latestCaseTitle || 'New published case'}</p>
                </button>
              ) : null}

              {hasCalendar ? (
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('calendar');
                  }}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="Open calendar updates"
                >
                  <h3 className="mb-1 text-xs font-bold text-slate-200">Calendar</h3>
                  <p className="text-sm font-semibold text-white">{data?.newCalendarCount} new events posted</p>
                  <p className="text-[11px] text-slate-400 truncate">{data?.latestCalendarTitle || 'New calendar event'}</p>
                </button>
              ) : null}

              {hasLeave ? (
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('calendar');
                  }}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="Open leave coverage in calendar"
                >
                  <h3 className="mb-1 text-xs font-bold text-slate-200">On Leave Today</h3>
                  <div className="space-y-2">
                    {data?.leaveToday.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-white/10 bg-surface-alt p-2">
                        <p className="text-xs font-semibold text-white truncate">{entry.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.coverageNames.length > 0 ? (
                            entry.coverageNames.slice(0, 4).map((name) => (
                              <span key={name} className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500">No coverage listed</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              ) : null}

              {!hasCards ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-medium text-slate-200">
                    {hasAnySectionError ? 'Could not load updates right now.' : 'No new updates today'}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardSnapshotSheet;
