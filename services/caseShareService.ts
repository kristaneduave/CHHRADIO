import { supabase } from './supabase';
import { CaseShareRecord } from '../types';

const PUBLIC_CASE_PATH_PREFIX = '/shared/case';

const normalizeCaseShareRecord = (value: any): CaseShareRecord => ({
  case_id: String(value?.case_id || value?.share_case_id || ''),
  public_token: String(value?.public_token || ''),
  is_active: Boolean(value?.is_active),
  created_by: value?.created_by ? String(value.created_by) : null,
  created_at: String(value?.created_at || ''),
  updated_at: String(value?.updated_at || ''),
  revoked_at: value?.revoked_at ? String(value.revoked_at) : null,
});

const getSingleRpcRow = (data: unknown) => {
  if (Array.isArray(data)) {
    return data[0] || null;
  }
  return data || null;
};

export const getCaseShareErrorMessage = (error: unknown, fallback = 'Please try again.') => {
  if (!error) return fallback;
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    const parts = [
      candidate.message,
      candidate.details,
      candidate.hint,
      candidate.error_description,
      candidate.code,
    ]
      .filter((value) => typeof value === 'string' && String(value).trim().length > 0)
      .map((value) => String(value).trim());

    if (parts.length > 0) {
      return parts.join(' | ');
    }
  }

  const raw = String(error).trim();
  return raw && raw !== '[object Object]' ? raw : fallback;
};

export const buildPublicCaseUrl = (publicToken: string, origin?: string) => {
  const baseOrigin =
    origin
    || (typeof window !== 'undefined' ? window.location.origin : '')
    || '';

  return `${baseOrigin}${PUBLIC_CASE_PATH_PREFIX}/${publicToken}`;
};

export const getPublicCasePath = (publicToken: string) => `${PUBLIC_CASE_PATH_PREFIX}/${publicToken}`;

export const getCaseSharePreviewImage = (caseData: any): string | null => {
  const imageUrls = Array.isArray(caseData?.image_urls) ? caseData.image_urls : [];
  const firstImage = imageUrls.find((value) => typeof value === 'string' && value.trim().length > 0);
  if (firstImage) return firstImage;

  const primaryImage = String(caseData?.image_url || '').trim();
  return primaryImage || null;
};

export const createOrGetCaseShare = async (caseId: string): Promise<CaseShareRecord> => {
  const { data, error } = await supabase.rpc('create_or_get_case_share', { p_case_id: caseId });
  if (error) throw error;

  const row = getSingleRpcRow(data);
  if (!row) {
    throw new Error('Share link was not created.');
  }

  return normalizeCaseShareRecord(row);
};

export const regenerateCaseShare = async (caseId: string): Promise<CaseShareRecord> => {
  const { data, error } = await supabase.rpc('regenerate_case_share', { p_case_id: caseId });
  if (error) throw error;

  const row = getSingleRpcRow(data);
  if (!row) {
    throw new Error('Share link was not regenerated.');
  }

  return normalizeCaseShareRecord(row);
};

export const revokeCaseShare = async (caseId: string): Promise<CaseShareRecord> => {
  const { data, error } = await supabase.rpc('revoke_case_share', { p_case_id: caseId });
  if (error) throw error;

  const row = getSingleRpcRow(data);
  if (!row) {
    throw new Error('Share link was not disabled.');
  }

  return normalizeCaseShareRecord(row);
};

export const resolvePublicCaseByToken = async (publicToken: string): Promise<any | null> => {
  const { data, error } = await supabase.rpc('resolve_public_case_by_token', { p_public_token: publicToken });
  if (error) throw error;

  const row = getSingleRpcRow(data);
  return row || null;
};
