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
        <div className="bg-[#0a0f18]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-4 lg:p-5 shadow-[0_0_40px_-10px_rgba(0,0,0,0.8)] relative overflow-hidden group h-full flex flex-col justify-between">
            {/* Decorative Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none transition-opacity duration-700 opacity-30 group-hover:opacity-60" />

            <div className="relative z-10 flex flex-col h-full space-y-3">

                {/* Header Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 w-full">
                        <div className="w-[38px] h-[38px] shrink-0 rounded-[14px] bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all">
                            <span className="material-icons text-cyan-400 text-[18px]">map</span>
                        </div>
                        <div className="flex-1 min-w-0 pr-1">
                            <h2 className="text-[12px] sm:text-[13px] tracking-widest font-extrabold text-white group-hover:text-cyan-400 transition-colors uppercase mb-0.5 mt-1">Live Map</h2>
                            <p className="text-[9px] text-white/50 uppercase tracking-widest font-bold">Workstation status</p>
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
                <div className="relative w-full flex-1 min-h-[140px] bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden mt-2 shadow-inner group-hover:border-white/10 transition-colors">
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
                        <div className="bg-[#0a0f18]/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            <span className="text-[9px] font-bold text-white tracking-widest uppercase">{loading ? '-' : availableCount} <span className="text-slate-500 hidden sm:inline">Avail</span></span>
                        </div>
                        <div className="bg-[#0a0f18]/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
                            <span className="text-[9px] font-bold text-white tracking-widest uppercase">{loading ? '-' : inUseCount} <span className="text-slate-500 hidden sm:inline">Used</span></span>
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
                    className="w-full py-3.5 mt-2 rounded-2xl bg-cyan-500/[0.03] hover:bg-cyan-500/[0.08] border border-cyan-500/10 hover:border-cyan-500/20 text-cyan-400 font-bold text-[10px] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                    Enter Workspace
                    <span className="material-icons text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
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
