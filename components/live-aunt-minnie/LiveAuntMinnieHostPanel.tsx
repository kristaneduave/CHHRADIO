import React from 'react';
import { LiveAuntMinniePrompt, LiveAuntMinnieRoomState } from '../../types';
import LiveAuntMinnieQuestionFeed from './LiveAuntMinnieQuestionFeed';

interface LiveAuntMinnieHostPanelProps {
  onBack?: () => void;
  currentUserId: string | null;
  draftResponsesByPromptId: Record<string, string>;
  roomState: LiveAuntMinnieRoomState;
  submittingPromptIds: Record<string, boolean>;
  busyAction?: string | null;
  lockCountdownSeconds?: number | null;
  roomSyncState?: 'connecting' | 'live' | 'degraded';
  onLockAnswers: () => Promise<void>;
  onCancelLockCountdown?: () => void;
  onRefresh?: () => Promise<void>;
  onSaveCorrectAnswer?: (promptId: string, value: string) => Promise<void>;
  onDraftChange: (promptId: string, value: string) => void;
  onSubmitResponse: (promptId: string, value?: string) => Promise<void>;
  onCompose: () => void;
  onEditPrompt: (prompt: LiveAuntMinniePrompt) => void;
}

const LiveAuntMinnieHostPanel: React.FC<LiveAuntMinnieHostPanelProps> = ({
  onBack,
  currentUserId,
  draftResponsesByPromptId,
  roomState,
  submittingPromptIds,
  busyAction,
  lockCountdownSeconds,
  roomSyncState,
  onLockAnswers,
  onCancelLockCountdown,
  onRefresh,
  onSaveCorrectAnswer,
  onDraftChange,
  onSubmitResponse,
  onCompose,
  onEditPrompt,
}) => {
  const isPromptOpen = roomState.session.status === 'live' && roomState.session.current_phase === 'prompt_open';
  const isEnded = roomState.session.status !== 'live';
  const canAddQuestion = isPromptOpen;

  return (
    <div className="space-y-4">
      <section className="sticky top-3 z-10 rounded-[24px] border border-white/10 bg-[#101b26]/95 p-3 backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3">
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

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {canAddQuestion && (
              <button
                type="button"
                onClick={onCompose}
                className="rounded-full border border-cyan-400/20 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                Add question
              </button>
            )}
            <button
              type="button"
              onClick={() => void onRefresh?.()}
              disabled={busyAction === 'manual-resync'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
              aria-label={busyAction === 'manual-resync' ? 'Refreshing' : 'Refresh'}
              title={busyAction === 'manual-resync' ? 'Refreshing' : 'Refresh'}
            >
              <span className={`material-icons text-[18px] ${busyAction === 'manual-resync' ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
            {roomSyncState !== 'live' && (
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                {roomSyncState === 'connecting' ? 'Connecting...' : 'Realtime delayed'}
              </span>
            )}
            {isPromptOpen && (
              <button
                type="button"
                onClick={() => {
                  if (lockCountdownSeconds !== null) {
                    onCancelLockCountdown?.();
                    return;
                  }
                  void onLockAnswers();
                }}
                disabled={busyAction === 'lock-answers'}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {busyAction === 'lock-answers'
                  ? 'Locking...'
                  : lockCountdownSeconds !== null
                    ? `Cancel ${lockCountdownSeconds}`
                    : 'Lock answers'}
              </button>
            )}
            </div>
          </div>
        </div>
      </section>

      <LiveAuntMinnieQuestionFeed
        answerMode="host-review"
        canAnswer={false}
        canEditCorrectAnswers={isEnded}
        canEditPosts
        busyAction={busyAction}
        currentUserId={currentUserId}
        draftResponsesByPromptId={draftResponsesByPromptId}
        onCompose={onCompose}
        onDraftChange={onDraftChange}
        onEditPrompt={onEditPrompt}
        onSaveCorrectAnswer={onSaveCorrectAnswer}
        onSubmitResponse={onSubmitResponse}
        roomState={roomState}
        submittingPromptIds={submittingPromptIds}
      />
    </div>
  );
};

export default LiveAuntMinnieHostPanel;
