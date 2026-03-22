import React, { useMemo, useState } from 'react';
import { LiveAuntMinnieResponse } from '../../types';

interface LiveAuntMinnieMessageThreadProps {
  currentUserId: string | null;
  draftValue: string;
  isReadOnly: boolean;
  isSubmitting: boolean;
  myResponse: LiveAuntMinnieResponse | null;
  canAnswer: boolean;
  responses: LiveAuntMinnieResponse[];
  onDraftChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}

const displayName = (response: LiveAuntMinnieResponse) =>
  response.participant?.nickname || response.participant?.full_name || 'Resident';

const formatResponseTime = (response: LiveAuntMinnieResponse) =>
  new Date(response.updated_at || response.submitted_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

const LiveAuntMinnieMessageThread: React.FC<LiveAuntMinnieMessageThreadProps> = ({
  currentUserId,
  draftValue,
  isReadOnly,
  isSubmitting,
  myResponse,
  canAnswer,
  responses,
  onDraftChange,
  onSubmit,
}) => {
  const [expanded, setExpanded] = useState(false);
  const sortedResponses = useMemo(
    () =>
      [...responses].sort(
        (left, right) =>
          new Date(left.updated_at || left.submitted_at).getTime() -
          new Date(right.updated_at || right.submitted_at).getTime(),
      ),
    [responses],
  );
  const visibleResponses = expanded ? sortedResponses : sortedResponses.slice(0, 4);
  const hasOverflow = sortedResponses.length > 4;
  const submitLabel = myResponse
    ? draftValue.trim()
      ? 'Save'
      : 'Clear'
    : 'Answer';

  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-3 sm:p-4">
      <div className="space-y-2">
        {sortedResponses.length === 0 ? (
          <p className="text-sm text-slate-400">No answers yet.</p>
        ) : (
          visibleResponses.map((response) => {
            const isMine = currentUserId === response.user_id;

            return (
              <div
                key={response.id}
                className={`rounded-[20px] border px-3 py-2.5 ${
                  isMine ? 'border-cyan-400/20 bg-cyan-500/10' : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-sm font-semibold ${isMine ? 'text-cyan-100' : 'text-white'}`}>
                    {displayName(response)}
                    {isMine ? ' • You' : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">{formatResponseTime(response)}</p>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-100">
                  {response.response_text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="mt-3 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
        >
          {expanded ? 'Show less' : `Show ${sortedResponses.length - visibleResponses.length} more`}
        </button>
      )}

      {!isReadOnly && canAnswer && (
        <div className="mt-4 flex items-end gap-2">
          <textarea
            value={draftValue}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={myResponse ? 'Edit your answer' : 'Add your answer'}
            disabled={isSubmitting}
            className="min-h-[88px] flex-1 rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={isSubmitting || (!draftValue.trim() && !myResponse)}
            className="rounded-[20px] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveAuntMinnieMessageThread;
