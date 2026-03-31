import React, { useEffect, useRef, useState } from 'react';
import { LiveAuntMinnieRoomState, LiveAuntMinnieSyncState } from '../../types';
import LiveAuntMinnieQuestionFeed from './LiveAuntMinnieQuestionFeed';

interface LiveAuntMinnieParticipantViewProps {
  onBack?: () => void;
  currentUserId: string | null;
  draftResponsesByPromptId: Record<string, string>;
  responseStatusByPromptId: Record<string, 'typing' | 'saving' | 'saved' | 'retry failed'>;
  roomState: LiveAuntMinnieRoomState;
  submittingPromptIds: Record<string, boolean>;
  busyAction?: string | null;
  roomSyncState?: LiveAuntMinnieSyncState;
  onDraftChange: (promptId: string, value: string) => void;
  onRefresh?: () => Promise<void>;
  onSubmitResponse: (promptId: string, value?: string) => Promise<void>;
}

const LiveAuntMinnieParticipantView: React.FC<LiveAuntMinnieParticipantViewProps> = ({
  onBack,
  currentUserId,
  draftResponsesByPromptId,
  responseStatusByPromptId,
  roomState,
  submittingPromptIds,
  busyAction,
  roomSyncState,
  onDraftChange,
  onRefresh,
  onSubmitResponse,
}) => {
  const [showEndedOverlay, setShowEndedOverlay] = useState(false);
  const previousStatusRef = useRef(roomState.session.status);
  const isEnded = roomState.session.status !== 'live';
  const currentQuestionNumber = Math.min(roomState.session.current_prompt_index + 1, Math.max(roomState.session.prompt_count, 1));
  const totalQuestionCount = Math.max(roomState.session.prompt_count, roomState.prompts.length, 1);
  const syncBannerCopy: Record<LiveAuntMinnieSyncState, string> = {
    connecting: 'Joining the room and syncing your exam shell.',
    syncing: 'Questions are loading. You can stay on this screen.',
    live: 'Synced. Drafts stay on this device until you submit.',
    reconnecting: 'Reconnecting to the live tally. Your draft stays on this device.',
    degraded: 'Realtime is delayed. Your draft stays local while we retry sync.',
  };

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    if (!isEnded && showEndedOverlay) {
      setShowEndedOverlay(false);
    }

    if (roomState.session.status !== 'live' && previousStatus !== roomState.session.status) {
      setShowEndedOverlay(true);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    previousStatusRef.current = roomState.session.status;
  }, [isEnded, roomState.session.status, showEndedOverlay]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(new CustomEvent('radcore-bottom-nav-visibility', { detail: { hidden: showEndedOverlay } }));

    return () => {
      window.dispatchEvent(new CustomEvent('radcore-bottom-nav-visibility', { detail: { hidden: false } }));
    };
  }, [showEndedOverlay]);

  return (
    <div className="space-y-4">
      <section className="sticky top-3 z-10 rounded-[24px] border border-white/10 bg-[#101b26]/95 p-3 backdrop-blur sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                aria-label="Back"
                title="Back"
              >
                <span className="material-icons text-[18px]">chevron_left</span>
              </button>
            )}
            <h2 className="truncate text-xl font-semibold text-white sm:text-2xl">
              {roomState.session.title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onRefresh?.()}
              disabled={busyAction === 'manual-resync'}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
              aria-label={busyAction === 'manual-resync' ? 'Refreshing' : 'Refresh'}
              title={busyAction === 'manual-resync' ? 'Refreshing' : 'Refresh'}
            >
              <span className={`material-icons text-[18px] ${busyAction === 'manual-resync' ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              roomSyncState === 'live'
                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
            }`}>
              {roomSyncState === 'live'
                ? 'Synced'
                : roomSyncState === 'syncing'
                  ? 'Syncing...'
                  : roomSyncState === 'reconnecting'
                    ? 'Reconnecting...'
                    : roomSyncState === 'connecting'
                      ? 'Connecting...'
                      : 'Realtime delayed'}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
            Question {currentQuestionNumber} of {totalQuestionCount}
          </div>
          <p className="text-xs text-slate-400">{syncBannerCopy[roomSyncState || 'connecting']}</p>
        </div>
      </section>

      <LiveAuntMinnieQuestionFeed
        answerMode={roomState.session.status === 'live' && roomState.session.current_phase === 'prompt_open' ? 'editable' : 'locked-summary'}
        canAnswer={roomState.session.status === 'live' && roomState.session.current_phase === 'prompt_open'}
        currentUserId={currentUserId}
        draftResponsesByPromptId={draftResponsesByPromptId}
        responseStatusByPromptId={responseStatusByPromptId}
        syncState={roomSyncState}
        onDraftChange={onDraftChange}
        onSubmitResponse={onSubmitResponse}
        roomState={roomState}
        submittingPromptIds={submittingPromptIds}
      />

      {showEndedOverlay && isEnded && (
        <div className="fixed inset-0 z-[130] bg-slate-950/70 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="mobile-sheet-footer-clearance w-full max-w-md rounded-[30px] border border-white/10 bg-[#101b26] px-5 pb-5 pt-4 text-center shadow-[0_30px_80px_rgba(3,10,18,0.55)]">
              <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/10" />
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-100">
                <span className="material-icons text-[24px]">check_circle</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">
                Exam ended
              </h3>
              <p className="mx-auto mt-2 max-w-[22rem] text-sm leading-6 text-slate-300">
                Submitted answers and correct answers are ready below.
              </p>
              <button
                type="button"
                onClick={() => setShowEndedOverlay(false)}
                className="mt-5 w-full rounded-[20px] border border-cyan-400/20 bg-cyan-500/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                View ended exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveAuntMinnieParticipantView;
