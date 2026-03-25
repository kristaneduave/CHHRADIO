import { supabase } from './supabase';
import { UserRole } from '../types';
import { ensurePrimaryRoleIncluded, getPrimaryRole, normalizeUserRoles } from '../utils/roles';

type UserRolesRow = {
  role: string | null;
};

export interface UserRoleState {
  primaryRole: UserRole;
  roles: UserRole[];
}

const loadRolesFromAssignments = async (userId: string): Promise<UserRole[] | null> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (
      message.includes('relation') ||
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('user_roles')
    ) {
      return null;
    }
    throw error;
  }

  return normalizeUserRoles((data || []).map((row) => (row as UserRolesRow).role));
};

export const getUserRoleState = async (userId: string): Promise<UserRoleState> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const primaryRole = getPrimaryRole([], data?.role);
  const assignmentRoles = await loadRolesFromAssignments(userId);
  const roles = ensurePrimaryRoleIncluded(assignmentRoles, data?.role);

  return {
    primaryRole,
    roles,
  };
};

export const getCurrentUserRoleState = async (): Promise<UserRoleState | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getUserRoleState(user.id);
};
