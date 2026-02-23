import { UserRole } from '../types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  training_officer: 'Training Officer',
  consultant: 'Consultant',
  resident: 'Resident',
  fellow: 'Fellow',
};

export const getRoleLabel = (role?: string | null): string => {
  if (!role) return 'Staff';
  const key = normalizeUserRole(role);
  return ROLE_LABELS[key] || 'Staff';
};

export const normalizeUserRole = (role?: string | null): UserRole => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'faculty') return 'moderator';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'moderator') return 'moderator';
  if (normalized === 'training_officer') return 'training_officer';
  if (normalized === 'consultant') return 'consultant';
  if (normalized === 'fellow') return 'fellow';
  return 'resident';
};
