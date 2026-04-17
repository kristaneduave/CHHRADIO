import { describe, expect, it } from 'vitest';
import {
  canAccessResidentFeatures,
  canManageAnyAnnouncement,
  canManageAuntMinnieRoom,
  canManageCalendar,
  canManageQuiz,
  canManageUsers,
  getCapabilitySet,
  normalizeUserRoles,
} from './roles';

describe('roles capability helpers', () => {
  it('grants resident learner access to elevated users when resident is in the role set', () => {
    expect(canAccessResidentFeatures(['admin', 'resident'])).toBe(true);
    expect(canAccessResidentFeatures(['moderator', 'resident'])).toBe(true);
  });

  it('keeps administrative capabilities separate from resident access', () => {
    expect(canManageUsers(['admin', 'resident'])).toBe(true);
    expect(canManageCalendar(['moderator', 'resident'])).toBe(true);
    expect(canManageQuiz(['admin', 'resident'])).toBe(true);
    expect(canManageAuntMinnieRoom(['training_officer', 'resident'])).toBe(true);
    expect(canManageAuntMinnieRoom(['consultant', 'resident'])).toBe(true);
    expect(canManageAuntMinnieRoom(['resident'])).toBe(true);
  });

  it('builds a capability set that reflects combined roles', () => {
    expect(getCapabilitySet(['admin', 'resident'])).toMatchObject({
      canManageUsers: true,
      canManageCalendar: true,
      canManageQuiz: true,
      canAccessResidentFeatures: true,
      canManageAuntMinnieRoom: true,
      canManageAnyAnnouncement: true,
    });
  });

  it('keeps consultant announcement management without granting full admin capabilities', () => {
    expect(canManageAnyAnnouncement(['consultant'])).toBe(false);
    expect(getCapabilitySet(['consultant'])).toMatchObject({
      canAuthorAnnouncements: true,
      canManageCalendar: false,
      canManageUsers: false,
    });
  });

  it('keeps training officer exclusive when role sets are normalized', () => {
    expect(normalizeUserRoles(['training_officer', 'resident'])).toEqual(['training_officer']);
    expect(normalizeUserRoles(['resident', 'moderator'])).toEqual(['resident', 'moderator']);
  });
});
