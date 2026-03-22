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



    // ── Current reader helper ─────────────────────────────────
    const getCurrentReader = (modality: { id: string; name: string; icon: string; schedule: { [key: string]: { doctor: string; time: string; subtext?: string }[] } }) => {
        const todaySlots = modality.schedule[currentDayName] || [];
        if (todaySlots.length === 0) return null;

        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        const parseTime = (t: string): number => {
            // Handle 'AM', 'PM', 'AM-PM' shorthand
            const trimmed = t.trim().toUpperCase();
            if (trimmed === 'AM') return 6 * 60; // 6 AM
            if (trimmed === 'PM') return 12 * 60; // 12 PM
            if (trimmed === 'AM-PM') return 6 * 60; // start of day

            // Handle '12:00 NN' = noon
            const nnMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*NN$/);
            if (nnMatch) return 12 * 60 + parseInt(nnMatch[2]);

            // Handle '7:01 AM', '1:00 PM', '12:00 AM'
            const stdMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
            if (stdMatch) {
                let h = parseInt(stdMatch[1]);
                const m = parseInt(stdMatch[2]);
                const ampm = stdMatch[3];
                if (ampm === 'AM' && h === 12) h = 0;
                if (ampm === 'PM' && h !== 12) h += 12;
                return h * 60 + m;
            }

            // Handle bare '7:01' — assume AM
            const bareMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
            if (bareMatch) {
                return parseInt(bareMatch[1]) * 60 + parseInt(bareMatch[2]);
            }

            return -1; // unparseable
        };

        for (const slot of todaySlots) {
            const parts = slot.time.split('-').map(s => s.trim());
            if (parts.length === 2) {
                const start = parseTime(parts[0]);
                const end = parseTime(parts[1]);
                if (start < 0 || end < 0) continue;

                // Handle overnight shifts (end < start)
                if (end <= start) {
                    // e.g. 8:01 PM - 7:00 AM
                    if (nowMinutes >= start || nowMinutes < end) return slot.doctor;
                } else {
                    if (nowMinutes >= start && nowMinutes < end) return slot.doctor;
                }
            } else {
                // Single token like 'AM-PM' — all day
                return slot.doctor;
            }
        }
        // Fallback: return first slot if nothing matched
        return todaySlots[0]?.doctor || null;
    };

    const sidebarCards = (
        <>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest text-slate-300">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        Current Readers
                    </h3>
                    <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-black text-sky-400 shadow-sm">
                        {currentDayName}
                    </span>
                </div>
                <div className="space-y-3">
                    {hospitalModalities.map((mod) => {
                        const reader = getCurrentReader(mod);
                        const todaySlots = mod.schedule[currentDayName] || [];
                        let coveringDoctor: string | null = null;
                        todaySlots.forEach((_, idx) => {
                            const slotId = getSlotId(selectedHospital!.id, mod.id, currentDayName, idx);
                            const covers = coverOverrides[slotId] || [];
                            if (covers.length > 0) {
                                coveringDoctor = covers[covers.length - 1].doctorName;
                            }
                        });
                        const displayName = coveringDoctor || reader;
                        const isCovered = !!coveringDoctor;

                        return (
                            <div key={mod.id} className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/5">
                                    <span className="material-icons text-[14px] text-slate-400">{mod.icon}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{mod.name}</p>
                                    <p className={`mt-0.5 truncate text-[13px] font-semibold ${isCovered ? 'text-amber-300' : 'text-slate-200'}`}>
                                        {displayName || <span className="text-[12px] italic text-slate-600">No reader today</span>}
                                    </p>
                                    {isCovered && (
                                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500/70">Covering</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <p className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Quick Actions</p>

                <button
                    onClick={handleOpenMonthlyCensus}
                    className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5 text-left transition-all active:scale-[0.99] group hover:bg-amber-500/[0.12]"
                >
                    <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 transition-transform duration-1000 group-hover:translate-x-[100%]"></div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/20 text-amber-300 transition-transform group-hover:scale-110">
                        <span className="material-icons text-[14px]">checklist</span>
                    </div>
                    <h3 className="truncate text-xs font-bold text-amber-200 transition-colors group-hover:text-white">Monthly Census</h3>
                </button>

                <a
                    href="https://docs.google.com/document/d/1Ii3VB-9oJFwKHV55Hf97-ncDVLi1FoRjTcb_QWQMuFI/edit?ouid=106573662772064075580&usp=docs_home&ths=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-2.5 text-left transition-all active:scale-[0.99] group hover:bg-blue-500/[0.12]"
                >
                    <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 transition-transform duration-1000 group-hover:translate-x-[100%]"></div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/20 text-blue-300 transition-transform group-hover:scale-110">
                        <span className="material-icons text-[14px]">description</span>
                    </div>
                    <h3 className="truncate text-xs font-bold text-blue-200 transition-colors group-hover:text-white">Decking List</h3>
                </a>

                <a
                    href="https://docs.google.com/spreadsheets/u/0/d/1zlSKOCLmBmvrxZqoPKUysf3RcNpLQQoB/htmlview#gid=799246403"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-lime-500/20 bg-lime-500/[0.06] p-2.5 text-left transition-all active:scale-[0.99] group hover:bg-lime-500/[0.12]"
                >
                    <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-lime-500/0 via-lime-500/10 to-lime-500/0 transition-transform duration-1000 group-hover:translate-x-[100%]"></div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-lime-500/30 bg-lime-500/20 text-lime-300 transition-transform group-hover:scale-110">
                        <span className="material-icons text-[14px]">event_busy</span>
                    </div>
                    <h3 className="truncate text-xs font-bold text-lime-200 transition-colors group-hover:text-white">On Leave</h3>
                </a>

                {pickleballEnabled && (
                    <button
                        onClick={() => setIsPickleballOpen(true)}
                        className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5 text-left transition-all active:scale-[0.99] group hover:bg-emerald-500/10"
                    >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/20 text-emerald-300 transition-transform group-hover:scale-110">
                            <span className="material-icons text-[14px]">sports_tennis</span>
                        </div>
                        <h3 className="truncate text-xs font-bold text-emerald-200">Pickleball Rally</h3>
                    </button>
                )}

                {isRoleLoading && (
                    <div className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2.5 animate-pulse">
                        <div className="h-7 w-7 shrink-0 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/20" />
                        <div className="h-3 w-24 rounded bg-fuchsia-200/20" />
                    </div>
                )}

                {!isRoleLoading && canOpenEndorsements && (
                    <button
                        onClick={() => onOpenResidentEndorsements?.()}
                        className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2.5 text-left transition-all active:scale-[0.99] group hover:bg-fuchsia-500/[0.12]"
                    >
                        <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/10 to-fuchsia-500/0 transition-transform duration-1000 group-hover:translate-x-[100%]"></div>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/20 text-fuchsia-300 transition-transform group-hover:scale-110">
                            <span className="material-icons text-[14px]">forum</span>
                        </div>
                        <h3 className="truncate text-xs font-bold text-fuchsia-200 transition-colors group-hover:text-white">Endorsements</h3>
                    </button>
                )}
            </div>
        </>
    );

    return (
        <PageShell layoutMode="wide" contentClassName="pt-6">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen bg-app">
                <div className="mx-auto w-full max-w-7xl space-y-6">
                    {/* ── Header: bare on background like Newsfeed ── */}
                    <div className="px-1">
                        <h1 className="text-3xl font-bold text-white md:text-4xl">Resident HQ</h1>
                    </div>

                    {/* ── Hospital Switcher: tab bar like Newsfeed's Notifications/Activity ── */}
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



                    {/* ── Schedule + Sidebar ── */}
                    <div className="xl:grid xl:grid-cols-[minmax(0,1.65fr)_320px] xl:items-start xl:gap-8">
                        <div className="min-w-0">
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
                                    className={`w-full h-fit text-left rounded-2xl backdrop-blur-md border overflow-hidden transition-all duration-500 opacity-95 ${isExpanded ? 'ring-1 ring-sky-500/30 bg-black/60 border-white/10 shadow-lg xl:col-span-2 2xl:col-span-3' : 'bg-black/40 border-white/5'
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

                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {activeCoverCount > 0 && (
                                                <div className="px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                                                    <span className="text-[8px] font-bold text-amber-400">{activeCoverCount}</span>
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
                                                                    : 'bg-white/[0.03] border-white/5'
                                                                    }`}
                                                            >


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

                        {/* ── Right sidebar ── */}
                        <aside className="hidden xl:block xl:sticky xl:top-2 px-2 space-y-5">

                            {/* Current Readers — with cover override */}
                            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-2.5">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Current Readers
                                    </h3>
                                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-[10px] font-black text-sky-400 border border-sky-500/20 shadow-sm">
                                        {currentDayName}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {hospitalModalities.map((mod) => {
                                        const reader = getCurrentReader(mod);
                                        // Find if there's an active cover for the current slot
                                        const todaySlots = mod.schedule[currentDayName] || [];
                                        let coveringDoctor: string | null = null;
                                        todaySlots.forEach((_, idx) => {
                                            const slotId = getSlotId(selectedHospital!.id, mod.id, currentDayName, idx);
                                            const covers = coverOverrides[slotId] || [];
                                            if (covers.length > 0) {
                                                coveringDoctor = covers[covers.length - 1].doctorName;
                                            }
                                        });
                                        const displayName = coveringDoctor || reader;
                                        const isCovered = !!coveringDoctor;
                                        return (
                                            <div key={mod.id} className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0 mt-0.5">
                                                    <span className="material-icons text-[14px] text-slate-400">{mod.icon}</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{mod.name}</p>
                                                    <p className={`text-[13px] font-semibold truncate mt-0.5 ${isCovered ? 'text-amber-300' : 'text-slate-200'}`}>
                                                        {displayName || <span className="text-slate-600 italic text-[12px]">No reader today</span>}
                                                    </p>
                                                    {isCovered && (
                                                        <p className="text-[9px] text-amber-500/70 font-bold uppercase tracking-wider mt-0.5">Covering</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Quick Actions — 1 column */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 px-1">Quick Actions</p>

                                <button
                                    onClick={handleOpenMonthlyCensus}
                                    className="w-full text-left rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-amber-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                    <div className="w-7 h-7 shrink-0 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-300 group-hover:scale-110 transition-transform border border-amber-500/30">
                                        <span className="material-icons text-[14px]">checklist</span>
                                    </div>
                                    <h3 className="text-xs font-bold text-amber-200 group-hover:text-white transition-colors truncate">Monthly Census</h3>
                                </button>

                                <a
                                    href="https://docs.google.com/document/d/1Ii3VB-9oJFwKHV55Hf97-ncDVLi1FoRjTcb_QWQMuFI/edit?ouid=106573662772064075580&usp=docs_home&ths=true"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full text-left rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-blue-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                    <div className="w-7 h-7 shrink-0 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 group-hover:scale-110 transition-transform border border-blue-500/30">
                                        <span className="material-icons text-[14px]">description</span>
                                    </div>
                                    <h3 className="text-xs font-bold text-blue-200 group-hover:text-white transition-colors truncate">Decking List</h3>
                                </a>

                                <a
                                    href="https://docs.google.com/spreadsheets/u/0/d/1zlSKOCLmBmvrxZqoPKUysf3RcNpLQQoB/htmlview#gid=799246403"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full text-left rounded-xl border border-lime-500/20 bg-lime-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-lime-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-lime-500/0 via-lime-500/10 to-lime-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                    <div className="w-7 h-7 shrink-0 rounded-lg bg-lime-500/20 flex items-center justify-center text-lime-300 group-hover:scale-110 transition-transform border border-lime-500/30">
                                        <span className="material-icons text-[14px]">event_busy</span>
                                    </div>
                                    <h3 className="text-xs font-bold text-lime-200 group-hover:text-white transition-colors truncate">On Leave</h3>
                                </a>

                                {pickleballEnabled && (
                                    <button
                                        onClick={() => setIsPickleballOpen(true)}
                                        className="w-full text-left rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5 flex items-center gap-2.5 group hover:bg-emerald-500/10 transition-all active:scale-[0.99] relative overflow-hidden"
                                    >
                                        <div className="w-7 h-7 shrink-0 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300 group-hover:scale-110 transition-transform border border-emerald-500/30">
                                            <span className="material-icons text-[14px]">sports_tennis</span>
                                        </div>
                                        <h3 className="text-xs font-bold text-emerald-200 truncate">Pickleball Rally</h3>
                                    </button>
                                )}

                                {isRoleLoading && (
                                    <div className="w-full rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2.5 flex items-center gap-2.5 relative overflow-hidden animate-pulse">
                                        <div className="w-7 h-7 shrink-0 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30" />
                                        <div className="h-3 w-24 rounded bg-fuchsia-200/20" />
                                    </div>
                                )}

                                {!isRoleLoading && canOpenEndorsements && (
                                    <button
                                        onClick={() => onOpenResidentEndorsements?.()}
                                        className="w-full text-left rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2.5 flex items-center gap-2.5 group hover:bg-fuchsia-500/[0.12] transition-all active:scale-[0.99] relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/10 to-fuchsia-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                        <div className="w-7 h-7 shrink-0 rounded-lg bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-300 group-hover:scale-110 transition-transform border border-fuchsia-500/30">
                                            <span className="material-icons text-[14px]">forum</span>
                                        </div>
                                        <h3 className="text-xs font-bold text-fuchsia-200 group-hover:text-white transition-colors truncate">Endorsements</h3>
                                    </button>
                                )}
                            </div>
                        </aside>
                    </div>

                </div>
            </div>

            <div className="mx-auto w-full max-w-7xl xl:hidden">
                <div className="mobile-action-zone-clearance mt-6 rounded-[2rem] border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl shadow-lg">
                    <div className="space-y-4">
                        {sidebarCards}
                    </div>
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
        </PageShell>
    );
};

export default ResidentsCornerScreen;


