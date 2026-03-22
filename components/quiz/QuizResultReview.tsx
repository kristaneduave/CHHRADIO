import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { QuizAnswer, QuizAttempt, QuizCorrectOption, QuizListItem, QuizQuestion } from '../../types';

interface QuizResultReviewProps {
  quiz: QuizListItem;
  questions: QuizQuestion[];
  attempt: QuizAttempt;
  onRetake: (quiz: QuizListItem) => void;
  onBack: () => void;
}

const answerLookup = (answers: QuizAnswer[]) => new Map(answers.map((answer) => [answer.questionId, answer]));

const QuizResultReview: React.FC<QuizResultReviewProps> = ({ quiz, questions, attempt, onRetake, onBack }) => {
  const answers = answerLookup(attempt.answers);

  const optionValue = (question: QuizQuestion, option: QuizCorrectOption) =>
    question[`option_${option.toLowerCase() as 'a' | 'b' | 'c' | 'd' | 'e'}` as keyof QuizQuestion] as string | null;

  return (
    <div className="space-y-5">
      <div className="glass-card-enhanced rounded-3xl border border-white/10 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Quiz Review</p>
            <h2 className="text-3xl font-bold text-white mt-2">{Math.round(attempt.percentage)}%</h2>
            <p className="text-sm text-slate-400 mt-2">
              {attempt.score} of {attempt.total_questions} correct
              {attempt.submitted_at && ` • Submitted ${formatDistanceToNow(new Date(attempt.submitted_at), { addSuffix: true })}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onBack} className="px-4 py-2 rounded-xl border border-white/10 text-slate-300">
              Back to Library
            </button>
            {quiz.can_start && (
              <button type="button" onClick={() => onRetake(quiz)} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold">
                Retake Quiz
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => {
          const answer = answers.get(question.id);
          const selected = answer?.selectedOption || null;
          const correct = question.correct_option;
          return (
            <div key={question.id} className="glass-card-enhanced rounded-3xl border border-white/10 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Question {index + 1}</p>
                  <h3 className="text-lg font-semibold text-white mt-2">{question.stem}</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${answer?.isCorrect ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                  {answer?.isCorrect ? 'Correct' : 'Review'}
                </span>
              </div>

              {question.clinical_context && (
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{question.clinical_context}</p>
              )}

              {question.image_url && (
                <div className="mb-4 rounded-3xl overflow-hidden border border-white/10 bg-black/20 max-w-2xl">
                  <img src={question.image_url} alt={`Question ${index + 1} study`} className="w-full max-h-[320px] object-cover" />
                </div>
              )}

              <div className="space-y-2 mb-5">
                {(['A', 'B', 'C', 'D', 'E'] as QuizCorrectOption[]).map((option) => {
                  const value = optionValue(question, option);
                  if (!value) return null;
                  const isSelected = selected === option;
                  const isCorrect = correct === option;
                  return (
                    <div
                      key={option}
                      className={`rounded-2xl border p-3 text-sm ${isCorrect
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                        : isSelected
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
                          : 'border-white/10 bg-white/5 text-slate-300'
                        }`}
                    >
                      <span className="font-bold mr-2">{option}.</span>
                      {value}
                    </div>
                  );
                })}
              </div>

              <div className="text-sm">
                <div className="rounded-2xl bg-cyan-500/5 border border-cyan-500/10 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 mb-2">Explanation</p>
                  <p className="text-slate-200 leading-relaxed">{question.explanation || 'No explanation provided for this question.'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizResultReview;
