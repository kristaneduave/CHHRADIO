import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileScreen from './ProfileScreen';

const mockGetCachedProfileHomeWorkspace = vi.fn();
const mockGetProfileHomeWorkspace = vi.fn();

vi.mock('../services/profileHomeService', () => ({
  fetchHiddenAnnouncementsForProfileHome: vi.fn(async () => []),
  fetchMyCasesForProfileHome: vi.fn(async () => []),
  getCachedProfileHomeWorkspace: (...args: unknown[]) => mockGetCachedProfileHomeWorkspace(...args),
  getProfileHomeWorkspace: (...args: unknown[]) => mockGetProfileHomeWorkspace(...args),
  fetchProfileNotePreview: vi.fn(async () => null),
  fetchProfileRecord: vi.fn(async () => null),
}));

vi.mock('../services/profileNotesService', () => ({
  getMyProfileNote: vi.fn(async () => null),
  upsertMyProfileNote: vi.fn(async () => ({ id: 'note-1', content: '', updated_at: new Date().toISOString() })),
}));

vi.mock('../services/announcementVisibilityService', () => ({
  fetchHiddenAnnouncements: vi.fn(async () => []),
  unhideAllAnnouncementsForUser: vi.fn(async () => undefined),
  unhideAnnouncementForUser: vi.fn(async () => undefined),
}));

vi.mock('../services/newsfeedService', () => ({
  fetchHiddenNotificationsForUser: vi.fn(async () => []),
  unhideAllNotificationsForUser: vi.fn(async () => undefined),
  unhideNotificationForUser: vi.fn(async () => undefined),
}));

vi.mock('../services/userRoleService', () => ({
  getCurrentUserRoleState: vi.fn(async () => ({
    primaryRole: 'admin',
    roles: ['admin'],
  })),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1', email: 'user@example.com' } } })),
      signOut: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/avatar.png' } })),
      })),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  },
}));

vi.mock('./LoadingState', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('./ThemeToggle', () => ({
  default: () => <div>Theme Toggle</div>,
}));

vi.mock('./ResidentBadges', () => ({
  ResidentBadges: () => <div>Resident Badges</div>,
}));

vi.mock('./ProfileEditor', () => ({
  ProfileEditor: () => <div>Profile Editor</div>,
}));

vi.mock('./MyCaseLibrary', () => ({
  MyCaseLibrary: () => <div>My Case Library</div>,
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockGetCachedProfileHomeWorkspace.mockReset();
    mockGetProfileHomeWorkspace.mockReset();
    mockGetCachedProfileHomeWorkspace.mockReturnValue(null);
    mockGetProfileHomeWorkspace.mockResolvedValue({
      profileRecord: {
        full_name: 'Dr. Mira',
        username: 'mira',
        bio: '',
        year_level: 'R2',
        avatar_url: '',
        role: 'resident',
        nickname: 'Mira',
        title: '',
        motto: '',
        work_mode: 'Focused',
        avatar_seed: 'seed-1',
        main_modality: 'CT',
        faction: '',
        map_status: 'At Workstation',
        active_badges: [],
      },
      myCases: [],
      hiddenAnnouncements: [],
      hiddenNotifications: [],
      notePreview: null,
    });
  });

  it('renders the shared profile header and cached shell content', async () => {
    render(<ProfileScreen currentUserId="user-1" />);

    expect(await screen.findByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Your account, private notes, and saved activity.')).toBeInTheDocument();

    await waitFor(() => expect(mockGetProfileHomeWorkspace).toHaveBeenCalled());
    expect(screen.getByText('My Notes')).toBeInTheDocument();
    expect(screen.getByText('Hidden News')).toBeInTheDocument();
  });
});
