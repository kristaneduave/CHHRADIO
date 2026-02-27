import { supabase } from './supabase';
import {
  QuizAnswerMap,
  QuizAttemptSummary,
  QuizClientEvent,
  QuizExam,
  QuizExamAnalyticsRow,
  QuizGroupAnalyticsRow,
  QuizQuestion,
  QuizQuestionAnalyticsRow,
  QuizUserAnalyticsRow,
  UserRole,
} from '../types';
import { normalizeUserRole } from '../utils/roles';

export type QuizExamWithCounts = QuizExam & { question_count: number; attempt_count: number };

export type QuizDraftQuestionInput = {
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
  points: number;
  question_type?: 'mcq' | 'image';
  image_url?: string | null;
};

export interface QuizAnalyticsData {
  exams: QuizExamAnalyticsRow[];
  questions: QuizQuestionAnalyticsRow[];
  users: QuizUserAnalyticsRow[];
  groups: QuizGroupAnalyticsRow[];
}

type QuizExamRow = {
  id: string;
  title: string;
  specialty: string;
  description: string | null;
  duration_minutes: number;
  pass_mark_percent?: number | null;
  status?: QuizExam['status'] | null;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type QuizExamIdRow = { id: string };
type ExamIdOnlyRow = { exam_id: string };

const toNumber = (value: unknown, defaultValue = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const toError = (error: unknown, fallback: string): Error => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? fallback);
    return new Error(message);
  }
  return new Error(fallback);
};

const normalizeExamRow = (row: QuizExamRow): QuizExam => ({
  ...row,
  pass_mark_percent: toNumber(row.pass_mark_percent, 70),
  status: row.status || (row.is_published ? 'published' : 'draft'),
});

const countByExamId = (rows: ExamIdOnlyRow[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  rows.forEach((row) => {
    counts[row.exam_id] = (counts[row.exam_id] || 0) + 1;
  });
  return counts;
};

export const getQuizBootstrapContext = async (): Promise<{ uid: string; role: UserRole }> => {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id ?? '';
  if (!uid) {
    return { uid: '', role: 'resident' };
  }

  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', uid).single();
  if (error) {
    throw toError(error, 'Failed to fetch profile role');
  }

  return { uid, role: normalizeUserRole(profile?.role) };
};

const fetchExamCounts = async (examIds: string[]): Promise<{ questionCount: Record<string, number>; attemptCount: Record<string, number> }> => {
  if (!examIds.length) {
    return { questionCount: {}, attemptCount: {} };
  }

  const [qRows, atRows] = await Promise.all([
    supabase.from('quiz_questions').select('exam_id').in('exam_id', examIds),
    supabase.from('quiz_attempts').select('exam_id').in('exam_id', examIds),
  ]);
  if (qRows.error) {
    throw toError(qRows.error, 'Failed to fetch question counts');
  }
  if (atRows.error) {
    throw toError(atRows.error, 'Failed to fetch attempt counts');
  }

  const questionCount = countByExamId((qRows.data ?? []) as ExamIdOnlyRow[]);
  const attemptCount = countByExamId((atRows.data ?? []) as ExamIdOnlyRow[]);
  return { questionCount, attemptCount };
};

export const listPublishedExamsWithCounts = async (): Promise<QuizExamWithCounts[]> => {
  let rows: QuizExamRow[] = [];
  const primary = await supabase
    .from('quiz_exams')
    .select('id,title,specialty,description,duration_minutes,pass_mark_percent,status,is_published,created_by,created_at,updated_at')
    .or('status.eq.published,is_published.eq.true');

  if (primary.error) {
    const fallback = await supabase
      .from('quiz_exams')
      .select('id,title,specialty,description,duration_minutes,is_published,created_by,created_at,updated_at')
      .eq('is_published', true);
    if (fallback.error) {
      throw toError(fallback.error, 'Failed to fetch published exams');
    }
    rows = ((fallback.data ?? []) as QuizExamRow[]).map((item) => ({
      ...item,
      pass_mark_percent: 70,
      status: item.is_published ? 'published' : 'draft',
    }));
  } else {
    rows = (primary.data ?? []) as QuizExamRow[];
  }

  const examIds = rows.map((row) => row.id);
  const counts = await fetchExamCounts(examIds);
  return rows.map((row) => ({
    ...normalizeExamRow(row),
    question_count: counts.questionCount[row.id] || 0,
    attempt_count: counts.attemptCount[row.id] || 0,
  }));
};

export const listManageExams = async (role: UserRole, uid: string): Promise<QuizExamWithCounts[]> => {
  let query = supabase
    .from('quiz_exams')
    .select('id,title,specialty,description,duration_minutes,pass_mark_percent,status,is_published,created_by,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (role === 'training_officer') {
    query = query.eq('created_by', uid);
  }
  const { data, error } = await query;
  if (error) {
    throw toError(error, 'Failed to fetch manage exams');
  }

  return ((data ?? []) as QuizExamRow[]).map((row) => ({
    ...normalizeExamRow(row),
    question_count: 0,
    attempt_count: 0,
  }));
};

export const listExamQuestions = async (examId: string): Promise<QuizQuestion[]> => {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id,exam_id,question_text,question_type,image_url,options,correct_answer_index,explanation,points,sort_order,created_at')
    .eq('exam_id', examId)
    .order('sort_order');
  if (error) {
    throw toError(error, 'Failed to fetch quiz questions');
  }

  return ((data ?? []) as QuizQuestion[]).map((row) => ({
    ...row,
    options: Array.isArray(row.options) ? row.options.map((item) => String(item)) : [],
  }));
};

export const submitQuizAttempt = async (
  examId: string,
  answers: QuizAnswerMap,
  startedAt: string,
  clientEvents: QuizClientEvent[],
): Promise<QuizAttemptSummary> => {
  const { data, error } = await supabase.rpc('submit_quiz_attempt', {
    p_exam_id: examId,
    p_answers: answers,
    p_started_at: startedAt,
    p_client_events: clientEvents,
  });
  if (error) {
    throw toError(error, 'Failed to submit quiz attempt');
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('No result returned.');
  }

  return {
    attempt_id: String(row.attempt_id),
    score: toNumber(row.score),
    total_points: toNumber(row.total_points),
    correct_count: toNumber(row.correct_count),
    is_pass: Boolean(row.is_pass),
    duration_seconds: toNumber(row.duration_seconds),
    completed_at: String(row.completed_at),
  };
};

export const saveExamWithQuestions = async (
  exam: Pick<QuizExam, 'id' | 'title' | 'specialty' | 'description' | 'duration_minutes' | 'pass_mark_percent' | 'status'>,
  createdBy: string,
  questions: QuizDraftQuestionInput[],
): Promise<{ examId: string; isNewExam: boolean }> => {
  let examId = exam.id;
  const isNewExam = !examId;
  if (!examId) {
    const insertResult = await supabase
      .from('quiz_exams')
      .insert({ ...exam, created_by: createdBy })
      .select('id')
      .single();
    if (insertResult.error) {
      throw toError(insertResult.error, 'Failed to create exam');
    }
    examId = ((insertResult.data as QuizExamIdRow | null)?.id ?? '');
    if (!examId) {
      throw new Error('Missing exam id after create.');
    }
  } else {
    const updateResult = await supabase.from('quiz_exams').update(exam).eq('id', examId);
    if (updateResult.error) {
      throw toError(updateResult.error, 'Failed to update exam');
    }
  }

  const deleteResult = await supabase.from('quiz_questions').delete().eq('exam_id', examId);
  if (deleteResult.error) {
    throw toError(deleteResult.error, 'Failed to reset exam questions');
  }

  const questionPayload = questions.map((question, sortOrder) => ({
    exam_id: examId,
    question_text: question.question_text.trim(),
    options: question.options.map((item) => item.trim()),
    correct_answer_index: question.correct_answer_index,
    explanation: question.explanation.trim(),
    points: Math.max(1, toNumber(question.points, 1)),
    sort_order: sortOrder,
    question_type: question.question_type || 'mcq',
    image_url: question.image_url || null,
  }));

  const insertQuestionsResult = await supabase.from('quiz_questions').insert(questionPayload);
  if (insertQuestionsResult.error) {
    throw toError(insertQuestionsResult.error, 'Failed to save quiz questions');
  }

  return { examId, isNewExam };
};

export const updateExamStatus = async (examId: string, status: QuizExam['status']): Promise<void> => {
  const { error } = await supabase.from('quiz_exams').update({ status }).eq('id', examId);
  if (error) {
    throw toError(error, 'Failed to update exam status');
  }
};

export const fetchQuizAnalytics = async (limit = 500): Promise<QuizAnalyticsData> => {
  const [exams, questions, users, groups] = await Promise.all([
    supabase.from('quiz_exam_analytics_v').select('*').limit(limit),
    supabase.from('quiz_question_analytics_v').select('*').limit(limit),
    supabase.from('quiz_user_analytics_v').select('*').limit(limit),
    supabase.from('quiz_group_analytics_v').select('*').limit(limit),
  ]);
  if (exams.error) {
    throw toError(exams.error, 'Failed to load exam analytics');
  }
  if (questions.error) {
    throw toError(questions.error, 'Failed to load question analytics');
  }
  if (users.error) {
    throw toError(users.error, 'Failed to load user analytics');
  }
  if (groups.error) {
    throw toError(groups.error, 'Failed to load group analytics');
  }

  return {
    exams: (exams.data ?? []) as QuizExamAnalyticsRow[],
    questions: (questions.data ?? []) as QuizQuestionAnalyticsRow[],
    users: (users.data ?? []) as QuizUserAnalyticsRow[],
    groups: (groups.data ?? []) as QuizGroupAnalyticsRow[],
  };
};
