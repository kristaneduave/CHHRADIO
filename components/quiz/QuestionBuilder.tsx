import React, { useEffect, useRef, useState } from 'react';
import { QuizCorrectOption, QuizQuestionFormValues } from '../../types';

interface QuestionBuilderProps {
  questions: QuizQuestionFormValues[];
  onChange: (questions: QuizQuestionFormValues[]) => void;
  onUploadImage: (index: number, file: File) => Promise<void>;
  onAddQuestion: () => void;
}

const correctOptions: QuizCorrectOption[] = ['A', 'B', 'C', 'D', 'E'];

const QuestionBuilder: React.FC<QuestionBuilderProps> = ({ questions, onChange, onUploadImage, onAddQuestion }) => {
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  const stemRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  useEffect(() => {
    if (pendingFocusIndex === null || questions.length <= pendingFocusIndex) {
      return;
    }

    const target = stemRefs.current[pendingFocusIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus();
    }
    setPendingFocusIndex(null);
  }, [pendingFocusIndex, questions.length]);

  const updateQuestion = (index: number, key: keyof QuizQuestionFormValues, value: string) => {
    const next = [...questions];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    const [current] = next.splice(index, 1);
    next.splice(target, 0, current);
    onChange(next);
  };

  const removeQuestion = (index: number) => onChange(questions.filter((_, current) => current !== index));

  const handleAddQuestion = () => {
    setPendingFocusIndex(questions.length);
    onAddQuestion();
  };

  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const isLastQuestion = index === questions.length - 1;

        return (
          <div key={index} className="rounded-3xl border border-white/10 bg-[#0d1828] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Question {index + 1}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => moveQuestion(index, -1)}
                  className="min-h-[40px] rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
                >
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(index, 1)}
                  className="min-h-[40px] rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
                >
                  Move down
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="min-h-[40px] rounded-xl border border-rose-500/20 px-3 py-2 text-sm text-rose-300"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-300">Study image</p>
                <label className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-primary cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await onUploadImage(index, file);
                      e.currentTarget.value = '';
                    }}
                  />
                  Upload image
                </label>
              </div>

              {question.image_url && (
                <div className="mt-4">
                  <div className="max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <img src={question.image_url} alt={`Question ${index + 1}`} className="h-48 w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateQuestion(index, 'image_url', '')}
                    className="mt-3 min-h-[40px] rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Question stem</span>
              <textarea
                ref={(node) => {
                  stemRefs.current[index] = node;
                }}
                value={question.stem}
                onChange={(e) => updateQuestion(index, 'stem', e.target.value)}
                placeholder="Enter the question stem"
                className="min-h-[112px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Clinical vignette / history</span>
              <textarea
                value={question.clinical_context}
                onChange={(e) => updateQuestion(index, 'clinical_context', e.target.value)}
                placeholder="Optional clinical context"
                className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Option A</span>
                <input value={question.option_a} onChange={(e) => updateQuestion(index, 'option_a', e.target.value)} className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Option B</span>
                <input value={question.option_b} onChange={(e) => updateQuestion(index, 'option_b', e.target.value)} className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Option C</span>
                <input value={question.option_c} onChange={(e) => updateQuestion(index, 'option_c', e.target.value)} className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Option D</span>
                <input value={question.option_d} onChange={(e) => updateQuestion(index, 'option_d', e.target.value)} className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm text-slate-300">Option E</span>
                <input value={question.option_e} onChange={(e) => updateQuestion(index, 'option_e', e.target.value)} placeholder="Optional fifth answer" className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
              </label>
            </div>

            <label className="block max-w-[240px]">
              <span className="mb-2 block text-sm text-slate-300">Correct answer</span>
              <select
                value={question.correct_option}
                onChange={(e) => updateQuestion(index, 'correct_option', e.target.value)}
                className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
              >
                {correctOptions.map((option) => (
                  <option key={option} value={option} className="bg-slate-900">{option}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Explanation</span>
              <textarea
                value={question.explanation}
                onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                placeholder="Optional explanation"
                className="min-h-[112px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
              />
            </label>

            {isLastQuestion && (
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 font-medium text-primary"
              >
                Add next question
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default QuestionBuilder;
