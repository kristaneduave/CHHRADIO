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

type QuizRow = Quiz & {
  authorProfile?: {
    full_name: string | null;
    nickname?: string | null;
    role?: UserRole | null;
  } | null;
};

interface QuizWorkspaceData {
  userRole: UserRole | null;
  availableQuizzes: QuizListItem[];
  managedQuizzes: QuizListItem[];
  attempts: QuizAttempt[];
  quizQuestions: Record<string, QuizQuestion[]>;
}

const AUTHOR_ROLES: UserRole[] = ['admin', 'faculty'];
let quizWorkspaceCache: QuizWorkspaceData | null = null;
let quizWorkspacePromise: Promise<QuizWorkspaceData> | null = null;

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

export const isQuizAuthorRole = (role: UserRole | null) => !!role && AUTHOR_ROLES.includes(role);

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (error) {
    throw error;
  }

  return (data?.role as UserRole) || 'resident';
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

  const role = await getCurrentUserRole();
  let query = supabase
    .from('quizzes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (role !== 'admin') {
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  if (!quiz.can_start) {
    throw new Error('This quiz is not currently open.');
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

  const { data, error } = await supabase
    .from('quiz_attempts')
    .update({
      answers: validatedAnswers,
      score,
      total_questions: questions.length,
      percentage,
      submitted_at: new Date().toISOString(),
      time_spent_seconds: timeSpentSeconds,
      status: 'submitted',
    })
    .eq('id', attemptId)
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

const fetchQuizWorkspace = async (): Promise<QuizWorkspaceData> => {
  const role = await getCurrentUserRole();

  const [quizList, attemptList] = await Promise.all([
    listAvailableQuizzes(),
    listMyQuizAttempts(),
  ]);

  if (isQuizAuthorRole(role)) {
    const authorQuizzes = await listManagedQuizzes();
    const quizQuestions = await loadManagedQuestionCache(authorQuizzes);

    return {
      userRole: role,
      availableQuizzes: quizList,
      managedQuizzes: authorQuizzes,
      attempts: attemptList,
      quizQuestions,
    };
  }

  return {
    userRole: role,
    availableQuizzes: quizList,
    managedQuizzes: [],
    attempts: attemptList,
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

  quizWorkspacePromise = fetchQuizWorkspace()
    .then((data) => {
      quizWorkspaceCache = data;
      return data;
    })
    .finally(() => {
      quizWorkspacePromise = null;
    });

  return quizWorkspacePromise;
};

export const preloadQuizWorkspace = async (): Promise<void> => {
  await getQuizWorkspaceData();
};
