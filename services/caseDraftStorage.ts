import type { ImageUpload } from '../hooks/useCaseSubmission';
import type { SubmissionType } from '../types';

const CASE_DRAFT_DB_NAME = 'radcore-case-upload-drafts';
const CASE_DRAFT_IMAGE_STORE = 'draft-images';
const CASE_DRAFT_DB_VERSION = 1;
export const CASE_DRAFT_SCHEMA_VERSION = 1;
export const CASE_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface CaseUploadDraft<TFormData = Record<string, unknown>> {
  version: typeof CASE_DRAFT_SCHEMA_VERSION;
  savedAt: string;
  formData: TFormData;
  customTitle: string;
  step: 1 | 2;
  sentToViberGc: boolean;
}

export interface RestoredCaseUploadDraft<TFormData = Record<string, unknown>> {
  draft: CaseUploadDraft<TFormData>;
  images: ImageUpload[];
}

interface StoredDraftImage {
  id: string;
  draftKey: string;
  index: number;
  description: string;
  fileName: string;
  fileType: string;
  lastModified: number;
  bytes: ArrayBuffer | null;
  remoteUrl: string | null;
}

const readBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error('Unable to read a draft image.'));
    reader.readAsArrayBuffer(blob);
  });
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
});

const transactionComplete = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted.'));
});

const openDraftDatabase = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support local image drafts.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CASE_DRAFT_DB_NAME, CASE_DRAFT_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CASE_DRAFT_IMAGE_STORE)) {
        const store = database.createObjectStore(CASE_DRAFT_IMAGE_STORE, { keyPath: 'id' });
        store.createIndex('draftKey', 'draftKey', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open local draft storage.'));
  });
};

const deleteDraftImagesFromStore = async (store: IDBObjectStore, draftKey: string) => {
  const keys = await requestResult(store.index('draftKey').getAllKeys(draftKey));
  keys.forEach((key) => store.delete(key));
};

const saveDraftImages = async (draftKey: string, images: ImageUpload[]) => {
  const records = await Promise.all(images.map(async (image, index): Promise<StoredDraftImage> => {
    const hasUploadableFile = image.file.size > 0;
    return {
      id: `${draftKey}:${index}`,
      draftKey,
      index,
      description: image.description || '',
      fileName: image.file.name || `draft-image-${index + 1}`,
      fileType: image.file.type || (hasUploadableFile ? 'application/octet-stream' : ''),
      lastModified: image.file.lastModified || Date.now(),
      bytes: hasUploadableFile ? await readBlobAsArrayBuffer(image.file) : null,
      remoteUrl: !hasUploadableFile && image.url.startsWith('http') ? image.url : null,
    };
  }));

  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction(CASE_DRAFT_IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(CASE_DRAFT_IMAGE_STORE);
    await deleteDraftImagesFromStore(store, draftKey);

    records.forEach((record) => store.put(record));

    await transactionComplete(transaction);
  } finally {
    database.close();
  }
};

const loadDraftImages = async (draftKey: string): Promise<ImageUpload[]> => {
  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction(CASE_DRAFT_IMAGE_STORE, 'readonly');
    const store = transaction.objectStore(CASE_DRAFT_IMAGE_STORE);
    const records = await requestResult(store.index('draftKey').getAll(draftKey)) as StoredDraftImage[];
    await transactionComplete(transaction);

    return records
      .sort((left, right) => left.index - right.index)
      .flatMap((record) => {
        if (record.bytes) {
          const file = new File([record.bytes], record.fileName, {
            type: record.fileType,
            lastModified: record.lastModified,
          });
          return [{
            file,
            url: URL.createObjectURL(file),
            description: record.description,
          }];
        }

        if (record.remoteUrl) {
          return [{
            file: new File([], 'existing_image'),
            url: record.remoteUrl,
            description: record.description,
          }];
        }

        return [];
      });
  } finally {
    database.close();
  }
};

export const getCaseDraftKey = (userId: string, caseId: string, submissionType: SubmissionType) =>
  `upload:case-draft:v${CASE_DRAFT_SCHEMA_VERSION}:${userId}:${caseId}:${submissionType}`;

export const getLegacyCaseNotesDraftKey = (userId: string, caseId: string, submissionType: SubmissionType) =>
  `upload:case-notes:draft:${userId}:${caseId}:${submissionType}`;

export const createCaseDraftSignature = <TFormData>(
  draft: Omit<CaseUploadDraft<TFormData>, 'version' | 'savedAt'>,
  images: ImageUpload[],
) => JSON.stringify({
  ...draft,
  images: images.map((image) => ({
    url: image.url,
    description: image.description || '',
    name: image.file.name,
    size: image.file.size,
    type: image.file.type,
    lastModified: image.file.lastModified,
  })),
});

export const saveCaseUploadDraft = async <TFormData>(
  draftKey: string,
  draft: CaseUploadDraft<TFormData>,
  images: ImageUpload[],
) => {
  await saveDraftImages(draftKey, images);
  try {
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  } catch (error) {
    await deleteCaseUploadDraft(draftKey);
    throw error;
  }
};

export const loadCaseUploadDraft = async <TFormData>(
  draftKey: string,
  now = Date.now(),
): Promise<RestoredCaseUploadDraft<TFormData> | null> => {
  const raw = window.localStorage.getItem(draftKey);
  if (!raw) return null;

  try {
    const draft = JSON.parse(raw) as CaseUploadDraft<TFormData>;
    const savedAt = new Date(draft.savedAt).getTime();
    const isValid = draft.version === CASE_DRAFT_SCHEMA_VERSION
      && Number.isFinite(savedAt)
      && now - savedAt <= CASE_DRAFT_MAX_AGE_MS;

    if (!isValid) {
      await deleteCaseUploadDraft(draftKey);
      return null;
    }

    return {
      draft,
      images: await loadDraftImages(draftKey),
    };
  } catch {
    await deleteCaseUploadDraft(draftKey);
    return null;
  }
};

export const deleteCaseUploadDraft = async (draftKey: string) => {
  window.localStorage.removeItem(draftKey);
  if (typeof indexedDB === 'undefined') return;

  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction(CASE_DRAFT_IMAGE_STORE, 'readwrite');
    await deleteDraftImagesFromStore(transaction.objectStore(CASE_DRAFT_IMAGE_STORE), draftKey);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
};
