import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateAnnouncementModal from './CreateAnnouncementModal';

const {
  announcementsSingle,
  createSystemNotification,
  fetchAllRecipientUserIds,
  toastInfo,
  getUser,
  consoleError,
} = vi.hoisted(() => ({
  announcementsSingle: vi.fn(),
  createSystemNotification: vi.fn(),
  fetchAllRecipientUserIds: vi.fn(),
  toastInfo: vi.fn(),
  getUser: vi.fn(),
  consoleError: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUser(...args),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/file.png' } })),
      })),
    },
    from: vi.fn((table: string) => {
      if (table !== 'announcements') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: announcementsSingle,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: announcementsSingle,
            })),
          })),
        })),
      };
    }),
  },
}));

vi.mock('../services/newsfeedService', () => ({
  createSystemNotification: (...args: unknown[]) => createSystemNotification(...args),
  fetchAllRecipientUserIds: (...args: unknown[]) => fetchAllRecipientUserIds(...args),
}));

vi.mock('../services/userRoleService', () => ({
  getCurrentUserRoleState: vi.fn(async () => ({
    primaryRole: 'admin',
    roles: ['admin'],
  })),
}));

vi.mock('../utils/toast', () => ({
  toastInfo: (...args: unknown[]) => toastInfo(...args),
}));

describe('CreateAnnouncementModal', () => {
  beforeEach(() => {
    announcementsSingle.mockReset();
    createSystemNotification.mockReset();
    fetchAllRecipientUserIds.mockReset();
    toastInfo.mockReset();
    getUser.mockReset();

    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
    });

    announcementsSingle.mockResolvedValue({
      data: { id: 'announcement-1' },
      error: null,
    });

    fetchAllRecipientUserIds.mockResolvedValue(['user-2']);
    createSystemNotification.mockResolvedValue(undefined);
    consoleError.mockReset();
    vi.spyOn(console, 'error').mockImplementation(consoleError);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an inline error when formatting cleanup leaves the title or content empty', async () => {
    render(
      <CreateAnnouncementModal
        onClose={() => undefined}
        onSuccess={() => undefined}
        canSetPriorityFlags={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: '🙂' } });
    fireEvent.change(screen.getByPlaceholderText('Share the details...'), { target: { value: '🙂' } });
    fireEvent.click(screen.getByRole('button', { name: /post news/i }));

    expect(
      await screen.findByText('Title and content cannot be empty after formatting cleanup.'),
    ).toBeInTheDocument();
    expect(announcementsSingle).not.toHaveBeenCalled();
  });

  it('shows a warning toast when save succeeds but notification delivery fails', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    createSystemNotification
      .mockRejectedValueOnce(new Error('bulk delivery failed'))
      .mockRejectedValueOnce(new Error('Realtime offline'));

    render(
      <CreateAnnouncementModal
        onClose={onClose}
        onSuccess={onSuccess}
        canSetPriorityFlags={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Radiology Update' } });
    fireEvent.change(screen.getByPlaceholderText('Share the details...'), { target: { value: 'New quiz tonight.' } });
    fireEvent.click(screen.getByRole('button', { name: /post news/i }));

    await waitFor(() => {
      expect(announcementsSingle).toHaveBeenCalled();
      expect(createSystemNotification).toHaveBeenCalledTimes(2);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith(
      'News saved with warning',
      expect.stringContaining('News saved, but notification delivery failed.'),
    );
    expect(toastInfo).toHaveBeenCalledWith(
      'News saved with warning',
      expect.stringContaining('Reason: Realtime offline'),
    );
  });
});
