import { afterEach, describe, expect, it, vi } from 'vitest';
import { __testables, renderCasePdfBlob } from '../services/pdfService';
import { buildCasePdfInput } from '../services/casePdfInput';

const ARCHIVE = { mimeType: 'image/jpeg', quality: 0.85, maxDimension: 2000 } as const;
const sampleCase = {
  id: 'c1', title: 'Case', submission_type: 'interesting_case', modality: 'CT', organ_system: 'Chest',
  analysis_result: { patientId: 'PACS-778899', caseSource: 'Infinitt' },
};

const readText = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

afterEach(() => vi.restoreAllMocks());

describe('archive PDF', () => {
  it('fails instead of leaving a placeholder when an image cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    const input = buildCasePdfInput({ id: 'c1', title: 'Case', image_urls: ['https://x.supabase.co/storage/v1/object/public/case-images/u/a.png'] });
    await expect(renderCasePdfBlob(input.data, input.images, input.headerTitle, 'Ana', input.fileName, ARCHIVE))
      .rejects.toThrow('could not be loaded');
    vi.unstubAllGlobals();
  });

  it('builds the same input the case screen exports', () => {
    const input = buildCasePdfInput({
      title: 'Sinonasal meningioma', image_urls: ['a.png', 'b.png'], submission_type: 'interesting_case',
      analysis_result: { imagesMetadata: [{ description: 'Axial' }], caseSource: ' Infinitt ', patientId: 'P1' },
    });
    expect(input.headerTitle).toBe('SINONASAL MENINGIOMA');
    expect(input.images).toEqual([{ url: 'a.png', description: 'Axial' }, { url: 'b.png', description: '' }]);
    expect(input.data).toMatchObject({ caseSource: 'Infinitt', patientId: 'P1', impression: 'Sinonasal meningioma' });
    // Older cases keep the Patient ID in diagnosis, as the case screen shows.
    expect(buildCasePdfInput({ title: 'Old', diagnosis: 'RAD-479038' }).data.patientId).toBe('RAD-479038');
  });

  it('puts the Patient ID and source in archive copies and downloads', async () => {
    const input = buildCasePdfInput(sampleCase);
    const archive = await renderCasePdfBlob(input.data, [], input.headerTitle, 'Ana', input.fileName, ARCHIVE);
    const archiveText = await readText(archive.blob);
    expect(archiveText).toContain('PACS-778899');
    expect(archiveText).toContain('Infinitt');

    // Downloads (Export PDF) use the same builder.
    const { doc } = await __testables.buildCasePdf(input.data, [], input.headerTitle, 'Ana', input.fileName);
    const downloadText = doc.output();
    expect(downloadText).toContain('Infinitt');
    expect(downloadText).toContain('PACS-778899');
  });
});
