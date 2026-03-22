import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  AuntMinnieCaseOption,
  LiveAuntMinnieMessage,
  LiveAuntMinnieCreatePayload,
  LiveAuntMinnieJudgment,
  LiveAuntMinnieParticipant,
  LiveAuntMinniePrompt,
  LiveAuntMinniePromptImage,
  LiveAuntMinniePromptInput,
  LiveAuntMinnieResponse,
  LiveAuntMinnieRoomState,
  LiveAuntMinnieSession,
  LiveAuntMinnieSubmitMessagePayload,
  LiveAuntMinnieSubmitResponsePayload,
  Profile,
  SubmissionType,
  UserRole,
} from '../types';

type WorkspaceData = {
  currentUserId: string;
  currentUserRole: UserRole | null;
  canHost: boolean;
  hostSessions: LiveAuntMinnieSession[];
  joinableSessions: LiveAuntMinnieSession[];
  auntMinnieCases: AuntMinnieCaseOption[];
};

type SessionRow = LiveAuntMinnieSession;

type PromptImageRow = LiveAuntMinniePromptImage;

type PromptRow = Omit<LiveAuntMinniePrompt, 'images'> & {
  live_aunt_minnie_prompt_images?: PromptImageRow[] | null;
  images?: PromptImageRow[] | null;
};

type ParticipantRow = LiveAuntMinnieParticipant & {
  profile?: {
    full_name: string | null;
    nickname?: string | null;
    avatar_url?: string | null;
    role?: UserRole | null;
  } | null;
};

type ResponseRow = LiveAuntMinnieResponse & {
  participant?: {
    full_name: string | null;
    nickname?: string | null;
    avatar_url?: string | null;
    role?: UserRole | null;
  } | null;
};

type MessageRow = LiveAuntMinnieMessage & {
  participant?: {
    full_name: string | null;
    nickname?: string | null;
    avatar_url?: string | null;
    role?: UserRole | null;
  } | null;
};

type PersistedPromptRow = {
  session_id: string;
  sort_order: number;
  source_case_id: string | null;
  image_url: string;
  image_caption: string | null;
  question_text: string | null;
  official_answer: string;
  answer_explanation: string | null;
  accepted_aliases: string[];
};

const HOST_ROLES: UserRole[] = ['admin', 'faculty', 'consultant', 'training_officer'];
const PROMPT_PLACEHOLDER_ANSWER = 'Pending TO answer';

export const isLiveAuntMinnieHostRole = (role: UserRole | null | undefined) =>
  Boolean(role && HOST_ROLES.includes(role));

export const isLiveAuntMinnieTrainingOfficerRole = (role: UserRole | null | undefined) =>
  role === 'training_officer';

export const isLiveAuntMinnieRoomManagerRole = (role: UserRole | null | undefined) =>
  role === 'training_officer' || role === 'admin';

const buildJoinCode = () =>
  Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();

const normalizePromptInput = (prompt: LiveAuntMinniePromptInput, index: number) => ({
  sort_order: index,
  source_case_id: prompt.source_case_id || null,
  question_text: prompt.question_text?.trim() || null,
  official_answer: prompt.official_answer.trim() || PROMPT_PLACEHOLDER_ANSWER,
  answer_explanation: prompt.answer_explanation?.trim() || null,
  accepted_aliases: [],
  images: (prompt.images || [])
    .map((image, imageIndex) => ({
      sort_order: imageIndex,
      image_url: image.image_url.trim(),
      caption: image.caption?.trim() || null,
    }))
    .filter((image) => Boolean(image.image_url)),
});

const validatePromptInputs = (prompts: LiveAuntMinniePromptInput[]) => {
  if (prompts.length === 0) {
    return;
  }

  prompts.forEach((prompt, index) => {
    const imageCount = (prompt.images || []).filter((image) => image.image_url.trim()).length;
    if (imageCount === 0) {
      throw new Error(`Question ${index + 1} needs at least one image.`);
    }
  });
};

const mapCaseOption = (row: any): AuntMinnieCaseOption => ({
  id: row.id as string,
  title: (row.title as string) || 'Aunt Minnie',
  imageUrl: (Array.isArray(row.image_urls) && row.image_urls[0]) || row.image_url || null,
  imageUrls: Array.isArray(row.image_urls)
    ? row.image_urls.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
    : row.image_url
      ? [row.image_url]
      : [],
  diagnosis: (row.diagnosis as string | null) || null,
  notes: (row.educational_summary as string | null) || null,
  submissionType: (row.submission_type as SubmissionType | null) || null,
});

const mapSession = (row: any): LiveAuntMinnieSession => ({
  id: row.id,
  title: row.title,
  created_by: row.created_by,
  host_user_id: row.host_user_id,
  status: row.status,
  current_prompt_index: Number(row.current_prompt_index || 0),
  current_phase: row.current_phase,
  prompt_count: Number(row.prompt_count || 0),
  started_at: row.started_at || null,
  ended_at: row.ended_at || null,
  join_code: row.join_code || null,
  allow_late_join: Boolean(row.allow_late_join),
  auto_advance_interval_seconds: row.auto_advance_interval_seconds ? Number(row.auto_advance_interval_seconds) : null,
  next_prompt_at: row.next_prompt_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapPromptImage = (row: any): LiveAuntMinniePromptImage => ({
  id: row.id,
  prompt_id: row.prompt_id,
  session_id: row.session_id,
  sort_order: Number(row.sort_order || 0),
  image_url: row.image_url,
  caption: row.caption || row.image_caption || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapPrompt = (row: PromptRow): LiveAuntMinniePrompt => {
  const rawImages = row.images || row.live_aunt_minnie_prompt_images || [];
  const images = (rawImages || [])
    .map(mapPromptImage)
    .sort((left, right) => left.sort_order - right.sort_order);

  if (images.length === 0 && row.image_url) {
    images.push({
      id: `${row.id}:legacy`,
      prompt_id: row.id,
      session_id: row.session_id,
      sort_order: 0,
      image_url: row.image_url,
      caption: row.image_caption || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  return {
    id: row.id,
    session_id: row.session_id,
    sort_order: Number(row.sort_order || 0),
    source_case_id: row.source_case_id || null,
    image_url: row.image_url,
    image_caption: row.image_caption || null,
    question_text: row.question_text || null,
    official_answer: row.official_answer,
    answer_explanation: row.answer_explanation || null,
    accepted_aliases: Array.isArray(row.accepted_aliases) ? row.accepted_aliases : [],
    images,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const mapParticipant = (row: ParticipantRow): LiveAuntMinnieParticipant => ({
  id: row.id,
  session_id: row.session_id,
  user_id: row.user_id,
  role: row.role,
  joined_at: row.joined_at,
  last_seen_at: row.last_seen_at,
  profile: row.profile || null,
});

const mapResponse = (row: ResponseRow): LiveAuntMinnieResponse => ({
  id: row.id,
  session_id: row.session_id,
  prompt_id: row.prompt_id,
  user_id: row.user_id,
  response_text: row.response_text,
  judgment: (row.judgment || 'unreviewed') as LiveAuntMinnieJudgment,
  consultant_note: row.consultant_note || null,
  submitted_at: row.submitted_at,
  updated_at: row.updated_at || row.submitted_at,
  reviewed_at: row.reviewed_at || null,
  reviewed_by: row.reviewed_by || null,
  participant: row.participant || null,
});

const mapMessage = (row: MessageRow): LiveAuntMinnieMessage => ({
  id: row.id,
  session_id: row.session_id,
  prompt_id: row.prompt_id,
  user_id: row.user_id,
  body: row.body,
  created_at: row.created_at,
  updated_at: row.updated_at || row.created_at,
  participant: row.participant || null,
});

const buildResponseMaps = (responses: LiveAuntMinnieResponse[], userId: string) => {
  const responsesByPromptId: Record<string, LiveAuntMinnieResponse[]> = {};
  const myResponsesByPromptId: Record<string, LiveAuntMinnieResponse | null> = {};

  responses.forEach((response) => {
    if (!responsesByPromptId[response.prompt_id]) {
      responsesByPromptId[response.prompt_id] = [];
    }
    responsesByPromptId[response.prompt_id].push(response);
    if (response.user_id === userId) {
      myResponsesByPromptId[response.prompt_id] = response;
    }
  });

  return { responsesByPromptId, myResponsesByPromptId };
};

const buildMessageMap = (messages: LiveAuntMinnieMessage[]) => {
  const messagesByPromptId: Record<string, LiveAuntMinnieMessage[]> = {};

  messages.forEach((message) => {
    if (!messagesByPromptId[message.prompt_id]) {
      messagesByPromptId[message.prompt_id] = [];
    }
    messagesByPromptId[message.prompt_id].push(message);
  });

  Object.values(messagesByPromptId).forEach((thread) => {
    thread.sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  });

  return { messagesByPromptId };
};

const getAuthenticatedProfile = async (): Promise<{ userId: string; profile: Profile | null }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    throw error;
  }

  return {
    userId: user.id,
    profile: (data as Profile | null) || null,
  };
};

const ensureHostRole = (role: UserRole | null | undefined) => {
  if (!isLiveAuntMinnieRoomManagerRole(role)) {
    throw new Error('Only the training officer or an admin can create or upload to a live Aunt Minnie room.');
  }
};

const upsertParticipant = async (sessionId: string, userId: string, role: 'host' | 'participant' = 'participant') => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('live_aunt_minnie_participants')
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        role,
        last_seen_at: now,
      },
      { onConflict: 'session_id,user_id' },
    );

  if (error) {
    throw error;
  }
};

const createPromptRows = (sessionId: string, prompts: LiveAuntMinniePromptInput[]): PersistedPromptRow[] =>
  prompts.map((prompt, index) => {
    const normalized = normalizePromptInput(prompt, index);
    return {
      session_id: sessionId,
      sort_order: normalized.sort_order,
      source_case_id: normalized.source_case_id,
      image_url: normalized.images[0]?.image_url || '',
      image_caption: normalized.images[0]?.caption || null,
      question_text: normalized.question_text,
      official_answer: normalized.official_answer,
      answer_explanation: normalized.answer_explanation,
      accepted_aliases: normalized.accepted_aliases,
    };
  });

const createPromptImagesPayload = (
  sessionId: string,
  prompts: LiveAuntMinniePromptInput[],
  promptRows: Array<{ id: string }>,
) =>
  prompts.flatMap((prompt, index) => {
    const normalized = normalizePromptInput(prompt, index);
    return normalized.images.map((image) => ({
      prompt_id: promptRows[index].id,
      session_id: sessionId,
      sort_order: image.sort_order,
      image_url: image.image_url,
      caption: image.caption,
    }));
  });

export const uploadLiveAuntMinnieImage = async (file: File) => {
  const { userId } = await getAuthenticatedProfile();
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }

  const extension = file.name.split('.').pop() || 'jpg';
  const path = `live-aunt-minnie/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('quiz-images')
    .upload(path, file, { upsert: true });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from('quiz-images').getPublicUrl(path);
  return data.publicUrl;
};

export const listAuntMinnieCases = async (): Promise<AuntMinnieCaseOption[]> => {
  const { userId } = await getAuthenticatedProfile();
  const { data, error } = await supabase
    .from('cases')
    .select('id, title, image_url, image_urls, diagnosis, educational_summary, submission_type, status, created_by')
    .in('submission_type', ['interesting_case', 'rare_pathology', 'aunt_minnie'])
    .or(`status.eq.published,created_by.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    throw error;
  }

  return (data || [])
    .map(mapCaseOption)
    .filter((item) => Boolean(item.imageUrl));
};

const listHostSessions = async (userId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .select('*')
    .eq('host_user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return ((data || []) as SessionRow[]).map(mapSession);
};

const listJoinableSessions = async () => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .select('*')
    .in('status', ['live', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return ((data || []) as SessionRow[]).map(mapSession);
};

export const getLiveAuntMinnieWorkspace = async (): Promise<WorkspaceData> => {
  const { userId, profile } = await getAuthenticatedProfile();
  const canHost = isLiveAuntMinnieRoomManagerRole(profile?.role);

  const [hostSessions, joinableSessions, auntMinnieCases] = await Promise.all([
    canHost ? listHostSessions(userId) : Promise.resolve([]),
    listJoinableSessions(),
    canHost ? listAuntMinnieCases() : Promise.resolve([]),
  ]);

  return {
    currentUserId: userId,
    currentUserRole: profile?.role || null,
    canHost,
    hostSessions,
    joinableSessions,
    auntMinnieCases,
  };
};

export const createLiveAuntMinnieSession = async (payload: LiveAuntMinnieCreatePayload) => {
  validatePromptInputs(payload.prompts);
  const { userId, profile } = await getAuthenticatedProfile();
  ensureHostRole(profile?.role);

  const joinCode = buildJoinCode();
  const { data: sessionId, error: sessionInsertError } = await supabase
    .rpc('create_live_aunt_minnie_session', {
      p_title: payload.title.trim(),
      p_join_code: joinCode,
      p_allow_late_join: payload.allowLateJoin ?? true,
      p_prompt_count: payload.prompts.length,
    });

  if (sessionInsertError) {
    throw sessionInsertError;
  }

  const { data: activatedSession, error: activateError } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      status: 'live',
      current_phase: 'prompt_open',
      current_prompt_index: 0,
      started_at: new Date().toISOString(),
      ended_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (activateError) {
    throw activateError;
  }

  const sessionData = mapSession(activatedSession);

  if (payload.prompts.length > 0) {
    const promptRows = createPromptRows(sessionData.id, payload.prompts);
    const { data: insertedPrompts, error: promptError } = await supabase
      .from('live_aunt_minnie_prompts')
      .insert(promptRows)
      .select('id');

    if (promptError) {
      throw promptError;
    }

    const promptImages = createPromptImagesPayload(sessionData.id, payload.prompts, insertedPrompts || []);
    if (promptImages.length > 0) {
      const { error: imageError } = await supabase
        .from('live_aunt_minnie_prompt_images')
        .insert(promptImages);

      if (imageError) {
        throw imageError;
      }
    }
  }

  await upsertParticipant(sessionData.id, userId, 'host');
  return sessionData;
};

export const updateLiveAuntMinnieSession = async (sessionId: string, payload: LiveAuntMinnieCreatePayload) => {
  validatePromptInputs(payload.prompts);
  const { userId, profile } = await getAuthenticatedProfile();
  ensureHostRole(profile?.role);

  const { data: sessionData, error: sessionError } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      title: payload.title.trim(),
      prompt_count: payload.prompts.length,
      allow_late_join: payload.allowLateJoin ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const { error: deleteImagesError } = await supabase
    .from('live_aunt_minnie_prompt_images')
    .delete()
    .eq('session_id', sessionId);

  if (deleteImagesError) {
    throw deleteImagesError;
  }

  const { error: deletePromptsError } = await supabase
    .from('live_aunt_minnie_prompts')
    .delete()
    .eq('session_id', sessionId);

  if (deletePromptsError) {
    throw deletePromptsError;
  }

  if (payload.prompts.length > 0) {
    const promptRows = createPromptRows(sessionId, payload.prompts);
    const { data: insertedPrompts, error: promptError } = await supabase
      .from('live_aunt_minnie_prompts')
      .insert(promptRows)
      .select('id');

    if (promptError) {
      throw promptError;
    }

    const promptImages = createPromptImagesPayload(sessionId, payload.prompts, insertedPrompts || []);
    if (promptImages.length > 0) {
      const { error: imageError } = await supabase
        .from('live_aunt_minnie_prompt_images')
        .insert(promptImages);

      if (imageError) {
        throw imageError;
      }
    }
  }

  return mapSession(sessionData);
};

export const appendLiveAuntMinnieQuestion = async (
  sessionId: string,
  prompt: LiveAuntMinniePromptInput,
  options?: { insertAfterCurrent?: boolean },
) => {
  validatePromptInputs([prompt]);
  const { userId, profile } = await getAuthenticatedProfile();
  ensureHostRole(profile?.role);

  const session = await fetchSession(sessionId);
  if (session.host_user_id !== userId) {
    throw new Error('Only the host can add questions to this session.');
  }

  const prompts = await fetchPrompts(sessionId);
  const insertAt =
    options?.insertAfterCurrent && session.status === 'live'
      ? Math.min(session.current_prompt_index + 1, prompts.length)
      : prompts.length;
  const normalized = normalizePromptInput(prompt, insertAt);
  const promptsToShift = prompts
    .filter((item) => item.sort_order >= insertAt)
    .sort((left, right) => right.sort_order - left.sort_order);
  const now = new Date().toISOString();

  for (const existingPrompt of promptsToShift) {
    const { error: reorderError } = await supabase
      .from('live_aunt_minnie_prompts')
      .update({
        sort_order: existingPrompt.sort_order + 1,
        updated_at: now,
      })
      .eq('id', existingPrompt.id)
      .eq('session_id', sessionId);

    if (reorderError) {
      throw reorderError;
    }
  }

  const { data: promptData, error: promptError } = await supabase
    .from('live_aunt_minnie_prompts')
    .insert({
      session_id: sessionId,
      sort_order: insertAt,
      source_case_id: normalized.source_case_id,
      image_url: normalized.images[0]?.image_url || '',
      image_caption: normalized.images[0]?.caption || null,
      question_text: normalized.question_text,
      official_answer: normalized.official_answer,
      answer_explanation: normalized.answer_explanation,
      accepted_aliases: normalized.accepted_aliases,
    })
    .select('id')
    .single();

  if (promptError) {
    throw promptError;
  }

  const imagesPayload = normalized.images.map((image) => ({
    prompt_id: promptData.id,
    session_id: sessionId,
    sort_order: image.sort_order,
    image_url: image.image_url,
    caption: image.caption,
  }));

  if (imagesPayload.length > 0) {
    const { error: imageError } = await supabase
      .from('live_aunt_minnie_prompt_images')
      .insert(imagesPayload);

    if (imageError) {
      throw imageError;
    }
  }

  const { error: sessionUpdateError } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      prompt_count: prompts.length + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId);

  if (sessionUpdateError) {
    throw sessionUpdateError;
  }

  return promptData.id as string;
};

export const updateLiveAuntMinniePrompt = async (
  sessionId: string,
  promptId: string,
  prompt: LiveAuntMinniePromptInput,
) => {
  validatePromptInputs([prompt]);
  const { userId, profile } = await getAuthenticatedProfile();
  ensureHostRole(profile?.role);

  const session = await fetchSession(sessionId);
  if (session.host_user_id !== userId) {
    throw new Error('Only the host can edit questions in this session.');
  }

  const prompts = await fetchPrompts(sessionId);
  const existingPrompt = prompts.find((item) => item.id === promptId);
  if (!existingPrompt) {
    throw new Error('Question not found.');
  }

  const normalized = normalizePromptInput(prompt, existingPrompt.sort_order);
  const now = new Date().toISOString();

  const { error: promptError } = await supabase
    .from('live_aunt_minnie_prompts')
    .update({
      source_case_id: normalized.source_case_id,
      image_url: normalized.images[0]?.image_url || '',
      image_caption: normalized.images[0]?.caption || null,
      question_text: normalized.question_text,
      official_answer: normalized.official_answer,
      answer_explanation: normalized.answer_explanation,
      accepted_aliases: normalized.accepted_aliases,
      updated_at: now,
    })
    .eq('id', promptId)
    .eq('session_id', sessionId);

  if (promptError) {
    throw promptError;
  }

  const { error: deleteImagesError } = await supabase
    .from('live_aunt_minnie_prompt_images')
    .delete()
    .eq('session_id', sessionId)
    .eq('prompt_id', promptId);

  if (deleteImagesError) {
    throw deleteImagesError;
  }

  const imagesPayload = normalized.images.map((image) => ({
    prompt_id: promptId,
    session_id: sessionId,
    sort_order: image.sort_order,
    image_url: image.image_url,
    caption: image.caption,
  }));

  if (imagesPayload.length > 0) {
    const { error: imageError } = await supabase
      .from('live_aunt_minnie_prompt_images')
      .insert(imagesPayload);

    if (imageError) {
      throw imageError;
    }
  }
};

const fetchSession = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Live Aunt Minnie room not found.');
  }

  return mapSession(data);
};

const fetchPrompts = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_prompts')
    .select('*, images:live_aunt_minnie_prompt_images(*)')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as PromptRow[]).map(mapPrompt);
};

const fetchParticipants = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_participants')
    .select('*, profile:user_id(full_name, nickname, avatar_url, role)')
    .eq('session_id', sessionId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as ParticipantRow[]).map(mapParticipant);
};

const fetchResponses = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_responses')
    .select('*, participant:user_id(full_name, nickname, avatar_url, role)')
    .eq('session_id', sessionId)
    .order('submitted_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as ResponseRow[]).map(mapResponse);
};

const fetchMessages = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_messages')
    .select('*, participant:user_id(full_name, nickname, avatar_url, role)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as MessageRow[]).map(mapMessage);
};

export const getLiveAuntMinnieRoomState = async (
  sessionId: string,
  onlineParticipantIds: string[] = [],
): Promise<LiveAuntMinnieRoomState> => {
  const { userId } = await getAuthenticatedProfile();
  const [session, prompts, participants, responses, messages] = await Promise.all([
    fetchSession(sessionId),
    fetchPrompts(sessionId),
    fetchParticipants(sessionId),
    fetchResponses(sessionId),
    fetchMessages(sessionId),
  ]);

  const isHost = session.host_user_id === userId;
  const { responsesByPromptId, myResponsesByPromptId } = buildResponseMaps(responses, userId);
  const { messagesByPromptId } = buildMessageMap(messages);

  prompts.forEach((prompt) => {
    responsesByPromptId[prompt.id] = responsesByPromptId[prompt.id] || [];
    myResponsesByPromptId[prompt.id] = myResponsesByPromptId[prompt.id] || null;
    messagesByPromptId[prompt.id] = messagesByPromptId[prompt.id] || [];
  });

  return {
    session: {
      ...session,
      prompt_count: prompts.length,
    },
    prompts,
    responses,
    responsesByPromptId,
    myResponsesByPromptId,
    messages,
    messagesByPromptId,
    participants,
    onlineParticipantIds,
    participantCount: participants.length,
    isHost,
    hasJoined: isHost || participants.some((participant) => participant.user_id === userId),
  };
};

export const joinLiveAuntMinnieSession = async (params: { sessionId?: string; joinCode?: string }) => {
  const { userId } = await getAuthenticatedProfile();
  const identifier = params.sessionId
    ? supabase.from('live_aunt_minnie_sessions').select('*').eq('id', params.sessionId).maybeSingle()
    : supabase.from('live_aunt_minnie_sessions').select('*').eq('join_code', params.joinCode?.trim().toUpperCase() || '').maybeSingle();

  const { data, error } = await identifier;
  if (error || !data) {
    throw new Error('Live Aunt Minnie session not found.');
  }

  const session = mapSession(data);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new Error('This live Aunt Minnie session has already ended.');
  }

  await upsertParticipant(session.id, userId, session.host_user_id === userId ? 'host' : 'participant');
  return session;
};

export const startLiveAuntMinnieSession = async (sessionId: string) => {
  const { userId } = await getAuthenticatedProfile();
  const prompts = await fetchPrompts(sessionId);
  if (prompts.length === 0) {
    throw new Error('Add at least one question before starting the session.');
  }

  const session = await fetchSession(sessionId);
  const intervalSeconds = session.auto_advance_interval_seconds || null;
  const nextPromptAt =
    intervalSeconds && prompts.length > 1
      ? new Date(Date.now() + intervalSeconds * 1000).toISOString()
      : null;

  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      status: 'live',
      current_phase: 'prompt_open',
      current_prompt_index: 0,
      prompt_count: prompts.length,
      started_at: new Date().toISOString(),
      ended_at: null,
      next_prompt_at: nextPromptAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapSession(data);
};

export const setLiveAuntMinnieAutoAdvanceInterval = async (sessionId: string, intervalSeconds: number | null) => {
  const { userId } = await getAuthenticatedProfile();
  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      auto_advance_interval_seconds: intervalSeconds,
      next_prompt_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapSession(data);
};

export const advanceLiveAuntMinniePrompt = async (sessionId: string) => {
  const { userId } = await getAuthenticatedProfile();
  const session = await fetchSession(sessionId);
  const prompts = await fetchPrompts(sessionId);

  if (session.host_user_id !== userId) {
    throw new Error('Only the host can advance the room.');
  }

  if (session.status !== 'live') {
    throw new Error('Room is not live.');
  }

  const nextIndex = Math.min(session.current_prompt_index + 1, Math.max(prompts.length - 1, 0));
  if (nextIndex === session.current_prompt_index) {
    return session;
  }

  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      current_prompt_index: nextIndex,
      next_prompt_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapSession(data);
};

export const setLiveAuntMinnieAnswersVisible = async (sessionId: string, visible: boolean) => {
  const { userId } = await getAuthenticatedProfile();
  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      current_phase: visible ? 'reveal' : 'prompt_open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapSession(data);
};

export const completeLiveAuntMinnieSession = async (sessionId: string) => {
  const { userId } = await getAuthenticatedProfile();
  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      status: 'completed',
      current_phase: 'completed',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapSession(data);
};

export const deleteLiveAuntMinnieSession = async (sessionId: string) => {
  const { userId, profile } = await getAuthenticatedProfile();
  ensureHostRole(profile?.role);

  const session = await fetchSession(sessionId);
  if (session.host_user_id !== userId) {
    throw new Error('Only the host can delete this room.');
  }

  const tables = [
    'live_aunt_minnie_prompt_images',
    'live_aunt_minnie_responses',
    'live_aunt_minnie_messages',
    'live_aunt_minnie_participants',
    'live_aunt_minnie_prompts',
  ] as const;

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      throw error;
    }
  }

  const { error: sessionDeleteError } = await supabase
    .from('live_aunt_minnie_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('host_user_id', userId);

  if (sessionDeleteError) {
    throw sessionDeleteError;
  }
};

export const submitLiveAuntMinnieResponse = async (payload: LiveAuntMinnieSubmitResponsePayload) => {
  const { userId } = await getAuthenticatedProfile();
  const session = await fetchSession(payload.sessionId);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new Error('This live Aunt Minnie room is no longer accepting answers.');
  }

  const responseText = payload.responseText.trim();
  if (!responseText) {
    throw new Error('Answer cannot be empty.');
  }

  const { data, error } = await supabase
    .from('live_aunt_minnie_responses')
    .upsert({
      session_id: payload.sessionId,
      prompt_id: payload.promptId,
      user_id: userId,
      response_text: responseText,
      judgment: 'unreviewed',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'session_id,prompt_id,user_id',
    })
    .select('*, participant:user_id(full_name, nickname, avatar_url, role)')
    .single();

  if (error) {
    throw error;
  }

  return mapResponse(data as ResponseRow);
};

export const deleteLiveAuntMinnieResponse = async (payload: Pick<LiveAuntMinnieSubmitResponsePayload, 'sessionId' | 'promptId'>) => {
  const { userId } = await getAuthenticatedProfile();
  const session = await fetchSession(payload.sessionId);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new Error('This live Aunt Minnie room is no longer accepting answers.');
  }

  const { error } = await supabase
    .from('live_aunt_minnie_responses')
    .delete()
    .eq('session_id', payload.sessionId)
    .eq('prompt_id', payload.promptId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
};

export const submitLiveAuntMinnieMessage = async (payload: LiveAuntMinnieSubmitMessagePayload) => {
  const { userId } = await getAuthenticatedProfile();
  const session = await fetchSession(payload.sessionId);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new Error('This live Aunt Minnie room is no longer accepting messages.');
  }

  const body = payload.body.trim();
  if (!body) {
    throw new Error('Message cannot be empty.');
  }

  const { data, error } = await supabase
    .from('live_aunt_minnie_messages')
    .insert({
      session_id: payload.sessionId,
      prompt_id: payload.promptId,
      user_id: userId,
      body,
    })
    .select('*, participant:user_id(full_name, nickname, avatar_url, role)')
    .single();

  if (error) {
    throw error;
  }

  return mapMessage(data as MessageRow);
};

export const subscribeToLiveAuntMinnieRoom = async ({
  sessionId,
  onStateChange,
  onError,
}: {
  sessionId: string;
  onStateChange: (state: LiveAuntMinnieRoomState) => void;
  onError?: (message: string) => void;
}) => {
  const { userId } = await getAuthenticatedProfile();
  let lastOnlineParticipantIds: string[] = [];
  let lastState: LiveAuntMinnieRoomState | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const emitPresenceState = () => {
    if (!lastState) return;
    onStateChange({ ...lastState, onlineParticipantIds: lastOnlineParticipantIds });
  };

  const refresh = async () => {
    try {
      const nextState = await getLiveAuntMinnieRoomState(sessionId, lastOnlineParticipantIds);
      lastState = nextState;
      onStateChange(nextState);
    } catch (error: any) {
      onError?.(error.message || 'Live Aunt Minnie room sync failed.');
    }
  };

  const queueRefresh = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refresh();
    }, 150);
  };

  const channel: RealtimeChannel = supabase.channel(`live-aunt-minnie:${sessionId}`, {
    config: {
      presence: { key: userId },
    },
  });

  const updatePresence = () => {
    const presenceState = channel.presenceState<{ user_id: string; ts: string }>();
    lastOnlineParticipantIds = Array.from(
      new Set(
        Object.values(presenceState)
          .flat()
          .map((entry) => entry.user_id)
          .filter(Boolean),
      ),
    );
    emitPresenceState();
  };

  channel
    .on('presence', { event: 'sync' }, updatePresence)
    .on('presence', { event: 'join' }, updatePresence)
    .on('presence', { event: 'leave' }, updatePresence)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_sessions', filter: `id=eq.${sessionId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_prompts', filter: `session_id=eq.${sessionId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_prompt_images', filter: `session_id=eq.${sessionId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_participants', filter: `session_id=eq.${sessionId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_responses', filter: `session_id=eq.${sessionId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_messages', filter: `session_id=eq.${sessionId}` }, queueRefresh)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await refresh();
          const session = await fetchSession(sessionId);
          await upsertParticipant(sessionId, userId, session.host_user_id === userId ? 'host' : 'participant');
          await channel.track({ user_id: userId, ts: new Date().toISOString() });
          await refresh();
        } catch (error: any) {
          onError?.(error.message || 'Unable to join the live Aunt Minnie room.');
        }
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.('Live Aunt Minnie realtime connection unavailable.');
      }
    });

  return () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    void channel.untrack();
    void supabase.removeChannel(channel);
  };
};

export const __testables = {
  buildJoinCode,
  buildMessageMap,
  buildResponseMaps,
  isLiveAuntMinnieHostRole,
  isLiveAuntMinnieRoomManagerRole,
  isLiveAuntMinnieTrainingOfficerRole,
  normalizePromptInput,
};
