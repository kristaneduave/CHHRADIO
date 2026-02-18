import React, { useState, useEffect } from 'react';
import { RESIDENT_TOOLS } from '../constants';
import { CONSULTANT_SCHEDULE } from './consultantScheduleData';

// Generate a unique ID for each slot to track overrides
const getSlotId = (hospitalId: string, modalityId: string, day: string, index: number) => {
    return `${hospitalId}-${modalityId}-${day}-${index}`;
};

const ResidentsCornerScreen: React.FC = () => {
    const [selectedHospitalId, setSelectedHospitalId] = useState('fuente');
    const [expandedModality, setExpandedModality] = useState<string | null>(null);

    // State for cover overrides: { [slotId]: "Dr. New Name" }
    // In a real app, this would be persisted to a backend (Supabase)
    const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({});

    // Edit state
    const [editingSlot, setEditingSlot] = useState<{ id: string, current: string } | null>(null);
    const [tempCoverName, setTempCoverName] = useState('');

    const selectedHospital = CONSULTANT_SCHEDULE.find(h => h.id === selectedHospitalId);

    // Get current day
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIndex = new Date().getDay();
    const currentDayName = daysOfWeek[currentDayIndex];

    const toggleModality = (modalityId: string) => {
        setExpandedModality(prev => prev === modalityId ? null : modalityId);
    };

    const handleEditClick = (e: React.MouseEvent, slotId: string, currentName: string) => {
        e.stopPropagation(); // Prevent toggling the accordion
        setEditingSlot({ id: slotId, current: currentName });
        setTempCoverName(coverOverrides[slotId] || ''); // Start with existing override or empty? Maybe empty to placeholder, or existing.
    };

    const handleSaveCover = () => {
        if (editingSlot) {
            if (tempCoverName.trim()) {
                setCoverOverrides(prev => ({
                    ...prev,
                    [editingSlot.id]: tempCoverName.trim()
                }));
            } else {
                // If empty, remove override
                const newOverrides = { ...coverOverrides };
                delete newOverrides[editingSlot.id];
                setCoverOverrides(newOverrides);
            }
            setEditingSlot(null);
            setTempCoverName('');
        }
    };

    const handleCancelEdit = () => {
        setEditingSlot(null);
        setTempCoverName('');
    };

    return (
        <div className="px-6 pt-12 pb-24 flex flex-col min-h-full animate-in fade-in duration-700">
            <header className="mb-6">
                <h1 className="text-xl font-bold text-white tracking-tight">Resident's Corner</h1>
                <p className="text-slate-500 text-[11px] uppercase tracking-[0.2em] mt-1">Tools & Cover</p>
            </header>

            <div className="space-y-6">
                {/* Consultant Cover Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <span className="material-icons text-lg text-rose-500">medical_services</span>
                            Consultant Cover
                        </h2>
                        {/* Live Indicator */}
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wide">Live</span>
                        </div>
                    </div>

                    {/* Hospital Selector */}
                    <div className="flex overflow-x-auto gap-2 mb-4 pb-2 scrollbar-hide">
                        {CONSULTANT_SCHEDULE.map((hospital) => (
                            <button
                                key={hospital.id}
                                onClick={() => setSelectedHospitalId(hospital.id)}
                                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedHospitalId === hospital.id
                                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                {hospital.name}
                            </button>
                        ))}
                    </div>

                    {/* Schedule Display */}
                    <div className="space-y-3">
                        {selectedHospital?.modalities.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-xs italic">
                                Schedule not available yet.
                            </div>
                        ) : (
                            selectedHospital?.modalities.map((modality) => {
                                const isExpanded = expandedModality === modality.id;
                                const todaySchedule = modality.schedule[currentDayName] || [];

                                return (
                                    <div key={modality.id} className="glass-card-enhanced rounded-xl border border-white/10 overflow-hidden relative">
                                        {/* Modality Header & Today's Preview */}
                                        <div
                                            className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() => toggleModality(modality.id)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-sm font-bold text-white">{modality.name}</h3>
                                                <span className={`material-icons text-slate-500 text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                    expand_more
                                                </span>
                                            </div>

                                            {/* Today's Schedule - Prominent Display */}
                                            <div className="space-y-2">
                                                {todaySchedule.length > 0 ? (
                                                    todaySchedule.map((item, idx) => {
                                                        const slotId = getSlotId(selectedHospital.id, modality.id, currentDayName, idx);
                                                        const overrideName = coverOverrides[slotId];
                                                        const isEditing = editingSlot?.id === slotId;

                                                        return (
                                                            <div key={idx} className="flex items-center justify-center p-3 rounded-lg bg-white/5 border border-white/5 relative group">
                                                                <div className="flex-1 min-w-0">
                                                                    {/* Time & Role Label */}
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                                                            TODAY
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                                            {item.time} {item.subtext && ` ${item.subtext}`}
                                                                        </span>
                                                                    </div>

                                                                    {/* Doctor Name */}
                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
                                                                            <input
                                                                                autoFocus
                                                                                className="flex-1 bg-black/50 border border-rose-500/50 text-sm text-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all"
                                                                                placeholder="Enter covering doctor..."
                                                                                value={tempCoverName}
                                                                                onChange={(e) => setTempCoverName(e.target.value)}
                                                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveCover()}
                                                                            />
                                                                            <button onClick={handleSaveCover} className="text-emerald-400 hover:text-emerald-300">
                                                                                <span className="material-icons text-lg">check</span>
                                                                            </button>
                                                                            <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-300">
                                                                                <span className="material-icons text-lg">close</span>
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex-1 truncate">
                                                                                {overrideName ? (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                                                                                            {overrideName}
                                                                                            <span className="material-icons text-[10px]">verified</span>
                                                                                        </span>
                                                                                        <span className="text-[10px] text-slate-500 line-through Decoration-rose-500/50 decoration-2">
                                                                                            {item.doctor}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-sm font-semibold text-slate-200">
                                                                                        {item.doctor}
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {/* Quick Edit Button */}
                                                                            <button
                                                                                className="p-1.5 rounded-full hover:bg-white/10 text-slate-600 hover:text-rose-400 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                                                onClick={(e) => handleEditClick(e, slotId, item.doctor)}
                                                                            >
                                                                                <span className="material-icons text-sm">edit</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-[10px] text-slate-500 italic py-1 pl-1">No schedule for today</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* EXPANDED: Full Week Schedule */}
                                        {isExpanded && (
                                            <div className="border-t border-white/5 bg-black/20 animate-in slide-in-from-top-2 duration-300">
                                                {daysOfWeek.map((day) => {
                                                    const daySchedule = modality.schedule[day] || [];
                                                    if (daySchedule.length === 0) return null;

                                                    // Skip rendering Today again in the expanded view to reduce noise? 
                                                    // Or keep it for continuity? keeping it for now but maybe styled differently.
                                                    const isToday = day === currentDayName;

                                                    return (
                                                        <div key={day} className={`p-4 grid grid-cols-12 gap-3 border-b border-white/5 last:border-0 ${isToday ? 'bg-rose-500/5' : ''}`}>
                                                            {/* Day Label */}
                                                            <div className="col-span-3 pt-1">
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-rose-400' : 'text-slate-500'}`}>
                                                                    {day.substring(0, 3)}
                                                                </span>
                                                            </div>

                                                            {/* Shifts */}
                                                            <div className="col-span-9 space-y-3">
                                                                {daySchedule.map((item, idx) => {
                                                                    const slotId = getSlotId(selectedHospital.id, modality.id, day, idx);
                                                                    const overrideName = coverOverrides[slotId];
                                                                    const isEditing = editingSlot?.id === slotId;

                                                                    return (
                                                                        <div key={idx} className="relative group/item">
                                                                            {isEditing ? (
                                                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                                    <input
                                                                                        autoFocus
                                                                                        className="flex-1 bg-black/50 border border-primary/50 text-xs text-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                                                        value={tempCoverName}
                                                                                        onChange={(e) => setTempCoverName(e.target.value)}
                                                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCover()}
                                                                                    />
                                                                                    <button onClick={handleSaveCover} className="text-emerald-400"><span className="material-icons text-sm">check</span></button>
                                                                                    <button onClick={handleCancelEdit} className="text-slate-400"><span className="material-icons text-sm">close</span></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <div className="flex-1">
                                                                                        {overrideName ? (
                                                                                            <div className="flex flex-col">
                                                                                                <span className="text-xs font-bold text-emerald-400">{overrideName}</span>
                                                                                                <span className="text-[10px] text-slate-500 line-through decoration-rose-500/30">
                                                                                                    {item.doctor}
                                                                                                </span>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="text-xs font-medium text-slate-300">
                                                                                                {item.doctor}
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="text-[10px] text-slate-500 block mt-0.5">
                                                                                            {item.time} {item.subtext && <span className="text-amber-500/60 ml-1">{item.subtext}</span>}
                                                                                        </span>
                                                                                    </div>

                                                                                    {/* Edit Button for Week View */}
                                                                                    {/* Only show if not today, since today has its own big card above? Actually let's allow editing here too for consistency. */}
                                                                                    <button
                                                                                        className="text-slate-600 hover:text-white opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                                        onClick={(e) => handleEditClick(e, slotId, item.doctor)}
                                                                                    >
                                                                                        <span className="material-icons text-[12px]">edit</span>
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* Tools Section */}
                <section>
                    <h2 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                        <span className="material-icons text-lg text-primary">build</span>
                        Essential Tools
                    </h2>
                    <div className="grid grid-cols-1 gap-3">
                        {RESIDENT_TOOLS.map((tool, idx) => (
                            <a
                                key={idx}
                                href={tool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glass-card-enhanced p-4 rounded-xl border border-white/5 flex items-center gap-4 group hover:bg-white/5 transition-all active:scale-[0.99]"
                            >
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <span className="material-icons text-xl">{tool.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{tool.name}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-1">{tool.description}</p>
                                </div>
                                <span className="material-icons text-slate-600 group-hover:text-slate-300">open_in_new</span>
                            </a>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};



export default ResidentsCornerScreen;
