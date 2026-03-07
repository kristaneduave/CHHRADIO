import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractGoogleDriveFileId, searchPathologyGuidelines } from './pathologyChecklistService';

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

describe('pathologyChecklistService', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('extracts Google Drive file ids from common URL formats', () => {
    expect(extractGoogleDriveFileId('https://docs.google.com/document/d/abc1234567890/edit')).toBe('abc1234567890');
    expect(extractGoogleDriveFileId('https://drive.google.com/open?id=file987654321')).toBe('file987654321');
    expect(extractGoogleDriveFileId('raw-file-id-12345678901234567890')).toBe('raw-file-id-12345678901234567890');
  });

  it('ranks exact pathology name matches above keyword-only matches', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              guideline_id: 'g-1',
              slug: 'appendicitis',
              pathology_name: 'Appendicitis',
              specialty: 'Abdominal Imaging',
              synonyms: ['Acute appendicitis'],
              keywords: ['abdomen', 'emergency'],
              source_title: 'Appendicitis Guideline',
              issuing_body: 'ACR',
              version_label: 'v1',
              effective_date: '2026-03-01',
              synced_at: '2026-03-02T00:00:00Z',
              published_at: '2026-03-03T00:00:00Z',
            },
            {
              guideline_id: 'g-2',
              slug: 'bowel-emergency-review',
              pathology_name: 'Bowel Emergency Review',
              specialty: 'Abdominal Imaging',
              synonyms: ['Acute abdomen checklist'],
              keywords: ['appendicitis', 'abdomen'],
              source_title: 'Emergency Abdomen Review',
              issuing_body: 'ESR',
              version_label: 'v3',
              effective_date: '2026-02-01',
              synced_at: '2026-02-02T00:00:00Z',
              published_at: '2026-02-03T00:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });

    const results = await searchPathologyGuidelines('appendicitis');

    expect(results).toHaveLength(2);
    expect(results[0].slug).toBe('appendicitis');
    expect(results[1].slug).toBe('bowel-emergency-review');
  });
});
