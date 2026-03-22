import React from 'react';
import { LiveAuntMinniePrompt, LiveAuntMinnieRoomState } from '../../types';
import LiveAuntMinnieQuestionFeed from './LiveAuntMinnieQuestionFeed';

interface LiveAuntMinnieHostPanelProps {
  currentUserId: string | null;
  draftResponsesByPromptId: Record<string, string>;
  roomState: LiveAuntMinnieRoomState;
  submittingPromptIds: Record<string, boolean>;
  busyAction?: string | null;
  onDraftChange: (promptId: string, value: string) => void;
  onSubmitResponse: (promptId: string) => Promise<void>;
  onStart: () => Promise<void>;
  onEnd: () => Promise<void>;
  onCompose: () => void;
  onEditPrompt: (prompt: LiveAuntMinniePrompt) => void;
}

const formatRoomState = (status: LiveAuntMinnieRoomState['session']['status']) =>
  status === 'draft'
    ? 'Draft'
    : status === 'live'
      ? 'Live'
      : status === 'completed'
        ? 'Ended'
        : 'Closed';

const LiveAuntMinnieHostPanel: React.FC<LiveAuntMinnieHostPanelProps> = ({
  currentUserId,
  draftResponsesByPromptId,
  roomState,
  submittingPromptIds,
  busyAction,
  onDraftChange,
  onSubmitResponse,
  onStart,
  onEnd,
  onCompose,
  onEditPrompt,
}) => (
  <div className="space-y-4">
    <section className="sticky top-3 z-10 rounded-[26px] border border-white/10 bg-[#101b26]/95 p-3 backdrop-blur sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Code {roomState.session.join_code}</span>
            <span>•</span>
            <span>{formatRoomState(roomState.session.status)}</span>
          </div>
          <h2 className="mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
            {roomState.session.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {roomState.session.status === 'draft' && (
            <button
              type="button"
              onClick={() => void onStart()}
              disabled={busyAction === 'start'}
              className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-50"
            >
              {busyAction === 'start' ? 'Going live...' : 'Go live'}
            </button>
          )}
          {roomState.session.status !== 'completed' && roomState.session.status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => void onEnd()}
              disabled={busyAction === 'end'}
              className="rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:opacity-50"
            >
              {busyAction === 'end' ? 'Ending...' : 'End'}
            </button>
          )}
        </div>
      </div>
    </section>

    <LiveAuntMinnieQuestionFeed
      canAnswer={false}
      canEditPosts
      currentUserId={currentUserId}
      draftResponsesByPromptId={draftResponsesByPromptId}
      onCompose={onCompose}
      onDraftChange={onDraftChange}
      onEditPrompt={onEditPrompt}
      onSubmitResponse={onSubmitResponse}
      roomState={roomState}
      submittingPromptIds={submittingPromptIds}
    />

    <button
      type="button"
      onClick={onCompose}
      className="fixed bottom-5 right-5 z-20 flex h-14 min-w-[56px] items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/90 px-5 text-base font-semibold text-slate-950 shadow-[0_20px_40px_rgba(34,211,238,0.2)] transition hover:bg-cyan-300 md:bottom-8 md:right-8"
    >
      +
    </button>
  </div>
);

export default LiveAuntMinnieHostPanel;
