import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaseArchiveManager from './CaseArchiveManager';
import { removeArchivedCaseImages, saveArchivePdf } from '../services/caseArchiveService';

vi.mock('../services/supabase', () => {
  const caseRow = (id: string) => ({ id, title: 'Case', created_by: 'u1', created_at: '2026-08-20T02:00:00Z' });
  return {
    supabase: {
      rpc: vi.fn(async () => ({
        data: [
          { case_id: 'c1', title: 'Big recent case', created_at: '2026-09-15T02:00:00Z', owner_name: 'Ana', image_count: 3, bytes: 30 * 1024 * 1024 },
          { case_id: 'c2', title: 'August case', created_at: '2026-08-20T02:00:00Z', owner_name: 'Ben', image_count: 2, bytes: 10 * 1024 * 1024 },
          { case_id: 'c3', title: 'First of September', created_at: '2026-09-01T03:00:00Z', owner_name: 'Ana', image_count: 1, bytes: 5 * 1024 * 1024 },
        ],
        error: null,
      })),
      from: vi.fn((table: string) => ({
        select: () => ({
          eq: (_column: string, id: string) => ({
            single: async () => ({ data: caseRow(id), error: null }),
            maybeSingle: async () => ({ data: table === 'profiles' ? { nickname: 'Ana' } : null, error: null }),
          }),
        }),
      })),
    },
  };
});
vi.mock('../services/caseArchiveService', () => ({
  DRIVE_ARCHIVE_ENABLED: false,
  archiveCaseToDrive: vi.fn(),
  archivePdfFileName: (row: any) => `${row.id}.pdf`,
  pickArchiveFolder: vi.fn(async () => ({ folder: true })),
  renderArchivePdf: vi.fn(async () => new Blob(['%PDF'])),
  saveArchivePdf: vi.fn(async () => {}),
  removeArchivedCaseImages: vi.fn(async () => ({ removedImages: 2, imagesToRemove: 2 })),
}));

afterEach(() => vi.restoreAllMocks());

describe('CaseArchiveManager', () => {
  it('limits the list and "Select all" to cases uploaded up to the chosen day', async () => {
    render(<CaseArchiveManager onClose={() => {}} />);
    expect(await screen.findByText('Big recent case')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Uploaded up to'), { target: { value: '2026-09-01' } });
    expect(screen.queryByText('Big recent case')).not.toBeInTheDocument();
    expect(screen.getByText('August case')).toBeInTheDocument();
    expect(screen.getByText('First of September')).toBeInTheDocument();
    expect(screen.getByText(/2 case\(s\) still hold 15\.0 MB/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Select all'));
    expect(screen.getByRole('button', { name: /Save 2 PDF\(s\) to a folder \(15\.0 MB\)/ })).toBeInTheDocument();
  });

  it('saves the PDFs first and removes images only after a separate confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<CaseArchiveManager onClose={() => {}} />);
    await screen.findByText('August case');
    fireEvent.change(screen.getByLabelText('Uploaded up to'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByText('Select all'));
    fireEvent.click(screen.getByRole('button', { name: /Save 2 PDF/ }));

    const removeButton = await screen.findByRole('button', { name: 'Remove images of 2 saved case(s)' });
    expect(saveArchivePdf).toHaveBeenCalledTimes(2);
    expect(removeArchivedCaseImages).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(false);
    fireEvent.click(removeButton);
    expect(removeArchivedCaseImages).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    fireEvent.click(removeButton);
    await waitFor(() => expect(removeArchivedCaseImages).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Archived; images removed')).toHaveLength(2);
  });
});
