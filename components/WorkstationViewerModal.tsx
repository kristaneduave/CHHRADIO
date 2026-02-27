import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CurrentWorkstationStatus, NewsfeedOnlineUser, Floor, WorkspacePlayer } from '../types';
import VirtualWorkspaceRenderer, { ReleaseAndMoveIntent } from './VirtualWorkspaceRenderer';
import { workspacePresenceService } from '../services/virtualWorkspacePresence';

interface WorkstationViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    workstations: CurrentWorkstationStatus[];
    onlineUsers: NewsfeedOnlineUser[];
    currentUserId: string;
    loading: boolean;
    onPinClick: (ws: CurrentWorkstationStatus) => void;
    onReleaseWorkstation: (workstationId: string) => Promise<void>;
    onCheckCurrentUserOccupancy: (workstationId: string) => Promise<boolean>;
    onSetAvatarStatus: (message: string | null) => Promise<void>;
    currentStatusMessage?: string | null;
    floors: Floor[];
    error?: string | null;
}

const STATUS_PRESETS = [
    'On break \u{1F634}',
    'Reading \u{1F4DA}',
    'Procedure \u{1FA7A}',
    'Reporting \u{1F9E0}',
    'Back soon \u{1F44B}',
];

const WorkstationViewerModal: React.FC<WorkstationViewerModalProps> = ({
    isOpen,
    onClose,
    workstations,
    onlineUsers,
    currentUserId,
    loading,
    onPinClick,
    onReleaseWorkstation,
    onCheckCurrentUserOccupancy,
    onSetAvatarStatus,
    currentStatusMessage,
    floors,
    error,
}) => {
    const [statusInput, setStatusInput] = useState('');
    const [showMobileStatusSheet, setShowMobileStatusSheet] = useState(false);
    const [pendingReleaseIntent, setPendingReleaseIntent] = useState<ReleaseAndMoveIntent | null>(null);
    const [expandedFloorId, setExpandedFloorId] = useState<string | null>(null);
    const [players, setPlayers] = useState<WorkspacePlayer[]>([]);
    const DEBUG_WORKSPACE = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

    useEffect(() => {
        if (!isOpen) return;
        setStatusInput(currentStatusMessage || '');
    }, [isOpen, currentStatusMessage]);

    useEffect(() => {
        if (!isOpen || !currentUserId) return;
        const unsubscribe = workspacePresenceService.subscribe({
            currentUserId,
            onPlayersChange: setPlayers,
            onError: console.error,
        });
        return unsubscribe;
    }, [isOpen, currentUserId]);

    useEffect(() => {
        if (!pendingReleaseIntent) return;
        const timer = window.setTimeout(() => {
            setPendingReleaseIntent(null);
        }, 5000);
        return () => window.clearTimeout(timer);
    }, [pendingReleaseIntent]);

    const myOccupiedWorkstation =
        workstations.find((ws) => ws.status === 'IN_USE' && ws.occupant_id === currentUserId) || null;

    const groupedUsers = useMemo(() => {
        type UserWithLoc = typeof onlineUsers[0] & { floorId?: string | null, statusMessage?: string | null };
        const groups: Record<string, UserWithLoc[]> = {};
        const UNKNOWN_LOC = 'Elsewhere';

        onlineUsers.forEach(u => {
            const p = players.find(player => player.id === u.id);
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
    }, [onlineUsers, players, floors]);

    if (!isOpen) return null;

    const saveStatus = async (message: string | null, closeMobile = false) => {
        try {
            await onSetAvatarStatus(message);
            if (closeMobile) setShowMobileStatusSheet(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleConfirmReleaseAndMove = async () => {
        if (!pendingReleaseIntent) return;

        try {
            const releaseStart = performance.now();
            await onReleaseWorkstation(pendingReleaseIntent.workstationId);
            await workspacePresenceService.setExactLocation(
                pendingReleaseIntent.targetX,
                pendingReleaseIntent.targetY,
                pendingReleaseIntent.targetFloorId,
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

    const modalContent = (
        <div className="fixed inset-0 z-[100] bg-[#0a1018]/90 backdrop-blur-2xl animate-in fade-in duration-200">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.15),transparent_45%),radial-gradient(circle_at_0%_100%,rgba(16,185,129,0.15),transparent_40%)]" />

            <div className="relative z-10 h-full w-full flex flex-col md:flex-row">
                <div className="flex-1 flex flex-col overflow-hidden md:border-r border-white/5">
                    <div className="px-4 sm:px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10 shadow-inner">
                                <span className="material-icons text-emerald-400">computer</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Workstation Viewer</h2>
                                <p className="text-xs text-slate-400 font-medium">Live map and avatar status</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowMobileStatusSheet(true)}
                                className="md:hidden px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10"
                            >
                                Status
                            </button>
                            <button
                                onClick={onClose}
                                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                            >
                                <span className="material-icons text-[24px]">close</span>
                            </button>
                        </div>
                    </div>

                    <div className="hidden md:block absolute top-20 right-[21rem] z-40 w-[300px] rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Status Bubble</p>
                        <div className="flex flex-wrap gap-1.5">
                            {STATUS_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => {
                                        setStatusInput(preset);
                                        void saveStatus(preset);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-200"
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
                                className="flex-1 bg-black/35 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60"
                            />
                            <button
                                onClick={() => void saveStatus(statusInput)}
                                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-xs font-bold"
                            >
                                Set
                            </button>
                            <button
                                onClick={() => {
                                    setStatusInput('');
                                    void saveStatus(null);
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-transparent scrollbar-hide">
                        {error ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-slate-300 px-6">
                                <span className="material-icons text-4xl mb-3 text-rose-400">error_outline</span>
                                <p className="text-sm font-semibold text-white">Workspace unavailable</p>
                                <p className="text-xs text-slate-400 mt-1">{error}</p>
                            </div>
                        ) : loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="material-icons animate-spin text-4xl mb-4 text-emerald-400">refresh</span>
                                <p>Loading Workspace Maps...</p>
                            </div>
                        ) : floors.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-slate-300 px-6">
                                <span className="material-icons text-4xl mb-3 text-amber-400">map</span>
                                <p className="text-sm font-semibold text-white">No workspace maps configured</p>
                                <p className="text-xs text-slate-400 mt-1">Ask admin to add a floor map and workstation points.</p>
                            </div>
                        ) : (
                            <div className={`grid grid-cols-1 ${expandedFloorId ? '' : 'xl:grid-cols-2'} gap-4 md:gap-6 h-full min-h-[700px] xl:min-h-0`}>
                                {(expandedFloorId ? floors.filter(f => f.id === expandedFloorId) : floors).map((floor) => (
                                    <div key={floor.id} className="flex flex-col h-full bg-black/40 shadow-2xl backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden transition-all duration-300">
                                        <div className="px-4 py-2 bg-gradient-to-r from-black/40 to-transparent border-b border-white/5 flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                                                {floor.name}
                                            </h3>
                                            {floors.length > 1 && (
                                                <button
                                                    onClick={() => setExpandedFloorId(expandedFloorId === floor.id ? null : floor.id)}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
                                                    title={expandedFloorId === floor.id ? "Show All Maps" : "Focus Map"}
                                                >
                                                    <span className="material-icons text-[18px]">
                                                        {expandedFloorId === floor.id ? 'fullscreen_exit' : 'fullscreen'}
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex-1 relative min-h-[320px]">
                                            <VirtualWorkspaceRenderer
                                                floor={floor}
                                                workstations={workstations.filter((ws) => ws.floor_id === floor.id)}
                                                currentUserId={currentUserId}
                                                onPinClick={onPinClick}
                                                occupiedWorkstation={myOccupiedWorkstation}
                                                onCheckCurrentUserOccupancy={onCheckCurrentUserOccupancy}
                                                onRequestReleaseAndMove={setPendingReleaseIntent}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full md:w-80 shrink-0 bg-black/40 backdrop-blur-xl flex-col relative z-10 h-64 md:h-auto border-t md:border-t-0 md:border-l border-white/10 hidden md:flex shadow-2xl">
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-gradient-to-b from-black/40 to-transparent">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            Online Now
                        </h3>
                        <span className="bg-white/10 text-slate-300 text-xs font-bold px-2 py-1 rounded-full">{onlineUsers.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                        {onlineUsers.length === 0 && !loading && (
                            <p className="text-sm text-slate-500 text-center py-8">No one else is online right now.</p>
                        )}
                        {groupedUsers.map(group => (
                            <div key={group.name} className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    {group.name !== 'Elsewhere' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></span>}
                                    {group.name}
                                </h4>
                                <div className="space-y-1">
                                    {group.users.map((user) => (
                                        <div key={user.id} className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-default border border-transparent hover:border-white/5">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="relative shrink-0">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt={user.displayName} className="w-9 h-9 rounded-full object-cover border border-white/10" />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold border border-primary/30">
                                                            {user.displayName.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0f1621] rounded-full"></span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-white truncate flex items-center gap-2">
                                                        {user.displayName}
                                                    </p>
                                                    <p className="text-xs text-slate-400 truncate">
                                                        {user.statusMessage ? (
                                                            <span className="text-cyan-400">{user.statusMessage}</span>
                                                        ) : (
                                                            user.role || 'Staff'
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            {user.floorId && (
                                                <button
                                                    onClick={() => setExpandedFloorId(user.floorId!)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-all focus:opacity-100"
                                                    title="Focus Map"
                                                >
                                                    <span className="material-icons text-[16px]">my_location</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showMobileStatusSheet && (
                <div className="md:hidden fixed inset-0 z-[120] flex items-end">
                    <div className="absolute inset-0 bg-black/70" onClick={() => setShowMobileStatusSheet(false)} />
                    <div className="relative w-full rounded-t-3xl border border-white/10 bg-[#0f1621] p-4 space-y-3">
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
                        <div className="flex gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
                <div className="fixed inset-x-0 bottom-4 z-[130] px-4 pointer-events-none">
                    <div className="mx-auto max-w-md pointer-events-auto rounded-2xl border border-white/10 bg-black/70 backdrop-blur-sm px-4 py-3 flex items-center gap-3 shadow-xl">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                                Release {pendingReleaseIntent.workstationLabel} and move here?
                            </p>
                            <p className="text-[10px] text-slate-400">Auto-dismisses in a few seconds</p>
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
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};

export default WorkstationViewerModal;
