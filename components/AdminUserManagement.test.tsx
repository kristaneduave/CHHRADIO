import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUserManagement from './AdminUserManagement';

const {
  profilesOrder,
  userRolesIn,
  profilesUpdateEq,
  userRolesDeleteEq,
  userRolesInsert,
} = vi.hoisted(() => ({
  profilesOrder: vi.fn(),
  userRolesIn: vi.fn(),
  profilesUpdateEq: vi.fn(),
  userRolesDeleteEq: vi.fn(),
  userRolesInsert: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            order: profilesOrder,
          })),
          update: vi.fn(() => ({
            eq: profilesUpdateEq,
          })),
        };
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn(() => ({
            in: userRolesIn,
          })),
          delete: vi.fn(() => ({
            eq: userRolesDeleteEq,
          })),
          insert: userRolesInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  },
}));

describe('AdminUserManagement', () => {
  beforeEach(() => {
    profilesOrder.mockReset();
    userRolesIn.mockReset();
    profilesUpdateEq.mockReset();
    userRolesDeleteEq.mockReset();
    userRolesInsert.mockReset();

    profilesOrder.mockResolvedValue({
      data: [
        {
          id: 'user-1',
          full_name: 'Dr. Mira',
          username: 'mira',
          bio: null,
          year_level: 'R2',
          avatar_url: null,
          role: 'resident',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
      ],
      error: null,
    });

    userRolesIn.mockResolvedValue({
      data: [
        { user_id: 'user-1', role: 'resident' },
        { user_id: 'user-1', role: 'moderator' },
      ],
      error: null,
    });

    profilesUpdateEq.mockResolvedValue({ error: null });
    userRolesDeleteEq.mockResolvedValue({ error: null });
    userRolesInsert.mockResolvedValue({ error: null });
  });

  it('renders the multi-role management sections for a loaded user', async () => {
    render(<AdminUserManagement onClose={() => undefined} />);

    expect(await screen.findByText('Dr. Mira')).toBeInTheDocument();
    expect(screen.getByText('Primary role')).toBeInTheDocument();
    expect(screen.getByText('Additional roles')).toBeInTheDocument();
    expect(screen.getByText('Default identity.')).toBeInTheDocument();
    expect(screen.getByText('Active roles control permissions.')).toBeInTheDocument();
  });

  it('updates roles and shows a success notice when toggling an additional role', async () => {
    render(<AdminUserManagement onClose={() => undefined} />);

    const userCard = (await screen.findByText('Dr. Mira')).closest('div.rounded-xl');
    expect(userCard).not.toBeNull();

    fireEvent.click(within(userCard as HTMLElement).getAllByRole('button', { name: 'admin' })[1]);

    await waitFor(() => {
      expect(profilesUpdateEq).toHaveBeenCalledWith('id', 'user-1');
      expect(userRolesDeleteEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(userRolesInsert).toHaveBeenCalledWith([
        { user_id: 'user-1', role: 'resident' },
        { user_id: 'user-1', role: 'moderator' },
        { user_id: 'user-1', role: 'admin' },
      ]);
    });

    expect(screen.getByText('Roles updated.')).toBeInTheDocument();
  });

  it('makes training officer exclusive and updates the primary role when selected', async () => {
    render(<AdminUserManagement onClose={() => undefined} />);

    const userCard = (await screen.findByText('Dr. Mira')).closest('div.rounded-xl');
    expect(userCard).not.toBeNull();

    fireEvent.click(within(userCard as HTMLElement).getAllByRole('button', { name: 'training officer' })[1]);

    await waitFor(() => {
      expect(profilesUpdateEq).toHaveBeenCalledWith('id', 'user-1');
      expect(userRolesDeleteEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(userRolesInsert).toHaveBeenCalledWith([
        { user_id: 'user-1', role: 'training_officer' },
      ]);
    });
  });
});
