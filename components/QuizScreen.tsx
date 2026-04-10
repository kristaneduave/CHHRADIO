import React, { useEffect, useState } from 'react';
import { QuizAttempt, QuizAuthorFormValues, QuizCorrectOption, QuizListItem, QuizQuestion, UserRole } from '../types';
import {
  getCachedQuizWorkspaceData,
  createQuiz,
  deleteQuiz,
  duplicateQuiz,
  getQuizWorkspaceData,
  getQuizWithQuestions,
  startQuizAttempt,
  submitQuizAttempt,
  updateQuiz,
} from '../services/quizService';
import { preloadCurrentLiveAuntMinnieRoom } from '../services/liveAuntMinnieService';
import ManageQuizzesPanel from './quiz/ManageQuizzesPanel';
import MyQuizAttempts from './quiz/MyQuizAttempts';
import QuizLibrary from './quiz/QuizLibrary';
import QuizResultReview from './quiz/QuizResultReview';
import QuizSession from './quiz/QuizSession';
import QuizLandingView from './quiz/QuizLandingView';
import QuizSectionHeader from './quiz/QuizSectionHeader';
import QuizManageAccess from './quiz/QuizManageAccess';
import PageShell from './ui/PageShell';
import ScreenStatusNotice from './ui/ScreenStatusNotice';
import { canManageQuiz } from '../utils/roles';

type ScreenMode = 'landing' | 'mcq-library' | 'mcq-session' | 'mcq-review';

interface QuizScreenProps {
  onOpenLiveAuntMinnie?: () => void;
}

const QuizScreen: React.FC<QuizScreenProps> = ({ onOpenLiveAuntMinnie }) => {
  const cachedWorkspace = getCachedQuizWorkspaceData();
  const [userRoles, setUserRoles] = useState<UserRole[]>(cachedWorkspace?.userRoles || []);
  const [availableQuizzes, setAvailableQuizzes] = useState<QuizListItem[]>(cachedWorkspace?.availableQuizzes || []);
  const [managedQuizzes, setManagedQuizzes] = useState<QuizListItem[]>(cachedWorkspace?.managedQuizzes || []);
  const [attempts, setAttempts] = useState<QuizAttempt[]>(cachedWorkspace?.attempts || []);
  const [quizQuestions, setQuizQuestions] = useState<Record<string, QuizQuestion[]>>(cachedWorkspace?.quizQuestions || {});
  const [activeQuiz, setActiveQuiz] = useState<QuizListItem | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttempt | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null);
  const [mode, setMode] = useState<ScreenMode>('landing');
  const [loading, setLoading] = useState(!cachedWorkspace);
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

  const canManage = canManageQuiz(userRoles);
  const handleOpenAuntMinnie = () => {
    void preloadCurrentLiveAuntMinnieRoom().catch(() => undefined);
    onOpenLiveAuntMinnie?.();
  };

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
            onOpenAuntMinnie={handleOpenAuntMinnie}
          />
          {error ? <ScreenStatusNotice tone="error" message={error} /> : null}
          {busy ? <ScreenStatusNotice message="Working on your quiz request..." /> : null}
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
          {error ? <ScreenStatusNotice tone="error" message={error} /> : null}
          {busy ? <ScreenStatusNotice message="Working on your quiz request..." /> : null}
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

    </PageShell>
  );
};

export default QuizScreen;
