import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
