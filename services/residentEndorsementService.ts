import {
  DutyShift,
  ResidentEndorsementComment,
  ResidentEndorsementCommentInput,
  ResidentEndorsementPost,
  ResidentEndorsementPostInput,
} from '../types';
import { supabase } from './supabase';

type EndorsementQueryOptions = {
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

const normalizeTags = (tags?: string[]) => {
  if (!tags) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );
};

const mapCommentRow = (row: any): ResidentEndorsementComment => ({
  id: String(row.id),
  post_id: String(row.post_id),
  message: String(row.message || ''),
  created_by: String(row.created_by),
  created_at: String(row.created_at),
  updated_at: row.updated_at || undefined,
  author_name: row.profiles?.nickname || row.profiles?.full_name || 'Staff',
  author_role: row.profiles?.role || null,
  author_avatar_url: row.profiles?.avatar_url || null,
});

const mapPostRow = (row: any, comments: ResidentEndorsementComment[]): ResidentEndorsementPost => ({
  id: String(row.id),
  duty_date: String(row.duty_date),
  shift: row.shift as DutyShift,
  message: String(row.message || ''),
  tags: Array.isArray(row.tags) ? row.tags.map((item: unknown) => String(item)) : [],
  attachments: Array.isArray(row.attachments)
    ? row.attachments.map((item: any) => ({
      url: String(item?.url || ''),
      type: String(item?.type || 'application/octet-stream'),
      name: String(item?.name || 'Attachment'),
      size: Number(item?.size || 0),
    }))
    : [],
  is_pinned: Boolean(row.is_pinned ?? false),
  pinned_at: row.pinned_at || null,
  created_by: String(row.created_by),
  created_at: String(row.created_at),
  updated_at: row.updated_at || undefined,
  author_name: row.profiles?.nickname || row.profiles?.full_name || 'Staff',
  author_role: row.profiles?.role || null,
  author_avatar_url: row.profiles?.avatar_url || null,
  comments,
});

export const getResidentEndorsements = async ({
  fromDate,
  toDate,
  limit = 200,
}: EndorsementQueryOptions = {}): Promise<ResidentEndorsementPost[]> => {
  let query = supabase
    .from('resident_endorsements')
    .select(
      `id,duty_date,shift,message,tags,attachments,is_pinned,pinned_at,created_by,created_at,updated_at,
      profiles:created_by (full_name,nickname,avatar_url,role)`,
    )
    .order('is_pinned', { ascending: false })
    .order('duty_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fromDate) {
    query = query.gte('duty_date', fromDate);
  }
  if (toDate) {
    query = query.lte('duty_date', toDate);
  }

  const { data: postsData, error: postsError } = await query;
  if (postsError) throw postsError;

  const postRows = postsData || [];
  if (!postRows.length) return [];

  const postIds = postRows.map((row: any) => String(row.id));
  const { data: commentsData, error: commentsError } = await supabase
    .from('resident_endorsement_comments')
    .select(
      `id,post_id,message,created_by,created_at,updated_at,
      profiles:created_by (full_name,nickname,avatar_url,role)`,
    )
    .in('post_id', postIds)
    .order('created_at', { ascending: true });

  if (commentsError) throw commentsError;

  const byPostId: Record<string, ResidentEndorsementComment[]> = {};
  (commentsData || []).forEach((row: any) => {
    const mapped = mapCommentRow(row);
    if (!byPostId[mapped.post_id]) byPostId[mapped.post_id] = [];
    byPostId[mapped.post_id].push(mapped);
  });

  return postRows.map((row: any) => mapPostRow(row, byPostId[String(row.id)] || []));
};

export const createResidentEndorsement = async (input: ResidentEndorsementPostInput): Promise<{ id: string }> => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error('User session unavailable.');

  const payload = {
    duty_date: input.duty_date,
    shift: input.shift,
    message: input.message.trim(),
    tags: normalizeTags(input.tags),
    attachments: input.attachments || [],
    is_pinned: Boolean(input.is_pinned ?? false),
    pinned_at: input.pinned_at || null,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('resident_endorsements')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return { id: String(data.id) };
};

export const updateResidentEndorsement = async (
  postId: string,
  patch: Partial<ResidentEndorsementPostInput>,
): Promise<void> => {
  const payload: Partial<ResidentEndorsementPostInput> = {};
  if (typeof patch.duty_date === 'string') payload.duty_date = patch.duty_date;
  if (typeof patch.shift === 'string') payload.shift = patch.shift as DutyShift;
  if (typeof patch.message === 'string') payload.message = patch.message.trim();
  if (Array.isArray(patch.tags)) payload.tags = normalizeTags(patch.tags);
  if (Array.isArray(patch.attachments)) payload.attachments = patch.attachments;
  if (typeof patch.is_pinned === 'boolean') payload.is_pinned = patch.is_pinned;
  if (typeof patch.pinned_at === 'string' || patch.pinned_at === null) payload.pinned_at = patch.pinned_at;

  const { error } = await supabase.from('resident_endorsements').update(payload).eq('id', postId);
  if (error) throw error;
};

export const deleteResidentEndorsement = async (postId: string): Promise<void> => {
  const { error } = await supabase.from('resident_endorsements').delete().eq('id', postId);
  if (error) throw error;
};

export const createResidentEndorsementComment = async (input: ResidentEndorsementCommentInput): Promise<void> => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error('User session unavailable.');

  const payload = {
    post_id: input.post_id,
    message: input.message.trim(),
    created_by: user.id,
  };

  const { error } = await supabase.from('resident_endorsement_comments').insert(payload);
  if (error) throw error;
};

export const deleteResidentEndorsementComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase.from('resident_endorsement_comments').delete().eq('id', commentId);
  if (error) throw error;
};
