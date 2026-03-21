import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { SPECIALTIES } from '../../constants';
import { QuizAuthorFormValues, QuizListItem, QuizQuestion, QuizQuestionFormValues } from '../../types';
import { uploadQuizQuestionImage } from '../../services/quizService';
import QuestionBuilder from './QuestionBuilder';

interface CreateQuizModalProps {
  quiz?: QuizListItem | null;
  questions?: QuizQuestion[];
  onClose: () => void;
  onSave: (values: QuizAuthorFormValues) => Promise<void>;
}

const blankQuestion = (): QuizQuestionFormValues => ({
  stem: '',
  clinical_context: '',
  image_url: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  option_e: '',
  correct_option: 'A',
  explanation: '',
  teaching_point: '',
  pitfall: '',
  modality: '',
  anatomy_region: '',
  difficulty: 'junior',
});

const toLocalDateTimeInput = (value?: string) => {
  if (!value) {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const CreateQuizModal: React.FC<CreateQuizModalProps> = ({ quiz, questions = [], onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<QuizAuthorFormValues>(() => ({
    title: quiz?.title || '',
    description: quiz?.description || '',
    specialty: quiz?.specialty || SPECIALTIES[0],
    target_level: quiz?.target_level || 'junior',
    timer_enabled: quiz?.timer_enabled || false,
    timer_minutes: quiz?.timer_minutes || '',
    opens_at: toLocalDateTimeInput(quiz?.opens_at),
    closes_at: toLocalDateTimeInput(quiz?.closes_at),
    status: quiz?.status || 'draft',
    questions: questions.length > 0 ? questions.map((question) => ({
      id: question.id,
      stem: question.stem,
      clinical_context: question.clinical_context || '',
      image_url: question.image_url || '',
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      option_e: question.option_e || '',
      correct_option: question.correct_option,
      explanation: question.explanation,
      teaching_point: question.teaching_point || '',
      pitfall: question.pitfall || '',
      modality: question.modality || '',
      anatomy_region: question.anatomy_region || '',
      difficulty: question.difficulty,
    })) : [blankQuestion()],
  }));

  const statusHint = useMemo(() => values.status === 'published'
    ? 'Published quizzes still follow the open and close window before residents can start.'
    : values.status === 'archived'
      ? 'Archived quizzes are hidden from learners but preserved for faculty reference.'
      : 'Draft quizzes are visible only to their authors and admins.',
  [values.status]);

  const handleChange = <K extends keyof QuizAuthorFormValues>(key: K, value: QuizAuthorFormValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!values.title.trim()) {
      setError('Title is required.');
      return;
    }

    if (new Date(values.closes_at).getTime() <= new Date(values.opens_at).getTime()) {
      setError('Close time must be after open time.');
      return;
    }

    if (values.timer_enabled && (!values.timer_minutes || Number(values.timer_minutes) <= 0)) {
      setError('Timer minutes must be greater than zero when the timer is enabled.');
      return;
    }

    if (values.status === 'published' && values.questions.length === 0) {
      setError('A quiz needs at least one question before it can be published.');
      return;
    }

    setLoading(true);
    try {
      await onSave(values);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (index: number, file: File) => {
    setError(null);
    try {
      const imageUrl = await uploadQuizQuestionImage(file, index);
      const nextQuestions = [...values.questions];
      nextQuestions[index] = { ...nextQuestions[index], image_url: imageUrl };
      handleChange('questions', nextQuestions);
    } catch (err: any) {
      setError(err.message || 'Failed to upload question image.');
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="max-w-5xl mx-auto my-8 rounded-[32px] border border-white/10 bg-[#06101d] shadow-2xl">
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-white/5 sticky top-0 bg-[#06101d] z-10">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Quiz Authoring</p>
            <h2 className="text-2xl font-bold text-white mt-2">{quiz ? 'Edit Quiz' : 'Create Quiz'}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 text-slate-300">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <input value={values.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="Quiz title" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
            <select value={values.specialty} onChange={(e) => handleChange('specialty', e.target.value)} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white">
              {SPECIALTIES.map((specialty) => (
                <option key={specialty} value={specialty} className="bg-slate-900">{specialty}</option>
              ))}
            </select>
            <select value={values.target_level} onChange={(e) => handleChange('target_level', e.target.value as QuizAuthorFormValues['target_level'])} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white">
              <option value="junior" className="bg-slate-900">Junior</option>
              <option value="senior" className="bg-slate-900">Senior</option>
              <option value="board" className="bg-slate-900">Board</option>
              <option value="mixed" className="bg-slate-900">Mixed</option>
            </select>
            <select value={values.status} onChange={(e) => handleChange('status', e.target.value as QuizAuthorFormValues['status'])} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white">
              <option value="draft" className="bg-slate-900">Draft</option>
              <option value="published" className="bg-slate-900">Published</option>
              <option value="archived" className="bg-slate-900">Archived</option>
            </select>
            <input type="datetime-local" value={values.opens_at} onChange={(e) => handleChange('opens_at', e.target.value)} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
            <input type="datetime-local" value={values.closes_at} onChange={(e) => handleChange('closes_at', e.target.value)} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white" />
          </div>

          <textarea value={values.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Short description for learners" className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white min-h-[110px]" />

          <div className="rounded-3xl border border-white/10 bg-[#091422] p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Scheduling and Timer</h3>
                <p className="text-sm text-slate-400 mt-2">{statusHint}</p>
              </div>
              <label className="inline-flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={values.timer_enabled}
                  onChange={(e) => handleChange('timer_enabled', e.target.checked)}
                  className="w-4 h-4"
                />
                Enable warning timer
              </label>
            </div>
            {values.timer_enabled && (
              <div className="mt-4 max-w-[220px]">
                <input
                  type="number"
                  min={1}
                  value={values.timer_minutes}
                  onChange={(e) => handleChange('timer_minutes', e.target.value ? Number(e.target.value) : '')}
                  placeholder="Minutes"
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Questions</h3>
              <p className="text-sm text-slate-400 mt-2">Build case-based items that teach imaging pattern recognition and decision-making.</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('questions', [...values.questions, blankQuestion()])}
              className="px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary"
            >
              Add Question
            </button>
          </div>

          <QuestionBuilder
            questions={values.questions}
            onChange={(next) => handleChange('questions', next)}
            onUploadImage={handleUploadImage}
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">
              {loading ? 'Saving...' : quiz ? 'Save Changes' : 'Create Quiz'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CreateQuizModal;
