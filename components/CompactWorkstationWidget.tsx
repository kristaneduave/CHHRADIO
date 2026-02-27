import React, { useState } from 'react';
import { CurrentWorkstationStatus, NewsfeedOnlineUser } from '../types';

interface CompactWorkstationWidgetProps {
    workstations: CurrentWorkstationStatus[];
    onlineUsers: NewsfeedOnlineUser[];
    onOpenViewer: () => void;
    loading: boolean;
    error: string | null;
}

const CompactWorkstationWidget: React.FC<CompactWorkstationWidgetProps> = ({
    workstations,
    onlineUsers,
    onOpenViewer,
    loading,
    error
}) => {
    const availableCount = workstations.filter(ws => ws.status === 'AVAILABLE').length;
    const inUseCount = workstations.filter(ws => ws.status === 'IN_USE').length;

    // Use a default map background for the preview
    const MAP_BOUNDS = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };

    return (
        <div className="rounded-3xl border border-white/5 bg-[#111721] p-4 lg:p-5 shadow-2xl relative overflow-hidden group h-full flex flex-col justify-between">
            {/* Decorative Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none transition-opacity duration-700 opacity-30 group-hover:opacity-60" />

            <div className="relative z-10 flex flex-col h-full space-y-3">

                {/* Header Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center border border-white/10 shadow-inner block">
                            <span className="material-icons text-cyan-400 text-[22px]">map</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">Live Map</h2>
                            <p className="text-xs text-slate-400 font-medium">Workstation status</p>
                        </div>
                    </div>

                    {/* Online Avatar Cluster */}
                    {!loading && onlineUsers.length > 0 && (
                        <div className="flex -space-x-2.5">
                            {onlineUsers.slice(0, 3).map((user, i) => (
                                <div key={user.id} className="w-7 h-7 rounded-full border border-[#111721] bg-slate-800 flex items-center justify-center overflow-hidden" style={{ zIndex: 10 - i }}>
                                    {user.avatarUrl ? (
                                        <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-300">{user.displayName.charAt(0)}</span>
                                    )}
                                </div>
                            ))}
                            {onlineUsers.length > 3 && (
                                <div className="w-7 h-7 rounded-full border border-[#111721] bg-slate-800 flex items-center justify-center z-0">
                                    <span className="text-[9px] font-bold text-slate-400">+{onlineUsers.length - 3}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Mini Map Viewport */}
                <div className="relative w-full flex-1 min-h-[140px] bg-black/40 rounded-2xl border border-white/5 overflow-hidden mt-1 shadow-inner">
                    {/* Simplified Map Background via CSS */}
                    <div
                        className="absolute inset-0 opacity-80 mix-blend-screen"
                        style={{
                            backgroundImage: 'url(/mock-map.png)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    />

                    {/* Live Stats Overlays */}
                    <div className="absolute top-2 left-2 flex gap-2">
                        <div className="bg-[#111721]/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            <span className="text-[10px] font-bold text-white tracking-wide">{loading ? '-' : availableCount} <span className="text-slate-400 hidden sm:inline">Avail</span></span>
                        </div>
                        <div className="bg-[#111721]/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                            <span className="text-[10px] font-bold text-white tracking-wide">{loading ? '-' : inUseCount} <span className="text-slate-400 hidden sm:inline">Used</span></span>
                        </div>
                    </div>

                    {/* Rendering the glowing dots */}
                    {!loading && workstations.map((ws) => {
                        // Coordinates are already stored as 0-100 percentages in the DB
                        if (ws.x === undefined || ws.y === undefined) return null;

                        const isAvailable = ws.status === 'AVAILABLE';
                        return (
                            <div
                                key={ws.id}
                                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-in-out z-20"
                                style={{
                                    left: `${ws.x}%`,
                                    top: `${ws.y}%`,
                                }}
                            >
                                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-white/20 ${isAvailable ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-rose-500 opacity-60'}`} />
                            </div>
                        );
                    })}
                </div>

                {/* CTA Button */}
                <button
                    onClick={onOpenViewer}
                    className="w-full py-3 mt-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-[14px] transition-all duration-200 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center gap-2"
                >
                    Enter Workspace
                    <span className="material-icons text-[18px]">arrow_forward</span>
                </button>
            </div>

            {error && (
                <div className="absolute bottom-2 left-2 right-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-[10px] text-center backdrop-blur-md">
                    {error}
                </div>
            )}
        </div>
    );
};

export default CompactWorkstationWidget;
