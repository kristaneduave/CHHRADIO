import {
  ConsultantDeckingDifficulty,
  ConsultantDeckingEntry,
  ConsultantDeckingEntryInput,
  ConsultantDeckingLane,
  ConsultantDeckingLaneId,
  ConsultantDeckingPatientSource,
  ConsultantDeckingPriority,
  ConsultantDeckingTab,
  ConsultantDeckingTabId,
} from '../types';
import { supabase } from './supabase';

export type ArchivedDeckingSession = {
  id: string;
  title: string;
  entriesSnapshot: ConsultantDeckingEntry[];
  lanesSnapshot: ConsultantDeckingLane[];
  tabsSnapshot: ConsultantDeckingTab[];
  createdAt: string;
  createdBy: string | null;
};

const ENTRY_TABLE_NAME = 'consultant_decking_entries';
const LANE_TABLE_NAME = 'consultant_decking_lanes';
const TAB_TABLE_NAME = 'consultant_decking_tabs';
const ARCHIVE_TABLE_NAME = 'archived_consultant_decking_sessions';

const INBOX_LANE_ID = 'inbox';
const FALLBACK_TAB_ID = 'tab-1';
const DEFAULT_TAB_SEEDS: ConsultantDeckingTab[] = [];
const DEFAULT_LANE_ACCENTS = ['violet', 'amber', 'emerald', 'rose', 'sky', 'teal'];
const DEFAULT_LANE_SEEDS: ConsultantDeckingLane[] = [];
const VALID_DIFFICULTIES: ConsultantDeckingDifficulty[] = ['easy', 'medium', 'hard'];
const VALID_PATIENT_SOURCES: ConsultantDeckingPatientSource[] = ['inpatient', 'er', 'outpatient'];
const VALID_PRIORITIES: ConsultantDeckingPriority[] = ['routine', 'priority', 'urgent', 'stat'];
const VALID_LEGACY_COLUMN_KEYS = ['inbox', 'reynes', 'alvarez', 'co-ng', 'vano-yu'] as const;
const MAX_LANES_PER_TAB = 4;

type ConsultantDeckingTabRow = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  max_lanes: number | null;
  created_at?: string;
  updated_at?: string;
};

type ConsultantDeckingLaneRow = {
  id: string;
  tab_id?: string | null;
  label: string;
  sort_order: number;
  is_active: boolean;
  accent_token: string | null;
  created_at?: string;
  updated_at?: string;
};

type ConsultantDeckingRow = {
  id: string;
  patient_name: string;
  patient_age: number | null;
  patient_sex: 'M' | 'F' | null;
  tab_id?: string | null;
  difficulty: ConsultantDeckingDifficulty;
  priority_level?: ConsultantDeckingPriority | null;
  patient_source: ConsultantDeckingPatientSource;
  study_date: string | null;
  study_time: string | null;
  study_description: string | null;
  brief_impression?: string | null;
  lane_id?: string | null;
  column_key?: string | null;
  position: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

let consultantDeckingCache: ConsultantDeckingEntry[] | null = null;
let consultantDeckingPromise: Promise<ConsultantDeckingEntry[]> | null = null;
let consultantLaneCache: ConsultantDeckingLane[] | null = null;
let consultantLanePromise: Promise<ConsultantDeckingLane[]> | null = null;
let consultantTabCache: ConsultantDeckingTab[] | null = null;
let consultantTabPromise: Promise<ConsultantDeckingTab[]> | null = null;

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeStudyDescription = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeBriefImpression = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 240);
const normalizeAge = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
};
const toLegacyColumnKey = (laneId: string) =>
  VALID_LEGACY_COLUMN_KEYS.includes(laneId as (typeof VALID_LEGACY_COLUMN_KEYS)[number]) ? laneId : INBOX_LANE_ID;

const buildLaneSlug = (label: string) =>
  label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || `lane-${Date.now().toString(36)}`;

const makeLaneId = (label: string) => `${buildLaneSlug(label)}-${Math.random().toString(36).slice(2, 6)}`;

const assertDifficulty = (value: string): ConsultantDeckingDifficulty => {
  if (VALID_DIFFICULTIES.includes(value as ConsultantDeckingDifficulty)) return value as ConsultantDeckingDifficulty;
  throw new Error(`Unsupported consultant decking difficulty: ${value}`);
};

const assertPatientSource = (value: string): ConsultantDeckingPatientSource => {
  if (VALID_PATIENT_SOURCES.includes(value as ConsultantDeckingPatientSource)) return value as ConsultantDeckingPatientSource;
  throw new Error(`Unsupported consultant decking patient source: ${value}`);
};

const assertPriorityLevel = (value: string | null | undefined): ConsultantDeckingPriority => {
  if (value && VALID_PRIORITIES.includes(value as ConsultantDeckingPriority)) return value as ConsultantDeckingPriority;
  return 'routine';
};

const mapTabRow = (row: ConsultantDeckingTabRow): ConsultantDeckingTab => ({
  id: String(row.id),
  title: String(row.title),
  description: row.description || null,
  sortOrder: Number(row.sort_order || 0),
  isActive: Boolean(row.is_active),
  maxLanes: Number(row.max_lanes || MAX_LANES_PER_TAB),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapLaneRow = (row: ConsultantDeckingLaneRow): ConsultantDeckingLane => ({
  id: String(row.id),
  tabId: String(row.tab_id || FALLBACK_TAB_ID),
  label: String(row.label),
  sortOrder: Number(row.sort_order || 0),
  isActive: Boolean(row.is_active),
  accentToken: row.accent_token || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRow = (row: ConsultantDeckingRow): ConsultantDeckingEntry => ({
  id: String(row.id),
  patientName: normalizeName(String(row.patient_name || '')),
  patientAge: typeof row.patient_age === 'number' ? row.patient_age : null,
  patientSex: row.patient_sex === 'M' || row.patient_sex === 'F' ? row.patient_sex : null,
  tabId: String(row.tab_id || FALLBACK_TAB_ID),
  difficulty: assertDifficulty(String(row.difficulty || '')),
  priorityLevel: assertPriorityLevel(row.priority_level),
  patientSource: assertPatientSource(String(row.patient_source || '')),
  studyDate: row.study_date || null,
  studyTime: row.study_time || null,
  studyDescription: row.study_description ? normalizeStudyDescription(String(row.study_description)) : null,
  briefImpression: row.brief_impression ? normalizeBriefImpression(String(row.brief_impression)) : null,
  laneId: String(row.lane_id || row.column_key || INBOX_LANE_ID),
  position: Number(row.position || 0),
  createdBy: row.created_by || null,
  updatedBy: row.updated_by || null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const sortTabs = (tabs: ConsultantDeckingTab[]) =>
  [...tabs].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.title.localeCompare(right.title);
  });

const sortLanes = (lanes: ConsultantDeckingLane[]) =>
  [...lanes].sort((left, right) => {
    if (left.tabId !== right.tabId) return left.tabId.localeCompare(right.tabId);
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.label.localeCompare(right.label);
  });

const sortEntries = (entries: ConsultantDeckingEntry[]) =>
  [...entries].sort((left, right) => {
    if (left.tabId !== right.tabId) return left.tabId.localeCompare(right.tabId);
    if (left.laneId !== right.laneId) return left.laneId.localeCompare(right.laneId);
    if (left.position !== right.position) return left.position - right.position;
    const updatedCompare = left.updatedAt.localeCompare(right.updatedAt);
    if (updatedCompare !== 0) return updatedCompare;
    return left.id.localeCompare(right.id);
  });

const requireUserId = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user?.id) throw new Error('User session unavailable.');
  return user.id;
};

const clearCaches = () => {
  consultantDeckingCache = null;
  consultantLaneCache = null;
  consultantTabCache = null;
};

const getInboxLaneIdForTab = (tabId: ConsultantDeckingTabId) => {
  if (tabId === FALLBACK_TAB_ID) return INBOX_LANE_ID;
  return `inbox-${tabId}`;
};

const getSeededTabs = () => DEFAULT_TAB_SEEDS.map((tab) => ({ ...tab }));
const getSeededLanes = () => DEFAULT_LANE_SEEDS.map((lane) => ({ ...lane }));

const persistEntryPositions = async (
  rows: Array<{ id: string; tab_id: ConsultantDeckingTabId; lane_id: ConsultantDeckingLaneId; position: number; updated_by: string | null }>,
) => {
  for (const row of rows) {
    const { error } = await supabase
      .from(ENTRY_TABLE_NAME)
      .update({
        tab_id: row.tab_id,
        lane_id: row.lane_id,
        position: row.position,
        updated_by: row.updated_by,
      })
      .eq('id', row.id);
    if (error) throw error;
  }
};

const fetchConsultantDeckingTabs = async (): Promise<ConsultantDeckingTab[]> => {
  const { data, error } = await supabase
    .from(TAB_TABLE_NAME)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });
  if (error) throw error;
  const tabs = (data || []).map((row: ConsultantDeckingTabRow) => mapTabRow(row));
  if (!tabs.length) return getSeededTabs();
  return sortTabs(tabs.filter((tab) => tab.isActive));
};

const fetchConsultantDeckingLanes = async (): Promise<ConsultantDeckingLane[]> => {
  const { data, error } = await supabase
    .from(LANE_TABLE_NAME)
    .select('*')
    .order('tab_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });
  if (error) throw error;
  const lanes = (data || []).map((row: ConsultantDeckingLaneRow) => mapLaneRow(row));
  if (!lanes.length) return getSeededLanes();
  return sortLanes(lanes.filter((lane) => lane.isActive));
};

const fetchConsultantDeckingEntries = async (): Promise<ConsultantDeckingEntry[]> => {
  const { data, error } = await supabase
    .from(ENTRY_TABLE_NAME)
    .select('*')
    .order('tab_id', { ascending: true })
    .order('lane_id', { ascending: true })
    .order('position', { ascending: true })
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return sortEntries((data || []).map((row: ConsultantDeckingRow) => mapRow(row)));
};

export const listConsultantDeckingTabs = async (options?: { force?: boolean }): Promise<ConsultantDeckingTab[]> => {
  const force = Boolean(options?.force);
  if (!force && consultantTabCache) return consultantTabCache;
  if (!force && consultantTabPromise) return consultantTabPromise;
  consultantTabPromise = fetchConsultantDeckingTabs()
    .then((tabs) => {
      consultantTabCache = tabs;
      return tabs;
    })
    .finally(() => {
      consultantTabPromise = null;
    });
  return consultantTabPromise;
};

export const listConsultantDeckingLanes = async (options?: { force?: boolean }): Promise<ConsultantDeckingLane[]> => {
  const force = Boolean(options?.force);
  if (!force && consultantLaneCache) return consultantLaneCache;
  if (!force && consultantLanePromise) return consultantLanePromise;
  consultantLanePromise = fetchConsultantDeckingLanes()
    .then((lanes) => {
      consultantLaneCache = lanes;
      return lanes;
    })
    .finally(() => {
      consultantLanePromise = null;
    });
  return consultantLanePromise;
};

export const listConsultantDeckingEntries = async (options?: { force?: boolean }): Promise<ConsultantDeckingEntry[]> => {
  const force = Boolean(options?.force);
  if (!force && consultantDeckingCache) return consultantDeckingCache;
  if (!force && consultantDeckingPromise) return consultantDeckingPromise;
  consultantDeckingPromise = fetchConsultantDeckingEntries()
    .then((entries) => {
      consultantDeckingCache = entries;
      return entries;
    })
    .finally(() => {
      consultantDeckingPromise = null;
    });
  return consultantDeckingPromise;
};

export const preloadConsultantDeckingEntries = async (): Promise<void> => {
  try {
    await Promise.all([listConsultantDeckingTabs(), listConsultantDeckingLanes(), listConsultantDeckingEntries()]);
  } catch (error) {
    const message = String((error as Error)?.message || '').toLowerCase();
    if (message.includes('session') || message.includes('jwt') || message.includes('permission')) return;
    throw error;
  }
};

export const createConsultantDeckingTab = async (input: { title: string; description?: string | null }): Promise<{ id: string }> => {
  const userId = await requireUserId();
  const title = normalizeName(input.title || '');
  if (!title) throw new Error('Tab title is required.');
  const tabs = await listConsultantDeckingTabs({ force: true });
  const id = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from(TAB_TABLE_NAME).insert({
    id,
    title,
    description: input.description ? normalizeName(input.description) : null,
    sort_order: tabs.length,
    is_active: true,
    max_lanes: MAX_LANES_PER_TAB,
    created_by: userId,
    updated_by: userId,
  });
  if (error) throw error;
  await supabase.from(LANE_TABLE_NAME).insert({
    id: getInboxLaneIdForTab(id),
    tab_id: id,
    label: 'Unassigned patients',
    sort_order: 0,
    is_active: true,
    accent_token: 'slate',
    created_by: userId,
    updated_by: userId,
  });
  clearCaches();
  return { id };
};

export const updateConsultantDeckingTab = async (
  id: ConsultantDeckingTabId,
  patch: { title?: string; description?: string | null; isActive?: boolean },
): Promise<void> => {
  const userId = await requireUserId();
  const payload: Record<string, unknown> = { updated_by: userId };
  if (typeof patch.title === 'string') {
    const title = normalizeName(patch.title);
    if (!title) throw new Error('Tab title is required.');
    payload.title = title;
  }
  if (patch.description !== undefined) payload.description = patch.description ? normalizeName(patch.description) : null;
  if (typeof patch.isActive === 'boolean') payload.is_active = patch.isActive;
  const { error } = await supabase.from(TAB_TABLE_NAME).update(payload).eq('id', id);
  if (error) throw error;
  clearCaches();
};

export const reorderConsultantDeckingTabs = async (tabs: ConsultantDeckingTab[]): Promise<void> => {
  const userId = await requireUserId();
  for (const [index, tab] of tabs.entries()) {
    const { error } = await supabase.from(TAB_TABLE_NAME).update({ sort_order: index, updated_by: userId }).eq('id', tab.id);
    if (error) throw error;
  }
  clearCaches();
};

export const createConsultantDeckingLane = async (input: {
  tabId: ConsultantDeckingTabId;
  label: string;
  accentToken?: string | null;
}): Promise<{ id: string }> => {
  const userId = await requireUserId();
  const label = normalizeName(input.label || '');
  if (!label) throw new Error('Lane name is required.');
  const tabs = await listConsultantDeckingTabs({ force: true });
  const targetTab = tabs.find((tab) => tab.id === input.tabId);
  if (!targetTab) throw new Error('Selected deck tab was not found.');
  const currentLanes = await listConsultantDeckingLanes({ force: true });
  const consultantLaneCount = currentLanes.filter((lane) => lane.tabId === input.tabId && lane.id !== getInboxLaneIdForTab(input.tabId)).length;
  if (consultantLaneCount >= targetTab.maxLanes) throw new Error(`This tab can only hold ${targetTab.maxLanes} consultant lanes.`);
  const id = makeLaneId(label);
  const payload = {
    id,
    tab_id: input.tabId,
    label,
    sort_order: currentLanes.filter((lane) => lane.tabId === input.tabId).length,
    is_active: true,
    accent_token: input.accentToken || DEFAULT_LANE_ACCENTS[consultantLaneCount % DEFAULT_LANE_ACCENTS.length],
    created_by: userId,
    updated_by: userId,
  };
  const { error } = await supabase.from(LANE_TABLE_NAME).insert(payload);
  if (error) throw error;
  clearCaches();
  return { id };
};

export const updateConsultantDeckingLane = async (
  id: string,
  patch: { label?: string; accentToken?: string | null; isActive?: boolean },
): Promise<void> => {
  const userId = await requireUserId();
  const payload: Record<string, unknown> = { updated_by: userId };
  if (typeof patch.label === 'string') {
    const label = normalizeName(patch.label);
    if (!label) throw new Error('Lane name is required.');
    payload.label = label;
  }
  if (patch.accentToken !== undefined) payload.accent_token = patch.accentToken;
  if (typeof patch.isActive === 'boolean') payload.is_active = patch.isActive;
  const { error } = await supabase.from(LANE_TABLE_NAME).update(payload).eq('id', id);
  if (error) throw error;
  clearCaches();
};

export const reorderConsultantDeckingLanes = async (lanes: ConsultantDeckingLane[]): Promise<void> => {
  const userId = await requireUserId();
  for (const [index, lane] of lanes.entries()) {
    const { error } = await supabase.from(LANE_TABLE_NAME).update({ sort_order: index, updated_by: userId }).eq('id', lane.id);
    if (error) throw error;
  }
  clearCaches();
};

export const archiveConsultantDeckingLane = async (laneId: ConsultantDeckingLaneId): Promise<void> => {
  const lanes = await listConsultantDeckingLanes({ force: true });
  const targetLane = lanes.find((lane) => lane.id === laneId);
  if (!targetLane) return;
  if (laneId === getInboxLaneIdForTab(targetLane.tabId)) throw new Error('Inbox cannot be archived.');
  const userId = await requireUserId();
  const currentEntries = await listConsultantDeckingEntries({ force: true });
  const laneEntries = currentEntries.filter((entry) => entry.laneId === laneId);
  const inboxLaneId = getInboxLaneIdForTab(targetLane.tabId);
  if (laneEntries.length > 0) {
    let movedEntries = currentEntries;
    for (const entry of laneEntries) {
      const inboxCount = movedEntries.filter((item) => item.tabId === targetLane.tabId && item.laneId === inboxLaneId).length;
      movedEntries = reorderDeckingEntries(movedEntries, entry.id, targetLane.tabId, inboxLaneId, inboxCount);
    }
    await persistEntryPositions(
      movedEntries.map((entry) => ({
        id: entry.id,
        tab_id: entry.tabId,
        lane_id: entry.laneId,
        position: entry.position,
        updated_by: userId,
      })),
    );
  }
  const { error } = await supabase.from(LANE_TABLE_NAME).update({ is_active: false, updated_by: userId }).eq('id', laneId);
  if (error) throw error;
  clearCaches();
};

export const createConsultantDeckingEntry = async (input: ConsultantDeckingEntryInput): Promise<{ id: string }> => {
  const userId = await requireUserId();
  const patientName = normalizeName(input.patientName || '');
  if (!patientName) throw new Error('Patient name is required.');
  const currentEntries = await listConsultantDeckingEntries({ force: true });
  const laneId = input.laneId || getInboxLaneIdForTab(input.tabId);
  const nextPosition = currentEntries.filter((entry) => entry.tabId === input.tabId && entry.laneId === laneId).length;
  const payload = {
    patient_name: patientName,
    patient_age: normalizeAge(input.patientAge),
    patient_sex: input.patientSex || null,
    tab_id: input.tabId,
    difficulty: input.difficulty,
    priority_level: input.priorityLevel,
    patient_source: input.patientSource,
    study_date: input.studyDate || null,
    study_time: input.studyTime || null,
    study_description: input.studyDescription ? normalizeStudyDescription(input.studyDescription) : null,
    brief_impression: input.briefImpression ? normalizeBriefImpression(input.briefImpression) : null,
    lane_id: laneId,
    column_key: toLegacyColumnKey(laneId),
    position: nextPosition,
    created_by: userId,
    updated_by: userId,
  };
  const { data, error } = await supabase.from(ENTRY_TABLE_NAME).insert(payload).select('id').single();
  if (error) throw error;
  consultantDeckingCache = null;
  return { id: String(data.id) };
};

export const updateConsultantDeckingEntry = async (id: string, patch: Partial<ConsultantDeckingEntryInput>): Promise<void> => {
  const userId = await requireUserId();
  const payload: Record<string, unknown> = { updated_by: userId };
  if (typeof patch.patientName === 'string') {
    const patientName = normalizeName(patch.patientName);
    if (!patientName) throw new Error('Patient name is required.');
    payload.patient_name = patientName;
  }
  if (typeof patch.patientAge === 'number') payload.patient_age = normalizeAge(patch.patientAge);
  if (patch.patientAge === null) payload.patient_age = null;
  if (patch.patientSex === 'M' || patch.patientSex === 'F') payload.patient_sex = patch.patientSex;
  if (patch.patientSex === null) payload.patient_sex = null;
  if (typeof patch.tabId === 'string') payload.tab_id = patch.tabId;
  if (typeof patch.difficulty === 'string') payload.difficulty = patch.difficulty;
  if (typeof patch.priorityLevel === 'string') payload.priority_level = patch.priorityLevel;
  if (typeof patch.patientSource === 'string') payload.patient_source = patch.patientSource;
  if (typeof patch.studyDate === 'string') payload.study_date = patch.studyDate || null;
  if (typeof patch.studyTime === 'string') payload.study_time = patch.studyTime || null;
  if (typeof patch.studyDescription === 'string') payload.study_description = patch.studyDescription ? normalizeStudyDescription(patch.studyDescription) : null;
  if (typeof patch.briefImpression === 'string') payload.brief_impression = patch.briefImpression ? normalizeBriefImpression(patch.briefImpression) : null;
  if (typeof patch.laneId === 'string') {
    payload.lane_id = patch.laneId;
    payload.column_key = toLegacyColumnKey(patch.laneId);
  }
  const { error } = await supabase.from(ENTRY_TABLE_NAME).update(payload).eq('id', id);
  if (error) throw error;
  consultantDeckingCache = null;
};

export const deleteConsultantDeckingEntry = async (id: string): Promise<void> => {
  const currentEntries = await listConsultantDeckingEntries({ force: true });
  const target = currentEntries.find((entry) => entry.id === id);
  if (!target) return;
  const userId = await requireUserId();
  const remaining = currentEntries.filter((entry) => entry.id !== id);
  const reorderedSource = remaining
    .filter((entry) => entry.tabId === target.tabId && entry.laneId === target.laneId)
    .map((entry, index) => ({ id: entry.id, tab_id: entry.tabId, lane_id: entry.laneId, position: index, updated_by: userId }));
  const { error } = await supabase.from(ENTRY_TABLE_NAME).delete().eq('id', id);
  if (error) throw error;
  if (reorderedSource.length) await persistEntryPositions(reorderedSource);
  consultantDeckingCache = null;
};

export const reorderDeckingEntries = (
  entries: ConsultantDeckingEntry[],
  entryId: string,
  nextTabId: ConsultantDeckingTabId,
  nextLaneId: ConsultantDeckingLaneId,
  nextPosition: number,
) => {
  const target = entries.find((entry) => entry.id === entryId);
  if (!target) return sortEntries(entries);
  const remainder = entries.filter((entry) => entry.id !== entryId);
  const destinationEntries = remainder
    .filter((entry) => entry.tabId === nextTabId && entry.laneId === nextLaneId)
    .sort((left, right) => left.position - right.position);
  const boundedPosition = Math.max(0, Math.min(nextPosition, destinationEntries.length));
  const updatedEntry: ConsultantDeckingEntry = { ...target, tabId: nextTabId, laneId: nextLaneId, position: boundedPosition };
  const nextEntries = [...remainder, updatedEntry].map((entry) => ({ ...entry }));
  const laneKeys = Array.from(new Set(nextEntries.map((entry) => `${entry.tabId}:${entry.laneId}`)));
  for (const laneKey of laneKeys) {
    const [tabId, laneId] = laneKey.split(':');
    const laneEntries = nextEntries
      .filter((entry) => entry.tabId === tabId && entry.laneId === laneId)
      .sort((left, right) => {
        if (tabId === nextTabId && laneId === nextLaneId) {
          if (left.id === entryId) return boundedPosition - right.position;
          if (right.id === entryId) return left.position - boundedPosition;
        }
        return left.position - right.position;
      });
    laneEntries.forEach((entry, index) => { entry.position = index; });
  }
  return sortEntries(nextEntries);
};

export const moveConsultantDeckingEntry = async (
  id: string,
  nextTabId: ConsultantDeckingTabId,
  nextLaneId: ConsultantDeckingLaneId,
  nextPosition: number,
): Promise<void> => {
  const userId = await requireUserId();
  const currentEntries = await listConsultantDeckingEntries({ force: true });
  const nextEntries = reorderDeckingEntries(currentEntries, id, nextTabId, nextLaneId, nextPosition);
  await persistEntryPositions(
    nextEntries.map((entry) => ({
      id: entry.id,
      tab_id: entry.tabId,
      lane_id: entry.laneId,
      position: entry.position,
      updated_by: userId,
    })),
  );
  consultantDeckingCache = null;
};

export const subscribeToConsultantDeckingEntries = (onChange: () => void) => {
  const entryChannel = supabase.channel('consultant_decking_entries_live').on('postgres_changes', { event: '*', schema: 'public', table: ENTRY_TABLE_NAME }, () => {
    consultantDeckingCache = null;
    onChange();
  }).subscribe();
  const laneChannel = supabase.channel('consultant_decking_lanes_live').on('postgres_changes', { event: '*', schema: 'public', table: LANE_TABLE_NAME }, () => {
    consultantLaneCache = null;
    onChange();
  }).subscribe();
  const tabChannel = supabase.channel('consultant_decking_tabs_live').on('postgres_changes', { event: '*', schema: 'public', table: TAB_TABLE_NAME }, () => {
    consultantTabCache = null;
    onChange();
  }).subscribe();
  return () => {
    supabase.removeChannel(entryChannel);
    supabase.removeChannel(laneChannel);
    supabase.removeChannel(tabChannel);
  };
};

export const __testables = {
  INBOX_LANE_ID,
  DEFAULT_TAB_SEEDS,
  DEFAULT_LANE_SEEDS,
  MAX_LANES_PER_TAB,
  normalizeName,
  normalizeStudyDescription,
  normalizeBriefImpression,
  reorderDeckingEntries,
  getInboxLaneIdForTab,
};

export const createArchivedDeckingSession = async (
  title: string,
  entriesSnapshot: ConsultantDeckingEntry[],
  lanesSnapshot: ConsultantDeckingLane[],
  tabsSnapshot: ConsultantDeckingTab[],
): Promise<{ id: string }> => {
  const userId = await requireUserId();
  const { data, error } = await supabase.from(ARCHIVE_TABLE_NAME).insert({
    title: title.trim(),
    entries_snapshot: entriesSnapshot,
    lanes_snapshot: lanesSnapshot,
    tabs_snapshot: tabsSnapshot,
    created_by: userId,
  }).select('id').single();
  if (error) throw error;
  return { id: String(data.id) };
};

export const listArchivedDeckingSessions = async (): Promise<ArchivedDeckingSession[]> => {
  const { data, error } = await supabase.from(ARCHIVE_TABLE_NAME).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    entriesSnapshot: (row.entries_snapshot as ConsultantDeckingEntry[]) || [],
    lanesSnapshot: (row.lanes_snapshot as ConsultantDeckingLane[]) || getSeededLanes(),
    tabsSnapshot: (row.tabs_snapshot as ConsultantDeckingTab[]) || getSeededTabs(),
    createdAt: String(row.created_at),
    createdBy: row.created_by || null,
  }));
};
