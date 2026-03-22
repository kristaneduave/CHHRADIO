import React, { useEffect, useRef, useState } from 'react';
import {
  AuntMinnieCaseOption,
  LiveAuntMinniePrompt,
  LiveAuntMinniePromptInput,
  LiveAuntMinnieResponse,
  LiveAuntMinnieRoomState,
  LiveAuntMinnieSession,
} from '../types';
import LiveAuntMinnieHostPanel from './live-aunt-minnie/LiveAuntMinnieHostPanel';
import LiveAuntMinnieParticipantView from './live-aunt-minnie/LiveAuntMinnieParticipantView';
import LiveAuntMinniePromptComposer from './live-aunt-minnie/LiveAuntMinniePromptComposer';
import {
  appendLiveAuntMinnieQuestion,
  advanceLiveAuntMinniePrompt,
  completeLiveAuntMinnieSession,
  createLiveAuntMinnieSession,
  deleteLiveAuntMinnieSession,
  deleteLiveAuntMinnieResponse,
  getLiveAuntMinnieRoomState,
  getLiveAuntMinnieWorkspace,
  submitLiveAuntMinnieResponse,
  subscribeToLiveAuntMinnieRoom,
  updateLiveAuntMinniePrompt,
  uploadLiveAuntMinnieImage,
} from '../services/liveAuntMinnieService';

interface LiveAuntMinnieScreenProps {
  onBack?: () => void;
}

const REALTIME_UNAVAILABLE_MESSAGE = 'Live Aunt Minnie realtime connection unavailable.';

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
    : session.status === 'completed'
        ? 'Ended'
        : 'Closed';

const cloneRoomState = (state: LiveAuntMinnieRoomState): LiveAuntMinnieRoomState => ({
  ...state,
  responses: [...state.responses],
  responsesByPromptId: Object.fromEntries(
    Object.entries(state.responsesByPromptId).map(([promptId, responses]) => [promptId, [...responses]]),
  ),
  myResponsesByPromptId: { ...state.myResponsesByPromptId },
});

const LiveAuntMinnieScreen: React.FC<LiveAuntMinnieScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<{
    currentUserId: string;
    currentUserRole: any;
    canHost: boolean;
    hostSessions: LiveAuntMinnieSession[];
    joinableSessions: LiveAuntMinnieSession[];
    auntMinnieCases: AuntMinnieCaseOption[];
  } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<LiveAuntMinnieRoomState | null>(null);
  const [draftTitle, setDraftTitle] = useState('Friday Noon Aunt Minnie');
  const [composerDelaySeconds, setComposerDelaySeconds] = useState<number | null>(null);
  const [pendingPromptReleaseAtById, setPendingPromptReleaseAtById] = useState<Record<string, number>>({});
  const [draftResponsesByPromptId, setDraftResponsesByPromptId] = useState<Record<string, string>>({});
  const [submittingPromptIds, setSubmittingPromptIds] = useState<Record<string, boolean>>({});
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [composerPrompt, setComposerPrompt] = useState<LiveAuntMinniePromptInput>(createEmptyPrompt());
  const roomStateRef = useRef<LiveAuntMinnieRoomState | null>(null);
  const latestDraftResponsesRef = useRef<Record<string, string>>({});
  const queuedResponseValuesRef = useRef<Record<string, string | undefined>>({});
  const submittingPromptIdsRef = useRef<Record<string, boolean>>({});

  const applyRoomState = (nextState: LiveAuntMinnieRoomState) => {
    roomStateRef.current = nextState;
    setRoomState(nextState);
    setDraftResponsesByPromptId((previous) => {
      const next = { ...previous };
      nextState.prompts.forEach((prompt) => {
        if (!(prompt.id in next)) {
          next[prompt.id] = nextState.myResponsesByPromptId[prompt.id]?.response_text || '';
        }
      });
      return next;
    });
  };

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    latestDraftResponsesRef.current = draftResponsesByPromptId;
  }, [draftResponsesByPromptId]);

  useEffect(() => {
    submittingPromptIdsRef.current = submittingPromptIds;
  }, [submittingPromptIds]);

  const refreshCurrentRoom = async (sessionId: string, onlineParticipantIds: string[] = []) => {
    const nextState = await getLiveAuntMinnieRoomState(sessionId, onlineParticipantIds);
    applyRoomState(nextState);
    return nextState;
  };

  const loadWorkspace = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLiveAuntMinnieWorkspace();
      setWorkspace(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Aunt Minnie.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (!currentSessionId) {
      setRoomState(null);
      return;
    }

    let isMounted = true;
    let cleanup: (() => void) | null = null;

    void subscribeToLiveAuntMinnieRoom({
      sessionId: currentSessionId,
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
    if (!currentSessionId) return;

    let cancelled = false;
    let refreshInFlight = false;

    const refreshRoom = async () => {
      if (cancelled || refreshInFlight || document.visibilityState !== 'visible') {
        return;
      }

      refreshInFlight = true;
      try {
        const nextState = await getLiveAuntMinnieRoomState(currentSessionId, roomState?.onlineParticipantIds || []);
        if (!cancelled) applyRoomState(nextState);
      } catch {
        // Keep existing realtime state if polling fails.
      } finally {
        refreshInFlight = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshRoom();
    }, 1200);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshRoom();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentSessionId, roomState?.onlineParticipantIds]);

  useEffect(() => {
    if (!roomState?.isHost || roomState.session.status !== 'live') {
      return;
    }

    const queuedPrompt = roomState.prompts[roomState.session.current_prompt_index + 1];
    if (!queuedPrompt) {
      return;
    }

    const releaseAt = pendingPromptReleaseAtById[queuedPrompt.id];
    if (!releaseAt) {
      return;
    }

    const advanceQueuedPrompt = async () => {
      try {
        await advanceLiveAuntMinniePrompt(roomState.session.id);
        await refreshCurrentRoom(roomState.session.id, roomState.onlineParticipantIds);
        await refreshWorkspace();
      } catch {
        // Keep current room state if delayed release fails.
      }
    };

    const remaining = releaseAt - Date.now();
    if (remaining <= 0) {
      void advanceQueuedPrompt();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void advanceQueuedPrompt();
    }, remaining + 50);

    return () => window.clearTimeout(timeoutId);
  }, [
    pendingPromptReleaseAtById,
    roomState?.isHost,
    roomState?.onlineParticipantIds,
    roomState?.prompts,
    roomState?.session.current_prompt_index,
    roomState?.session.id,
    roomState?.session.status,
  ]);

  useEffect(() => {
    if (!roomState) return;

    setPendingPromptReleaseAtById((previous) => {
      const activePromptIds = new Set(
        roomState.prompts
          .slice(roomState.session.current_prompt_index + 1)
          .map((prompt) => prompt.id),
      );
      const nextEntries = Object.entries(previous).filter(([promptId]) => activePromptIds.has(promptId));
      return nextEntries.length === Object.keys(previous).length
        ? previous
        : Object.fromEntries(nextEntries);
    });
  }, [roomState]);

  const refreshWorkspace = async () => {
    try {
      const data = await getLiveAuntMinnieWorkspace();
      setWorkspace(data);
    } catch {
      // Keep current UI state if workspace refresh fails.
    }
  };

  const openSession = async (sessionId: string) => {
    setError(null);
    setCurrentSessionId(sessionId);
    setDraftResponsesByPromptId({});
    setSubmittingPromptIds({});
    setIsComposerOpen(false);
    setEditingPromptId(null);
    setComposerPrompt(createEmptyPrompt());
    setComposerDelaySeconds(null);
  };

  const closeRoom = () => {
    setCurrentSessionId(null);
    setRoomState(null);
    roomStateRef.current = null;
    latestDraftResponsesRef.current = {};
    queuedResponseValuesRef.current = {};
    submittingPromptIdsRef.current = {};
    setIsComposerOpen(false);
    setEditingPromptId(null);
    setComposerPrompt(createEmptyPrompt());
    setComposerDelaySeconds(null);
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

  const handlePostNextNow = async () => {
    if (!roomState) return;
    setBusyAction('post-next');
    setError(null);
    try {
      await advanceLiveAuntMinniePrompt(roomState.session.id);
      await refreshCurrentRoom(roomState.session.id, roomState.onlineParticipantIds);
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to post next question.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleEndSession = async () => {
    if (!roomState) return;
    setBusyAction('end');
    setError(null);
    try {
      await completeLiveAuntMinnieSession(roomState.session.id);
      await refreshCurrentRoom(roomState.session.id, roomState.onlineParticipantIds);
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to end room.');
    } finally {
      setBusyAction(null);
    }
  };

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

  const openNewPromptComposer = () => {
    setEditingPromptId(null);
    setComposerPrompt(createEmptyPrompt());
    setComposerDelaySeconds(null);
    setIsComposerOpen(true);
  };

  const openEditPromptComposer = (prompt: LiveAuntMinniePrompt) => {
    setEditingPromptId(prompt.id);
    setComposerPrompt(mapPromptToInput(prompt));
    setComposerDelaySeconds(null);
    setIsComposerOpen(true);
  };

  const handleSavePrompt = async () => {
    if (!roomState) return;
    setBusyAction(editingPromptId ? 'edit-prompt' : 'append-question');
    setError(null);
    try {
      let appendedPromptId: string | null = null;
      if (editingPromptId) {
        await updateLiveAuntMinniePrompt(roomState.session.id, editingPromptId, composerPrompt);
      } else {
        appendedPromptId = await appendLiveAuntMinnieQuestion(roomState.session.id, composerPrompt, {
          insertAfterCurrent: roomState.session.status === 'live',
        });
        if (roomState.session.status === 'live' && composerDelaySeconds === null) {
          await advanceLiveAuntMinniePrompt(roomState.session.id);
        } else if (roomState.session.status === 'live' && composerDelaySeconds !== null && appendedPromptId) {
          setPendingPromptReleaseAtById((previous) => ({
            ...previous,
            [appendedPromptId as string]: Date.now() + composerDelaySeconds * 1000,
          }));
        }
      }
      await refreshCurrentRoom(roomState.session.id, roomState.onlineParticipantIds);
      setIsComposerOpen(false);
      setEditingPromptId(null);
      setComposerPrompt(createEmptyPrompt());
      setComposerDelaySeconds(null);
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to save question.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSubmitResponse = async (promptId: string, explicitValue?: string) => {
    const currentRoomState = roomStateRef.current;
    if (!currentRoomState) return;
    const body = (explicitValue ?? latestDraftResponsesRef.current[promptId] ?? '').trim();
    const existingResponse = currentRoomState.myResponsesByPromptId[promptId];

    if (!body && !existingResponse) return;

    if (submittingPromptIdsRef.current[promptId]) {
      queuedResponseValuesRef.current[promptId] = body;
      return;
    }

    setSubmittingPromptIds((previous) => ({ ...previous, [promptId]: true }));
    submittingPromptIdsRef.current = { ...submittingPromptIdsRef.current, [promptId]: true };
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
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save answer.');
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

  const renderRoomList = (sessions: LiveAuntMinnieSession[], emptyLabel: string, canDelete = false) => (
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
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{session.title}</p>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-slate-300">
                    {mapSessionLabel(session)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Code {session.join_code}</p>
              </button>
              {canDelete && (
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
                placeholder="Room name"
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
          {workspace?.canHost && (
            <p className="text-xs text-slate-500">
              Add questions now. Each question can post immediately or after 15, 30, 45, or 60 sec.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Live</h2>
            <span className="text-xs text-slate-400">{workspace?.joinableSessions.length || 0}</span>
          </div>
          {renderRoomList(workspace?.joinableSessions || [], 'No live rooms')}
        </section>

        {workspace?.canHost && (
          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Your rooms</h2>
              <span className="text-xs text-slate-400">{workspace?.hostSessions.length || 0}</span>
            </div>
            {renderRoomList(workspace?.hostSessions || [], 'No rooms yet', true)}
          </section>
        )}
      </div>
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
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={closeRoom}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <span className="material-icons text-[18px] leading-none">chevron_left</span>
              Back
            </button>
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </div>

          {roomState.isHost ? (
            <LiveAuntMinnieHostPanel
              busyAction={busyAction}
              currentUserId={workspace?.currentUserId || null}
              draftResponsesByPromptId={draftResponsesByPromptId}
              hasQueuedPrompts={roomState.prompts.length > roomState.session.current_prompt_index + 1}
              onCompose={openNewPromptComposer}
              onDraftChange={(promptId, value) =>
                setDraftResponsesByPromptId((previous) => ({ ...previous, [promptId]: value }))
              }
              onEditPrompt={openEditPromptComposer}
              onEnd={handleEndSession}
              onPostNextNow={handlePostNextNow}
              onSubmitResponse={handleSubmitResponse}
              roomState={roomState}
              submittingPromptIds={submittingPromptIds}
            />
          ) : (
            <LiveAuntMinnieParticipantView
              currentUserId={workspace?.currentUserId || null}
              draftResponsesByPromptId={draftResponsesByPromptId}
              onDraftChange={(promptId, value) =>
                setDraftResponsesByPromptId((previous) => ({ ...previous, [promptId]: value }))
              }
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
                  delaySeconds={composerDelaySeconds}
                  heading={editingPromptId ? 'Edit question' : 'New question'}
                  onAddPromptImage={handleUploadPromptImage}
                  onClose={() => {
                    setIsComposerOpen(false);
                    setComposerDelaySeconds(null);
                  }}
                  onDelaySecondsChange={setComposerDelaySeconds}
                  onPromptChange={(updates) =>
                    setComposerPrompt((previous) => ({
                      ...previous,
                      ...updates,
                    }))
                  }
                  onSave={handleSavePrompt}
                  postActionLabel={
                    roomState.session.status === 'live' && composerDelaySeconds !== null
                      ? `Post in ${composerDelaySeconds} sec`
                      : 'Post now'
                  }
                  postModeSummary={
                    roomState.session.status === 'live' && composerDelaySeconds !== null
                      ? `This question posts in ${composerDelaySeconds} sec.`
                      : 'This question posts immediately.'
                  }
                  prompt={composerPrompt}
                  saving={busyAction === 'append-question' || busyAction === 'edit-prompt' || busyAction === 'upload-image'}
                />
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
