import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConsultantDeckingBoardScreen from './ConsultantDeckingBoardScreen';

const {
  listConsultantDeckingTabs,
  listConsultantDeckingEntries,
  listConsultantDeckingLanes,
  createConsultantDeckingEntry,
  createConsultantDeckingLane,
  updateConsultantDeckingEntry,
  updateConsultantDeckingLane,
  updateConsultantDeckingTab,
  moveConsultantDeckingEntry,
  reorderConsultantDeckingLanes,
  reorderConsultantDeckingTabs,
  archiveConsultantDeckingLane,
  createArchivedDeckingSession,
  deleteConsultantDeckingEntry,
  listArchivedDeckingSessions,
  subscribeToConsultantDeckingEntries,
} = vi.hoisted(() => ({
  listConsultantDeckingTabs: vi.fn(),
  listConsultantDeckingEntries: vi.fn(),
  listConsultantDeckingLanes: vi.fn(),
  createConsultantDeckingEntry: vi.fn(),
  createConsultantDeckingLane: vi.fn(),
  updateConsultantDeckingEntry: vi.fn(),
  updateConsultantDeckingLane: vi.fn(),
  updateConsultantDeckingTab: vi.fn(),
  moveConsultantDeckingEntry: vi.fn(),
  reorderConsultantDeckingLanes: vi.fn(),
  reorderConsultantDeckingTabs: vi.fn(),
  archiveConsultantDeckingLane: vi.fn(),
  createArchivedDeckingSession: vi.fn(),
  deleteConsultantDeckingEntry: vi.fn(),
  listArchivedDeckingSessions: vi.fn(),
  subscribeToConsultantDeckingEntries: vi.fn(),
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../services/consultantDeckingService', () => ({
  __testables: {
    MAX_LANES_PER_TAB: 4,
    getInboxLaneIdForTab: (tabId: string) => (tabId === 'tab-1' ? 'inbox' : `inbox-${tabId}`),
  },
  listConsultantDeckingTabs,
  listConsultantDeckingEntries,
  listConsultantDeckingLanes,
  createConsultantDeckingEntry,
  createConsultantDeckingLane,
  updateConsultantDeckingEntry,
  updateConsultantDeckingLane,
  updateConsultantDeckingTab,
  moveConsultantDeckingEntry,
  reorderConsultantDeckingLanes,
  reorderConsultantDeckingTabs,
  archiveConsultantDeckingLane,
  createArchivedDeckingSession,
  deleteConsultantDeckingEntry,
  listArchivedDeckingSessions,
  subscribeToConsultantDeckingEntries,
}));

vi.mock('../utils/toast', () => ({
  toastError,
  toastSuccess,
}));

const baseTabs = [
  { id: 'tab-1', title: 'Fuente 7AM-7AM Sun-Sat', description: 'Fuente', sortOrder: 0, isActive: true, maxLanes: 4 },
  { id: 'tab-2', title: 'Mandaue 7AM-7AM Sun-Sat', description: 'Mandaue', sortOrder: 1, isActive: true, maxLanes: 4 },
  { id: 'tab-3', title: 'Special and Overflow Deck', description: 'Overflow', sortOrder: 2, isActive: true, maxLanes: 4 },
];

const baseLanes = [
  { id: 'inbox', tabId: 'tab-1', label: 'Unassigned patients', sortOrder: 0, isActive: true, accentToken: 'slate' },
  { id: 'lane-1', tabId: 'tab-1', label: 'Dr. Reynes', sortOrder: 1, isActive: true, accentToken: 'violet' },
  { id: 'lane-2', tabId: 'tab-1', label: 'Dr. Alvarez', sortOrder: 2, isActive: true, accentToken: 'amber' },
  { id: 'inbox-tab-2', tabId: 'tab-2', label: 'Unassigned patients', sortOrder: 0, isActive: true, accentToken: 'slate' },
  { id: 'lane-3', tabId: 'tab-2', label: 'Dr. Co-Ng', sortOrder: 1, isActive: true, accentToken: 'emerald' },
];

describe('ConsultantDeckingBoardScreen', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    listConsultantDeckingTabs.mockReset();
    listConsultantDeckingEntries.mockReset();
    listConsultantDeckingLanes.mockReset();
    createConsultantDeckingEntry.mockReset();
    createConsultantDeckingLane.mockReset();
    updateConsultantDeckingEntry.mockReset();
    updateConsultantDeckingLane.mockReset();
    updateConsultantDeckingTab.mockReset();
    moveConsultantDeckingEntry.mockReset();
    reorderConsultantDeckingLanes.mockReset();
    reorderConsultantDeckingTabs.mockReset();
    archiveConsultantDeckingLane.mockReset();
    createArchivedDeckingSession.mockReset();
    deleteConsultantDeckingEntry.mockReset();
    listArchivedDeckingSessions.mockReset();
    subscribeToConsultantDeckingEntries.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    subscribeToConsultantDeckingEntries.mockReturnValue(() => undefined);
    listConsultantDeckingTabs.mockResolvedValue(baseTabs);
    listConsultantDeckingLanes.mockResolvedValue(baseLanes);
    listConsultantDeckingEntries.mockResolvedValue([]);
  });

  it('blocks guests with a sign-in notice', () => {
    render(<ConsultantDeckingBoardScreen currentUserId={null} onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Consultant Decking' })).toBeInTheDocument();
    expect(listConsultantDeckingEntries).not.toHaveBeenCalled();
  });

  it('creates a patient with deck tab and priority', async () => {
    createConsultantDeckingEntry.mockResolvedValue({ id: 'entry-1' });
    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText('Patient name'), { target: { value: 'Juan Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('Patient age'), { target: { value: '46' } });
    fireEvent.change(screen.getByLabelText('Patient sex'), { target: { value: 'M' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'stat' } });
    fireEvent.change(screen.getByLabelText('Case difficulty'), { target: { value: 'hard' } });
    fireEvent.change(screen.getByLabelText('Study description'), { target: { value: 'CT brain plain' } });
    fireEvent.change(screen.getByLabelText('Brief impression'), { target: { value: 'Acute stroke pattern' } });
    fireEvent.change(screen.getByLabelText('Lane'), { target: { value: 'lane-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(createConsultantDeckingEntry).toHaveBeenCalledWith(expect.objectContaining({
        patientName: 'Juan Dela Cruz',
        patientAge: 46,
        patientSex: 'M',
        tabId: 'tab-1',
        priorityLevel: 'stat',
        difficulty: 'hard',
        laneId: 'lane-1',
      }));
    });
  });

  it('switches deck tabs and shows the other consultant list', async () => {
    listConsultantDeckingEntries.mockResolvedValue([
      { id: 'entry-1', patientName: 'Fuente Case', patientAge: null, patientSex: null, tabId: 'tab-1', difficulty: 'medium', priorityLevel: 'routine', patientSource: 'er', studyDate: '2026-03-27', studyTime: '08:00', studyDescription: 'CT brain plain', briefImpression: null, laneId: 'lane-1', position: 0, createdBy: 'user-1', updatedBy: 'user-1', createdAt: '2026-03-27T00:00:00Z', updatedAt: '2026-03-27T00:00:00Z' },
      { id: 'entry-2', patientName: 'Mandaue Case', patientAge: null, patientSex: null, tabId: 'tab-2', difficulty: 'medium', priorityLevel: 'urgent', patientSource: 'er', studyDate: '2026-03-27', studyTime: '08:10', studyDescription: 'CT chest plain', briefImpression: 'PE workup', laneId: 'lane-3', position: 0, createdBy: 'user-1', updatedBy: 'user-1', createdAt: '2026-03-27T00:00:00Z', updatedAt: '2026-03-27T00:00:00Z' },
    ]);
    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Edit Fuente Case' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Mandaue Case' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mandaue 7AM-7AM Sun-Sat' }));
    expect(await screen.findByRole('button', { name: 'Edit Mandaue Case' })).toBeInTheDocument();
  });

  it('orders lane pills by source then priority then difficulty', async () => {
    listConsultantDeckingEntries.mockResolvedValue([
      { id: 'a', patientName: 'ER Routine', patientAge: null, patientSex: null, tabId: 'tab-1', difficulty: 'easy', priorityLevel: 'routine', patientSource: 'er', studyDate: '2026-03-27', studyTime: '08:00', studyDescription: 'CT brain plain', briefImpression: null, laneId: 'lane-1', position: 0, createdBy: 'user-1', updatedBy: 'user-1', createdAt: '2026-03-27T00:00:00Z', updatedAt: '2026-03-27T00:00:00Z' },
      { id: 'b', patientName: 'ER Stat', patientAge: null, patientSex: null, tabId: 'tab-1', difficulty: 'easy', priorityLevel: 'stat', patientSource: 'er', studyDate: '2026-03-27', studyTime: '08:05', studyDescription: 'CT chest plain', briefImpression: 'Critical', laneId: 'lane-1', position: 1, createdBy: 'user-1', updatedBy: 'user-1', createdAt: '2026-03-27T00:00:00Z', updatedAt: '2026-03-27T00:00:00Z' },
      { id: 'c', patientName: 'Inpatient Urgent', patientAge: null, patientSex: null, tabId: 'tab-1', difficulty: 'hard', priorityLevel: 'urgent', patientSource: 'inpatient', studyDate: '2026-03-27', studyTime: '08:06', studyDescription: 'MR brain plain', briefImpression: 'Mass effect', laneId: 'lane-1', position: 2, createdBy: 'user-1', updatedBy: 'user-1', createdAt: '2026-03-27T00:00:00Z', updatedAt: '2026-03-27T00:00:00Z' },
    ]);
    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    const lane = (await screen.findByRole('heading', { name: 'Dr. Reynes' })).closest('section');
    const pillButtons = within(lane as HTMLElement).getAllByRole('button', { name: /Edit / });
    expect(pillButtons.map((pill) => pill.getAttribute('aria-label'))).toEqual([
      'Edit ER Stat',
      'Edit ER Routine',
      'Edit Inpatient Urgent',
    ]);
  });

  it('shows the brief impression tooltip trigger only for medium/hard cases', async () => {
    listConsultantDeckingEntries.mockResolvedValue([
      { id: 'entry-1', patientName: 'Hard ER', patientAge: null, patientSex: null, tabId: 'tab-1', difficulty: 'hard', priorityLevel: 'urgent', patientSource: 'er', studyDate: '2026-03-27', studyTime: '08:20', studyDescription: 'CTA brain', briefImpression: 'Likely aneurysm', laneId: 'lane-1', position: 0, createdBy: 'user-1', updatedBy: 'user-1', createdAt: '2026-03-27T00:00:00Z', updatedAt: '2026-03-27T00:00:00Z' },
      { id: 'entry-2', patientName: 'Easy ER', patientAge: null, patientSex: null, tabId: 'tab-1', difficulty: 'easy', priorityLevel: 'routine', patientSource: 'er', studyDate: '2026-03-27', studyTime: '08:00', studyDescription: 'CT brain plain', briefImpression: 'Should not show', laneId: 'lane-1', position: 1, createdBy: 'user-1', updatedBy: 'user-1', createdAt: '2026-03-27T00:00:00Z', updatedAt: '2026-03-27T00:00:00Z' },
    ]);
    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    expect(await screen.findByLabelText('Show brief impression for Hard ER')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show brief impression for Easy ER')).not.toBeInTheDocument();
  });

  it('moves a patient to another tab and lane through the editor', async () => {
    listConsultantDeckingEntries.mockResolvedValue([
      { id: 'entry-1', patientName: 'Juan Dela Cruz', patientAge: 46, patientSex: 'M', tabId: 'tab-1', difficulty: 'hard', priorityLevel: 'priority', patientSource: 'er', studyDate: '2026-03-27', studyTime: '08:30', studyDescription: 'CT brain plain', briefImpression: 'Stroke pattern', laneId: 'inbox', position: 0, createdBy: 'user-1', updatedBy: 'user-1', createdAt: '2026-03-27T00:00:00Z', updatedAt: '2026-03-27T00:00:00Z' },
    ]);
    updateConsultantDeckingEntry.mockResolvedValue(undefined);
    moveConsultantDeckingEntry.mockResolvedValue(undefined);
    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Juan Dela Cruz' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit consultant decking patient' });
    fireEvent.change(within(dialog).getByLabelText('Edit deck tab'), { target: { value: 'tab-2' } });
    fireEvent.change(within(dialog).getByLabelText('Move to lane'), { target: { value: 'lane-3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateConsultantDeckingEntry).toHaveBeenCalled());
    expect(moveConsultantDeckingEntry).toHaveBeenCalledWith('entry-1', 'tab-2', 'lane-3', 0);
  });

  it('creates and renames dynamic lanes and saves tab details', async () => {
    createConsultantDeckingLane.mockResolvedValue({ id: 'lane-9' });
    updateConsultantDeckingLane.mockResolvedValue(undefined);
    updateConsultantDeckingTab.mockResolvedValue(undefined);
    render(<ConsultantDeckingBoardScreen currentUserId="user-1" onBack={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText('Add consultant lane'), { target: { value: 'Dr. New' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add lane' }));
    await waitFor(() => expect(createConsultantDeckingLane).toHaveBeenCalledWith({ tabId: 'tab-1', label: 'Dr. New' }));

    fireEvent.change(screen.getByLabelText('Deck tab title'), { target: { value: 'Fuente Sunday Deck' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save tab' }));
    await waitFor(() => expect(updateConsultantDeckingTab).toHaveBeenCalledWith('tab-1', expect.objectContaining({ title: 'Fuente Sunday Deck' })));
  });
});
