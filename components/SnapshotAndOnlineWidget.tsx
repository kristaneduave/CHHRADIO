import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { DashboardSnapshotData, Screen, UserRole } from '../types';
import { fetchDashboardSnapshot, markSnapshotSectionSeen } from '../services/dashboardSnapshotService';
import { DutyRosterUpsertEntry, upsertDutyRosterForDate } from '../services/dutyRosterService';
import LoadingState from './LoadingState';
import { toastError, toastSuccess } from '../utils/toast';

interface SnapshotAndOnlineWidgetProps {
  onNavigate: (screen: Screen, entityId?: string | null) => void;
}

interface DutyDraftEntry {
  id?: string;
  displayName: string;
  role: string;
}

const SnapshotAndOnlineWidget: React.FC<SnapshotAndOnlineWidgetProps> = ({ onNavigate }) => {
  const SNAPSHOT_STALE_MS = 60_000;

  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [snapshotData, setSnapshotData] = useState<DashboardSnapshotData | null>(null);
  const [snapshotErrors, setSnapshotErrors] = useState<
    Partial<Record<'announcements' | 'cases' | 'calendar' | 'leaveToday' | 'onDuty' | 'auth', string>>
  >({});
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [todayExamCount, setTodayExamCount] = useState(0);
  const [isDutyEditorOpen, setIsDutyEditorOpen] = useState(false);
  const [dutyDraft, setDutyDraft] = useState<DutyDraftEntry[]>([]);
  const [savingDuty, setSavingDuty] = useState(false);

  const canEditDuty = userRole === 'admin' || userRole === 'moderator';
  const snapshotHasLeave = (snapshotData?.leaveToday.length || 0) > 0;
  const snapshotHasEvents = todayEventCount > 0;
  const snapshotHasExams = todayExamCount > 0;
  const snapshotHasCards = snapshotHasLeave || snapshotHasEvents || snapshotHasExams;
  const hasDutyRoster = (snapshotData?.onDutyToday.length || 0) > 0;

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user?.id) return;
      setUserId(data.user.id);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      setUserRole((profileData?.role as UserRole | undefined) || null);
    };
    init().catch((err) => console.error('Failed to initialize dashboard widget:', err));
  }, []);

  useEffect(() => {
    if (!userId) return;
    refreshSnapshot(userId).catch((err) => console.error('Snapshot refresh failed:', err));

    const poll = setInterval(() => {
      refreshSnapshot(userId).catch((err) => console.error('Snapshot refresh failed:', err));
    }, SNAPSHOT_STALE_MS);

    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refreshSnapshot = async (uid: string) => {
    if (!uid) return;
    try {
      setSnapshotLoading(true);
      const [{ data, sectionErrors }, todayEventsResult] = await Promise.all([
        fetchDashboardSnapshot(),
        (() => {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const end = new Date();
          end.setHours(23, 59, 59, 999);
          return supabase
            .from('events')
            .select('id,event_type,start_time,end_time')
            .lte('start_time', end.toISOString())
            .gte('end_time', start.toISOString());
        })(),
      ]);
      setSnapshotData(data);
      const mergedErrors: Partial<Record<'announcements' | 'cases' | 'calendar' | 'leaveToday' | 'onDuty' | 'auth', string>> = {
        auth: sectionErrors.auth,
        leaveToday: sectionErrors.leaveToday,
        onDuty: sectionErrors.onDuty,
      };
      if (todayEventsResult.error) {
        mergedErrors.calendar = mergedErrors.calendar || 'Unable to load today events.';
        setTodayEventCount(0);
        setTodayExamCount(0);
      } else {
        const rows = todayEventsResult.data || [];
        const exams = rows.filter((row: any) => String(row.event_type || '').toLowerCase() === 'exam').length;
        const nonLeaveNonExam = rows.filter((row: any) => {
          const type = String(row.event_type || '').toLowerCase();
          return type !== 'leave' && type !== 'exam';
        }).length;
        setTodayExamCount(exams);
        setTodayEventCount(nonLeaveNonExam);
      }
      setSnapshotErrors(mergedErrors);
    } catch (error) {
      console.error('Error loading today snapshot:', error);
      setSnapshotErrors((prev) => ({ ...prev, auth: 'Unable to load snapshot.' }));
    } finally {
      setSnapshotLoading(false);
    }
  };

  const navigateFromSnapshot = (screen: Screen, section: 'announcements' | 'cases' | 'calendar') => {
    markSnapshotSectionSeen(section);
    refreshSnapshot(userId).catch((err) => console.error('Snapshot refresh failed:', err));
    onNavigate(screen, null);
  };

  const openDutyEditor = () => {
    const seed = (snapshotData?.onDutyToday || []).map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      role: entry.role || '',
    }));
    setDutyDraft(seed);
    setIsDutyEditorOpen(true);
  };

  const addDutyRow = () => {
    setDutyDraft((prev) => [...prev, { displayName: '', role: '' }]);
  };

  const updateDutyRow = (index: number, patch: Partial<DutyDraftEntry>) => {
    setDutyDraft((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeDutyRow = (index: number) => {
    setDutyDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveDutyRoster = async () => {
    const normalized = dutyDraft
      .map((entry) => ({
        id: entry.id,
        displayName: entry.displayName.trim(),
        role: entry.role.trim(),
      }))
      .filter((entry) => Boolean(entry.displayName));

    const seen = new Set<string>();
    for (const entry of normalized) {
      const key = entry.displayName.toLowerCase();
      if (seen.has(key)) {
        toastError('Duplicate name', `${entry.displayName} appears more than once.`);
        return;
      }
      seen.add(key);
    }

    try {
      setSavingDuty(true);
      const saved = await upsertDutyRosterForDate(
        new Date(),
        normalized.map(
          (entry): DutyRosterUpsertEntry => ({
            id: entry.id,
            displayName: entry.displayName,
            role: entry.role || null,
          }),
        ),
      );

      setSnapshotData((prev) => {
        if (!prev) return prev;
        return { ...prev, onDutyToday: saved };
      });

      setIsDutyEditorOpen(false);
      toastSuccess('On-duty roster updated');
    } catch (error: any) {
      console.error('Failed to save duty roster:', error);
      toastError('Could not save roster', error?.message || 'Please try again.');
    } finally {
      setSavingDuty(false);
    }
  };

  return (
    <div className="mt-6 p-5 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-lg shadow-black/20 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-xl text-primary">
            <span className="material-icons text-xl">dataset</span>
          </div>
          <h3 className="text-white text-lg font-bold tracking-tight">Department Overview</h3>
        </div>
        <button
          onClick={() => refreshSnapshot(userId)}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          disabled={snapshotLoading}
        >
          <span className={`material-icons text-sm ${snapshotLoading ? 'animate-spin' : ''}`}>sync</span>
        </button>
      </div>

      <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="material-icons text-[14px]">today</span>
            Today's Schedule
          </h4>
        </div>

        {snapshotLoading ? (
          <LoadingState title="Loading schedule..." compact />
        ) : (
          <div className="space-y-2.5">
            {todayEventCount > 0 && (
              <button
                onClick={() => navigateFromSnapshot('calendar', 'calendar')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary-light group-hover:bg-primary/20 transition-colors">
                    <span className="material-icons text-[18px]">event</span>
                  </div>
                  <span className="text-[14px] font-semibold text-slate-200 group-hover:text-white transition-colors">Events Today</span>
                </div>
                <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-[13px] font-bold text-white group-hover:bg-primary group-hover:text-black transition-colors">{todayEventCount}</span>
              </button>
            )}

            {todayExamCount > 0 && (
              <button
                onClick={() => navigateFromSnapshot('calendar', 'calendar')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                    <span className="material-icons text-[18px]">assignment</span>
                  </div>
                  <span className="text-[14px] font-semibold text-slate-200 group-hover:text-white transition-colors">Exams Today</span>
                </div>
                <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-[13px] font-bold text-white group-hover:bg-emerald-400 group-hover:text-black transition-colors">{todayExamCount}</span>
              </button>
            )}

            {snapshotHasLeave && (
              <button
                onClick={() => navigateFromSnapshot('calendar', 'calendar')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                    <span className="material-icons text-[18px]">flight_takeoff</span>
                  </div>
                  <span className="text-[14px] font-semibold text-slate-200 group-hover:text-white transition-colors">On Leave</span>
                </div>
                <div className="flex -space-x-2">
                  {snapshotData?.leaveToday.slice(0, 3).map((leave, i) => (
                    <div key={i} className="w-7 h-7 rounded-full bg-amber-500/20 border-2 border-[#1c1c1e] flex items-center justify-center text-[10px] font-bold text-amber-500 z-10">
                      {leave.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {(snapshotData?.leaveToday.length || 0) > 3 && (
                    <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-[#1c1c1e] flex items-center justify-center text-[10px] font-bold text-slate-400 z-0">
                      +{(snapshotData?.leaveToday.length || 0) - 3}
                    </div>
                  )}
                </div>
              </button>
            )}

            {!snapshotHasCards && !snapshotErrors.calendar && (
              <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-white/5 border-dashed bg-white/[0.02]">
                <span className="material-icons text-slate-500/50 mb-2 text-3xl">event_available</span>
                <p className="text-[13px] font-medium text-slate-400 text-center">No schedule for today</p>
              </div>
            )}

            {(snapshotErrors.calendar || snapshotErrors.leaveToday) && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/10">
                <span className="material-icons text-red-400 text-lg">error_outline</span>
                <p className="text-[12px] text-red-200">Could not load schedule perfectly.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="material-icons text-[14px]">badge</span>
            On Duty Today
          </h4>
          {canEditDuty && (
            <button
              onClick={openDutyEditor}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border border-primary/30 bg-primary/10 text-primary-light hover:bg-primary/20 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {hasDutyRoster ? (
          <div className="flex flex-wrap gap-2.5">
            {(snapshotData?.onDutyToday || []).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 pr-3 pl-1 py-1 shadow-sm"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700/80 text-[11px] font-bold text-slate-200 border border-white/20">
                  {entry.displayName.trim().charAt(0).toUpperCase() || 'U'}
                </span>
                <span className="text-[13px] font-medium text-slate-200">{entry.displayName}</span>
                {entry.role && <span className="text-[11px] text-slate-400 uppercase tracking-wide">{entry.role}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-white/5 border-dashed bg-white/[0.02]">
            <span className="material-icons text-slate-500/50 mb-2 text-3xl">person_off</span>
            <p className="text-[13px] font-medium text-slate-400 text-center">No duty roster set for today.</p>
          </div>
        )}

        {snapshotErrors.onDuty && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/10">
            <span className="material-icons text-red-400 text-lg">error_outline</span>
            <p className="text-[12px] text-red-200">Could not load on-duty roster.</p>
          </div>
        )}
      </div>

      {isDutyEditorOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Edit on-duty roster"
          onClick={() => (!savingDuty ? setIsDutyEditorOpen(false) : undefined)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-base font-bold text-white">Edit On Duty Today</h5>
              <button
                onClick={() => setIsDutyEditorOpen(false)}
                disabled={savingDuty}
                className="rounded-full p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                aria-label="Close duty editor"
              >
                <span className="material-icons text-[16px]">close</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
              {dutyDraft.map((entry, index) => (
                <div key={`${entry.id || 'new'}-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                  <input
                    value={entry.displayName}
                    onChange={(event) => updateDutyRow(index, { displayName: event.target.value })}
                    placeholder="Name"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-primary/60"
                  />
                  <input
                    value={entry.role}
                    onChange={(event) => updateDutyRow(index, { role: event.target.value })}
                    placeholder="Role"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-primary/60"
                  />
                  <button
                    onClick={() => removeDutyRow(index)}
                    className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-red-300 hover:border-red-400/30 hover:bg-red-500/10 transition-colors"
                    aria-label="Remove row"
                  >
                    <span className="material-icons text-[16px]">delete</span>
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addDutyRow}
              className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/10 transition-colors"
            >
              Add Person
            </button>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setIsDutyEditorOpen(false)}
                disabled={savingDuty}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveDutyRoster}
                disabled={savingDuty}
                className="flex-1 rounded-lg border border-primary/40 bg-primary/20 py-2 text-sm font-semibold text-primary-light hover:bg-primary/30 disabled:opacity-50"
              >
                {savingDuty ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapshotAndOnlineWidget;
