import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { QuizListItem } from '../../types';

interface QuizCardProps {
  quiz: QuizListItem;
  onStart: (quiz: QuizListItem) => void;
}

const availabilityStyles = {
  open: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  scheduled: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  closed: 'bg-white/5 text-slate-400 border-white/10',
} as const;

const availabilityLabel = (quiz: QuizListItem) => {
  if (quiz.availability === 'open') return 'Open Now';
  if (quiz.availability === 'scheduled') return `Opens ${formatDistanceToNow(new Date(quiz.opens_at), { addSuffix: true })}`;
  return 'Closed';
};

const QuizCard: React.FC<QuizCardProps> = ({ quiz, onStart }) => {
  return (
    <div className="glass-card-enhanced rounded-3xl border border-white/10 p-5 space-y-4">
      <div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full border ${availabilityStyles[quiz.availability]}`}>
            {availabilityLabel(quiz)}
          </span>
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            {quiz.specialty}
          </span>
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full border border-white/10 bg-white/5 text-slate-300">
            {quiz.target_level}
          </span>
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300">
            Practice
          </span>
          {quiz.timer_enabled && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-300">
              Timed
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold text-white">{quiz.title}</h3>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{quiz.description || 'Case-based radiology training quiz for resident learning.'}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
        <div className="rounded-2xl bg-white/5 border border-white/5 p-3">
          <p className="uppercase tracking-[0.2em] text-[10px] text-slate-500">Questions</p>
          <p className="text-white font-semibold mt-1">{quiz.question_count || 0}</p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/5 p-3">
          <p className="uppercase tracking-[0.2em] text-[10px] text-slate-500">Timer</p>
          <p className="text-white font-semibold mt-1">{quiz.timer_enabled ? `${quiz.timer_minutes} min` : 'Untimed'}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#08111d] border border-white/5 p-4 text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span>Opens</span>
          <span className="text-white">{format(new Date(quiz.opens_at), 'PPp')}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Closes</span>
          <span className="text-white">{format(new Date(quiz.closes_at), 'PPp')}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Author</span>
          <span className="text-white">{quiz.author_name || 'Faculty'}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onStart(quiz)}
        disabled={!quiz.can_start}
        className="w-full rounded-2xl py-3 bg-primary text-white font-bold transition-all hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {quiz.can_start ? 'Start Quiz' : quiz.availability === 'scheduled' ? 'Opens Soon' : 'Closed'}
      </button>
    </div>
  );
};

export default QuizCard;
