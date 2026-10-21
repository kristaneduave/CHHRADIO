import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderCasePdfBlob } from '../services/pdfService';
import { buildCasePdfInput } from '../services/casePdfInput';

const ARCHIVE = { mimeType: 'image/jpeg', quality: 0.85, maxDimension: 2000 } as const;

afterEach(() => vi.unstubAllGlobals());

describe('archive PDF', () => {
  it('fails instead of leaving a placeholder when an image cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    const input = buildCasePdfInput({ id: 'c1', title: 'Case', image_urls: ['https://x.supabase.co/storage/v1/object/public/case-images/u/a.png'] });
    await expect(renderCasePdfBlob(input.data, input.images, input.headerTitle, 'Ana', input.fileName, ARCHIVE))
      .rejects.toThrow('could not be loaded');
  });

  it('builds the same input the case screen exports', () => {
    const input = buildCasePdfInput({
      title: 'Sinonasal meningioma', image_urls: ['a.png', 'b.png'], submission_type: 'interesting_case',
      analysis_result: { imagesMetadata: [{ description: 'Axial' }], caseSource: ' Infinitt ', patientId: 'P1' },
    });
    expect(input.headerTitle).toBe('SINONASAL MENINGIOMA');
    expect(input.images).toEqual([{ url: 'a.png', description: 'Axial' }, { url: 'b.png', description: '' }]);
    expect(input.data).toMatchObject({ caseSource: 'Infinitt', patientId: 'P1', impression: 'Sinonasal meningioma' });
  });
});
