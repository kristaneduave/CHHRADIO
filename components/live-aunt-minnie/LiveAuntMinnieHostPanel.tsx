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
  roomSyncState?: 'connecting' | 'live' | 'degraded';
  onLockAnswers: () => Promise<void>;
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
  roomSyncState,
  onLockAnswers,
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              {busyAction === 'manual-resync' ? 'Refreshing...' : 'Refresh'}
            </button>
            {roomSyncState !== 'live' && (
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                {roomSyncState === 'connecting' ? 'Connecting...' : 'Realtime delayed'}
              </span>
            )}
            {isPromptOpen && (
              <button
                type="button"
                onClick={() => void onLockAnswers()}
                disabled={busyAction === 'lock-answers'}
                className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:opacity-50"
              >
                {busyAction === 'lock-answers' ? 'Locking...' : 'Lock answers'}
              </button>
            )}
            {isEnded && (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100">
                Ended
              </span>
            )}
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

      {canAddQuestion && (
        <button
          type="button"
          onClick={onCompose}
          className="mobile-fab-clearance fixed right-5 z-20 flex h-14 min-w-[56px] items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/90 px-5 text-base font-semibold text-slate-950 shadow-[0_20px_40px_rgba(34,211,238,0.2)] transition hover:bg-cyan-300 md:bottom-8 md:right-8"
          aria-label="Add question"
          title="Add question"
        >
          <span className="material-icons text-[20px] leading-none">add</span>
        </button>
      )}
    </div>
  );
};

export default LiveAuntMinnieHostPanel;
