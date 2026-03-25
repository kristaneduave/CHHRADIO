import React, { useEffect, useState } from 'react';
import { QuizAttempt, QuizAuthorFormValues, QuizCorrectOption, QuizListItem, QuizQuestion, UserRole } from '../types';
import {
  createQuiz,
  deleteQuiz,
  duplicateQuiz,
  getQuizWorkspaceData,
  getQuizWithQuestions,
  isQuizAuthorRole,
  startQuizAttempt,
  submitQuizAttempt,
  updateQuiz,
} from '../services/quizService';
import ManageQuizzesPanel from './quiz/ManageQuizzesPanel';
import MyQuizAttempts from './quiz/MyQuizAttempts';
import QuizLibrary from './quiz/QuizLibrary';
import QuizResultReview from './quiz/QuizResultReview';
import QuizSession from './quiz/QuizSession';
import QuizLandingView from './quiz/QuizLandingView';
import QuizSectionHeader from './quiz/QuizSectionHeader';
import QuizManageAccess from './quiz/QuizManageAccess';
import PageShell from './ui/PageShell';
import { isLiveAuntMinnieHostRole } from '../services/liveAuntMinnieService';

type ScreenMode = 'landing' | 'mcq-library' | 'mcq-session' | 'mcq-review' | 'aunt-minnie-hub';

interface QuizScreenProps {
  onOpenLiveAuntMinnie?: () => void;
}

const QuizScreen: React.FC<QuizScreenProps> = ({ onOpenLiveAuntMinnie }) => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [availableQuizzes, setAvailableQuizzes] = useState<QuizListItem[]>([]);
  const [managedQuizzes, setManagedQuizzes] = useState<QuizListItem[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [activeQuiz, setActiveQuiz] = useState<QuizListItem | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttempt | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null);
  const [mode, setMode] = useState<ScreenMode>('landing');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const refreshData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const workspace = await getQuizWorkspaceData({ force });
      setUserRoles(workspace.userRoles);
      setAvailableQuizzes(workspace.availableQuizzes);
      setAttempts(workspace.attempts);
      setManagedQuizzes(workspace.managedQuizzes);
      setQuizQuestions(workspace.quizQuestions);
    } catch (err: any) {
      setError(err.message || 'Failed to load quiz data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleStartQuiz = async (quiz: QuizListItem) => {
    setBusy(true);
    setError(null);
    try {
      const details = await getQuizWithQuestions(quiz.id);
      const attempt = await startQuizAttempt(details.quiz);
      setActiveQuiz(details.quiz);
      setActiveQuestions(details.questions);
      setActiveAttempt(attempt);
      setMode('mcq-session');
    } catch (err: any) {
      setError(err.message || 'Failed to start quiz.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitQuiz = async (
    answers: Array<{ questionId: string; selectedOption: QuizCorrectOption | null }>,
    timeSpentSeconds: number,
  ) => {
    if (!activeAttempt || !activeQuiz) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const submitted = await submitQuizAttempt(activeAttempt.id, activeQuestions, answers, timeSpentSeconds);
      setReviewAttempt(submitted);
      setMode('mcq-review');
      await refreshData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz.');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleCreateQuiz = async (values: QuizAuthorFormValues) => {
    setBusy(true);
    setError(null);
    try {
      await createQuiz(values);
      await refreshData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create quiz.');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleEditQuiz = async (quizId: string, values: QuizAuthorFormValues) => {
    setBusy(true);
    setError(null);
    try {
      await updateQuiz(quizId, values);
      await refreshData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update quiz.');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicateQuiz = async (quizId: string) => {
    setBusy(true);
    setError(null);
    try {
      await duplicateQuiz(quizId);
      await refreshData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate quiz.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteQuiz(quizId);
      await refreshData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete quiz.');
    } finally {
      setBusy(false);
    }
  };

  const resetSession = () => {
    setMode('mcq-library');
    setActiveQuiz(null);
    setActiveQuestions([]);
    setActiveAttempt(null);
    setReviewAttempt(null);
  };

  const canManage = isQuizAuthorRole(userRoles);
  const canHostAuntMinnie = userRoles.some((role) => isLiveAuntMinnieHostRole(role));

  if (loading) {
    return (
      <PageShell layoutMode="content" className="animate-in fade-in duration-300" contentClassName="max-w-4xl">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-white/5 border-t-cyan-300" />
            <p className="font-semibold text-white">Loading quiz lab...</p>
          </div>
        </div>
      </PageShell>
    );
  }

  const manageAction = canManage ? (
    <QuizManageAccess isOpen={manageOpen} onToggle={() => setManageOpen((prev) => !prev)} />
  ) : null;

  return (
    <PageShell layoutMode="content" className="animate-in fade-in duration-500" contentClassName="max-w-4xl space-y-5">
      {mode === 'landing' ? (
        <div className="space-y-5">
          <QuizLandingView
            publishedCount={availableQuizzes.length}
            attemptCount={attempts.length}
            canManage={canManage}
            manageOpen={manageOpen}
            onToggleManage={() => setManageOpen((prev) => !prev)}
            onOpenMcq={() => setMode('mcq-library')}
            onOpenAuntMinnie={() => setMode('aunt-minnie-hub')}
          />
          {error ? (
            <div className="rounded-[1.6rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          {busy ? (
            <div className="rounded-[1.6rem] border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              Working on your quiz request...
            </div>
          ) : null}
          {canManage && manageOpen ? (
            <ManageQuizzesPanel
              quizzes={managedQuizzes}
              quizQuestions={quizQuestions}
              onCreate={handleCreateQuiz}
              onEdit={handleEditQuiz}
              onDuplicate={handleDuplicateQuiz}
              onDelete={handleDeleteQuiz}
            />
          ) : null}
        </div>
      ) : null}

      {mode === 'mcq-library' ? (
        <div className="space-y-5">
          <QuizSectionHeader
            title="Multiple Choice Exam"
            description="Open exams and review."
            onBack={() => setMode('landing')}
            action={manageAction}
          />
          {error ? (
            <div className="rounded-[1.6rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          {busy ? (
            <div className="rounded-[1.6rem] border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              Working on your quiz request...
            </div>
          ) : null}
          {canManage && manageOpen ? (
            <ManageQuizzesPanel
              quizzes={managedQuizzes}
              quizQuestions={quizQuestions}
              onCreate={handleCreateQuiz}
              onEdit={handleEditQuiz}
              onDuplicate={handleDuplicateQuiz}
              onDelete={handleDeleteQuiz}
            />
          ) : null}
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Published assessments</h3>
              </div>
              <QuizLibrary quizzes={availableQuizzes} onStart={handleStartQuiz} />
            </div>
          </section>
          <section>
            <MyQuizAttempts attempts={attempts} />
          </section>
        </div>
      ) : null}

      {mode === 'mcq-session' && activeQuiz && activeAttempt ? (
        <div className="space-y-5">
          <QuizSectionHeader
            title={activeQuiz.title}
            description="One question at a time."
            onBack={resetSession}
          />
          <QuizSession
            quiz={activeQuiz}
            questions={activeQuestions}
            attempt={activeAttempt}
            onCancel={resetSession}
            onSubmit={handleSubmitQuiz}
          />
        </div>
      ) : null}

      {mode === 'mcq-review' && activeQuiz && reviewAttempt ? (
        <div className="space-y-5">
          <QuizSectionHeader
            title="Quiz Review"
            description="Answers and explanations."
            onBack={resetSession}
          />
          <QuizResultReview
            quiz={activeQuiz}
            questions={activeQuestions}
            attempt={reviewAttempt}
            onBack={resetSession}
            onRetake={handleStartQuiz}
          />
        </div>
      ) : null}

      {mode === 'aunt-minnie-hub' ? (
        <div className="space-y-5">
          <QuizSectionHeader
            title="Aunt Minnie"
            description="Image-first sessions."
            onBack={() => setMode('landing')}
          />
          {error ? (
            <div className="rounded-[1.6rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <div className="space-y-4">
            <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
              <div className="rounded-3xl border border-white/[0.05] bg-white/[0.025] p-5 backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Session</p>
                    <h3 className="mt-3 text-[1.9rem] font-black tracking-tight text-white">Join live room</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">Read, answer, reveal.</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/16 bg-amber-500/[0.08] text-amber-200">
                    <span className="material-icons text-[21px]">visibility</span>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <p className="text-sm leading-6 text-slate-300">Live image rounds and rapid differentials.</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLiveAuntMinnie?.()}
                  disabled={!onOpenLiveAuntMinnie}
                  className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-amber-400/18 bg-amber-500/[0.08] px-4 text-sm font-semibold text-white transition hover:bg-amber-500/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
              <div className="rounded-3xl border border-white/[0.05] bg-white/[0.025] p-5 backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Host</p>
                    <h3 className="mt-3 text-[1.9rem] font-black tracking-tight text-white">{canHostAuntMinnie ? 'Manage room' : 'Host access'}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {canHostAuntMinnie ? 'Create prompts and run the reveal.' : 'Join sessions even without host permissions.'}
                    </p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${canHostAuntMinnie ? 'border-cyan-400/16 bg-cyan-500/[0.08] text-cyan-100' : 'border-white/[0.05] bg-white/[0.02] text-slate-400'}`}>
                    <span className="material-icons text-[21px]">hub</span>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <p className="text-sm leading-6 text-slate-300">
                    {canHostAuntMinnie ? 'Open the room to host or edit a session.' : 'Consultant, admin, faculty, and training officer roles can host.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLiveAuntMinnie?.()}
                  disabled={!onOpenLiveAuntMinnie}
                  className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canHostAuntMinnie ? 'Open' : 'Browse'}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
};

export default QuizScreen;
