import { supabase } from './supabase';
import { getCaseShareErrorMessage } from './caseShareService';
import { updatePublishedCasesViberShareCache } from './publishedCasesService';

export const CASE_VIBER_SHARE_UPDATED_EVENT = 'radcore-case-viber-share-updated';

export interface CaseViberShareStatusRecord {
  case_id: string;
  viber_shared_at: string | null;
  viber_shared_by: string | null;
  viber_shared_by_name: string | null;
}

const normalizeCaseViberShareStatus = (value: unknown): CaseViberShareStatusRecord => {
  const record = (value || {}) as Record<string, unknown>;
  return {
    case_id: String(record.case_id || ''),
    viber_shared_at: record.viber_shared_at ? String(record.viber_shared_at) : null,
    viber_shared_by: record.viber_shared_by ? String(record.viber_shared_by) : null,
    viber_shared_by_name: record.viber_shared_by_name ? String(record.viber_shared_by_name) : null,
  };
};

const getSingleRpcRow = (data: unknown) => {
  if (Array.isArray(data)) {
    return data[0] || null;
  }
  return data || null;
};

export const dispatchCaseViberShareUpdated = (status: CaseViberShareStatusRecord) => {
  updatePublishedCasesViberShareCache(status);

  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CASE_VIBER_SHARE_UPDATED_EVENT, { detail: status }));
};

export const setCaseViberShareStatus = async (
  caseId: string,
  shared: boolean,
): Promise<CaseViberShareStatusRecord> => {
  const { data, error } = await supabase.rpc('set_case_viber_share_status', {
    p_case_id: caseId,
    p_shared: shared,
  });

  if (error) {
    throw new Error(getCaseShareErrorMessage(error, 'Unable to update the Viber share status.'));
  }

  const row = getSingleRpcRow(data);
  if (!row) {
    throw new Error('Viber share status was not updated.');
  }

  const normalized = normalizeCaseViberShareStatus(row);
  dispatchCaseViberShareUpdated(normalized);
  return normalized;
};
