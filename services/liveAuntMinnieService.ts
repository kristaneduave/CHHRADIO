import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { canManageAuntMinnieRoom, getPrimaryRole, hasAnyRole, normalizeUserRoles } from '../utils/roles';
import { getCurrentUserRoleState } from './userRoleService';
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
  LiveAuntMinnieSessionStatus,
  LiveAuntMinnieSyncState,
  LiveAuntMinnieSubmitMessagePayload,
  LiveAuntMinnieSubmitResponsePayload,
  Profile,
  SubmissionType,
  UserRole,
} from '../types';

type RoomConnectionState = LiveAuntMinnieSyncState;
type WorkspaceData = {
  currentUserId: string;
  currentUserRole: UserRole | null;
  canHost: boolean;
  hostSessions: LiveAuntMinnieSession[];
  joinableSessions: LiveAuntMinnieSession[];
  auntMinnieCases: AuntMinnieCaseOption[];
};

let liveAuntMinnieWorkspaceCache: WorkspaceData | null = null;
let liveAuntMinnieWorkspacePromise: Promise<WorkspaceData> | null = null;
const liveAuntMinnieRoomBootstrapCache = new Map<string, LiveAuntMinnieRoomState>();
let authenticatedProfileCache:
  | {
      expiresAt: number;
      value: {
        userId: string;
        profile: Profile | null;
        primaryRole: UserRole | null;
        roles: UserRole[];
      };
    }
  | null = null;
let authenticatedProfilePromise: Promise<{
  userId: string;
  profile: Profile | null;
  primaryRole: UserRole | null;
  roles: UserRole[];
}> | null = null;
const AUTHENTICATED_PROFILE_CACHE_TTL_MS = 10_000;

const clearLiveAuntMinnieRoomCache = (sessionId?: string) => {
  if (sessionId) {
    liveAuntMinnieRoomBootstrapCache.delete(sessionId);
    return;
  }
  liveAuntMinnieRoomBootstrapCache.clear();
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
const LEGACY_PROMPT_PLACEHOLDER_ANSWER = 'Pending TO answer';
const PROMPT_PLACEHOLDER_ANSWER = 'Pending correct answer';

const normalizeOfficialAnswerText = (value: string | null | undefined) => {
  const trimmed = value?.trim() || '';
  if (!trimmed || trimmed === LEGACY_PROMPT_PLACEHOLDER_ANSWER) {
    return PROMPT_PLACEHOLDER_ANSWER;
  }
  return trimmed;
};

export const isLiveAuntMinnieHostRole = (roleOrRoles: UserRole | UserRole[] | null | undefined) =>
  hasAnyRole(roleOrRoles, HOST_ROLES);

export const isLiveAuntMinnieTrainingOfficerRole = (role: UserRole | null | undefined) =>
  role === 'training_officer';

export const isLiveAuntMinnieRoomManagerRole = (roleOrRoles: UserRole | UserRole[] | null | undefined) =>
  canManageAuntMinnieRoom(roleOrRoles);

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
  locked_at: row.locked_at || null,
  locked_by: row.locked_by || null,
  join_code: row.join_code || null,
  allow_late_join: Boolean(row.allow_late_join),
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
    official_answer: normalizeOfficialAnswerText(row.official_answer),
    answer_explanation: row.answer_explanation || null,
    accepted_aliases: Array.isArray(row.accepted_aliases) ? row.accepted_aliases : [],
    images,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const sanitizePromptForParticipant = (
  prompt: LiveAuntMinniePrompt,
  options?: { allowAnswerKey?: boolean },
): LiveAuntMinniePrompt => ({
  ...prompt,
  official_answer: options?.allowAnswerKey ? prompt.official_answer : '',
  answer_explanation: null,
  accepted_aliases: [],
});

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

const buildRoomStateFromSlices = (
  session: LiveAuntMinnieSession,
  prompts: LiveAuntMinniePrompt[],
  participants: LiveAuntMinnieParticipant[],
  responses: LiveAuntMinnieResponse[],
  messages: LiveAuntMinnieMessage[],
  userId: string,
  onlineParticipantIds: string[] = [],
): LiveAuntMinnieRoomState => {
  const { responsesByPromptId, myResponsesByPromptId } = buildResponseMaps(responses, userId);
  const { messagesByPromptId } = buildMessageMap(messages);
  const sortedPrompts = [...prompts].sort((left, right) => left.sort_order - right.sort_order);
  const sortedParticipants = [...participants].sort(
    (left, right) => new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime(),
  );

  const isHost = session.host_user_id === userId;
  const visiblePrompts = isHost
    ? sortedPrompts
    : sortedPrompts.map((prompt) =>
        sanitizePromptForParticipant(prompt, {
          allowAnswerKey: session.status === 'completed',
        }),
      );

  sortedPrompts.forEach((prompt) => {
    responsesByPromptId[prompt.id] = responsesByPromptId[prompt.id] || [];
    myResponsesByPromptId[prompt.id] = myResponsesByPromptId[prompt.id] || null;
    messagesByPromptId[prompt.id] = messagesByPromptId[prompt.id] || [];
  });

  return {
    session: {
      ...session,
      prompt_count: Math.max(session.prompt_count, visiblePrompts.length),
    },
    prompts: visiblePrompts,
    responses,
    responsesByPromptId,
    myResponsesByPromptId,
    messages,
    messagesByPromptId,
    participants: sortedParticipants,
    onlineParticipantIds,
    participantCount: sortedParticipants.length,
    isHost,
    hasJoined: isHost || sortedParticipants.some((participant) => participant.user_id === userId),
  };
};

const ensureSessionIsAcceptingAnswers = (session: LiveAuntMinnieSession) => {
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new Error('This live Aunt Minnie room is no longer accepting answers.');
  }

  if (session.status !== 'live' || session.current_phase !== 'prompt_open') {
    throw new Error('Answers are locked for this exam.');
  }
};

const sortResponses = (responses: LiveAuntMinnieResponse[]) =>
  [...responses].sort(
    (left, right) => new Date(left.submitted_at).getTime() - new Date(right.submitted_at).getTime(),
  );

const sortMessages = (messages: LiveAuntMinnieMessage[]) =>
  [...messages].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );

const sortParticipants = (participants: LiveAuntMinnieParticipant[]) =>
  [...participants].sort(
    (left, right) => new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime(),
  );

const sortPrompts = (prompts: LiveAuntMinniePrompt[]) =>
  [...prompts].sort((left, right) => left.sort_order - right.sort_order);

const timestampValue = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const isEndedStatus = (status: LiveAuntMinnieSessionStatus) =>
  status === 'completed' || status === 'cancelled';

const isMissingRpcError = (error: unknown) => {
  const message = String((error as any)?.message || '').toLowerCase();
  return message.includes('function') || message.includes('schema cache');
};

const isParticipantLivePromptOpenSession = (
  session: Pick<LiveAuntMinnieSession, 'status' | 'current_phase'>,
  isHost: boolean,
) => !isHost && session.status === 'live' && session.current_phase === 'prompt_open';

const withParticipantProfile = <
  T extends { user_id: string; participant?: LiveAuntMinnieResponse['participant'] | LiveAuntMinnieMessage['participant'] | null },
>(
  item: T,
  participants: LiveAuntMinnieParticipant[],
): T => ({
  ...item,
  participant:
    participants.find((participant) => participant.user_id === item.user_id)?.profile
    || item.participant
    || null,
});

const applySessionEventToState = (state: LiveAuntMinnieRoomState, row: any) => {
  const incomingSession = mapSession(row);
  const currentUpdatedAt = timestampValue(state.session.updated_at || state.session.ended_at || state.session.started_at);
  const incomingUpdatedAt = timestampValue(incomingSession.updated_at || incomingSession.ended_at || incomingSession.started_at);

  if (isEndedStatus(state.session.status) && !isEndedStatus(incomingSession.status)) {
    return state;
  }

  if (incomingUpdatedAt && currentUpdatedAt && incomingUpdatedAt < currentUpdatedAt) {
    return state;
  }

  return {
    ...state,
    session: {
      ...state.session,
      ...incomingSession,
      prompt_count: Math.max(incomingSession.prompt_count, state.prompts.length),
    },
  };
};

const patchPromptImages = (
  prompt: LiveAuntMinniePrompt,
  eventType: string,
  imageRow: any,
): LiveAuntMinniePrompt => {
  const image = mapPromptImage(imageRow);
  const nextImages =
    eventType === 'DELETE'
      ? prompt.images.filter((item) => item.id !== image.id)
      : [...prompt.images.filter((item) => item.id !== image.id), image].sort(
          (left, right) => left.sort_order - right.sort_order,
        );
  const primaryImage = nextImages[0] || null;

  return {
    ...prompt,
    images: nextImages,
    image_url: primaryImage?.image_url || '',
    image_caption: primaryImage?.caption || null,
    updated_at: image.updated_at || prompt.updated_at,
  };
};

const applyPromptEventToState = (
  state: LiveAuntMinnieRoomState,
  eventType: string,
  row: any,
  userId: string,
) => {
  const existingPrompt = state.prompts.find((prompt) => prompt.id === row.id);

  if (eventType === 'DELETE') {
    if (!existingPrompt) {
      return state;
    }

    return buildRoomStateFromSlices(
      {
        ...state.session,
        prompt_count: Math.max(state.prompts.length - 1, 0),
      },
      state.prompts.filter((prompt) => prompt.id !== row.id),
      state.participants,
      state.responses.filter((response) => response.prompt_id !== row.id),
      state.messages.filter((message) => message.prompt_id !== row.id),
      userId,
      state.onlineParticipantIds,
    );
  }

  const currentUpdatedAt = timestampValue(existingPrompt?.updated_at || existingPrompt?.created_at);
  const incomingUpdatedAt = timestampValue(row.updated_at || row.created_at);
  if (existingPrompt && incomingUpdatedAt && currentUpdatedAt && incomingUpdatedAt < currentUpdatedAt) {
    return state;
  }

  const patchedPrompt: LiveAuntMinniePrompt = existingPrompt
    ? {
        ...existingPrompt,
        session_id: row.session_id,
        sort_order: Number(row.sort_order || existingPrompt.sort_order || 0),
        source_case_id: row.source_case_id || null,
        image_url: row.image_url,
        image_caption: row.image_caption || null,
        question_text: row.question_text || null,
        official_answer: normalizeOfficialAnswerText(row.official_answer),
        answer_explanation: row.answer_explanation || null,
        accepted_aliases: Array.isArray(row.accepted_aliases) ? row.accepted_aliases : [],
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    : {
        id: row.id,
        session_id: row.session_id,
        sort_order: Number(row.sort_order || 0),
        source_case_id: row.source_case_id || null,
        image_url: row.image_url || '',
        image_caption: row.image_caption || null,
        question_text: row.question_text || null,
        official_answer: normalizeOfficialAnswerText(row.official_answer),
        answer_explanation: row.answer_explanation || null,
        accepted_aliases: Array.isArray(row.accepted_aliases) ? row.accepted_aliases : [],
        images: row.image_url
          ? [{
              id: `${row.id}:legacy`,
              prompt_id: row.id,
              session_id: row.session_id,
              sort_order: 0,
              image_url: row.image_url,
              caption: row.image_caption || null,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }]
          : [],
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

  const nextPrompts = [
    ...state.prompts.filter((prompt) => prompt.id !== patchedPrompt.id),
    patchedPrompt,
  ].sort((left, right) => left.sort_order - right.sort_order);

  return buildRoomStateFromSlices(
    {
      ...state.session,
      prompt_count: Math.max(state.session.prompt_count, nextPrompts.length),
    },
    nextPrompts,
    state.participants,
    state.responses,
    state.messages,
    userId,
    state.onlineParticipantIds,
  );
};

const applyPromptImageEventToState = (
  state: LiveAuntMinnieRoomState,
  eventType: string,
  row: any,
  userId: string,
) => {
  const promptId = row.prompt_id as string | undefined;
  if (!promptId) {
    return state;
  }

  const existingPrompt = state.prompts.find((prompt) => prompt.id === promptId);
  if (!existingPrompt) {
    return state;
  }

  const patchedPrompt = patchPromptImages(existingPrompt, eventType, row);

  const nextPrompts = state.prompts
    .map((prompt) => (prompt.id === existingPrompt.id ? patchedPrompt : prompt))
    .sort((left, right) => left.sort_order - right.sort_order);

  return buildRoomStateFromSlices(
    state.session,
    nextPrompts,
    state.participants,
    state.responses,
    state.messages,
    userId,
    state.onlineParticipantIds,
  );
};

const applyResponseEventToState = (
  state: LiveAuntMinnieRoomState,
  eventType: string,
  row: any,
  userId: string,
) => {
  const response = withParticipantProfile(mapResponse(row as ResponseRow), state.participants);
  const nextResponses =
    eventType === 'DELETE'
      ? state.responses.filter((item) => item.id !== response.id)
      : sortResponses([
          ...state.responses.filter((item) => item.id !== response.id),
          response,
        ]);
  const nextResponsesByPromptId = {
    ...state.responsesByPromptId,
    [response.prompt_id]: sortResponses(nextResponses.filter((item) => item.prompt_id === response.prompt_id)),
  };
  const nextMyResponsesByPromptId = { ...state.myResponsesByPromptId };

  if (!(response.prompt_id in nextMyResponsesByPromptId)) {
    nextMyResponsesByPromptId[response.prompt_id] = null;
  }
  if (response.user_id === userId) {
    nextMyResponsesByPromptId[response.prompt_id] =
      nextResponsesByPromptId[response.prompt_id].find((item) => item.user_id === userId) || null;
  }

  return {
    ...state,
    responses: nextResponses,
    responsesByPromptId: nextResponsesByPromptId,
    myResponsesByPromptId: nextMyResponsesByPromptId,
  };
};

const applyMessageEventToState = (
  state: LiveAuntMinnieRoomState,
  eventType: string,
  row: any,
  userId: string,
) => {
  const message = withParticipantProfile(mapMessage(row as MessageRow), state.participants);
  const nextMessages =
    eventType === 'DELETE'
      ? state.messages.filter((item) => item.id !== message.id)
      : sortMessages([
          ...state.messages.filter((item) => item.id !== message.id),
          message,
        ]);

  return {
    ...state,
    messages: nextMessages,
    messagesByPromptId: {
      ...state.messagesByPromptId,
      [message.prompt_id]: sortMessages(nextMessages.filter((item) => item.prompt_id === message.prompt_id)),
    },
  };
};

const applyParticipantEventToState = (
  state: LiveAuntMinnieRoomState,
  eventType: string,
  row: any,
  userId: string,
) => {
  const participant = mapParticipant({
    ...(row as ParticipantRow),
    profile:
      state.participants.find((item) => item.user_id === row.user_id)?.profile
      || null,
  });
  const nextParticipants =
    eventType === 'DELETE'
      ? state.participants.filter((item) => item.id !== participant.id)
      : sortParticipants([
          ...state.participants.filter((item) => item.id !== participant.id),
          participant,
        ]);

  return buildRoomStateFromSlices(
    state.session,
    state.prompts,
    nextParticipants,
    state.responses.map((response) => withParticipantProfile(response, nextParticipants)),
    state.messages.map((message) => withParticipantProfile(message, nextParticipants)),
    userId,
    state.onlineParticipantIds,
  );
};

const getAuthenticatedProfile = async (): Promise<{
  userId: string;
  profile: Profile | null;
  primaryRole: UserRole | null;
  roles: UserRole[];
}> => {
  if (authenticatedProfileCache && authenticatedProfileCache.expiresAt > Date.now()) {
    return authenticatedProfileCache.value;
  }

  if (authenticatedProfilePromise) {
    return authenticatedProfilePromise;
  }

  authenticatedProfilePromise = (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const [{ data, error }, roleState] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      getCurrentUserRoleState(),
    ]);

    if (error) {
      throw error;
    }

    const profile = (data as Profile | null) || null;
    const roles = roleState?.roles?.length
      ? roleState.roles
      : normalizeUserRoles([profile?.role]);
    const primaryRole = roleState?.primaryRole || getPrimaryRole(roles, profile?.role);

    const nextValue = {
      userId: user.id,
      profile,
      primaryRole,
      roles,
    };

    authenticatedProfileCache = {
      expiresAt: Date.now() + AUTHENTICATED_PROFILE_CACHE_TTL_MS,
      value: nextValue,
    };

    return nextValue;
  })().finally(() => {
    authenticatedProfilePromise = null;
  });

  return authenticatedProfilePromise;
};

const ensureHostRole = (roles: UserRole[] | UserRole | null | undefined) => {
  if (!isLiveAuntMinnieRoomManagerRole(roles)) {
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
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return ((data || []) as SessionRow[]).map(mapSession);
};

export const getLiveAuntMinnieWorkspace = async (options?: { force?: boolean }): Promise<WorkspaceData> => {
  const force = Boolean(options?.force);

  if (!force && liveAuntMinnieWorkspaceCache) {
    return liveAuntMinnieWorkspaceCache;
  }

  if (!force && liveAuntMinnieWorkspacePromise) {
    return liveAuntMinnieWorkspacePromise;
  }

  liveAuntMinnieWorkspacePromise = (async () => {
    const { userId, profile, primaryRole, roles } = await getAuthenticatedProfile();
    const canHost = isLiveAuntMinnieRoomManagerRole(roles);

    const [hostSessions, joinableSessions, auntMinnieCases] = await Promise.all([
      canHost ? listHostSessions(userId) : Promise.resolve([]),
      listJoinableSessions(),
      canHost ? listAuntMinnieCases() : Promise.resolve([]),
    ]);

    return {
      currentUserId: userId,
      currentUserRole: primaryRole || profile?.role || null,
      canHost,
      hostSessions,
      joinableSessions,
      auntMinnieCases,
    };
  })()
    .then((data) => {
      liveAuntMinnieWorkspaceCache = data;
      return data;
    })
    .finally(() => {
      liveAuntMinnieWorkspacePromise = null;
    });

  return liveAuntMinnieWorkspacePromise;
};

export const preloadLiveAuntMinnieWorkspace = async (): Promise<void> => {
  await getLiveAuntMinnieWorkspace();
};

export const getCachedLiveAuntMinnieWorkspace = (): WorkspaceData | null => liveAuntMinnieWorkspaceCache;

export const createLiveAuntMinnieSession = async (payload: LiveAuntMinnieCreatePayload) => {
  validatePromptInputs(payload.prompts);
  const { userId, roles } = await getAuthenticatedProfile();
  ensureHostRole(roles);

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
  clearLiveAuntMinnieRoomCache(sessionData.id);
  return sessionData;
};

export const updateLiveAuntMinnieSession = async (sessionId: string, payload: LiveAuntMinnieCreatePayload) => {
  validatePromptInputs(payload.prompts);
  const { userId, roles } = await getAuthenticatedProfile();
  ensureHostRole(roles);

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

  clearLiveAuntMinnieRoomCache(sessionId);
  return mapSession(sessionData);
};

export const appendLiveAuntMinnieQuestion = async (
  sessionId: string,
  prompt: LiveAuntMinniePromptInput,
  options?: { insertAfterCurrent?: boolean },
) => {
  validatePromptInputs([prompt]);
  const { userId, roles } = await getAuthenticatedProfile();
  ensureHostRole(roles);

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

  clearLiveAuntMinnieRoomCache(sessionId);
  return promptData.id as string;
};

export const updateLiveAuntMinniePrompt = async (
  sessionId: string,
  promptId: string,
  prompt: LiveAuntMinniePromptInput,
) => {
  validatePromptInputs([prompt]);
  const { userId, roles } = await getAuthenticatedProfile();
  ensureHostRole(roles);

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
  clearLiveAuntMinnieRoomCache(sessionId);
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

  clearLiveAuntMinnieRoomCache(sessionId);
  return mapSession(data);
};

export const getLiveAuntMinnieSessionMeta = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .select('id, status, current_phase, current_prompt_index, prompt_count, updated_at, ended_at, prompts_version, responses_version, messages_version, participants_version')
    .eq('id', sessionId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Live Aunt Minnie room not found.');
  }

  return {
    id: data.id,
    status: data.status,
    current_phase: data.current_phase,
    current_prompt_index: Number(data.current_prompt_index || 0),
    prompt_count: Number(data.prompt_count || 0),
    updated_at: data.updated_at || null,
    ended_at: data.ended_at || null,
    prompts_version: Number((data as any).prompts_version || 0),
    responses_version: Number((data as any).responses_version || 0),
    messages_version: Number((data as any).messages_version || 0),
    participants_version: Number((data as any).participants_version || 0),
  };
};

export const getLiveAuntMinnieResponsesMeta = async (sessionId: string) => {
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    supabase
      .from('live_aunt_minnie_responses')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId),
    supabase
      .from('live_aunt_minnie_responses')
      .select('id, updated_at, submitted_at')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('submitted_at', { ascending: false })
      .limit(1),
  ]);

  if (countError) {
    throw countError;
  }

  if (error) {
    throw error;
  }

  const latest = data?.[0] || null;
  return {
    count: count || 0,
    latest_updated_at: latest?.updated_at || latest?.submitted_at || null,
  };
};

export const getLiveAuntMinniePromptsMeta = async (sessionId: string) => {
  const [{ count: promptCount, error: promptCountError }, { data: promptRows, error: promptRowsError }, { data: imageRows, error: imageRowsError }] = await Promise.all([
    supabase
      .from('live_aunt_minnie_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId),
    supabase
      .from('live_aunt_minnie_prompts')
      .select('id, updated_at, created_at')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('live_aunt_minnie_prompt_images')
      .select('id, updated_at, created_at')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  if (promptCountError) throw promptCountError;
  if (promptRowsError) throw promptRowsError;
  if (imageRowsError) throw imageRowsError;

  const latestPromptUpdatedAt = promptRows?.[0]?.updated_at || promptRows?.[0]?.created_at || null;
  const latestImageUpdatedAt = imageRows?.[0]?.updated_at || imageRows?.[0]?.created_at || null;

  return {
    count: promptCount || 0,
    latest_prompt_updated_at: latestPromptUpdatedAt,
    latest_image_updated_at: latestImageUpdatedAt,
  };
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

const fetchResponsesForPrompt = async (sessionId: string, promptId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_responses')
    .select('*, participant:user_id(full_name, nickname, avatar_url, role)')
    .eq('session_id', sessionId)
    .eq('prompt_id', promptId)
    .order('submitted_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as ResponseRow[]).map(mapResponse);
};

const fetchResponsesForUser = async (sessionId: string, userId: string) => {
  const { data, error } = await supabase
    .from('live_aunt_minnie_responses')
    .select('*, participant:user_id(full_name, nickname, avatar_url, role)')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
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

const getCurrentPrompt = (session: LiveAuntMinnieSession, prompts: LiveAuntMinniePrompt[]) =>
  prompts[Math.max(0, Math.min(session.current_prompt_index, Math.max(prompts.length - 1, 0)))] || null;

export const getLiveAuntMinnieRoomBootstrap = async (
  sessionId: string,
  onlineParticipantIds: string[] = [],
  options?: { force?: boolean },
): Promise<LiveAuntMinnieRoomState> => {
  if (!options?.force && liveAuntMinnieRoomBootstrapCache.has(sessionId)) {
    return liveAuntMinnieRoomBootstrapCache.get(sessionId)!;
  }

  const { userId } = await getAuthenticatedProfile();
  const [session, prompts] = await Promise.all([
    fetchSession(sessionId),
    fetchPrompts(sessionId),
  ]);
  const isHost = session.host_user_id === userId;

  if (isHost) {
    const fullState = await getLiveAuntMinnieRoomState(sessionId, onlineParticipantIds, { force: true });
    liveAuntMinnieRoomBootstrapCache.set(sessionId, fullState);
    return fullState;
  }

  const bootstrapState = buildRoomStateFromSlices(
    session,
    prompts,
    [],
    await fetchResponsesForUser(sessionId, userId),
    [],
    userId,
    onlineParticipantIds,
  );
  liveAuntMinnieRoomBootstrapCache.set(sessionId, bootstrapState);
  return bootstrapState;
};

export const hydrateLiveAuntMinnieRoomDeferred = async (
  sessionId: string,
  onlineParticipantIds: string[] = [],
): Promise<LiveAuntMinnieRoomState> => {
  const nextState = await getLiveAuntMinnieRoomState(sessionId, onlineParticipantIds, { force: true });
  liveAuntMinnieRoomBootstrapCache.set(sessionId, nextState);
  return nextState;
};

export const getLiveAuntMinnieRoomState = async (
  sessionId: string,
  onlineParticipantIds: string[] = [],
  options?: { force?: boolean },
): Promise<LiveAuntMinnieRoomState> => {
  if (!options?.force && liveAuntMinnieRoomBootstrapCache.has(sessionId)) {
    const cached = liveAuntMinnieRoomBootstrapCache.get(sessionId)!;
    return {
      ...cached,
      onlineParticipantIds,
    };
  }

  const { userId } = await getAuthenticatedProfile();
  const [session, prompts, participants, responses, messages] = await Promise.all([
    fetchSession(sessionId),
    fetchPrompts(sessionId),
    fetchParticipants(sessionId),
    fetchResponses(sessionId),
    fetchMessages(sessionId),
  ]);

  const nextState = buildRoomStateFromSlices(
    session,
    prompts,
    participants,
    responses,
    messages,
    userId,
    onlineParticipantIds,
  );
  liveAuntMinnieRoomBootstrapCache.set(sessionId, nextState);
  return nextState;
};

export const getLiveAuntMinniePromptResponseMeta = async (sessionId: string, promptId: string) => {
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    supabase
      .from('live_aunt_minnie_responses')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('prompt_id', promptId),
    supabase
      .from('live_aunt_minnie_responses')
      .select('id, updated_at, submitted_at')
      .eq('session_id', sessionId)
      .eq('prompt_id', promptId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('submitted_at', { ascending: false })
      .limit(1),
  ]);

  if (countError) throw countError;
  if (error) throw error;

  const latest = data?.[0] || null;
  return {
    count: count || 0,
    latest_updated_at: latest?.updated_at || latest?.submitted_at || null,
  };
};

export const refreshLiveAuntMinnieRoomResponses = async (
  sessionId: string,
  state: LiveAuntMinnieRoomState,
): Promise<LiveAuntMinnieRoomState> => {
  const { userId } = await getAuthenticatedProfile();
  const shouldUseParticipantSlice = isParticipantLivePromptOpenSession(state.session, state.isHost);
  const currentPrompt = getCurrentPrompt(state.session, state.prompts);
  const responses = shouldUseParticipantSlice
    ? await fetchResponsesForUser(sessionId, userId)
    : await fetchResponses(sessionId);
  const nextState = buildRoomStateFromSlices(
    state.session,
    sortPrompts(state.prompts),
    state.participants,
    currentPrompt || !shouldUseParticipantSlice ? responses : responses,
    state.messages,
    userId,
    state.onlineParticipantIds,
  );
  liveAuntMinnieRoomBootstrapCache.set(sessionId, nextState);
  return nextState;
};

export const refreshLiveAuntMinnieRoomMessages = async (
  sessionId: string,
  state: LiveAuntMinnieRoomState,
): Promise<LiveAuntMinnieRoomState> => {
  const { userId } = await getAuthenticatedProfile();
  const messages = await fetchMessages(sessionId);
  const nextState = buildRoomStateFromSlices(
    state.session,
    sortPrompts(state.prompts),
    state.participants,
    state.responses,
    messages,
    userId,
    state.onlineParticipantIds,
  );
  liveAuntMinnieRoomBootstrapCache.set(sessionId, nextState);
  return nextState;
};

export const refreshLiveAuntMinnieRoomParticipants = async (
  sessionId: string,
  state: LiveAuntMinnieRoomState,
): Promise<LiveAuntMinnieRoomState> => {
  const { userId } = await getAuthenticatedProfile();
  const participants = await fetchParticipants(sessionId);
  const nextState = buildRoomStateFromSlices(
    state.session,
    sortPrompts(state.prompts),
    participants,
    state.responses,
    state.messages,
    userId,
    state.onlineParticipantIds,
  );
  liveAuntMinnieRoomBootstrapCache.set(sessionId, nextState);
  return nextState;
};

export const preloadCurrentLiveAuntMinnieRoom = async (): Promise<void> => {
  const workspace = await getLiveAuntMinnieWorkspace();
  const session = workspace.joinableSessions.find((item) => item.status === 'live') || workspace.joinableSessions[0];
  if (!session) return;
  await getLiveAuntMinnieRoomBootstrap(session.id);
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

  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      status: 'live',
      current_phase: 'prompt_open',
      current_prompt_index: 0,
      prompt_count: prompts.length,
      started_at: new Date().toISOString(),
      ended_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  clearLiveAuntMinnieRoomCache(sessionId);
  return mapSession(data);
};

export const setLiveAuntMinnieAutoAdvanceInterval = async (sessionId: string, intervalSeconds: number | null) => {
  const { userId } = await getAuthenticatedProfile();
  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  clearLiveAuntMinnieRoomCache(sessionId);
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

  if (session.current_phase !== 'prompt_open') {
    throw new Error('Questions can only advance while answers are open.');
  }

  const nextIndex = Math.min(session.current_prompt_index + 1, Math.max(prompts.length - 1, 0));
  if (nextIndex === session.current_prompt_index) {
    return session;
  }

  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      current_prompt_index: nextIndex,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  clearLiveAuntMinnieRoomCache(sessionId);
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

  clearLiveAuntMinnieRoomCache(sessionId);
  return mapSession(data);
};

export const lockLiveAuntMinnieAnswers = async (sessionId: string) => {
  const { userId } = await getAuthenticatedProfile();
  const session = await fetchSession(sessionId);

  if (session.host_user_id !== userId) {
    throw new Error('Only the host can lock answers.');
  }

  if (session.status !== 'live' || session.current_phase !== 'prompt_open') {
    throw new Error('Answers cannot be locked right now.');
  }

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

  clearLiveAuntMinnieRoomCache(sessionId);
  return mapSession(data);
};

export const startLiveAuntMinnieReview = async (sessionId: string) => {
  const { userId } = await getAuthenticatedProfile();
  const session = await fetchSession(sessionId);

  if (session.host_user_id !== userId) {
    throw new Error('Only the host can review submissions.');
  }

  if (session.status !== 'paused') {
    throw new Error('Review can only start after answers are locked.');
  }

  const { data, error } = await supabase
    .from('live_aunt_minnie_sessions')
    .update({
      status: 'live',
      current_phase: 'reveal',
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
  const session = await fetchSession(sessionId);
  if (session.host_user_id !== userId) {
    throw new Error('Only the host can end the quiz.');
  }

  if (session.status === 'completed' || session.status === 'cancelled') {
    return session;
  }

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

export const updateLiveAuntMinnieAnswerKey = async (
  sessionId: string,
  promptId: string,
  payload: Pick<LiveAuntMinniePromptInput, 'official_answer' | 'answer_explanation' | 'accepted_aliases'>,
) => {
  const { userId, roles } = await getAuthenticatedProfile();
  ensureHostRole(roles);

  const session = await fetchSession(sessionId);
  if (session.host_user_id !== userId) {
    throw new Error('Only the host can edit the answer key.');
  }

  if (session.status !== 'completed') {
    throw new Error('Answer keys can only be edited after the quiz has ended.');
  }

  const { error } = await supabase
    .from('live_aunt_minnie_prompts')
    .update({
      official_answer: payload.official_answer.trim() || PROMPT_PLACEHOLDER_ANSWER,
      answer_explanation: payload.answer_explanation?.trim() || null,
      accepted_aliases: payload.accepted_aliases || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', promptId)
    .eq('session_id', sessionId);

  if (error) {
    throw error;
  }
  clearLiveAuntMinnieRoomCache(sessionId);
};

export const deleteLiveAuntMinnieSession = async (sessionId: string) => {
  const { userId, roles } = await getAuthenticatedProfile();
  ensureHostRole(roles);

  const { error: rpcError } = await supabase.rpc('delete_live_aunt_minnie_session', {
    p_session_id: sessionId,
  });

  if (rpcError) {
    if (!isMissingRpcError(rpcError)) {
      throw rpcError;
    }

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
  }
  clearLiveAuntMinnieRoomCache(sessionId);
};

export const submitLiveAuntMinnieResponse = async (payload: LiveAuntMinnieSubmitResponsePayload) => {
  const { userId } = await getAuthenticatedProfile();
  const responseText = payload.responseText.trim();
  if (!responseText) {
    throw new Error('Answer cannot be empty.');
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('submit_live_aunt_minnie_response', {
    p_session_id: payload.sessionId,
    p_prompt_id: payload.promptId,
    p_response_text: responseText,
  });

  if (!rpcError && rpcData) {
    clearLiveAuntMinnieRoomCache(payload.sessionId);
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return mapResponse(row as ResponseRow);
  }

  if (rpcError && !isMissingRpcError(rpcError)) {
    throw rpcError;
  }

  const session = await fetchSession(payload.sessionId);
  if (session.host_user_id === userId) {
    throw new Error('Hosts cannot submit answers in their own Live Aunt Minnie room.');
  }
  ensureSessionIsAcceptingAnswers(session);

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

  clearLiveAuntMinnieRoomCache(payload.sessionId);
  return mapResponse(data as ResponseRow);
};

export const deleteLiveAuntMinnieResponse = async (payload: Pick<LiveAuntMinnieSubmitResponsePayload, 'sessionId' | 'promptId'>) => {
  const { userId } = await getAuthenticatedProfile();
  const { error: rpcError } = await supabase.rpc('delete_live_aunt_minnie_response', {
    p_session_id: payload.sessionId,
    p_prompt_id: payload.promptId,
  });

  if (rpcError) {
    if (!isMissingRpcError(rpcError)) {
      throw rpcError;
    }

    const session = await fetchSession(payload.sessionId);
    if (session.host_user_id === userId) {
      throw new Error('Hosts cannot delete answers in their own Live Aunt Minnie room.');
    }
    ensureSessionIsAcceptingAnswers(session);

    const { error } = await supabase
      .from('live_aunt_minnie_responses')
      .delete()
      .eq('session_id', payload.sessionId)
      .eq('prompt_id', payload.promptId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }
  clearLiveAuntMinnieRoomCache(payload.sessionId);
};

export const submitLiveAuntMinnieMessage = async (payload: LiveAuntMinnieSubmitMessagePayload) => {
  const { userId } = await getAuthenticatedProfile();
  const body = payload.body.trim();
  if (!body) {
    throw new Error('Message cannot be empty.');
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('submit_live_aunt_minnie_message', {
    p_session_id: payload.sessionId,
    p_prompt_id: payload.promptId,
    p_body: body,
  });

  if (!rpcError && rpcData) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return mapMessage(row as MessageRow);
  }

  if (rpcError && !isMissingRpcError(rpcError)) {
    throw rpcError;
  }

  const session = await fetchSession(payload.sessionId);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new Error('This live Aunt Minnie room is no longer accepting messages.');
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
  onConnectionStateChange,
  initialState,
}: {
  sessionId: string;
  onStateChange: (state: LiveAuntMinnieRoomState) => void;
  onError?: (message: string) => void;
  onConnectionStateChange?: (state: RoomConnectionState) => void;
  initialState?: LiveAuntMinnieRoomState | null;
}) => {
  const { userId } = await getAuthenticatedProfile();
  let lastOnlineParticipantIds: string[] = [];
  let lastState: LiveAuntMinnieRoomState | null = initialState || null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let initialSnapshotLoaded = false;
  let presenceRegistered = false;
  const pendingRefreshKinds = new Set<'session' | 'prompts' | 'participants' | 'responses' | 'messages'>();
  const bufferedEvents: Array<() => void> = [];

  onConnectionStateChange?.('connecting');

  const emitPresenceState = () => {
    if (!lastState) return;
    onStateChange({ ...lastState, onlineParticipantIds: lastOnlineParticipantIds });
  };

  const refresh = async () => {
    try {
      const nextState = lastState
        ? await hydrateLiveAuntMinnieRoomDeferred(sessionId, lastOnlineParticipantIds)
        : await getLiveAuntMinnieRoomBootstrap(sessionId, lastOnlineParticipantIds);
      lastState = nextState;
      onStateChange(nextState);
      onConnectionStateChange?.('live');
    } catch (error: any) {
      onConnectionStateChange?.('degraded');
      onError?.(error.message || 'Live Aunt Minnie room sync failed.');
    }
  };

  const refreshPendingSlices = async () => {
    if (!lastState) {
      await refresh();
      return;
    }

    const kinds = new Set(pendingRefreshKinds);
    pendingRefreshKinds.clear();

    try {
      const [session, prompts, participants, responses, messages] = await Promise.all([
        kinds.has('session') ? fetchSession(sessionId) : Promise.resolve(lastState.session),
        kinds.has('prompts') ? fetchPrompts(sessionId) : Promise.resolve(lastState.prompts),
        kinds.has('participants') ? fetchParticipants(sessionId) : Promise.resolve(lastState.participants),
        kinds.has('responses')
          ? (
            isParticipantLivePromptOpenSession(lastState.session, lastState.isHost)
              ? fetchResponsesForUser(sessionId, userId)
              : fetchResponses(sessionId)
          )
          : Promise.resolve(lastState.responses),
        kinds.has('messages') ? fetchMessages(sessionId) : Promise.resolve(lastState.messages),
      ]);

      const nextState = buildRoomStateFromSlices(
        session,
        prompts,
        participants,
        responses,
        messages,
        userId,
        lastOnlineParticipantIds,
      );
      lastState = nextState;
      liveAuntMinnieRoomBootstrapCache.set(sessionId, nextState);
      onStateChange(nextState);
      onConnectionStateChange?.('live');
    } catch (error: any) {
      onConnectionStateChange?.('degraded');
      onError?.(error.message || 'Live Aunt Minnie room sync failed.');
    }
  };

  const queueRefresh = (kind: 'session' | 'prompts' | 'participants' | 'responses' | 'messages') => {
    pendingRefreshKinds.add(kind);
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refreshPendingSlices();
    }, 40);
  };

  const applyPatchedState = (nextState: LiveAuntMinnieRoomState) => {
    lastState = nextState;
    liveAuntMinnieRoomBootstrapCache.set(sessionId, nextState);
    onStateChange(nextState);
    onConnectionStateChange?.('live');
  };

  const bufferOrApply = (handler: () => void) => {
    if (!initialSnapshotLoaded) {
      bufferedEvents.push(handler);
      return;
    }
    handler();
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_sessions', filter: `id=eq.${sessionId}` }, (payload: any) => {
      bufferOrApply(() => {
        if (!lastState || !payload.new) {
          queueRefresh('session');
          return;
        }
        const nextState = applySessionEventToState(lastState, payload.new);
        applyPatchedState(nextState);
        if (!nextState.isHost && nextState.session.status !== 'live') {
          queueRefresh('participants');
          queueRefresh('responses');
          queueRefresh('messages');
        }
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_prompts', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
      bufferOrApply(() => {
        if (!lastState) {
          queueRefresh('prompts');
          return;
        }
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row) {
          queueRefresh('prompts');
          return;
        }
        const nextState = applyPromptEventToState(lastState, payload.eventType, row, userId);
        if (nextState === lastState && payload.eventType !== 'UPDATE') {
          queueRefresh('prompts');
          return;
        }
        applyPatchedState(nextState);
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_prompt_images', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
      bufferOrApply(() => {
        if (!lastState) {
          queueRefresh('prompts');
          return;
        }
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row) {
          queueRefresh('prompts');
          return;
        }
        const nextState = applyPromptImageEventToState(lastState, payload.eventType, row, userId);
        if (nextState === lastState) {
          queueRefresh('prompts');
          return;
        }
        applyPatchedState(nextState);
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_participants', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
      bufferOrApply(() => {
        if (!lastState) {
          queueRefresh('participants');
          return;
        }
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row) {
          queueRefresh('participants');
          return;
        }
        applyPatchedState(applyParticipantEventToState(lastState, payload.eventType, row, userId));
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_responses', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
      bufferOrApply(() => {
        if (!lastState) {
          queueRefresh('responses');
          return;
        }
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row) {
          queueRefresh('responses');
          return;
        }
        applyPatchedState(applyResponseEventToState(lastState, payload.eventType, row, userId));
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_aunt_minnie_messages', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
      bufferOrApply(() => {
        if (!lastState) {
          queueRefresh('messages');
          return;
        }
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row) {
          queueRefresh('messages');
          return;
        }
        applyPatchedState(applyMessageEventToState(lastState, payload.eventType, row, userId));
      });
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          if (lastState) {
            onStateChange(lastState);
            onConnectionStateChange?.('syncing');
            void hydrateLiveAuntMinnieRoomDeferred(sessionId, lastOnlineParticipantIds)
              .then((nextState) => {
                lastState = nextState;
                onStateChange(nextState);
                onConnectionStateChange?.('live');
              })
              .catch((error: any) => {
                onConnectionStateChange?.('degraded');
                onError?.(error.message || 'Live Aunt Minnie room sync failed.');
              });
          } else {
            await refresh();
          }
          initialSnapshotLoaded = true;
          while (bufferedEvents.length > 0) {
            const nextBufferedEvent = bufferedEvents.shift();
            nextBufferedEvent?.();
          }
          if (!presenceRegistered) {
            const session = lastState?.session || await fetchSession(sessionId);
            await upsertParticipant(sessionId, userId, session.host_user_id === userId ? 'host' : 'participant');
            await channel.track({ user_id: userId, ts: new Date().toISOString() });
            presenceRegistered = true;
          }
        } catch (error: any) {
          onConnectionStateChange?.('degraded');
          onError?.(error.message || 'Unable to join the live Aunt Minnie room.');
        }
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        presenceRegistered = false;
        onConnectionStateChange?.('reconnecting');
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
