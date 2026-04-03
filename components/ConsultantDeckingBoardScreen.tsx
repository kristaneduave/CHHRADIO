import React from 'react';
import {
  ConsultantDeckingDifficulty,
  ConsultantDeckingEntry,
  ConsultantDeckingLane,
  ConsultantDeckingLaneId,
  ConsultantDeckingPatientSource,
  ConsultantDeckingPriority,
  ConsultantDeckingTab,
  ConsultantDeckingTabId,
} from '../types';
import {
  __testables,
  archiveConsultantDeckingLane,
  createArchivedDeckingSession,
  createConsultantDeckingEntry,
  createConsultantDeckingLane,
  deleteConsultantDeckingEntry,
  listArchivedDeckingSessions,
  listConsultantDeckingEntries,
  listConsultantDeckingLanes,
  listConsultantDeckingTabs,
  moveConsultantDeckingEntry,
  reorderDeckingEntries,
  reorderConsultantDeckingLanes,
  reorderConsultantDeckingTabs,
  subscribeToConsultantDeckingEntries,
  updateConsultantDeckingEntry,
  updateConsultantDeckingLane,
  updateConsultantDeckingTab,
  createConsultantDeckingTab,
  type ArchivedDeckingSession,
} from '../services/consultantDeckingService';
import { toastError, toastSuccess } from '../utils/toast';
import PageHeader from './ui/PageHeader';
import PageSection from './ui/PageSection';
import PageShell from './ui/PageShell';
import ScreenStatusNotice from './ui/ScreenStatusNotice';

interface ConsultantDeckingBoardScreenProps {
  currentUserId: string | null;
  onBack: () => void;
}

type DraftState = {
  patientName: string;
  patientAge: string;
  patientSex: '' | 'M' | 'F';
  tabId: ConsultantDeckingTabId;
  difficulty: ConsultantDeckingDifficulty;
  priorityLevel: ConsultantDeckingPriority;
  patientSource: ConsultantDeckingPatientSource;
  studyDate: string;
  studyTime: string;
  studyDescription: string;
  briefImpression: string;
  laneId: ConsultantDeckingLaneId;
};

type ViewMode = 'compact' | 'detailed';
type FilterSource = ConsultantDeckingPatientSource | 'all';
type FilterDifficulty = ConsultantDeckingDifficulty | 'all';
type FilterPriority = ConsultantDeckingPriority | 'all';
type ActiveDragState = { entryId: string; sourceTabId: ConsultantDeckingTabId; sourceLaneId: ConsultantDeckingLaneId; sourceIndex: number } | null;
type DropTarget = { tabId: ConsultantDeckingTabId; laneId: ConsultantDeckingLaneId; index: number } | null;
type RecentDropState = { entryId: string; tabId: ConsultantDeckingTabId; laneId: ConsultantDeckingLaneId } | null;

const DIFFICULTY_OPTIONS: ConsultantDeckingDifficulty[] = ['easy', 'medium', 'hard'];
const PRIORITY_OPTIONS: ConsultantDeckingPriority[] = ['routine', 'priority', 'urgent', 'stat'];
const PATIENT_SOURCE_OPTIONS: ConsultantDeckingPatientSource[] = ['er', 'inpatient', 'outpatient'];
const PATIENT_SEX_OPTIONS: Array<DraftState['patientSex']> = ['M', 'F'];
const BRIEF_IMPRESSION_LIMIT = 240;
const LANE_NAME_LIMIT = 48;
const TAB_TITLE_LIMIT = 64;
const TAB_DESCRIPTION_LIMIT = 96;
const SYSTEM_TAB_IDS = new Set(['tab-1', 'tab-2', 'tab-3']);
const MAX_CONSULTANTS_ON_DECK = 4;

const STUDY_OPTION_GROUPS = [
  { label: 'CT', options: ['CT head facial', 'CT brain plain', 'CT brain with contrast', 'CT chest plain', 'CT chest with contrast', 'CT stonogram', 'CT whole abdomen plain', 'CT whole abdomen with contrast', 'CT abdomen - Urography'] },
  { label: 'MRI', options: ['MR brain plain', 'MR brain with contrast', 'MR cervical spine plain', 'MR thoracic spine plain', 'MR lumbar spine plain', 'MR pelvis plain', 'MR pelvis with contrast'] },
  { label: 'CTA / MRA', options: ['CT angiography-PE', 'CT angiography - Brain', 'CT angiography - Chest', 'MRA brain plain', 'MRA brain with contrast'] },
  { label: 'Other', options: ['Calcium score'] },
] as const;

const SOURCE_PRIORITY: Record<ConsultantDeckingPatientSource, number> = { er: 0, inpatient: 1, outpatient: 2 };
const PRIORITY_ORDER: Record<ConsultantDeckingPriority, number> = { stat: 0, urgent: 1, priority: 2, routine: 3 };
const DIFFICULTY_PRIORITY: Record<ConsultantDeckingDifficulty, number> = { hard: 0, medium: 1, easy: 2 };
const DIFFICULTY_TONE: Record<ConsultantDeckingDifficulty, string> = {
  easy: 'border-emerald-300/60 bg-emerald-400/10 text-emerald-50',
  medium: 'border-amber-300/75 bg-amber-400/10 text-amber-50',
  hard: 'border-rose-300/75 bg-rose-400/10 text-rose-50',
};
const STATUS_TONE: Record<ConsultantDeckingPatientSource, string> = {
  er: 'border-rose-300/75 bg-rose-400 text-slate-950',
  inpatient: 'border-slate-300/70 bg-slate-100 text-slate-900',
  outpatient: 'border-amber-300/75 bg-amber-300 text-amber-950',
};
const PRIORITY_TONE: Record<ConsultantDeckingPriority, string> = {
  routine: 'border-slate-300/50 bg-slate-100/10 text-slate-200',
  priority: 'border-amber-300/60 bg-amber-400/15 text-amber-100',
  urgent: 'border-orange-300/60 bg-orange-400/15 text-orange-100',
  stat: 'border-rose-300/70 bg-rose-500/20 text-rose-100',
};

const labelize = (value: string) => {
  if (value === 'er') return 'ER';
  if (value === 'outpatient') return 'OPD';
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};
const isUserCreatedTab = (tabId: string) => !SYSTEM_TAB_IDS.has(tabId);

const toLocalDateInputValue = (value: Date) => `${value.getFullYear()}-${`${value.getMonth() + 1}`.padStart(2, '0')}-${`${value.getDate()}`.padStart(2, '0')}`;
const toLocalTimeInputValue = (value: Date) => `${`${value.getHours()}`.padStart(2, '0')}:${`${value.getMinutes()}`.padStart(2, '0')}`;
const normalizeAge = (value: string) => {
  if (!value.trim()) return null;
  const numeric = Math.trunc(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};
const getInboxLaneIdForTab = (tabId: ConsultantDeckingTabId) => __testables.getInboxLaneIdForTab ? __testables.getInboxLaneIdForTab(tabId) : tabId === 'tab-1' ? 'inbox' : `inbox-${tabId}`;
const createEmptyDraft = (tabId: ConsultantDeckingTabId = 'tab-1', laneId?: ConsultantDeckingLaneId, now: Date = new Date()): DraftState => ({
  patientName: '',
  patientAge: '',
  patientSex: '',
  tabId,
  difficulty: 'medium',
  priorityLevel: 'routine',
  patientSource: 'er',
  studyDate: toLocalDateInputValue(now),
  studyTime: toLocalTimeInputValue(now),
  studyDescription: '',
  briefImpression: '',
  laneId: laneId || getInboxLaneIdForTab(tabId),
});
const formatStudyDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
};
const formatStudyDateCompact = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
};
const formatStudyTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
const formatAgeSex = (entry: Pick<ConsultantDeckingEntry, 'patientAge' | 'patientSex'>) => [typeof entry.patientAge === 'number' ? `${entry.patientAge}` : null, entry.patientSex || null].filter(Boolean).join('/') || null;
const buildSummaryLine = (entry: ConsultantDeckingEntry, index: number) => [
  `${index + 1}. ${labelize(entry.patientSource)} - ${entry.patientName}${formatAgeSex(entry) ? ` ${formatAgeSex(entry)}` : ''}`,
  `${entry.studyDescription || 'STUDY PENDING'}`,
  `${[formatStudyDateCompact(entry.studyDate), formatStudyTime(entry.studyTime)].filter(Boolean).join(' ') || 'No study schedule'}`,
].join('\n');
const sortEntriesForLane = (entries: ConsultantDeckingEntry[]) => [...entries].sort((left, right) => {
  const priorityGap = PRIORITY_ORDER[left.priorityLevel] - PRIORITY_ORDER[right.priorityLevel];
  if (priorityGap !== 0) return priorityGap;
  const leftDateTime = `${left.studyDate || ''}T${left.studyTime || ''}`;
  const rightDateTime = `${right.studyDate || ''}T${right.studyTime || ''}`;
  const dateTimeGap = leftDateTime.localeCompare(rightDateTime);
  if (dateTimeGap !== 0) return dateTimeGap;
  const sourceGap = SOURCE_PRIORITY[left.patientSource] - SOURCE_PRIORITY[right.patientSource];
  if (sourceGap !== 0) return sourceGap;
  const difficultyGap = DIFFICULTY_PRIORITY[left.difficulty] - DIFFICULTY_PRIORITY[right.difficulty];
  if (difficultyGap !== 0) return difficultyGap;
  if (left.position !== right.position) return left.position - right.position;
  return left.patientName.localeCompare(right.patientName);
});

const PatientPill: React.FC<{
  entry: ConsultantDeckingEntry;
  viewMode: ViewMode;
  onOpen: (entry: ConsultantDeckingEntry) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  isDropMarker?: boolean;
  isDragging?: boolean;
  isDropActive?: boolean;
  isRecentlyDropped?: boolean;
}> = ({ entry, viewMode, onOpen, onDragStart, onDragEnd, onDragOver, onDrop, isDropMarker = false, isDragging = false, isDropActive = false, isRecentlyDropped = false }) => {
  const isEmergency = entry.priorityLevel === 'stat' || entry.priorityLevel === 'urgent';
  const shouldSwapToImpression = entry.difficulty === 'hard' || Boolean(entry.briefImpression);
  const hoverImpressionText = entry.briefImpression || 'Not specified';
  
  return (
    <div className="space-y-1 pt-1.5">
      {isDropMarker ? <div className="h-[3px] rounded-full bg-cyan-400 shadow-[0_0_8px] shadow-cyan-400/50" /> : null}
      <div 
        role="button" 
        tabIndex={0} 
        draggable 
        onClick={() => onOpen(entry)} 
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(entry); } }} 
        onDragStart={onDragStart} 
        onDragEnd={onDragEnd} 
        onDragOver={onDragOver} 
        onDrop={onDrop} 
        className={`group flex w-full cursor-grab flex-col overflow-hidden rounded-[1.4rem] border ${isEmergency ? 'border-rose-500/30' : 'border-white/[0.08]'} bg-gradient-to-b from-[#18202b] to-[#141b24] shadow-lg text-left transition-all duration-300 hover:bg-[#1a2331] hover:shadow-2xl hover:-translate-y-[2px] ${isDragging ? 'opacity-50 blur-[1px] scale-[0.98]' : ''} ${isDropActive ? 'scale-[1.01] border-cyan-300/45 shadow-[0_16px_40px_rgba(34,211,238,0.16)]' : ''} ${isRecentlyDropped ? 'border-emerald-300/45 shadow-[0_0_0_1px_rgba(110,231,183,0.22),0_18px_42px_rgba(16,185,129,0.14)]' : ''} ${isEmergency ? 'hover:shadow-rose-500/10' : 'hover:shadow-black/50'}`} 
        aria-label={`Edit ${entry.patientName}`}
      >
        {/* Top Accent Line for Difficulty */}
        <div className={`h-1.5 w-full ${entry.difficulty === 'hard' ? 'bg-gradient-to-r from-rose-500 to-rose-400' : entry.difficulty === 'medium' ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`} />
        
        <div className="relative flex flex-col gap-2.5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-[13px] font-extrabold tracking-tight text-white drop-shadow-sm">{entry.patientName}</h4>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold text-slate-400/90">
                {formatAgeSex(entry) && <span className="flex items-center gap-1"><span className="material-icons text-[12px] text-slate-500">person</span>{formatAgeSex(entry)}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] ${STATUS_TONE[entry.patientSource]}`}>
                {labelize(entry.patientSource)}
              </span>
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] ${PRIORITY_TONE[entry.priorityLevel]}`}>
                {labelize(entry.priorityLevel)}
              </span>
            </div>
          </div>
          
          <div className="mt-0.5 rounded-[0.95rem] border border-white/[0.03] bg-black/25 px-3 py-1.5">
             <p className="line-clamp-2 text-[11px] leading-snug text-slate-300 font-medium tracking-wide transition-colors duration-200 group-hover:text-white/95">
               {shouldSwapToImpression ? (
                 <>
                   <span className="group-hover:hidden">{entry.studyDescription || 'Study pending'}</span>
                   <span className="hidden group-hover:inline">{hoverImpressionText}</span>
                 </>
               ) : (
                 entry.studyDescription || 'Study pending'
               )}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConsultantDeckingBoardScreen: React.FC<ConsultantDeckingBoardScreenProps> = ({ currentUserId, onBack }) => {
  const [tabs, setTabs] = React.useState<ConsultantDeckingTab[]>([]);
  const [lanes, setLanes] = React.useState<ConsultantDeckingLane[]>([]);
  const [entries, setEntries] = React.useState<ConsultantDeckingEntry[]>([]);
  const [activeTabId, setActiveTabId] = React.useState<ConsultantDeckingTabId>('tab-1');
  const activeTabIdRef = React.useRef(activeTabId);
  React.useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  const [draft, setDraft] = React.useState<DraftState>(() => createEmptyDraft());
  const [editingEntry, setEditingEntry] = React.useState<ConsultantDeckingEntry | null>(null);
  const [editDraft, setEditDraft] = React.useState<DraftState>(() => createEmptyDraft());
  const [tabTitleDrafts, setTabTitleDrafts] = React.useState<Record<string, string>>({});
  const [tabDescriptionDrafts, setTabDescriptionDrafts] = React.useState<Record<string, string>>({});
  const [laneLabelDrafts, setLaneLabelDrafts] = React.useState<Record<string, string>>({});
  const [newLaneName, setNewLaneName] = React.useState('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('compact');
  const [filterSource, setFilterSource] = React.useState<FilterSource>('all');
  const [filterDifficulty, setFilterDifficulty] = React.useState<FilterDifficulty>('all');
  const [filterPriority, setFilterPriority] = React.useState<FilterPriority>('all');
  const [showOnlyOccupiedLanes, setShowOnlyOccupiedLanes] = React.useState(false);
  const [collapsedLaneIds, setCollapsedLaneIds] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(Boolean(currentUserId));
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [creatingLane, setCreatingLane] = React.useState(false);
  const [showAddLane, setShowAddLane] = React.useState(false);
  const [creatingTab, setCreatingTab] = React.useState(false);
  const [newTabTitle, setNewTabTitle] = React.useState('');
  const [showAddTab, setShowAddTab] = React.useState(false);
  const [newDeckConsultants, setNewDeckConsultants] = React.useState<string[]>(['']);
  const [editingLaneId, setEditingLaneId] = React.useState<string | null>(null);
  const [savingLaneId, setSavingLaneId] = React.useState<string | null>(null);
  const [savingTabId, setSavingTabId] = React.useState<string | null>(null);
  const [activeDrag, setActiveDrag] = React.useState<ActiveDragState>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget>(null);
  const [recentDrop, setRecentDrop] = React.useState<RecentDropState>(null);
  const [archivedSessions, setArchivedSessions] = React.useState<ArchivedDeckingSession[]>([]);
  const [isArchivesOpen, setIsArchivesOpen] = React.useState(false);
  const [isLoadingArchives, setIsLoadingArchives] = React.useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = React.useState(false);
  const studyDateInputRef = React.useRef<HTMLInputElement | null>(null);
  const studyTimeInputRef = React.useRef<HTMLInputElement | null>(null);
  const refreshTimeoutRef = React.useRef<number | null>(null);
  const recentDropTimeoutRef = React.useRef<number | null>(null);

  const loadWorkspace = React.useCallback(async (options?: { force?: boolean; silent?: boolean }) => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    if (!options?.silent) setLoading(true);
    try {
      const [nextTabs, nextLanes, nextEntries] = await Promise.all([
        listConsultantDeckingTabs({ force: options?.force }),
        listConsultantDeckingLanes({ force: options?.force }),
        listConsultantDeckingEntries({ force: options?.force }),
      ]);
      const visibleTabs = nextTabs.filter((tab) => tab.isActive);
      const currentTabId = activeTabIdRef.current;
      const resolvedTabId = visibleTabs.some((tab) => tab.id === currentTabId) ? currentTabId : visibleTabs[0]?.id || 'tab-1';
      setTabs(visibleTabs);
      setLanes(nextLanes.filter((lane) => lane.isActive));
      setEntries(nextEntries);
      if (resolvedTabId !== currentTabId) setActiveTabId(resolvedTabId);
      setDraft((current) => ({
        ...current,
        tabId: resolvedTabId,
        laneId: nextLanes.some((lane) => lane.tabId === resolvedTabId && lane.id === current.laneId) ? current.laneId : getInboxLaneIdForTab(resolvedTabId),
      }));
      setTabTitleDrafts(Object.fromEntries(visibleTabs.map((tab) => [tab.id, tab.title])));
      setTabDescriptionDrafts(Object.fromEntries(visibleTabs.map((tab) => [tab.id, tab.description || ''])));
      setLaneLabelDrafts(Object.fromEntries(nextLanes.filter((lane) => lane.id !== getInboxLaneIdForTab(lane.tabId)).map((lane) => [lane.id, lane.label])));
    } catch (error: any) {
      toastError('Unable to load consultant decking', error?.message || 'Please try again.');
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [currentUserId]);

  const scheduleWorkspaceRefresh = React.useCallback((options?: { force?: boolean; silent?: boolean; delayMs?: number }) => {
    if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = window.setTimeout(() => {
      React.startTransition(() => {
        void loadWorkspace({ force: options?.force, silent: options?.silent });
      });
      refreshTimeoutRef.current = null;
    }, options?.delayMs ?? 120);
  }, [loadWorkspace]);

  const markRecentDrop = React.useCallback((entryId: string, tabId: ConsultantDeckingTabId, laneId: ConsultantDeckingLaneId) => {
    setRecentDrop({ entryId, tabId, laneId });
    if (recentDropTimeoutRef.current) window.clearTimeout(recentDropTimeoutRef.current);
    recentDropTimeoutRef.current = window.setTimeout(() => {
      setRecentDrop(null);
      recentDropTimeoutRef.current = null;
    }, 950);
  }, []);

  React.useEffect(() => { void loadWorkspace({ force: true }); }, [loadWorkspace]);
  React.useEffect(() => {
    if (!currentUserId) return undefined;
    return subscribeToConsultantDeckingEntries(() => { scheduleWorkspaceRefresh({ force: true, silent: true, delayMs: 90 }); });
  }, [currentUserId, scheduleWorkspaceRefresh]);
  React.useEffect(() => () => {
    if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
    if (recentDropTimeoutRef.current) window.clearTimeout(recentDropTimeoutRef.current);
  }, []);
  React.useEffect(() => {
    setDraft((current) => ({ ...current, tabId: activeTabId, laneId: getInboxLaneIdForTab(activeTabId) }));
  }, [activeTabId]);

  const activeTab = React.useMemo(() => tabs.find((tab) => tab.id === activeTabId) || null, [tabs, activeTabId]);
  const activeTabLanes = React.useMemo(() => lanes.filter((lane) => lane.tabId === activeTabId), [lanes, activeTabId]);
  const activeEntries = React.useMemo(() => entries.filter((entry) => entry.tabId === activeTabId), [entries, activeTabId]);
  const visibleEntries = React.useMemo(() => activeEntries.filter((entry) => (filterSource === 'all' || entry.patientSource === filterSource) && (filterDifficulty === 'all' || entry.difficulty === filterDifficulty) && (filterPriority === 'all' || entry.priorityLevel === filterPriority)), [activeEntries, filterSource, filterDifficulty, filterPriority]);
  const groupedEntries = React.useMemo(() => {
    const grouped = new Map<ConsultantDeckingLaneId, ConsultantDeckingEntry[]>();
    activeTabLanes.forEach((lane) => grouped.set(lane.id, []));
    visibleEntries.forEach((entry) => {
      const current = grouped.get(entry.laneId) || [];
      current.push(entry);
      grouped.set(entry.laneId, current);
    });
    grouped.forEach((laneEntries, laneId) => grouped.set(laneId, sortEntriesForLane(laneEntries)));
    return grouped;
  }, [activeTabLanes, visibleEntries]);
  const boardLanes = React.useMemo(() => {
    const consultantLanes = activeTabLanes.filter((lane) => lane.id !== getInboxLaneIdForTab(activeTabId));
    return showOnlyOccupiedLanes ? consultantLanes.filter((lane) => (groupedEntries.get(lane.id) || []).length > 0) : consultantLanes;
  }, [activeTabId, activeTabLanes, groupedEntries, showOnlyOccupiedLanes]);
  const unassignedEntries = groupedEntries.get(getInboxLaneIdForTab(activeTabId)) || [];
  const consultantSummarySections = React.useMemo(
    () => boardLanes.map((lane) => ({ id: lane.id, title: lane.label, entries: groupedEntries.get(lane.id) || [] })),
    [boardLanes, groupedEntries],
  );
  const consultantSummaryGridClass = React.useMemo(() => {
    if (consultantSummarySections.length === 4) return 'md:grid-cols-2';
    if (consultantSummarySections.length >= 3) return 'md:grid-cols-2 xl:grid-cols-3';
    if (consultantSummarySections.length === 2) return 'md:grid-cols-2';
    return 'grid-cols-1';
  }, [consultantSummarySections.length]);
  const handleCopyPlainText = React.useCallback((event: React.ClipboardEvent<HTMLElement>, text: string) => {
    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
  }, []);

  const loadArchives = React.useCallback(async () => {
    setIsLoadingArchives(true);
    try {
      setArchivedSessions(await listArchivedDeckingSessions());
    } catch (error: any) {
      toastError('Unable to load archived sessions', error?.message || 'Please try again.');
    } finally {
      setIsLoadingArchives(false);
    }
  }, []);

  const openPicker = React.useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') input.showPicker();
  }, []);

  const handleCreateEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createConsultantDeckingEntry({
        patientName: draft.patientName,
        patientAge: normalizeAge(draft.patientAge),
        patientSex: draft.patientSex || null,
        tabId: draft.tabId,
        difficulty: draft.difficulty,
        priorityLevel: draft.priorityLevel,
        patientSource: draft.patientSource,
        studyDate: draft.studyDate,
        studyTime: draft.studyTime,
        studyDescription: draft.studyDescription,
        briefImpression: draft.briefImpression,
        laneId: draft.laneId,
      });
      setDraft(createEmptyDraft(activeTabId, getInboxLaneIdForTab(activeTabId)));
      toastSuccess('Patient added to consultant decking.');
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to add patient', error?.message || 'Please try again.');
    }
  };

  const openEditor = (entry: ConsultantDeckingEntry) => {
    setEditingEntry(entry);
    setEditDraft({
      patientName: entry.patientName,
      patientAge: entry.patientAge ? `${entry.patientAge}` : '',
      patientSex: entry.patientSex || '',
      tabId: entry.tabId,
      difficulty: entry.difficulty,
      priorityLevel: entry.priorityLevel,
      patientSource: entry.patientSource,
      studyDate: entry.studyDate || '',
      studyTime: entry.studyTime || '',
      studyDescription: entry.studyDescription || '',
      briefImpression: entry.briefImpression || '',
      laneId: entry.laneId,
    });
  };

  const closeEditor = () => setEditingEntry(null);
  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingEntry) return;
    setIsSubmittingEdit(true);
    try {
      await updateConsultantDeckingEntry(editingEntry.id, {
        patientName: editDraft.patientName,
        patientAge: normalizeAge(editDraft.patientAge),
        patientSex: editDraft.patientSex || null,
        tabId: editDraft.tabId,
        difficulty: editDraft.difficulty,
        priorityLevel: editDraft.priorityLevel,
        patientSource: editDraft.patientSource,
        studyDate: editDraft.studyDate,
        studyTime: editDraft.studyTime,
        studyDescription: editDraft.studyDescription,
        briefImpression: editDraft.briefImpression,
      });
      if (editingEntry.tabId !== editDraft.tabId || editingEntry.laneId !== editDraft.laneId) {
        const nextPosition = entries.filter((entry) => entry.tabId === editDraft.tabId && entry.laneId === editDraft.laneId && entry.id !== editingEntry.id).length;
        await moveConsultantDeckingEntry(editingEntry.id, editDraft.tabId, editDraft.laneId, nextPosition);
      }
      toastSuccess('Patient updated.');
      setEditingEntry(null);
      if (editDraft.tabId !== activeTabId) setActiveTabId(editDraft.tabId);
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to update patient', error?.message || 'Please try again.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry) return;
    setIsSubmittingEdit(true);
    try {
      await deleteConsultantDeckingEntry(editingEntry.id);
      toastSuccess('Patient removed.');
      setEditingEntry(null);
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to delete patient', error?.message || 'Please try again.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleCreateLane = async () => {
    if (!activeTab || !newLaneName.trim()) return;
    setCreatingLane(true);
    try {
      await createConsultantDeckingLane({ tabId: activeTab.id, label: newLaneName });
      setNewLaneName('');
      setShowAddLane(false);
      toastSuccess('Consultant lane added.');
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to add lane', error?.message || 'Please try again.');
    } finally {
      setCreatingLane(false);
    }
  };

  const handleCreateTab = async () => {
    if (!newTabTitle.trim()) return;
    setCreatingTab(true);
    try {
      const { id } = await createConsultantDeckingTab({ title: newTabTitle.trim() });
      const consultantNames = newDeckConsultants.map((value) => value.trim()).filter(Boolean).slice(0, MAX_CONSULTANTS_ON_DECK);
      for (const consultantName of consultantNames) {
        await createConsultantDeckingLane({ tabId: id, label: consultantName });
      }
      setNewTabTitle('');
      setShowAddTab(false);
      setNewDeckConsultants(['']);
      toastSuccess('New deck tab added.');
      setActiveTabId(id);
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to add tab', error?.message || 'Please try again.');
    } finally {
      setCreatingTab(false);
    }
  };

  const handleAddDeckConsultantField = () => {
    setNewDeckConsultants((current) => (current.length >= MAX_CONSULTANTS_ON_DECK ? current : [...current, '']));
  };

  const handleDeckConsultantChange = (index: number, value: string) => {
    setNewDeckConsultants((current) => current.map((item, itemIndex) => itemIndex === index ? value.slice(0, LANE_NAME_LIMIT) : item));
  };

  const handleRemoveDeckConsultantField = (index: number) => {
    setNewDeckConsultants((current) => current.length === 1 ? [''] : current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDeleteTab = async (tab: ConsultantDeckingTab) => {
    if (!isUserCreatedTab(tab.id)) return;
    if (!window.confirm(`Remove "${tab.title}"? This hides the tab and its consultant lanes from the board.`)) return;
    try {
      const relatedLanes = lanes.filter((lane) => lane.tabId === tab.id);
      await Promise.all([
        updateConsultantDeckingTab(tab.id, { isActive: false }),
        ...relatedLanes.map((lane) => updateConsultantDeckingLane(lane.id, { isActive: false })),
      ]);
      toastSuccess('Deck tab removed');
      await loadWorkspace({ force: true });
    } catch (error: any) {
      toastError('Unable to remove deck tab', error?.message || 'Please try again.');
    }
  };

  const handleRenameLane = async (laneId: string) => {
    setSavingLaneId(laneId);
    try {
      await updateConsultantDeckingLane(laneId, { label: laneLabelDrafts[laneId] });
      setEditingLaneId(null);
      toastSuccess('Consultant lane updated.');
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to rename lane', error?.message || 'Please try again.');
    } finally {
      setSavingLaneId(null);
    }
  };

  const handleMoveLane = async (laneId: string, direction: -1 | 1) => {
    const movableLanes = activeTabLanes.filter((lane) => lane.id !== getInboxLaneIdForTab(activeTabId));
    const index = movableLanes.findIndex((lane) => lane.id === laneId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= movableLanes.length) return;
    const reordered = [...movableLanes];
    const [lane] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, lane);
    try {
      await reorderConsultantDeckingLanes(reordered);
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to reorder lanes', error?.message || 'Please try again.');
    }
  };

  const handleArchiveLane = async (laneId: string) => {
    const lane = lanes.find((item) => item.id === laneId);
    if (!lane) return;
    if (!window.confirm(`Delete consultant column "${lane.label}"? Patients in it will move back to Unassigned patients.`)) return;
    setSavingLaneId(laneId);
    try {
      await archiveConsultantDeckingLane(laneId);
      setEditingLaneId(null);
      toastSuccess('Consultant lane archived.');
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to archive lane', error?.message || 'Please try again.');
    } finally {
      setSavingLaneId(null);
    }
  };

  const handleSaveTab = async (tabId: string) => {
    setSavingTabId(tabId);
    try {
      await updateConsultantDeckingTab(tabId, { title: tabTitleDrafts[tabId], description: tabDescriptionDrafts[tabId] });
      toastSuccess('Deck tab updated.');
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to update tab', error?.message || 'Please try again.');
    } finally {
      setSavingTabId(null);
    }
  };

  const handleMoveTab = async (tabId: string, direction: -1 | 1) => {
    const index = tabs.findIndex((tab) => tab.id === tabId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= tabs.length) return;
    const reordered = [...tabs];
    const [tab] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, tab);
    try {
      await reorderConsultantDeckingTabs(reordered);
      await loadWorkspace({ force: true, silent: true });
    } catch (error: any) {
      toastError('Unable to reorder tabs', error?.message || 'Please try again.');
    }
  };

  const handleDropMove = async (event: React.DragEvent<HTMLDivElement>, tabId: ConsultantDeckingTabId, laneId: ConsultantDeckingLaneId, index: number) => {
    event.preventDefault();
    if (!activeDrag) return;
    const { entryId } = activeDrag;
    const nextEntries = reorderDeckingEntries(entries, entryId, tabId, laneId, index);
    setEntries(nextEntries);
    markRecentDrop(entryId, tabId, laneId);
    setActiveDrag(null);
    setDropTarget(null);
    try {
      await moveConsultantDeckingEntry(entryId, tabId, laneId, index);
      scheduleWorkspaceRefresh({ force: true, silent: true, delayMs: 60 });
    } catch (error: any) {
      await loadWorkspace({ force: true, silent: true });
      toastError('Unable to move patient', error?.message || 'Please try again.');
    }
  };

  const handleArchiveDeck = async () => {
    try {
      await createArchivedDeckingSession(activeTab?.title || 'Consultant Decking', activeEntries, activeTabLanes, tabs);
      toastSuccess('Deck archived.');
    } catch (error: any) {
      toastError('Unable to archive deck', error?.message || 'Please try again.');
    }
  };

  const handleClearAll = async () => {
    if (!activeTab) return;
    if (!activeEntries.length) {
      toastError('Nothing to clear', 'This deck has no patients yet.');
      return;
    }
    if (!window.confirm(`Clear all patients from "${activeTab.title}"? This will remove every patient in this deck.`)) return;
    try {
      await Promise.all(activeEntries.map((entry) => deleteConsultantDeckingEntry(entry.id)));
      setEntries((current) => current.filter((entry) => entry.tabId !== activeTab.id));
      toastSuccess('Deck cleared.');
      scheduleWorkspaceRefresh({ force: true, silent: true, delayMs: 60 });
    } catch (error: any) {
      await loadWorkspace({ force: true, silent: true });
      toastError('Unable to clear deck', error?.message || 'Please try again.');
    }
  };

  const handleExportSummary = React.useCallback(() => {
    if (!activeTab) {
      toastError('Unable to export summary', 'No active deck tab selected.');
      return;
    }
    setIsSummaryOpen(true);
  }, [activeTab, boardLanes, groupedEntries, unassignedEntries]);

  if (!currentUserId) {
    return (
      <PageShell>
        <PageHeader title="Consultant Decking" subtitle="Shared consultant assignment board" onBack={onBack} />
        <ScreenStatusNotice title="Sign in required" description="Sign in is required to view and update the shared consultant decking board." />
      </PageShell>
    );
  }
  return (
    <PageShell layoutMode="wide">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] font-bold text-white tracking-tight">Consultant Decking</h1>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.length ? (
            <>
              <button type="button" onClick={() => { setIsArchivesOpen(true); void loadArchives(); }} className="rounded-full bg-white/5 border border-white/[0.08] px-4 py-[9px] text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">Archives</button>
              <button type="button" onClick={() => void handleArchiveDeck()} className="rounded-full bg-white/5 border border-white/[0.08] px-4 py-[9px] text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">Save Session</button>
              <button type="button" onClick={() => void handleClearAll()} className="rounded-full bg-white/5 border border-white/[0.08] px-4 py-[9px] text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">Clear All</button>
              <button type="button" onClick={handleExportSummary} className="rounded-full border border-cyan-400/20 bg-[#163a4a] px-4 py-[9px] text-sm font-semibold text-cyan-50 transition-colors hover:bg-[#1a4a5e]">Export Summary</button>
            </>
          ) : null}
          <button type="button" onClick={onBack} className="rounded-full bg-white/5 border border-white/[0.08] px-4 py-[9px] text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">Back</button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
        </div>
      )}

      {!loading && (
      <>
      {/* Board Tabs */}
      {tabs.length ? (
        <div className="mt-8 mb-4 flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <div key={tab.id} className={`flex items-center gap-1 rounded-xl px-2 py-[7px] transition-all ${tab.id === activeTabId ? 'bg-[#1e2733] text-white shadow-md' : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-300'}`}>
              <button type="button" onClick={() => setActiveTabId(tab.id)} className="px-3 py-[2px] text-[13px] font-bold">
                {tab.title}
              </button>
              {isUserCreatedTab(tab.id) ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteTab(tab)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-rose-300"
                  aria-label={`Remove ${tab.title}`}
                  title={`Remove ${tab.title}`}
                >
                  <span className="material-icons text-[16px]">close</span>
                </button>
              ) : null}
            </div>
          ))}
          {!showAddTab ? (
            <button type="button" onClick={() => setShowAddTab(true)} className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-[9px] text-[13px] font-bold text-slate-300 transition-colors hover:bg-white/[0.03] hover:text-white">
              <span className="material-icons text-[16px] text-slate-500">add</span>
              Add deck
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-xl bg-white/[0.01] pl-3 pr-1 py-[3px] ring-1 ring-white/[0.04] focus-within:bg-[#141922] focus-within:ring-cyan-500/30">
              <span className="material-icons text-[15px] text-slate-500">add</span>
              <input value={newTabTitle} onChange={(e) => setNewTabTitle(e.target.value.slice(0, TAB_TITLE_LIMIT))} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTab(); if (e.key === 'Escape') { setShowAddTab(false); setNewTabTitle(''); } }} placeholder="New deck tab..." className="w-36 border-0 bg-transparent text-[13px] text-white font-medium outline-none ring-0 shadow-none placeholder:text-slate-500 focus:border-0 focus:outline-none focus:ring-0" />
              <button type="button" onClick={handleCreateTab} disabled={creatingTab || !newTabTitle.trim()} className="rounded-lg bg-cyan-700/50 px-3 py-1.5 text-[11px] font-bold text-cyan-50 disabled:opacity-50 hover:bg-cyan-600">Add deck</button>
              <button type="button" onClick={() => { setShowAddTab(false); setNewTabTitle(''); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200" aria-label="Close add deck">
                <span className="material-icons text-[16px]">close</span>
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Empty state when no tabs */}
      {!tabs.length && (
        <div className="flex min-h-[56vh] items-center justify-center py-10">
          <div className="w-full max-w-3xl rounded-[2rem] border border-white/[0.05] bg-[radial-gradient(circle_at_top,rgba(45,88,110,0.28),rgba(20,26,34,0.94)_42%)] px-8 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/55">Create Your First Deck</p>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-slate-400">Use a clear deck title. Example: <span className="font-semibold text-slate-200">CT Fuente Cover (Sat-Sun 7AM-7AM)</span></p>
            <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-[1.5rem] border border-white/[0.06] bg-[#0f141c]/85 p-4">
              <input value={newTabTitle} onChange={(e) => setNewTabTitle(e.target.value.slice(0, TAB_TITLE_LIMIT))} onKeyDown={(e) => { if(e.key === 'Enter') handleCreateTab() }} placeholder="CT Fuente Cover (Sat-Sun 7AM-7AM)" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0a0f17] px-5 text-[15px] font-medium text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none" />
              <div className="rounded-[1.25rem] border border-white/6 bg-[#0a0f17] p-3 text-left">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-slate-200">Consultants on deck</p>
                  </div>
                  <button type="button" onClick={handleAddDeckConsultantField} disabled={newDeckConsultants.length >= MAX_CONSULTANTS_ON_DECK} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-300 disabled:opacity-40 hover:bg-white/[0.08]">
                    Add more
                  </button>
                </div>
                <div className="space-y-2">
                  {newDeckConsultants.map((consultant, index) => (
                    <div key={`deck-consultant-${index}`} className="flex items-center gap-2">
                      <input
                        value={consultant}
                        onChange={(event) => handleDeckConsultantChange(index, event.target.value)}
                        placeholder={`Consultant ${index + 1}`}
                        className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0f141c] px-4 text-[14px] text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDeckConsultantField(index)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200"
                        aria-label={`Remove consultant ${index + 1}`}
                      >
                        <span className="material-icons text-[18px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" onClick={handleCreateTab} disabled={creatingTab || !newTabTitle.trim()} className="h-12 rounded-2xl border border-cyan-400/20 bg-[#2b5a6c] px-6 text-[14px] font-bold text-cyan-50 transition-colors disabled:opacity-50 hover:bg-cyan-700">Create deck</button>
            </div>
          </div>
        </div>
      )}

      {/* Top Board Section: Form & Unassigned — only when a tab is active */}
      {activeTab && (
      <div className="rounded-[1.5rem] border border-white/[0.04] bg-[#161a22] p-6 shadow-xl">
        <form className="flex w-full flex-col gap-4" onSubmit={handleCreateEntry}>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
            <label className="flex flex-col gap-1.5 w-[85px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Source</span>
              <select value={draft.patientSource} onChange={(event) => setDraft((current) => ({ ...current, patientSource: event.target.value as ConsultantDeckingPatientSource }))} className="h-[42px] w-full rounded-full border border-white/5 bg-[#0d1117] px-3 text-[13px] text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50">
                {PATIENT_SOURCE_OPTIONS.map((option) => <option key={option} value={option}>{labelize(option).toUpperCase()}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Patient name</span>
              <input type="text" value={draft.patientName} onChange={(event) => setDraft((current) => ({ ...current, patientName: event.target.value }))} placeholder="Enter patient name" className="h-[42px] w-full rounded-full border border-white/5 bg-[#0d1117] px-4 text-[13px] text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
            </label>
            <label className="flex flex-col gap-1.5 w-[76px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Age</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={draft.patientAge} onChange={(event) => setDraft((current) => ({ ...current, patientAge: event.target.value.replace(/\D/g, '').slice(0, 3) }))} className="h-[42px] w-full appearance-none rounded-full border border-white/5 bg-[#0d1117] px-3 text-center text-[13px] text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
            </label>
            <label className="flex flex-col gap-1.5 w-[75px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Sex</span>
              <select value={draft.patientSex} onChange={(event) => setDraft((current) => ({ ...current, patientSex: event.target.value as DraftState['patientSex'] }))} className="h-[42px] w-full rounded-full border border-white/5 bg-[#0d1117] px-2 sm:px-3 text-[13px] text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50">
                <option value=""></option>
                {PATIENT_SEX_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 w-[250px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Study schedule</span>
              <div className="flex h-[42px] w-full items-center gap-2 rounded-full border border-white/5 bg-[#0d1117] px-4 text-white focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50">
                <div onClick={() => openPicker(studyDateInputRef.current)} className="flex w-[132px] items-center gap-2 text-left">
                  <input ref={studyDateInputRef} type="date" value={draft.studyDate} onChange={(event) => setDraft((current) => ({ ...current, studyDate: event.target.value }))} className="w-full cursor-pointer border-0 bg-transparent px-0 text-[12px] outline-none shadow-none [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden" />
                  <span className="material-icons pointer-events-none text-[14px] text-slate-500">calendar_today</span>
                </div>
                <div className="h-4 w-px shrink-0 bg-white/10" />
                <div onClick={() => openPicker(studyTimeInputRef.current)} className="flex w-[88px] items-center gap-2 text-left">
                  <input ref={studyTimeInputRef} type="time" value={draft.studyTime} onChange={(event) => setDraft((current) => ({ ...current, studyTime: event.target.value }))} className="w-full cursor-pointer border-0 bg-transparent px-0 text-[12px] outline-none shadow-none [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden" />
                  <span className="material-icons pointer-events-none text-[14px] text-slate-500">schedule</span>
                </div>
              </div>
            </label>
            <label className="flex flex-col gap-1.5 w-[200px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Study description</span>
              <select value={draft.studyDescription} onChange={(event) => setDraft((current) => ({ ...current, studyDescription: event.target.value }))} className="h-[42px] w-full rounded-full border border-white/5 bg-[#0d1117] px-4 text-[13px] text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50">
                <option value="">Select study description</option>
                {STUDY_OPTION_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option key={option} value={option}>{option}</option>)}</optgroup>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 w-[110px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Priority</span>
              <select value={draft.priorityLevel} onChange={(event) => setDraft((current) => ({ ...current, priorityLevel: event.target.value as ConsultantDeckingPriority }))} className="h-[42px] w-full rounded-full border border-white/5 bg-[#0d1117] px-4 text-[13px] text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50">
                {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 w-[110px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Difficulty</span>
              <select value={draft.difficulty} onChange={(event) => setDraft((current) => ({ ...current, difficulty: event.target.value as ConsultantDeckingDifficulty }))} className="h-[42px] w-full rounded-full border border-white/5 bg-[#0d1117] px-4 text-[13px] text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50">
                {DIFFICULTY_OPTIONS.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <span className="pl-1 text-[11px] font-medium text-slate-400">Why this difficulty?</span>
              <input type="text" value={draft.briefImpression} maxLength={BRIEF_IMPRESSION_LIMIT} onChange={(event) => setDraft((current) => ({ ...current, briefImpression: event.target.value.slice(0, BRIEF_IMPRESSION_LIMIT) }))} placeholder="Why is this case easy, medium, or hard? ex. difficult impression, many findings" className="h-[42px] w-full rounded-full border border-white/5 bg-[#0d1117] px-4 text-[13px] text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
            </label>
            <button type="submit" className="h-[42px] min-w-[170px] shrink-0 rounded-full border border-cyan-500/30 bg-[#2b5a6c] px-5 text-[13px] font-bold text-cyan-50 transition-colors hover:bg-cyan-700">Add patient</button>
          </div>
        </form>

        <hr className="my-6 border-white/[0.05]" />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold tracking-tight text-white">Unassigned patients</h2>
          <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-white/[0.1] px-2 text-[11px] font-bold text-white/70">{unassignedEntries.length}</span>
        </div>

        <div className={`min-h-[90px] rounded-[1.25rem] border border-dashed bg-[#11141a] transition-all duration-200 ${dropTarget?.tabId === activeTabId && dropTarget?.laneId === getInboxLaneIdForTab(activeTabId) ? 'border-cyan-300/55 bg-cyan-400/[0.06] shadow-[0_0_0_1px_rgba(34,211,238,0.16),0_22px_42px_rgba(6,182,212,0.12)]' : recentDrop?.tabId === activeTabId && recentDrop?.laneId === getInboxLaneIdForTab(activeTabId) ? 'border-emerald-300/35 bg-emerald-400/[0.04]' : 'border-white/[0.08]'}`} onDragOver={(event) => { event.preventDefault(); setDropTarget({ tabId: activeTabId, laneId: getInboxLaneIdForTab(activeTabId), index: unassignedEntries.length }); }} onDrop={(event) => { void handleDropMove(event, activeTabId, getInboxLaneIdForTab(activeTabId), unassignedEntries.length); }}>
          {unassignedEntries.length ? (
            <div className="flex flex-wrap gap-3 p-3">
              {unassignedEntries.map((entry, index) => <div key={entry.id} className="w-full max-w-[320px]"><PatientPill entry={entry} viewMode={viewMode} onOpen={openEditor} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setActiveDrag({ entryId: entry.id, sourceTabId: entry.tabId, sourceLaneId: entry.laneId, sourceIndex: index }); }} onDragEnd={() => { setActiveDrag(null); setDropTarget(null); }} onDragOver={(event) => { event.preventDefault(); setDropTarget({ tabId: activeTabId, laneId: getInboxLaneIdForTab(activeTabId), index }); }} onDrop={(event) => { void handleDropMove(event, activeTabId, getInboxLaneIdForTab(activeTabId), index); }} isDropMarker={dropTarget?.laneId === getInboxLaneIdForTab(activeTabId) && dropTarget.index === index} isDragging={activeDrag?.entryId === entry.id} isDropActive={dropTarget?.laneId === getInboxLaneIdForTab(activeTabId) && dropTarget.index === index} isRecentlyDropped={recentDrop?.entryId === entry.id && recentDrop?.laneId === getInboxLaneIdForTab(activeTabId) && recentDrop?.tabId === activeTabId} /></div>)}
            </div>
          ) : (
            <div className={`flex h-[90px] items-center justify-center text-[13px] font-medium transition-colors ${dropTarget?.tabId === activeTabId && dropTarget?.laneId === getInboxLaneIdForTab(activeTabId) ? 'text-cyan-200' : 'text-slate-500'}`}>
              {dropTarget?.tabId === activeTabId && dropTarget?.laneId === getInboxLaneIdForTab(activeTabId) ? 'Release to move here' : 'No unassigned patients'}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Consultant Columns — only shown when a tab is active */}
      {activeTab && (
      <div className="mt-6 flex flex-wrap items-start gap-5">
        {boardLanes.map((lane) => {
          const laneEntries = groupedEntries.get(lane.id) || [];
          const isLaneDropActive = dropTarget?.tabId === activeTabId && dropTarget?.laneId === lane.id;
          const isLaneRecentlyDropped = recentDrop?.tabId === activeTabId && recentDrop?.laneId === lane.id;
          const isEditingLane = editingLaneId === lane.id;
          const laneLabelDraft = laneLabelDrafts[lane.id] ?? lane.label;
          const isLaneSaving = savingLaneId === lane.id;
          return (
            <div key={lane.id} className={`flex flex-1 min-w-[220px] max-w-[320px] min-h-[340px] flex-col rounded-[1.5rem] border bg-[#141922] p-5 shadow-lg transition-all duration-200 ${isLaneDropActive ? 'border-cyan-300/45 bg-[#16212d] shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_24px_48px_rgba(8,145,178,0.14)] -translate-y-[2px]' : isLaneRecentlyDropped ? 'border-emerald-300/25 shadow-[0_18px_40px_rgba(16,185,129,0.10)]' : 'border-white/[0.04]'}`} onDragOver={(event) => { event.preventDefault(); setDropTarget({ tabId: activeTabId, laneId: lane.id, index: laneEntries.length }); }} onDrop={(event) => { void handleDropMove(event, activeTabId, lane.id, laneEntries.length); }}>
              <div className="mb-4">
                {isEditingLane ? (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      value={laneLabelDraft}
                      onChange={(event) => setLaneLabelDrafts((current) => ({ ...current, [lane.id]: event.target.value.slice(0, LANE_NAME_LIMIT) }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && laneLabelDraft.trim()) void handleRenameLane(lane.id);
                        if (event.key === 'Escape') {
                          setEditingLaneId(null);
                          setLaneLabelDrafts((current) => ({ ...current, [lane.id]: lane.label }));
                        }
                      }}
                      className="h-[38px] w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 text-center text-[13px] font-semibold text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                      placeholder="Consultant name"
                    />
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRenameLane(lane.id)}
                        disabled={isLaneSaving || !laneLabelDraft.trim()}
                        className="rounded-lg bg-cyan-700/60 px-3 py-1.5 text-[11px] font-bold text-cyan-50 transition-colors hover:bg-cyan-600 disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLaneId(null);
                          setLaneLabelDrafts((current) => ({ ...current, [lane.id]: lane.label }));
                        }}
                        className="rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleArchiveLane(lane.id)}
                        disabled={isLaneSaving}
                        className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="flex items-start justify-between gap-2">
                      <span className="w-8" />
                      <div className="min-w-0 flex-1">
                        <h3 className={`truncate text-[15px] font-bold tracking-tight transition-colors ${isLaneDropActive ? 'text-cyan-100' : 'text-white'}`}>{lane.label}</h3>
                        <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-opacity ${isLaneDropActive ? 'text-cyan-300/80 opacity-100' : 'pointer-events-none opacity-0'}`}>Release to drop</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingLaneId(lane.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/8 hover:text-white"
                        aria-label={`Edit ${lane.label}`}
                        title={`Edit ${lane.label}`}
                      >
                        <span className="material-icons text-[16px]">edit</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className={`flex flex-1 flex-col rounded-[1.25rem] border border-dashed bg-[#0d1219]/60 pb-3 transition-all duration-200 ${isLaneDropActive ? 'border-cyan-300/45 bg-cyan-400/[0.05]' : isLaneRecentlyDropped ? 'border-emerald-300/25' : 'border-white/[0.06]'}`}>
                {laneEntries.length ? (
                  <div className="space-y-2 p-2">
                    {laneEntries.map((entry, index) => <PatientPill key={entry.id} entry={entry} viewMode={viewMode} onOpen={openEditor} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setActiveDrag({ entryId: entry.id, sourceTabId: entry.tabId, sourceLaneId: entry.laneId, sourceIndex: index }); }} onDragEnd={() => { setActiveDrag(null); setDropTarget(null); }} onDragOver={(event) => { event.preventDefault(); setDropTarget({ tabId: activeTabId, laneId: lane.id, index }); }} onDrop={(event) => { void handleDropMove(event, activeTabId, lane.id, index); }} isDropMarker={dropTarget?.laneId === lane.id && dropTarget.index === index} isDragging={activeDrag?.entryId === entry.id} isDropActive={dropTarget?.laneId === lane.id && dropTarget.index === index} isRecentlyDropped={recentDrop?.entryId === entry.id && recentDrop?.laneId === lane.id && recentDrop?.tabId === activeTabId} />)}
                    {dropTarget?.laneId === lane.id && dropTarget.index === laneEntries.length ? <div className="mx-2 h-[3px] rounded-full bg-cyan-300/80" /> : null}
                  </div>
                ) : (
                  <div className={`flex flex-1 items-center justify-center p-6 text-center text-[13px] font-medium transition-colors ${isLaneDropActive ? 'text-cyan-200' : 'text-slate-500'}`}>
                    {isLaneDropActive ? 'Release to move here' : 'Drop patients here'}
                  </div>
                )}
              </div>
              
              <hr className="mt-5 border-white/[0.08]" />
            </div>
          );
        })}
        
        {/* ADD CONSULTANT "+" BUTTON — hidden when 4 lanes already exist */}
        {boardLanes.length < 4 && (
          <div className="flex min-w-[140px] max-w-[160px] flex-col items-center self-start pt-6">
            {!showAddLane ? (
              <button type="button" onClick={() => setShowAddLane(true)} className="group flex h-[84px] w-[84px] items-center justify-center rounded-[1.75rem] border-2 border-dashed border-white/10 bg-white/[0.02] text-slate-500 transition-all hover:border-cyan-500/40 hover:bg-cyan-950/30 hover:text-cyan-400 hover:scale-105" aria-label="Add consultant column">
                <span className="material-icons text-[34px] transition-transform group-hover:rotate-90">add</span>
              </button>
            ) : (
              <div className="flex w-full flex-col items-center gap-2 rounded-[1.5rem] border border-white/[0.05] bg-[#141922] p-3">
                <input autoFocus value={newLaneName} onChange={(event) => setNewLaneName(event.target.value.slice(0, LANE_NAME_LIMIT))} onKeyDown={(e) => { if (e.key === 'Enter' && newLaneName.trim()) handleCreateLane(); if (e.key === 'Escape') { setShowAddLane(false); setNewLaneName(''); } }} placeholder="Consultant name" className="h-[40px] w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 text-center text-[13px] text-white focus:border-cyan-500/50 focus:outline-none transition-all placeholder:text-slate-600" aria-label="Consultant name" />
                <div className="flex w-full gap-1.5">
                  <button type="button" onClick={handleCreateLane} disabled={creatingLane || !newLaneName.trim()} className="flex-1 rounded-lg bg-cyan-700/60 px-2 py-2 text-[11px] font-bold text-cyan-50 disabled:opacity-40 hover:bg-cyan-600 transition-colors">Add consultant</button>
                  <button type="button" onClick={() => { setShowAddLane(false); setNewLaneName(''); }} className="h-[32px] rounded-lg bg-white/5 px-2.5 text-[11px] font-bold text-slate-400 hover:bg-white/10 transition-colors">✕</button>
                </div>
              </div>
            )}
            {!showAddLane && <span className="mt-3 text-center text-[11px] font-semibold leading-5 text-slate-500">Add more consultant</span>}
          </div>
        )}
      </div>
      )}
      </>
      )}
      {editingEntry ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/72 px-4 pb-4 pt-6 sm:items-center sm:pt-8" role="dialog" aria-modal="true" aria-label="Edit consultant decking patient" onClick={closeEditor}>
          <div className="max-h-[88vh] w-full max-w-[760px] overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#0b1220] p-4 sm:p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Edit patient</h2>
                <p className="mt-1 text-sm text-slate-400">Update details, priority, and lane assignment.</p>
              </div>
              <button type="button" onClick={closeEditor} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">Close</button>
            </div>
            <form className="mt-5 grid gap-3 md:grid-cols-6" onSubmit={handleSaveEdit}>
              <label className="space-y-2 md:col-span-4">
                <span className="text-xs font-semibold text-slate-400">Patient name</span>
                <input type="text" value={editDraft.patientName} onChange={(event) => setEditDraft((current) => ({ ...current, patientName: event.target.value }))} aria-label="Edit patient name" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white" />
              </label>
              <label className="space-y-2 md:col-span-1">
                <span className="text-xs font-semibold text-slate-400">Age</span>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={editDraft.patientAge} onChange={(event) => setEditDraft((current) => ({ ...current, patientAge: event.target.value.replace(/\D/g, '').slice(0, 3) }))} aria-label="Edit patient age" className="w-full appearance-none rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </label>
              <label className="space-y-2 md:col-span-1">
                <span className="text-xs font-semibold text-slate-400">Sex</span>
                <select value={editDraft.patientSex} onChange={(event) => setEditDraft((current) => ({ ...current, patientSex: event.target.value as DraftState['patientSex'] }))} aria-label="Edit patient sex" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white">
                  <option value=""></option>
                  {PATIENT_SEX_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-slate-400">Difficulty</span>
                <select value={editDraft.difficulty} onChange={(event) => setEditDraft((current) => ({ ...current, difficulty: event.target.value as ConsultantDeckingDifficulty }))} aria-label="Edit difficulty" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white">
                  {DIFFICULTY_OPTIONS.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-slate-400">Priority</span>
                <select value={editDraft.priorityLevel} onChange={(event) => setEditDraft((current) => ({ ...current, priorityLevel: event.target.value as ConsultantDeckingPriority }))} aria-label="Edit priority" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white">
                  {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-slate-400">Source</span>
                <select value={editDraft.patientSource} onChange={(event) => setEditDraft((current) => ({ ...current, patientSource: event.target.value as ConsultantDeckingPatientSource }))} aria-label="Edit patient source" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white">
                  {PATIENT_SOURCE_OPTIONS.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
                </select>
              </label>
              <label className="space-y-2 md:col-span-3">
                <span className="text-xs font-semibold text-slate-400">Study date</span>
                <input type="date" value={editDraft.studyDate} onChange={(event) => setEditDraft((current) => ({ ...current, studyDate: event.target.value }))} aria-label="Edit study date" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white" />
              </label>
              <label className="space-y-2 md:col-span-3">
                <span className="text-xs font-semibold text-slate-400">Study time</span>
                <input type="time" value={editDraft.studyTime} onChange={(event) => setEditDraft((current) => ({ ...current, studyTime: event.target.value }))} aria-label="Edit study time" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white" />
              </label>
              <label className="space-y-2 md:col-span-6">
                <span className="text-xs font-semibold text-slate-400">Study description</span>
                <select value={editDraft.studyDescription} onChange={(event) => setEditDraft((current) => ({ ...current, studyDescription: event.target.value }))} aria-label="Edit study description" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white">
                  <option value="">Select study description</option>
                  {STUDY_OPTION_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option key={option} value={option}>{option}</option>)}</optgroup>)}
                </select>
              </label>
              <label className="space-y-2 md:col-span-6">
                <span className="text-xs font-semibold text-slate-400">Why this difficulty?</span>
                <textarea value={editDraft.briefImpression} onChange={(event) => setEditDraft((current) => ({ ...current, briefImpression: event.target.value.slice(0, BRIEF_IMPRESSION_LIMIT) }))} aria-label="Edit difficulty reason" placeholder="Why is this case easy, medium, or hard? ex. difficult impression, many findings" rows={3} className="w-full rounded-[1.25rem] border border-white/10 bg-slate-950/50 px-5 py-4 text-sm text-white placeholder:text-slate-600" />
              </label>
              <label className="space-y-2 md:col-span-6">
                <span className="text-xs font-semibold text-slate-400">Move to lane</span>
                <select value={editDraft.laneId} onChange={(event) => setEditDraft((current) => ({ ...current, laneId: event.target.value }))} aria-label="Move to lane" className="w-full rounded-full border border-white/10 bg-slate-950/50 px-5 py-3 text-sm text-white">
                  {lanes.filter((lane) => lane.tabId === editDraft.tabId).map((lane) => <option key={lane.id} value={lane.id}>{lane.label}</option>)}
                </select>
              </label>
              <div className="flex flex-col gap-3 pt-2 md:col-span-6 sm:flex-row sm:justify-between">
                <button type="button" onClick={handleDeleteEntry} disabled={isSubmittingEdit} className="rounded-full border border-rose-300/25 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-100">Delete</button>
                <button type="submit" disabled={isSubmittingEdit} className="rounded-full border border-cyan-300/25 bg-cyan-500/12 px-6 py-3 text-sm font-semibold text-cyan-100">{isSubmittingEdit ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {isSummaryOpen && activeTab ? (
        <div className="fixed inset-0 z-[115] flex items-end justify-center bg-slate-950/72 px-3 pb-3 pt-4 sm:items-center sm:px-4 sm:pb-4 sm:pt-6" role="dialog" aria-modal="true" aria-label="Deck summary" onClick={() => setIsSummaryOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-[1180px] overflow-y-auto rounded-[0.4rem] border border-slate-500/40 bg-[#0b1220] p-3 sm:p-4" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-slate-600/40 pb-3">
              <div className="flex-1 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/70">Deck Summary</p>
                <h2 className="mt-1.5 text-xl font-semibold text-white">{activeTab.title}</h2>
              </div>
            </div>

            <div className="mt-4">
              <div className={`grid gap-3 ${consultantSummaryGridClass}`}>
                {consultantSummarySections.map((section) => (
                  <section key={section.id} className="rounded-[0.35rem] border border-slate-500/40 bg-white/[0.02] p-3">
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <h3 className="w-full text-center text-sm font-semibold tracking-[0.12em] text-white">{section.title.toUpperCase()}</h3>
                    </div>
                    {!section.entries.length ? (
                      <div className="rounded-[0.25rem] border border-dashed border-slate-600/40 bg-[#0d1117] px-3 py-5 text-center text-xs text-slate-500">No patients</div>
                    ) : (
                      <div className="rounded-[0.25rem] border border-slate-500/40 bg-[#121926] p-3">
                        <pre
                          className="whitespace-pre-wrap font-sans text-[12px] leading-6 text-white"
                          onCopy={(event) => handleCopyPlainText(event, section.entries.map((entry, index) => buildSummaryLine(entry, index)).join('\n\n'))}
                        >
                          {section.entries.map((entry, index) => buildSummaryLine(entry, index)).join('\n\n')}
                        </pre>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isArchivesOpen ? <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/72 px-4 pb-4 pt-10 sm:items-center" role="dialog" aria-modal="true" onClick={() => setIsArchivesOpen(false)}><div className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-5" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">Archived Sessions</h2><p className="mt-1 text-sm text-slate-400">View archived duty decks.</p></div><button type="button" onClick={() => setIsArchivesOpen(false)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-slate-200">Close</button></div><div className="flex-1 overflow-y-auto pr-2">{isLoadingArchives ? <div className="flex h-32 items-center justify-center text-sm text-slate-400">Loading archives...</div> : archivedSessions.length === 0 ? <div className="flex h-32 items-center justify-center text-sm text-slate-400">No archived sessions found.</div> : <div className="grid gap-3">{archivedSessions.map((session) => <div key={session.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-4"><h3 className="font-semibold text-white">{session.title}</h3><p className="mt-1 text-xs text-slate-400">Saved on {new Date(session.createdAt).toLocaleString()} | {session.entriesSnapshot.length} patients</p></div>)}</div>}</div></div></div> : null}
    </PageShell>
  );
};

export default ConsultantDeckingBoardScreen;
