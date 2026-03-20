import React, { useState, useEffect } from 'react';
import { CONSULTANT_SCHEDULE } from './consultantScheduleData';
import { NeedleUserStats, PickleballUserStats, Profile, UserRole } from '../types';
import ManageCoversModal, { CoverEntry, LogEntry } from './ManageCoversModal';
import CoverDetailsModal from './CoverDetailsModal';
import { supabase } from '../services/supabase';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { toastError } from '../utils/toast';
import NeedleNavigatorCard from './NeedleNavigatorCard';
import NeedleNavigatorGame from './NeedleNavigatorGame';
import { getNeedleUserStats } from '../services/needleNavigatorService';
import PickleballRallyGame from './PickleballRallyGame';
import { getPickleballUserStats } from '../services/pickleballRallyService';
import { normalizeUserRole } from '../utils/roles';
import PageShell from './ui/PageShell';
const SCOPE_REMAINING = 'Remaining studies';

interface ResidentsCornerScreenProps {
    onOpenMonthlyCensus?: () => void;
    onOpenResidentEndorsements?: () => void;
}

// Generate a unique ID for each slot to track overrides
const getSlotId = (hospitalId: string, modalityId: string, day: string, index: number) => {
    return `${hospitalId}-${modalityId}-${day}-${index}`;
};

const ResidentsCornerScreen: React.FC<ResidentsCornerScreenProps> = ({ onOpenMonthlyCensus, onOpenResidentEndorsements }) => {
    const [selectedHospitalId, setSelectedHospitalId] = useState('fuente');
    const [expandedModality, setExpandedModality] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [isRoleLoading, setIsRoleLoading] = useState(true);

    // State for cover overrides: { [slotId]: CoverEntry[] }
    const [coverOverrides, setCoverOverrides] = useState<Record<string, CoverEntry[]>>({});

    const [profiles, setProfiles] = useState<Record<string, Profile>>({});

    // Fetch user and covers on mount
    useEffect(() => {
        const init = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setCurrentUser(user);
                if (user?.id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .maybeSingle();
                    setCurrentUserRole(normalizeUserRole(profile?.role));
                } else {
                    setCurrentUserRole(null);
                }
            } finally {
                setIsRoleLoading(false);
            }
            fetchCovers();
            fetchProfiles();
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

    const fetchProfiles = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*');

        if (error) {
            console.error('Error fetching profiles:', error);
            return;
        }

        if (data) {
            const profileMap: Record<string, Profile> = {};
            data.forEach((p: any) => {
                profileMap[p.id] = p;
            });
            setProfiles(profileMap);
        }
    };

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
                    informedBy: row.informed_by,
                    logs: row.logs || [] // Load logs
                };
                if (!overrides[row.slot_id]) {
                    overrides[row.slot_id] = [];
                }
                overrides[row.slot_id].push(entry);
            });
            setCoverOverrides(overrides);
        }
    };

    // Manage Covers Modal state
    const [manageModalData, setManageModalData] = useState<{
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

    // Details Modal state
    const [detailsModalData, setDetailsModalData] = useState<{
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
    const [isNeedleNavigatorOpen, setIsNeedleNavigatorOpen] = useState(false);
    const needleNavigatorEnabled = import.meta.env.VITE_FEATURE_NEEDLE_NAVIGATOR === 'true';
    const [needleStats, setNeedleStats] = useState<NeedleUserStats | null>(null);
    const pickleballEnabled = import.meta.env.VITE_FEATURE_PICKLEBALL_RALLY === 'true';
    const [isPickleballOpen, setIsPickleballOpen] = useState(false);
    const [pickleballStats, setPickleballStats] = useState<PickleballUserStats | null>(null);

    const selectedHospital = CONSULTANT_SCHEDULE.find(h => h.id === selectedHospitalId);
    const canOpenEndorsements = currentUserRole === 'admin' || currentUserRole === 'moderator' || currentUserRole === 'resident';

    // Get current day
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIndex = new Date().getDay();
    const currentDayName = daysOfWeek[currentDayIndex];
    const selectedHospitalLabel = selectedHospital?.name || 'Fuente';
    const hospitalModalities = selectedHospital?.modalities || [];
    const totalCoverCount = hospitalModalities.reduce((count, modality) => {
        return count + daysOfWeek.reduce((dayCount, day) => {
            const daySchedule = modality.schedule[day] || [];
            return dayCount + daySchedule.reduce((slotCount, _item, idx) => {
                const slotId = getSlotId(selectedHospitalId, modality.id, day, idx);
                return slotCount + ((coverOverrides[slotId]?.length || 0) > 0 ? 1 : 0);
            }, 0);
        }, 0);
    }, 0);
    const todayConsultantCount = hospitalModalities.reduce((count, modality) => {
        return count + (modality.schedule[currentDayName] || []).length;
    }, 0);
    const quickActionCount =
        4 +
        (needleNavigatorEnabled ? 1 : 0) +
        (pickleballEnabled ? 1 : 0) +
        (!isRoleLoading && canOpenEndorsements ? 1 : 0);

    const toggleModality = (modalityId: string) => {
        setExpandedModality(prev => prev === modalityId ? null : modalityId);
    };

    const handleEditClick = (e: React.MouseEvent, slotId: string, doctorName: string, time: string) => {
        e.stopPropagation();
        setManageModalData({
            isOpen: true,
            slotId,
            originalDoctor: doctorName,
            timeSlot: time
        });
    };

    const handleCardClick = (e: React.MouseEvent, slotId: string, doctorName: string, time: string, hasCovers: boolean) => {
        e.stopPropagation();
        if (hasCovers) {
            setDetailsModalData({
                isOpen: true,
                slotId,
                originalDoctor: doctorName,
                timeSlot: time
            });
        } else {
            // If no covers, maybe just open manage? Or do nothing?
            // Let's open Manage if clicked directly, similar to edit button
            setManageModalData({
                isOpen: true,
                slotId,
                originalDoctor: doctorName,
                timeSlot: time
            });
        }
    };

    const handleSaveCovers = async (covers: CoverEntry[]) => {
        const slotId = manageModalData.slotId;
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
                    informed_by: cover.informed ? (cover.informedBy || currentUser?.id) : null
                };

                if (!isTemp) {
                    payload.id = cover.id;
                }

                await supabase.from('consultant_covers').upsert(payload);
            }

            // Optimistic update
            setCoverOverrides(prev => ({
                ...prev,
                [slotId]: covers
            }));

            fetchCovers();
        } catch (err) {
            console.error("Error saving covers:", err);
            // Fallback to local state if offline/error
            setCoverOverrides(prev => ({
                ...prev,
                [slotId]: covers
            }));
        }

        setManageModalData(prev => ({ ...prev, isOpen: false }));
    };

    const toggleStatus = async (e: React.MouseEvent | undefined, slotId: string, coverId: string, field: 'informed' | 'read') => {
        if (e) e.stopPropagation();

        const currentSlotCovers = coverOverrides[slotId];
        const cover = currentSlotCovers?.find(c => c.id === coverId);
        if (!cover) return;

        let newInformed = cover.informed;
        let newReadStatus = cover.readStatus;
        let newInformedBy = cover.informedBy;

        if (field === 'informed') {
            newInformed = !newInformed;
            newInformedBy = newInformed ? (currentUser?.id || 'Unknown') : null;
        } else if (field === 'read') {
            newReadStatus =
                cover.readStatus === 'none' ? 'partial' :
                    cover.readStatus === 'partial' ? 'complete' : 'none';

            // Auto-inform logic
            if (newReadStatus === 'partial' || newReadStatus === 'complete') {
                if (!newInformed) {
                    newInformed = true;
                    newInformedBy = currentUser?.id || 'Unknown';
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

    const handleAddLog = async (slotId: string, coverId: string, message: string) => {
        if (!message.trim()) return;

        const currentSlotCovers = coverOverrides[slotId];
        const cover = currentSlotCovers?.find(c => c.id === coverId);
        if (!cover) return;

        const nickname = profiles[currentUser?.id]?.nickname || currentUser?.user_metadata?.nickname || currentUser?.email?.split('@')[0] || 'Anonymous';

        const newLog: LogEntry = {
            id: Date.now().toString(),
            userId: currentUser?.id || 'anon',
            userName: nickname,
            message: message.trim(),
            timestamp: new Date().toISOString(),
            type: 'note'
        };

        const updatedLogs = [...(cover.logs || []), newLog];

        try {
            const { error } = await supabase
                .from('consultant_covers')
                .update({
                    logs: updatedLogs
                })
                .eq('id', coverId);

            if (error) {
                console.error("Supabase Error (Logs):", error);
                // Don't throw here to allow optimistic update to "stick" for the session if DB is missing column
            }

            // Optimistic update
            setCoverOverrides(prev => ({
                ...prev,
                [slotId]: prev[slotId].map(c =>
                    c.id === coverId
                        ? { ...c, logs: updatedLogs }
                        : c
                )
            }));
        } catch (err) {
            console.error("Error adding log:", err);
        }
    };

    const handleOpenMonthlyCensus = async () => {
        let userId = currentUser?.id || null;

        // Handle first-tap race where local state hasn't hydrated yet.
        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
                setCurrentUser(user);
                userId = user.id;
            }
        }

        if (!userId) {
            toastError('Sign in required', 'Please sign in to submit monthly census.');
            return;
        }
        onOpenMonthlyCensus?.();
    };

    const handleRadiopaediaSearch = () => {
        const input = window.prompt('Search Radiopaedia for:');
        const query = (input || '').trim();
        if (!query) return;
        const url = `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(query)}`;
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (!win) {
            toastError('Unable to open Radiopaedia', 'Please allow pop-ups for this site.');
        }
    };

    useEffect(() => {
        if (!needleNavigatorEnabled || !currentUser?.id) {
            setNeedleStats(null);
            return;
        }
        getNeedleUserStats(currentUser.id)
            .then((data) => setNeedleStats(data))
            .catch(() => setNeedleStats(null));
    }, [currentUser?.id, needleNavigatorEnabled]);

    useEffect(() => {
        if (!pickleballEnabled || !currentUser?.id) {
            setPickleballStats(null);
            return;
        }
        getPickleballUserStats(currentUser.id)
            .then((data) => setPickleballStats(data))
            .catch(() => setPickleballStats(null));
    }, [currentUser?.id, pickleballEnabled]);



    return (
        <PageShell layoutMode="wide" contentClassName="pt-6">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen bg-app">
                <div className="mx-auto w-full max-w-7xl space-y-6">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)] xl:items-start">
                        <div className="space-y-5">
                            <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-md lg:p-6">
                                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                    <div className="min-w-0">
                                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-400/85">Resident Operations Board</p>
                                        <h1 className="text-3xl font-bold text-white md:text-4xl">Resident HQ</h1>
                                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                                            Live workstation coverage, quick tools, and consultant schedules for {selectedHospitalLabel}.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 xl:min-w-[320px]">
                                        <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Today</p>
                                            <p className="mt-1 text-sm font-semibold text-white">{format(new Date(), 'EEEE, MMM d')}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Hospital</p>
                                            <p className="mt-1 text-sm font-semibold text-white">{selectedHospitalLabel}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Consultants Today</p>
                                            <p className="mt-1 text-lg font-bold text-white">{todayConsultantCount}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Active Covers</p>
                                            <p className="mt-1 text-lg font-bold text-amber-300">{totalCoverCount}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <section className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-md lg:p-6">
                                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 pl-1">
                        <span className="material-icons text-[12px] text-primary">apps</span>
                        Quick Actions & Tools
                    </h2>
                                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                        {quickActionCount} Actions
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 2xl:grid-cols-4">
                        {/* Monthly Census */}
                        <button
                            onClick={handleOpenMonthlyCensus}
                            className="w-full text-left rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-amber-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-300 group-hover:scale-110 transition-transform shadow-inner border border-amber-500/30">
                                <span className="material-icons text-[16px]">checklist</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-bold text-amber-200 group-hover:text-white transition-colors truncate">Monthly Census</h3>
                                <p className="text-[9px] text-amber-100/70 mt-0.5 truncate">Log requirements</p>
                            </div>
                        </button>

                        <button
                            onClick={handleRadiopaediaSearch}
                            className="w-full text-left rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-violet-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/10 to-violet-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-300 group-hover:scale-110 transition-transform shadow-inner border border-violet-500/30">
                                <span className="material-icons text-[16px]">search</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-bold text-violet-200 group-hover:text-white transition-colors truncate">Search Radiopaedia</h3>
                                <p className="text-[9px] text-violet-100/70 mt-0.5 truncate">Quick case lookup</p>
                            </div>
                        </button>

                        {/* Patient Decking List */}
                        <a
                            href="https://docs.google.com/document/d/1Ii3VB-9oJFwKHV55Hf97-ncDVLi1FoRjTcb_QWQMuFI/edit?ouid=106573662772064075580&usp=docs_home&ths=true"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-left rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-blue-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 group-hover:scale-110 transition-transform shadow-inner border border-blue-500/30">
                                <span className="material-icons text-[16px]">description</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-bold text-blue-200 group-hover:text-white transition-colors truncate">Decking List</h3>
                                <p className="text-[9px] text-blue-100/70 mt-0.5 truncate">Live Updates</p>
                            </div>
                        </a>

                        {/* Doctors on Leave */}
                        <a
                            href="https://docs.google.com/spreadsheets/u/0/d/1zlSKOCLmBmvrxZqoPKUysf3RcNpLQQoB/htmlview#gid=799246403"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-left rounded-xl border border-lime-500/20 bg-lime-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-lime-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-lime-500/0 via-lime-500/10 to-lime-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-lime-500/20 flex items-center justify-center text-lime-300 group-hover:scale-110 transition-transform shadow-inner border border-lime-500/30">
                                <span className="material-icons text-[16px]">event_busy</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-bold text-lime-200 group-hover:text-white transition-colors truncate">On Leave</h3>
                                <p className="text-[9px] text-lime-100/70 mt-0.5 truncate">March 2026</p>
                            </div>
                        </a>

                        {/* Needle Navigator */}
                        {needleNavigatorEnabled && (
                            <button
                                onClick={() => setIsNeedleNavigatorOpen(true)}
                                className="w-full text-left rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-rose-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/10 to-rose-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <div className="w-8 h-8 shrink-0 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-300 group-hover:scale-110 transition-transform shadow-inner border border-rose-500/30">
                                    <span className="material-icons text-[16px]">sports_esports</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xs font-bold text-rose-200 truncate">Needle Game</h3>
                                    <p className="text-[9px] text-rose-100/70 mt-0.5 truncate">Best: {Math.round(needleStats?.best_score ?? 0)}</p>
                                </div>
                            </button>
                        )}

                        {pickleballEnabled && (
                            <button
                                onClick={() => setIsPickleballOpen(true)}
                                className="w-full text-left glass-card-enhanced p-2.5 rounded-xl border border-emerald-500/20 flex items-center gap-2.5 group hover:bg-emerald-500/10 transition-all active:scale-[0.99] relative overflow-hidden bg-emerald-500/5"
                            >
                                <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300 group-hover:scale-110 transition-transform shadow-inner border border-emerald-500/30">
                                    <span className="material-icons text-[16px]">sports_tennis</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xs font-bold text-emerald-200 truncate">Pickleball Rally</h3>
                                    <p className="text-[9px] text-slate-400 mt-0.5 truncate">Best: {Math.round(pickleballStats?.best_score ?? 0)}</p>
                                </div>
                            </button>
                        )}

                        {isRoleLoading && (
                            <div className="w-full rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2.5 flex items-center gap-2.5 relative overflow-hidden animate-pulse">
                                <div className="w-8 h-8 shrink-0 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30" />
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="h-3 w-24 rounded bg-fuchsia-200/20" />
                                    <div className="h-2 w-20 rounded bg-fuchsia-100/20" />
                                </div>
                            </div>
                        )}

                        {!isRoleLoading && canOpenEndorsements && (
                            <button
                                onClick={() => onOpenResidentEndorsements?.()}
                                className="w-full text-left rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-fuchsia-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/10 to-fuchsia-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <div className="w-8 h-8 shrink-0 rounded-lg bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-300 group-hover:scale-110 transition-transform shadow-inner border border-fuchsia-500/30">
                                    <span className="material-icons text-[16px]">forum</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xs font-bold text-fuchsia-200 group-hover:text-white transition-colors truncate">Endorsements</h3>
                                    <p className="text-[9px] text-fuchsia-100/70 mt-0.5 truncate">After-duty handoff</p>
                                </div>
                            </button>
                        )}
                                </div>
                            </section>
                        </div>

                        <aside className="space-y-5">
                            <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-md lg:p-6">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Coverage Context</p>
                                        <h2 className="mt-1 text-lg font-bold text-white">{selectedHospitalLabel}</h2>
                                    </div>
                                    <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                        {currentDayName}
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                    <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Modalities</p>
                                        <p className="mt-1 text-xl font-bold text-white">{hospitalModalities.length}</p>
                                        <p className="mt-1 text-xs text-slate-400">Active sections for this site</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Expanded Section</p>
                                        <p className="mt-1 text-sm font-semibold text-white">{expandedModality ? hospitalModalities.find((modality) => modality.id === expandedModality)?.name || 'Selected' : 'None'}</p>
                                        <p className="mt-1 text-xs text-slate-400">Tap a modality to review weekly schedules</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3 sm:col-span-2 xl:col-span-1">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Coverage Notes</p>
                                        <div className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                                            <p>Collapsed cards show today's staffing only for faster scanning.</p>
                                            <p>Expanded mode reveals the full week so pending cover issues are easier to inspect.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-md lg:p-6">
                                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Hospital Switcher</p>
                                <div className="flex bg-black/40 p-1.5 rounded-[1.25rem] border border-white/5 backdrop-blur-md shadow-inner">
                                    {CONSULTANT_SCHEDULE.map((hospital) => (
                                        <button
                                            key={hospital.id}
                                            onClick={() => setSelectedHospitalId(hospital.id)}
                                            className={`flex-1 py-3 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all duration-300 relative z-10 ${selectedHospitalId === hospital.id
                                                ? 'bg-primary text-white shadow-[0_4px_12px_rgba(13,162,231,0.3)]'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                }`}
                                        >
                                            {hospital.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    </div>

                {/* Schedule Content */}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {selectedHospital && (
                        selectedHospital.modalities.map((modality) => {
                            const todaySchedule = modality.schedule[currentDayName] || [];
                            const isExpanded = expandedModality === modality.id;

                            // Calculate active covers count for badge
                            let activeCoverCount = 0;
                            const daysToCheck = isExpanded ? daysOfWeek : [currentDayName];

                            daysToCheck.forEach(day => {
                                const daySched = modality.schedule[day] || [];
                                daySched.forEach((_, idx) => {
                                    const slotId = getSlotId(selectedHospital.id, modality.id, day, idx);
                                    if (coverOverrides[slotId]?.length > 0) activeCoverCount++;
                                });
                            });


                            return (
                                <div
                                    key={modality.id}
                                    className={`w-full h-fit text-left rounded-2xl backdrop-blur-md border overflow-hidden transition-all duration-500 opacity-95 ${isExpanded ? 'ring-1 ring-sky-500/30 bg-black/60 border-white/10 shadow-lg xl:col-span-2 2xl:col-span-3' : 'bg-black/40 border-white/5 hover:bg-white/[0.03]'
                                        }`}
                                >
                                    {/* Accordion Header */}
                                    <button
                                        onClick={() => toggleModality(modality.id)}
                                        onTouchEnd={(e) => e.currentTarget.blur()}
                                        className="w-full p-4 flex items-center justify-between select-none touch-manipulation [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-inner mt-0.5 border ${isExpanded ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]' : 'bg-black/40 text-slate-400 border-white/5'
                                                }`}>
                                                <span className="material-icons text-2xl">{modality.icon}</span>
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`text-sm font-bold transition-colors ${isExpanded ? 'text-white' : 'text-slate-300'}`}>
                                                    {modality.name}
                                                </h3>
                                                <p className="text-[10px] text-slate-500">
                                                    {isExpanded ? 'Full Weekly Schedule' : 'Today\'s Consultants'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {activeCoverCount > 0 && (
                                                <div className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                    <span className="text-[9px] font-bold text-amber-500">{activeCoverCount} Cover{activeCoverCount > 1 ? 's' : ''}</span>
                                                </div>
                                            )}
                                            <span className={`material-icons text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                keyboard_arrow_down
                                            </span>
                                        </div>
                                    </button>

                                    {/* COLLAPSED: Today's View */}
                                    {!isExpanded && (
                                        <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1">
                                            <div className=""> {/* Removed pl indentation */}
                                                {todaySchedule.length > 0 ? (
                                                    todaySchedule.map((item, idx) => {
                                                        const slotId = getSlotId(selectedHospital.id, modality.id, currentDayName, idx);
                                                        const activeCovers = coverOverrides[slotId] || [];
                                                        const hasCovers = activeCovers.length > 0;
                                                        const uniqueScopes = Array.from(
                                                            new Set(activeCovers.map((cover) => (cover.scope || 'All').trim() || 'All'))
                                                        );

                                                        return (
                                                            <div
                                                                key={idx}
                                                                onClick={(e) => handleCardClick(e, slotId, item.doctor, item.time, hasCovers)}
                                                                className={`relative group rounded-xl border transition-all cursor-pointer mb-2 last:mb-0 p-2.5 pt-3 select-none touch-manipulation [-webkit-tap-highlight-color:transparent] ${hasCovers
                                                                    ? 'bg-sky-500/[0.08] border-sky-500/30 shadow-[0_4px_24px_-8px_rgba(14,165,233,0.25)]'
                                                                    : 'bg-white/[0.03] border-white/5 hover:border-white/10 hover:bg-white/[0.05]'
                                                                    }`}
                                                            >
                                                                {/* Interactive Shine Effect */}
                                                                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none"></div>

                                                                <div className="p-2">
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${hasCovers ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 bg-white/10'
                                                                                }`}>
                                                                                {item.time}
                                                                            </span>
                                                                            {item.subtext && <span className="text-[9px] text-slate-500">{item.subtext}</span>}
                                                                        </div>

                                                                        <button
                                                                            className="w-6 h-6 rounded-full flex items-center justify-center bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                                                                            onClick={(e) => handleEditClick(e, slotId, item.doctor, item.time)}
                                                                            title="Manage Covers"
                                                                        >
                                                                            <span className="material-icons text-[12px]">edit</span>
                                                                        </button>
                                                                    </div>

                                                                    <div className="flex items-center justify-between relative min-h-[20px]">
                                                                        {!hasCovers ? (
                                                                            <div className="text-sm font-bold text-slate-200">
                                                                                {item.doctor}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col gap-1.5 w-full pr-14">
                                                                                {activeCovers.map((cover) => (
                                                                                    <div key={cover.id} className="flex items-center flex-wrap gap-2">
                                                                                        <span className={`text-[13px] font-bold whitespace-nowrap ${cover.readStatus === 'complete' ? 'text-emerald-400' :
                                                                                            cover.readStatus === 'partial' ? 'text-amber-400' : 'text-rose-400'
                                                                                            }`}>
                                                                                            {cover.doctorName}
                                                                                        </span>
                                                                                        <span
                                                                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${cover.scope === SCOPE_REMAINING
                                                                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                                                                                : (!cover.scope || cover.scope === 'All')
                                                                                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                                                                                    : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                                                                                                }`}
                                                                                            title={cover.scope || 'All'}
                                                                                        >
                                                                                            {cover.scope || 'All'}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}

                                                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                                                            {hasCovers && (
                                                                                <span className="text-[9px] text-slate-400 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity pr-3">
                                                                                    Details
                                                                                    <span className="material-icons text-[12px]">chevron_right</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-[10px] text-slate-600 italic py-2">No schedule for today</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* EXPANDED: Full Week Schedule */}
                                    {isExpanded && (
                                        <div className="border-t border-white/5 bg-black/20">
                                            {daysOfWeek.map((day) => {
                                                const daySchedule = modality.schedule[day] || [];
                                                if (daySchedule.length === 0) return null;
                                                const isToday = day === currentDayName;

                                                return (
                                                    <div key={day} className={`p-4 grid grid-cols-12 gap-3 border-b border-white/5 last:border-0 ${isToday ? 'bg-rose-500/5' : ''}`}>
                                                        <div className="col-span-3 pt-1">
                                                            <span className={`text-[9px] font-bold uppercase tracking-wider block ${isToday ? 'text-rose-400' : 'text-slate-500'}`}>
                                                                {day.substring(0, 3)}
                                                            </span>
                                                            {isToday && <span className="text-[8px] text-rose-500/70 font-bold uppercase tracking-widest mt-0.5">Today</span>}
                                                        </div>

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

                                                                        {hasCovers && (
                                                                            <div className="space-y-2 mt-1 bg-white/5 rounded-lg p-2 border border-white/5">
                                                                                {activeCovers.map((cover) => (
                                                                                    <div key={cover.id} className="flex items-center justify-between">
                                                                                        <div className="flex flex-col">
                                                                                            <span className={`text-xs font-bold ${cover.readStatus === 'complete' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                                                                {cover.doctorName}
                                                                                            </span>
                                                                                            {cover.scope !== 'All' && (
                                                                                                <span className="text-[8px] text-slate-500">
                                                                                                    {cover.scope}
                                                                                                </span>
                                                                                            )}
                                                                                            {cover.informed && cover.informedBy && (
                                                                                                <span className="text-[7px] text-slate-600 block leading-tight mt-0.5">
                                                                                                    by {cover.informedBy.includes('-') ? (profiles[cover.informedBy]?.nickname || 'User') : cover.informedBy.split('@')[0]}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 scale-90 origin-right">
                                                                                            <button
                                                                                                onClick={(e) => toggleStatus(e, slotId, cover.id, 'informed')}
                                                                                                className={`w-6 h-6 flex items-center justify-center rounded-full border transition-all ${cover.informed ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 border-white/10 text-slate-400'
                                                                                                    }`}
                                                                                            >
                                                                                                <span className="material-icons text-[10px]">
                                                                                                    {cover.informed ? 'mark_chat_read' : 'chat_bubble_outline'}
                                                                                                </span>
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={(e) => toggleStatus(e, slotId, cover.id, 'read')}
                                                                                                className={`h-6 px-1.5 flex items-center gap-1 rounded-full border transition-all text-[8px] font-bold uppercase ${cover.readStatus === 'complete' ? 'bg-emerald-500 text-white border-emerald-500' :
                                                                                                    cover.readStatus === 'partial' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' :
                                                                                                        'bg-white/5 border-white/10 text-slate-400'
                                                                                                    }`}
                                                                                            >
                                                                                                <span className="material-icons text-[10px]">
                                                                                                    {cover.readStatus === 'complete' ? 'check' : cover.readStatus === 'partial' ? 'hourglass_top' : 'circle'}
                                                                                                </span>
                                                                                            </button>
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


            </div>

            {/* Manage Covers Modal */}
            <ManageCoversModal
                isOpen={manageModalData.isOpen}
                onClose={() => setManageModalData(prev => ({ ...prev, isOpen: false }))}
                onSave={handleSaveCovers}
                initialCovers={coverOverrides[manageModalData.slotId] || []}
                originalDoctor={manageModalData.originalDoctor}
                timeSlot={manageModalData.timeSlot}
            />

            {/* Cover Details Modal */}
            <CoverDetailsModal
                isOpen={detailsModalData.isOpen}
                onClose={() => setDetailsModalData(prev => ({ ...prev, isOpen: false }))}
                slotId={detailsModalData.slotId}
                covers={coverOverrides[detailsModalData.slotId] || []}
                originalDoctor={detailsModalData.originalDoctor}
                timeSlot={detailsModalData.timeSlot}
                profiles={profiles}
                currentUser={currentUser}
                onToggleStatus={toggleStatus}
                onAddLog={handleAddLog}
                onEdit={(e) => {
                    setDetailsModalData(prev => ({ ...prev, isOpen: false }));
                    setManageModalData({
                        isOpen: true,
                        slotId: detailsModalData.slotId,
                        originalDoctor: detailsModalData.originalDoctor,
                        timeSlot: detailsModalData.timeSlot
                    });
                }}
            />

            {needleNavigatorEnabled && isNeedleNavigatorOpen && (
                <NeedleNavigatorGame
                    userId={currentUser?.id || null}
                    onClose={() => setIsNeedleNavigatorOpen(false)}
                />
            )}
            {pickleballEnabled && isPickleballOpen && (
                <PickleballRallyGame
                    userId={currentUser?.id || null}
                    onClose={() => setIsPickleballOpen(false)}
                />
            )}
            </div>
        </PageShell>
    );
};

export default ResidentsCornerScreen;


