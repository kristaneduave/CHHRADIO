import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PathologyChecklistScreen from './PathologyChecklistScreen';

const serviceMocks = vi.hoisted(() => ({
  getCurrentPathologyGuidelines: vi.fn(),
  getFeaturedPathologyGuidelines: vi.fn(),
  getGuidelineDraftVersions: vi.fn(),
  getLatestEditableDraft: vi.fn(),
  getPathologyGuidelineDetail: vi.fn(),
  getPathologyGuidelineSource: vi.fn(),
  getPathologyGuidelineSourceBySlug: vi.fn(),
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

const requestServiceMocks = vi.hoisted(() => ({
  createPathologyGuidelineRequest: vi.fn(),
  deletePathologyGuidelineRequest: vi.fn(),
  listPathologyGuidelineRequests: vi.fn(async () => []),
  updatePathologyGuidelineRequest: vi.fn(),
}));

vi.mock('../services/pathologyChecklistService', () => serviceMocks);
vi.mock('../services/pathologyGuidelineRequestService', () => requestServiceMocks);
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

const setDesktopDetailMode = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(min-width: 1280px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

beforeEach(() => {
  setDesktopDetailMode(false);
  requestServiceMocks.createPathologyGuidelineRequest.mockReset();
  requestServiceMocks.deletePathologyGuidelineRequest.mockReset();
  requestServiceMocks.updatePathologyGuidelineRequest.mockReset();
  requestServiceMocks.listPathologyGuidelineRequests.mockReset();
  requestServiceMocks.listPathologyGuidelineRequests.mockResolvedValue([]);
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
    rich_summary_md: 'Engineered stone silicosis is an accelerated occupational pneumoconiosis linked to countertop fabrication and polishing.\n\nChest imaging often shows upper-lung nodules, nodal calcification, pseudoplaques, and progressive massive fibrosis, but lower-lung disease and ground-glass change can also occur.',
  });
  serviceMocks.getRelatedPathologyGuidelines.mockResolvedValue([]);
  serviceMocks.getPathologyGuidelineSource.mockResolvedValue(null);
  serviceMocks.getPathologyGuidelineSourceBySlug.mockResolvedValue(null);
  serviceMocks.getGuidelineDraftVersions.mockResolvedValue([]);
});

describe('PathologyChecklistScreen', () => {
  it('keeps quick chips hidden by default, reveals them on focus, and still fills search from a chip', async () => {
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    expect(screen.getAllByText('Chest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('General & Other').length).toBeGreaterThan(0);
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New article' })).toBeInTheDocument();
    expect(screen.queryByText('Mass')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New article' }));

    expect(screen.getByRole('heading', { name: 'New article' })).toBeInTheDocument();
    expect(screen.getByText('Paste or upload checklist JSON, then add the article title and source link.')).toBeInTheDocument();
    expect(screen.getByText('Import checklist JSON')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search pathology, syndrome, or keyword...');
    fireEvent.focus(searchInput);

    expect(screen.getByText('Mass')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Mass'));

    await waitFor(() => expect(serviceMocks.searchPathologyGuidelines).toHaveBeenCalledWith('Mass'));
    expect(screen.getAllByText('Lung Mass')[0]).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.blur(searchInput);
    await waitFor(() => expect(screen.queryByText('Mass')).not.toBeInTheDocument());
  });

  it('opens the request drawer from the search bar and submits a request', async () => {
    requestServiceMocks.createPathologyGuidelineRequest.mockResolvedValue(undefined);
    requestServiceMocks.listPathologyGuidelineRequests.mockResolvedValue([]);

    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());

    expect(screen.queryByText('Suggest a topic, file, or update for the RadioGraphics library.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open request topic form' }));

    expect(screen.getByText('Request a topic')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('What do you want added?'), { target: { value: 'Pancreatic cyst follow-up' } });
    fireEvent.change(screen.getByPlaceholderText('Optional source link'), { target: { value: 'https://example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Optional context'), { target: { value: 'Please add a quick-reference guide.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(requestServiceMocks.createPathologyGuidelineRequest).toHaveBeenCalledWith({
      request_type: 'topic',
      title: 'Pancreatic cyst follow-up',
      description: 'Please add a quick-reference guide.',
      source_url: 'https://example.com',
    }));
    await waitFor(() => expect(screen.queryByText('Suggest a topic, file, or update for the RadioGraphics library.')).not.toBeInTheDocument());
  });

  it('opens guide detail in a mobile full-screen sheet', async () => {
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Guide details' });
    expect(within(dialog).queryByText('RadioGraphics guide')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Lung Mass' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('heading', { name: 'Lung Mass' })).toHaveLength(1);
    expect(within(dialog).getAllByRole('link', { name: /Read full article|Open full article/i }).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText('Pulmonary mass reporting checklist.')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Article controls' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Edit checklist draft')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Quick Summary' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Reference source' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Background and nuances' })).not.toBeInTheDocument();
    expect(await within(dialog).findByText(/accelerated occupational pneumoconiosis/i)).toBeInTheDocument();
    expect(dialog.querySelector('div[class*="overflow-y-auto"]')?.className).not.toContain('pt-4');

    fireEvent.click(within(dialog).getByLabelText('Close guide details'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Guide details' })).not.toBeInTheDocument());
  });

  it('opens guide detail in a centered modal on desktop', async () => {
    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    const dialog = await screen.findByRole('dialog', { name: 'Guide details' });
    expect(within(dialog).queryByText('RadioGraphics guide')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Lung Mass' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('heading', { name: 'Lung Mass' })).toHaveLength(1);
    expect(within(dialog).getByLabelText('Jump to section')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Read full|Full article|Read full article/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Article controls' })).toBeInTheDocument();
    expect(screen.queryByText('Editor controls')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Edit checklist draft')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Quick Summary' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Reference source' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Background and nuances' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/accelerated occupational pneumoconiosis/i)).toBeInTheDocument();
    expect(within(dialog).queryByText('Pulmonary mass reporting checklist.')).not.toBeInTheDocument();

    fireEvent.click(dialog.parentElement as Element);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Guide details' })).not.toBeInTheDocument());
  });

  it('does not auto-open the first search result before the user clicks it', async () => {
    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    serviceMocks.getPathologyGuidelineDetail.mockClear();

    fireEvent.change(screen.getByPlaceholderText('Search pathology, syndrome, or keyword...'), {
      target: { value: 'lung' },
    });

    await waitFor(() => expect(serviceMocks.searchPathologyGuidelines).toHaveBeenCalledWith('lung'));
    expect(serviceMocks.getPathologyGuidelineDetail).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Guide details' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    expect(await screen.findByRole('dialog', { name: 'Guide details' })).toBeInTheDocument();
  });

  it('hides an article for privileged users from the bottom control panel', async () => {
    serviceMocks.getPathologyGuidelineSource.mockResolvedValueOnce({
      id: 'g-1',
      slug: 'lung-mass',
      pathology_name: 'Lung Mass',
      specialty: 'Thoracic',
      synonyms: [],
      keywords: [],
      source_url: 'https://example.com/lung-mass.pdf',
      source_kind: 'pdf',
      google_drive_url: '',
      google_drive_file_id: '',
      source_title: 'Thoracic Mass Review',
      issuing_body: 'ACR',
      is_active: true,
      primary_topic: 'Thoracic',
      secondary_topics: [],
      clinical_tags: ['mass'],
      anatomy_terms: ['lung'],
      problem_terms: ['mass'],
      content_type: 'checklist',
      is_featured: false,
      search_priority: 10,
      related_guideline_slugs: [],
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    fireEvent.click(screen.getByRole('button', { name: 'Hide article' }));

    await waitFor(() => expect(serviceMocks.updatePathologyGuidelineSource).toHaveBeenCalledWith('g-1', { is_active: false }));
  });

  it('restores a hidden article for privileged users from the bottom control panel', async () => {
    serviceMocks.getPathologyGuidelineSource.mockResolvedValueOnce({
      id: 'g-1',
      slug: 'lung-mass',
      pathology_name: 'Lung Mass',
      specialty: 'Thoracic',
      synonyms: [],
      keywords: [],
      source_url: 'https://example.com/lung-mass.pdf',
      source_kind: 'pdf',
      google_drive_url: '',
      google_drive_file_id: '',
      source_title: 'Thoracic Mass Review',
      issuing_body: 'ACR',
      is_active: false,
      primary_topic: 'Thoracic',
      secondary_topics: [],
      clinical_tags: ['mass'],
      anatomy_terms: ['lung'],
      problem_terms: ['mass'],
      content_type: 'checklist',
      is_featured: false,
      search_priority: 10,
      related_guideline_slugs: [],
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    });

    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    fireEvent.click(screen.getByRole('button', { name: 'Restore article' }));

    await waitFor(() => expect(serviceMocks.updatePathologyGuidelineSource).toHaveBeenCalledWith('g-1', { is_active: true }));
  });

  it('allows saving a source-link update for an existing active article without requiring a primary topic', async () => {
    const incompleteActiveSource = {
      id: 'g-1',
      slug: 'lung-mass',
      pathology_name: 'Lung Mass',
      specialty: 'Thoracic',
      synonyms: [],
      keywords: [],
      source_url: '',
      source_kind: 'pdf',
      google_drive_url: '',
      google_drive_file_id: '',
      source_title: 'Thoracic Mass Review',
      issuing_body: 'ACR',
      is_active: true,
      primary_topic: '',
      secondary_topics: [],
      clinical_tags: [],
      anatomy_terms: [],
      problem_terms: [],
      content_type: 'checklist',
      is_featured: false,
      search_priority: 10,
      related_guideline_slugs: [],
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    };
    serviceMocks.getPathologyGuidelineSource
      .mockResolvedValueOnce(incompleteActiveSource)
      .mockResolvedValueOnce({ ...incompleteActiveSource, source_url: 'https://example.com/full-article.pdf' });

    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://example.com/full-article.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save source' }));

    await waitFor(() => expect(serviceMocks.updatePathologyGuidelineSource).toHaveBeenCalledWith(
      'g-1',
      expect.objectContaining({
        is_active: true,
        primary_topic: null,
        source_url: 'https://example.com/full-article.pdf',
      }),
    ));
  });

  it('prefills the new-source form from the current article instead of resetting to empty fields', async () => {
    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    fireEvent.click(screen.getByRole('button', { name: 'New source' }));

    expect(screen.getByLabelText('Pathology name')).toHaveValue('Lung Mass');
    expect(screen.getByLabelText('Slug')).toHaveValue('lung-mass');
    expect(screen.getByLabelText('Source title')).toHaveValue('Thoracic Mass Review');
  });

  it('keeps the existing source record attached after pressing new source on an existing article', async () => {
    const existingSource = {
      id: 'g-1',
      slug: 'lung-mass',
      pathology_name: 'Lung Mass',
      specialty: 'Thoracic',
      synonyms: [],
      keywords: [],
      source_url: '',
      source_kind: 'pdf',
      google_drive_url: '',
      google_drive_file_id: '',
      source_title: 'Thoracic Mass Review',
      issuing_body: 'ACR',
      is_active: true,
      primary_topic: '',
      secondary_topics: [],
      clinical_tags: [],
      anatomy_terms: [],
      problem_terms: [],
      content_type: 'checklist',
      is_featured: false,
      search_priority: 10,
      related_guideline_slugs: [],
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    };
    serviceMocks.getPathologyGuidelineSource
      .mockResolvedValueOnce(existingSource)
      .mockResolvedValueOnce({ ...existingSource, source_url: 'https://example.com/updated.pdf' });

    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    fireEvent.click(screen.getByRole('button', { name: 'New source' }));
    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://example.com/updated.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save source' }));

    await waitFor(() => expect(serviceMocks.updatePathologyGuidelineSource).toHaveBeenCalledWith(
      'g-1',
      expect.objectContaining({
        source_url: 'https://example.com/updated.pdf',
      }),
    ));
    expect(serviceMocks.createPathologyGuidelineSource).not.toHaveBeenCalled();
  });

  it('reuses an existing source when a new article save collides on slug', async () => {
    const existingSource = {
      id: 'g-9',
      slug: 'fibromuscular-dysplasia-multisystem-imaging-manifestations',
      pathology_name: 'Fibromuscular dysplasia (FMD)',
      specialty: 'General reporting pearls',
      synonyms: [],
      keywords: [],
      source_url: '',
      source_kind: 'pdf',
      google_drive_url: '',
      google_drive_file_id: '',
      source_title: 'Older source title',
      issuing_body: 'RadioGraphics',
      is_active: true,
      primary_topic: 'General reporting pearls',
      secondary_topics: [],
      clinical_tags: [],
      anatomy_terms: [],
      problem_terms: [],
      content_type: 'checklist',
      is_featured: false,
      search_priority: 0,
      related_guideline_slugs: [],
      created_at: '2026-03-08T00:00:00Z',
      updated_at: '2026-03-08T00:00:00Z',
    };

    serviceMocks.getPathologyGuidelineSourceBySlug.mockResolvedValueOnce(existingSource);
    serviceMocks.getPathologyGuidelineSource.mockResolvedValueOnce({
      ...existingSource,
      source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
    });

    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'New article' }));
    fireEvent.change(screen.getByLabelText('Pathology name'), { target: { value: 'Fibromuscular dysplasia (FMD)' } });
    fireEvent.change(screen.getByLabelText('Source title'), { target: { value: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'fibromuscular-dysplasia-multisystem-imaging-manifestations' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save article text/link' }));

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineSourceBySlug).toHaveBeenCalledWith('fibromuscular-dysplasia-multisystem-imaging-manifestations'));
    await waitFor(() => expect(serviceMocks.updatePathologyGuidelineSource).toHaveBeenCalledWith(
      'g-9',
      expect.objectContaining({
        slug: 'fibromuscular-dysplasia-multisystem-imaging-manifestations',
        pathology_name: 'Fibromuscular dysplasia (FMD)',
        source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
      }),
    ));
    expect(serviceMocks.createPathologyGuidelineSource).not.toHaveBeenCalled();
  });

  it('creates a draft when saving article text/link with validated JSON in the new article flow', async () => {
    const createdSource = {
      id: 'g-11',
      slug: 'fibromuscular-dysplasia-fmd',
      pathology_name: 'Fibromuscular dysplasia (FMD)',
      specialty: 'General reporting pearls',
      synonyms: [],
      keywords: ['fmd'],
      source_url: 'https://example.com/fmd',
      source_kind: 'pdf',
      google_drive_url: '',
      google_drive_file_id: '',
      source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
      issuing_body: 'RadioGraphics',
      is_active: true,
      primary_topic: 'General reporting pearls',
      secondary_topics: [],
      clinical_tags: [],
      anatomy_terms: [],
      problem_terms: [],
      content_type: 'checklist',
      is_featured: false,
      search_priority: 0,
      related_guideline_slugs: [],
      created_at: '2026-03-09T00:00:00Z',
      updated_at: '2026-03-09T00:00:00Z',
    };
    const createdDraft = {
      id: 'v-11',
      guideline_id: 'g-11',
      version_label: null,
      effective_date: null,
      source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
      issuing_body: 'RadioGraphics',
      tldr_md: 'High-yield summary.',
      rich_summary_md: 'Detailed summary.',
      reporting_takeaways: ['Report vascular bed involvement.'],
      reporting_red_flags: ['Dissection or aneurysm.'],
      suggested_report_phrases: [],
      checklist_items: [{ id: 'i-1', label: 'Assess multifocal beading', order: 1, section: 'What to look for', notes: null }],
      parse_notes: null,
      sync_status: 'draft',
      origin: 'json_import',
      synced_at: '2026-03-09T00:00:00Z',
      published_at: null,
      created_at: '2026-03-09T00:00:00Z',
      updated_at: '2026-03-09T00:00:00Z',
    };

    serviceMocks.createPathologyGuidelineSource.mockResolvedValueOnce({ id: 'g-11' });
    serviceMocks.getPathologyGuidelineSource.mockResolvedValueOnce(createdSource);
    serviceMocks.importPathologyGuidelineVersion.mockResolvedValueOnce(createdDraft);
    serviceMocks.getGuidelineDraftVersions.mockResolvedValueOnce([createdDraft]);

    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'New article' }));
    fireEvent.change(screen.getByPlaceholderText('{"pathology_name":"Appendicitis","rich_summary_md":"...","checklist_items":[...]}'), {
      target: {
        value: JSON.stringify({
          pathology_name: 'Fibromuscular dysplasia (FMD)',
          rich_summary_md: 'Detailed summary.',
          tldr_md: 'High-yield summary.',
          source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
          checklist_items: [
            { id: 'i-1', label: 'Assess multifocal beading', order: 1, section: 'What to look for', notes: null },
          ],
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Recheck JSON' }));

    await waitFor(() => expect(screen.getByLabelText('Pathology name')).toHaveValue('Fibromuscular dysplasia (FMD)'));
    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://example.com/fmd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save article text/link' }));

    await waitFor(() => expect(serviceMocks.createPathologyGuidelineSource).toHaveBeenCalled());
    await waitFor(() => expect(serviceMocks.importPathologyGuidelineVersion).toHaveBeenCalledWith(
      'g-11',
      expect.objectContaining({
        pathology_name: 'Fibromuscular dysplasia (FMD)',
        source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
      }),
    ));
  });

  it('publishes an article directly from validated JSON in the new article flow', async () => {
    const createdSource = {
      id: 'g-12',
      slug: 'fibromuscular-dysplasia-fmd',
      pathology_name: 'Fibromuscular dysplasia (FMD)',
      specialty: 'General reporting pearls',
      synonyms: [],
      keywords: ['fmd'],
      source_url: 'https://example.com/fmd',
      source_kind: 'pdf',
      google_drive_url: '',
      google_drive_file_id: '',
      source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
      issuing_body: 'RadioGraphics',
      is_active: true,
      primary_topic: 'General reporting pearls',
      secondary_topics: [],
      clinical_tags: [],
      anatomy_terms: [],
      problem_terms: [],
      content_type: 'checklist',
      is_featured: false,
      search_priority: 0,
      related_guideline_slugs: [],
      created_at: '2026-03-09T00:00:00Z',
      updated_at: '2026-03-09T00:00:00Z',
    };
    const createdDraft = {
      id: 'v-12',
      guideline_id: 'g-12',
      version_label: null,
      effective_date: null,
      source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
      issuing_body: 'RadioGraphics',
      tldr_md: 'High-yield summary.',
      rich_summary_md: 'Detailed summary.',
      reporting_takeaways: ['Report vascular bed involvement.'],
      reporting_red_flags: ['Dissection or aneurysm.'],
      suggested_report_phrases: [],
      checklist_items: [{ id: 'i-1', label: 'Assess multifocal beading', order: 1, section: 'What to look for', notes: null }],
      parse_notes: null,
      sync_status: 'draft',
      origin: 'json_import',
      synced_at: '2026-03-09T00:00:00Z',
      published_at: null,
      created_at: '2026-03-09T00:00:00Z',
      updated_at: '2026-03-09T00:00:00Z',
    };

    serviceMocks.createPathologyGuidelineSource.mockResolvedValueOnce({ id: 'g-12' });
    serviceMocks.getPathologyGuidelineSource.mockResolvedValueOnce(createdSource);
    serviceMocks.importPathologyGuidelineVersion.mockResolvedValueOnce(createdDraft);
    serviceMocks.getGuidelineDraftVersions.mockResolvedValueOnce([]);
    serviceMocks.publishPathologyGuidelineVersion.mockResolvedValueOnce(undefined);

    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'New article' }));
    fireEvent.change(screen.getByPlaceholderText('{"pathology_name":"Appendicitis","rich_summary_md":"...","checklist_items":[...]}'), {
      target: {
        value: JSON.stringify({
          pathology_name: 'Fibromuscular dysplasia (FMD)',
          rich_summary_md: 'Detailed summary.',
          tldr_md: 'High-yield summary.',
          source_title: 'Multisystem Imaging Manifestations of Fibromuscular Dysplasia',
          checklist_items: [
            { id: 'i-1', label: 'Assess multifocal beading', order: 1, section: 'What to look for', notes: null },
          ],
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Recheck JSON' }));

    await waitFor(() => expect(screen.getByLabelText('Pathology name')).toHaveValue('Fibromuscular dysplasia (FMD)'));
    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://example.com/fmd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish article' }));

    await waitFor(() => expect(serviceMocks.importPathologyGuidelineVersion).toHaveBeenCalledWith(
      'g-12',
      expect.objectContaining({ pathology_name: 'Fibromuscular dysplasia (FMD)' }),
    ));
    await waitFor(() => expect(serviceMocks.publishPathologyGuidelineVersion).toHaveBeenCalledWith('v-12'));
  });

  it('shows background only for overflow summary paragraphs', async () => {
    serviceMocks.getPathologyGuidelineDetail.mockResolvedValueOnce({
      ...chestItem,
      source_url: 'https://example.com/lung-mass.pdf',
      google_drive_url: '',
      reporting_takeaways: ['Correlate with prior imaging'],
      reporting_red_flags: [],
      suggested_report_phrases: [],
      checklist_items: [{ id: 'c1', label: 'Size', order: 1, section: 'Checklist', notes: null }],
      parse_notes: null,
      raw_text_excerpt: null,
      rich_summary_md: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.',
    });

    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    expect(screen.getByRole('heading', { name: 'Background and nuances' })).toBeInTheDocument();
    expect(screen.getByText('Paragraph one.')).toBeInTheDocument();
    expect(screen.getByText('Paragraph two.')).toBeInTheDocument();
    expect(screen.getByText('Paragraph three.')).toBeInTheDocument();
  });

  it('strips inline markdown markers from summary paragraphs', async () => {
    serviceMocks.getPathologyGuidelineDetail.mockResolvedValueOnce({
      ...chestItem,
      source_url: 'https://example.com/lung-mass.pdf',
      google_drive_url: '',
      reporting_takeaways: ['Correlate with prior imaging'],
      reporting_red_flags: [],
      suggested_report_phrases: [],
      checklist_items: [{ id: 'c1', label: 'Size', order: 1, section: 'Checklist', notes: null }],
      parse_notes: null,
      raw_text_excerpt: null,
      rich_summary_md: 'The imaging diagnosis is centered on morphology. **Focal FMD** differs from **multifocal FMD**.',
    });

    setDesktopDetailMode(true);
    render(<PathologyChecklistScreen onBack={() => {}} />);

    await waitFor(() => expect(serviceMocks.getCurrentPathologyGuidelines).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: /lung mass/i })[0]);

    await waitFor(() => expect(serviceMocks.getPathologyGuidelineDetail).toHaveBeenCalledWith('lung-mass'));
    expect(screen.getByText(/Focal FMD differs from multifocal FMD\./i)).toBeInTheDocument();
    expect(screen.queryByText(/\*\*Focal FMD\*\*/)).not.toBeInTheDocument();
  });
});
