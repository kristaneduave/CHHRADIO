import React from 'react';
import { LiveAuntMinnieRoomState } from '../../types';
import LiveAuntMinnieQuestionFeed from './LiveAuntMinnieQuestionFeed';

interface LiveAuntMinnieParticipantViewProps {
  currentUserId: string | null;
  draftResponsesByPromptId: Record<string, string>;
  roomState: LiveAuntMinnieRoomState;
  submittingPromptIds: Record<string, boolean>;
  onDraftChange: (promptId: string, value: string) => void;
  onSubmitResponse: (promptId: string) => Promise<void>;
}

const formatRoomState = (status: LiveAuntMinnieRoomState['session']['status']) =>
  status === 'draft'
    ? 'Draft'
    : status === 'live'
      ? 'Live'
      : status === 'completed'
        ? 'Ended'
        : 'Closed';

const LiveAuntMinnieParticipantView: React.FC<LiveAuntMinnieParticipantViewProps> = ({
  currentUserId,
  draftResponsesByPromptId,
  roomState,
  submittingPromptIds,
  onDraftChange,
  onSubmitResponse,
}) => (
  <div className="space-y-4">
    <section className="sticky top-3 z-10 rounded-[26px] border border-white/10 bg-[#101b26]/95 p-3 backdrop-blur sm:p-4">
      <div className="flex items-center justify-between gap-3">
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
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          {roomState.onlineParticipantIds.length} online
        </span>
      </div>
    </section>

    <LiveAuntMinnieQuestionFeed
      canAnswer={roomState.session.status !== 'draft'}
      currentUserId={currentUserId}
      draftResponsesByPromptId={draftResponsesByPromptId}
      onDraftChange={onDraftChange}
      onSubmitResponse={onSubmitResponse}
      roomState={roomState}
      submittingPromptIds={submittingPromptIds}
    />
  </div>
);

export default LiveAuntMinnieParticipantView;
