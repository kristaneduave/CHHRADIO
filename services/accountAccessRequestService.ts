import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  AccountAccessRequestInput,
  AccountAccessRequestStatus,
  AccountAccessRequestStatusType,
  StaffAccountAccessRequest,
} from '../types';
import { normalizeUserRole } from '../utils/roles';

type AccountAccessRequestRow = {
  id?: string;
  public_token: string;
  full_name?: string;
  email: string;
  requested_role: string;
  year_level: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  admin_notes?: string | null;
};

const normalizeStatus = (value: unknown): AccountAccessRequestStatusType => {
  const status = String(value || '').toLowerCase();
  if (status === 'approved' || status === 'rejected') return status;
  return 'pending';
};

const normalizeRole = (value: unknown): 'resident' | 'consultant' | 'fellow' => {
  const role = normalizeUserRole(String(value || ''));
  if (role === 'consultant' || role === 'fellow') return role;
  return 'resident';
};

const mapRow = (row: AccountAccessRequestRow): AccountAccessRequestStatus => ({
  publicToken: row.public_token,
  email: row.email,
  requestedRole: normalizeRole(row.requested_role),
  yearLevel: row.year_level,
  status: normalizeStatus(row.status),
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
});

const isDuplicatePendingError = (error: PostgrestError | null): boolean => {
  if (!error) return false;
  return error.code === '23505' && error.message.toLowerCase().includes('pending');
};

export const createAccountAccessRequest = async (
  input: AccountAccessRequestInput,
): Promise<AccountAccessRequestStatus> => {
  const publicToken = crypto.randomUUID();
  const payload = {
    public_token: publicToken,
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    requested_role: input.requestedRole,
    year_level: input.yearLevel?.trim() || null,
  };

  const { error } = await supabase
    .from('account_access_requests')
    .insert(payload);

  if (isDuplicatePendingError(error)) {
    throw new Error('A pending request already exists for this email.');
  }
  if (error) {
    throw new Error(error.message || 'Failed to create account request.');
  }

  const status = await fetchAccountAccessRequestStatus(publicToken);
  if (!status) {
    throw new Error('Request submitted but status lookup failed.');
  }
  return status;
};

export const fetchAccountAccessRequestStatus = async (
  publicToken: string,
): Promise<AccountAccessRequestStatus | null> => {
  if (!publicToken) return null;

  const { data, error } = await supabase
    .rpc('get_account_access_request_status', {
      p_public_token: publicToken,
    });

  if (error) {
    throw new Error(error.message || 'Failed to load account request status.');
  }
  const row = (Array.isArray(data) ? data[0] : null) as AccountAccessRequestRow | null;
  if (!row) return null;
  return mapRow(row);
};

export const listAccountAccessRequestsForStaff = async (): Promise<StaffAccountAccessRequest[]> => {
  const { data, error } = await supabase
    .from('account_access_requests')
    .select('id, public_token, full_name, email, requested_role, year_level, status, admin_notes, created_at, reviewed_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message || 'Failed to load access requests.');

  return ((data || []) as AccountAccessRequestRow[]).map((row) => ({
    ...mapRow(row),
    id: String(row.id || ''),
    fullName: String(row.full_name || '').trim(),
    adminNotes: row.admin_notes || null,
  }));
};

export const reviewAccountAccessRequest = async (
  requestId: string,
  status: 'approved' | 'rejected',
  adminNotes?: string,
): Promise<void> => {
  const { error } = await supabase
    .rpc('review_account_access_request', {
      p_request_id: requestId,
      p_status: status,
      p_admin_notes: adminNotes?.trim() || null,
    });

  if (error) throw new Error(error.message || 'Failed to review access request.');
};
