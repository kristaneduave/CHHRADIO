import { DutyRosterEntry } from '../types';
import { supabase } from './supabase';

export interface DutyRosterUpsertEntry {
  id?: string;
  userId?: string | null;
  displayName: string;
  role?: string | null;
}

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const mapDutyRow = (row: any): DutyRosterEntry => ({
  id: String(row.id),
  dutyDate: String(row.duty_date),
  userId: row.user_id || null,
  displayName: String(row.display_name || ''),
  role: row.role || null,
  createdBy: String(row.created_by || ''),
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined,
});

export const getLocalTodayKey = (): string => toLocalDateKey(new Date());

export const fetchDutyRosterByDate = async (date: Date): Promise<DutyRosterEntry[]> => {
  const dutyDate = toLocalDateKey(date);
  const { data, error } = await supabase
    .from('daily_duty_roster')
    .select('id,duty_date,user_id,display_name,role,created_by,created_at,updated_at')
    .eq('duty_date', dutyDate)
    .order('display_name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapDutyRow);
};

export const removeDutyRosterEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('daily_duty_roster').delete().eq('id', id);
  if (error) throw error;
};

export const upsertDutyRosterForDate = async (
  date: Date,
  entries: DutyRosterUpsertEntry[],
): Promise<DutyRosterEntry[]> => {
  const dutyDate = toLocalDateKey(date);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('User session unavailable.');
  }
  const currentUserId = authData.user.id;

  const normalizedEntries = entries
    .map((entry) => ({
      id: entry.id,
      userId: entry.userId || null,
      displayName: entry.displayName.trim(),
      role: entry.role?.trim() || null,
    }))
    .filter((entry) => Boolean(entry.displayName));

  const dedupe = new Set<string>();
  for (const entry of normalizedEntries) {
    const key = entry.displayName.toLowerCase();
    if (dedupe.has(key)) {
      throw new Error(`Duplicate name in roster: ${entry.displayName}`);
    }
    dedupe.add(key);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('daily_duty_roster')
    .select('id')
    .eq('duty_date', dutyDate);
  if (existingError) throw existingError;

  const existingIds = new Set((existingRows || []).map((row: any) => String(row.id)));
  const incomingIds = new Set(normalizedEntries.map((entry) => entry.id).filter(Boolean) as string[]);
  const idsToDelete = Array.from(existingIds).filter((id) => !incomingIds.has(id));

  if (idsToDelete.length) {
    const { error: deleteError } = await supabase.from('daily_duty_roster').delete().in('id', idsToDelete);
    if (deleteError) throw deleteError;
  }

  const entriesToInsert = normalizedEntries.filter((entry) => !entry.id);
  if (entriesToInsert.length) {
    const { error: insertError } = await supabase.from('daily_duty_roster').insert(
      entriesToInsert.map((entry) => ({
        duty_date: dutyDate,
        user_id: entry.userId,
        display_name: entry.displayName,
        role: entry.role,
        created_by: currentUserId,
      })),
    );
    if (insertError) throw insertError;
  }

  const entriesToUpdate = normalizedEntries.filter((entry) => Boolean(entry.id));
  for (const entry of entriesToUpdate) {
    const { error: updateError } = await supabase
      .from('daily_duty_roster')
      .update({
        user_id: entry.userId,
        display_name: entry.displayName,
        role: entry.role,
      })
      .eq('id', entry.id as string);
    if (updateError) throw updateError;
  }

  return fetchDutyRosterByDate(date);
};
