import {
  ConsultantDeckingColumnKey,
  ConsultantDeckingDifficulty,
  ConsultantDeckingEntry,
  ConsultantDeckingEntryInput,
  ConsultantDeckingPatientSource,
} from '../types';
import { supabase } from './supabase';

const TABLE_NAME = 'consultant_decking_entries';

const COLUMN_ORDER: ConsultantDeckingColumnKey[] = ['inbox', 'reynes', 'alvarez', 'co-ng', 'vano-yu'];
const VALID_DIFFICULTIES: ConsultantDeckingDifficulty[] = ['easy', 'medium', 'hard'];
const VALID_PATIENT_SOURCES: ConsultantDeckingPatientSource[] = ['inpatient', 'er', 'outpatient'];

type ConsultantDeckingRow = {
  id: string;
  patient_name: string;
  difficulty: ConsultantDeckingDifficulty;
  patient_source: ConsultantDeckingPatientSource;
  column_key: ConsultantDeckingColumnKey;
  position: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

let consultantDeckingCache: ConsultantDeckingEntry[] | null = null;
let consultantDeckingPromise: Promise<ConsultantDeckingEntry[]> | null = null;

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ');

const assertDifficulty = (value: string): ConsultantDeckingDifficulty => {
  if (VALID_DIFFICULTIES.includes(value as ConsultantDeckingDifficulty)) {
    return value as ConsultantDeckingDifficulty;
  }
  throw new Error(`Unsupported consultant decking difficulty: ${value}`);
};

const assertPatientSource = (value: string): ConsultantDeckingPatientSource => {
  if (VALID_PATIENT_SOURCES.includes(value as ConsultantDeckingPatientSource)) {
    return value as ConsultantDeckingPatientSource;
  }
  throw new Error(`Unsupported consultant decking patient source: ${value}`);
};

const assertColumnKey = (value: string): ConsultantDeckingColumnKey => {
  if (COLUMN_ORDER.includes(value as ConsultantDeckingColumnKey)) {
    return value as ConsultantDeckingColumnKey;
  }
  throw new Error(`Unsupported consultant decking column: ${value}`);
};

const sortEntries = (entries: ConsultantDeckingEntry[]) =>
  [...entries].sort((left, right) => {
    const leftColumnIndex = COLUMN_ORDER.indexOf(left.columnKey);
    const rightColumnIndex = COLUMN_ORDER.indexOf(right.columnKey);
    if (leftColumnIndex !== rightColumnIndex) {
      return leftColumnIndex - rightColumnIndex;
    }
    if (left.position !== right.position) {
      return left.position - right.position;
    }
    const updatedCompare = left.updatedAt.localeCompare(right.updatedAt);
    if (updatedCompare !== 0) {
      return updatedCompare;
    }
    return left.id.localeCompare(right.id);
  });

const mapRow = (row: ConsultantDeckingRow): ConsultantDeckingEntry => ({
  id: String(row.id),
  patientName: normalizeName(String(row.patient_name || '')),
  difficulty: assertDifficulty(String(row.difficulty || '')),
  patientSource: assertPatientSource(String(row.patient_source || '')),
  columnKey: assertColumnKey(String(row.column_key || '')),
  position: Number(row.position || 0),
  createdBy: row.created_by || null,
  updatedBy: row.updated_by || null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const requireUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user?.id) throw new Error('User session unavailable.');
  return user.id;
};

const persistEntryPositions = async (
  rows: Array<{ id: string; column_key: ConsultantDeckingColumnKey; position: number; updated_by: string | null }>,
) => {
  for (const row of rows) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        column_key: row.column_key,
        position: row.position,
        updated_by: row.updated_by,
      })
      .eq('id', row.id);

    if (error) throw error;
  }
};

const fetchConsultantDeckingEntries = async (): Promise<ConsultantDeckingEntry[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('column_key', { ascending: true })
    .order('position', { ascending: true })
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;

  return sortEntries((data || []).map((row: ConsultantDeckingRow) => mapRow(row)));
};

export const listConsultantDeckingEntries = async (options?: { force?: boolean }): Promise<ConsultantDeckingEntry[]> => {
  const force = Boolean(options?.force);

  if (!force && consultantDeckingCache) {
    return consultantDeckingCache;
  }

  if (!force && consultantDeckingPromise) {
    return consultantDeckingPromise;
  }

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
    await listConsultantDeckingEntries();
  } catch (error) {
    const message = String((error as Error)?.message || '').toLowerCase();
    if (message.includes('session') || message.includes('jwt') || message.includes('permission')) {
      return;
    }
    throw error;
  }
};

export const createConsultantDeckingEntry = async (input: ConsultantDeckingEntryInput): Promise<{ id: string }> => {
  const userId = await requireUserId();
  const patientName = normalizeName(input.patientName || '');
  if (!patientName) {
    throw new Error('Patient name is required.');
  }

  const currentEntries = await listConsultantDeckingEntries({ force: true });
  const columnKey = input.columnKey || 'inbox';
  const nextPosition = currentEntries.filter((entry) => entry.columnKey === columnKey).length;

  const payload = {
    patient_name: patientName,
    difficulty: input.difficulty,
    patient_source: input.patientSource,
    column_key: columnKey,
    position: nextPosition,
    created_by: userId,
    updated_by: userId,
  };

  const { data, error } = await supabase.from(TABLE_NAME).insert(payload).select('id').single();
  if (error) throw error;

  consultantDeckingCache = null;
  return { id: String(data.id) };
};

export const updateConsultantDeckingEntry = async (
  id: string,
  patch: Partial<ConsultantDeckingEntryInput>,
): Promise<void> => {
  const userId = await requireUserId();
  const payload: Record<string, unknown> = {
    updated_by: userId,
  };

  if (typeof patch.patientName === 'string') {
    const patientName = normalizeName(patch.patientName);
    if (!patientName) {
      throw new Error('Patient name is required.');
    }
    payload.patient_name = patientName;
  }
  if (typeof patch.difficulty === 'string') payload.difficulty = patch.difficulty;
  if (typeof patch.patientSource === 'string') payload.patient_source = patch.patientSource;
  if (typeof patch.columnKey === 'string') payload.column_key = patch.columnKey;

  const { error } = await supabase.from(TABLE_NAME).update(payload).eq('id', id);
  if (error) throw error;

  consultantDeckingCache = null;
};

export const deleteConsultantDeckingEntry = async (id: string): Promise<void> => {
  const currentEntries = await listConsultantDeckingEntries({ force: true });
  const target = currentEntries.find((entry) => entry.id === id);
  if (!target) {
    return;
  }

  const userId = await requireUserId();
  const remaining = currentEntries.filter((entry) => entry.id !== id);
  const reorderedSource = remaining
    .filter((entry) => entry.columnKey === target.columnKey)
    .map((entry, index) => ({
      id: entry.id,
      column_key: entry.columnKey,
      position: index,
      updated_by: userId,
    }));

  const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
  if (error) throw error;

  if (reorderedSource.length) {
    await persistEntryPositions(reorderedSource);
  }

  consultantDeckingCache = null;
};

export const reorderDeckingEntries = (
  entries: ConsultantDeckingEntry[],
  entryId: string,
  nextColumnKey: ConsultantDeckingColumnKey,
  nextPosition: number,
) => {
  const target = entries.find((entry) => entry.id === entryId);
  if (!target) {
    return sortEntries(entries);
  }

  const remainder = entries.filter((entry) => entry.id !== entryId);
  const destinationEntries = remainder
    .filter((entry) => entry.columnKey === nextColumnKey)
    .sort((left, right) => left.position - right.position);
  const boundedPosition = Math.max(0, Math.min(nextPosition, destinationEntries.length));

  const updatedEntry: ConsultantDeckingEntry = {
    ...target,
    columnKey: nextColumnKey,
    position: boundedPosition,
  };

  const nextEntries = [...remainder, updatedEntry].map((entry) => ({ ...entry }));
  for (const columnKey of COLUMN_ORDER) {
    const columnEntries = nextEntries
      .filter((entry) => entry.columnKey === columnKey)
      .sort((left, right) => {
        if (columnKey === nextColumnKey) {
          if (left.id === entryId) return boundedPosition - right.position;
          if (right.id === entryId) return left.position - boundedPosition;
        }
        return left.position - right.position;
      });

    columnEntries.forEach((entry, index) => {
      entry.position = index;
    });
  }

  return sortEntries(nextEntries);
};

export const moveConsultantDeckingEntry = async (
  id: string,
  nextColumnKey: ConsultantDeckingColumnKey,
  nextPosition: number,
): Promise<void> => {
  const userId = await requireUserId();
  const currentEntries = await listConsultantDeckingEntries({ force: true });
  const nextEntries = reorderDeckingEntries(currentEntries, id, nextColumnKey, nextPosition);

  const payload = nextEntries.map((entry) => ({
    id: entry.id,
    column_key: entry.columnKey,
    position: entry.position,
    updated_by: entry.id === id ? userId : entry.updatedBy,
  }));

  await persistEntryPositions(payload);

  consultantDeckingCache = null;
};

export const subscribeToConsultantDeckingEntries = (onChange: () => void) => {
  const channel = supabase
    .channel('consultant_decking_entries_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => {
      consultantDeckingCache = null;
      onChange();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const __testables = {
  COLUMN_ORDER,
  normalizeName,
  reorderDeckingEntries,
};
