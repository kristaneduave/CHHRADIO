import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UploadScreen from './UploadScreen';

const {
  saveCase,
  setCaseViberShareStatus,
  toastInfo,
  getUser,
  loadCaseUploadDraft,
  saveCaseUploadDraft,
  deleteCaseUploadDraft,
} = vi.hoisted(() => ({
  saveCase: vi.fn(),
  setCaseViberShareStatus: vi.fn(),
  toastInfo: vi.fn(),
  getUser: vi.fn(),
  loadCaseUploadDraft: vi.fn(),
  saveCaseUploadDraft: vi.fn(),
  deleteCaseUploadDraft: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { full_name: 'Dr. Test' } })),
        })),
      })),
    })),
  },
}));

vi.mock('../hooks/useCaseSubmission', () => ({
  useCaseSubmission: () => ({
    saveCase,
    exportPdf: vi.fn(),
    isSaving: false,
    isExportingPdf: false,
  }),
}));

vi.mock('../services/caseViberShareService', () => ({
  setCaseViberShareStatus,
}));

vi.mock('../services/caseDraftStorage', () => ({
  CASE_DRAFT_SCHEMA_VERSION: 1,
  createCaseDraftSignature: (draft: unknown, images: unknown[]) => JSON.stringify({ draft, images }),
  getCaseDraftKey: (userId: string, caseId: string, submissionType: string) =>
    `upload:case-draft:v1:${userId}:${caseId}:${submissionType}`,
  getLegacyCaseNotesDraftKey: (userId: string, caseId: string, submissionType: string) =>
    `upload:case-notes:draft:${userId}:${caseId}:${submissionType}`,
  loadCaseUploadDraft,
  saveCaseUploadDraft,
  deleteCaseUploadDraft,
}));

vi.mock('../utils/toast', () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo,
}));

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({ plainTextLimit }: { plainTextLimit?: number }) => (
    <div data-testid="rich-text-editor" data-plain-text-limit={plainTextLimit} />
  ),
}));

describe('UploadScreen case entry', () => {
  beforeEach(() => {
    saveCase.mockReset();
    setCaseViberShareStatus.mockReset();
    toastInfo.mockReset();
    getUser.mockReset();
    loadCaseUploadDraft.mockReset();
    saveCaseUploadDraft.mockReset();
    deleteCaseUploadDraft.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
    loadCaseUploadDraft.mockResolvedValue(null);
    saveCaseUploadDraft.mockResolvedValue(undefined);
    deleteCaseUploadDraft.mockResolvedValue(undefined);
    setCaseViberShareStatus.mockResolvedValue({
      case_id: 'case-1',
      viber_shared_at: '2026-08-28T00:00:00.000Z',
      viber_shared_by: 'user-1',
      viber_shared_by_name: 'Dr. Test',
    });
  });

  it.each(['interesting_case', 'rare_pathology', 'aunt_minnie'] as const)(
    'renders the 2,000-character findings/description limit for %s',
    (submissionType) => {
      render(<UploadScreen initialSubmissionType={submissionType} />);

      expect(screen.getByPlaceholderText('Enter findings...')).toHaveAttribute('maxlength', '2000');
      expect(screen.getByText('0/2000')).toBeInTheDocument();
    }
  );

  it.each(['interesting_case', 'aunt_minnie'] as const)(
    'passes the 10,000-character limit to the Notes editor for %s',
    async (submissionType) => {
      render(<UploadScreen initialSubmissionType={submissionType} />);

      expect(screen.getByText('0/10000')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /add notes/i }));
      expect(screen.getByTestId('rich-text-editor')).toHaveAttribute('data-plain-text-limit', '10000');
    }
  );

  it('keeps the Rare Pathology radiologic clinchers input at 160 characters', () => {
    render(<UploadScreen initialSubmissionType="rare_pathology" />);

    expect(screen.getByPlaceholderText('Enter radiologic clinchers...')).toHaveAttribute('maxlength', '160');
    expect(screen.getByText('0/160')).toBeInTheDocument();
  });

  it('offers the approved edition-specific mother books without PI-RADS', () => {
    render(<UploadScreen initialSubmissionType="interesting_case" />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Reference 1 source type' }), {
      target: { value: 'Standard Reference Book' },
    });

    const bookSelect = screen.getByRole('combobox', { name: 'Reference 1 book' });
    const bookOptions = within(bookSelect).getAllByRole('option').map((option) => option.textContent || '');
    expect(bookOptions).toContain('Fundamentals of Diagnostic Radiology — 5th ed. (2019)');
    expect(bookOptions).toContain("Caffey's Pediatric Diagnostic Imaging — 13th ed. (2019)");
    expect(bookOptions.join(' ')).not.toMatch(/PI-RADS/i);
  });

  it('shows the matching custom input for links and other books', () => {
    render(<UploadScreen initialSubmissionType="interesting_case" />);

    const sourceType = screen.getByRole('combobox', { name: 'Reference 1 source type' });
    fireEvent.change(sourceType, { target: { value: 'Web Link' } });
    expect(screen.getByRole('textbox', { name: 'Reference 1 Web link' })).toHaveAttribute('type', 'url');

    fireEvent.change(sourceType, { target: { value: 'Standard Reference Book' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Reference 1 book' }), {
      target: { value: '__other_book__' },
    });
    expect(screen.getByRole('textbox', { name: 'Reference 1 other book' })).toBeInTheDocument();
  });

  it('preserves an unlisted legacy book as an editable Other book', () => {
    render(
      <UploadScreen
        existingCase={{
          id: 'case-1',
          submission_type: 'interesting_case',
          analysis_result: {
            reference: {
              sourceType: 'Book',
              title: 'Legacy Radiology Text — 2nd ed. (2001)',
              page: 'p. 10',
            },
          },
        }}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Reference 1 source type' })).toHaveValue('Standard Reference Book');
    expect(screen.getByRole('combobox', { name: 'Reference 1 book' })).toHaveValue('__other_book__');
    expect(screen.getByRole('textbox', { name: 'Reference 1 other book' })).toHaveValue('Legacy Radiology Text — 2nd ed. (2001)');
    expect(screen.getByRole('textbox', { name: 'Reference 1 page or section' })).toHaveValue('p. 10');
  });

  it('shows manual Viber tracking only for already-published Interesting Cases', () => {
    let view = render(<UploadScreen initialSubmissionType="interesting_case" />);
    expect(screen.queryByRole('checkbox', { name: 'Sent to Viber GC' })).not.toBeInTheDocument();

    view.unmount();
    view = render(
      <UploadScreen
        existingCase={{
          id: 'case-1',
          status: 'draft',
          submission_type: 'interesting_case',
        }}
      />
    );
    expect(screen.queryByRole('checkbox', { name: 'Sent to Viber GC' })).not.toBeInTheDocument();

    view.unmount();
    view = render(
      <UploadScreen
        existingCase={{
          id: 'case-1',
          status: 'published',
          submission_type: 'interesting_case',
        }}
      />
    );
    expect(screen.getByRole('checkbox', { name: 'Sent to Viber GC' })).not.toBeChecked();

    view.unmount();
    render(
      <UploadScreen
        existingCase={{
          id: 'case-2',
          status: 'published',
          submission_type: 'rare_pathology',
        }}
      />
    );
    expect(screen.queryByRole('checkbox', { name: 'Sent to Viber GC' })).not.toBeInTheDocument();
  });

  it('loads an existing Viber status as checked', () => {
    render(
      <UploadScreen
        existingCase={{
          id: 'case-1',
          status: 'published',
          submission_type: 'interesting_case',
          viber_shared_at: '2026-08-27T10:00:00.000Z',
        }}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Sent to Viber GC' })).toBeChecked();
  });

  it('records the selected Viber status after publishing', async () => {
    saveCase.mockImplementation(async ({ onSuccess }) => {
      await onSuccess('case-1', 'DX-001');
    });

    render(
      <UploadScreen
        existingCase={{
          id: 'case-1',
          status: 'published',
          submission_type: 'interesting_case',
          patient_initials: 'AB',
          clinical_history: 'Clinical history',
          findings: 'Imaging findings',
          image_urls: ['https://example.com/image.jpg'],
          analysis_result: {},
        }}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Sent to Viber GC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update & Publish' }));

    await waitFor(() => {
      expect(setCaseViberShareStatus).toHaveBeenCalledWith('case-1', true);
    });
  });

  it('offers to restore a complete local draft and applies its saved fields and images', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'doctor@example.com' } } });
    loadCaseUploadDraft.mockResolvedValue({
      draft: {
        version: 1,
        savedAt: '2026-08-28T02:00:00.000Z',
        formData: {
          submissionType: 'interesting_case',
          initials: 'XY',
          age: '42',
          sex: 'F',
          modality: 'MRI',
          organSystem: 'Neuroradiology',
          patientId: 'P-100',
          caseSource: 'Infinitt',
          clinicalData: 'Restored history',
          findings: 'Restored findings',
          impression: 'Restored impression',
          notes: '<p>Restored notes</p>',
          radiologicClinchers: '',
          referenceSourceType: '',
          referenceTitle: '',
          referencePage: '',
          references: [{ id: 'reference-1', sourceType: '', title: '', page: '', bookSelection: '' }],
          diagnosis: '',
          date: '2026-08-28',
        },
        customTitle: 'Restored case title',
        step: 1,
        sentToViberGc: true,
      },
      images: [{
        url: 'https://example.com/restored.jpg',
        file: new File([], 'existing_image'),
        description: 'Restored image',
      }],
    });

    render(<UploadScreen initialSubmissionType="interesting_case" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(screen.getByPlaceholderText('Enter case title')).toHaveValue('Restored case title');
    expect(screen.getByPlaceholderText('Enter findings...')).toHaveValue('Restored findings');
    expect(screen.queryByRole('checkbox', { name: 'Sent to Viber GC' })).not.toBeInTheDocument();
    expect(screen.getByAltText('Uploaded case image 1')).toHaveAttribute('src', 'https://example.com/restored.jpg');
  });

  it('discards a discovered local draft', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'doctor@example.com' } } });
    loadCaseUploadDraft.mockResolvedValue({
      draft: {
        version: 1,
        savedAt: '2026-08-28T02:00:00.000Z',
        formData: {},
        customTitle: 'Discard me',
        step: 1,
        sentToViberGc: false,
      },
      images: [],
    });

    render(<UploadScreen initialSubmissionType="interesting_case" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      expect(deleteCaseUploadDraft).toHaveBeenCalledWith('upload:case-draft:v1:user-1:new:interesting_case');
    });
    expect(screen.queryByText('Local draft found')).not.toBeInTheDocument();
  });

  it('autosaves changed form fields after draft discovery completes', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'doctor@example.com' } } });
    render(<UploadScreen initialSubmissionType="interesting_case" />);

    expect(await screen.findByText('Autosave ready')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Enter findings...'), { target: { value: 'Autosaved findings' } });

    await waitFor(() => expect(saveCaseUploadDraft).toHaveBeenCalled(), { timeout: 2500 });
    const savedDraft = saveCaseUploadDraft.mock.calls.at(-1)?.[1];
    expect(savedDraft.formData.findings).toBe('Autosaved findings');
  });
});
