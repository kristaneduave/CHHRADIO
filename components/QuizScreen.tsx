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

type ScreenMode = 'library' | 'session' | 'review';

const QuizScreen: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [availableQuizzes, setAvailableQuizzes] = useState<QuizListItem[]>([]);
  const [managedQuizzes, setManagedQuizzes] = useState<QuizListItem[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [activeQuiz, setActiveQuiz] = useState<QuizListItem | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttempt | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null);
  const [mode, setMode] = useState<ScreenMode>('library');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const workspace = await getQuizWorkspaceData({ force });
      setUserRole(workspace.userRole);
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
      setMode('session');
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
      setMode('review');
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
    setMode('library');
    setActiveQuiz(null);
    setActiveQuestions([]);
    setActiveAttempt(null);
    setReviewAttempt(null);
  };

  if (loading) {
    return (
      <div className="px-6 pt-12 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 border-4 border-white/5 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-12 pb-8 flex flex-col gap-6 animate-in fade-in duration-500">
      <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Radiology Quiz Lab</h1>
          <p className="text-slate-400 text-sm mt-2 max-w-3xl">
            Radiology quizzes for resident training, with draft authoring, optional schedules, and timed sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
            {availableQuizzes.length} Published
          </span>
          <span className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
            {attempts.length} Attempts
          </span>
          {isQuizAuthorRole(userRole) && (
            <span className="px-3 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Author Access
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {busy && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
          Working on your quiz request...
        </div>
      )}

      {isQuizAuthorRole(userRole) && (
        <ManageQuizzesPanel
          quizzes={managedQuizzes}
          quizQuestions={quizQuestions}
          onCreate={handleCreateQuiz}
          onEdit={handleEditQuiz}
          onDuplicate={handleDuplicateQuiz}
          onDelete={handleDeleteQuiz}
        />
      )}

      {mode === 'session' && activeQuiz && activeAttempt ? (
        <QuizSession
          quiz={activeQuiz}
          questions={activeQuestions}
          attempt={activeAttempt}
          onCancel={resetSession}
          onSubmit={handleSubmitQuiz}
        />
      ) : mode === 'review' && activeQuiz && reviewAttempt ? (
        <QuizResultReview
          quiz={activeQuiz}
          questions={activeQuestions}
          attempt={reviewAttempt}
          onBack={resetSession}
          onRetake={handleStartQuiz}
        />
      ) : (
        <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_0.9fr] gap-6 items-start">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Available Quizzes</h2>
              <p className="text-sm text-slate-400 mt-2">Open quizzes are listed first, followed by scheduled releases and recently closed assessments.</p>
            </div>
            <QuizLibrary quizzes={availableQuizzes} onStart={handleStartQuiz} />
          </section>

          <section className="space-y-4">
            <MyQuizAttempts attempts={attempts} />
          </section>
        </div>
      )}
    </div>
  );
};

export default QuizScreen;
