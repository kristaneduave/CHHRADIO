import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AssignOccupancyPayload,
    CurrentWorkstationStatus,
    Floor,
    LiveMapPerfSample,
    NewsfeedOnlineUser,
    WorkspaceAreaPresenceRow,
    WorkspacePlayer,
} from '../types';
import { workstationMapService } from '../services/workstationMapService';
import { supabase } from '../services/supabase';
import { fetchOnlineProfiles, subscribeToOnlineUsers } from '../services/newsfeedPresenceService';
import { workspacePresenceService } from '../services/virtualWorkspacePresence';
import {
    workspaceAreaPresenceService,
    ENABLE_PERSISTENT_AREA_PRESENCE,
    LIVE_MAP_HEARTBEAT_SECONDS,
    LIVE_MAP_STALE_TTL_SECONDS,
} from '../services/workspaceAreaPresenceService';
import { ReleaseAndMoveIntent } from './VirtualWorkspaceRenderer';
import WorkstationActionModal from './WorkstationActionModal';
import AssignOccupancyModal from './AssignOccupancyModal';
import OccupantProfileModal from './OccupantProfileModal';
import OnlineUsersModal from './OnlineUsersModal';
import LiveMapOnlinePanel from './LiveMapOnlinePanel';
import LiveMapHeader from './LiveMapHeader';
import LiveMapFilters from './LiveMapFilters';
import LiveMapCanvasPanel from './LiveMapCanvasPanel';
import LiveMapPerfPanel from './LiveMapPerfPanel';
import { toastError, toastSuccess } from '../utils/toast';
import {
    PresenceSelectorCache,
    isPresenceRowStale,
    mergeWorkspacePresenceStable,
} from '../utils/liveMapPresence';

const STATUS_PRESETS = [
    'Deep Work',
    'Coffee Break',
    'Lunch',
    'Available',
    'BRB 5 mins',
];
type WorkstationViewFilter = 'all' | 'available' | 'in_use' | 'mine';

const LIVE_MAP_PERF_LOG =
    String(import.meta.env?.VITE_LIVE_MAP_PERF_LOG ?? 'false').toLowerCase() === 'true';

const LiveMapScreen: React.FC = () => {
    const [floors, setFloors] = useState<Floor[]>([]);
    const [activeFloor, setActiveFloor] = useState<Floor | null>(null);
    const [workstations, setWorkstations] = useState<CurrentWorkstationStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [selectedWorkstation, setSelectedWorkstation] = useState<CurrentWorkstationStatus | null>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);

    const [onlineUsers, setOnlineUsers] = useState<NewsfeedOnlineUser[]>([]);
    const [workspacePlayers, setWorkspacePlayers] = useState<WorkspacePlayer[]>([]);
    const [areaPresenceRows, setAreaPresenceRows] = useState<WorkspaceAreaPresenceRow[]>([]);
    const [loadingOnline, setLoadingOnline] = useState(false);
    const [onlineError, setOnlineError] = useState<string | null>(null);
    const [currentStatusMessage, setCurrentStatusMessage] = useState<string | null>(null);
    const [isLeavingArea, setIsLeavingArea] = useState(false);

    // Viewer UI State
    const [statusInput, setStatusInput] = useState('');
    const [showMobileStatusSheet, setShowMobileStatusSheet] = useState(false);
    const [pendingReleaseIntent, setPendingReleaseIntent] = useState<ReleaseAndMoveIntent | null>(null);
    const [expandedFloorId, setExpandedFloorId] = useState<string | null>(null);
    const [showCoachTip, setShowCoachTip] = useState(false);
    const [workstationQuery, setWorkstationQuery] = useState('');
    const [workstationFilter, setWorkstationFilter] = useState<WorkstationViewFilter>('all');
    const [kickingUserId, setKickingUserId] = useState<string | null>(null);
    const [isDocumentVisible, setIsDocumentVisible] = useState(
        typeof document === 'undefined' ? true : !document.hidden,
    );
    const [perfSamples, setPerfSamples] = useState<LiveMapPerfSample[]>([]);
    const autoPrunedIdsRef = useRef<Set<string>>(new Set());
    const presenceSelectorCacheRef = useRef<PresenceSelectorCache | null>(null);
    const mergePerfMsRef = useRef(0);
    const DEBUG_WORKSPACE = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
    const COACH_KEY = 'chh_workspace_coach_tip_seen_v1';

    const refreshAreaPresence = useCallback(async () => {
        if (!currentUserId || !ENABLE_PERSISTENT_AREA_PRESENCE) return;
        try {
            const rows = await workspaceAreaPresenceService.fetchActiveAreaPresence();
            setAreaPresenceRows(rows);
        } catch (refreshError) {
            console.error('Failed to refresh area presence:', refreshError);
        }
    }, [currentUserId]);

    useEffect(() => {
        setCurrentStatusMessage(workspacePresenceService.getCurrentStatusMessage());
    }, []);

    useEffect(() => {
        if (currentStatusMessage) setStatusInput(currentStatusMessage);
    }, [currentStatusMessage]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const seen = window.localStorage.getItem(COACH_KEY) === '1';
        setShowCoachTip(!seen);
    }, []);

    useEffect(() => {
        if (!pendingReleaseIntent) return;
        const timer = window.setTimeout(() => {
            setPendingReleaseIntent(null);
        }, 5000);
        return () => window.clearTimeout(timer);
    }, [pendingReleaseIntent]);

    useEffect(() => {
        if (!currentUserId) return;
        const unsubscribe = workspacePresenceService.subscribe({
            currentUserId,
            onPlayersChange: setWorkspacePlayers,
            onError: console.error,
        });
        return unsubscribe;
    }, [currentUserId]);

    useEffect(() => {
        if (!currentUserId || !ENABLE_PERSISTENT_AREA_PRESENCE) return;
        let mounted = true;

        const refresh = async () => {
            try {
                const rows = await workspaceAreaPresenceService.fetchActiveAreaPresence();
                if (mounted) setAreaPresenceRows(rows);
            } catch (loadError) {
                if (mounted) console.error('Failed to load persistent area presence:', loadError);
            }
        };

        void refresh();
        const unsubscribe = workspaceAreaPresenceService.subscribeAreaPresenceChanges(() => {
            void refresh();
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [currentUserId]);

    const loadWorkstations = useCallback(async (floorId: string) => {
        try {
            setLoading(true);
            const startedAt = LIVE_MAP_PERF_LOG ? performance.now() : 0;
            const data = await workstationMapService.getWorkstationsByFloor(floorId);
            const hydrated = await workstationMapService.hydrateWorkstationOccupants(data);
            setWorkstations(hydrated);
            setSelectedWorkstation((previous) => {
                if (!previous) return null;
                return hydrated.find((item) => item.id === previous.id) || null;
            });
            if (LIVE_MAP_PERF_LOG) {
                setPerfSamples((previous) => [
                    ...previous.slice(-59),
                    {
                        label: 'LiveMapScreen:loadWorkstations',
                        durationMs: Math.round(performance.now() - startedAt),
                        at: new Date().toISOString(),
                        meta: { floorId, rows: hydrated.length },
                    },
                ]);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            try {
                setLoading(true);
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (user && mounted) setCurrentUserId(user.id);

                const fetchedFloors = await workstationMapService.getFloors();
                if (!mounted) return;
                setFloors(fetchedFloors);

                if (fetchedFloors.length > 0) {
                    setActiveFloor(fetchedFloors[0]);
                    await loadWorkstations(fetchedFloors[0].id);
                } else {
                    setLoading(false);
                }
            } catch (err: any) {
                if (mounted) {
                    setError(err.message || 'Failed to load workspace data.');
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!currentUserId) return;
        let mounted = true;
        let hydrateToken = 0;
        setLoadingOnline(true);
        setOnlineError(null);

        const unsubscribe = subscribeToOnlineUsers({
            currentUserId,
            trackCurrentUser: true,
            includeCurrentUser: true,
            onUsersChange: (ids) => {
                if (!mounted) return;
                const deduped = Array.from(new Set(ids));
                if (!deduped.length) {
                    setOnlineUsers([]);
                    setLoadingOnline(false);
                    return;
                }
                const currentToken = ++hydrateToken;
                fetchOnlineProfiles(deduped)
                    .then((users) => {
                        if (!mounted || currentToken !== hydrateToken) return;
                        setOnlineUsers([...users].sort((a, b) => a.displayName.localeCompare(b.displayName)));
                        setLoadingOnline(false);
                        setOnlineError(null);
                    })
                    .catch((err) => {
                        console.error(err);
                        if (!mounted || currentToken !== hydrateToken) return;
                        setLoadingOnline(false);
                        setOnlineError('Online status unavailable');
                    });
            },
            onError: (message) => {
                if (!mounted) return;
                setLoadingOnline(false);
                setOnlineError(message);
            },
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [currentUserId]);

    useEffect(() => {
        if (!activeFloor?.id) return;

        let inFlight = false;
        let needsTrailing = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const floorId = activeFloor.id;

        const runRefresh = () => {
            if (inFlight) {
                needsTrailing = true;
                return;
            }
            inFlight = true;
            if (LIVE_MAP_PERF_LOG) {
                console.debug('[live-map-perf] refresh:run', floorId);
            }
            loadWorkstations(floorId)
                .catch((refreshError) => {
                    console.error('Failed to refresh workstations from realtime update:', refreshError);
                })
                .finally(() => {
                    inFlight = false;
                    if (needsTrailing) {
                        needsTrailing = false;
                        timer = setTimeout(runRefresh, 120);
                    }
                });
        };

        const queueRefresh = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(runRefresh, 180);
        };

        const channel = supabase
            .channel(`live-map-occupancy-${activeFloor.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'occupancy_sessions' },
                queueRefresh,
            )
            .subscribe();

        return () => {
            if (timer) clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [activeFloor?.id, loadWorkstations]);

    const handlePinClick = (ws: CurrentWorkstationStatus) => {
        setSelectedWorkstation(ws);
        const occupiedByOther =
            ws.status === 'IN_USE' &&
            ((ws.occupant_id && ws.occupant_id !== currentUserId) || !ws.occupant_id);

        if (occupiedByOther) {
            setIsProfileModalOpen(true);
            setIsActionModalOpen(false);
            return;
        }
        setIsActionModalOpen(true);
        setIsProfileModalOpen(false);
    };

    const handleClaim = async (workstationId: string) => {
        await workstationMapService.claimWorkstation(workstationId);
        if (activeFloor) await loadWorkstations(activeFloor.id);
    };

    const handleAssign = async (payload: AssignOccupancyPayload) => {
        if (!selectedWorkstation) return;
        await workstationMapService.assignWorkstation(selectedWorkstation.id, payload);
        if (activeFloor) await loadWorkstations(activeFloor.id);
        setIsAssignModalOpen(false);
        setIsActionModalOpen(false);
    };

    const handleUpdateStatus = async (workstationId: string, message: string | null) => {
        await workstationMapService.updateStatusMessage(workstationId, message);
        if (activeFloor) await loadWorkstations(activeFloor.id);
    };

    const handleRelease = async (workstationId: string) => {
        await workstationMapService.releaseWorkstation(workstationId);
        if (activeFloor) await loadWorkstations(activeFloor.id);
        setIsProfileModalOpen(false);
        setIsActionModalOpen(false);
    };

    const handleSetAvatarStatus = async (message: string | null) => {
        await workspacePresenceService.setStatusMessage(message);
        if (ENABLE_PERSISTENT_AREA_PRESENCE) {
            await workspaceAreaPresenceService.setMyAreaPresenceStatus(message);
        }
        setCurrentStatusMessage(workspacePresenceService.getCurrentStatusMessage());

        const occupiedMine = workstations.find(
            (ws) => ws.status === 'IN_USE' && ws.occupant_id === currentUserId,
        );

        if (occupiedMine?.id) {
            workstationMapService
                .updateStatusMessage(occupiedMine.id, message)
                .catch((error) => console.warn('Status updated in workspace, session sync failed:', error));
        }
    };

    const handleSetAreaPresence = async (floorId: string, x: number, y: number) => {
        if (!ENABLE_PERSISTENT_AREA_PRESENCE) return;
        try {
            await workspaceAreaPresenceService.upsertMyAreaPresence({
                floorId,
                x,
                y,
                statusMessage: workspacePresenceService.getCurrentStatusMessage(),
            });
        } catch (error: any) {
            console.error('Failed to persist area presence:', error);
        }
    };

    const handleLeaveArea = async () => {
        if (!ENABLE_PERSISTENT_AREA_PRESENCE || !currentUserId) return;
        setIsLeavingArea(true);
        try {
            await workspaceAreaPresenceService.clearMyAreaPresence();
            await workspacePresenceService.updateLocalPlayer({
                floorId: null,
                isWalking: false,
                statusMessage: null,
            });
            setAreaPresenceRows((prev) => prev.filter((row) => row.userId !== currentUserId));
            toastSuccess('Presence removed', 'You are no longer pinned to a map area.');
        } catch (error: any) {
            console.error('Failed to leave area:', error);
            toastError('Failed to leave area', error?.message || 'Please try again.');
        } finally {
            setIsLeavingArea(false);
        }
    };

    const mergedPlayers = useMemo<WorkspacePlayer[]>(() => {
        const startedAt = LIVE_MAP_PERF_LOG ? performance.now() : 0;
        const nextCache = mergeWorkspacePresenceStable(
            areaPresenceRows,
            workspacePlayers,
            LIVE_MAP_STALE_TTL_SECONDS,
            presenceSelectorCacheRef.current,
        );
        presenceSelectorCacheRef.current = nextCache;
        if (LIVE_MAP_PERF_LOG) {
            const mergeMs = Math.round(performance.now() - startedAt);
            mergePerfMsRef.current = mergeMs;
            console.debug(
                '[live-map-perf] merge-ms',
                mergeMs,
                'players',
                nextCache.result.length,
            );
        }
        return nextCache.result;
    }, [areaPresenceRows, workspacePlayers]);

    useEffect(() => {
        if (!LIVE_MAP_PERF_LOG) return;
        setPerfSamples((previous) => [
            ...previous.slice(-59),
            {
                label: 'LiveMapScreen:mergePresence',
                durationMs: mergePerfMsRef.current,
                at: new Date().toISOString(),
                meta: { players: mergedPlayers.length },
            },
        ]);
    }, [mergedPlayers]);


    const myOccupiedWorkstation = workstations.find((ws) => ws.status === 'IN_USE' && ws.occupant_id === currentUserId) || null;

    const hydratedPlayers = useMemo(() => {
        const onlineById = new Map<string, NewsfeedOnlineUser>(
            onlineUsers.map((user): [string, NewsfeedOnlineUser] => [user.id, user]),
        );
        return mergedPlayers.map((player) => {
            const online = onlineById.get(player.id);
            return {
                ...player,
                displayName:
                    player.displayName && player.displayName !== 'User'
                        ? player.displayName
                        : online?.displayName || player.displayName || 'User',
                avatarUrl: player.avatarUrl || online?.avatarUrl || null,
                role: player.role || online?.role,
            };
        });
    }, [mergedPlayers, onlineUsers]);

    const myLivePlayer = useMemo(
        () => hydratedPlayers.find((player) => player.id === currentUserId) || null,
        [hydratedPlayers, currentUserId],
    );

    const stalePlayers = useMemo(() => {
        return hydratedPlayers.filter((player) => player.id !== currentUserId && player.isStale);
    }, [currentUserId, hydratedPlayers]);

    const myLiveFloorName = useMemo(
        () => floors.find((floor) => floor.id === myLivePlayer?.floorId)?.name || null,
        [floors, myLivePlayer?.floorId],
    );

    const groupedUsers = useMemo(() => {
        type UserWithLoc = NewsfeedOnlineUser & { floorId?: string | null, statusMessage?: string | null };
        const groups: Record<string, UserWithLoc[]> = {};
        const UNKNOWN_LOC = 'Elsewhere';
        const playerById = new Map<string, WorkspacePlayer>(
            hydratedPlayers.map((player): [string, WorkspacePlayer] => [player.id, player]),
        );

        onlineUsers.forEach(u => {
            const p = playerById.get(u.id);
            const userWithLoc = { ...u, floorId: p?.floorId, statusMessage: p?.statusMessage };
            const floor = floors.find(f => f.id === p?.floorId);
            const groupName = floor ? floor.name : UNKNOWN_LOC;

            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(userWithLoc);
        });

        const orderedGroups: { name: string, users: UserWithLoc[] }[] = [];
        floors.forEach(f => {
            if (groups[f.name]) {
                orderedGroups.push({ name: f.name, users: groups[f.name] });
            }
        });
        if (groups[UNKNOWN_LOC]) {
            orderedGroups.push({ name: UNKNOWN_LOC, users: groups[UNKNOWN_LOC] });
        }

        return orderedGroups;
    }, [onlineUsers, hydratedPlayers, floors]);

    const floorUsersById = useMemo(() => {
        const map = new Map<string, WorkspacePlayer[]>();
        hydratedPlayers.forEach((player) => {
            if (player.id === currentUserId) return;
            if (!player.floorId) return;
            const existing = map.get(player.floorId) || [];
            existing.push(player);
            map.set(player.floorId, existing);
        });
        return map;
    }, [hydratedPlayers, currentUserId]);

    const filteredWorkstations = useMemo(() => {
        const q = workstationQuery.trim().toLowerCase();
        return workstations.filter((ws) => {
            const matchesFilter =
                workstationFilter === 'all'
                    ? true
                    : workstationFilter === 'available'
                        ? ws.status === 'AVAILABLE'
                        : workstationFilter === 'in_use'
                            ? ws.status === 'IN_USE'
                            : ws.status === 'IN_USE' && ws.occupant_id === currentUserId;

            if (!matchesFilter) return false;
            if (!q) return true;

            const haystack = `${ws.label} ${ws.occupant_name || ''} ${ws.status}`.toLowerCase();
            return haystack.includes(q);
        });
    }, [currentUserId, workstationFilter, workstationQuery, workstations]);

    const visibleWorkstationCountByFloorId = useMemo(() => {
        const map = new Map<string, number>();
        filteredWorkstations.forEach((ws) => {
            map.set(ws.floor_id, (map.get(ws.floor_id) || 0) + 1);
        });
        return map;
    }, [filteredWorkstations]);

    const totalWorkstationCountByFloorId = useMemo(() => {
        const map = new Map<string, number>();
        workstations.forEach((ws) => {
            map.set(ws.floor_id, (map.get(ws.floor_id) || 0) + 1);
        });
        return map;
    }, [workstations]);

    const saveStatus = async (message: string | null, closeMobile = false) => {
        try {
            await handleSetAvatarStatus(message);
            if (closeMobile) setShowMobileStatusSheet(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCheckCurrentUserOccupancy = useCallback(
        (workstationId: string) =>
            workstationMapService.isCurrentUserOccupyingWorkstation(workstationId, { maxAgeMs: 2500 }),
        [],
    );

    const handleToggleExpandedFloor = useCallback((floorId: string) => {
        setExpandedFloorId((previous) => (previous === floorId ? null : floorId));
    }, []);

    const handlePerfSample = useCallback((sample: LiveMapPerfSample) => {
        if (!LIVE_MAP_PERF_LOG) return;
        setPerfSamples((previous) => [...previous.slice(-59), sample]);
    }, []);

    const handleKickUser = useCallback(async (targetUserId: string, targetDisplayName: string) => {
        if (!targetUserId || targetUserId === currentUserId) return;
        const appearsRealtime = workspacePlayers.some((player) => player.id === targetUserId);
        const warning = appearsRealtime ? '\n\nThis user appears active right now, so they may reappear.' : '';
        if (!window.confirm(`Kick ${targetDisplayName} from Live Map and release active workstation occupancy?${warning}`)) {
            return;
        }

        try {
            setKickingUserId(targetUserId);
            const result = await workspaceAreaPresenceService.forceRemoveUserFromLiveMap(
                targetUserId,
                appearsRealtime ? 'manual_kick_active_user' : 'manual_kick_stale_user',
            );
            toastSuccess(
                'User removed from Live Map',
                `Cleared ${result.cleared_presence_count} presence rows and released ${result.released_workstation_count} workstation sessions.`,
            );
            await refreshAreaPresence();
            if (activeFloor?.id) {
                await loadWorkstations(activeFloor.id);
            }
        } catch (kickError: any) {
            toastError('Kick failed', kickError?.message || 'Unable to remove user from Live Map.');
        } finally {
            setKickingUserId(null);
        }
    }, [activeFloor?.id, currentUserId, loadWorkstations, refreshAreaPresence, workspacePlayers]);

    const handleSummonUser = useCallback(
        async (user: NewsfeedOnlineUser & { floorId?: string | null, statusMessage?: string | null }) => {
            const floorName = floors.find((f) => f.id === myLivePlayer?.floorId)?.name || 'the Map';
            const senderName = myLivePlayer?.displayName || 'A colleague';
            try {
                const { sendSummonNotification } = await import('../services/newsfeedService');
                await sendSummonNotification(currentUserId, senderName, user.id, floorName);
                toastSuccess(`Summoned ${user.displayName}`);
            } catch (err: any) {
                console.error(err);
                toastError('Failed to send summon request');
            }
        },
        [currentUserId, floors, myLivePlayer?.displayName, myLivePlayer?.floorId],
    );

    const handleKickUserFromRow = useCallback(
        (user: WorkspacePlayer) => {
            void handleKickUser(user.id, user.displayName);
        },
        [handleKickUser],
    );

    useEffect(() => {
        const onVisibilityChange = () => setIsDocumentVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    useEffect(() => {
        if (!ENABLE_PERSISTENT_AREA_PRESENCE || !myLivePlayer?.floorId) return;
        const heartbeatSeconds = isDocumentVisible
            ? Math.max(15, LIVE_MAP_HEARTBEAT_SECONDS)
            : Math.max(60, LIVE_MAP_HEARTBEAT_SECONDS * 2);
        const intervalMs = heartbeatSeconds * 1000;
        const intervalId = window.setInterval(() => {
            workspaceAreaPresenceService
                .upsertMyAreaPresence({
                    floorId: myLivePlayer.floorId as string,
                    x: myLivePlayer.x,
                    y: myLivePlayer.y,
                    statusMessage: myLivePlayer.statusMessage || null,
                })
                .catch((heartbeatError) => console.error('Area presence heartbeat failed:', heartbeatError));
        }, intervalMs);
        return () => window.clearInterval(intervalId);
    }, [isDocumentVisible, myLivePlayer?.floorId, myLivePlayer?.x, myLivePlayer?.y, myLivePlayer?.statusMessage]);

    useEffect(() => {
        if (!ENABLE_PERSISTENT_AREA_PRESENCE || !stalePlayers.length) return;

        const realtimeIds = new Set<string>(workspacePlayers.map((player) => player.id));
        const candidates = areaPresenceRows
            .filter((row) => row.userId !== currentUserId)
            .filter((row) => isPresenceRowStale(row, realtimeIds, LIVE_MAP_STALE_TTL_SECONDS * 2))
            .slice(0, 3);
        if (!candidates.length) return;

        const timer = window.setTimeout(() => {
            void Promise.all(
                candidates.map(async (row) => {
                    if (autoPrunedIdsRef.current.has(row.userId)) return false;
                    autoPrunedIdsRef.current.add(row.userId);
                    try {
                        await workspaceAreaPresenceService.forceRemoveUserFromLiveMap(
                            row.userId,
                            'auto_prune_stale_presence',
                        );
                        return true;
                    } catch (autoPruneError) {
                        autoPrunedIdsRef.current.delete(row.userId);
                        console.warn('Auto-prune failed:', autoPruneError);
                        return false;
                    }
                }),
            ).then((results) => {
                if (results.some(Boolean)) {
                    void refreshAreaPresence();
                }
            });
        }, 800);

        return () => window.clearTimeout(timer);
    }, [areaPresenceRows, currentUserId, refreshAreaPresence, stalePlayers.length, workspacePlayers]);

    const handleConfirmReleaseAndMove = async () => {
        if (!pendingReleaseIntent) return;

        try {
            const releaseStart = performance.now();
            await handleRelease(pendingReleaseIntent.workstationId);
            await workspacePresenceService.setExactLocation(
                pendingReleaseIntent.targetX,
                pendingReleaseIntent.targetY,
                pendingReleaseIntent.targetFloorId,
            );
            await handleSetAreaPresence(
                pendingReleaseIntent.targetFloorId,
                pendingReleaseIntent.targetX,
                pendingReleaseIntent.targetY,
            );
            if (DEBUG_WORKSPACE) {
                console.debug('[workspace] release+move ms', Math.round(performance.now() - releaseStart));
            }
        } catch (error) {
            console.error('Failed to release and move:', error);
        } finally {
            setPendingReleaseIntent(null);
        }
    };

    return (
        <div className="flex-1 w-full bg-[#0a1018] relative animate-in fade-in duration-200">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.10),transparent_45%),radial-gradient(circle_at_0%_100%,rgba(16,185,129,0.10),transparent_40%)]" />

            <div className="relative z-10 h-full w-full flex flex-col xl:flex-row pb-12">
                <div className="flex-1 flex flex-col overflow-hidden xl:border-r border-white/5">
                    <LiveMapHeader
                        myLiveFloorName={myLiveFloorName}
                        hasAreaPresence={Boolean(myLivePlayer?.floorId)}
                        isLeavingArea={isLeavingArea}
                        statusInput={statusInput}
                        statusPresets={STATUS_PRESETS}
                        onLeaveArea={() => void handleLeaveArea()}
                        onOpenMobileStatus={() => setShowMobileStatusSheet(true)}
                        onChangeStatusInput={setStatusInput}
                        onApplyPreset={(preset) => {
                            setStatusInput(preset);
                            void saveStatus(preset);
                        }}
                        onSaveStatus={() => void saveStatus(statusInput)}
                        onClearStatus={() => {
                            setStatusInput('');
                            void saveStatus(null);
                        }}
                        onPerfSample={handlePerfSample}
                    />

                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-transparent scrollbar-hide">
                        <LiveMapFilters
                            showCoachTip={showCoachTip}
                            coachKey={COACH_KEY}
                            workstationQuery={workstationQuery}
                            workstationFilter={workstationFilter}
                            filteredCount={filteredWorkstations.length}
                            totalCount={workstations.length}
                            onDismissCoachTip={() => setShowCoachTip(false)}
                            onSetWorkstationQuery={setWorkstationQuery}
                            onSetWorkstationFilter={setWorkstationFilter}
                            onPerfSample={handlePerfSample}
                        />
                        <LiveMapCanvasPanel
                            error={error}
                            loading={loading}
                            floors={floors}
                            expandedFloorId={expandedFloorId}
                            filteredWorkstations={filteredWorkstations}
                            visibleWorkstationCountByFloorId={visibleWorkstationCountByFloorId}
                            totalWorkstationCountByFloorId={totalWorkstationCountByFloorId}
                            floorUsersById={floorUsersById}
                            myLivePlayer={myLivePlayer}
                            hydratedPlayers={hydratedPlayers}
                            currentUserId={currentUserId}
                            myOccupiedWorkstation={myOccupiedWorkstation}
                            onPinClick={handlePinClick}
                            onSetAreaPresence={handleSetAreaPresence}
                            onCheckCurrentUserOccupancy={handleCheckCurrentUserOccupancy}
                            onRequestReleaseAndMove={setPendingReleaseIntent}
                            onToggleExpandedFloor={handleToggleExpandedFloor}
                            onPerfSample={handlePerfSample}
                        />
                    </div>
                </div>

                <LiveMapOnlinePanel
                    loading={loading}
                    onlineUsersCount={onlineUsers.length}
                    groupedUsers={groupedUsers}
                    stalePlayers={stalePlayers}
                    currentUserId={currentUserId}
                    kickingUserId={kickingUserId}
                    onSummon={handleSummonUser}
                    onFocusFloor={setExpandedFloorId}
                    onKick={handleKickUserFromRow}
                    onPerfSample={handlePerfSample}
                />
            </div>

            {LIVE_MAP_PERF_LOG ? <LiveMapPerfPanel samples={perfSamples} /> : null}

            {showMobileStatusSheet && (
                <div className="xl:hidden fixed inset-0 z-[120] flex items-end">
                    <div className="absolute inset-0 bg-black/70" onClick={() => setShowMobileStatusSheet(false)} />
                    <div className="relative w-full rounded-t-3xl border border-white/10 bg-[#0f1621] p-4 space-y-3 pb-24">
                        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white">Set Avatar Status</h3>
                            <button onClick={() => setShowMobileStatusSheet(false)} className="text-slate-400 text-xs font-semibold">Close</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {STATUS_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => {
                                        setStatusInput(preset);
                                        void saveStatus(preset, true);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={statusInput}
                                onChange={(e) => setStatusInput(e.target.value.slice(0, 20))}
                                placeholder="Set status (max 20)"
                                className="flex-1 bg-black/35 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/60"
                            />
                            <button
                                onClick={() => void saveStatus(statusInput, true)}
                                className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-sm font-bold"
                            >
                                Set
                            </button>
                            <button
                                onClick={() => {
                                    setStatusInput('');
                                    void saveStatus(null, true);
                                }}
                                className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-semibold"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingReleaseIntent && (
                <div className="fixed inset-x-0 bottom-[80px] z-[130] px-4 pointer-events-none">
                    <div className="mx-auto max-w-md pointer-events-auto rounded-2xl border border-white/10 bg-black/80 backdrop-blur-md px-4 py-3 flex items-center gap-3 shadow-[0_0_40px_-5px_rgba(0,0,0,0.8)]">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                                Release {pendingReleaseIntent.workstationLabel} and move here?
                            </p>
                            <p className="text-[10px] text-slate-400">Auto-dismisses in 5s</p>
                        </div>
                        <button
                            onClick={() => void handleConfirmReleaseAndMove()}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-xs font-bold"
                        >
                            Release & Move
                        </button>
                        <button
                            onClick={() => setPendingReleaseIntent(null)}
                            className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <WorkstationActionModal
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                workstation={selectedWorkstation}
                currentUserId={currentUserId}
                onOpenAssign={() => {
                    setIsActionModalOpen(false);
                    setIsAssignModalOpen(true);
                }}
                onClaim={handleClaim}
                onUpdateStatus={handleUpdateStatus}
                onRelease={handleRelease}
            />

            <AssignOccupancyModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                onAssign={handleAssign}
                onSearchUsers={workstationMapService.searchAssignableOccupants}
            />

            <OccupantProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                workstation={selectedWorkstation}
                onRelease={handleRelease}
            />

            <OnlineUsersModal
                isOpen={isOnlineModalOpen}
                onClose={() => setIsOnlineModalOpen(false)}
                users={onlineUsers}
                loading={loadingOnline}
                error={onlineError}
            />
        </div>
    );
};

export default LiveMapScreen;
