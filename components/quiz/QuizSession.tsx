import React, { useEffect, useMemo, useState } from 'react';
import { QuizAttempt, QuizCorrectOption, QuizListItem, QuizQuestion } from '../../types';

interface QuizSessionProps {
  quiz: QuizListItem;
  questions: QuizQuestion[];
  attempt: QuizAttempt;
  onSubmit: (answers: Array<{ questionId: string; selectedOption: QuizCorrectOption | null }>, timeSpentSeconds: number) => Promise<void>;
  onCancel: () => void;
}

const optionOrder: QuizCorrectOption[] = ['A', 'B', 'C', 'D', 'E'];

const getRemainingSeconds = (quiz: QuizListItem, attempt: QuizAttempt) => {
  if (!quiz.timer_enabled || !quiz.timer_minutes) {
    return null;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000));
  return Math.max(0, (quiz.timer_minutes * 60) - elapsedSeconds);
};

const QuizSession: React.FC<QuizSessionProps> = ({ quiz, questions, attempt, onSubmit, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuizCorrectOption | null>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => getRemainingSeconds(quiz, attempt));
  const [submitting, setSubmitting] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);

  useEffect(() => {
    const remainingSeconds = getRemainingSeconds(quiz, attempt);
    setSecondsLeft(remainingSeconds);
    setTimerExpired(remainingSeconds === 0 && quiz.timer_enabled);
  }, [attempt.id, attempt.started_at, quiz.id, quiz.timer_enabled, quiz.timer_minutes]);

  useEffect(() => {
    if (!quiz.timer_enabled || secondsLeft === null) {
      return;
    }

    if (secondsLeft <= 0) {
      setTimerExpired(true);
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous === null) return previous;
        if (previous <= 1) {
          window.clearInterval(timer);
          setTimerExpired(true);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [quiz.timer_enabled, secondsLeft]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const elapsedSeconds = useMemo(() => {
    if (!quiz.timer_enabled || secondsLeft === null) {
      return Math.max(0, Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000));
    }

    return ((quiz.timer_minutes || 0) * 60) - secondsLeft;
  }, [attempt.started_at, quiz.timer_enabled, quiz.timer_minutes, secondsLeft]);

  const formattedTime = useMemo(() => {
    if (secondsLeft === null) return null;
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [secondsLeft]);

  const timerTone = secondsLeft !== null && secondsLeft <= 60
    ? 'text-rose-300 border-rose-500/30 bg-rose-500/10'
    : secondsLeft !== null && secondsLeft <= 300
      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
      : 'text-cyan-300 border-cyan-500/20 bg-cyan-500/10';

  const questionOptions = optionOrder
    .map((option) => ({
      key: option,
      value: currentQuestion?.[`option_${option.toLowerCase() as 'a' | 'b' | 'c' | 'd' | 'e'}` as keyof QuizQuestion] as string | null,
    }))
    .filter((option) => option.value);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = questions.map((question) => ({
        questionId: question.id,
        selectedOption: answers[question.id] || null,
      }));
      await onSubmit(payload, elapsedSeconds);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass-card-enhanced rounded-3xl border border-white/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Quiz Session</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{quiz.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{quiz.specialty} • {questions.length} questions</p>
          </div>
          {formattedTime && (
            <div className={`min-w-[130px] rounded-2xl border px-4 py-3 text-center ${timerTone}`}>
              <p className="text-[10px] uppercase tracking-[0.2em]">Timer</p>
              <p className="mt-1 text-2xl font-bold">{formattedTime}</p>
              <p className="mt-1 text-[11px]">{timerExpired ? 'Time expired.' : 'Submission is time-checked'}</p>
            </div>
          )}
        </div>

        {timerExpired && (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            The timer has reached zero. Submission timing is checked against the recorded start time.
          </div>
        )}
      </div>

      <div className="glass-card-enhanced rounded-3xl border border-white/10 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Question {currentIndex + 1} of {questions.length}</p>
          <p className="text-sm text-slate-400">{answeredCount} answered</p>
        </div>
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>

        {currentQuestion.clinical_context && (
          <div className="mb-4 rounded-2xl border border-cyan-500/10 bg-cyan-500/5 p-4">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-300">Clinical Context</p>
            <p className="text-sm leading-relaxed text-slate-200">{currentQuestion.clinical_context}</p>
          </div>
        )}

        {currentQuestion.image_url && (
          <div className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
            <img src={currentQuestion.image_url} alt={`Question ${currentIndex + 1} study`} className="max-h-[320px] w-full object-cover" />
          </div>
        )}

        <h3 className="text-xl font-semibold leading-relaxed text-white">{currentQuestion.stem}</h3>

        <div className="mt-6 space-y-3">
          {questionOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setAnswers((previous) => ({ ...previous, [currentQuestion.id]: option.key }))}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${answers[currentQuestion.id] === option.key
                ? 'border-primary bg-primary/10 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                }`}
            >
              <span className="mr-3 font-bold">{option.key}.</span>
              {option.value}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCurrentIndex((previous) => Math.max(0, previous - 1))}
              disabled={currentIndex === 0}
              className="rounded-xl border border-white/10 px-4 py-2 text-slate-300 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((previous) => Math.min(questions.length - 1, previous + 1))}
              disabled={currentIndex === questions.length - 1}
              className="rounded-xl border border-white/10 px-4 py-2 text-slate-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-400">
              Back to library
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-xl bg-primary px-5 py-2.5 font-bold text-white disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizSession;
