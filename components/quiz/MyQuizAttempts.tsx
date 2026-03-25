import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { QuizAttempt } from '../../types';

interface MyQuizAttemptsProps {
  attempts: QuizAttempt[];
}

const MyQuizAttempts: React.FC<MyQuizAttemptsProps> = ({ attempts }) => {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Review History</p>
        <h3 className="mt-2 text-xl font-black tracking-tight text-white">My Attempts</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">Recent quiz performance and review history.</p>
      </div>

      {attempts.length === 0 ? (
        <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-black/10 p-6 text-sm leading-6 text-slate-400">
          No attempts yet. Start an open quiz to build your resident review history.
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => (
            <div key={attempt.id} className="rounded-[1.6rem] border border-white/5 bg-black/10 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-semibold">{attempt.quiz?.title || 'Quiz attempt'}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {attempt.quiz?.specialty || 'Radiology'} • Submitted {attempt.submitted_at ? formatDistanceToNow(new Date(attempt.submitted_at), { addSuffix: true }) : 'in progress'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-300 font-bold">{Math.round(attempt.percentage)}%</p>
                  <p className="text-xs text-slate-500">{attempt.score}/{attempt.total_questions} correct</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                <span>{attempt.time_spent_seconds ? `${Math.max(1, Math.round(attempt.time_spent_seconds / 60))} min` : 'No timer data'}</span>
                {attempt.submitted_at && <span>{format(new Date(attempt.submitted_at), 'PPp')}</span>}
                <span>{attempt.answers.length > 0 ? 'Explanations available' : 'Awaiting submission'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyQuizAttempts;
