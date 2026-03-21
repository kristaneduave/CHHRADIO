import React from 'react';
import { QuizCorrectOption, QuizQuestionFormValues } from '../../types';

interface QuestionBuilderProps {
  questions: QuizQuestionFormValues[];
  onChange: (questions: QuizQuestionFormValues[]) => void;
  onUploadImage: (index: number, file: File) => Promise<void>;
}

const difficultyOptions = ['junior', 'senior', 'board'] as const;
const correctOptions: QuizCorrectOption[] = ['A', 'B', 'C', 'D', 'E'];

const QuestionBuilder: React.FC<QuestionBuilderProps> = ({ questions, onChange, onUploadImage }) => {
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

  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <div key={index} className="rounded-3xl border border-white/10 bg-[#091422] p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Question {index + 1}</p>
              <p className="text-sm text-slate-400 mt-2">Use a short clinical scenario, explain the imaging finding, and add a pitfall residents often miss.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => moveQuestion(index, -1)} className="px-3 py-2 rounded-xl border border-white/10 text-slate-300">Up</button>
              <button type="button" onClick={() => moveQuestion(index, 1)} className="px-3 py-2 rounded-xl border border-white/10 text-slate-300">Down</button>
              <button type="button" onClick={() => removeQuestion(index)} className="px-3 py-2 rounded-xl border border-rose-500/20 text-rose-300">Delete</button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Question #{index + 1}</p>
                <p className="text-sm text-slate-400 mt-2">Attach a representative study image when the teaching point depends on visual recognition.</p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary cursor-pointer">
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
                Upload Photo
              </label>
            </div>

            {question.image_url && (
              <div className="mt-4">
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20 max-w-md">
                  <img src={question.image_url} alt={`Question ${index + 1}`} className="w-full h-48 object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => updateQuestion(index, 'image_url', '')}
                  className="mt-3 px-3 py-2 rounded-xl border border-white/10 text-slate-300"
                >
                  Remove Photo
                </button>
              </div>
            )}
          </div>

          <textarea
            value={question.stem}
            onChange={(e) => updateQuestion(index, 'stem', e.target.value)}
            placeholder="Question stem"
            className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white min-h-[100px]"
          />

          <textarea
            value={question.clinical_context}
            onChange={(e) => updateQuestion(index, 'clinical_context', e.target.value)}
            placeholder="Clinical vignette / history"
            className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white min-h-[88px]"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={question.option_a} onChange={(e) => updateQuestion(index, 'option_a', e.target.value)} placeholder="Option A" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
            <input value={question.option_b} onChange={(e) => updateQuestion(index, 'option_b', e.target.value)} placeholder="Option B" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
            <input value={question.option_c} onChange={(e) => updateQuestion(index, 'option_c', e.target.value)} placeholder="Option C" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
            <input value={question.option_d} onChange={(e) => updateQuestion(index, 'option_d', e.target.value)} placeholder="Option D" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
            <input value={question.option_e} onChange={(e) => updateQuestion(index, 'option_e', e.target.value)} placeholder="Option E (optional)" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white md:col-span-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={question.correct_option} onChange={(e) => updateQuestion(index, 'correct_option', e.target.value)} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white">
              {correctOptions.map((option) => (
                <option key={option} value={option} className="bg-slate-900">{option}</option>
              ))}
            </select>
            <input value={question.modality} onChange={(e) => updateQuestion(index, 'modality', e.target.value)} placeholder="Modality" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
            <input value={question.anatomy_region} onChange={(e) => updateQuestion(index, 'anatomy_region', e.target.value)} placeholder="Anatomy region" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
          </div>

          <select value={question.difficulty} onChange={(e) => updateQuestion(index, 'difficulty', e.target.value)} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white w-full md:w-[220px]">
            {difficultyOptions.map((option) => (
              <option key={option} value={option} className="bg-slate-900">{option}</option>
            ))}
          </select>

          <textarea
            value={question.explanation}
            onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
            placeholder="Explanation (optional): describe why the correct answer is right and why common distractors fail."
            className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white min-h-[100px]"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea
              value={question.teaching_point}
              onChange={(e) => updateQuestion(index, 'teaching_point', e.target.value)}
              placeholder="Teaching point"
              className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white min-h-[88px]"
            />
            <textarea
              value={question.pitfall}
              onChange={(e) => updateQuestion(index, 'pitfall', e.target.value)}
              placeholder="Common pitfall"
              className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white min-h-[88px]"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuestionBuilder;
