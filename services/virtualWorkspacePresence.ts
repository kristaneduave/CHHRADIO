import { supabase } from './supabase';
import { WorkspacePlayer, UserRole } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

const PRESENCE_ROOM = 'workspace_map';
const WORKSPACE_STATUS_STORAGE_KEY = 'chh_workspace_status_message';
const WORKSPACE_LOCATION_STORAGE_KEY = 'chh_workspace_last_location';
const PRESENCE_UI_EMIT_THROTTLE_MS = 100;
const DEBUG_WORKSPACE = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

export interface WorkspacePresenceState {
    player: WorkspacePlayer;
}

interface WorkspaceSubscribeOptions {
    currentUserId: string;
    onPlayersChange: (players: WorkspacePlayer[]) => void;
    onError?: (err: string) => void;
}

let activeChannel: RealtimeChannel | null = null;
let currentLocalPlayer: WorkspacePlayer | null = null;
let movementInterval: NodeJS.Timeout | null = null;
let pendingSpawn: Partial<WorkspacePlayer> | null = null;
let activeUserId: string | null = null;
let lastPlayers: WorkspacePlayer[] = [];
const playerListeners = new Set<(players: WorkspacePlayer[]) => void>();
const errorListeners = new Set<(err: string) => void>();
let syncEventsInCurrentMinute = 0;
let syncWindowStartedAt = Date.now();

const normalizePlayers = (players: WorkspacePlayer[]): WorkspacePlayer[] =>
    [...players].sort((a, b) => a.id.localeCompare(b.id));

const arePlayersEquivalent = (a: WorkspacePlayer[], b: WorkspacePlayer[]): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        const left = a[i];
        const right = b[i];
        if (
            left.id !== right.id ||
            left.floorId !== right.floorId ||
            left.x !== right.x ||
            left.y !== right.y ||
            left.isWalking !== right.isWalking ||
            left.statusMessage !== right.statusMessage
        ) {
            return false;
        }
    }
    return true;
};

const emitPlayers = (players: WorkspacePlayer[]) => {
    const next = normalizePlayers(players);
    if (arePlayersEquivalent(lastPlayers, next)) return;
    lastPlayers = next;
    playerListeners.forEach((listener) => listener(next));
};

const readPersistedStatus = (): string | null => {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(WORKSPACE_STATUS_STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : null;
};

const writePersistedStatus = (status: string | null) => {
    if (typeof window === 'undefined') return;
    if (!status) {
        window.localStorage.removeItem(WORKSPACE_STATUS_STORAGE_KEY);
        return;
    }
    window.localStorage.setItem(WORKSPACE_STATUS_STORAGE_KEY, status);
};

interface PersistedLocation {
    floorId: string;
    x: number;
    y: number;
}

const readPersistedLocation = (): PersistedLocation | null => {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(WORKSPACE_LOCATION_STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<PersistedLocation>;
        if (
            typeof parsed.floorId === 'string' &&
            parsed.floorId &&
            typeof parsed.x === 'number' &&
            typeof parsed.y === 'number'
        ) {
            return { floorId: parsed.floorId, x: parsed.x, y: parsed.y };
        }
    } catch {
        // ignore malformed storage
    }
    return null;
};

const writePersistedLocation = (location: PersistedLocation) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WORKSPACE_LOCATION_STORAGE_KEY, JSON.stringify(location));
};

const applyPendingSpawn = (player: WorkspacePlayer): WorkspacePlayer => {
    if (!pendingSpawn) return player;
    if (player.floorId !== null) return player;
    const nextPlayer = { ...player, ...pendingSpawn };
    pendingSpawn = null;
    return nextPlayer;
};

const buildLocalPlayerFromSnapshot = (): WorkspacePlayer | null => {
    if (!activeUserId) return null;

    const snapshot = lastPlayers.find((p) => p.id === activeUserId);
    if (snapshot) return { ...snapshot };

    if (pendingSpawn && pendingSpawn.floorId) {
        return {
            id: activeUserId,
            displayName: 'User',
            avatarUrl: null,
            role: undefined,
            floorId: (pendingSpawn.floorId as string) || null,
            x: typeof pendingSpawn.x === 'number' ? pendingSpawn.x : 50,
            y: typeof pendingSpawn.y === 'number' ? pendingSpawn.y : 50,
            isWalking: false,
            statusMessage:
                (pendingSpawn.statusMessage as string | null | undefined) ??
                readPersistedStatus() ??
                null,
        };
    }

    const persistedLocation = readPersistedLocation();
    if (persistedLocation) {
        return {
            id: activeUserId,
            displayName: 'User',
            avatarUrl: null,
            role: undefined,
            floorId: persistedLocation.floorId,
            x: persistedLocation.x,
            y: persistedLocation.y,
            isWalking: false,
            statusMessage: readPersistedStatus() ?? null,
        };
    }

    return null;
};

export const workspacePresenceService = {
    subscribe(options: WorkspaceSubscribeOptions): () => void {
        if (activeUserId && activeUserId !== options.currentUserId) {
            this.disconnect();
        }

        activeUserId = options.currentUserId;
        playerListeners.add(options.onPlayersChange);
        if (options.onError) errorListeners.add(options.onError);

        // Hydrate newly-added listeners with current snapshot.
        options.onPlayersChange(lastPlayers);

        if (activeChannel) {
            return () => {
                playerListeners.delete(options.onPlayersChange);
                if (options.onError) errorListeners.delete(options.onError);
                if (playerListeners.size === 0) {
                    this.disconnect();
                }
            };
        }

        const channel = supabase.channel(PRESENCE_ROOM, {
            config: {
                presence: {
                    key: options.currentUserId,
                },
            },
        });

        channel.on('presence', { event: 'sync' }, () => {
            syncEventsInCurrentMinute += 1;
            const now = Date.now();
            if (DEBUG_WORKSPACE && now - syncWindowStartedAt >= 60_000) {
                console.debug('[workspace] presence sync/min', syncEventsInCurrentMinute);
                syncEventsInCurrentMinute = 0;
                syncWindowStartedAt = now;
            }

            const state = channel.presenceState<WorkspacePresenceState>();
            const players: WorkspacePlayer[] = [];

            for (const id in state) {
                const presences = state[id];
                if (presences && presences.length > 0) {
                    players.push(presences[0].player);
                }
            }

            // Keep local player visible even if the realtime snapshot lags briefly.
            if (currentLocalPlayer && !players.some((p) => p.id === currentLocalPlayer!.id)) {
                players.push(currentLocalPlayer);
            }

            emitPlayers(players);
        });

        channel.subscribe(async (status) => {
            if (status !== 'SUBSCRIBED') {
                if (status === 'CHANNEL_ERROR') {
                    errorListeners.forEach((listener) => listener('Realtime channel error'));
                }
                return;
            }

            if (currentLocalPlayer) {
                await channel.track({ player: currentLocalPlayer });
            } else {
                // Auto-fetch profile for initial connection if not provided
                const { data } = await supabase.from('profiles').select('nickname, full_name, avatar_url, role').eq('id', options.currentUserId).single();
                if (data) {
                    const persistedLocation = readPersistedLocation();
                    currentLocalPlayer = applyPendingSpawn({
                        id: options.currentUserId,
                        displayName: data.nickname || data.full_name || 'User',
                        avatarUrl: data.avatar_url,
                        role: data.role as UserRole,
                        floorId: persistedLocation?.floorId || null,
                        x: persistedLocation?.x ?? Math.random() * 20 + 40,
                        y: persistedLocation?.y ?? Math.random() * 20 + 40,
                        isWalking: false,
                        statusMessage: readPersistedStatus()
                    });
                    await channel.track({ player: currentLocalPlayer });
                }
            }
        });

        activeChannel = channel;

        return () => {
            playerListeners.delete(options.onPlayersChange);
            if (options.onError) errorListeners.delete(options.onError);
            if (playerListeners.size === 0) {
                this.disconnect();
            }
        };
    },

    async updateLocalPlayer(updates: Partial<WorkspacePlayer>) {
        if (!currentLocalPlayer || !activeChannel) return;
        currentLocalPlayer = { ...currentLocalPlayer, ...updates };
        emitPlayers([
            ...lastPlayers.filter((p) => p.id !== currentLocalPlayer!.id),
            currentLocalPlayer,
        ]);
        await activeChannel.track({ player: currentLocalPlayer });
    },

    async setExactLocation(x: number, y: number, floorId: string) {
        if (!floorId) return;

        if (!currentLocalPlayer) {
            pendingSpawn = {
                ...(pendingSpawn || {}),
                floorId,
                x,
                y,
            };
            return;
        }

        currentLocalPlayer = {
            ...currentLocalPlayer,
            floorId,
            x,
            y,
            isWalking: false,
            targetX: undefined,
            targetY: undefined,
        };

        emitPlayers([
            ...lastPlayers.filter((p) => p.id !== currentLocalPlayer!.id),
            currentLocalPlayer,
        ]);

        if (activeChannel) {
            await activeChannel.track({ player: currentLocalPlayer });
        }

        writePersistedLocation({ floorId, x, y });
    },

    async setStatusMessage(statusMessage: string | null) {
        const normalized = statusMessage && statusMessage.trim().length ? statusMessage.trim() : null;

        if (!currentLocalPlayer) {
            const recovered = buildLocalPlayerFromSnapshot();
            if (recovered) {
                currentLocalPlayer = {
                    ...recovered,
                    statusMessage: normalized,
                };
            } else {
                pendingSpawn = {
                    ...(pendingSpawn || {}),
                    statusMessage: normalized,
                };
                writePersistedStatus(normalized);
                return;
            }
        }

        currentLocalPlayer = {
            ...currentLocalPlayer,
            statusMessage: normalized,
        };

        emitPlayers([
            ...lastPlayers.filter((p) => p.id !== currentLocalPlayer!.id),
            currentLocalPlayer,
        ]);

        if (activeChannel) {
            await activeChannel.track({ player: currentLocalPlayer });
        }

        writePersistedStatus(normalized);
    },

    getCurrentStatusMessage(): string | null {
        if (currentLocalPlayer) return currentLocalPlayer.statusMessage ?? null;
        if (pendingSpawn && 'statusMessage' in pendingSpawn) {
            return (pendingSpawn.statusMessage as string | null | undefined) ?? null;
        }
        return null;
    },

    // Use workstation occupancy only as an initial spawn hint.
    async seedFromWorkstation(updates: Pick<WorkspacePlayer, 'floorId' | 'x' | 'y'> & Partial<Pick<WorkspacePlayer, 'statusMessage'>>) {
        if (!updates.floorId) return;

        if (!currentLocalPlayer) {
            pendingSpawn = {
                floorId: updates.floorId,
                x: updates.x,
                y: updates.y,
                statusMessage: updates.statusMessage ?? null,
            };
            return;
        }

        if (currentLocalPlayer.floorId !== null) return;

        currentLocalPlayer = {
            ...currentLocalPlayer,
            floorId: updates.floorId,
            x: updates.x,
            y: updates.y,
            statusMessage: updates.statusMessage ?? currentLocalPlayer.statusMessage,
        };

        if (activeChannel) {
            await activeChannel.track({ player: currentLocalPlayer });
        }
    },

    // Set a target to walk to
    walkTo(x: number, y: number, floorId?: string) {
        if (!currentLocalPlayer || !activeChannel) return;

        currentLocalPlayer.targetX = x;
        currentLocalPlayer.targetY = y;
        currentLocalPlayer.isWalking = true;

        if (floorId !== undefined) {
            // Teleport instantly to prevent weird floating paths across massive boundaries
            if (currentLocalPlayer.floorId !== floorId) {
                currentLocalPlayer.x = x;
                currentLocalPlayer.y = y;
                currentLocalPlayer.isWalking = false;
            }
            currentLocalPlayer.floorId = floorId;
        }

        // Stop existing loop
        if (movementInterval) clearInterval(movementInterval);

        // Simple loop to step towards target and broadcast slightly throttled
        const speed = 2.5; // percent moved per tick
        const broadcastThrottleMs = 90;
        const localEmitThrottleMs = PRESENCE_UI_EMIT_THROTTLE_MS;
        let lastBroadcast = Date.now();
        let lastLocalEmit = Date.now();

        movementInterval = setInterval(() => {
            if (!currentLocalPlayer) return;
            const { x: curX, y: curY, targetX, targetY } = currentLocalPlayer;
            if (targetX === undefined || targetY === undefined) return;

            const dx = targetX - curX;
            const dy = targetY - curY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < speed) {
                // Reached target
                currentLocalPlayer.x = targetX;
                currentLocalPlayer.y = targetY;
                currentLocalPlayer.isWalking = false;
                currentLocalPlayer.targetX = undefined;
                currentLocalPlayer.targetY = undefined;
                clearInterval(movementInterval!);
                emitPlayers([
                    ...lastPlayers.filter((p) => p.id !== currentLocalPlayer!.id),
                    currentLocalPlayer,
                ]);
                activeChannel?.track({ player: currentLocalPlayer });
            } else {
                // Move
                currentLocalPlayer.x += (dx / dist) * speed;
                currentLocalPlayer.y += (dy / dist) * speed;
                if (Date.now() - lastLocalEmit > localEmitThrottleMs) {
                    emitPlayers([
                        ...lastPlayers.filter((p) => p.id !== currentLocalPlayer!.id),
                        currentLocalPlayer,
                    ]);
                    lastLocalEmit = Date.now();
                }

                // Broadcast if threshold met
                if (Date.now() - lastBroadcast > broadcastThrottleMs) {
                    activeChannel?.track({ player: currentLocalPlayer });
                    lastBroadcast = Date.now();
                }
            }
        }, 50); // 20 frames per sec logic loop
    },

    disconnect() {
        if (movementInterval) clearInterval(movementInterval);
        if (activeChannel) {
            activeChannel.unsubscribe();
            activeChannel = null;
        }
        currentLocalPlayer = null;
        pendingSpawn = null;
        activeUserId = null;
        lastPlayers = [];
        playerListeners.clear();
        errorListeners.clear();
    }
};
