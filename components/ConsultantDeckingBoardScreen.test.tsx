import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConsultantDeckingBoardScreen from './ConsultantDeckingBoardScreen';

const {
  listConsultantDeckingEntries,
  createConsultantDeckingEntry,
  updateConsultantDeckingEntry,
  moveConsultantDeckingEntry,
  reorderDeckingEntries,
  deleteConsultantDeckingEntry,
  subscribeToConsultantDeckingEntries,
} = vi.hoisted(() => ({
  listConsultantDeckingEntries: vi.fn(),
  createConsultantDeckingEntry: vi.fn(),
  updateConsultantDeckingEntry: vi.fn(),
  moveConsultantDeckingEntry: vi.fn(),
  reorderDeckingEntries: vi.fn(),
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
  reorderDeckingEntries,
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
    reorderDeckingEntries.mockReset();
    deleteConsultantDeckingEntry.mockReset();
    subscribeToConsultantDeckingEntries.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    subscribeToConsultantDeckingEntries.mockReturnValue(() => undefined);
    reorderDeckingEntries.mockImplementation((entries) => entries);
    vi.restoreAllMocks();
  });

  it('blocks guests with a sign-in notice', () => {
    render(<ConsultantDeckingBoardScreen currentUserId={null} onBack={vi.fn()} />);

    expect(screen.getByText('Sign in is required to view and update the shared consultant decking board.')).toBeInTheDocument();
    expect(listConsultantDeckingEntries).not.toHaveBeenCalled();
  });

  it('renders the unassigned section and four doctor lanes, then creates a patient pill', async () => {
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

    expect(await screen.findByText('Unassigned patients')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Inbox' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Reynes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Alvarez' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Co-Ng' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Vaño-Yu' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Patient name'), { target: { value: 'Juan Dela Cruz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(createConsultantDeckingEntry).toHaveBeenCalledWith({
        patientName: 'Juan Dela Cruz',
        difficulty: 'medium',
        patientSource: 'er',
      });
    });

    expect(await screen.findByRole('button', { name: 'Edit Juan Dela Cruz' })).toBeInTheDocument();
  });

  it('updates a patient and moves it to a consultant through the lightweight editor', async () => {
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
    const dialog = await screen.findByRole('dialog', { name: 'Edit consultant decking patient' });
    fireEvent.change(within(dialog).getByLabelText('Edit difficulty'), { target: { value: 'medium' } });
    fireEvent.change(within(dialog).getByLabelText('Move to lane'), { target: { value: 'alvarez' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateConsultantDeckingEntry).toHaveBeenCalledWith('entry-1', {
        patientName: 'Juan Dela Cruz',
        difficulty: 'medium',
        patientSource: 'er',
      });
    });

    expect(moveConsultantDeckingEntry).toHaveBeenCalledWith('entry-1', 'alvarez', 0);
  });

  it('supports returning a patient to unassigned through the editor fallback', async () => {
    listConsultantDeckingEntries
      .mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientName: 'Juan Dela Cruz',
          difficulty: 'medium',
          patientSource: 'inpatient',
          columnKey: 'reynes',
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
          patientSource: 'inpatient',
          columnKey: 'inbox',
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
    const dialog = await screen.findByRole('dialog', { name: 'Edit consultant decking patient' });
    fireEvent.change(within(dialog).getByLabelText('Move to lane'), { target: { value: 'inbox' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(moveConsultantDeckingEntry).toHaveBeenCalledWith('entry-1', 'inbox', 0);
    });
  });

  it('moves a patient immediately on drop before the server refresh', async () => {
    const initialEntries = [
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
    ];

    const movedEntries = [
      {
        ...initialEntries[0],
        columnKey: 'reynes',
        position: 0,
      },
    ];

    listConsultantDeckingEntries.mockResolvedValue(initialEntries);
    reorderDeckingEntries.mockReturnValue(movedEntries);
    moveConsultantDeckingEntry.mockResolvedValue(undefined);

    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    const pill = await screen.findByRole('button', { name: 'Edit Juan Dela Cruz' });
    const laneHeading = screen.getByRole('heading', { name: 'Dr. Reynes' });
    const laneDropZone = laneHeading.parentElement?.parentElement;
    expect(laneDropZone).not.toBeNull();

    fireEvent.dragStart(pill, {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
      },
    });

    fireEvent.drop(laneDropZone as HTMLElement, {
      dataTransfer: {
        getData: () => 'entry-1',
      },
      preventDefault: vi.fn(),
    });

    await waitFor(() => {
      expect(reorderDeckingEntries).toHaveBeenCalledWith(initialEntries, 'entry-1', 'reynes', 0);
    });

    expect(moveConsultantDeckingEntry).toHaveBeenCalledWith('entry-1', 'reynes', 0);
  });

  it('exports the current board as a downloadable html summary', async () => {
    listConsultantDeckingEntries.mockResolvedValue([
      {
        id: 'entry-1',
        patientName: 'Juan Dela Cruz',
        difficulty: 'hard',
        patientSource: 'er',
        columnKey: 'reynes',
        position: 0,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-03-27T00:00:00Z',
        updatedAt: '2026-03-27T00:00:00Z',
      },
    ]);

    const originalCreateElement = document.createElement.bind(document);
    const clickSpy = vi.fn();
    const anchor = originalCreateElement('a');
    anchor.click = clickSpy;
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'a') {
        return anchor;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);
    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
    const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => undefined);

    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Export summary' }));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchor.download).toContain('consultant-decking-');
    expect(anchor.download).toContain('.html');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test');
    expect(toastSuccess).toHaveBeenCalledWith('Summary exported');
    createElementSpy.mockRestore();
  });
});
