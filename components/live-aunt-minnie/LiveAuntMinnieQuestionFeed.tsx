import React from 'react';
import { LiveAuntMinniePrompt, LiveAuntMinnieResponse, LiveAuntMinnieRoomState } from '../../types';
import LiveAuntMinnieMessageThread from './LiveAuntMinnieMessageThread';

interface LiveAuntMinnieQuestionFeedProps {
  currentUserId: string | null;
  roomState: LiveAuntMinnieRoomState;
  draftResponsesByPromptId: Record<string, string>;
  submittingPromptIds: Record<string, boolean>;
  canAnswer: boolean;
  canEditPosts?: boolean;
  onDraftChange: (promptId: string, value: string) => void;
  onSubmitResponse: (promptId: string) => Promise<void>;
  onEditPrompt?: (prompt: LiveAuntMinniePrompt) => void;
  onCompose?: () => void;
}

const formatPromptTime = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const hasBeenEdited = (prompt: LiveAuntMinniePrompt) =>
  Boolean(prompt.updated_at && prompt.created_at && prompt.updated_at !== prompt.created_at);

const getAnswerCountLabel = (responses: LiveAuntMinnieResponse[]) =>
  `${responses.length} ${responses.length === 1 ? 'answer' : 'answers'}`;

const LiveAuntMinnieQuestionFeed: React.FC<LiveAuntMinnieQuestionFeedProps> = ({
  currentUserId,
  roomState,
  draftResponsesByPromptId,
  submittingPromptIds,
  canAnswer,
  canEditPosts = false,
  onDraftChange,
  onSubmitResponse,
  onEditPrompt,
  onCompose,
}) => {
  const isReadOnly = roomState.session.status === 'completed' || roomState.session.status === 'cancelled';

  if (roomState.prompts.length === 0) {
    return (
      <section className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-center sm:p-7">
        <p className="text-base font-semibold text-white">
          {roomState.isHost ? 'Post your first question' : 'No questions yet'}
        </p>
        {roomState.isHost && onCompose && (
          <button
            type="button"
            onClick={onCompose}
            className="mt-4 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
          >
            New question
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {roomState.prompts.map((prompt, index) => {
        const responses = roomState.responsesByPromptId[prompt.id] || [];
        const myResponse = roomState.myResponsesByPromptId[prompt.id] || null;

        return (
          <article
            key={prompt.id}
            className="rounded-[28px] border border-white/10 bg-white/[0.03] p-3 shadow-[0_18px_40px_rgba(3,10,18,0.18)] sm:p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-100">
                    TO
                  </span>
                  <span>{formatPromptTime(prompt.created_at)}</span>
                  {hasBeenEdited(prompt) && <span>(edited)</span>}
                </div>
                <p className="mt-2 text-lg font-semibold leading-7 text-white sm:text-xl">
                  {prompt.question_text || `Question ${index + 1}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                  {getAnswerCountLabel(responses)}
                </span>
                {canEditPosts && onEditPrompt && (
                  <button
                    type="button"
                    onClick={() => onEditPrompt(prompt)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
              {prompt.images.map((image, imageIndex) => (
                <figure
                  key={image.id}
                  className="min-w-[85%] snap-start overflow-hidden rounded-[22px] border border-white/10 bg-black/30 sm:min-w-[320px]"
                >
                  <img
                    src={image.image_url}
                    alt={image.caption || `Question ${index + 1} image ${imageIndex + 1}`}
                    className="h-56 w-full object-cover sm:h-72"
                  />
                  {image.caption && (
                    <figcaption className="border-t border-white/10 px-3 py-2 text-sm text-slate-300">
                      {image.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>

            <LiveAuntMinnieMessageThread
              currentUserId={currentUserId}
              draftValue={draftResponsesByPromptId[prompt.id] || ''}
              isReadOnly={isReadOnly}
              isSubmitting={Boolean(submittingPromptIds[prompt.id])}
              myResponse={myResponse}
              canAnswer={canAnswer}
              onDraftChange={(value) => onDraftChange(prompt.id, value)}
              onSubmit={() => onSubmitResponse(prompt.id)}
              responses={responses}
            />
          </article>
        );
      })}
    </div>
  );
};

export default LiveAuntMinnieQuestionFeed;
