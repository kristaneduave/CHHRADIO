import React from 'react';
import { LiveAuntMinniePrompt, LiveAuntMinnieResponse } from '../../types';

interface LiveAuntMinnieRevealPanelProps {
  prompt: LiveAuntMinniePrompt;
  myResponse?: LiveAuntMinnieResponse | null;
}

const judgmentLabel: Record<string, string> = {
  correct: 'Correct',
  partial: 'Partially Correct',
  incorrect: 'Incorrect',
  unreviewed: 'Awaiting Consultant Review',
};

const LiveAuntMinnieRevealPanel: React.FC<LiveAuntMinnieRevealPanelProps> = ({ prompt, myResponse }) => {
  return (
    <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-200">Answer Reveal</p>
      <h3 className="mt-3 text-2xl font-black text-white">{prompt.official_answer}</h3>
      {prompt.answer_explanation && (
        <p className="mt-3 text-sm leading-7 text-emerald-50/90">{prompt.answer_explanation}</p>
      )}
      {myResponse && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Your Answer</p>
          <p className="mt-2 text-base font-semibold text-white">{myResponse.response_text}</p>
          <p className="mt-2 text-sm text-slate-300">
            {judgmentLabel[myResponse.judgment || 'unreviewed']}
          </p>
          {myResponse.consultant_note && (
            <p className="mt-2 text-sm text-slate-400">{myResponse.consultant_note}</p>
          )}
        </div>
      )}
    </section>
  );
};

export default LiveAuntMinnieRevealPanel;
