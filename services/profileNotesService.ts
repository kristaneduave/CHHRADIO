import { ProfilePrivateNote } from '../types';
import { supabase } from './supabase';

type ProfilePrivateNotePreview = Pick<ProfilePrivateNote, 'id' | 'content' | 'updated_at'>;

const getCurrentUserId = async (): Promise<string> => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user?.id) throw new Error('User session unavailable.');
  return user.id;
};

export const getMyProfileNote = async (): Promise<ProfilePrivateNotePreview | null> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profile_private_notes')
    .select('id,content,updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    content: String(data.content || ''),
    updated_at: String(data.updated_at),
  };
};

export const upsertMyProfileNote = async (content: string): Promise<ProfilePrivateNotePreview> => {
  const userId = await getCurrentUserId();
  const sanitizedContent = String(content || '').replace(/\s+$/, '');

  const { data, error } = await supabase
    .from('profile_private_notes')
    .upsert(
      {
        user_id: userId,
        content: sanitizedContent,
      },
      { onConflict: 'user_id' },
    )
    .select('id,content,updated_at')
    .single();

  if (error) throw error;

  return {
    id: String(data.id),
    content: String(data.content || ''),
    updated_at: String(data.updated_at),
  };
};

export const deleteMyProfileNote = async (): Promise<void> => {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('profile_private_notes').delete().eq('user_id', userId);
  if (error) throw error;
};
