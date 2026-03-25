import { UserRole } from '../types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  faculty: 'Faculty',
  moderator: 'Moderator',
  training_officer: 'Training Officer',
  consultant: 'Consultant',
  resident: 'Resident',
  fellow: 'Fellow',
};

export const DEFAULT_ROLE: UserRole = 'resident';

export const PRIVILEGED_MANAGER_ROLES: UserRole[] = ['admin', 'moderator', 'training_officer'];
export const RESIDENT_ACCESS_ROLES: UserRole[] = ['resident', 'admin', 'moderator'];

export const getRoleLabel = (role?: string | null): string => {
  if (!role) return 'Staff';
  const key = normalizeUserRole(role);
  return ROLE_LABELS[key] || 'Staff';
};

export const normalizeUserRole = (role?: string | null): UserRole => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'faculty') return 'faculty';
  if (normalized === 'moderator') return 'moderator';
  if (normalized === 'training_officer') return 'training_officer';
  if (normalized === 'consultant') return 'consultant';
  if (normalized === 'fellow') return 'fellow';
  return DEFAULT_ROLE;
};

export const ARTICLE_LIBRARY_EDITOR_ROLES: UserRole[] = ['admin', 'moderator', 'training_officer'];
export const QUIZ_MANAGER_ROLES: UserRole[] = ['admin', 'faculty'];
export const AUNT_MINNIE_ROOM_MANAGER_ROLES: UserRole[] = ['admin', 'training_officer'];

export interface CapabilitySet {
  canManageUsers: boolean;
  canManageCalendar: boolean;
  canManageQuiz: boolean;
  canModerateResidentContent: boolean;
  canAccessResidentFeatures: boolean;
  canManageAuntMinnieRoom: boolean;
  canParticipateInAuntMinnie: boolean;
  canAuthorAnnouncements: boolean;
  canManageAnyAnnouncement: boolean;
}

export const normalizeUserRoles = (roles: Array<string | null | undefined> | null | undefined): UserRole[] => {
  const normalized = (roles || [])
    .map((role) => normalizeUserRole(role))
    .filter((role, index, list) => list.indexOf(role) === index);

  if (normalized.length === 0) {
    return [DEFAULT_ROLE];
  }

  return normalized;
};

export const ensurePrimaryRoleIncluded = (roles: UserRole[] | null | undefined, primaryRole?: string | null): UserRole[] => {
  return normalizeUserRoles([primaryRole, ...(roles || [])]);
};

export const hasRole = (
  roleOrRoles: UserRole | UserRole[] | null | undefined,
  expectedRole: UserRole,
): boolean => {
  if (!roleOrRoles) return false;
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return roles.includes(expectedRole);
};

export const hasAnyRole = (
  roleOrRoles: UserRole | UserRole[] | null | undefined,
  expectedRoles: UserRole[],
): boolean => {
  if (!roleOrRoles) return false;
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return expectedRoles.some((role) => roles.includes(role));
};

export const getPrimaryRole = (roles: UserRole[] | null | undefined, fallbackRole?: string | null): UserRole => {
  const normalized = ensurePrimaryRoleIncluded(roles, fallbackRole);
  return normalized[0] || DEFAULT_ROLE;
};

export const canAccessResidentFeatures = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, RESIDENT_ACCESS_ROLES);
};

export const canWriteResidentEndorsements = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, ['resident', 'admin', 'moderator']);
};

export const canModerateResidentEndorsements = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, PRIVILEGED_MANAGER_ROLES);
};

export const canManageCalendar = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, PRIVILEGED_MANAGER_ROLES);
};

export const canManageUsers = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasRole(Array.isArray(roles) ? roles : roles ? [roles] : [], 'admin');
};

export const canManageQuiz = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, QUIZ_MANAGER_ROLES);
};

export const canManageAuntMinnieRoom = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, AUNT_MINNIE_ROOM_MANAGER_ROLES);
};

export const canParticipateInAuntMinnie = (roles?: UserRole[] | UserRole | null): boolean => {
  return normalizeUserRoles(Array.isArray(roles) ? roles : roles ? [roles] : []).length > 0;
};

export const getCapabilitySet = (roles?: UserRole[] | UserRole | null): CapabilitySet => ({
  canManageUsers: canManageUsers(roles),
  canManageCalendar: canManageCalendar(roles),
  canManageQuiz: canManageQuiz(roles),
  canModerateResidentContent: canModerateResidentEndorsements(roles),
  canAccessResidentFeatures: canAccessResidentFeatures(roles),
  canManageAuntMinnieRoom: canManageAuntMinnieRoom(roles),
  canParticipateInAuntMinnie: canParticipateInAuntMinnie(roles),
  canAuthorAnnouncements: canAuthorAnnouncements(roles),
  canManageAnyAnnouncement: canManageAnyAnnouncement(roles),
});

export const canCreateAnnouncements = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, ['admin', 'training_officer', 'moderator', 'consultant']);
};

export const canAuthorAnnouncements = (roles?: UserRole[] | UserRole | null): boolean => {
  return canCreateAnnouncements(roles);
};

export const canManageAnyAnnouncement = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, PRIVILEGED_MANAGER_ROLES);
};

export const canEditArticleLibrary = (roles?: UserRole[] | UserRole | null): boolean => {
  return hasAnyRole(roles, ARTICLE_LIBRARY_EDITOR_ROLES);
};
