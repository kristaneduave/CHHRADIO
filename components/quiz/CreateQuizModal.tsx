import React, { useState } from 'react';
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

type SaveIntent = 'default' | 'draft';

interface AuthoringValues {
  title: string;
  description: string;
  specialty: string;
  publicationStatus: 'draft' | 'published';
  hasSchedule: boolean;
  timer_enabled: boolean;
  timer_minutes: number | '';
  opens_at: string;
  closes_at: string;
  questions: QuizQuestionFormValues[];
}

const DEFAULT_SCHEDULE_DURATION_DAYS = 30;

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

const buildFallbackSchedule = () => {
  const open = new Date();
  const close = new Date(open.getTime() + DEFAULT_SCHEDULE_DURATION_DAYS * 24 * 60 * 60 * 1000);

  return {
    opens_at: toLocalDateTimeInput(open.toISOString()),
    closes_at: toLocalDateTimeInput(close.toISOString()),
  };
};

const isPublishedStatus = (status?: string | null): status is 'published' => status === 'published';

const CreateQuizModal: React.FC<CreateQuizModalProps> = ({ quiz, questions = [], onClose, onSave }) => {
  const fallbackSchedule = buildFallbackSchedule();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<AuthoringValues>(() => ({
    title: quiz?.title || '',
    description: quiz?.description || '',
    specialty: quiz?.specialty || SPECIALTIES[0],
    publicationStatus: isPublishedStatus(quiz?.status) ? 'published' : 'draft',
    hasSchedule: !!quiz,
    timer_enabled: quiz?.timer_enabled || false,
    timer_minutes: quiz?.timer_minutes || '',
    opens_at: quiz?.opens_at ? toLocalDateTimeInput(quiz.opens_at) : fallbackSchedule.opens_at,
    closes_at: quiz?.closes_at ? toLocalDateTimeInput(quiz.closes_at) : fallbackSchedule.closes_at,
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
      explanation: question.explanation || '',
      teaching_point: '',
      pitfall: '',
      modality: '',
      anatomy_region: '',
      difficulty: 'junior',
    })) : [blankQuestion()],
  }));

  const handleChange = <K extends keyof AuthoringValues>(key: K, value: AuthoringValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const toPayload = (intent: SaveIntent): QuizAuthorFormValues => {
    const schedule = values.hasSchedule ? {
      opens_at: values.opens_at,
      closes_at: values.closes_at,
    } : buildFallbackSchedule();

    return {
      title: values.title,
      description: values.description,
      specialty: values.specialty,
      target_level: 'mixed',
      timer_enabled: values.timer_enabled,
      timer_minutes: values.timer_enabled ? values.timer_minutes : '',
      opens_at: schedule.opens_at,
      closes_at: schedule.closes_at,
      status: intent === 'draft' ? 'draft' : values.publicationStatus,
      questions: values.questions.map((question) => ({
        ...question,
        teaching_point: '',
        pitfall: '',
        modality: '',
        anatomy_region: '',
        difficulty: 'junior',
      })),
    };
  };

  const submit = async (intent: SaveIntent) => {
    setError(null);
    const payload = toPayload(intent);

    if (!payload.title.trim()) {
      setError('Title is required.');
      return;
    }

    if (values.hasSchedule && new Date(payload.closes_at).getTime() <= new Date(payload.opens_at).getTime()) {
      setError('Close time must be after open time.');
      return;
    }

    if (payload.timer_enabled && (!payload.timer_minutes || Number(payload.timer_minutes) <= 0)) {
      setError('Timer minutes must be greater than zero when the timer is enabled.');
      return;
    }

    if (payload.status === 'published' && payload.questions.length === 0) {
      setError('A quiz needs at least one question before it can be published.');
      return;
    }

    setLoading(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submit('default');
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
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full px-3 py-3 sm:px-4 sm:py-6">
        <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-white/10 bg-[#08111d] shadow-2xl">
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 rounded-t-[28px] border-b border-white/5 bg-[#08111d]/95 px-4 py-4 backdrop-blur sm:px-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Quiz Authoring</p>
              <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">{quiz ? 'Edit Quiz' : 'Create Quiz'}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quiz authoring"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-slate-300 transition hover:bg-white/10"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            {error && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
            )}

            <section className="rounded-3xl border border-white/10 bg-[#0d1828] p-4 sm:p-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Quiz details</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-slate-300">Quiz title</span>
                  <input
                    value={values.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="Enter quiz title"
                    className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Specialty</span>
                  <select
                    value={values.specialty}
                    onChange={(e) => handleChange('specialty', e.target.value)}
                    className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                  >
                    {SPECIALTIES.map((specialty) => (
                      <option key={specialty} value={specialty} className="bg-slate-900">{specialty}</option>
                    ))}
                  </select>
                </label>

                <fieldset className="block">
                  <span className="mb-2 block text-sm text-slate-300">Publication</span>
                  <div className="grid min-h-[48px] grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
                    {(['draft', 'published'] as const).map((status) => {
                      const active = values.publicationStatus === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleChange('publicationStatus', status)}
                          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${active
                            ? 'bg-primary text-white'
                            : 'text-slate-300 hover:bg-white/5'
                            }`}
                        >
                          {status === 'draft' ? 'Draft' : 'Published'}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-slate-300">Short description</span>
                  <textarea
                    value={values.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Optional short description"
                    className="min-h-[108px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0d1828] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Schedule</h3>
                  <p className="mt-1 text-sm text-slate-400">Set an open and close window only if this quiz should run on a schedule.</p>
                </div>
                <label className="inline-flex min-h-[44px] items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={values.hasSchedule}
                    onChange={(e) => handleChange('hasSchedule', e.target.checked)}
                    className="h-4 w-4"
                  />
                  Set availability window
                </label>
              </div>

              {values.hasSchedule && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">Open date and time</span>
                    <input
                      type="datetime-local"
                      value={values.opens_at}
                      onChange={(e) => handleChange('opens_at', e.target.value)}
                      className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">Close date and time</span>
                    <input
                      type="datetime-local"
                      value={values.closes_at}
                      onChange={(e) => handleChange('closes_at', e.target.value)}
                      className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                  </label>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0d1828] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Timer</h3>
                  <p className="mt-1 text-sm text-slate-400">Choose whether this quiz should be timed.</p>
                </div>
                <label className="inline-flex min-h-[44px] items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={values.timer_enabled}
                    onChange={(e) => handleChange('timer_enabled', e.target.checked)}
                    className="h-4 w-4"
                  />
                  Timed quiz
                </label>
              </div>

              {values.timer_enabled && (
                <div className="mt-4 max-w-[240px]">
                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">Minutes</span>
                    <input
                      type="number"
                      min={1}
                      value={values.timer_minutes}
                      onChange={(e) => handleChange('timer_minutes', e.target.value ? Number(e.target.value) : '')}
                      placeholder="Enter minutes"
                      className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                  </label>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Questions</h3>
              </div>

              <QuestionBuilder
                questions={values.questions}
                onChange={(next) => handleChange('questions', next)}
                onUploadImage={handleUploadImage}
                onAddQuestion={() => handleChange('questions', [...values.questions, blankQuestion()])}
              />
            </section>

            <div className="mobile-sheet-footer-clearance sticky bottom-0 z-20 -mx-4 border-t border-white/10 bg-[#08111d]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={onClose} className="min-h-[48px] px-4 py-2 text-slate-400">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => submit('draft')}
                  disabled={loading}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 font-medium text-white disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[48px] rounded-xl bg-primary px-5 py-2.5 font-bold text-white disabled:opacity-50"
                >
                  {loading ? 'Saving...' : quiz ? 'Save Changes' : 'Create Quiz'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateQuizModal;
