import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PathologyChecklistScreen from './PathologyChecklistScreen';

const serviceMocks = vi.hoisted(() => ({
  getCurrentPathologyGuidelines: vi.fn(),
  getFeaturedPathologyGuidelines: vi.fn(),
  getGuidelineDraftVersions: vi.fn(),
  getLatestEditableDraft: vi.fn(),
  getPathologyGuidelineDetail: vi.fn(),
  getPathologyGuidelineSource: vi.fn(),
  getRadioGraphicsTopicHubs: vi.fn(),
  getRelatedPathologyGuidelines: vi.fn(),
  searchPathologyGuidelines: vi.fn(),
  createPathologyGuidelineDraftFromCurrent: vi.fn(),
  createPathologyGuidelineSource: vi.fn(),
  importPathologyGuidelineVersion: vi.fn(),
  publishPathologyGuidelineVersion: vi.fn(),
  syncPathologyGuideline: vi.fn(),
  updatePathologyGuidelineDraft: vi.fn(),
  updatePathologyGuidelineSource: vi.fn(),
}));

vi.mock('../services/pathologyChecklistService', () => serviceMocks);
vi.mock('../services/pathologyGuidelineRequestService', () => ({
  createPathologyGuidelineRequest: vi.fn(),
  deletePathologyGuidelineRequest: vi.fn(),
  listPathologyGuidelineRequests: vi.fn(async () => []),
  updatePathologyGuidelineRequest: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u-1' } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { role: 'admin' } })),
        })),
      })),
    })),
  },
}));

const chestItem = {
  guideline_id: 'g-1',
  slug: 'lung-mass',
  pathology_name: 'Lung Mass',
  specialty: 'Thoracic',
  synonyms: ['pulmonary mass'],
  keywords: ['mass'],
  primary_topic: 'Thoracic',
  secondary_topics: [],
  clinical_tags: ['mass'],
  anatomy_terms: ['lung'],
  problem_terms: ['mass'],
  content_type: 'checklist',
  is_featured: true,
  search_priority: 10,
  related_guideline_slugs: [],
  source_title: 'Thoracic Mass Review',
  issuing_body: 'ACR',
  version_label: 'v1',
  effective_date: '2026-03-01',
  synced_at: '2026-03-01T00:00:00Z',
  published_at: '2026-03-02T00:00:00Z',
  source_kind: 'pdf',
  tldr_md: 'Pulmonary mass reporting checklist.',
  match_reason: 'Matched pathology: Lung Mass',
};

const generalItem = {
  guideline_id: 'g-2',
  slug: 'radiology-safety',
  pathology_name: 'Radiology Safety Basics',
  specialty: 'Education',
  synonyms: ['quality and safety'],
  keywords: ['safety'],
  primary_topic: 'Safety and Quality',
  secondary_topics: [],
  clinical_tags: ['safety'],
  anatomy_terms: [],
  problem_terms: [],
  content_type: 'guideline',
  is_featured: false,
  search_priority: 1,
  related_guideline_slugs: [],
  source_title: 'Safety Primer',
  issuing_body: 'RSNA',
  version_label: 'v1',
  effective_date: '2026-03-01',
  synced_at: '2026-03-01T00:00:00Z',
  published_at: '2026-03-01T00:00:00Z',
  source_kind: 'pdf',
  tldr_md: 'Quality and safety overview.',
  match_reason: 'Matched keyword: safety',
};

beforeEach(() => {
  serviceMocks.getCurrentPathologyGuidelines.mockResolvedValue([chestItem, generalItem]);
  serviceMocks.getFeaturedPathologyGuidelines.mockResolvedValue([chestItem]);
  serviceMocks.getRadioGraphicsTopicHubs.mockResolvedValue([]);
  serviceMocks.searchPathologyGuidelines.mockResolvedValue([chestItem]);
  serviceMocks.getPathologyGuidelineDetail.mockResolvedValue({
    ...chestItem,
    source_url: 'https://example.com/lung-mass.pdf',
    google_drive_url: '',
    reporting_takeaways: ['Correlate with prior imaging'],
    reporting_red_flags: [],
    suggested_report_phrases: [],
    checklist_items: [{ id: 'c1', label: 'Size', order: 1, section: 'Checklist', notes: null }],
    parse_notes: null,
    raw_text_excerpt: null,
    rich_summary_md: 'Summary',
  });
  serviceMocks.getRelatedPathologyGuidelines.mockResolvedValue([]);
  serviceMocks.getPathologyGuidelineSource.mockResolvedValue(null);
  serviceMocks.getGuidelineDraftVersions.mockResolvedValue([]);
});

describe('PathologyChecklistScreen', () => {
  it('keeps quick chips hidden by default, reveals them on focus, and still fills search from a chip', async () => {
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    expect(screen.getAllByText('Chest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('General & Other').length).toBeGreaterThan(0);
    expect(screen.getByText('Quick links for core training areas.')).toBeInTheDocument();
    expect(screen.getByText('Request a topic')).toBeInTheDocument();
    expect(screen.getByText('Choose a topic or guide to begin.')).toBeInTheDocument();
    expect(screen.queryByText('Mass')).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search pathology, syndrome, or keyword');
    fireEvent.focus(searchInput);

    expect(screen.getByText('Mass')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Mass'));

    await waitFor(() => expect(serviceMocks.searchPathologyGuidelines).toHaveBeenCalledWith('Mass'));
    expect(screen.getAllByText('Lung Mass')[0]).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.blur(searchInput);
    await waitFor(() => expect(screen.queryByText('Mass')).not.toBeInTheDocument());
  });
});
