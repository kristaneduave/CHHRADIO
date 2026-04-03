import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testables,
  createConsultantDeckingEntry,
  listConsultantDeckingEntries,
  listConsultantDeckingLanes,
  moveConsultantDeckingEntry,
} from './consultantDeckingService';

const { mockFrom, mockChannel, mockRemoveChannel, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    auth: { getUser: mockGetUser },
  },
}));

const buildEntryListChain = (data: any[]) => {
  const idOrder = vi.fn().mockResolvedValue({ data, error: null });
  const updatedOrder = vi.fn(() => ({ order: idOrder }));
  const positionOrder = vi.fn(() => ({ order: updatedOrder }));
  const laneOrder = vi.fn(() => ({ order: positionOrder }));
  const tabOrder = vi.fn(() => ({ order: laneOrder }));
  return { select: vi.fn(() => ({ order: tabOrder })) };
};

const buildLaneListChain = (data: any[]) => {
  const labelOrder = vi.fn().mockResolvedValue({ data, error: null });
  const sortOrder = vi.fn(() => ({ order: labelOrder }));
  const tabOrder = vi.fn(() => ({ order: sortOrder }));
  return { select: vi.fn(() => ({ order: tabOrder })) };
};

describe('consultantDeckingService', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFrom.mockReset();
    mockChannel.mockReset();
    mockRemoveChannel.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('normalizes and sorts consultant decking rows with lane ids and brief impression', async () => {
    mockFrom.mockReturnValue(
      buildEntryListChain([
        {
          id: 'b',
          patient_name: '  Juan   Dela Cruz ',
          patient_age: 46,
          patient_sex: 'M',
          difficulty: 'hard',
          patient_source: 'er',
          study_date: '2026-03-27',
          study_time: '08:30',
          study_description: '  CT   brain plain ',
          brief_impression: '  Likely acute infarct with edema  ',
          lane_id: 'alvarez',
          position: 1,
          created_by: 'user-1',
          updated_by: 'user-1',
          created_at: '2026-03-27T00:00:00Z',
          updated_at: '2026-03-27T00:00:00Z',
        },
        {
          id: 'a',
          patient_name: ' Ana Santos ',
          patient_age: null,
          patient_sex: null,
          difficulty: 'easy',
          patient_source: 'outpatient',
          study_date: null,
          study_time: null,
          study_description: null,
          brief_impression: null,
          lane_id: 'inbox',
          position: 0,
          created_by: 'user-1',
          updated_by: 'user-1',
          created_at: '2026-03-27T00:00:00Z',
          updated_at: '2026-03-27T00:00:00Z',
        },
      ]),
    );

    const entries = await listConsultantDeckingEntries({ force: true });

    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(entries[0].patientName).toBe('Juan Dela Cruz');
    expect(entries[0].studyDescription).toBe('CT brain plain');
    expect(entries[0].briefImpression).toBe('Likely acute infarct with edema');
    expect(entries[0].laneId).toBe('alvarez');
  });

  it('returns seeded lanes when the lane table is empty', async () => {
    mockFrom.mockReturnValue(buildLaneListChain([]));

    const lanes = await listConsultantDeckingLanes({ force: true });

    expect(lanes.map((lane) => lane.id)).toEqual(__testables.DEFAULT_LANE_SEEDS.map((lane) => lane.id));
    expect(lanes[0].label).toBe('Unassigned patients');
  });

  it('creates new cards at the end of the selected lane', async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-entry' }, error: null });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));

    mockFrom
      .mockReturnValueOnce(
        buildEntryListChain([
          {
            id: 'existing',
            patient_name: 'Existing Patient',
            patient_age: 58,
            patient_sex: 'F',
            difficulty: 'medium',
            patient_source: 'inpatient',
            study_date: '2026-03-26',
            study_time: '11:15',
            study_description: 'MR brain plain',
            brief_impression: null,
            lane_id: 'reynes',
            position: 0,
            created_by: 'user-1',
            updated_by: 'user-1',
            created_at: '2026-03-27T00:00:00Z',
            updated_at: '2026-03-27T00:00:00Z',
          },
        ]),
      )
      .mockReturnValueOnce({ insert });

    const result = await createConsultantDeckingEntry({
      patientName: '  Juan   Dela Cruz ',
      patientAge: 46,
      patientSex: 'M',
      tabId: 'tab-1',
      difficulty: 'hard',
      priorityLevel: 'urgent',
      patientSource: 'er',
      studyDate: '2026-03-27',
      studyTime: '08:30',
      studyDescription: '  CT  brain plain ',
      briefImpression: '  Stroke pattern  ',
      laneId: 'reynes',
    });

    expect(result.id).toBe('new-entry');
    expect(insert).toHaveBeenCalledWith({
      patient_name: 'Juan Dela Cruz',
      patient_age: 46,
      patient_sex: 'M',
      tab_id: 'tab-1',
      difficulty: 'hard',
      priority_level: 'urgent',
      patient_source: 'er',
      study_date: '2026-03-27',
      study_time: '08:30',
      study_description: 'CT brain plain',
      brief_impression: 'Stroke pattern',
      lane_id: 'reynes',
      position: 1,
      created_by: 'user-1',
      updated_by: 'user-1',
    });
  });

  it('reorders positions when moving between lanes', () => {
    const reordered = __testables.reorderDeckingEntries(
      [
        {
          id: 'a',
          patientName: 'Alpha',
          patientAge: 34,
          patientSex: 'F',
          tabId: 'tab-1',
          difficulty: 'easy',
          priorityLevel: 'routine',
          patientSource: 'inpatient',
          studyDate: '2026-03-27',
          studyTime: '08:00',
          studyDescription: 'MR brain plain',
          briefImpression: null,
          laneId: 'inbox',
          position: 0,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-03-27T00:00:00Z',
          updatedAt: '2026-03-27T00:00:00Z',
        },
        {
          id: 'b',
          patientName: 'Bravo',
          patientAge: 51,
          patientSex: 'M',
          tabId: 'tab-1',
          difficulty: 'medium',
          priorityLevel: 'urgent',
          patientSource: 'er',
          studyDate: '2026-03-27',
          studyTime: '08:15',
          studyDescription: 'CT chest plain',
          briefImpression: 'PE workup',
          laneId: 'lane-a',
          position: 0,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-03-27T00:00:00Z',
          updatedAt: '2026-03-27T00:00:00Z',
        },
      ],
      'a',
      'tab-1',
      'lane-a',
      1,
    );

    expect(reordered.find((entry) => entry.id === 'a')?.laneId).toBe('lane-a');
    expect(reordered.filter((entry) => entry.laneId === 'lane-a').map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(reordered.filter((entry) => entry.laneId === 'lane-a').map((entry) => entry.position)).toEqual([0, 1]);
  });

  it('persists reordered positions through row updates on move', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));

    mockFrom
      .mockReturnValueOnce(
        buildEntryListChain([
          {
            id: 'a',
            patient_name: 'Alpha',
            patient_age: 34,
            patient_sex: 'F',
            difficulty: 'easy',
            patient_source: 'inpatient',
            study_date: '2026-03-27',
            study_time: '08:00',
            study_description: 'MR brain plain',
            brief_impression: null,
            lane_id: 'inbox',
            position: 0,
            created_by: 'user-1',
            updated_by: 'user-1',
            created_at: '2026-03-27T00:00:00Z',
            updated_at: '2026-03-27T00:00:00Z',
          },
          {
            id: 'b',
            patient_name: 'Bravo',
            patient_age: 51,
            patient_sex: 'M',
            difficulty: 'medium',
            patient_source: 'er',
            study_date: '2026-03-27',
            study_time: '08:15',
            study_description: 'CT chest plain',
            brief_impression: 'PE workup',
            lane_id: 'lane-a',
            position: 0,
            created_by: 'user-1',
            updated_by: 'user-2',
            created_at: '2026-03-27T00:00:00Z',
            updated_at: '2026-03-27T00:00:00Z',
          },
        ]),
      )
      .mockReturnValueOnce({ update })
      .mockReturnValueOnce({ update });

    await moveConsultantDeckingEntry('a', 'tab-1', 'lane-a', 1);

    expect(update).toHaveBeenNthCalledWith(1, {
      tab_id: 'tab-1',
      lane_id: 'lane-a',
      position: 0,
      updated_by: 'user-1',
    });
    expect(eq).toHaveBeenNthCalledWith(1, 'id', 'b');
    expect(update).toHaveBeenNthCalledWith(2, {
      tab_id: 'tab-1',
      lane_id: 'lane-a',
      position: 1,
      updated_by: 'user-1',
    });
    expect(eq).toHaveBeenNthCalledWith(2, 'id', 'a');
  });
});
