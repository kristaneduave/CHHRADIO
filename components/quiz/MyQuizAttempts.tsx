import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { QuizAttempt } from '../../types';

interface MyQuizAttemptsProps {
  attempts: QuizAttempt[];
}

const MyQuizAttempts: React.FC<MyQuizAttemptsProps> = ({ attempts }) => {
  return (
    <div className="glass-card-enhanced rounded-3xl border border-white/10 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">My Attempts</h3>
        <p className="text-sm text-slate-400">Recent quiz performance and review history.</p>
      </div>

      {attempts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
          No attempts yet. Start an open quiz to build your resident review history.
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => (
            <div key={attempt.id} className="rounded-2xl bg-white/5 border border-white/5 p-4">
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
