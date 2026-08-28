import { PrivilegedAuditEvent } from '../types';
import { supabase } from './supabase';

const mapAuditEvent = (row: Record<string, unknown>): PrivilegedAuditEvent => ({
  id: Number(row.id),
  actorId: row.actor_id ? String(row.actor_id) : null,
  actorName: String(row.actor_name || 'System'),
  action: String(row.action || ''),
  targetType: String(row.target_type || ''),
  targetId: row.target_id ? String(row.target_id) : null,
  metadata: row.metadata && typeof row.metadata === 'object'
    ? row.metadata as PrivilegedAuditEvent['metadata']
    : {},
  createdAt: String(row.created_at || ''),
});

export const fetchPrivilegedAuditEvents = async (
  limit = 30,
  before?: string | null,
): Promise<PrivilegedAuditEvent[]> => {
  const { data, error } = await supabase.rpc('list_privileged_audit_events', {
    p_limit: Math.min(Math.max(limit, 1), 100),
    p_before: before || null,
  });
  if (error) throw new Error(error.message || 'Unable to load the audit timeline.');
  return (Array.isArray(data) ? data : []).map((row) => mapAuditEvent(row as Record<string, unknown>));
};
