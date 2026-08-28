import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

type TestSession = {
  access_token: string;
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
};

const {
  getSession,
  onAuthStateChange,
  maybeSingle,
  startAppBootstrap,
  bootScreenMounted,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  maybeSingle: vi.fn(),
  startAppBootstrap: vi.fn(),
  bootScreenMounted: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./services/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession, onAuthStateChange },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  },
}));

vi.mock('./services/appBootstrapService', () => ({ startAppBootstrap }));
vi.mock('./utils/theme', () => ({ useThemePreference: vi.fn() }));
vi.mock('./services/newsfeedService', () => ({
  fetchUnreadNotificationsCount: vi.fn(async () => 0),
  subscribeToNotifications: vi.fn(() => vi.fn()),
}));
vi.mock('./services/newsfeedPresenceService', () => ({
  createAppPresenceTracker: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    setVisible: vi.fn(),
  })),
}));
vi.mock('./services/dashboardSnapshotService', () => ({
  APP_OPEN_STORAGE_KEY: 'app-open',
  SNAPSHOT_BASELINE_STORAGE_KEY: 'snapshot-baseline',
  markSnapshotSectionsSeenForScreen: vi.fn(),
}));
vi.mock('./components/AppBootScreen', () => ({
  default: ({ mode }: { mode?: string }) => {
    useEffect(() => {
      bootScreenMounted();
    }, []);
    return <div data-testid="app-boot-screen" data-mode={mode} />;
  },
}));
vi.mock('./components/Layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('./components/Dashboard', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('./components/LoginScreen', () => ({ default: () => <div>Login</div> }));
vi.mock('./components/ProfileCompletionScreen', () => ({ default: () => <div>Profile setup</div> }));
vi.mock('./components/ToastHost', () => ({ default: () => null }));

describe('App startup', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getSession.mockReset();
    onAuthStateChange.mockReset();
    maybeSingle.mockReset();
    startAppBootstrap.mockReset();
    bootScreenMounted.mockReset();
  });

  it('keeps one loader mounted and starts bootstrap once for duplicate same-user auth events', async () => {
    const session: TestSession = {
      access_token: 'token-a',
      user: {
        id: 'user-1',
        email: 'doctor@example.com',
        user_metadata: {},
      },
    };
    let authStateCallback: ((event: string, nextSession: TestSession | null) => void) | null = null;

    getSession.mockResolvedValue({ data: { session } });
    onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    maybeSingle.mockResolvedValue({
      data: { full_name: 'Doctor Test', nickname: 'Dr. Test', role: 'resident' },
      error: null,
    });
    startAppBootstrap.mockImplementation(() => new Promise(() => undefined));

    render(<App />);

    await waitFor(() => expect(startAppBootstrap).toHaveBeenCalledTimes(1));
    expect(bootScreenMounted).toHaveBeenCalledTimes(1);

    await act(async () => {
      authStateCallback?.('SIGNED_IN', { ...session, user: { ...session.user } });
      await Promise.resolve();
    });

    expect(startAppBootstrap).toHaveBeenCalledTimes(1);
    expect(bootScreenMounted).toHaveBeenCalledTimes(1);
  });
});
