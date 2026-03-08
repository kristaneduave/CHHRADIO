import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractGoogleDriveFileId,
  getRadioGraphicsTopicHubs,
  getRelatedPathologyGuidelines,
  searchPathologyGuidelines,
} from './pathologyChecklistService';
import type { PathologyGuidelineDetail } from '../types';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

const guidelineRows = [
  {
    guideline_id: 'g-1',
    slug: 'renal-mass',
    pathology_name: 'Renal Mass',
    specialty: 'Genitourinary',
    synonyms: ['kidney lesion', 'renal lesion'],
    keywords: ['mass', 'incidentaloma'],
    primary_topic: 'Genitourinary',
    secondary_topics: ['Abdominal'],
    clinical_tags: ['mass', 'follow-up'],
    anatomy_terms: ['renal', 'kidney'],
    problem_terms: ['mass', 'lesion'],
    content_type: 'checklist',
    is_featured: true,
    search_priority: 8,
    related_guideline_slugs: ['adrenal-incidentaloma'],
    source_title: 'Renal Mass Workup',
    issuing_body: 'ACR',
    version_label: 'v2',
    effective_date: '2026-03-01',
    synced_at: '2026-03-02T00:00:00Z',
    published_at: '2026-03-03T00:00:00Z',
    source_kind: 'pdf',
    tldr_md: 'Use the renal mass checklist first.',
  },
  {
    guideline_id: 'g-2',
    slug: 'lung-mass',
    pathology_name: 'Lung Mass',
    specialty: 'Thoracic',
    synonyms: ['pulmonary mass'],
    keywords: ['mass', 'malignancy'],
    primary_topic: 'Thoracic',
    secondary_topics: [],
    clinical_tags: ['mass'],
    anatomy_terms: ['lung', 'pulmonary'],
    problem_terms: ['mass', 'lesion'],
    content_type: 'checklist',
    is_featured: false,
    search_priority: 7,
    related_guideline_slugs: [],
    source_title: 'Thoracic Mass Review',
    issuing_body: 'ESR',
    version_label: 'v1',
    effective_date: '2026-02-01',
    synced_at: '2026-02-02T00:00:00Z',
    published_at: '2026-02-03T00:00:00Z',
    source_kind: 'pdf',
    tldr_md: 'Pulmonary mass reporting checklist.',
  },
  {
    guideline_id: 'g-3',
    slug: 'adrenal-incidentaloma',
    pathology_name: 'Adrenal Incidentaloma',
    specialty: 'Genitourinary',
    synonyms: ['adrenal lesion'],
    keywords: ['incidentaloma'],
    primary_topic: 'Genitourinary',
    secondary_topics: [],
    clinical_tags: ['incidental findings'],
    anatomy_terms: ['adrenal'],
    problem_terms: ['lesion'],
    content_type: 'checklist',
    is_featured: false,
    search_priority: 5,
    related_guideline_slugs: [],
    source_title: 'Adrenal Review',
    issuing_body: 'ACR',
    version_label: 'v1',
    effective_date: '2026-02-15',
    synced_at: '2026-02-16T00:00:00Z',
    published_at: '2026-02-17T00:00:00Z',
    source_kind: 'pdf',
    tldr_md: 'Adrenal incidentaloma workup.',
  },
];

const buildSelectChain = (data: any[]) => ({
  order: vi.fn().mockResolvedValue({ data, error: null }),
  eq: vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0], error: null }),
  }),
});

describe('pathologyChecklistService', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockReturnValue({
      select: vi.fn(() => buildSelectChain(guidelineRows)),
    });
  });

  it('extracts Google Drive file ids from common URL formats', () => {
    expect(extractGoogleDriveFileId('https://docs.google.com/document/d/abc1234567890/edit')).toBe('abc1234567890');
    expect(extractGoogleDriveFileId('https://drive.google.com/open?id=file987654321')).toBe('file987654321');
    expect(extractGoogleDriveFileId('raw-file-id-12345678901234567890')).toBe('raw-file-id-12345678901234567890');
  });

  it('ranks renal mass searches above source-title-only matches and explains the match', async () => {
    const results = await searchPathologyGuidelines('kidney lesion');
    expect(results[0].slug).toBe('renal-mass');
    expect(results[0].match_reason).toContain('Matched synonym');
  });

  it('supports anatomy synonym expansion for pulmonary to lung queries', async () => {
    const results = await searchPathologyGuidelines('pulmonary mass');
    expect(results[0].slug).toBe('lung-mass');
  });

  it('builds topic hubs from published guidelines', async () => {
    const hubs = await getRadioGraphicsTopicHubs();
    expect(hubs.find((hub) => hub.topic === 'Genitourinary')?.count).toBe(2);
    expect(hubs.find((hub) => hub.topic === 'Thoracic')?.count).toBe(1);
  });

  it('returns explicit related guidelines before topic fallback', async () => {
    const current = guidelineRows[0] as unknown as PathologyGuidelineDetail;
    const related = await getRelatedPathologyGuidelines(current);
    expect(related[0].slug).toBe('adrenal-incidentaloma');
  });
});
