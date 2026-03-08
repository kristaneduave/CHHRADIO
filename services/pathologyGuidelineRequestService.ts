import {
  PathologyGuidelineRequest,
  PathologyGuidelineRequestInput,
  PathologyGuidelineRequestStatus,
  PathologyGuidelineRequestType,
  PathologyGuidelineRequestUpdate,
} from '../types';
import { supabase } from './supabase';

type PathologyGuidelineRequestRow = {
  id: string;
  created_by: string;
  request_type: string;
  title: string;
  description: string | null;
  source_url: string | null;
  status: string;
  review_notes: string | null;
  fulfilled_guideline_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileLookupRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  nickname?: string | null;
};

const normalizeRequestType = (value: unknown): PathologyGuidelineRequestType => {
  const requestType = String(value || '').toLowerCase();
  if (requestType === 'pdf_source' || requestType === 'guideline_update') return requestType;
  return 'topic';
};

const normalizeRequestStatus = (value: unknown): PathologyGuidelineRequestStatus => {
  const status = String(value || '').toLowerCase();
  if (status === 'reviewed' || status === 'approved' || status === 'rejected' || status === 'completed') {
    return status;
  }
  return 'pending';
};

const mapRow = (
  row: PathologyGuidelineRequestRow,
  requester?: { requester_name: string | null; requester_username: string | null },
): PathologyGuidelineRequest => ({
  id: row.id,
  created_by: row.created_by,
  requester_name: requester?.requester_name || null,
  requester_username: requester?.requester_username || null,
  request_type: normalizeRequestType(row.request_type),
  title: row.title,
  description: row.description,
  source_url: row.source_url,
  status: normalizeRequestStatus(row.status),
  review_notes: row.review_notes,
  fulfilled_guideline_id: row.fulfilled_guideline_id,
  reviewed_by: row.reviewed_by,
  reviewed_at: row.reviewed_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const createPathologyGuidelineRequest = async (
  input: PathologyGuidelineRequestInput,
): Promise<PathologyGuidelineRequest> => {
  const payload = {
    request_type: input.request_type,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    source_url: input.source_url?.trim() || null,
  };

  const { data, error } = await supabase
    .from('pathology_guideline_requests')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return mapRow(data as PathologyGuidelineRequestRow);
};

export const listPathologyGuidelineRequests = async (): Promise<PathologyGuidelineRequest[]> => {
  const { data, error } = await supabase
    .from('pathology_guideline_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = (data || []) as PathologyGuidelineRequestRow[];
  const requesterIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean)));
  const profileById = new Map<string, { requester_name: string | null; requester_username: string | null }>();

  if (requesterIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, nickname')
      .in('id', requesterIds);

    ((profiles || []) as ProfileLookupRow[]).forEach((profile) => {
      profileById.set(profile.id, {
        requester_name: profile.nickname || profile.full_name || profile.username || 'Unknown requester',
        requester_username: profile.username || null,
      });
    });
  }

  return rows.map((row) => mapRow(row, profileById.get(row.created_by)));
};

export const updatePathologyGuidelineRequest = async (
  id: string,
  patch: PathologyGuidelineRequestUpdate,
): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (typeof patch.status === 'string') payload.status = patch.status;
  if (typeof patch.review_notes === 'string' || patch.review_notes === null) payload.review_notes = patch.review_notes?.trim() || null;
  if (typeof patch.fulfilled_guideline_id === 'string' || patch.fulfilled_guideline_id === null) {
    payload.fulfilled_guideline_id = patch.fulfilled_guideline_id || null;
  }
  if (typeof patch.status === 'string') {
    payload.reviewed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('pathology_guideline_requests')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
};

export const deletePathologyGuidelineRequest = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('pathology_guideline_requests')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
