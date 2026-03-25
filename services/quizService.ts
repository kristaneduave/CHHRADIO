import { supabase } from './supabase';
import {
  Quiz,
  QuizAnswer,
  QuizAttempt,
  QuizAuthorFormValues,
  QuizAvailability,
  QuizCorrectOption,
  QuizListItem,
  QuizQuestion,
  QuizQuestionFormValues,
  QuizStatus,
  UserRole,
} from '../types';
import { getCurrentUserRoleState } from './userRoleService';
import { hasAnyRole } from '../utils/roles';

type QuizRow = Quiz & {
  authorProfile?: {
    full_name: string | null;
    nickname?: string | null;
    role?: UserRole | null;
  } | null;
};

interface QuizWorkspaceData {
  userRole: UserRole | null;
  userRoles: UserRole[];
  availableQuizzes: QuizListItem[];
  managedQuizzes: QuizListItem[];
  attempts: QuizAttempt[];
  quizQuestions: Record<string, QuizQuestion[]>;
}

const AUTHOR_ROLES: UserRole[] = ['admin', 'faculty'];
type QuizLandingSnapshot = Pick<QuizWorkspaceData, 'userRole' | 'userRoles' | 'availableQuizzes' | 'attempts'>;
let quizWorkspaceCache: QuizWorkspaceData | null = null;
let quizWorkspacePromise: Promise<QuizWorkspaceData> | null = null;
let quizLandingCache: QuizLandingSnapshot | null = null;
let quizLandingPromise: Promise<QuizLandingSnapshot> | null = null;

const getAuthenticatedUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  return user;
};

const getAttemptByIdForUser = async (attemptId: string, userId: string): Promise<QuizAttempt> => {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data as QuizAttempt;
};

const getActiveAttemptForQuiz = async (quizId: string, userId: string): Promise<QuizAttempt | null> => {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as QuizAttempt | null) || null;
};

const computeAuthoritativeElapsedSeconds = (attempt: Pick<QuizAttempt, 'started_at' | 'timer_enabled' | 'timer_minutes'>) => {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000));
  const timeLimitSeconds = attempt.timer_enabled && attempt.timer_minutes
    ? Math.max(0, attempt.timer_minutes * 60)
    : null;

  return {
    elapsedSeconds,
    timeLimitSeconds,
    exceededLimit: timeLimitSeconds !== null && elapsedSeconds > timeLimitSeconds,
  };
};

const getAvailability = (quiz: Pick<Quiz, 'status' | 'opens_at' | 'closes_at'>): QuizAvailability => {
  const now = Date.now();
  const opensAt = new Date(quiz.opens_at).getTime();
  const closesAt = new Date(quiz.closes_at).getTime();

  if (quiz.status !== 'published' || now >= closesAt) {
    return 'closed';
  }

  if (now < opensAt) {
    return 'scheduled';
  }

  return 'open';
};

const normalizeQuiz = (row: QuizRow, questionCount = 0): QuizListItem => ({
  ...row,
  description: row.description ?? '',
  question_count: questionCount,
  author_name: row.authorProfile?.nickname || row.authorProfile?.full_name || 'Unknown author',
  author_role: row.authorProfile?.role || null,
  availability: getAvailability(row),
  can_start: row.status === 'published' && getAvailability(row) === 'open',
});

const attachAuthorProfiles = async (rows: Quiz[]): Promise<QuizRow[]> => {
  const authorIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean)));

  if (authorIds.length === 0) {
    return rows as QuizRow[];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, nickname, role')
    .in('id', authorIds);

  if (error) {
    throw error;
  }

  const profilesById = new Map(
    (data || []).map((profile) => [
      profile.id as string,
      {
        full_name: (profile.full_name as string | null) ?? null,
        nickname: (profile.nickname as string | null) ?? null,
        role: (profile.role as UserRole | null) ?? null,
      },
    ]),
  );

  return rows.map((row) => ({
    ...row,
    authorProfile: profilesById.get(row.created_by) || null,
  }));
};

const fetchQuestionCounts = async (quizIds: string[]) => {
  if (quizIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await supabase
    .from('quiz_questions')
    .select('quiz_id')
    .in('quiz_id', quizIds);

  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();
  for (const row of data || []) {
    counts.set(row.quiz_id, (counts.get(row.quiz_id) || 0) + 1);
  }

  return counts;
};

const mapQuestionInput = (quizId: string, questions: QuizQuestionFormValues[]) =>
  questions.map((question, index) => ({
    quiz_id: quizId,
    sort_order: index,
    stem: question.stem.trim(),
    clinical_context: question.clinical_context.trim() || null,
    image_url: question.image_url.trim() || null,
    option_a: question.option_a.trim(),
    option_b: question.option_b.trim(),
    option_c: question.option_c.trim(),
    option_d: question.option_d.trim(),
    option_e: question.option_e.trim() || null,
    correct_option: question.correct_option,
    explanation: question.explanation.trim() || null,
    teaching_point: question.teaching_point.trim() || null,
    pitfall: question.pitfall.trim() || null,
    modality: question.modality.trim() || null,
    anatomy_region: question.anatomy_region.trim() || null,
    difficulty: question.difficulty,
  }));

const validateQuestionPayload = (questions: QuizQuestionFormValues[]) => {
  if (questions.length === 0) {
    throw new Error('Add at least one question before saving a quiz.');
  }

  questions.forEach((question, index) => {
    if (!question.stem.trim()) {
      throw new Error(`Question ${index + 1}: stem is required.`);
    }

    if (!question.option_a.trim() || !question.option_b.trim() || !question.option_c.trim() || !question.option_d.trim()) {
      throw new Error(`Question ${index + 1}: options A to D are required.`);
    }
    if (question.correct_option === 'E' && !question.option_e.trim()) {
      throw new Error(`Question ${index + 1}: option E is required when the correct answer is E.`);
    }
  });
};

export const isQuizAuthorRole = (role: UserRole | UserRole[] | null) => hasAnyRole(role, AUTHOR_ROLES);

const loadManagedQuestionCache = async (quizzes: QuizListItem[]) => {
  if (quizzes.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    quizzes.map(async (quiz) => {
      try {
        const details = await getQuizWithQuestions(quiz.id);
        return [quiz.id, details.questions] as const;
      } catch {
        return [quiz.id, []] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
};

export const getCurrentUserRole = async (): Promise<UserRole | null> => {
  const roleState = await getCurrentUserRoleState();
  if (!roleState) {
    return null;
  }

  return roleState.primaryRole;
};

export const getCurrentUserRoles = async (): Promise<UserRole[]> => {
  const roleState = await getCurrentUserRoleState();
  return roleState?.roles || [];
};

export const listAvailableQuizzes = async (): Promise<QuizListItem[]> => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .order('opens_at', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = await attachAuthorProfiles((data || []) as Quiz[]);
  const counts = await fetchQuestionCounts(rows.map((row) => row.id));

  return rows
    .map((row) => normalizeQuiz(row, counts.get(row.id) || 0))
    .sort((a, b) => {
      const order = { open: 0, scheduled: 1, closed: 2 } as const;
      const availabilityDiff = order[a.availability] - order[b.availability];
      if (availabilityDiff !== 0) return availabilityDiff;
      return new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime();
    });
};

export const listManagedQuizzes = async (): Promise<QuizListItem[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const roles = await getCurrentUserRoles();
  let query = supabase
    .from('quizzes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (!hasAnyRole(roles, ['admin'])) {
    query = query.eq('created_by', user.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = await attachAuthorProfiles((data || []) as Quiz[]);
  const counts = await fetchQuestionCounts(rows.map((row) => row.id));
  return rows.map((row) => normalizeQuiz(row, counts.get(row.id) || 0));
};

export const getQuizWithQuestions = async (quizId: string): Promise<{ quiz: QuizListItem; questions: QuizQuestion[] }> => {
  const { data: quizData, error: quizError } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();

  if (quizError) {
    throw quizError;
  }

  const [quizWithAuthor] = await attachAuthorProfiles([quizData as Quiz]);

  const { data: questions, error: questionError } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('sort_order', { ascending: true });

  if (questionError) {
    throw questionError;
  }

  return {
    quiz: normalizeQuiz(quizWithAuthor, (questions || []).length),
    questions: (questions || []) as QuizQuestion[],
  };
};

export const createQuiz = async (payload: QuizAuthorFormValues): Promise<QuizListItem> => {
  validateQuestionPayload(payload.questions);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      title: payload.title.trim(),
      description: payload.description.trim() || null,
      specialty: payload.specialty,
      target_level: payload.target_level,
      timer_enabled: payload.timer_enabled,
      timer_minutes: payload.timer_enabled ? Number(payload.timer_minutes) : null,
      opens_at: new Date(payload.opens_at).toISOString(),
      closes_at: new Date(payload.closes_at).toISOString(),
      status: payload.status,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await saveQuizQuestions(data.id, payload.questions);
  const [quizWithAuthor] = await attachAuthorProfiles([data as Quiz]);
  return normalizeQuiz(quizWithAuthor, payload.questions.length);
};

export const updateQuiz = async (quizId: string, payload: QuizAuthorFormValues): Promise<QuizListItem> => {
  validateQuestionPayload(payload.questions);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('quizzes')
    .update({
      title: payload.title.trim(),
      description: payload.description.trim() || null,
      specialty: payload.specialty,
      target_level: payload.target_level,
      timer_enabled: payload.timer_enabled,
      timer_minutes: payload.timer_enabled ? Number(payload.timer_minutes) : null,
      opens_at: new Date(payload.opens_at).toISOString(),
      closes_at: new Date(payload.closes_at).toISOString(),
      status: payload.status,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quizId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await saveQuizQuestions(quizId, payload.questions);
  const [quizWithAuthor] = await attachAuthorProfiles([data as Quiz]);
  return normalizeQuiz(quizWithAuthor, payload.questions.length);
};

export const deleteQuiz = async (quizId: string) => {
  const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
  if (error) {
    throw error;
  }
};

export const duplicateQuiz = async (quizId: string): Promise<QuizListItem> => {
  const { quiz, questions } = await getQuizWithQuestions(quizId);
  const clonePayload: QuizAuthorFormValues = {
    title: `${quiz.title} (Copy)`,
    description: quiz.description || '',
    specialty: quiz.specialty,
    target_level: 'mixed',
    timer_enabled: quiz.timer_enabled,
    timer_minutes: quiz.timer_minutes || '',
    opens_at: quiz.opens_at.slice(0, 16),
    closes_at: quiz.closes_at.slice(0, 16),
    status: 'draft',
    questions: questions.map((question) => ({
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
    })),
  };

  return createQuiz(clonePayload);
};

export const saveQuizQuestions = async (quizId: string, questions: QuizQuestionFormValues[]) => {
  validateQuestionPayload(questions);

  const { error: deleteError } = await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);
  if (deleteError) {
    throw deleteError;
  }

  const payload = mapQuestionInput(quizId, questions);
  const { error } = await supabase.from('quiz_questions').insert(payload);
  if (error) {
    throw error;
  }
};

export const uploadQuizQuestionImage = async (file: File, questionIndex: number) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image must be 15MB or smaller.');
  }

  const extension = file.name.split('.').pop() || 'jpg';
  const path = `${user.id}/${Date.now()}-${questionIndex}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('quiz-images')
    .upload(path, file, { upsert: true });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from('quiz-images').getPublicUrl(path);
  return data.publicUrl;
};

export const startQuizAttempt = async (quiz: QuizListItem) => {
  const user = await getAuthenticatedUser();

  if (!quiz.can_start) {
    throw new Error('This quiz is not currently open.');
  }

  const activeAttempt = await getActiveAttemptForQuiz(quiz.id, user.id);
  if (activeAttempt) {
    return activeAttempt;
  }

  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id: quiz.id,
      user_id: user.id,
      total_questions: quiz.question_count || 0,
      timer_enabled: quiz.timer_enabled,
      timer_minutes: quiz.timer_minutes,
      status: 'in_progress',
      answers: [],
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as QuizAttempt;
};

export const submitQuizAttempt = async (
  attemptId: string,
  questions: QuizQuestion[],
  answers: Array<{ questionId: string; selectedOption: QuizCorrectOption | null }>,
  timeSpentSeconds: number,
) => {
  const user = await getAuthenticatedUser();
  const attempt = await getAttemptByIdForUser(attemptId, user.id);

  if (attempt.status !== 'in_progress') {
    throw new Error('This quiz attempt has already been submitted or closed.');
  }

  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const validatedAnswers: QuizAnswer[] = answers.map((answer) => {
    const question = questionMap.get(answer.questionId);
    return {
      questionId: answer.questionId,
      selectedOption: answer.selectedOption,
      isCorrect: !!question && answer.selectedOption === question.correct_option,
    };
  });

  const score = validatedAnswers.filter((answer) => answer.isCorrect).length;
  const percentage = questions.length ? Number(((score / questions.length) * 100).toFixed(2)) : 0;
  const { elapsedSeconds, timeLimitSeconds, exceededLimit } = computeAuthoritativeElapsedSeconds(attempt);
  const authoritativeTimeSpent = Math.max(timeSpentSeconds, elapsedSeconds);

  if (exceededLimit) {
    throw new Error(
      `This timed quiz expired after ${timeLimitSeconds} seconds and can no longer be submitted from an open session.`
    );
  }

  const { data, error } = await supabase
    .from('quiz_attempts')
    .update({
      answers: validatedAnswers,
      score,
      total_questions: questions.length,
      percentage,
      submitted_at: new Date().toISOString(),
      time_spent_seconds: authoritativeTimeSpent,
      status: 'submitted',
    })
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as QuizAttempt;
};

export const listMyQuizAttempts = async (): Promise<QuizAttempt[]> => {
  const { data, error } = await supabase
    .from('quiz_attempt_summaries')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((attempt: any) => ({
    id: attempt.id,
    quiz_id: attempt.quiz_id,
    user_id: attempt.user_id,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
    score: attempt.score,
    total_questions: attempt.total_questions,
    percentage: Number(attempt.percentage || 0),
    timer_enabled: attempt.timer_enabled,
    timer_minutes: attempt.timer_minutes,
    time_spent_seconds: attempt.time_spent_seconds,
    status: attempt.status,
    answers: (attempt.answers || []) as QuizAnswer[],
    quiz: {
      id: attempt.quiz_id,
      title: attempt.title,
      description: '',
      specialty: attempt.specialty,
      target_level: attempt.target_level,
      timer_enabled: attempt.timer_enabled,
      timer_minutes: attempt.timer_minutes,
      opens_at: attempt.opens_at,
      closes_at: attempt.closes_at,
      status: attempt.quiz_status as QuizStatus,
      created_by: attempt.created_by,
      question_count: attempt.total_questions,
      availability: getAvailability({
        status: attempt.quiz_status,
        opens_at: attempt.opens_at,
        closes_at: attempt.closes_at,
      }),
      can_start: getAvailability({
        status: attempt.quiz_status,
        opens_at: attempt.opens_at,
        closes_at: attempt.closes_at,
      }) === 'open' && attempt.quiz_status === 'published',
    },
  }));
};

const fetchQuizLandingSnapshot = async (): Promise<QuizLandingSnapshot> => {
  const roleState = await getCurrentUserRoleState();
  const role = roleState?.primaryRole || null;
  const roles = roleState?.roles || [];

  const [quizList, attemptList] = await Promise.all([
    listAvailableQuizzes(),
    listMyQuizAttempts(),
  ]);

  return {
    userRole: role,
    userRoles: roles,
    availableQuizzes: quizList,
    attempts: attemptList,
  };
};

const getQuizLandingSnapshot = async (options?: { force?: boolean }): Promise<QuizLandingSnapshot> => {
  const force = Boolean(options?.force);

  if (!force && quizWorkspaceCache) {
    return quizWorkspaceCache;
  }

  if (!force && quizLandingCache) {
    return quizLandingCache;
  }

  if (!force && quizLandingPromise) {
    return quizLandingPromise;
  }

  quizLandingPromise = fetchQuizLandingSnapshot()
    .then((data) => {
      quizLandingCache = data;
      return data;
    })
    .finally(() => {
      quizLandingPromise = null;
    });

  return quizLandingPromise;
};

const fetchQuizWorkspace = async (options?: { force?: boolean }): Promise<QuizWorkspaceData> => {
  const landingSnapshot = await getQuizLandingSnapshot(options);

  if (isQuizAuthorRole(landingSnapshot.userRoles)) {
    const authorQuizzes = await listManagedQuizzes();
    const quizQuestions = await loadManagedQuestionCache(authorQuizzes);

    return {
      ...landingSnapshot,
      managedQuizzes: authorQuizzes,
      quizQuestions,
    };
  }

  return {
    ...landingSnapshot,
    managedQuizzes: [],
    quizQuestions: {},
  };
};

export const getQuizWorkspaceData = async (options?: { force?: boolean }): Promise<QuizWorkspaceData> => {
  const force = Boolean(options?.force);

  if (!force && quizWorkspaceCache) {
    return quizWorkspaceCache;
  }

  if (!force && quizWorkspacePromise) {
    return quizWorkspacePromise;
  }

  quizWorkspacePromise = fetchQuizWorkspace({ force })
    .then((data) => {
      quizWorkspaceCache = data;
      quizLandingCache = data;
      return data;
    })
    .finally(() => {
      quizWorkspacePromise = null;
    });

  return quizWorkspacePromise;
};

export const preloadQuizWorkspace = async (): Promise<void> => {
  await getQuizLandingSnapshot();

  if (!quizWorkspaceCache && !quizWorkspacePromise) {
    void getQuizWorkspaceData().catch(() => undefined);
  }
};

export const getCachedQuizWorkspaceData = (): QuizWorkspaceData | null =>
  quizWorkspaceCache
  || (quizLandingCache
    ? {
        ...quizLandingCache,
        managedQuizzes: [],
        quizQuestions: {},
      }
    : null);
