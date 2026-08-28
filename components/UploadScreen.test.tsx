import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UploadScreen from './UploadScreen';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  },
}));

vi.mock('../hooks/useCaseSubmission', () => ({
  useCaseSubmission: () => ({
    saveCase: vi.fn(),
    exportPdf: vi.fn(),
    isSaving: false,
    isExportingPdf: false,
  }),
}));

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({ plainTextLimit }: { plainTextLimit?: number }) => (
    <div data-testid="rich-text-editor" data-plain-text-limit={plainTextLimit} />
  ),
}));

describe('UploadScreen text limits', () => {
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
});
