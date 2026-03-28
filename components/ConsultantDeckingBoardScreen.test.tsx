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
    vi.useRealTimers();
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

  it('renders the unassigned section and creates a patient with study details', async () => {
    listConsultantDeckingEntries
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientName: 'Juan Dela Cruz',
          patientAge: 46,
          patientSex: 'M',
          difficulty: 'hard',
          patientSource: 'er',
          studyDate: '2026-03-27',
          studyTime: '08:30',
          studyDescription: 'CT brain plain',
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
    expect(screen.getByRole('heading', { name: 'Dr. Reynes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Alvarez' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Co-Ng' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Vaño-Yu' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Patient name'), { target: { value: 'Juan Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('Patient age'), { target: { value: '46' } });
    fireEvent.change(screen.getByLabelText('Patient sex'), { target: { value: 'M' } });
    fireEvent.change(screen.getByLabelText('Study date'), { target: { value: '2026-03-27' } });
    fireEvent.change(screen.getByLabelText('Study time'), { target: { value: '08:30' } });
    fireEvent.change(screen.getByLabelText('Study description'), { target: { value: 'CT brain plain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(createConsultantDeckingEntry).toHaveBeenCalledWith({
        patientName: 'Juan Dela Cruz',
        patientAge: 46,
        patientSex: 'M',
        difficulty: 'medium',
        patientSource: 'er',
        studyDate: '2026-03-27',
        studyTime: '08:30',
        studyDescription: 'CT brain plain',
      });
    });

    expect(await screen.findByRole('button', { name: 'Edit Juan Dela Cruz' })).toBeInTheDocument();
    expect(screen.queryByText('Create patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Add a patient, then drag the pill to the right consultant.')).not.toBeInTheDocument();
  });

  it('defaults the draft date and time to the current local values', async () => {
    const now = new Date();
    const expectedDate = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
    const expectedTime = `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
    listConsultantDeckingEntries.mockResolvedValue([]);

    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    expect(await screen.findByText('Unassigned patients')).toBeInTheDocument();
    expect(screen.getByLabelText('Study date')).toHaveValue(expectedDate);
    expect(screen.getByLabelText('Study time')).toHaveValue(expectedTime);
  });

  it('updates a patient and moves it to a consultant through the editor', async () => {
    listConsultantDeckingEntries
      .mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientName: 'Juan Dela Cruz',
          patientAge: 46,
          patientSex: 'M',
          difficulty: 'hard',
          patientSource: 'er',
          studyDate: '2026-03-27',
          studyTime: '08:30',
          studyDescription: 'CT brain plain',
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
          patientAge: 46,
          patientSex: 'M',
          difficulty: 'medium',
          patientSource: 'er',
          studyDate: '2026-03-27',
          studyTime: '08:30',
          studyDescription: 'CT brain plain',
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
    fireEvent.change(within(dialog).getByLabelText('Edit patient age'), { target: { value: '47' } });
    fireEvent.change(within(dialog).getByLabelText('Edit patient sex'), { target: { value: 'F' } });
    fireEvent.change(within(dialog).getByLabelText('Edit difficulty'), { target: { value: 'medium' } });
    fireEvent.change(within(dialog).getByLabelText('Move to lane'), { target: { value: 'alvarez' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateConsultantDeckingEntry).toHaveBeenCalledWith('entry-1', {
        patientName: 'Juan Dela Cruz',
        patientAge: 47,
        patientSex: 'F',
        difficulty: 'medium',
        patientSource: 'er',
        studyDate: '2026-03-27',
        studyTime: '08:30',
        studyDescription: 'CT brain plain',
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
          patientAge: null,
          patientSex: null,
          difficulty: 'medium',
          patientSource: 'inpatient',
          studyDate: '2026-03-27',
          studyTime: '09:00',
          studyDescription: 'MR brain plain',
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
          patientAge: null,
          patientSex: null,
          difficulty: 'medium',
          patientSource: 'inpatient',
          studyDate: '2026-03-27',
          studyTime: '09:00',
          studyDescription: 'MR brain plain',
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
        patientAge: 46,
        patientSex: 'M',
        difficulty: 'hard',
        patientSource: 'er',
        studyDate: '2026-03-27',
        studyTime: '08:30',
        studyDescription: 'CT brain plain',
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
        patientAge: 46,
        patientSex: 'M',
        difficulty: 'hard',
        patientSource: 'er',
        studyDate: '2026-03-27',
        studyTime: '08:30',
        studyDescription: 'CT brain plain',
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

    fireEvent.click(await screen.findByRole('button', { name: 'Export Summary' }));

    expect(createObjectURLSpy).toHaveBeenCalled();
    const exportedBlob = createObjectURLSpy.mock.calls[0]?.[0] as Blob;
    expect(exportedBlob).toBeInstanceOf(Blob);
    expect(anchor.download).toContain('consultant-decking-');
    expect(anchor.download).toContain('.html');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test');
    expect(toastSuccess).toHaveBeenCalledWith('Summary exported');
    createElementSpy.mockRestore();
  });

  it('orders consultant lanes by difficulty first, then patient source priority', async () => {
    listConsultantDeckingEntries.mockResolvedValue([
      {
        id: 'entry-1',
        patientName: 'Easy ER',
        patientAge: null,
        patientSex: null,
        difficulty: 'easy',
        patientSource: 'er',
        studyDate: '2026-03-27',
        studyTime: '08:00',
        studyDescription: 'CT brain plain',
        columnKey: 'reynes',
        position: 0,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-03-27T00:00:00Z',
        updatedAt: '2026-03-27T00:00:00Z',
      },
      {
        id: 'entry-2',
        patientName: 'Hard Inpatient',
        patientAge: null,
        patientSex: null,
        difficulty: 'hard',
        patientSource: 'inpatient',
        studyDate: '2026-03-27',
        studyTime: '08:10',
        studyDescription: 'CT chest plain',
        columnKey: 'reynes',
        position: 1,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-03-27T00:00:00Z',
        updatedAt: '2026-03-27T00:00:00Z',
      },
      {
        id: 'entry-3',
        patientName: 'Hard ER',
        patientAge: null,
        patientSex: null,
        difficulty: 'hard',
        patientSource: 'er',
        studyDate: '2026-03-27',
        studyTime: '08:20',
        studyDescription: 'CT angiography - Brain',
        columnKey: 'reynes',
        position: 2,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-03-27T00:00:00Z',
        updatedAt: '2026-03-27T00:00:00Z',
      },
      {
        id: 'entry-4',
        patientName: 'Medium OPD',
        patientAge: null,
        patientSex: null,
        difficulty: 'medium',
        patientSource: 'outpatient',
        studyDate: '2026-03-27',
        studyTime: '08:30',
        studyDescription: 'MR brain plain',
        columnKey: 'reynes',
        position: 3,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-03-27T00:00:00Z',
        updatedAt: '2026-03-27T00:00:00Z',
      },
    ]);

    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    const reyesLane = (await screen.findByRole('heading', { name: 'Dr. Reynes' })).closest('section');
    expect(reyesLane).not.toBeNull();

    const pillButtons = within(reyesLane as HTMLElement).getAllByRole('button', { name: /Edit / });
    expect(pillButtons.map((pill) => pill.getAttribute('aria-label'))).toEqual([
      'Edit Hard ER',
      'Edit Hard Inpatient',
      'Edit Medium OPD',
      'Edit Easy ER',
    ]);

    expect(within(reyesLane as HTMLElement).getByText('Hard 2, Medium 1, Easy 1')).toBeInTheDocument();
    expect(within(reyesLane as HTMLElement).getByText('ER 2, Inpatient 1, OPD 1')).toBeInTheDocument();
  });

  it('shows a source-only pill with the real description and date', async () => {
    listConsultantDeckingEntries.mockResolvedValue([
      {
        id: 'entry-1',
        patientName: 'Dy, Vicente',
        patientAge: 56,
        patientSex: 'M',
        difficulty: 'hard',
        patientSource: 'er',
        studyDate: '2026-03-27',
        studyTime: '08:20',
        studyDescription: 'CT angiography-PE',
        columnKey: 'alvarez',
        position: 0,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-03-27T00:00:00Z',
        updatedAt: '2026-03-27T00:00:00Z',
      },
    ]);

    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    const pill = await screen.findByRole('button', { name: 'Edit Dy, Vicente' });
    expect(within(pill).getByText('ER')).toBeInTheDocument();
    expect(within(pill).getByText('Dy, Vicente')).toBeInTheDocument();
    expect(within(pill).getByText('CT angiography-PE')).toBeInTheDocument();
    expect(within(pill).getByText('3/27')).toBeInTheDocument();
    expect(within(pill).queryByText('Study pending')).not.toBeInTheDocument();
    expect(within(pill).queryByText('CTA')).not.toBeInTheDocument();
    expect(within(pill).queryByText('HARD')).not.toBeInTheDocument();
  });
});
