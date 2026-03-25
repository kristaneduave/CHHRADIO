import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizScreen from './QuizScreen';
import { QuizAttempt, QuizListItem, QuizQuestion } from '../types';

const mockGetQuizWorkspaceData = vi.fn();
const mockGetQuizWithQuestions = vi.fn();
const mockStartQuizAttempt = vi.fn();
const mockSubmitQuizAttempt = vi.fn();
const mockCreateQuiz = vi.fn();
const mockUpdateQuiz = vi.fn();
const mockDeleteQuiz = vi.fn();
const mockDuplicateQuiz = vi.fn();

vi.mock('../services/quizService', () => ({
  getQuizWorkspaceData: (...args: unknown[]) => mockGetQuizWorkspaceData(...args),
  getQuizWithQuestions: (...args: unknown[]) => mockGetQuizWithQuestions(...args),
  startQuizAttempt: (...args: unknown[]) => mockStartQuizAttempt(...args),
  submitQuizAttempt: (...args: unknown[]) => mockSubmitQuizAttempt(...args),
  createQuiz: (...args: unknown[]) => mockCreateQuiz(...args),
  updateQuiz: (...args: unknown[]) => mockUpdateQuiz(...args),
  deleteQuiz: (...args: unknown[]) => mockDeleteQuiz(...args),
  duplicateQuiz: (...args: unknown[]) => mockDuplicateQuiz(...args),
  isQuizAuthorRole: (roles: string[]) => roles.includes('admin') || roles.includes('faculty'),
}));

vi.mock('../services/liveAuntMinnieService', () => ({
  isLiveAuntMinnieHostRole: (role: string | null | undefined) =>
    ['admin', 'faculty', 'consultant', 'training_officer'].includes(String(role || '')),
}));

vi.mock('./quiz/QuizSession', () => ({
  default: () => <div>Quiz Session</div>,
}));

vi.mock('./quiz/QuizResultReview', () => ({
  default: () => <div>Quiz Result Review</div>,
}));

const baseQuiz: QuizListItem = {
  id: 'quiz-1',
  title: 'Chest Imaging Review',
  description: 'Review common chest cases.',
  specialty: 'Thoracic',
  target_level: 'mixed',
  timer_enabled: true,
  timer_minutes: 20,
  opens_at: '2026-03-25T00:00:00.000Z',
  closes_at: '2026-03-30T00:00:00.000Z',
  status: 'published',
  created_by: 'author-1',
  question_count: 12,
  availability: 'open',
  can_start: true,
  author_name: 'Dr. Atlas',
  author_role: 'admin',
};

const baseAttempt: QuizAttempt = {
  id: 'attempt-1',
  quiz_id: 'quiz-1',
  user_id: 'user-1',
  started_at: '2026-03-25T01:00:00.000Z',
  submitted_at: '2026-03-25T01:20:00.000Z',
  score: 10,
  total_questions: 12,
  percentage: 83.3,
  timer_enabled: true,
  timer_minutes: 20,
  time_spent_seconds: 900,
  status: 'submitted',
  answers: [],
  quiz: baseQuiz,
};

const baseQuestions: QuizQuestion[] = [];

describe('QuizScreen', () => {
  beforeEach(() => {
    mockGetQuizWorkspaceData.mockReset();
    mockGetQuizWithQuestions.mockReset();
    mockStartQuizAttempt.mockReset();
    mockSubmitQuizAttempt.mockReset();
    mockCreateQuiz.mockReset();
    mockUpdateQuiz.mockReset();
    mockDeleteQuiz.mockReset();
    mockDuplicateQuiz.mockReset();
  });

  it('renders the landing view by default with the two primary options', async () => {
    mockGetQuizWorkspaceData.mockResolvedValue({
      userRoles: ['resident'],
      userRole: 'resident',
      availableQuizzes: [baseQuiz],
      managedQuizzes: [],
      attempts: [baseAttempt],
      quizQuestions: {},
    });

    render(<QuizScreen onOpenLiveAuntMinnie={() => undefined} />);

    expect(await screen.findByText('Quiz Lab')).toBeInTheDocument();
    expect(screen.getByText('Aunt Minnie')).toBeInTheDocument();
    expect(screen.getByText('Multiple Choice Exam')).toBeInTheDocument();
    expect(screen.queryByText('Faculty Authoring Workspace')).not.toBeInTheDocument();
    expect(screen.queryByText('My Attempts')).not.toBeInTheDocument();
  });

  it('opens the MCQ branch and returns to the landing view', async () => {
    mockGetQuizWorkspaceData.mockResolvedValue({
      userRoles: ['resident'],
      userRole: 'resident',
      availableQuizzes: [baseQuiz],
      managedQuizzes: [],
      attempts: [baseAttempt],
      quizQuestions: {},
    });

    render(<QuizScreen onOpenLiveAuntMinnie={() => undefined} />);

    fireEvent.click(await screen.findByText('Multiple Choice Exam'));

    expect(await screen.findByText('Published assessments')).toBeInTheDocument();
    expect(screen.getByText('My Attempts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByText('Quiz Lab')).toBeInTheDocument();
      expect(screen.getByText('Aunt Minnie')).toBeInTheDocument();
    });
  });

  it('shows author tools as a secondary manage affordance for author roles', async () => {
    mockGetQuizWorkspaceData.mockResolvedValue({
      userRoles: ['admin'],
      userRole: 'admin',
      availableQuizzes: [baseQuiz],
      managedQuizzes: [baseQuiz],
      attempts: [baseAttempt],
      quizQuestions: { 'quiz-1': baseQuestions },
    });

    render(<QuizScreen onOpenLiveAuntMinnie={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: /manage/i }));

    expect(await screen.findByText('Faculty Authoring Workspace')).toBeInTheDocument();
    expect(screen.queryByText('Manage Quizzes')).toBeInTheDocument();
  });
});
