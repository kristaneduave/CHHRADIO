import React, { useEffect, useMemo, useState } from 'react';
import { LiveAuntMinnieResponse, LiveAuntMinnieSyncState } from '../../types';

interface LiveAuntMinnieMessageThreadProps {
  currentUserId: string | null;
  draftValue: string;
  isReadOnly: boolean;
  isSubmitting: boolean;
  myResponse: LiveAuntMinnieResponse | null;
  canAnswer: boolean;
  answerMode: 'editable' | 'locked-summary' | 'host-review';
  responseStatus?: 'typing' | 'saving' | 'saved' | 'retry failed';
  syncState?: LiveAuntMinnieSyncState;
  correctAnswer?: string | null;
  canEditCorrectAnswer?: boolean;
  isSavingCorrectAnswer?: boolean;
  onSaveCorrectAnswer?: (value: string) => Promise<void> | void;
  responses: LiveAuntMinnieResponse[];
  onDraftChange: (value: string) => void;
  onSubmit: (value?: string) => Promise<void>;
}

const displayName = (response: LiveAuntMinnieResponse) =>
  response.participant?.nickname || response.participant?.full_name || 'Resident';

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'R';

const responseListSignature = (responses: LiveAuntMinnieResponse[]) =>
  responses
    .map((response) => `${response.id}:${response.updated_at || response.submitted_at}:${response.response_text}`)
    .join('|');

const sanitizeEditableCorrectAnswer = (value?: string | null) => {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  if (trimmed === 'Pending correct answer' || trimmed === 'Pending TO answer') return '';
  if (/^RAD-\d+$/i.test(trimmed)) return '';
  return trimmed;
};

const LiveAuntMinnieMessageThread: React.FC<LiveAuntMinnieMessageThreadProps> = ({
  currentUserId,
  draftValue,
  isReadOnly,
  isSubmitting,
  myResponse,
  canAnswer,
  answerMode,
  responseStatus,
  syncState,
  correctAnswer,
  canEditCorrectAnswer = false,
  isSavingCorrectAnswer = false,
  onSaveCorrectAnswer,
  responses,
  onDraftChange,
  onSubmit,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showOtherAnswers, setShowOtherAnswers] = useState(false);
  const normalizedCorrectAnswer = sanitizeEditableCorrectAnswer(correctAnswer);
  const [correctAnswerDraft, setCorrectAnswerDraft] = useState(normalizedCorrectAnswer);
  const [isEditingCorrectAnswer, setIsEditingCorrectAnswer] = useState(!Boolean(normalizedCorrectAnswer));
  const [showCorrectAnswerSaved, setShowCorrectAnswerSaved] = useState(false);
  const sortedResponses = useMemo(
    () =>
      [...responses].sort(
        (left, right) =>
          new Date(left.submitted_at).getTime() - new Date(right.submitted_at).getTime(),
      ),
    [responses],
  );
  const otherResponses = useMemo(
    () => sortedResponses.filter((response) => response.user_id !== currentUserId),
    [currentUserId, sortedResponses],
  );
  const showCompletedAnswers = isReadOnly;
  const visibleOtherResponses = showCompletedAnswers || expanded ? otherResponses : otherResponses.slice(0, 5);
  const hasOverflow = otherResponses.length > 5;
  const savedValue = (myResponse?.response_text || '').trim();
  const currentValue = draftValue.trim();
  const isDirty = currentValue !== savedValue;
  const statusLabel = (() => {
    if (isSubmitting || responseStatus === 'saving') return 'Saving...';
    if (responseStatus === 'retry failed') return 'Retry failed';
    if ((syncState === 'reconnecting' || syncState === 'degraded') && isDirty) return 'Reconnecting...';
    if (responseStatus === 'typing' || isDirty) return 'Typing...';
    if (responseStatus === 'saved' || savedValue) return 'Saved';
    return 'Not submitted yet';
  })();

  useEffect(() => {
    if (!isEditingCorrectAnswer) {
      setCorrectAnswerDraft(normalizedCorrectAnswer);
    }
  }, [isEditingCorrectAnswer, normalizedCorrectAnswer]);

  useEffect(() => {
    if (normalizedCorrectAnswer) {
      setIsEditingCorrectAnswer(false);
      setShowCorrectAnswerSaved(true);
    }
  }, [normalizedCorrectAnswer]);

  useEffect(() => {
    if (!showCorrectAnswerSaved) return;
    const timer = window.setTimeout(() => setShowCorrectAnswerSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [showCorrectAnswerSaved]);

  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-3 sm:p-4">
      {answerMode === 'editable' && !isReadOnly && canAnswer ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Your answer</p>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                statusLabel === 'Saving...'
                  ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                  : statusLabel === 'Retry failed'
                    ? 'border-rose-400/20 bg-rose-500/10 text-rose-100'
                    : statusLabel === 'Typing...' || statusLabel === 'Reconnecting...'
                    ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                    : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
              }`}
            >
              {statusLabel}
            </span>
          </div>

          {savedValue && (
            <div className="border-l-2 border-cyan-400/30 pl-3 text-sm text-slate-300">
              <span className="whitespace-pre-wrap break-words">{savedValue}</span>
            </div>
          )}

          <div>
            <textarea
              value={draftValue}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={myResponse ? 'Update your answer' : 'Type your answer'}
              disabled={isSubmitting}
              className="min-h-[72px] w-full rounded-[16px] border border-white/10 bg-black/25 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-2 text-xs text-slate-500">
              Drafts stay on this device until you submit.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onSubmit(draftValue)}
              disabled={isSubmitting || (!isDirty && !(savedValue && currentValue === '')) || (!currentValue && !savedValue)}
              className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : savedValue ? 'Update answer' : 'Submit answer'}
            </button>
          </div>
        </div>
      ) : savedValue ? (
        <div className="border-l-2 border-cyan-400/30 pl-3 text-sm text-slate-300">
          <span className="font-semibold text-white">Your answer:</span>{' '}
          <span className="whitespace-pre-wrap break-words">{savedValue}</span>
        </div>
      ) : answerMode === 'locked-summary' ? (
        <div className="border-l-2 border-white/10 pl-3 text-sm text-slate-400">
          No answer submitted
        </div>
      ) : null}

      {(canEditCorrectAnswer || normalizedCorrectAnswer) ? (
        <div className="mt-3 rounded-[18px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">Correct answer</p>
          {canEditCorrectAnswer ? (
            isEditingCorrectAnswer || !normalizedCorrectAnswer ? (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={correctAnswerDraft}
                  onChange={(event) => {
                    setCorrectAnswerDraft(event.target.value);
                  }}
                  placeholder="Place answer here"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/30"
                />
                <button
                  type="button"
                  disabled={isSavingCorrectAnswer}
                  onClick={() => void onSaveCorrectAnswer?.(correctAnswerDraft)}
                  className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingCorrectAnswer ? 'Saving...' : 'Save'}
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm font-semibold text-white">{normalizedCorrectAnswer}</p>
                <div className="flex items-center gap-2">
                  {showCorrectAnswerSaved && (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                      Saved
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCorrectAnswerDraft(normalizedCorrectAnswer);
                      setIsEditingCorrectAnswer(true);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="mt-2 text-sm font-semibold text-white">{normalizedCorrectAnswer}</p>
          )}
        </div>
      ) : null}

      {otherResponses.length > 0 ? (
        <div>
          {showCompletedAnswers ? (
            <div className="mt-3">
              <p className="text-sm font-semibold text-white">Submitted answers</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowOtherAnswers((previous) => !previous)}
              className="relative flex h-10 w-full items-center justify-center text-center transition hover:text-white"
            >
              <p className="text-sm font-semibold text-white">
                {showOtherAnswers ? 'Hide all submitted answers' : 'Show all submitted answers'}
              </p>
              <span className="material-icons absolute right-0 text-[20px] text-slate-400">
                {showOtherAnswers ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          )}

          {(showCompletedAnswers || showOtherAnswers) && (
            <div className="mt-3 divide-y divide-white/10">
              {visibleOtherResponses.map((response) => (
                <div
                  key={response.id}
                  className="flex items-center gap-2.5 py-3 text-sm text-slate-100"
                >
                  {response.participant?.avatar_url ? (
                    <img
                      src={response.participant.avatar_url}
                      alt={displayName(response)}
                      className="h-8 w-8 rounded-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-slate-200">
                      {initialsFromName(displayName(response))}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 leading-5">
                    <span className="font-semibold text-white align-middle">
                      {displayName(response)}
                    </span>
                    <span className="text-slate-500">: </span>
                    <span className="whitespace-pre-wrap break-words text-slate-300 align-middle">
                      {response.response_text}
                    </span>
                  </div>
                </div>
              ))}

              {hasOverflow && !showCompletedAnswers && (
                <button
                  type="button"
                  onClick={() => setExpanded((previous) => !previous)}
                  className="pt-3 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
                >
                  {expanded ? 'Show fewer' : `Show ${otherResponses.length - visibleOtherResponses.length} more`}
                </button>
              )}
            </div>
          )}
        </div>
      ) : answerMode === 'host-review' ? (
        <div className="flex h-10 items-center justify-center text-center text-sm text-slate-500">
          No answers yet.
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(
  LiveAuntMinnieMessageThread,
  (previous, next) =>
    previous.currentUserId === next.currentUserId
    && previous.draftValue === next.draftValue
    && previous.isReadOnly === next.isReadOnly
    && previous.isSubmitting === next.isSubmitting
    && previous.canAnswer === next.canAnswer
    && previous.answerMode === next.answerMode
    && previous.responseStatus === next.responseStatus
    && previous.syncState === next.syncState
    && previous.correctAnswer === next.correctAnswer
    && previous.canEditCorrectAnswer === next.canEditCorrectAnswer
    && previous.isSavingCorrectAnswer === next.isSavingCorrectAnswer
    && (previous.myResponse?.id || null) === (next.myResponse?.id || null)
    && (previous.myResponse?.updated_at || previous.myResponse?.submitted_at || null)
      === (next.myResponse?.updated_at || next.myResponse?.submitted_at || null)
    && responseListSignature(previous.responses) === responseListSignature(next.responses),
);
