import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CASE_DRAFT_MAX_AGE_MS,
  CASE_DRAFT_SCHEMA_VERSION,
  CaseUploadDraft,
  createCaseDraftSignature,
  deleteCaseUploadDraft,
  getCaseDraftKey,
  loadCaseUploadDraft,
  saveCaseUploadDraft,
} from './caseDraftStorage';

const deleteTestDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase('radcore-case-upload-drafts');
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Draft database deletion was blocked.'));
});

const buildDraft = (savedAt = new Date().toISOString()): CaseUploadDraft<{ findings: string }> => ({
  version: CASE_DRAFT_SCHEMA_VERSION,
  savedAt,
  formData: { findings: 'Restorable findings' },
  customTitle: 'Draft case',
  step: 2,
  sentToViberGc: true,
});

describe('caseDraftStorage', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await deleteTestDatabase();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:restored-draft-image'),
    });
  });

  it('round-trips form state, uploaded images, and remote images', async () => {
    const draftKey = getCaseDraftKey('user-1', 'new', 'interesting_case');
    const uploadedFile = new File(['image-bytes'], 'scan.png', { type: 'image/png', lastModified: 123 });
    const images = [
      { url: 'data:image/png;base64,aW1hZ2U=', file: uploadedFile, description: 'Axial image' },
      { url: 'https://example.com/existing.jpg', file: new File([], 'existing_image'), description: 'Prior image' },
    ];

    await saveCaseUploadDraft(draftKey, buildDraft(), images);
    const restored = await loadCaseUploadDraft<{ findings: string }>(draftKey);

    expect(restored?.draft.formData.findings).toBe('Restorable findings');
    expect(restored?.draft.customTitle).toBe('Draft case');
    expect(restored?.draft.step).toBe(2);
    expect(restored?.draft.sentToViberGc).toBe(true);
    expect(restored?.images).toHaveLength(2);
    expect(restored?.images[0]).toMatchObject({ url: 'blob:restored-draft-image', description: 'Axial image' });
    expect(restored?.images[0]?.file.name).toBe('scan.png');
    expect(restored?.images[0]?.file.size).toBe(uploadedFile.size);
    expect(restored?.images[1]).toMatchObject({ url: 'https://example.com/existing.jpg', description: 'Prior image' });
    expect(restored?.images[1]?.file.size).toBe(0);
  });

  it('deletes drafts older than 30 days', async () => {
    const draftKey = getCaseDraftKey('user-1', 'new', 'interesting_case');
    const savedAt = new Date(Date.now() - CASE_DRAFT_MAX_AGE_MS - 1).toISOString();
    await saveCaseUploadDraft(draftKey, buildDraft(savedAt), []);

    expect(await loadCaseUploadDraft(draftKey)).toBeNull();
    expect(window.localStorage.getItem(draftKey)).toBeNull();
  });

  it('clears both metadata and image records', async () => {
    const draftKey = getCaseDraftKey('user-1', 'case-2', 'interesting_case');
    await saveCaseUploadDraft(
      draftKey,
      buildDraft(),
      [{ url: 'data:image/png;base64,aW1hZ2U=', file: new File(['x'], 'scan.png', { type: 'image/png' }), description: '' }],
    );

    await deleteCaseUploadDraft(draftKey);
    expect(await loadCaseUploadDraft(draftKey)).toBeNull();
  });

  it('builds a stable signature that includes image metadata', () => {
    const draft = {
      formData: { findings: 'Finding' },
      customTitle: 'Title',
      step: 1 as const,
      sentToViberGc: false,
    };
    const image = { url: 'data:image/png;base64,eA==', file: new File(['x'], 'scan.png', { type: 'image/png' }), description: 'Axial' };

    expect(createCaseDraftSignature(draft, [image])).not.toBe(createCaseDraftSignature(draft, []));
    expect(createCaseDraftSignature(draft, [image])).toBe(createCaseDraftSignature(draft, [image]));
  });
});
