import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiveAuntMinnieParticipant, LiveAuntMinniePrompt, LiveAuntMinnieResponse, LiveAuntMinnieRoomState, LiveAuntMinnieSyncState } from '../../types';
import LiveAuntMinnieMessageThread from './LiveAuntMinnieMessageThread';
import {
  IMAGE_DISMISS_SWIPE_THRESHOLD_PX,
  IMAGE_DOUBLE_TAP_DELAY_MS,
  IMAGE_SWIPE_THRESHOLD_PX,
  IMAGE_SWIPE_VERTICAL_TOLERANCE_PX,
} from '../../utils/mobileGestures';

interface LiveAuntMinnieQuestionFeedProps {
  currentUserId: string | null;
  roomState: LiveAuntMinnieRoomState;
  draftResponsesByPromptId: Record<string, string>;
  responseStatusByPromptId?: Record<string, 'typing' | 'saving' | 'saved' | 'retry failed'>;
  submittingPromptIds: Record<string, boolean>;
  busyAction?: string | null;
  canAnswer: boolean;
  answerMode?: 'editable' | 'locked-summary' | 'host-review';
  syncState?: LiveAuntMinnieSyncState;
  answerKeyDrafts?: Record<string, string>;
  canEditCorrectAnswers?: boolean;
  canEditPosts?: boolean;
  onDraftChange: (promptId: string, value: string) => void;
  onSaveCorrectAnswer?: (promptId: string, value: string) => Promise<void>;
  onSubmitResponse: (promptId: string, value?: string) => Promise<void>;
  onEditPrompt?: (prompt: LiveAuntMinniePrompt) => void;
  onCompose?: () => void;
}

const formatPromptTimestamp = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
};

const responseListSignature = (responses: LiveAuntMinnieResponse[]) =>
  responses
    .map((response) => `${response.id}:${response.updated_at || response.submitted_at}:${response.response_text}`)
    .join('|');

const buildParticipantResponses = (
  promptId: string,
  participants: LiveAuntMinnieParticipant[],
  responses: LiveAuntMinnieResponse[],
) => {
  const responsesByUserId = new Map(responses.map((response) => [response.user_id, response]));

  return participants
    .filter((participant) => participant.role !== 'host')
    .map((participant) => {
      const existingResponse = responsesByUserId.get(participant.user_id);
      if (existingResponse) {
        return existingResponse;
      }

      return {
        id: `missing:${promptId}:${participant.user_id}`,
        session_id: participant.session_id,
        prompt_id: promptId,
        user_id: participant.user_id,
        response_text: 'No answer',
        judgment: 'unreviewed',
        consultant_note: null,
        submitted_at: participant.joined_at,
        updated_at: participant.last_seen_at || participant.joined_at,
        reviewed_at: null,
        reviewed_by: null,
        participant: participant.profile || null,
      } satisfies LiveAuntMinnieResponse;
    })
    .sort((left, right) => new Date(left.submitted_at).getTime() - new Date(right.submitted_at).getTime());
};

const getTouchDistance = (touches: React.TouchList) => {
  if (touches.length < 2) return null;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
};

const clampZoom = (value: number) => Math.min(3, Math.max(1, Number(value.toFixed(2))));

interface LiveAuntMinniePromptCardProps {
  prompt: LiveAuntMinniePrompt;
  promptNumber: number;
  currentUserId: string | null;
  responses: LiveAuntMinnieResponse[];
  myResponse: LiveAuntMinnieResponse | null;
  draftValue: string;
  responseStatus?: 'typing' | 'saving' | 'saved' | 'retry failed';
  isSubmitting: boolean;
  isReadOnly: boolean;
  canAnswer: boolean;
  answerMode: 'editable' | 'locked-summary' | 'host-review';
  syncState?: LiveAuntMinnieSyncState;
  canEditCorrectAnswers: boolean;
  isSavingCorrectAnswer: boolean;
  canEditPosts: boolean;
  onEditPrompt?: (prompt: LiveAuntMinniePrompt) => void;
  onDraftChange: (promptId: string, value: string) => void;
  onSaveCorrectAnswer?: (promptId: string, value: string) => Promise<void>;
  onSubmitResponse: (promptId: string, value?: string) => Promise<void>;
  onOpenViewer: (promptIndex: number, imageIndex: number) => void;
}

const LiveAuntMinniePromptCard: React.FC<LiveAuntMinniePromptCardProps> = ({
  prompt,
  promptNumber,
  currentUserId,
  responses,
  myResponse,
  draftValue,
  responseStatus,
  isSubmitting,
  isReadOnly,
  canAnswer,
  answerMode,
  syncState,
  canEditCorrectAnswers,
  isSavingCorrectAnswer,
  canEditPosts,
  onEditPrompt,
  onDraftChange,
  onSaveCorrectAnswer,
  onSubmitResponse,
  onOpenViewer,
}) => (
  <article
    className="rounded-[26px] border border-white/10 bg-white/[0.03] p-3 shadow-[0_18px_40px_rgba(3,10,18,0.18)] sm:p-4"
    style={{ contentVisibility: 'auto', containIntrinsicSize: '780px' }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded-[14px] border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Question {promptNumber}
          </span>
          {prompt.created_at && <span>{formatPromptTimestamp(prompt.created_at)}</span>}
        </div>
        <p className="mt-2 text-lg font-semibold leading-7 text-white sm:text-xl">
          {prompt.question_text || `Question ${promptNumber}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {canEditPosts && onEditPrompt && (
          <button
            type="button"
            onClick={() => onEditPrompt(prompt)}
            className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label={`Edit Question ${promptNumber}`}
            title={`Edit Question ${promptNumber}`}
          >
            <span className="material-icons text-[18px]">edit</span>
          </button>
        )}
      </div>
    </div>

    <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
      {prompt.images.map((image, imageIndex) => (
        <button
          key={image.id}
          type="button"
          onClick={() => onOpenViewer(promptNumber - 1, imageIndex)}
          className="min-w-[85%] snap-start overflow-hidden rounded-[20px] border border-white/10 bg-black/30 text-left sm:min-w-[320px]"
        >
          <div className="relative">
            <div className="aspect-[4/3] w-full bg-slate-900/60" />
            <img
              src={image.image_url}
              alt={image.caption || `Question ${promptNumber} image ${imageIndex + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
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
      draftValue={draftValue}
      isReadOnly={isReadOnly}
      isSubmitting={isSubmitting}
      myResponse={myResponse}
      canAnswer={canAnswer}
      answerMode={answerMode}
      responseStatus={responseStatus}
      syncState={syncState}
      correctAnswer={prompt.official_answer}
      canEditCorrectAnswer={canEditCorrectAnswers}
      isSavingCorrectAnswer={isSavingCorrectAnswer}
      onSaveCorrectAnswer={(value) => onSaveCorrectAnswer?.(prompt.id, value)}
      onDraftChange={(value) => onDraftChange(prompt.id, value)}
      onSubmit={(value) => onSubmitResponse(prompt.id, value)}
      responses={responses}
    />
  </article>
);

const MemoizedLiveAuntMinniePromptCard = React.memo(
  LiveAuntMinniePromptCard,
  (previous, next) =>
    previous.prompt.id === next.prompt.id
    && previous.prompt.updated_at === next.prompt.updated_at
    && previous.prompt.question_text === next.prompt.question_text
    && previous.prompt.images.length === next.prompt.images.length
    && previous.promptNumber === next.promptNumber
    && previous.draftValue === next.draftValue
    && previous.responseStatus === next.responseStatus
    && previous.isSubmitting === next.isSubmitting
    && previous.isReadOnly === next.isReadOnly
    && previous.canAnswer === next.canAnswer
    && previous.answerMode === next.answerMode
    && previous.syncState === next.syncState
    && previous.canEditCorrectAnswers === next.canEditCorrectAnswers
    && previous.isSavingCorrectAnswer === next.isSavingCorrectAnswer
    && previous.canEditPosts === next.canEditPosts
    && (previous.myResponse?.id || null) === (next.myResponse?.id || null)
    && (previous.myResponse?.updated_at || previous.myResponse?.submitted_at || null)
      === (next.myResponse?.updated_at || next.myResponse?.submitted_at || null)
    && responseListSignature(previous.responses) === responseListSignature(next.responses),
);

const LiveAuntMinnieQuestionFeed: React.FC<LiveAuntMinnieQuestionFeedProps> = ({
  currentUserId,
  roomState,
  draftResponsesByPromptId,
  responseStatusByPromptId,
  submittingPromptIds,
  busyAction,
  canAnswer,
  answerMode,
  syncState,
  answerKeyDrafts,
  canEditCorrectAnswers = false,
  canEditPosts = false,
  onDraftChange,
  onSaveCorrectAnswer,
  onSubmitResponse,
  onEditPrompt,
  onCompose,
}) => {
  const isReadOnly = roomState.session.status !== 'live';
  const resolvedAnswerMode =
    answerMode
    || (roomState.isHost ? 'host-review' : canAnswer ? 'editable' : 'locked-summary');
  const [viewerPromptIndex, setViewerPromptIndex] = useState<number | null>(null);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isGestureActive, setIsGestureActive] = useState(false);
  const viewerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const lastTapAtRef = useRef(0);
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchZoomRef = useRef(1);
  const pinchCenterRef = useRef({ x: 0, y: 0 });
  const pinchStartOffsetRef = useRef({ x: 0, y: 0 });
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const touchCurrentYRef = useRef<number | null>(null);
  const touchModeRef = useRef<'idle' | 'swipe' | 'pinch' | 'pan' | 'dismiss'>('idle');
  const panStartOffsetRef = useRef({ x: 0, y: 0 });

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
    setImageOffset({ x: 0, y: 0 });
    setIsGestureActive(false);
    pinchDistanceRef.current = null;
    pinchZoomRef.current = 1;
    pinchCenterRef.current = { x: 0, y: 0 };
    pinchStartOffsetRef.current = { x: 0, y: 0 };
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchCurrentXRef.current = null;
    touchCurrentYRef.current = null;
    touchModeRef.current = 'idle';
    lastTapAtRef.current = 0;
  }, [viewerPromptIndex, viewerImageIndex]);

  const activePrompt = viewerPromptIndex === null ? null : roomState.prompts[viewerPromptIndex] || null;
  const activeImages = activePrompt?.images || [];

  const closeViewer = () => {
    setViewerPromptIndex(null);
    setViewerImageIndex(0);
    setImageZoom(1);
    setImageOffset({ x: 0, y: 0 });
    setIsGestureActive(false);
    pinchDistanceRef.current = null;
    pinchZoomRef.current = 1;
    pinchCenterRef.current = { x: 0, y: 0 };
    pinchStartOffsetRef.current = { x: 0, y: 0 };
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchCurrentXRef.current = null;
    touchCurrentYRef.current = null;
    touchModeRef.current = 'idle';
    lastTapAtRef.current = 0;
  };

  const showPreviousViewerImage = () => {
    if (activeImages.length <= 1) return;
    setViewerImageIndex((previous) => (previous === 0 ? activeImages.length - 1 : previous - 1));
  };

  const showNextViewerImage = () => {
    if (activeImages.length <= 1) return;
    setViewerImageIndex((previous) => (previous === activeImages.length - 1 ? 0 : previous + 1));
  };

  const clampImageOffset = (offset: { x: number; y: number }, zoom: number) => {
    const surface = viewerSurfaceRef.current;
    if (!surface || zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const rect = surface.getBoundingClientRect();
    const maxX = ((zoom - 1) * rect.width) / 2;
    const maxY = ((zoom - 1) * rect.height) / 2;

    return {
      x: Math.min(maxX, Math.max(-maxX, offset.x)),
      y: Math.min(maxY, Math.max(-maxY, offset.y)),
    };
  };

  const applyEdgeResistance = (offset: { x: number; y: number }, zoom: number) => {
    const surface = viewerSurfaceRef.current;
    if (!surface || zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const rect = surface.getBoundingClientRect();
    const maxX = ((zoom - 1) * rect.width) / 2;
    const maxY = ((zoom - 1) * rect.height) / 2;

    const soften = (value: number, max: number) => {
      if (value > max) return max + (value - max) * 0.2;
      if (value < -max) return -max + (value + max) * 0.2;
      return value;
    };

    return {
      x: soften(offset.x, maxX),
      y: soften(offset.y, maxY),
    };
  };

  const getSurfaceRelativePoint = (clientX: number, clientY: number) => {
    const surface = viewerSurfaceRef.current;
    if (!surface) return { x: 0, y: 0 };

    const rect = surface.getBoundingClientRect();
    return {
      x: clientX - (rect.left + rect.width / 2),
      y: clientY - (rect.top + rect.height / 2),
    };
  };

  const getZoomedOffsetForPoint = (
    point: { x: number; y: number },
    startZoom: number,
    targetZoom: number,
    startOffset: { x: number; y: number },
  ) => {
    if (targetZoom <= 1 || startZoom <= 0) {
      return { x: 0, y: 0 };
    }

    return clampImageOffset({
      x: point.x - ((point.x - startOffset.x) / startZoom) * targetZoom,
      y: point.y - ((point.y - startOffset.y) / startZoom) * targetZoom,
    }, targetZoom);
  };

  const zoomViewerAtPoint = (clientX: number, clientY: number, targetZoom: number) => {
    const point = getSurfaceRelativePoint(clientX, clientY);
    const nextZoom = clampZoom(targetZoom);

    setImageZoom(nextZoom);
    setImageOffset((previous) =>
      getZoomedOffsetForPoint(point, imageZoom, nextZoom, previous),
    );
  };

  useEffect(() => {
    setImageOffset((previous) => clampImageOffset(previous, imageZoom));
  }, [imageZoom]);

  const visiblePrompts = useMemo(
    () => roomState.prompts,
    [roomState.prompts],
  );

  const promptViewModels = useMemo(() => {
    return visiblePrompts.map((prompt, index) => {
      const myResponse = roomState.myResponsesByPromptId[prompt.id] || null;
      const shouldShowAllParticipantResponses = isReadOnly || roomState.isHost;
      const allResponses = roomState.responsesByPromptId[prompt.id] || [];
      const responses = shouldShowAllParticipantResponses
        ? buildParticipantResponses(prompt.id, roomState.participants, allResponses)
        : myResponse
          ? [myResponse]
          : [];

      return {
        prompt,
        promptNumber: index + 1,
        draftValue: draftResponsesByPromptId[prompt.id] || '',
        myResponse,
        responses,
        responseStatus: responseStatusByPromptId?.[prompt.id],
        isSubmitting: Boolean(submittingPromptIds[prompt.id]),
      };
    });
  }, [
    visiblePrompts,
    roomState.myResponsesByPromptId,
    roomState.responsesByPromptId,
    roomState.participants,
    roomState.isHost,
    isReadOnly,
    draftResponsesByPromptId,
    responseStatusByPromptId,
    submittingPromptIds,
  ]);

  useEffect(() => {
    const currentPrompt = roomState.prompts[roomState.session.current_prompt_index];
    const currentImage = currentPrompt?.images[0]?.image_url;
    if (!currentImage) return;

    const heroImage = new Image();
    heroImage.decoding = 'async';
    heroImage.src = currentImage;
    heroImage.onload = () => {
      currentPrompt.images.slice(1, 3).forEach((image) => {
        const nextImage = new Image();
        nextImage.decoding = 'async';
        nextImage.src = image.image_url;
      });
    };
  }, [roomState.prompts, roomState.session.current_prompt_index]);

  const viewerContent = activePrompt && activeImages[viewerImageIndex] ? (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/95"
      onClick={closeViewer}
      role="presentation"
    >
      <div className="flex h-full flex-col">
        <div
          className="flex items-start justify-between gap-3 px-4 py-4"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <span>Q{(viewerPromptIndex || 0) + 1}</span>
              <span>{viewerImageIndex + 1}/{activeImages.length}</span>
            </div>
            {activeImages[viewerImageIndex].caption && (
              <p className="mt-1 truncate text-xs text-slate-400">
                {activeImages[viewerImageIndex].caption}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setImageZoom(1);
                setImageOffset({ x: 0, y: 0 });
              }}
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
          ref={viewerSurfaceRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 py-4"
          style={{ touchAction: 'none' }}
          onWheel={(event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            const nextZoom = clampZoom(imageZoom + (event.deltaY < 0 ? 0.2 : -0.2));
            const point = getSurfaceRelativePoint(event.clientX, event.clientY);
            setImageZoom(nextZoom);
            setImageOffset((previous) => getZoomedOffsetForPoint(point, imageZoom, nextZoom, previous));
          }}
          onTouchStart={(event) => {
            if (event.touches.length >= 2) {
              const distance = getTouchDistance(event.touches);
              if (distance === null) return;
              touchModeRef.current = 'pinch';
              setIsGestureActive(true);
              pinchDistanceRef.current = distance;
              pinchZoomRef.current = imageZoom;
              pinchStartOffsetRef.current = imageOffset;
              pinchCenterRef.current = getSurfaceRelativePoint(
                (event.touches[0].clientX + event.touches[1].clientX) / 2,
                (event.touches[0].clientY + event.touches[1].clientY) / 2,
              );
              touchStartXRef.current = null;
              touchStartYRef.current = null;
              touchCurrentXRef.current = null;
              touchCurrentYRef.current = null;
              return;
            }

            if (event.touches.length === 1) {
              const tapAt = Date.now();
              if (tapAt - lastTapAtRef.current <= IMAGE_DOUBLE_TAP_DELAY_MS) {
                event.preventDefault();
                const targetZoom = imageZoom > 1.4 ? 1 : 2;
                zoomViewerAtPoint(
                  event.touches[0].clientX,
                  event.touches[0].clientY,
                  targetZoom,
                );
                lastTapAtRef.current = 0;
                touchModeRef.current = 'idle';
                touchStartXRef.current = null;
                touchStartYRef.current = null;
                touchCurrentXRef.current = null;
                touchCurrentYRef.current = null;
                return;
              }

              lastTapAtRef.current = tapAt;
              touchModeRef.current = imageZoom > 1.05 ? 'pan' : 'swipe';
              setIsGestureActive(imageZoom > 1.05);
              touchStartXRef.current = event.touches[0].clientX;
              touchStartYRef.current = event.touches[0].clientY;
              touchCurrentXRef.current = event.touches[0].clientX;
              touchCurrentYRef.current = event.touches[0].clientY;
              panStartOffsetRef.current = imageOffset;
            }
          }}
          onTouchMove={(event) => {
            if (event.touches.length >= 2) {
              const distance = getTouchDistance(event.touches);
              if (distance === null || pinchDistanceRef.current === null) return;
              touchModeRef.current = 'pinch';
              event.preventDefault();
              const scaleRatio = distance / pinchDistanceRef.current;
              const nextZoom = clampZoom(pinchZoomRef.current * scaleRatio);
              setImageZoom(nextZoom);
              setImageOffset(
                getZoomedOffsetForPoint(
                  pinchCenterRef.current,
                  pinchZoomRef.current,
                  nextZoom,
                  pinchStartOffsetRef.current,
                ),
              );
              return;
            }

            if (touchModeRef.current === 'pan' && event.touches.length === 1) {
              const startX = touchStartXRef.current;
              const startY = touchStartYRef.current;
              if (startX === null || startY === null) return;
              event.preventDefault();
              const deltaX = event.touches[0].clientX - startX;
              const deltaY = event.touches[0].clientY - startY;
              setImageOffset(
                applyEdgeResistance({
                  x: panStartOffsetRef.current.x + deltaX,
                  y: panStartOffsetRef.current.y + deltaY,
                }, imageZoom),
              );
              touchCurrentXRef.current = event.touches[0].clientX;
              touchCurrentYRef.current = event.touches[0].clientY;
              return;
            }

            if (touchModeRef.current === 'swipe' && event.touches.length === 1) {
              touchCurrentXRef.current = event.touches[0].clientX;
              touchCurrentYRef.current = event.touches[0].clientY;

              const startX = touchStartXRef.current;
              const startY = touchStartYRef.current;
              if (startX === null || startY === null || imageZoom > 1.05) return;

              const deltaX = touchCurrentXRef.current - startX;
              const deltaY = touchCurrentYRef.current - startY;
              if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0) {
                touchModeRef.current = 'dismiss';
                event.preventDefault();
                return;
              }
              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                event.preventDefault();
              }
              return;
            }

            if (touchModeRef.current === 'dismiss' && event.touches.length === 1) {
              touchCurrentXRef.current = event.touches[0].clientX;
              touchCurrentYRef.current = event.touches[0].clientY;
              event.preventDefault();
            }
          }}
          onTouchEnd={() => {
            if (touchModeRef.current === 'pinch') {
              pinchDistanceRef.current = null;
              pinchZoomRef.current = imageZoom;
              setIsGestureActive(false);
              touchModeRef.current = 'idle';
              return;
            }

            if (touchModeRef.current === 'pan') {
              setIsGestureActive(false);
              setImageOffset((previous) => clampImageOffset(previous, imageZoom));
            }

            if (touchModeRef.current === 'swipe') {
              const startX = touchStartXRef.current;
              const startY = touchStartYRef.current;
              const endX = touchCurrentXRef.current;
              const endY = touchCurrentYRef.current;

              if (startX !== null && startY !== null && endX !== null && endY !== null && imageZoom <= 1.05) {
                const deltaX = endX - startX;
                const deltaY = endY - startY;
                const horizontalSwipe = Math.abs(deltaX) >= IMAGE_SWIPE_THRESHOLD_PX;
                const verticalEnough = Math.abs(deltaY) <= IMAGE_SWIPE_VERTICAL_TOLERANCE_PX;

                if (horizontalSwipe && verticalEnough) {
                  if (deltaX < 0) {
                    showNextViewerImage();
                  } else {
                    showPreviousViewerImage();
                  }
                }
              }
            }

            if (touchModeRef.current === 'dismiss') {
              const startY = touchStartYRef.current;
              const endY = touchCurrentYRef.current;
              if (startY !== null && endY !== null && endY - startY >= IMAGE_DISMISS_SWIPE_THRESHOLD_PX && imageZoom <= 1.05) {
                closeViewer();
                return;
              }
            }

            pinchDistanceRef.current = null;
            pinchZoomRef.current = imageZoom;
            touchStartXRef.current = null;
            touchStartYRef.current = null;
            touchCurrentXRef.current = null;
            touchCurrentYRef.current = null;
            touchModeRef.current = 'idle';
          }}
        >
          <img
            src={activeImages[viewerImageIndex].image_url}
            alt={activeImages[viewerImageIndex].caption || 'Question image'}
            className={`max-h-full max-w-full select-none object-contain ${isGestureActive ? '' : 'transition-transform duration-150 ease-out'}`}
            style={{
              transform: `translate3d(${imageOffset.x}px, ${imageOffset.y}px, 0) scale(${imageZoom})`,
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
            draggable={false}
            decoding="async"
            onClick={(event) => event.stopPropagation()}
          />

          {activeImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showPreviousViewerImage();
                }}
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white"
                aria-label="Previous image"
              >
                <span className="material-icons text-[22px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextViewerImage();
                }}
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white"
                aria-label="Next image"
              >
                <span className="material-icons text-[22px]">chevron_right</span>
              </button>
            </>
          )}

          {activeImages.length > 1 && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-5 flex items-center justify-center gap-2 sm:hidden"
              onClick={(event) => event.stopPropagation()}
            >
              {activeImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setViewerImageIndex(index);
                  }}
                  className={`pointer-events-auto h-2 rounded-full transition-all ${
                    index === viewerImageIndex ? 'w-5 bg-white' : 'w-2 bg-white/35'
                  }`}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  if (roomState.prompts.length === 0) {
    const isSyncingPrompts = roomState.session.prompt_count > 0;
    return (
      <section className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-center sm:p-7">
        {isSyncingPrompts ? (
          <div className="space-y-4 text-left">
            <div className="mx-auto h-4 w-36 animate-pulse rounded-full bg-white/10" />
            <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.02] p-4">
              <div className="h-4 w-24 animate-pulse rounded-full bg-cyan-500/20" />
              <div className="h-7 w-3/4 animate-pulse rounded-2xl bg-white/10" />
              <div className="aspect-[4/3] w-full animate-pulse rounded-[20px] bg-slate-900/70" />
              <div className="h-20 w-full animate-pulse rounded-[18px] bg-white/5" />
            </div>
          </div>
        ) : (
          <p className="text-base font-semibold text-white">
            {roomState.isHost ? 'Post your first question' : 'No questions yet'}
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {promptViewModels.map(({ prompt, promptNumber, draftValue, myResponse, responses, responseStatus, isSubmitting }) => {
          return (
            <MemoizedLiveAuntMinniePromptCard
              key={prompt.id}
              canAnswer={canAnswer}
              canEditCorrectAnswers={canEditCorrectAnswers}
              isSavingCorrectAnswer={busyAction === `save-answer-key:${prompt.id}`}
              canEditPosts={canEditPosts}
              currentUserId={currentUserId}
              draftValue={draftValue}
              responseStatus={responseStatus}
              answerMode={resolvedAnswerMode}
              isReadOnly={isReadOnly}
              isSubmitting={isSubmitting}
              myResponse={myResponse}
              onDraftChange={onDraftChange}
              onEditPrompt={onEditPrompt}
              onOpenViewer={(promptIndex, imageIndex) => {
                setViewerPromptIndex(promptIndex);
                setViewerImageIndex(imageIndex);
              }}
              onSaveCorrectAnswer={onSaveCorrectAnswer}
              onSubmitResponse={onSubmitResponse}
              prompt={prompt}
              promptNumber={promptNumber}
              responses={responses}
              syncState={syncState}
            />
          );
        })}
      </div>

      {viewerContent && typeof document !== 'undefined' ? createPortal(viewerContent, document.body) : null}
    </>
  );
};

export default LiveAuntMinnieQuestionFeed;
