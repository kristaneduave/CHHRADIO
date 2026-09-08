import { supabase } from './supabase';

export const PRIVATE_ATTACHMENT_BUCKETS = ['resident-endorsement-files', 'resident-census-evidence'] as const;
export type PrivateAttachmentBucket = typeof PRIVATE_ATTACHMENT_BUCKETS[number];
export const ATTACHMENT_LINK_SECONDS = 600;
let principal: string | null | undefined;
let generation = 0;
export const setPrivateAttachmentPrincipal = (userId: string | null) => {
  if (principal !== userId) { principal = userId; generation += 1; }
};

export const parsePrivateAttachment = (reference: string, projectUrl: string): { bucket: PrivateAttachmentBucket; path: string } => {
  const url = new URL(reference);
  let bucket: string;
  let path: string;
  if (url.protocol === 'storage:') {
    bucket = url.hostname;
    path = decodeURIComponent(url.pathname.slice(1));
  } else {
    const project = new URL(projectUrl);
    if (url.protocol !== 'https:' || url.origin !== project.origin) throw new Error('Unrecognized attachment location.');
    const prefix = '/storage/v1/object/public/';
    if (!url.pathname.startsWith(prefix)) throw new Error('Unrecognized attachment reference.');
    const parts = url.pathname.slice(prefix.length).split('/');
    bucket = parts.shift() || '';
    path = decodeURIComponent(parts.join('/'));
  }
  if (url.username || url.password || url.port || url.search || url.hash
    || !PRIVATE_ATTACHMENT_BUCKETS.includes(bucket as PrivateAttachmentBucket)
    || !path || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Unrecognized attachment reference.');
  }
  return { bucket: bucket as PrivateAttachmentBucket, path };
};

export const createPrivateAttachmentReference = (bucket: PrivateAttachmentBucket, path: string) =>
  `storage://${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

/** Sign per opening. No persisted URL, shared cache, or public fallback. */
export const resolvePrivateAttachment = async (reference: string): Promise<string> => {
  const startedGeneration = generation;
  const { bucket, path } = parsePrivateAttachment(reference, import.meta.env.VITE_SUPABASE_URL);
  const { data: before } = await supabase.auth.getSession();
  if (!before.session?.user.id) throw new Error('Sign in to open this attachment.');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ATTACHMENT_LINK_SECONDS);
  if (error || !data?.signedUrl) throw new Error('Attachment unavailable or access denied.');
  const { data: after } = await supabase.auth.getSession();
  if (generation !== startedGeneration || after.session?.user.id !== before.session.user.id) {
    throw new Error('Your session changed. Open the attachment again.');
  }
  return data.signedUrl;
};
