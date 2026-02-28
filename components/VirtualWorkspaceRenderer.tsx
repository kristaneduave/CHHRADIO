import React, { useEffect, useMemo, useState, useRef } from 'react';
import { CurrentWorkstationStatus, Floor, WorkspacePlayer } from '../types';
import { workspacePresenceService } from '../services/virtualWorkspacePresence';

interface VirtualWorkspaceRendererProps {
    floor: Floor;
    workstations: CurrentWorkstationStatus[];
    currentUserId: string;
    players?: WorkspacePlayer[];
    onPinClick: (ws: CurrentWorkstationStatus) => void;
    onSetAreaPresence?: (floorId: string, x: number, y: number) => Promise<void>;
    occupiedWorkstation: CurrentWorkstationStatus | null;
    onCheckCurrentUserOccupancy: (workstationId: string) => Promise<boolean>;
    onRequestReleaseAndMove?: (intent: ReleaseAndMoveIntent) => void;
}

export interface ReleaseAndMoveIntent {
    workstationId: string;
    workstationLabel: string;
    targetFloorId: string;
    targetX: number;
    targetY: number;
}

const getInitial = (name?: string | null): string => {
    const trimmed = (name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
};

// Distance in coordinate space (0-100%) to trigger interaction
const INTERACTION_RADIUS = 3.5;
const LIVE_MAP_PERF_LOG =
    String(import.meta.env?.VITE_LIVE_MAP_PERF_LOG ?? 'false').toLowerCase() === 'true';

const VirtualWorkspaceRenderer: React.FC<VirtualWorkspaceRendererProps> = ({
    floor,
    workstations,
    currentUserId,
    players: externalPlayers,
    onPinClick,
    onSetAreaPresence,
    occupiedWorkstation,
    onCheckCurrentUserOccupancy,
    onRequestReleaseAndMove,
}) => {
    const [players, setPlayers] = useState<WorkspacePlayer[]>([]);
    const [renderPlayers, setRenderPlayers] = useState<WorkspacePlayer[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDocumentVisible, setIsDocumentVisible] = useState<boolean>(
        typeof document !== 'undefined' ? !document.hidden : true,
    );
    const DEBUG_WORKSPACE = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

    useEffect(() => {
        if (externalPlayers) return;
        if (!currentUserId) return;
        const unsubscribe = workspacePresenceService.subscribe({
            currentUserId,
            onPlayersChange: (updatedPlayers) => {
                setPlayers(updatedPlayers);
            },
            onError: (err) => console.error(err)
        });

        return () => {
            unsubscribe();
        };
    }, [currentUserId, externalPlayers]);

    useEffect(() => {
        if (!externalPlayers) return;
        setPlayers(externalPlayers);
    }, [externalPlayers]);

    useEffect(() => {
        const myStation = occupiedWorkstation;
        if (myStation) {
            workspacePresenceService.seedFromWorkstation({
                statusMessage: myStation.status_message || null,
                floorId: myStation.floor_id,
                x: myStation.x,
                y: myStation.y
            });
        }
    }, [
        occupiedWorkstation?.id,
        occupiedWorkstation?.status_message,
        occupiedWorkstation?.floor_id,
        occupiedWorkstation?.x,
        occupiedWorkstation?.y,
    ]);

    useEffect(() => {
        setRenderPlayers((prev) => {
            const prevById = new Map<string, WorkspacePlayer>(prev.map((p) => [p.id, p]));
            return players.map((target) => {
                if (target.id === currentUserId) return target;
                const existing = prevById.get(target.id);
                if (!existing || existing.floorId !== target.floorId) return target;
                return {
                    ...target,
                    x: existing.x,
                    y: existing.y,
                };
            });
        });
    }, [players, currentUserId]);

    useEffect(() => {
        const onVisibility = () => {
            setIsDocumentVisible(!document.hidden);
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    useEffect(() => {
        if (!isDocumentVisible) return;
        let frameId: number;
        let idleTicks = 0;
        let activeFrames = 0;
        const targetById = new Map<string, WorkspacePlayer>(players.map((p) => [p.id, p]));
        const step = () => {
            setRenderPlayers((prev) => {
                let changed = false;

                const next = prev.map((rp: WorkspacePlayer) => {
                    const target = targetById.get(rp.id);
                    if (!target) return rp;
                    if (rp.id === currentUserId) return target;
                    if (target.floorId !== rp.floorId) return target;

                    const dx = target.x - rp.x;
                    const dy = target.y - rp.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 0.02) return target;

                    changed = true;
                    // Lower factor means smoother easing but slower movement. 
                    // 0.15 gives a really nice glide.
                    const factor = 0.15;
                    return {
                        ...target,
                        x: rp.x + dx * factor,
                        y: rp.y + dy * factor,
                    };
                });

                const nextIds = new Set(next.map((p) => p.id));
                for (const target of players) {
                    if (!nextIds.has(target.id)) {
                        next.push(target);
                        changed = true;
                    }
                }

                if (changed) {
                    idleTicks = 0;
                    activeFrames += 1;
                    return next;
                }

                idleTicks += 1;
                return prev;
            });

            if (idleTicks < 6) {
                frameId = window.requestAnimationFrame(step);
            } else if (LIVE_MAP_PERF_LOG && activeFrames > 0) {
                console.debug('[live-map-perf] renderer-active-frames', activeFrames, 'floor', floor.id);
            }
        };

        frameId = window.requestAnimationFrame(step);
        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
        };
    }, [players, currentUserId, floor.id, isDocumentVisible]);

    const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const tapStart = performance.now();

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        await workspacePresenceService.setExactLocation(x, y, floor.id);
        if (onSetAreaPresence) {
            onSetAreaPresence(floor.id, x, y).catch((error) => {
                console.error('Failed to persist area presence from tap:', error);
            });
        }

        if (DEBUG_WORKSPACE) {
            console.debug('[workspace] tap->move local ms', Math.round(performance.now() - tapStart));
        }

        if (occupiedWorkstation?.id) {
            const verifyStart = performance.now();
            const stillOccupying = await onCheckCurrentUserOccupancy(occupiedWorkstation.id);
            if (DEBUG_WORKSPACE) {
                console.debug('[workspace] occupancy verify ms', Math.round(performance.now() - verifyStart));
            }
            if (stillOccupying) {
                const dx = x - occupiedWorkstation.x;
                const dy = y - occupiedWorkstation.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > INTERACTION_RADIUS) {
                    onRequestReleaseAndMove?.({
                        workstationId: occupiedWorkstation.id,
                        workstationLabel: occupiedWorkstation.label,
                        targetFloorId: floor.id,
                        targetX: x,
                        targetY: y,
                    });
                }
            }
        }
    };

    const handleWorkstationClick = (e: React.MouseEvent, ws: CurrentWorkstationStatus) => {
        e.stopPropagation();

        // Move to the workstation first
        workspacePresenceService.walkTo(ws.x, ws.y, floor.id);

        // Wait a tiny bit then trigger the action modal
        setTimeout(() => {
            onPinClick(ws);
        }, 100);
    };

    const floorPlayers = useMemo(
        () => renderPlayers.filter((p) => p.floorId === floor.id),
        [renderPlayers, floor.id],
    );
    const hasValidDimensions = floor.width > 0 && floor.height > 0;
    if (!hasValidDimensions) {
        return (
            <div className="h-full flex items-center justify-center text-rose-300 text-sm">
                Invalid map dimensions
            </div>
        );
    }

    const aspectRatio = `${floor.width} / ${floor.height}`;

    return (
        <div className="relative w-full h-full bg-[#0a1018] rounded-xl overflow-hidden border border-white/10 shadow-inner group">
            <div
                ref={containerRef}
                className="relative w-full h-full cursor-crosshair overflow-hidden touch-none"
                style={{ aspectRatio }}
                onClick={handleMapClick}
            >
                {/* The Base Map Image */}
                <img
                    src={floor.image_url}
                    alt={`${floor.name} workspace`}
                    className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none opacity-80 mix-blend-screen"
                    draggable={false}
                />

                {/* Scanline CRT overlay - Softened for premium feel */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.03)_50%)] bg-[length:100%_4px] pointer-events-none z-0 mix-blend-overlay opacity-60" />

                {/* Workstation Fixed Nodes */}
                {workstations.map(ws => {
                    const isAvailable = ws.status === 'AVAILABLE';
                    const isMine = ws.status === 'IN_USE' && ws.occupant_id === currentUserId;
                    const isOffline = ws.status === 'OFFLINE' || ws.status === 'OUT_OF_SERVICE';

                    let dotClass = 'bg-slate-500';
                    if (isAvailable) dotClass = 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.55)]';
                    if (isMine) dotClass = 'bg-primary shadow-[0_0_10px_rgba(13,162,231,0.8)]';
                    if (ws.status === 'IN_USE' && !isMine) dotClass = 'bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]';

                    return (
                        <button
                            key={ws.id}
                            onClick={(e) => handleWorkstationClick(e, ws)}
                            className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 z-10 hover:scale-125 transition-transform duration-200 group"
                            style={{ left: `${ws.x}%`, top: `${ws.y}%` }}
                        >
                            <div className={`w-3 h-3 rounded-full mx-auto ${dotClass} border border-[#0a1018]`}></div>
                            {/* Floating Custom Tooltip */}
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center bg-black/80 backdrop-blur-md rounded-lg py-1.5 px-2.5 border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
                                <span className="text-white text-[10px] font-bold">{ws.label}</span>
                                {ws.status === 'IN_USE' && ws.occupant_name && (
                                    <span className="text-slate-300 text-[9px] mt-0.5">{ws.occupant_name}</span>
                                )}
                                {ws.status === 'AVAILABLE' && (
                                    <span className="text-emerald-400 text-[9px] mt-0.5">Available</span>
                                )}
                            </div>
                        </button>
                    )
                })}

                {/* Players (Avatars) */}
                {floorPlayers.map(player => {
                    const isMe = player.id === currentUserId;

                    // Calculate distance to nearest target to show "walking" bounce
                    const isMoving = player.isWalking;

                    return (
                        <div
                            key={player.id}
                            className="absolute z-20 transition-all duration-75 ease-linear pointer-events-none"
                            style={{
                                left: `${player.x}%`,
                                top: `${player.y}%`,
                                transform: `translate(-50%, -100%) ${isMoving ? 'scaleY(0.97) scaleX(1.02)' : ''}`,
                                willChange: 'transform',
                            }}
                        >
                            {/* Avatar Bubble */}
                            <div className={`relative flex items-center justify-center w-8 h-8 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-2 ${isMe ? 'border-primary' : 'border-white/50'} bg-[#1c1c1e] overflow-hidden ${isMoving ? 'animate-bounce' : ''}`}>
                                {player.avatarUrl ? (
                                    <img src={player.avatarUrl} alt={player.displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white text-xs font-bold">{getInitial(player.displayName)}</span>
                                )}
                            </div>

                            {/* Name Label */}
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white bg-black/60 px-1 rounded shadow-sm whitespace-nowrap">
                                {player.displayName}
                            </span>


                            {/* Status Mini-Chat - Polished */}
                            {player.statusMessage && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm text-slate-800 px-2 py-0.5 rounded-full text-[10px] font-medium shadow-[0_4px_12px_rgba(0,0,0,0.3)] border border-white/40 z-30 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 pointer-events-auto cursor-help" style={{ animation: 'float 6s ease-in-out infinite' }}>
                                    {player.statusMessage}
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/95 border-b border-r border-white/40 transform rotate-45"></div>
                                </div>
                            )}
                        </div>
                    )
                })}

                <style>{`
            @keyframes float {
                0%, 100% { transform: translateY(0) translateX(-50%); }
                50% { transform: translateY(-2px) translateX(-50%); }
            }
        `}</style>
            </div>
        </div>
    );
};

export default VirtualWorkspaceRenderer;
