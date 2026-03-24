import React from 'react';
import { LiveAuntMinnieJudgment, LiveAuntMinnieResponse } from '../../types';

interface LiveAuntMinnieResponseBoardProps {
  responses: LiveAuntMinnieResponse[];
  onJudge?: (responseId: string, judgment: LiveAuntMinnieJudgment) => Promise<void>;
  busyResponseId?: string | null;
  title?: string;
  emptyLabel?: string;
}

const JUDGMENTS: LiveAuntMinnieJudgment[] = ['correct', 'partial', 'incorrect'];

const BUTTON_STYLES: Record<LiveAuntMinnieJudgment, string> = {
  correct: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  partial: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  incorrect: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  unreviewed: 'border-white/10 bg-white/5 text-slate-300',
};

const displayName = (response: LiveAuntMinnieResponse) =>
  response.participant?.nickname || response.participant?.full_name || 'Resident';

const LiveAuntMinnieResponseBoard: React.FC<LiveAuntMinnieResponseBoardProps> = ({
  responses,
  onJudge,
  busyResponseId,
  title = 'Submitted Answers',
  emptyLabel = 'Waiting for resident submissions.',
}) => {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">{title}</p>
          <p className="mt-1 text-sm text-slate-400">{responses.length} submitted for this prompt.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {responses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
            {emptyLabel}
          </div>
        ) : (
          responses.map((response) => (
            <div key={response.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{displayName(response)}</p>
                  <p className="mt-1 text-base text-slate-100">{response.response_text}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${BUTTON_STYLES[response.judgment || 'unreviewed']}`}>
                  {response.judgment || 'unreviewed'}
                </span>
              </div>

              {onJudge && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {JUDGMENTS.map((judgment) => (
                    <button
                      key={judgment}
                      type="button"
                      disabled={busyResponseId === response.id}
                      onClick={() => onJudge(response.id, judgment)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[judgment]}`}
                    >
                      {judgment}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default LiveAuntMinnieResponseBoard;
