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

vi.mock('../services/publishedCasesService', () => ({
  getCachedPublishedCasesBundle,
  fetchPublishedCasesBundle,
  refreshPublishedCasesBundle,
}));

vi.mock('../services/caseViberShareService', () => ({
  CASE_VIBER_SHARE_UPDATED_EVENT: 'radcore-case-viber-share-updated',
}));

vi.mock('../utils/toast', () => ({ toastError: vi.fn() }));
vi.mock('./responsive/useViewport', () => ({ useAppViewport: () => 'mobile' }));
vi.mock('./ui/PageHeader', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));
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

    expect(screen.getByLabelText(/Sent to Viber on .* by Dr\. Test/i)).toBeInTheDocument();
    expect(screen.getAllByText('Viber')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    expect(screen.getByLabelText('Viber status')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sent to Viber' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Not sent to Viber' })).toBeInTheDocument();
  });

  it('filters to unshared Interesting Cases and preserves the selection for return navigation', async () => {
    const firstRender = render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle advanced filters' }));
    fireEvent.change(screen.getByLabelText('Viber status'), { target: { value: 'not_sent' } });
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

  it('removes a case from the Not sent queue immediately when it is marked sent', async () => {
    render(<SearchScreen currentUserId="user-1" onCaseSelect={vi.fn()} />);
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
  });

  it('hides Viber workflow status and filtering from anonymous viewers', () => {
    render(<SearchScreen currentUserId={null} onCaseSelect={vi.fn()} />);

    expect(screen.queryByText('Viber')).not.toBeInTheDocument();
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
    });
  });
});
