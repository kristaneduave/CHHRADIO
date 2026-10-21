import { supabase } from './supabase';
import { buildCasePdfInput } from './casePdfInput';
import type { CasePdfImageOptions } from './pdfService';

// Archived PDFs replace the original images, so they are kept sharp but well under the PNG sizes.
const ARCHIVE_IMAGE_OPTIONS: CasePdfImageOptions = { mimeType: 'image/jpeg', quality: 0.85, maxDimension: 2000 };
const ENDPOINT = '/api/case-archive';

export type CaseArchiveStage = 'preparing' | 'uploading' | 'finishing';

export interface CaseArchiveResult {
  fileId: string;
  sizeBytes: number;
  removedImages: number;
  imagesToRemove: number;
}

// Direct upload needs the Google Drive setup in docs/case-drive-archive.md. Without it, admins save
// the PDFs to a folder, upload that folder to Drive by hand, then remove the images.
export const DRIVE_ARCHIVE_ENABLED = import.meta.env.VITE_CASE_DRIVE_ARCHIVE === 'on';

export const hasCaseImages = (caseData: any) =>
  (Array.isArray(caseData?.image_urls) && caseData.image_urls.length > 0) || Boolean(String(caseData?.image_url || '').trim());

/** "2026-08-20 Ectopic ovary (1a2b3c4d).pdf": sorts by upload date and stays unique per case. */
export const archivePdfFileName = (caseData: any) => {
  const uploaded = caseData?.created_at ? new Date(caseData.created_at) : null;
  const date = uploaded && !Number.isNaN(uploaded.getTime()) ? uploaded.toLocaleDateString('en-CA') : '';
  const title = String(caseData?.title || 'Case').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${date ? `${date} ` : ''}${title || 'Case'} (${String(caseData?.id || '').slice(0, 8)}).pdf`;
};

/** The case's PDF export with resized JPEG images. Throws if any image cannot be loaded. */
export const renderArchivePdf = async (caseData: any, publisherName: string): Promise<Blob> => {
  const input = buildCasePdfInput(caseData);
  if (input.images.length === 0) throw new Error('This case has no images to archive.');
  const { renderCasePdfBlob } = await import('./pdfService');
  const { blob } = await renderCasePdfBlob(
    input.data, input.images, input.headerTitle, publisherName || 'Radiologist', input.fileName, ARCHIVE_IMAGE_OPTIONS,
  );
  return blob;
};

interface WritableFolder {
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

/**
 * Asks for a folder to save PDFs into (Chrome and Edge). Returns null when the browser cannot,
 * in which case each PDF is downloaded instead.
 */
export const pickArchiveFolder = async (): Promise<WritableFolder | null> => {
  const picker = (window as any).showDirectoryPicker;
  if (typeof picker !== 'function') return null;
  return picker({ id: 'case-archive', mode: 'readwrite' });
};

export const saveArchivePdf = async (folder: WritableFolder | null, fileName: string, blob: Blob) => {
  if (folder) {
    const writable = await (await folder.getFileHandle(fileName, { create: true })).createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/**
 * For a case whose PDF was saved and uploaded to Drive by hand: marks it archived and removes the
 * images nothing else uses. Anything left behind is found later by scripts/storage-cleanup.mjs.
 */
export const removeArchivedCaseImages = async (caseId: string, pdfBytes?: number) => {
  const { data, error } = await supabase.rpc('complete_case_archive', {
    p_case_id: caseId, p_drive_file_id: null, p_size_bytes: pdfBytes ?? null,
  });
  if (error) throw new Error(error.message);
  const names: string[] = Array.isArray(data) ? data.filter((name): name is string => typeof name === 'string') : [];
  if (names.length === 0) return { removedImages: 0, imagesToRemove: 0 };
  const { data: removed, error: removeError } = await supabase.storage.from('case-images').remove(names);
  return { removedImages: removeError ? 0 : (removed?.length ?? 0), imagesToRemove: names.length };
};

const authHeader = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to continue.');
  return { Authorization: `Bearer ${token}` };
};

const requestJson = async (query: string, init: RequestInit) => {
  const response = await fetch(`${ENDPOINT}?${query}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Case archive failed.');
  return body;
};

const sha256Hex = async (blob: Blob) => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Saves the case's PDF export in the department Google Drive, then removes its images from Storage.
 * The server checks the PDF arrived intact before anything is removed.
 */
export const archiveCaseToDrive = async (
  caseData: any,
  publisherName: string,
  onProgress?: (stage: CaseArchiveStage, fraction?: number) => void,
): Promise<CaseArchiveResult> => {
  onProgress?.('preparing');
  const blob = await renderArchivePdf(caseData, publisherName);

  const auth = await authHeader();
  const { uploadUrl, chunkBytes } = await requestJson('action=start', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: caseData.id, size: blob.size, sha256: await sha256Hex(blob) }),
  });

  let fileId = '';
  for (let start = 0; start < blob.size; start += chunkBytes) {
    const end = Math.min(start + chunkBytes, blob.size) - 1;
    onProgress?.('uploading', start / blob.size);
    const result = await requestJson('action=chunk', {
      method: 'PUT',
      headers: {
        ...auth,
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${end}/${blob.size}`,
        'X-Upload-Url': uploadUrl,
      },
      body: blob.slice(start, end + 1),
    });
    if (result.done) fileId = result.fileId;
  }
  if (!fileId) throw new Error('Google Drive did not confirm the upload. No images were removed.');

  onProgress?.('finishing');
  return requestJson('action=finish', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: caseData.id, fileId }),
  });
};

/** Downloads an archived case's PDF from the department Drive, in chunks the server can relay. */
export const fetchArchivedCasePdf = async (caseId: string): Promise<Blob> => {
  const auth = await authHeader();
  const parts: ArrayBuffer[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const response = await fetch(`${ENDPOINT}?action=file&caseId=${encodeURIComponent(caseId)}&offset=${offset}`, { headers: auth });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Could not open the archived PDF.');
    }
    const part = await response.arrayBuffer();
    total = Number(response.headers.get('X-Archive-Total'));
    if (part.byteLength === 0 || !Number.isFinite(total)) throw new Error('Could not open the archived PDF.');
    parts.push(part);
    offset += part.byteLength;
  }
  return new Blob(parts, { type: 'application/pdf' });
};

export const downloadArchivedCasePdf = async (caseId: string, fileName: string) => {
  const url = URL.createObjectURL(await fetchArchivedCasePdf(caseId));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace(/[^a-z0-9 _.()-]/gi, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
};
