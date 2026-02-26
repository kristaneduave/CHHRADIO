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

    return (
        <div className="rounded-3xl border border-white/5 bg-[#1c1c1e] p-5 lg:p-6 shadow-2xl relative overflow-hidden group h-full flex flex-col justify-between">
            {/* Decorative Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none transition-opacity duration-700 opacity-30 group-hover:opacity-60" />

            <div className="relative z-10 flex flex-col h-full space-y-4">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-cyan-500/20 flex items-center justify-center border border-white/10 shadow-inner block">
                        <span className="material-icons text-primary text-[28px]">computer</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Workstations</h2>
                        <p className="text-sm text-slate-400 font-medium">Claim an empty computer</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available</span>
                        </div>
                        <p className="text-3xl font-black text-white">{loading ? '-' : availableCount}</p>
                    </div>

                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">In Use</span>
                        </div>
                        <p className="text-3xl font-black text-white">{loading ? '-' : inUseCount}</p>
                    </div>
                </div>

                {/* Online Indicator Mini */}
                {!loading && (
                    <div className="flex items-center gap-2 justify-center py-1">
                        <div className="flex -space-x-3 justify-center mb-1">
                            {onlineUsers.slice(0, 4).map((user, i) => (
                                <div key={user.id} className={`w-8 h-8 rounded-full border-2 border-[#1c1c1e] bg-slate-800 flex items-center justify-center z-[${4 - i}] overflow-hidden`}>
                                    {user.avatarUrl ? (
                                        <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xs font-bold text-slate-300">{user.displayName.charAt(0)}</span>
                                    )}
                                </div>
                            ))}
                            {onlineUsers.length > 4 && (
                                <div className="w-8 h-8 rounded-full border-2 border-[#1c1c1e] bg-slate-800 flex items-center justify-center z-0">
                                    <span className="text-[10px] font-bold text-slate-400">+{onlineUsers.length - 4}</span>
                                </div>
                            )}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{onlineUsers.length} Online</span>
                    </div>
                )}

                {/* CTA Button */}
                <button
                    onClick={onOpenViewer}
                    className="w-full py-4 mt-2 rounded-2xl bg-primary hover:bg-primary-dark text-white font-bold text-[16px] transition-all duration-200 shadow-[0_10px_30px_-10px_rgba(13,162,231,0.5)] flex items-center justify-center gap-2"
                >
                    Open Viewer
                    <span className="material-icons text-xl">open_in_new</span>
                </button>
            </div>

            {error && (
                <div className="absolute bottom-4 left-4 right-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                    {error}
                </div>
            )}
        </div>
    );
};

export default CompactWorkstationWidget;
