import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testables,
  createConsultantDeckingEntry,
  listConsultantDeckingEntries,
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
    auth: {
      getUser: mockGetUser,
    },
  },
}));

const buildListChain = (data: any[]) => {
  const idOrder = vi.fn().mockResolvedValue({ data, error: null });
  const updatedOrder = vi.fn(() => ({ order: idOrder }));
  const positionOrder = vi.fn(() => ({ order: updatedOrder }));
  const columnOrder = vi.fn(() => ({ order: positionOrder }));
  return {
    select: vi.fn(() => ({ order: columnOrder })),
  };
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

  it('normalizes and sorts consultant decking rows', async () => {
    mockFrom.mockReturnValue(
      buildListChain([
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
          column_key: 'alvarez',
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
          column_key: 'inbox',
          position: 0,
          created_by: 'user-1',
          updated_by: 'user-1',
          created_at: '2026-03-27T00:00:00Z',
          updated_at: '2026-03-27T00:00:00Z',
        },
      ]),
    );

    const entries = await listConsultantDeckingEntries({ force: true });

    expect(entries.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(entries[0].patientName).toBe('Ana Santos');
    expect(entries[1].patientName).toBe('Juan Dela Cruz');
    expect(entries[1].patientAge).toBe(46);
    expect(entries[1].patientSex).toBe('M');
    expect(entries[1].studyDescription).toBe('CT brain plain');
  });

  it('creates new cards at the end of the inbox by default', async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-entry' }, error: null });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));

    mockFrom
      .mockReturnValueOnce(
        buildListChain([
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
            column_key: 'inbox',
            position: 0,
            created_by: 'user-1',
            updated_by: 'user-1',
            created_at: '2026-03-27T00:00:00Z',
            updated_at: '2026-03-27T00:00:00Z',
          },
        ]),
      )
      .mockReturnValueOnce({
        insert,
      });

    const result = await createConsultantDeckingEntry({
      patientName: '  Juan   Dela Cruz ',
      patientAge: 46,
      patientSex: 'M',
      difficulty: 'hard',
      patientSource: 'er',
      studyDate: '2026-03-27',
      studyTime: '08:30',
      studyDescription: '  CT  brain plain ',
    });

    expect(result.id).toBe('new-entry');
    expect(insert).toHaveBeenCalledWith({
      patient_name: 'Juan Dela Cruz',
      patient_age: 46,
      patient_sex: 'M',
      difficulty: 'hard',
      patient_source: 'er',
      study_date: '2026-03-27',
      study_time: '08:30',
      study_description: 'CT brain plain',
      column_key: 'inbox',
      position: 1,
      created_by: 'user-1',
      updated_by: 'user-1',
    });
  });

  it('reorders positions when moving between columns', () => {
    const reordered = __testables.reorderDeckingEntries(
      [
        {
          id: 'a',
          patientName: 'Alpha',
          patientAge: 34,
          patientSex: 'F',
          difficulty: 'easy',
          patientSource: 'inpatient',
          studyDate: '2026-03-27',
          studyTime: '08:00',
          studyDescription: 'MR brain plain',
          columnKey: 'inbox',
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
          difficulty: 'medium',
          patientSource: 'er',
          studyDate: '2026-03-27',
          studyTime: '08:15',
          studyDescription: 'CT chest plain',
          columnKey: 'reynes',
          position: 0,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-03-27T00:00:00Z',
          updatedAt: '2026-03-27T00:00:00Z',
        },
      ],
      'a',
      'reynes',
      1,
    );

    expect(reordered.find((entry) => entry.id === 'a')?.columnKey).toBe('reynes');
    expect(reordered.filter((entry) => entry.columnKey === 'inbox').map((entry) => entry.position)).toEqual([]);
    expect(reordered.filter((entry) => entry.columnKey === 'reynes').map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(reordered.filter((entry) => entry.columnKey === 'reynes').map((entry) => entry.position)).toEqual([0, 1]);
  });

  it('persists reordered positions through row updates on move', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));

    mockFrom
      .mockReturnValueOnce(
        buildListChain([
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
            column_key: 'inbox',
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
            column_key: 'reynes',
            position: 0,
            created_by: 'user-1',
            updated_by: 'user-2',
            created_at: '2026-03-27T00:00:00Z',
            updated_at: '2026-03-27T00:00:00Z',
          },
        ]),
      )
      .mockReturnValueOnce({
        update,
      })
      .mockReturnValueOnce({
        update,
      });

    await moveConsultantDeckingEntry('a', 'reynes', 1);

    expect(update).toHaveBeenNthCalledWith(1, {
      column_key: 'reynes',
      position: 0,
      updated_by: 'user-1',
    });
    expect(eq).toHaveBeenNthCalledWith(1, 'id', 'b');
    expect(update).toHaveBeenNthCalledWith(2, {
      column_key: 'reynes',
      position: 1,
      updated_by: 'user-1',
    });
    expect(eq).toHaveBeenNthCalledWith(2, 'id', 'a');
  });
});
