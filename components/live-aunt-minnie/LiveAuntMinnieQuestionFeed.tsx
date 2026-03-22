import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const getTouchDistance = (touches: React.TouchList) => {
  if (touches.length < 2) return null;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
};

const clampZoom = (value: number) => Math.min(3, Math.max(1, Number(value.toFixed(2))));

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
  const answersVisible = roomState.isHost || roomState.session.current_phase === 'reveal';
  const [viewerPromptIndex, setViewerPromptIndex] = useState<number | null>(null);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchZoomRef = useRef(1);

  useEffect(() => {
    if (viewerPromptIndex === null || typeof document === 'undefined') {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [viewerPromptIndex]);

  useEffect(() => {
    setImageZoom(1);
    pinchDistanceRef.current = null;
    pinchZoomRef.current = 1;
  }, [viewerPromptIndex, viewerImageIndex]);

  const activePrompt = viewerPromptIndex === null ? null : roomState.prompts[viewerPromptIndex] || null;
  const activeImages = activePrompt?.images || [];

  const closeViewer = () => {
    setViewerPromptIndex(null);
    setViewerImageIndex(0);
    setImageZoom(1);
    pinchDistanceRef.current = null;
    pinchZoomRef.current = 1;
  };

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
    <>
      <div className="space-y-4">
        {roomState.prompts.map((prompt, index) => {
          const allResponses = roomState.responsesByPromptId[prompt.id] || [];
          const myResponse = roomState.myResponsesByPromptId[prompt.id] || null;
          const responses = answersVisible
            ? allResponses
            : myResponse
              ? [myResponse]
              : [];
          const hiddenCount = Math.max(allResponses.length - responses.length, 0);
          const visibilityHint = !answersVisible && !roomState.isHost
            ? hiddenCount > 0
              ? `${hiddenCount} hidden`
              : 'Answers hidden'
            : null;

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
                    {getAnswerCountLabel(allResponses)}
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
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => {
                      setViewerPromptIndex(index);
                      setViewerImageIndex(imageIndex);
                    }}
                    className="min-w-[85%] snap-start overflow-hidden rounded-[22px] border border-white/10 bg-black/30 text-left sm:min-w-[320px]"
                  >
                    <img
                      src={image.image_url}
                      alt={image.caption || `Question ${index + 1} image ${imageIndex + 1}`}
                      className="h-56 w-full object-cover sm:h-72"
                    />
                    {image.caption && (
                      <div className="border-t border-white/10 px-3 py-2 text-sm text-slate-300">
                        {image.caption}
                      </div>
                    )}
                  </button>
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

              {visibilityHint && (
                <p className="mt-2 px-1 text-xs text-slate-500">{visibilityHint}</p>
              )}
            </article>
          );
        })}
      </div>

      {activePrompt && activeImages[viewerImageIndex] && (
        <div className="fixed inset-0 z-40 bg-slate-950/95">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <span>{viewerImageIndex + 1}/{activeImages.length}</span>
                {activeImages[viewerImageIndex].caption && (
                  <span className="truncate">{activeImages[viewerImageIndex].caption}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImageZoom(1)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200"
                >
                  {Math.round(imageZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={closeViewer}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 py-4"
              style={{ touchAction: 'none' }}
              onWheel={(event) => {
                if (!event.ctrlKey && !event.metaKey) return;
                event.preventDefault();
                setImageZoom((previous) => clampZoom(previous + (event.deltaY < 0 ? 0.2 : -0.2)));
              }}
              onTouchStart={(event) => {
                const distance = getTouchDistance(event.touches);
                if (distance === null) return;
                pinchDistanceRef.current = distance;
                pinchZoomRef.current = imageZoom;
              }}
              onTouchMove={(event) => {
                const distance = getTouchDistance(event.touches);
                if (distance === null || pinchDistanceRef.current === null) return;
                event.preventDefault();
                const scaleRatio = distance / pinchDistanceRef.current;
                setImageZoom(clampZoom(pinchZoomRef.current * scaleRatio));
              }}
              onTouchEnd={() => {
                if (pinchDistanceRef.current === null) return;
                pinchDistanceRef.current = null;
                pinchZoomRef.current = imageZoom;
              }}
            >
              <img
                src={activeImages[viewerImageIndex].image_url}
                alt={activeImages[viewerImageIndex].caption || 'Question image'}
                className="max-h-full max-w-full select-none object-contain transition-transform duration-200 ease-out"
                style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center center' }}
                draggable={false}
              />

              {activeImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setViewerImageIndex((previous) => (previous === 0 ? activeImages.length - 1 : previous - 1))}
                    className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white"
                    aria-label="Previous image"
                  >
                    <span className="material-icons text-[22px]">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewerImageIndex((previous) => (previous === activeImages.length - 1 ? 0 : previous + 1))}
                    className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white"
                    aria-label="Next image"
                  >
                    <span className="material-icons text-[22px]">chevron_right</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveAuntMinnieQuestionFeed;
