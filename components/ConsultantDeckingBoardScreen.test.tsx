import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConsultantDeckingBoardScreen from './ConsultantDeckingBoardScreen';

const {
  listConsultantDeckingEntries,
  createConsultantDeckingEntry,
  updateConsultantDeckingEntry,
  moveConsultantDeckingEntry,
  deleteConsultantDeckingEntry,
  subscribeToConsultantDeckingEntries,
} = vi.hoisted(() => ({
  listConsultantDeckingEntries: vi.fn(),
  createConsultantDeckingEntry: vi.fn(),
  updateConsultantDeckingEntry: vi.fn(),
  moveConsultantDeckingEntry: vi.fn(),
  deleteConsultantDeckingEntry: vi.fn(),
  subscribeToConsultantDeckingEntries: vi.fn(),
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../services/consultantDeckingService', () => ({
  listConsultantDeckingEntries,
  createConsultantDeckingEntry,
  updateConsultantDeckingEntry,
  moveConsultantDeckingEntry,
  deleteConsultantDeckingEntry,
  subscribeToConsultantDeckingEntries,
}));

vi.mock('../utils/toast', () => ({
  toastError,
  toastSuccess,
}));

describe('ConsultantDeckingBoardScreen', () => {
  beforeEach(() => {
    listConsultantDeckingEntries.mockReset();
    createConsultantDeckingEntry.mockReset();
    updateConsultantDeckingEntry.mockReset();
    moveConsultantDeckingEntry.mockReset();
    deleteConsultantDeckingEntry.mockReset();
    subscribeToConsultantDeckingEntries.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    subscribeToConsultantDeckingEntries.mockReturnValue(() => undefined);
  });

  it('blocks guests with a sign-in notice', () => {
    render(<ConsultantDeckingBoardScreen currentUserId={null} onBack={vi.fn()} />);

    expect(screen.getByText('Sign in is required to view and update the shared consultant decking board.')).toBeInTheDocument();
    expect(listConsultantDeckingEntries).not.toHaveBeenCalled();
  });

  it('renders five columns and creates new cards in the inbox', async () => {
    listConsultantDeckingEntries
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientName: 'Juan Dela Cruz',
          difficulty: 'hard',
          patientSource: 'er',
          columnKey: 'inbox',
          position: 0,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-03-27T00:00:00Z',
          updatedAt: '2026-03-27T00:00:00Z',
        },
      ]);
    createConsultantDeckingEntry.mockResolvedValue({ id: 'entry-1' });

    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Reynes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Alvarez' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Co-Ng' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Vaño-Yu' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Patient name'), { target: { value: 'Juan Dela Cruz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to inbox' }));

    await waitFor(() => {
      expect(createConsultantDeckingEntry).toHaveBeenCalledWith({
        patientName: 'Juan Dela Cruz',
        difficulty: 'medium',
        patientSource: 'er',
      });
    });

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
  });

  it('updates cards and moves them through the editor fallback', async () => {
    listConsultantDeckingEntries
      .mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientName: 'Juan Dela Cruz',
          difficulty: 'hard',
          patientSource: 'er',
          columnKey: 'inbox',
          position: 0,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-03-27T00:00:00Z',
          updatedAt: '2026-03-27T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientName: 'Juan Dela Cruz',
          difficulty: 'medium',
          patientSource: 'er',
          columnKey: 'alvarez',
          position: 0,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-03-27T00:00:00Z',
          updatedAt: '2026-03-27T00:00:00Z',
        },
      ]);
    updateConsultantDeckingEntry.mockResolvedValue(undefined);
    moveConsultantDeckingEntry.mockResolvedValue(undefined);

    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Juan Dela Cruz' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit consultant decking card' });
    fireEvent.change(within(dialog).getByLabelText('Edit difficulty'), { target: { value: 'medium' } });
    fireEvent.change(within(dialog).getByLabelText('Move to column'), { target: { value: 'alvarez' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateConsultantDeckingEntry).toHaveBeenCalledWith('entry-1', {
        patientName: 'Juan Dela Cruz',
        difficulty: 'medium',
        patientSource: 'er',
      });
    });

    expect(moveConsultantDeckingEntry).toHaveBeenCalledWith('entry-1', 'alvarez', 0);
  });
});
