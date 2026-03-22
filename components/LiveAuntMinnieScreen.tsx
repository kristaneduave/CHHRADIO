import React, { useEffect, useState } from 'react';
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
  completeLiveAuntMinnieSession,
  createLiveAuntMinnieSession,
  deleteLiveAuntMinnieResponse,
  getLiveAuntMinnieRoomState,
  getLiveAuntMinnieWorkspace,
  joinLiveAuntMinnieSession,
  setLiveAuntMinnieAnswersVisible,
  startLiveAuntMinnieSession,
  submitLiveAuntMinnieResponse,
  subscribeToLiveAuntMinnieRoom,
  updateLiveAuntMinniePrompt,
  uploadLiveAuntMinnieImage,
} from '../services/liveAuntMinnieService';

interface LiveAuntMinnieScreenProps {
  onBack?: () => void;
}

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
    : session.status === 'draft'
      ? 'border-cyan-500/20 bg-cyan-500/10'
      : 'border-white/10 bg-white/[0.03]';

const mapSessionLabel = (session: LiveAuntMinnieSession) =>
  session.status === 'live'
    ? 'Live'
    : session.status === 'draft'
      ? 'Draft'
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
  const [joinCode, setJoinCode] = useState('');
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
  const [draftResponsesByPromptId, setDraftResponsesByPromptId] = useState<Record<string, string>>({});
  const [submittingPromptIds, setSubmittingPromptIds] = useState<Record<string, boolean>>({});
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [composerPrompt, setComposerPrompt] = useState<LiveAuntMinniePromptInput>(createEmptyPrompt());

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
      },
      onError: (message) => {
        if (!isMounted) return;
        setError(message);
      },
    }).then((unsubscribe) => {
      cleanup = unsubscribe;
    }).catch((err: any) => {
      if (!isMounted) return;
      setError(err.message || 'Unable to connect to the room.');
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
        const nextState = await getLiveAuntMinnieRoomState(
          currentSessionId,
          roomState?.onlineParticipantIds || [],
        );
        if (!cancelled) {
          setRoomState(nextState);
        }
      } catch {
        // Keep existing realtime state if polling fails.
      } finally {
        refreshInFlight = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshRoom();
    }, 2500);

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
  };

  const closeRoom = () => {
    setCurrentSessionId(null);
    setRoomState(null);
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

  const handleJoinByCode = async () => {
    setBusyAction('join');
    setError(null);
    try {
      const session = await joinLiveAuntMinnieSession({ joinCode });
      await refreshWorkspace();
      await openSession(session.id);
    } catch (err: any) {
      setError(err.message || 'Failed to join room.');
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

  const handleStartSession = async () => {
    if (!roomState) return;
    setBusyAction('start');
    setError(null);
    try {
      await startLiveAuntMinnieSession(roomState.session.id);
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to go live.');
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
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to end room.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleAnswers = async () => {
    if (!roomState) return;
    setBusyAction('toggle-answers');
    setError(null);
    try {
      await setLiveAuntMinnieAnswersVisible(
        roomState.session.id,
        roomState.session.current_phase !== 'reveal',
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update answer visibility.');
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

  const handleSavePrompt = async () => {
    if (!roomState) return;
    setBusyAction(editingPromptId ? 'edit-prompt' : 'append-question');
    setError(null);
    try {
      if (editingPromptId) {
        await updateLiveAuntMinniePrompt(roomState.session.id, editingPromptId, composerPrompt);
      } else {
        await appendLiveAuntMinnieQuestion(roomState.session.id, composerPrompt);
      }
      setIsComposerOpen(false);
      setEditingPromptId(null);
      setComposerPrompt(createEmptyPrompt());
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to save question.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSubmitResponse = async (promptId: string) => {
    if (!roomState) return;
    const body = (draftResponsesByPromptId[promptId] || '').trim();
    const existingResponse = roomState.myResponsesByPromptId[promptId];

    if (!body && !existingResponse) return;

    setSubmittingPromptIds((previous) => ({ ...previous, [promptId]: true }));
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
          sessionId: roomState.session.id,
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
              session_id: roomState.session.id,
              prompt_id: promptId,
              user_id: workspace?.currentUserId || '',
              response_text: body,
              judgment: 'unreviewed',
              consultant_note: null,
              submitted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              reviewed_at: null,
              reviewed_by: null,
              participant: roomState.participants.find(
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
          sessionId: roomState.session.id,
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
          <button
            key={session.id}
            type="button"
            onClick={() => void openSession(session.id)}
            className={`w-full rounded-[22px] border p-4 text-left transition hover:opacity-90 ${mapSessionTone(session)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-white">{session.title}</p>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-slate-300">
                {mapSessionLabel(session)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Code {session.join_code}</p>
          </button>
        ))
      )}
    </div>
  );

  const renderHub = () => (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Aunt Minnie</p>
          <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Live rooms</h1>
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
        <div className="flex flex-col gap-3 sm:flex-row">
          {workspace?.canHost && (
            <button
              type="button"
              onClick={() => void handleOpenTrainingOfficerRoom()}
              disabled={busyAction === 'create-room'}
              className="rounded-[20px] border border-cyan-400/20 bg-cyan-500/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {busyAction === 'create-room' ? 'Starting...' : 'Start room'}
            </button>
          )}
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="Join code"
            className="min-w-0 flex-1 rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
          />
          <button
            type="button"
            onClick={() => void handleJoinByCode()}
            disabled={!joinCode.trim() || busyAction === 'join'}
            className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {busyAction === 'join' ? 'Joining...' : 'Join'}
          </button>
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
              <h2 className="text-lg font-semibold text-white">Drafts</h2>
              <span className="text-xs text-slate-400">{workspace?.hostSessions.length || 0}</span>
            </div>
            {renderRoomList(workspace?.hostSessions || [], 'No drafts')}
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
    <div className="px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
      {currentSessionId && roomState ? (
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={closeRoom}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Back
            </button>
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </div>

          {roomState.isHost ? (
            <LiveAuntMinnieHostPanel
              busyAction={busyAction}
              currentUserId={workspace?.currentUserId || null}
              draftResponsesByPromptId={draftResponsesByPromptId}
              onCompose={openNewPromptComposer}
              onDraftChange={(promptId, value) =>
                setDraftResponsesByPromptId((previous) => ({ ...previous, [promptId]: value }))
              }
              onEditPrompt={openEditPromptComposer}
              onEnd={handleEndSession}
              onStart={handleStartSession}
              onToggleAnswers={handleToggleAnswers}
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
                  heading={editingPromptId ? 'Edit question' : 'New question'}
                  onAddPromptImage={handleUploadPromptImage}
                  onClose={() => setIsComposerOpen(false)}
                  onPromptChange={(updates) =>
                    setComposerPrompt((previous) => ({
                      ...previous,
                      ...updates,
                    }))
                  }
                  onSave={handleSavePrompt}
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
