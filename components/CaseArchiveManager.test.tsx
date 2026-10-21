import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CaseArchiveManager from './CaseArchiveManager';

vi.mock('../services/supabase', () => ({
  supabase: {
    rpc: vi.fn(async () => ({
      data: [
        { case_id: 'c1', title: 'Big recent case', created_at: '2026-09-15T02:00:00Z', owner_name: 'Ana', image_count: 3, bytes: 30 * 1024 * 1024 },
        { case_id: 'c2', title: 'August case', created_at: '2026-08-20T02:00:00Z', owner_name: 'Ben', image_count: 2, bytes: 10 * 1024 * 1024 },
        { case_id: 'c3', title: 'First of September', created_at: '2026-09-01T03:00:00Z', owner_name: 'Ana', image_count: 1, bytes: 5 * 1024 * 1024 },
      ],
      error: null,
    })),
  },
}));
vi.mock('../services/caseArchiveService', () => ({ archiveCaseToDrive: vi.fn() }));

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
    expect(screen.getByRole('button', { name: /Archive 2 selected \(15\.0 MB\)/ })).toBeInTheDocument();
  });
});
