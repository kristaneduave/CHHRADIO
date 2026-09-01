import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchScreen from './SearchScreen';

const {
  getCachedPublishedCasesBundle,
  fetchPublishedCasesBundle,
  refreshPublishedCasesBundle,
} = vi.hoisted(() => ({
  getCachedPublishedCasesBundle: vi.fn(),
  fetchPublishedCasesBundle: vi.fn(),
  refreshPublishedCasesBundle: vi.fn(),
}));
const viewportState = vi.hoisted(() => ({ current: 'mobile' as 'mobile' | 'desktop' }));

vi.mock('../services/publishedCasesService', () => ({
  getCachedPublishedCasesBundle,
  fetchPublishedCasesBundle,
  refreshPublishedCasesBundle,
}));

vi.mock('../services/caseViberShareService', () => ({
  CASE_VIBER_SHARE_UPDATED_EVENT: 'radcore-case-viber-share-updated',
}));

vi.mock('../utils/toast', () => ({ toastError: vi.fn() }));
vi.mock('./responsive/useViewport', () => ({ useAppViewport: () => viewportState.current }));
vi.mock('./ui/PageHeader', () => ({ default: ({ title, action }: { title: string; action?: React.ReactNode }) => <header><h1>{title}</h1>{action}</header> }));
vi.mock('./ui/PageShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const sharedAt = '2026-08-28T02:43:00.000Z';

const buildBundle = () => ({
  records: [
    {
      id: 'shared-interesting',
      name: 'Shared Interesting Case',
      initials: 'AB',
      age: 40,
      date: '2026-08-28T02:00:00.000Z',
      specialty: 'Neuroradiology',
      modality: 'MRI',
      diagnosticCode: 'Diagnosis',
      status: 'Published' as const,
      submission_type: 'interesting_case' as const,
      author: 'Dr. Author',
      viber_shared_at: sharedAt,
      viber_shared_by: 'staff-1',
      viber_shared_by_name: 'Dr. Test',
    },
    {
      id: 'unshared-interesting',
      name: 'Unshared Interesting Case',
      initials: 'CD',
      age: 50,
      date: '2026-08-27T02:00:00.000Z',
      specialty: 'Chest / Thoracic',
      modality: 'CT Scan',
      diagnosticCode: 'Diagnosis',
      status: 'Published' as const,
      submission_type: 'interesting_case' as const,
      author: 'Dr. Author',
      viber_shared_at: null,
      viber_shared_by: null,
      viber_shared_by_name: null,
    },
    {
      id: 'shared-rare',
      name: 'Shared Rare Pathology',
      initials: 'EF',
      age: 60,
      date: '2026-08-26T02:00:00.000Z',
      specialty: 'Musculoskeletal (MSK)',
      modality: 'X-Ray',
      diagnosticCode: 'Diagnosis',
      status: 'Published' as const,
      submission_type: 'rare_pathology' as const,
      author: 'Dr. Author',
      viber_shared_at: sharedAt,
      viber_shared_by: 'staff-1',
      viber_shared_by_name: 'Dr. Test',
    },
  ],
  rawCases: [
    { id: 'shared-interesting', status: 'published', submission_type: 'interesting_case', viber_shared_at: sharedAt },
    { id: 'unshared-interesting', status: 'published', submission_type: 'interesting_case', viber_shared_at: null },
    { id: 'shared-rare', status: 'published', submission_type: 'rare_pathology', viber_shared_at: sharedAt },
  ],
});

describe('SearchScreen Viber status', () => {
  beforeEach(() => {
    viewportState.current = 'mobile';
    window.localStorage.clear();
    window.sessionStorage.clear();
    getCachedPublishedCasesBundle.mockReset();
    fetchPublishedCasesBundle.mockReset();
    refreshPublishedCasesBundle.mockReset();
    const bundle = buildBundle();
    getCachedPublishedCasesBundle.mockReturnValue(bundle);
    refreshPublishedCasesBundle.mockResolvedValue(bundle);
  });

  it('shows one minimalist Viber badge and the filter to registered users', () => {
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    const badge = screen.getByLabelText(/Sent to Viber on .* by Dr\. Test/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', expect.stringMatching(/Sent to Viber on .* by Dr\. Test/i));
    expect(screen.getByText('Viber · T')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Viber queue, 1 case pending' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    expect(screen.getByLabelText('Viber status')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sent to Viber' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Not sent to Viber' })).toBeInTheDocument();
  });

  it.each([
    ['Gene Robert Michael Sales', 'GRS'],
    ['Alexandria', 'A'],
    [null, 'HS'],
  ])('shows compact marker initials for %s', (staffName, expectedInitials) => {
    const bundle = buildBundle();
    bundle.records[0] = { ...bundle.records[0], viber_shared_by_name: staffName };
    getCachedPublishedCasesBundle.mockReturnValue(bundle);

    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    expect(screen.getByText(`Viber · ${expectedInitials}`)).toBeInTheDocument();
  });

  it('filters to unshared Interesting Cases and preserves the selection for return navigation', async () => {
    const firstRender = render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    fireEvent.change(screen.getByLabelText('Viber status'), { target: { value: 'not_sent' } });
    expect(screen.getByLabelText('Sort search results')).toHaveValue('oldest');
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(screen.getByText('Viber: Not sent')).toBeInTheDocument();
    expect(screen.getByText('1 case')).toBeInTheDocument();
    expect(screen.getByText('UNSHARED INTERESTING CASE')).toBeInTheDocument();
    expect(screen.queryByText('SHARED RARE PATHOLOGY')).not.toBeInTheDocument();

    firstRender.unmount();
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Viber: Not sent')).toBeInTheDocument());
    expect(screen.getByText('UNSHARED INTERESTING CASE')).toBeInTheDocument();
  });

  it('uses a mobile filter sheet and discards unapplied changes', () => {
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    expect(screen.getByRole('dialog', { name: 'Advanced filters' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Viber status'), { target: { value: 'not_sent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Advanced filters' })).not.toBeInTheDocument();
    expect(screen.queryByText('Viber: Not sent')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    expect(screen.getByLabelText('Viber status')).toHaveValue('all');
  });

  it('keeps advanced filters inline on desktop', () => {
    viewportState.current = 'desktop';
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Advanced filters')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close filters' })).not.toBeInTheDocument();
  });

  it('shows an active-filter count and removes individual mobile chips', () => {
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);
    const filterButton = screen.getByRole('button', { name: 'Toggle advanced filters' });
    fireEvent.click(filterButton);
    fireEvent.change(screen.getByLabelText('Viber status'), { target: { value: 'not_sent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(filterButton).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Viber: Not sent' }));

    expect(screen.queryByText('Viber: Not sent')).not.toBeInTheDocument();
    expect(screen.getByText('SHARED INTERESTING CASE')).toBeInTheDocument();
    expect(filterButton).not.toHaveTextContent('1');
  });

  it('removes a case from the Not sent queue immediately when it is marked sent', async () => {
    refreshPublishedCasesBundle.mockReturnValue(new Promise(() => {}));
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Open Viber queue, 1 case pending' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    fireEvent.change(screen.getByLabelText('Viber status'), { target: { value: 'not_sent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByText('UNSHARED INTERESTING CASE')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('radcore-case-viber-share-updated', {
        detail: {
          case_id: 'unshared-interesting',
          viber_shared_at: sharedAt,
          viber_shared_by: 'staff-1',
          viber_shared_by_name: 'Dr. Test',
        },
      }));
    });

    await waitFor(() => expect(screen.queryByText('UNSHARED INTERESTING CASE')).not.toBeInTheDocument());
    expect(screen.getByText('0 cases')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Viber queue, 0 cases pending' })).toBeInTheDocument());
  });

  it('opens the complete Viber queue with the oldest case first', () => {
    const bundle = buildBundle();
    bundle.records.push({
      ...bundle.records[1],
      id: 'older-unshared-interesting',
      name: 'Older Unshared Interesting Case',
      date: '2026-08-20T02:00:00.000Z',
    });
    bundle.rawCases.push({ id: 'older-unshared-interesting', status: 'published', submission_type: 'interesting_case', viber_shared_at: null });
    getCachedPublishedCasesBundle.mockReturnValue(bundle);

    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Viber queue, 2 cases pending' }));

    expect(screen.getByText('Viber: Not sent')).toBeInTheDocument();
    expect(screen.getByText('2 cases')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    expect(screen.getByLabelText('Sort search results')).toHaveValue('oldest');
    const olderCase = screen.getByText('OLDER UNSHARED INTERESTING CASE');
    const newerCase = screen.getByText('UNSHARED INTERESTING CASE');
    expect(olderCase.compareDocumentPosition(newerCase) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides Viber workflow status and filtering from anonymous viewers', () => {
    render(<SearchScreen currentUserId={null} onCaseSelect={vi.fn()} />);

    expect(screen.queryByText('Viber')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open Viber queue/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Sent to Viber on/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    expect(screen.queryByLabelText('Viber status')).not.toBeInTheDocument();
  });

  it('shows the badge immediately when an Interesting Case is marked as sent', async () => {
    const bundle = buildBundle();
    bundle.records[0] = { ...bundle.records[0], viber_shared_at: null, viber_shared_by: null, viber_shared_by_name: null };
    bundle.rawCases[0] = { ...bundle.rawCases[0], viber_shared_at: null };
    getCachedPublishedCasesBundle.mockReturnValue(bundle);

    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);
    expect(screen.queryByLabelText(/Sent to Viber on/i)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('radcore-case-viber-share-updated', {
        detail: {
          case_id: 'shared-interesting',
          viber_shared_at: sharedAt,
          viber_shared_by: 'staff-1',
          viber_shared_by_name: 'Dr. Test',
        },
      }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Sent to Viber on .* by Dr\. Test/i)).toBeInTheDocument();
      expect(screen.getByText('Viber · T')).toBeInTheDocument();
    });
  });

  it('shows a completed Viber queue state with a direct path back to all cases', async () => {
    const bundle = buildBundle();
    bundle.records[1] = {
      ...bundle.records[1],
      viber_shared_at: sharedAt,
      viber_shared_by: 'staff-1',
      viber_shared_by_name: 'Dr. Test',
    };
    bundle.rawCases[1] = { ...bundle.rawCases[1], viber_shared_at: sharedAt };
    getCachedPublishedCasesBundle.mockReturnValue(bundle);
    refreshPublishedCasesBundle.mockReturnValue(new Promise(() => {}));

    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Viber queue, 0 cases pending' }));

    expect(await screen.findByText('Viber queue is clear')).toBeInTheDocument();
    expect(screen.getByText('All published Interesting Cases have been sent to Viber.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View all cases' }));
    expect(screen.getByText('SHARED INTERESTING CASE')).toBeInTheDocument();
  });

  it('guides an empty sent-to-Viber view back to pending cases', async () => {
    const bundle = buildBundle();
    bundle.records[0] = {
      ...bundle.records[0],
      viber_shared_at: null,
      viber_shared_by: null,
      viber_shared_by_name: null,
    };
    bundle.rawCases[0] = { ...bundle.rawCases[0], viber_shared_at: null };
    getCachedPublishedCasesBundle.mockReturnValue(bundle);
    refreshPublishedCasesBundle.mockReturnValue(new Promise(() => {}));

    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    fireEvent.change(screen.getByLabelText('Viber status'), { target: { value: 'sent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByText('No cases have been marked sent')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View pending cases' }));
    expect(screen.getByText('Viber: Not sent')).toBeInTheDocument();
    expect(screen.getByText('UNSHARED INTERESTING CASE')).toBeInTheDocument();
  });

  it('offers to clear a search when no cases match the query', async () => {
    refreshPublishedCasesBundle.mockReturnValue(new Promise(() => {}));
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    const search = screen.getByLabelText('Search Database');
    fireEvent.change(search, { target: { value: 'No such case' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(await screen.findByText('No cases match “No such case”')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear search'));
    expect(screen.getByText('SHARED INTERESTING CASE')).toBeInTheDocument();
  });

  it('shows a filter-specific empty state for non-Viber filters', async () => {
    refreshPublishedCasesBundle.mockReturnValue(new Promise(() => {}));
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'aunt_minnie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByText('No cases match these filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('SHARED INTERESTING CASE')).toBeInTheDocument();
  });

  it('uses a neutral empty library message for anonymous visitors', async () => {
    const emptyBundle = { records: [], rawCases: [] };
    getCachedPublishedCasesBundle.mockReturnValue(emptyBundle);
    refreshPublishedCasesBundle.mockReturnValue(new Promise(() => {}));

    render(<SearchScreen currentUserId={null} onCaseSelect={vi.fn()} />);

    expect(await screen.findByText('No published cases yet')).toBeInTheDocument();
    expect(screen.getByText('Published cases will appear here when they become available.')).toBeInTheDocument();
    expect(screen.queryByText(/Viber/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clear|View/i })).not.toBeInTheDocument();
  });
});
