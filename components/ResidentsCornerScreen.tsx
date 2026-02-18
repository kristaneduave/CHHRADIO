import React, { useState, useEffect } from 'react';
import { RESIDENT_TOOLS } from '../constants';
import { CONSULTANT_SCHEDULE } from './consultantScheduleData';
import ManageCoversModal, { CoverEntry } from './ManageCoversModal';
import { supabase } from '../services/supabase';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';

// Generate a unique ID for each slot to track overrides
const getSlotId = (hospitalId: string, modalityId: string, day: string, index: number) => {
    return `${hospitalId}-${modalityId}-${day}-${index}`;
};

const ResidentsCornerScreen: React.FC = () => {
    const [selectedHospitalId, setSelectedHospitalId] = useState('fuente');
    const [expandedModality, setExpandedModality] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // State for cover overrides: { [slotId]: CoverEntry[] }
    const [coverOverrides, setCoverOverrides] = useState<Record<string, CoverEntry[]>>({});

    // Fetch user and covers on mount
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
            fetchCovers();
        };
        init();

        // Real-time subscription
        const channel = supabase
            .channel('consultant_covers_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'consultant_covers' }, (payload) => {
                fetchCovers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchCovers = async () => {
        const { data, error } = await supabase
            .from('consultant_covers')
            .select('*');

        if (error) {
            console.error('Error fetching covers:', error);
            return;
        }

        if (data) {
            const overrides: Record<string, CoverEntry[]> = {};
            data.forEach((row: any) => {
                const entry: CoverEntry = {
                    id: row.id,
                    doctorName: row.doctor_name,
                    scope: row.scope,
                    informed: row.informed,
                    readStatus: row.read_status as any,
                    informedBy: row.informed_by
                };
                if (!overrides[row.slot_id]) {
                    overrides[row.slot_id] = [];
                }
                overrides[row.slot_id].push(entry);
            });
            setCoverOverrides(overrides);
        }
    };

    // Modal state
    const [modalData, setModalData] = useState<{
        isOpen: boolean;
        slotId: string;
        originalDoctor: string;
        timeSlot: string;
    }>({
        isOpen: false,
        slotId: '',
        originalDoctor: '',
        timeSlot: ''
    });

    const selectedHospital = CONSULTANT_SCHEDULE.find(h => h.id === selectedHospitalId);

    // Get current day
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIndex = new Date().getDay();
    const currentDayName = daysOfWeek[currentDayIndex];

    const toggleModality = (modalityId: string) => {
        setExpandedModality(prev => prev === modalityId ? null : modalityId);
    };

    const handleEditClick = (e: React.MouseEvent, slotId: string, doctorName: string, time: string) => {
        e.stopPropagation();
        setModalData({
            isOpen: true,
            slotId,
            originalDoctor: doctorName,
            timeSlot: time
        });
    };

    const handleSaveCovers = async (covers: CoverEntry[]) => {
        const slotId = modalData.slotId;
        const currentSlotCovers = coverOverrides[slotId] || [];

        try {
            // Identify deletions
            const newIds = new Set(covers.map(c => c.id));
            const toDelete = currentSlotCovers.filter(c => !newIds.has(c.id));

            for (const del of toDelete) {
                // Only delete if it's a UUID (not temp which shouldn't exist in DB yet unless persisted)
                if (!del.id.startsWith('temp-')) {
                    await supabase.from('consultant_covers').delete().eq('id', del.id);
                }
            }

            // Upsert new/updated
            for (const cover of covers) {
                const isTemp = cover.id.startsWith('temp-') || /^\d+$/.test(cover.id);

                const payload: any = {
                    slot_id: slotId,
                    doctor_name: cover.doctorName,
                    scope: cover.scope,
                    informed: cover.informed,
                    read_status: cover.readStatus,
                    informed_by: cover.informed ? (cover.informedBy || currentUser?.email) : null
                };

                if (!isTemp) {
                    payload.id = cover.id;
                }

                await supabase.from('consultant_covers').upsert(payload);
            }

            fetchCovers();
        } catch (err) {
            console.error("Error saving covers:", err);
            // Fallback to local state if offline/error
            setCoverOverrides(prev => ({
                ...prev,
                [slotId]: covers
            }));
        }

        setModalData(prev => ({ ...prev, isOpen: false }));
    };

    const toggleStatus = async (e: React.MouseEvent, slotId: string, coverId: string, field: 'informed' | 'read') => {
        e.stopPropagation();

        const currentSlotCovers = coverOverrides[slotId];
        const cover = currentSlotCovers?.find(c => c.id === coverId);
        if (!cover) return;

        let newInformed = cover.informed;
        let newReadStatus = cover.readStatus;
        let newInformedBy = cover.informedBy;

        if (field === 'informed') {
            newInformed = !newInformed;
            newInformedBy = newInformed ? (currentUser?.email || 'Unknown') : null;
        } else if (field === 'read') {
            newReadStatus =
                cover.readStatus === 'none' ? 'partial' :
                    cover.readStatus === 'partial' ? 'complete' : 'none';

            // Auto-inform logic
            if (newReadStatus === 'partial' || newReadStatus === 'complete') {
                if (!newInformed) {
                    newInformed = true;
                    newInformedBy = currentUser?.email || 'Unknown';
                }
            }
        }

        try {
            const { error } = await supabase
                .from('consultant_covers')
                .update({
                    informed: newInformed,
                    read_status: newReadStatus,
                    informed_by: newInformedBy
                })
                .eq('id', coverId);

            if (error) throw error;
            // No need to manually update state as subscription will handle it, 
            // but for instant feedback we can:
            setCoverOverrides(prev => ({
                ...prev,
                [slotId]: prev[slotId].map(c =>
                    c.id === coverId
                        ? { ...c, informed: newInformed, readStatus: newReadStatus, informedBy: newInformedBy }
                        : c
                )
            }));
        } catch (err) {
            console.error("Error updating status:", err);
        }
    };

    const renderCoverStatus = (slotId: string, cover: CoverEntry) => {
        return (
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                {/* Informed Toggle */}
                <button
                    onClick={(e) => toggleStatus(e, slotId, cover.id, 'informed')}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${cover.informed
                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm shadow-blue-500/20'
                        : 'bg-white/5 border-white/5 text-slate-600 hover:bg-white/10 hover:text-slate-400'
                        }`}
                    title={cover.informed ? "Informed" : "Mark as Informed"}
                >
                    <span className="material-icons text-sm">
                        {cover.informed ? 'mark_chat_read' : 'chat_bubble_outline'}
                    </span>
                </button>

                {/* Read Status Toggle */}
                <button
                    onClick={(e) => toggleStatus(e, slotId, cover.id, 'read')}
                    className={`h-7 px-2.5 flex items-center gap-1.5 rounded-lg border transition-all font-bold text-[10px] uppercase tracking-wide ${cover.readStatus === 'complete'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                        : cover.readStatus === 'partial'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : 'bg-white/5 border-white/5 text-slate-600 hover:bg-white/10 hover:text-slate-400'
                        }`}
                >
                    <span className="material-icons text-sm">
                        {cover.readStatus === 'complete' ? 'check' : cover.readStatus === 'partial' ? 'hourglass_top' : 'circle'}
                    </span>
                    {cover.readStatus === 'complete' ? 'Done' : cover.readStatus === 'partial' ? 'Partial' : 'Read'}
                </button>
            </div>
        );
    };

    return (
        <>
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
                                                            const activeCovers = coverOverrides[slotId] || [];
                                                            const hasCovers = activeCovers.length > 0;

                                                            return (
                                                                <div key={idx} className={`flex flex-col p-3 rounded-lg border relative group transition-all ${hasCovers ? 'bg-white/5 border-rose-500/20' : 'bg-white/5 border-white/5'
                                                                    }`}>
                                                                    <div className="flex items-center justify-between">
                                                                        {/* Time & Role Label */}
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                                                                TODAY
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-500 font-medium">
                                                                                {item.time} {item.subtext && ` ${item.subtext}`}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-col gap-2 mt-1">
                                                                        {/* Original Doctor */}
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className={`text-sm font-semibold transition-all ${hasCovers ? 'text-slate-500 line-through decoration-rose-500/50 decoration-2' : 'text-slate-200'}`}>
                                                                                {item.doctor}
                                                                            </div>
                                                                            {/* Quick Edit Button */}
                                                                            <button
                                                                                className="p-1.5 rounded-full hover:bg-white/10 text-slate-600 hover:text-rose-400 transition-colors"
                                                                                onClick={(e) => handleEditClick(e, slotId, item.doctor, item.time)}
                                                                                title="Manage Covers"
                                                                            >
                                                                                <span className="material-icons text-sm">edit</span>
                                                                            </button>
                                                                        </div>

                                                                        {/* Active Covers List */}
                                                                        {hasCovers && (
                                                                            <div className="space-y-2 mt-1">
                                                                                {activeCovers.map((cover) => (
                                                                                    <div key={cover.id} className="flex items-center justify-between bg-black/30 rounded-lg p-2 border border-white/5">
                                                                                        {/* Left: Info */}
                                                                                        <div className="flex flex-col">
                                                                                            <span className={`text-sm font-bold flex items-center gap-1 ${cover.readStatus === 'complete' ? 'text-emerald-400' :
                                                                                                cover.readStatus === 'partial' ? 'text-amber-400' : 'text-slate-200'
                                                                                                }`}>
                                                                                                {cover.doctorName}
                                                                                                {cover.readStatus === 'complete' && <span className="material-icons text-[12px] text-emerald-500">verified</span>}
                                                                                            </span>
                                                                                            {cover.scope !== 'All' && (
                                                                                                <span className="text-[9px] text-slate-500 font-medium mt-0.5">
                                                                                                    Scope: <span className="text-slate-400">{cover.scope}</span>
                                                                                                </span>
                                                                                            )}
                                                                                            {cover.informed && cover.informedBy && (
                                                                                                <span className="text-[8px] text-slate-600 mt-0.5 flex items-center gap-1">
                                                                                                    <span className="material-icons text-[8px]">face</span>
                                                                                                    Inf by: {cover.informedBy.split('@')[0]}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* Right: Actions */}
                                                                                        {renderCoverStatus(slotId, cover)}
                                                                                    </div>
                                                                                ))}
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
                                                                        const activeCovers = coverOverrides[slotId] || [];
                                                                        const hasCovers = activeCovers.length > 0;

                                                                        return (
                                                                            <div key={idx} className="relative group/item flex flex-col gap-1">
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <div className="flex-1">
                                                                                        <div className={`text-xs font-medium transition-all ${hasCovers ? 'text-slate-500 line-through decoration-rose-500/30' : 'text-slate-300'}`}>
                                                                                            {item.doctor}
                                                                                        </div>
                                                                                        <span className="text-[10px] text-slate-500 block mt-0.5">
                                                                                            {item.time} {item.subtext && <span className="text-amber-500/60 ml-1">{item.subtext}</span>}
                                                                                        </span>
                                                                                    </div>

                                                                                    <button
                                                                                        className="text-slate-600 hover:text-white opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                                        onClick={(e) => handleEditClick(e, slotId, item.doctor, item.time)}
                                                                                    >
                                                                                        <span className="material-icons text-[12px]">edit</span>
                                                                                    </button>
                                                                                </div>

                                                                                {/* Active Covers List (Week View) */}
                                                                                {hasCovers && (
                                                                                    <div className="space-y-2 mt-1">
                                                                                        {activeCovers.map((cover) => (
                                                                                            <div key={cover.id} className="flex items-center justify-between border-l-2 border-rose-500/20 pl-2 py-0.5">
                                                                                                <div className="flex flex-col">
                                                                                                    <span className={`text-xs font-bold ${cover.readStatus === 'complete' ? 'text-emerald-400' : 'text-slate-300'
                                                                                                        }`}>
                                                                                                        {cover.doctorName}
                                                                                                    </span>
                                                                                                    {cover.scope !== 'All' && (
                                                                                                        <span className="text-[8px] text-slate-500">
                                                                                                            {cover.scope}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {cover.informed && cover.informedBy && (
                                                                                                        <span className="text-[7px] text-slate-600 block leading-tight mt-0.5">
                                                                                                            by {cover.informedBy.split('@')[0]}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                {/* Simplified status for week view to avoid clutter, or reusable component */}
                                                                                                <div className="scale-75 origin-right">
                                                                                                    {renderCoverStatus(slotId, cover)}
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
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

            <ManageCoversModal
                isOpen={modalData.isOpen}
                onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
                onSave={handleSaveCovers}
                initialCovers={coverOverrides[modalData.slotId] || []}
                originalDoctor={modalData.originalDoctor}
                timeSlot={modalData.timeSlot}
            />
        </>
    );
};

export default ResidentsCornerScreen;
