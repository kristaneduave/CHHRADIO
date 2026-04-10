import React, { useEffect, useRef, useState } from 'react';
import {
  AuntMinnieCaseOption,
  LiveAuntMinniePrompt,
  LiveAuntMinniePromptInput,
  LiveAuntMinnieResponse,
  LiveAuntMinnieRoomState,
  LiveAuntMinnieSession,
  LiveAuntMinnieSyncState,
} from '../types';
import LiveAuntMinnieHostPanel from './live-aunt-minnie/LiveAuntMinnieHostPanel';
import LiveAuntMinnieParticipantView from './live-aunt-minnie/LiveAuntMinnieParticipantView';
import LiveAuntMinniePromptComposer from './live-aunt-minnie/LiveAuntMinniePromptComposer';
import {
  appendLiveAuntMinnieQuestion,
  createLiveAuntMinnieSession,
  deleteLiveAuntMinnieSession,
  deleteLiveAuntMinnieResponse,
  getLiveAuntMinnieSessionMeta,
  getLiveAuntMinnieRoomBootstrap,
  getLiveAuntMinnieRoomState,
  getLiveAuntMinnieWorkspace,
  getCachedLiveAuntMinnieWorkspace,
  hydrateLiveAuntMinnieRoomDeferred,
  lockLiveAuntMinnieAnswers,
  refreshLiveAuntMinnieRoomMessages,
  refreshLiveAuntMinnieRoomParticipants,
  refreshLiveAuntMinnieRoomResponses,
  submitLiveAuntMinnieResponse,
  subscribeToLiveAuntMinnieRoom,
  updateLiveAuntMinnieAnswerKey,
  updateLiveAuntMinniePrompt,
  uploadLiveAuntMinnieImage,
} from '../services/liveAuntMinnieService';
import { UserRole } from '../types';

interface LiveAuntMinnieScreenProps {
  onBack?: () => void;
}

const REALTIME_UNAVAILABLE_MESSAGE = 'Live Aunt Minnie realtime connection unavailable.';
type RoomSyncState = LiveAuntMinnieSyncState;
type LiveAuntMinnieSessionMeta = Awaited<ReturnType<typeof getLiveAuntMinnieSessionMeta>>;
const AUNT_MINNIE_DRAFT_KEY_PREFIX = 'chh:aunt-minnie:drafts:';
const DRAFT_PERSIST_DEBOUNCE_MS = 600;
const DEGRADED_REFRESH_INTERVAL_MS = 4000;
const HOST_LIVE_REFRESH_INTERVAL_MS = 1000;

const createEmptyPrompt = (): LiveAuntMinniePromptInput => ({
  images: [],
  question_text: '',
  official_answer: '',
  answer_explanation: '',
  accepted_aliases: [],
});

const mapPromptToInput = (prompt: LiveAuntMinniePrompt): LiveAuntMinniePromptInput => ({
  id: prompt.id,
  source_case_id: prompt.source_case_id || undefined,
  images: prompt.images.map((image) => ({
    image_url: image.image_url,
    caption: image.caption || '',
  })),
  question_text: prompt.question_text || '',
  official_answer: prompt.official_answer || '',
  answer_explanation: prompt.answer_explanation || '',
  accepted_aliases: prompt.accepted_aliases || [],
});

const mapSessionTone = (session: LiveAuntMinnieSession) =>
  session.status === 'live'
    ? 'border-emerald-500/20 bg-emerald-500/10'
    : 'border-white/10 bg-white/[0.03]';

const mapSessionLabel = (session: LiveAuntMinnieSession) =>
  session.status === 'live'
    ? 'Live'
    : 'Ended';

const formatSessionDateTime = (session: LiveAuntMinnieSession) => {
  const value = session.updated_at || session.started_at || session.created_at;
  if (!value) return '';

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const cloneRoomState = (state: LiveAuntMinnieRoomState): LiveAuntMinnieRoomState => ({
  ...state,
  responses: [...state.responses],
  responsesByPromptId: Object.fromEntries(
    Object.entries(state.responsesByPromptId).map(([promptId, responses]) => [promptId, [...responses]]),
  ),
  myResponsesByPromptId: { ...state.myResponsesByPromptId },
});

const normalizePromptInputAnswer = (value?: string) => value?.trim() || 'Pending correct answer';

const getDraftStorageKey = (sessionId: string) => `${AUNT_MINNIE_DRAFT_KEY_PREFIX}${sessionId}`;

const readStoredDraftResponses = (sessionId: string): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
};

const persistDraftResponses = (sessionId: string, drafts: Record<string, string>) => {
  if (typeof window === 'undefined') return;
  const trimmedEntries = Object.entries(drafts)
    .map(([promptId, value]) => [promptId, value.trim()] as const)
    .filter(([, value]) => value.length > 0);

  if (trimmedEntries.length === 0) {
    window.localStorage.removeItem(getDraftStorageKey(sessionId));
    return;
  }

  window.localStorage.setItem(getDraftStorageKey(sessionId), JSON.stringify(Object.fromEntries(trimmedEntries)));
};

const clearStoredDraftResponse = (sessionId: string, promptId: string) => {
  const drafts = readStoredDraftResponses(sessionId);
  if (!(promptId in drafts)) return;
  delete drafts[promptId];
  persistDraftResponses(sessionId, drafts);
};

const buildPromptFromInput = (
  promptId: string,
  sessionId: string,
  prompt: LiveAuntMinniePromptInput,
  sortOrder: number,
): LiveAuntMinniePrompt => {
  const now = new Date().toISOString();
  return {
    id: promptId,
    session_id: sessionId,
    sort_order: sortOrder,
    source_case_id: prompt.source_case_id || null,
    image_url: prompt.images[0]?.image_url || '',
    image_caption: prompt.images[0]?.caption || null,
    question_text: prompt.question_text?.trim() || null,
    official_answer: normalizePromptInputAnswer(prompt.official_answer),
    answer_explanation: prompt.answer_explanation?.trim() || null,
    accepted_aliases: prompt.accepted_aliases || [],
    images: (prompt.images || []).map((image, index) => ({
      id: `${promptId}:image:${index}`,
      prompt_id: promptId,
      session_id: sessionId,
      sort_order: index,
      image_url: image.image_url,
      caption: image.caption || null,
      created_at: now,
      updated_at: now,
    })),
    created_at: now,
    updated_at: now,
  };
};

const mergeRoomPrompts = (
  previous: LiveAuntMinnieRoomState,
  next: LiveAuntMinnieRoomState,
): LiveAuntMinnieRoomState => {
  const shouldPreserveLockedSession =
    previous.session.id === next.session.id
    && previous.session.status !== 'live'
    && next.session.status === 'live';

  const mergedSession = shouldPreserveLockedSession
    ? {
        ...next.session,
        status: previous.session.status,
        current_phase: previous.session.current_phase,
        ended_at: previous.session.ended_at || next.session.ended_at,
        locked_at: previous.session.locked_at || next.session.locked_at,
        locked_by: previous.session.locked_by || next.session.locked_by,
      }
    : next.session;

  if (
    previous.session.id !== next.session.id
    || next.prompts.length >= previous.prompts.length
  ) {
    return {
      ...next,
      session: mergedSession,
    };
  }

  const mergedPrompts = Array.from(
    new Map(
      [...previous.prompts, ...next.prompts].map((prompt) => [prompt.id, prompt]),
    ).values(),
  ).sort((left, right) => left.sort_order - right.sort_order);

  const mergedResponsesByPromptId = { ...next.responsesByPromptId };
  const mergedMyResponsesByPromptId = { ...next.myResponsesByPromptId };
  const mergedMessagesByPromptId = { ...next.messagesByPromptId };

  mergedPrompts.forEach((prompt) => {
    mergedResponsesByPromptId[prompt.id] = mergedResponsesByPromptId[prompt.id]
      || previous.responsesByPromptId[prompt.id]
      || [];
    mergedMyResponsesByPromptId[prompt.id] = mergedMyResponsesByPromptId[prompt.id]
      ?? previous.myResponsesByPromptId[prompt.id]
      ?? null;
    mergedMessagesByPromptId[prompt.id] = mergedMessagesByPromptId[prompt.id]
      || previous.messagesByPromptId[prompt.id]
      || [];
  });

  return {
    ...next,
    session: {
      ...mergedSession,
      prompt_count: Math.max(next.session.prompt_count, mergedPrompts.length),
    },
    prompts: mergedPrompts,
    responsesByPromptId: mergedResponsesByPromptId,
    myResponsesByPromptId: mergedMyResponsesByPromptId,
    messagesByPromptId: mergedMessagesByPromptId,
  };
};

const isAnswersLockedError = (message: string) =>
  /answers are locked|no longer accepting answers/i.test(message);

const LiveAuntMinnieScreen: React.FC<LiveAuntMinnieScreenProps> = ({ onBack }) => {
  const cachedWorkspace = getCachedLiveAuntMinnieWorkspace();
  const [loading, setLoading] = useState(!cachedWorkspace);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<{
    currentUserId: string;
    currentUserRole: UserRole | null;
    canHost: boolean;
    hostSessions: LiveAuntMinnieSession[];
    joinableSessions: LiveAuntMinnieSession[];
    auntMinnieCases: AuntMinnieCaseOption[];
  } | null>(cachedWorkspace);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<LiveAuntMinnieRoomState | null>(null);
  const [roomSyncState, setRoomSyncState] = useState<RoomSyncState>('connecting');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftResponsesByPromptId, setDraftResponsesByPromptId] = useState<Record<string, string>>({});
  const [responseStatusByPromptId, setResponseStatusByPromptId] = useState<Record<string, 'typing' | 'saving' | 'saved' | 'retry failed'>>({});
  const [submittingPromptIds, setSubmittingPromptIds] = useState<Record<string, boolean>>({});
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [composerPrompt, setComposerPrompt] = useState<LiveAuntMinniePromptInput>(createEmptyPrompt());
  const [lockCountdownSeconds, setLockCountdownSeconds] = useState<number | null>(null);
  const roomStateRef = useRef<LiveAuntMinnieRoomState | null>(null);
  const attemptedPromptRepairRef = useRef<string | null>(null);
  const latestDraftResponsesRef = useRef<Record<string, string>>({});
  const queuedResponseValuesRef = useRef<Record<string, string | undefined>>({});
  const submittingPromptIdsRef = useRef<Record<string, boolean>>({});
  const lastSessionMetaRef = useRef<LiveAuntMinnieSessionMeta | null>(null);

  const applyRoomState = (nextState: LiveAuntMinnieRoomState) => {
    const mergedState = roomStateRef.current
      ? mergeRoomPrompts(roomStateRef.current, nextState)
      : nextState;
    roomStateRef.current = mergedState;
    setRoomState(mergedState);
    setDraftResponsesByPromptId((previous) => {
      const next = { ...previous };
      mergedState.prompts.forEach((prompt) => {
        if (!(prompt.id in next)) {
          next[prompt.id] = mergedState.myResponsesByPromptId[prompt.id]?.response_text || '';
        }
      });
      return next;
    });
  };

  const hydrateParticipantDrafts = (sessionId: string, nextState: LiveAuntMinnieRoomState) => {
    const storedDrafts = readStoredDraftResponses(sessionId);
    setDraftResponsesByPromptId((previous) => {
      const next = { ...previous };
      nextState.prompts.forEach((prompt) => {
        if (typeof storedDrafts[prompt.id] === 'string' && storedDrafts[prompt.id].trim().length > 0) {
          next[prompt.id] = storedDrafts[prompt.id];
        } else if (!(prompt.id in next)) {
          next[prompt.id] = nextState.myResponsesByPromptId[prompt.id]?.response_text || '';
        }
      });
      return next;
    });
  };

  const updatePromptAnswerKeyLocally = (promptId: string, officialAnswer: string) => {
    setRoomState((previous) => {
      if (!previous) return previous;
      const nextPrompts = previous.prompts.map((prompt) =>
        prompt.id === promptId
          ? {
              ...prompt,
              official_answer: officialAnswer,
            }
          : prompt,
      );

      const nextState = {
        ...previous,
        prompts: nextPrompts,
      };
      roomStateRef.current = nextState;
      return nextState;
    });
  };

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    if (!roomState || !currentSessionId) {
      attemptedPromptRepairRef.current = null;
      return;
    }

    const hasPromptMismatch = roomState.prompts.length < roomState.session.prompt_count;
    if (!hasPromptMismatch) {
      attemptedPromptRepairRef.current = null;
      return;
    }

    const repairKey = `${currentSessionId}:${roomState.prompts.length}:${roomState.session.prompt_count}`;
    if (attemptedPromptRepairRef.current === repairKey) {
      return;
    }

    attemptedPromptRepairRef.current = repairKey;
    void refreshCurrentRoom(currentSessionId, roomState.onlineParticipantIds).catch(() => {
      // Keep the current UI if the repair refresh fails.
    });
  }, [currentSessionId, roomState]);

  useEffect(() => {
    latestDraftResponsesRef.current = draftResponsesByPromptId;
  }, [draftResponsesByPromptId]);

  useEffect(() => {
    submittingPromptIdsRef.current = submittingPromptIds;
  }, [submittingPromptIds]);

  useEffect(() => {
    if (!currentSessionId || roomState?.isHost) return;
    const timer = window.setTimeout(() => {
      persistDraftResponses(currentSessionId, latestDraftResponsesRef.current);
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [currentSessionId, draftResponsesByPromptId, roomState?.isHost]);

  const refreshCurrentRoom = async (sessionId: string, onlineParticipantIds: string[] = []) => {
    const nextState = await getLiveAuntMinnieRoomState(sessionId, onlineParticipantIds, { force: true });
    applyRoomState(nextState);
    return nextState;
  };

  const mutateRoomState = (updater: (state: LiveAuntMinnieRoomState) => LiveAuntMinnieRoomState) => {
    setRoomState((previous) => {
      if (!previous) return previous;
      const next = updater(cloneRoomState(previous));
      roomStateRef.current = next;
      return next;
    });
  };

  const loadWorkspace = async (options?: { force?: boolean; preserveLoading?: boolean }) => {
    if (!options?.preserveLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getLiveAuntMinnieWorkspace({ force: options?.force });
      setWorkspace(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Aunt Minnie.');
    } finally {
      if (!options?.preserveLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadWorkspace({
      force: false,
      preserveLoading: Boolean(cachedWorkspace),
    });
  }, []);

  useEffect(() => {
    if (!currentSessionId) {
      setRoomState(null);
      setRoomSyncState('connecting');
      return;
    }

    let isMounted = true;
    let cleanup: (() => void) | null = null;

    void subscribeToLiveAuntMinnieRoom({
      sessionId: currentSessionId,
      initialState: roomStateRef.current,
      onConnectionStateChange: setRoomSyncState,
      onStateChange: (nextState) => {
        if (!isMounted) return;
        setError((previous) => (previous === REALTIME_UNAVAILABLE_MESSAGE ? null : previous));
        applyRoomState(nextState);
      },
      onError: (message) => {
        if (!isMounted) return;
        if (message === REALTIME_UNAVAILABLE_MESSAGE) {
          return;
        }
        setError(message);
      },
    }).then((unsubscribe) => {
      cleanup = unsubscribe;
    }).catch((err: any) => {
      if (!isMounted) return;
      if ((err.message || '') !== REALTIME_UNAVAILABLE_MESSAGE) {
        setError(err.message || 'Unable to connect to the room.');
      }
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [currentSessionId]);

  useEffect(() => {
    if (!currentSessionId || !roomState || roomState.isHost) return;
    if (roomState.participants.length > 0 && roomState.messages.length > 0) return;

    let cancelled = false;
    void hydrateLiveAuntMinnieRoomDeferred(currentSessionId, roomState.onlineParticipantIds)
      .then((nextState) => {
        if (cancelled) return;
        applyRoomState(nextState);
        hydrateParticipantDrafts(currentSessionId, nextState);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [currentSessionId, roomState?.session.id, roomState?.isHost, roomState?.participants.length, roomState?.messages.length]);

  useEffect(() => {
    if (!currentSessionId) return;

    const shouldHostAutoRefresh = Boolean(roomState?.isHost && roomState.session.status === 'live');
    const shouldBackgroundRefresh =
      roomSyncState === 'degraded'
      || roomSyncState === 'reconnecting'
      || roomSyncState === 'connecting'
      || shouldHostAutoRefresh;

    if (!shouldBackgroundRefresh) {
      return;
    }

    let cancelled = false;
    let refreshInFlight = false;

    const refreshRoom = async () => {
      if (cancelled || refreshInFlight || document.visibilityState !== 'visible') {
        return;
      }

      refreshInFlight = true;
      try {
        const currentState = roomStateRef.current;
        const nextState = currentState
          ? await hydrateLiveAuntMinnieRoomDeferred(currentSessionId, currentState.onlineParticipantIds)
          : await getLiveAuntMinnieRoomBootstrap(currentSessionId, roomState?.onlineParticipantIds || []);
        if (!cancelled) {
          applyRoomState(nextState);
        }
      } catch {
        // Keep existing realtime state if polling fails.
      } finally {
        refreshInFlight = false;
      }
    };

    const probeRoomMeta = async () => {
      if (cancelled || refreshInFlight || document.visibilityState !== 'visible') {
        return;
      }

      try {
        const nextMeta = await getLiveAuntMinnieSessionMeta(currentSessionId);
        if (cancelled) return;

        const previousMeta = lastSessionMetaRef.current;
        lastSessionMetaRef.current = nextMeta;

        if (!previousMeta) {
          return;
        }

        const shouldRefreshWholeRoom =
          nextMeta.status !== previousMeta.status
          || nextMeta.current_phase !== previousMeta.current_phase
          || nextMeta.current_prompt_index !== previousMeta.current_prompt_index
          || nextMeta.prompt_count !== previousMeta.prompt_count
          || nextMeta.ended_at !== previousMeta.ended_at
          || nextMeta.prompts_version !== previousMeta.prompts_version;

        if (shouldRefreshWholeRoom) {
          await refreshRoom();
          return;
        }

        const currentState = roomStateRef.current;
        if (!currentState || currentState.session.id !== currentSessionId) {
          await refreshRoom();
          return;
        }

        if (nextMeta.participants_version !== previousMeta.participants_version) {
          const nextState = await refreshLiveAuntMinnieRoomParticipants(currentSessionId, currentState);
          if (!cancelled) {
            applyRoomState(nextState);
          }
          return;
        }

        if (nextMeta.messages_version !== previousMeta.messages_version) {
          const nextState = await refreshLiveAuntMinnieRoomMessages(currentSessionId, currentState);
          if (!cancelled) {
            applyRoomState(nextState);
          }
          return;
        }

        if (nextMeta.responses_version !== previousMeta.responses_version) {
          const nextState = await refreshLiveAuntMinnieRoomResponses(currentSessionId, currentState);
          if (!cancelled) {
            applyRoomState(nextState);
          }
        }
      } catch {
        // Keep existing realtime state if metadata polling fails.
      }
    };

    const intervalId = window.setInterval(() => {
      void probeRoomMeta();
    }, shouldHostAutoRefresh ? HOST_LIVE_REFRESH_INTERVAL_MS : DEGRADED_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void probeRoomMeta();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentSessionId, roomState?.isHost, roomState?.onlineParticipantIds, roomState?.session.status, roomSyncState]);

  const refreshWorkspace = async () => {
    try {
      const data = await getLiveAuntMinnieWorkspace({ force: true });
      setWorkspace(data);
    } catch {
      // Keep current UI state if workspace refresh fails.
    }
  };

  const openSession = async (sessionId: string) => {
    setBusyAction(`open-room:${sessionId}`);
    setError(null);
    setDraftResponsesByPromptId({});
    setResponseStatusByPromptId({});
    setSubmittingPromptIds({});
    lastSessionMetaRef.current = null;
    setRoomState(null);
    setRoomSyncState('connecting');
    try {
      const bootstrapState = await getLiveAuntMinnieRoomBootstrap(sessionId);
      applyRoomState(bootstrapState);
      hydrateParticipantDrafts(sessionId, bootstrapState);
      setCurrentSessionId(sessionId);
      setRoomSyncState('syncing');
    } catch (err: any) {
      setError(err.message || 'Unable to open the live room.');
    } finally {
      setBusyAction(null);
    }
    setIsComposerOpen(false);
    setEditingPromptId(null);
    setComposerPrompt(createEmptyPrompt());
  };

  const closeRoom = () => {
    setCurrentSessionId(null);
    setRoomState(null);
    setRoomSyncState('connecting');
    setLockCountdownSeconds(null);
    setResponseStatusByPromptId({});
    roomStateRef.current = null;
    latestDraftResponsesRef.current = {};
    queuedResponseValuesRef.current = {};
    submittingPromptIdsRef.current = {};
    lastSessionMetaRef.current = null;
    setIsComposerOpen(false);
    setEditingPromptId(null);
    setComposerPrompt(createEmptyPrompt());
    void refreshWorkspace();
  };

  const handleOpenTrainingOfficerRoom = async () => {
    setBusyAction('create-room');
    setError(null);
    try {
      const session = await createLiveAuntMinnieSession({
        title: draftTitle.trim() || 'Aunt Minnie Room',
        allowLateJoin: true,
        prompts: [],
      });
      await refreshWorkspace();
      await openSession(session.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start room.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUploadPromptImage = async (file: File) => {
    setBusyAction('upload-image');
    setError(null);
    try {
      const imageUrl = await uploadLiveAuntMinnieImage(file);
      setComposerPrompt((previous) => ({
        ...previous,
        images: [...(previous.images || []), { image_url: imageUrl, caption: '' }],
      }));
    } catch (err: any) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleLockAnswers = async () => {
    if (!roomState) return;
    if (lockCountdownSeconds !== null) return;
    setLockCountdownSeconds(3);
  };

  useEffect(() => {
    if (lockCountdownSeconds === null) {
      return;
    }

    if (lockCountdownSeconds > 0) {
      const timer = window.setTimeout(() => {
        setLockCountdownSeconds((previous) => (previous === null ? previous : previous - 1));
      }, 1000);
      return () => window.clearTimeout(timer);
    }

    const currentRoomState = roomStateRef.current;
    if (!currentRoomState) {
      setLockCountdownSeconds(null);
      return;
    }

    let cancelled = false;
    setBusyAction('lock-answers');
    setError(null);
    void (async () => {
      try {
        mutateRoomState((previous) => ({
          ...previous,
          session: {
            ...previous.session,
            status: 'completed',
            current_phase: 'completed',
            ended_at: new Date().toISOString(),
          },
        }));
        await lockLiveAuntMinnieAnswers(currentRoomState.session.id);
        await refreshWorkspace();
      } catch (err: any) {
        await refreshCurrentRoom(currentRoomState.session.id, currentRoomState.onlineParticipantIds);
        if (!cancelled) {
          setError(err.message || 'Failed to lock answers.');
        }
      } finally {
        if (!cancelled) {
          setBusyAction(null);
          setLockCountdownSeconds(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lockCountdownSeconds]);

  const handleDeleteSession = async (sessionId: string) => {
    setBusyAction(`delete-room:${sessionId}`);
    setError(null);
    try {
      await deleteLiveAuntMinnieSession(sessionId);
      if (currentSessionId === sessionId) {
        closeRoom();
        return;
      }
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to delete room.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleManualResync = async () => {
    if (!currentSessionId) return;
    setBusyAction('manual-resync');
    setError(null);
    try {
      await refreshCurrentRoom(currentSessionId, roomState?.onlineParticipantIds || []);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh room.');
    } finally {
      setBusyAction(null);
    }
  };

  const openNewPromptComposer = () => {
    setEditingPromptId(null);
    setComposerPrompt(createEmptyPrompt());
    setIsComposerOpen(true);
  };

  const openEditPromptComposer = (prompt: LiveAuntMinniePrompt) => {
    setEditingPromptId(prompt.id);
    setComposerPrompt(mapPromptToInput(prompt));
    setIsComposerOpen(true);
  };

  const composerQuestionNumber = (() => {
    if (!roomState) return 1;

    if (editingPromptId) {
      const existingPromptIndex = roomState.prompts.findIndex((prompt) => prompt.id === editingPromptId);
      return existingPromptIndex >= 0 ? existingPromptIndex + 1 : 1;
    }

    return roomState.prompts.length + 1;
  })();

  const handleSavePrompt = async () => {
    if (!roomState) return;
    setBusyAction(editingPromptId ? 'edit-prompt' : 'append-question');
    setError(null);
    try {
      if (editingPromptId) {
        await updateLiveAuntMinniePrompt(roomState.session.id, editingPromptId, composerPrompt);
        mutateRoomState((previous) => {
          const existingPrompt = previous.prompts.find((prompt) => prompt.id === editingPromptId);
          if (!existingPrompt) return previous;
          const nextPrompt = buildPromptFromInput(
            editingPromptId,
            previous.session.id,
            composerPrompt,
            existingPrompt.sort_order,
          );
          return {
            ...previous,
            prompts: previous.prompts.map((prompt) => (prompt.id === editingPromptId ? nextPrompt : prompt)),
          };
        });
      } else {
        const insertedPromptId = await appendLiveAuntMinnieQuestion(roomState.session.id, composerPrompt);
        mutateRoomState((previous) => {
          const insertAt = previous.prompts.length;
          const insertedPrompt = buildPromptFromInput(
            insertedPromptId,
            previous.session.id,
            composerPrompt,
            insertAt,
          );
          return {
            ...previous,
            session: {
              ...previous.session,
              prompt_count: previous.prompts.length + 1,
              current_prompt_index:
                previous.session.status === 'live' && previous.session.current_phase === 'prompt_open'
                  ? previous.prompts.length
                  : previous.session.current_prompt_index,
            },
            prompts: [...previous.prompts, insertedPrompt].sort((left, right) => left.sort_order - right.sort_order),
          };
        });
      }
      setIsComposerOpen(false);
      setEditingPromptId(null);
      setComposerPrompt(createEmptyPrompt());
      await refreshWorkspace();
    } catch (err: any) {
      await refreshCurrentRoom(roomState.session.id, roomState.onlineParticipantIds);
      setError(err.message || 'Failed to save question.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSubmitResponse = async (promptId: string, explicitValue?: string) => {
    const currentRoomState = roomStateRef.current;
    if (!currentRoomState) return;
    if (currentRoomState.isHost) {
      setError('Hosts cannot submit answers in their own Live Aunt Minnie room.');
      return;
    }
    const body = (explicitValue ?? latestDraftResponsesRef.current[promptId] ?? '').trim();
    const existingResponse = currentRoomState.myResponsesByPromptId[promptId];

    if (!body && !existingResponse) return;

    if (submittingPromptIdsRef.current[promptId]) {
      queuedResponseValuesRef.current[promptId] = body;
      return;
    }

    setSubmittingPromptIds((previous) => ({ ...previous, [promptId]: true }));
    submittingPromptIdsRef.current = { ...submittingPromptIdsRef.current, [promptId]: true };
    setResponseStatusByPromptId((previous) => ({ ...previous, [promptId]: 'saving' }));
    setError(null);
    try {
      if (!body && existingResponse) {
        setRoomState((previous) => {
          if (!previous) return previous;
          const next = cloneRoomState(previous);
          next.responses = next.responses.filter((response) => response.id !== existingResponse.id);
          next.responsesByPromptId[promptId] = (next.responsesByPromptId[promptId] || []).filter(
            (response) => response.id !== existingResponse.id,
          );
          next.myResponsesByPromptId[promptId] = null;
          return next;
        });
        await deleteLiveAuntMinnieResponse({
          sessionId: currentRoomState.session.id,
          promptId,
        });
        setDraftResponsesByPromptId((previous) => ({ ...previous, [promptId]: '' }));
        clearStoredDraftResponse(currentRoomState.session.id, promptId);
        setResponseStatusByPromptId((previous) => ({ ...previous, [promptId]: 'saved' }));
      } else if (body) {
        const optimisticResponse: LiveAuntMinnieResponse = existingResponse
          ? {
              ...existingResponse,
              response_text: body,
              updated_at: new Date().toISOString(),
            }
          : {
              id: `optimistic:${promptId}:${workspace?.currentUserId || 'me'}`,
              session_id: currentRoomState.session.id,
              prompt_id: promptId,
              user_id: workspace?.currentUserId || '',
              response_text: body,
              judgment: 'unreviewed',
              consultant_note: null,
              submitted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              reviewed_at: null,
              reviewed_by: null,
              participant: currentRoomState.participants.find(
                (participant) => participant.user_id === (workspace?.currentUserId || ''),
              )?.profile || null,
            };

        setRoomState((previous) => {
          if (!previous) return previous;
          const next = cloneRoomState(previous);
          const promptResponses = next.responsesByPromptId[promptId] || [];
          const filteredPromptResponses = promptResponses.filter(
            (response) => response.user_id !== optimisticResponse.user_id,
          );
          next.responses = next.responses.filter((response) => response.user_id !== optimisticResponse.user_id);
          next.responses.push(optimisticResponse);
          next.responsesByPromptId[promptId] = [...filteredPromptResponses, optimisticResponse];
          next.myResponsesByPromptId[promptId] = optimisticResponse;
          return next;
        });

        const savedResponse = await submitLiveAuntMinnieResponse({
          sessionId: currentRoomState.session.id,
          promptId,
          responseText: body,
        });
        setRoomState((previous) => {
          if (!previous) return previous;
          const next = cloneRoomState(previous);
          next.responses = next.responses.filter((response) => response.user_id !== savedResponse.user_id);
          next.responses.push(savedResponse);
          next.responsesByPromptId[promptId] = [
            ...(next.responsesByPromptId[promptId] || []).filter(
              (response) => response.user_id !== savedResponse.user_id,
            ),
            savedResponse,
          ];
          next.myResponsesByPromptId[promptId] = savedResponse;
          return next;
        });
        setDraftResponsesByPromptId((previous) => ({ ...previous, [promptId]: body }));
        clearStoredDraftResponse(currentRoomState.session.id, promptId);
        setResponseStatusByPromptId((previous) => ({ ...previous, [promptId]: 'saved' }));
      }
    } catch (err: any) {
      const message = err.message || 'Failed to save answer.';
      setError(message);
      setResponseStatusByPromptId((previous) => ({ ...previous, [promptId]: 'retry failed' }));

      if (isAnswersLockedError(message)) {
        setRoomState((previous) => {
          if (!previous) return previous;
          const next = cloneRoomState(previous);
          next.session = {
            ...next.session,
            status: 'completed',
            current_phase: 'completed',
            ended_at: next.session.ended_at || new Date().toISOString(),
          };
          return next;
        });

        try {
          await refreshCurrentRoom(currentRoomState.session.id, currentRoomState.onlineParticipantIds);
        } catch {
          // Keep the local locked fallback if refresh fails.
        }
      }
    } finally {
      setSubmittingPromptIds((previous) => ({ ...previous, [promptId]: false }));
      submittingPromptIdsRef.current = { ...submittingPromptIdsRef.current, [promptId]: false };
      const queuedValue = queuedResponseValuesRef.current[promptId];
      if (queuedValue !== undefined) {
        delete queuedResponseValuesRef.current[promptId];
        if (queuedValue !== body) {
          void handleSubmitResponse(promptId, queuedValue);
        }
      }
    }
  };

  const renderRoomList = (sessions: LiveAuntMinnieSession[], emptyLabel: string) => (
    <div className="space-y-3">
      {sessions.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
          {emptyLabel}
        </div>
      ) : (
        sessions.map((session) => (
          <div
            key={session.id}
            className={`w-full rounded-[22px] border p-4 text-left transition hover:opacity-90 ${mapSessionTone(session)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => void openSession(session.id)}
                disabled={busyAction === `open-room:${session.id}`}
                className="min-w-0 flex-1 text-left disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{session.title}</p>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-slate-300">
                    {busyAction === `open-room:${session.id}` ? 'Opening...' : mapSessionLabel(session)}
                  </span>
                </div>
                {formatSessionDateTime(session) && (
                  <p className="mt-2 text-xs text-slate-400">{formatSessionDateTime(session)}</p>
                )}
              </button>
              {workspace?.canHost && session.host_user_id === workspace.currentUserId && (
                <button
                  type="button"
                  onClick={() => void handleDeleteSession(session.id)}
                  disabled={busyAction === `delete-room:${session.id}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/15 disabled:opacity-50"
                  aria-label="Delete room"
                  title="Delete room"
                >
                  <span className="material-icons text-[18px]">delete</span>
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderHub = () => (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white sm:text-4xl">Aunt Minnie</h1>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Back
          </button>
        )}
      </header>

      {error && (
        <div className="rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          {workspace?.canHost && (
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Insert exam title here"
                className="min-w-0 flex-1 rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
              />
              <button
                type="button"
                onClick={() => void handleOpenTrainingOfficerRoom()}
                disabled={!draftTitle.trim() || busyAction === 'create-room'}
                className="rounded-[20px] border border-cyan-400/20 bg-cyan-500/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {busyAction === 'create-room' ? 'Starting...' : 'Start room'}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Rooms</h2>
          <span className="text-xs text-slate-400">
            {Array.from(
              new Map(
                [
                  ...(workspace?.joinableSessions || []),
                  ...(workspace?.hostSessions || []),
                ].map((session) => [session.id, session]),
              ).values(),
            ).length}
          </span>
        </div>
        {renderRoomList(
          Array.from(
            new Map(
              [
                ...(workspace?.joinableSessions || []),
                ...(workspace?.hostSessions || []),
              ]
                .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime())
                .map((session) => [session.id, session]),
            ).values(),
          ),
          'No rooms yet',
        )}
      </section>
    </div>
  );

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/5 border-t-cyan-400" />
          <p className="mt-4 text-white">Loading Aunt Minnie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-nav-clearance px-4 pt-4 sm:px-6 sm:pt-6">
      {currentSessionId && roomState ? (
        <div className="mx-auto max-w-5xl space-y-4">
          {error && <p className="text-sm text-rose-300">{error}</p>}

          {roomState.isHost ? (
            <>
              <LiveAuntMinnieHostPanel
                busyAction={busyAction}
                currentUserId={workspace?.currentUserId || null}
                draftResponsesByPromptId={draftResponsesByPromptId}
                lockCountdownSeconds={lockCountdownSeconds}
                onBack={closeRoom}
                onCancelLockCountdown={() => setLockCountdownSeconds(null)}
                roomSyncState={roomSyncState}
                onCompose={openNewPromptComposer}
                onDraftChange={(promptId, value) =>
                  {
                    setDraftResponsesByPromptId((previous) => ({ ...previous, [promptId]: value }));
                    setResponseStatusByPromptId((previous) => ({
                      ...previous,
                      [promptId]: value.trim().length > 0 ? 'typing' : (previous[promptId] === 'retry failed' ? 'retry failed' : 'typing'),
                    }));
                  }
                }
                onEditPrompt={openEditPromptComposer}
                onLockAnswers={handleLockAnswers}
                onRefresh={handleManualResync}
                onSubmitResponse={handleSubmitResponse}
                roomState={roomState}
                submittingPromptIds={submittingPromptIds}
                onSaveCorrectAnswer={async (promptId, value) => {
                  setBusyAction(`save-answer-key:${promptId}`);
                  setError(null);
                  try {
                    await updateLiveAuntMinnieAnswerKey(roomState.session.id, promptId, {
                      official_answer: value,
                      answer_explanation: '',
                      accepted_aliases: [],
                    });
                    updatePromptAnswerKeyLocally(promptId, value);
                  } catch (err: any) {
                    setError(err.message || 'Failed to save answer.');
                  } finally {
                    setBusyAction(null);
                  }
                }}
              />
            </>
          ) : (
            <LiveAuntMinnieParticipantView
              busyAction={busyAction}
              currentUserId={workspace?.currentUserId || null}
              draftResponsesByPromptId={draftResponsesByPromptId}
              responseStatusByPromptId={responseStatusByPromptId}
              onBack={closeRoom}
              onDraftChange={(promptId, value) =>
                {
                  setDraftResponsesByPromptId((previous) => ({ ...previous, [promptId]: value }));
                  setResponseStatusByPromptId((previous) => ({
                    ...previous,
                    [promptId]: value.trim().length > 0 ? 'typing' : 'typing',
                  }));
                }
              }
              onRefresh={handleManualResync}
              roomSyncState={roomSyncState}
              onSubmitResponse={handleSubmitResponse}
              roomState={roomState}
              submittingPromptIds={submittingPromptIds}
            />
          )}

          {roomState.isHost && isComposerOpen && (
            <div className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm">
              <button
                type="button"
                aria-label="Close composer"
                onClick={() => setIsComposerOpen(false)}
                className="absolute inset-0"
              />
              <div className="absolute inset-x-0 bottom-0 top-20 overflow-hidden md:inset-x-auto md:right-0 md:top-0 md:w-[430px]">
                <LiveAuntMinniePromptComposer
                  auntMinnieCases={workspace?.auntMinnieCases || []}
                  onAddPromptImage={handleUploadPromptImage}
                  onClose={() => {
                    setIsComposerOpen(false);
                  }}
                  onPromptChange={(updates) =>
                    setComposerPrompt((previous) => ({
                      ...previous,
                      ...updates,
                    }))
                  }
                  onSave={handleSavePrompt}
                  postActionLabel="Post now"
                  prompt={composerPrompt}
                  questionNumber={composerQuestionNumber}
                  saving={busyAction === 'append-question' || busyAction === 'edit-prompt' || busyAction === 'upload-image'}
                />
              </div>
            </div>
          )}

          {roomState.isHost && lockCountdownSeconds !== null && lockCountdownSeconds > 0 && (
            <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm">
              <div className="flex h-full items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#101b26] p-5 text-center shadow-[0_30px_80px_rgba(3,10,18,0.55)]">
                  <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/10" />
                  <p className="text-lg font-semibold text-white">Ending exam in {lockCountdownSeconds}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Participants should submit their latest answers now.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLockCountdownSeconds(null)}
                    className="mt-5 w-full rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        renderHub()
      )}
    </div>
  );
};

export default LiveAuntMinnieScreen;
