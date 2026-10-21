import { supabase } from './supabase';

const CASE_IMAGE_BUCKET = 'case-images';

interface CaseImageFields {
  image_url?: string | null;
  image_urls?: string[] | null;
}

/**
 * Removes a deleted case's images from Storage. The database only returns the caller's own files
 * that nothing else links to, so images reused elsewhere stay. Best effort: anything left behind
 * is found later by scripts/storage-cleanup.mjs.
 */
export const releaseDeletedCaseImages = async (deletedCase: CaseImageFields): Promise<void> => {
  const references = Array.from(new Set(
    [deletedCase.image_url, ...(Array.isArray(deletedCase.image_urls) ? deletedCase.image_urls : [])]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  ));
  if (references.length === 0) return;

  try {
    const { data, error } = await supabase.rpc('releasable_case_images', { p_references: references });
    if (error) throw error;
    const names = Array.isArray(data) ? data.filter((name): name is string => typeof name === 'string') : [];
    if (names.length === 0) return;

    const { error: removeError } = await supabase.storage.from(CASE_IMAGE_BUCKET).remove(names);
    if (removeError) throw removeError;
  } catch (error) {
    console.error('Failed to remove deleted case images:', error);
  }
};
