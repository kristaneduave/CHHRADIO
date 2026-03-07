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

const mapRow = (row: PathologyGuidelineRequestRow): PathologyGuidelineRequest => ({
  id: row.id,
  created_by: row.created_by,
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
  return ((data || []) as PathologyGuidelineRequestRow[]).map(mapRow);
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
