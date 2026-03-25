import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ResidentEndorsementPost, DutyShift, UserRole } from '../types';
import { supabase } from '../services/supabase';
import {
  createResidentEndorsement,
  createResidentEndorsementComment,
  deleteResidentEndorsement,
  deleteResidentEndorsementComment,
  getResidentEndorsements,
  updateResidentEndorsement,
} from '../services/residentEndorsementService';
import { createSystemNotification, fetchRecipientUserIdsByRoles } from '../services/newsfeedService';
import { canAccessResidentFeatures, canModerateResidentEndorsements, canWriteResidentEndorsements } from '../utils/roles';
import { toastError, toastSuccess } from '../utils/toast';
import NewsPageShell from './news/NewsPageShell';
import { getUserRoleState } from '../services/userRoleService';

interface ResidentEndorsementsScreenProps {
  onBack: () => void;
}

const DEFAULT_SHIFT: DutyShift = 'AM';
const ENDORSEMENT_FILES_BUCKET = 'resident-endorsement-files';
const ENDORSEMENT_CATEGORIES = [
  'General Radiology',
  'CT Scan',
  'MRI',
  'X-Ray',
  'Ultrasound',
  'Mammography',
  'Fluoroscopy',
  'Nuclear Medicine',
  'Interventional',
  'PET/CT',
];

const isMissingTableError = (error: unknown) => {
  const message = String((error as any)?.message || '').toLowerCase();
  return (
    message.includes('resident_endorsements') ||
    message.includes('resident_endorsement_comments') ||
    message.includes('attachments') ||
    message.includes('is_pinned') ||
    message.includes('pinned_at') ||
    message.includes('schema cache')
  );
};

const getLocalDateKey = (input: Date) => {
  const y = input.getFullYear();
  const m = `${input.getMonth() + 1}`.padStart(2, '0');
  const d = `${input.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toDisplayDateTime = (dateText?: string | null) => {
  if (!dateText) return '';
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toSingleCategoryTags = (category: string): string[] => {
  const normalized = category.trim();
  return normalized ? [normalized] : [];
};

const formatFileSize = (size: number): string => {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getCategoryIcon = (category?: string): string => {
  const normalized = String(category || '').toLowerCase();
  if (normalized.includes('ct')) return 'blur_on';
  if (normalized.includes('mri')) return 'donut_large';
  if (normalized.includes('x-ray') || normalized.includes('xray')) return 'image';
  if (normalized.includes('ultrasound')) return 'graphic_eq';
  if (normalized.includes('mammography')) return 'female';
  if (normalized.includes('fluoroscopy')) return 'movie';
  if (normalized.includes('nuclear')) return 'radioactive';
  if (normalized.includes('interventional')) return 'build';
  if (normalized.includes('pet')) return 'pets';
  return 'local_hospital';
};


const getCategoryAccent = (category?: string): string => {
  const normalized = String(category || '').toLowerCase();
  if (normalized.includes('ct')) return 'border-l-sky-400/60 bg-sky-500/[0.03]';
  if (normalized.includes('mri')) return 'border-l-violet-400/60 bg-violet-500/[0.03]';
  if (normalized.includes('x-ray') || normalized.includes('xray')) return 'border-l-blue-400/60 bg-blue-500/[0.03]';
  if (normalized.includes('ultrasound')) return 'border-l-emerald-400/60 bg-emerald-500/[0.03]';
  if (normalized.includes('mammography')) return 'border-l-pink-400/60 bg-pink-500/[0.03]';
  if (normalized.includes('fluoroscopy')) return 'border-l-amber-400/60 bg-amber-500/[0.03]';
  if (normalized.includes('nuclear')) return 'border-l-teal-400/60 bg-teal-500/[0.03]';
  if (normalized.includes('interventional')) return 'border-l-rose-400/60 bg-rose-500/[0.03]';
  if (normalized.includes('pet')) return 'border-l-fuchsia-400/60 bg-fuchsia-500/[0.03]';
  return 'border-l-slate-400/30';
};
const ResidentEndorsementsScreen: React.FC<ResidentEndorsementsScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [posts, setPosts] = useState<ResidentEndorsementPost[]>([]);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  const [message, setMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('General Radiology');
  const [composerFiles, setComposerFiles] = useState<File[]>([]);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editCategory, setEditCategory] = useState<string>('General Radiology');

  const canAccess = canAccessResidentFeatures(userRoles);
  const canWrite = canWriteResidentEndorsements(userRoles);
  const canModerate = canModerateResidentEndorsements(userRoles);

  const handleMigrationUnavailable = useCallback(() => {
    setIsUnavailable(true);
  }, []);

  const loadData = useCallback(async () => {
    if (isUnavailable || !canAccess) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await getResidentEndorsements({ limit: 300 });
      setPosts(result);
      setIsUnavailable(false);
    } catch (error: any) {
      console.error('Failed to load resident endorsements:', error);
      if (isMissingTableError(error)) {
        handleMigrationUnavailable();
        setPosts([]);
      } else {
        toastError('Unable to load endorsements', error?.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [canAccess, handleMigrationUnavailable, isUnavailable]);

  const loadUserContext = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      setUserId('');
      setUserRoles([]);
      setUserRole(null);
      return;
    }
    setUserId(user.id);
    const roleState = await getUserRoleState(user.id);
    setUserRole(roleState.primaryRole);
    setUserRoles(roleState.roles);
  }, []);

  useEffect(() => {
    loadUserContext().catch((error) => console.error('Failed to load user context:', error));
  }, [loadUserContext]);

  useEffect(() => {
    if (isUnavailable || !canAccess) {
      setLoading(false);
      return;
    }
    loadData().catch((error) => console.error('Failed to load endorsements:', error));
  }, [canAccess, isUnavailable, loadData]);

  useEffect(() => {
    if (isUnavailable || !canAccess) return undefined;

    const channel = supabase
      .channel('resident_endorsements_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resident_endorsements' }, () => {
        loadData().catch((error) => console.error('Realtime refresh failed:', error));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resident_endorsement_comments' }, () => {
        loadData().catch((error) => console.error('Realtime refresh failed:', error));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess, loadData, isUnavailable]);

  const openEditPost = (post: ResidentEndorsementPost) => {
    setEditingPostId(post.id);
    setEditMessage(post.message);
    setEditCategory(post.tags[0] || 'General Radiology');
  };

  const uploadComposerAttachments = async (): Promise<{ url: string; type: string; name: string; size: number }[]> => {
    if (!composerFiles.length) return [];
    if (!userId) throw new Error('User session unavailable.');

    const uploaded: { url: string; type: string; name: string; size: number }[] = [];
    for (const file of composerFiles) {
      const extension = file.name.includes('.') ? file.name.split('.').pop() || 'bin' : 'bin';
      const objectPath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(ENDORSEMENT_FILES_BUCKET)
        .upload(objectPath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(ENDORSEMENT_FILES_BUCKET).getPublicUrl(objectPath);
      uploaded.push({
        url: data.publicUrl,
        type: file.type || 'application/octet-stream',
        name: file.name,
        size: file.size,
      });
    }
    return uploaded;
  };

  const submitPost = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toastError('Message is required');
      return;
    }
    if (trimmed.length > 4000) {
      toastError('Message is too long', 'Maximum 4000 characters.');
      return;
    }

    try {
      setIsSavingPost(true);
      const attachments = await uploadComposerAttachments();
      const created = await createResidentEndorsement({
        duty_date: getLocalDateKey(new Date()),
        shift: DEFAULT_SHIFT,
        message: trimmed,
        tags: toSingleCategoryTags(selectedCategory),
        attachments,
      });

      // Notification should never block post success.
      try {
        const recipients = await fetchRecipientUserIdsByRoles(['admin', 'moderator', 'resident']);
        const preview = trimmed.length > 90 ? `${trimmed.slice(0, 90)}...` : trimmed;
        await createSystemNotification({
          actorUserId: userId || null,
          type: 'resident_endorsement',
          severity: 'info',
          title: 'New Resident Endorsement',
          message: `${selectedCategory}: ${preview}`,
          linkScreen: 'resident-endorsements',
          linkEntityId: created.id,
          recipientUserIds: recipients,
        });
      } catch (notifError) {
        console.error('Failed to emit endorsement notification:', notifError);
      }

      setMessage('');
      setSelectedCategory('General Radiology');
      setComposerFiles([]);
      toastSuccess('Endorsement posted');
      await loadData();
    } catch (error: any) {
      console.error('Failed to create endorsement:', error);
      if (isMissingTableError(error)) {
        handleMigrationUnavailable();
        return;
      }
      toastError('Unable to post endorsement', error?.message || 'Please try again.');
    } finally {
      setIsSavingPost(false);
    }
  };

  const savePostEdit = async () => {
    if (!editingPostId) return;
    const trimmed = editMessage.trim();
    if (!trimmed) {
      toastError('Message is required');
      return;
    }
    if (trimmed.length > 4000) {
      toastError('Message is too long', 'Maximum 4000 characters.');
      return;
    }

    try {
      setIsSavingPost(true);
      await updateResidentEndorsement(editingPostId, {
        message: trimmed,
        tags: toSingleCategoryTags(editCategory),
      });
      toastSuccess('Endorsement updated');
      setEditingPostId(null);
      await loadData();
    } catch (error: any) {
      console.error('Failed to update endorsement:', error);
      toastError('Unable to update endorsement', error?.message || 'Please try again.');
    } finally {
      setIsSavingPost(false);
    }
  };

  const removePost = async (postId: string) => {
    try {
      await deleteResidentEndorsement(postId);
      toastSuccess('Endorsement deleted');
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete endorsement:', error);
      toastError('Unable to delete endorsement', error?.message || 'Please try again.');
    }
  };

  const submitComment = async (postId: string) => {
    const trimmed = String(commentDrafts[postId] || '').trim();
    if (!trimmed) {
      toastError('Comment is required');
      return;
    }
    if (trimmed.length > 2000) {
      toastError('Comment is too long', 'Maximum 2000 characters.');
      return;
    }

    try {
      await createResidentEndorsementComment({ post_id: postId, message: trimmed });
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      await loadData();
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      toastError('Unable to add comment', error?.message || 'Please try again.');
    }
  };

  const removeComment = async (commentId: string) => {
    try {
      await deleteResidentEndorsementComment(commentId);
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete comment:', error);
      toastError('Unable to delete comment', error?.message || 'Please try again.');
    }
  };

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const byPinned = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
        if (byPinned !== 0) return byPinned;
        return b.created_at.localeCompare(a.created_at);
      }),
    [posts],
  );

  const togglePinned = async (post: ResidentEndorsementPost) => {
    const nextPinned = !Boolean(post.is_pinned);
    try {
      await updateResidentEndorsement(post.id, {
        is_pinned: nextPinned,
        pinned_at: nextPinned ? new Date().toISOString() : null,
      });
      toastSuccess(nextPinned ? 'Post pinned' : 'Post unpinned');
      await loadData();
    } catch (error: any) {
      console.error('Failed to update pin state:', error);
      toastError('Unable to update pin', error?.message || 'Please try again.');
    }
  };

  const headerAction = (
    <button
      onClick={onBack}
      className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Back to Resident HQ"
    >
      <span className="material-icons text-[20px]">arrow_back</span>
    </button>
  );

  if (userRole === null) {
    return (
      <NewsPageShell
        title="Endorsements"
        headerAction={headerAction}
        searchFilterBar={<p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">After-duty handoff board</p>}
        feedRegion={
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
            Loading access...
          </div>
        }
      />
    );
  }

  if (!canAccess) {
    return (
      <NewsPageShell
        title="Endorsements"
        headerAction={headerAction}
        searchFilterBar={
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">After-duty handoff board</p>
        }
        feedRegion={
          <div className="mt-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="text-base font-bold text-red-100">Access restricted</p>
            <p className="mt-2 text-sm text-red-200/90">
              This board is available to admins, moderators, and residents only.
            </p>
          </div>
        }
      />
    );
  }

  const searchFilterBar = (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="grid grid-cols-1 gap-2">
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="w-full appearance-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
          >
            {ENDORSEMENT_CATEGORIES.map((category) => (
              <option key={category} value={category} className="bg-surface text-white">
                {category}
              </option>
            ))}
          </select>
          <span className="material-icons pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
            expand_more
          </span>
        </div>
      </div>
    </div>
  );

  const topUtilityRegion = (
    <div className="space-y-3">
      {!canWrite && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-100">
          View-only for your role.
        </div>
      )}

      {canWrite && !isUnavailable && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Write endorsement or after-duty notes..."
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-y transition-colors"
          />
          {composerFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {composerFiles.map((file, idx) => (
                <button
                  type="button"
                  key={`${file.name}-${idx}`}
                  onClick={() => setComposerFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== idx))}
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-200 hover:border-red-400/40 hover:text-red-200"
                  title="Remove attachment"
                >
                  <span className="material-icons text-[12px]">description</span>
                  <span className="max-w-[180px] truncate">{file.name}</span>
                  <span className="text-slate-400">({formatFileSize(file.size)})</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{message.trim().length}/4000</span>
            <div className="flex items-center gap-2">
              <label className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300 cursor-pointer hover:border-primary/40 transition-colors inline-flex items-center gap-2">
                <span className="material-icons text-[16px] text-cyan-300">attach_file</span>
                <span>Attach</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    if (!files.length) return;
                    setComposerFiles((prev) => [...prev, ...files].slice(0, 8));
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              <button
                onClick={submitPost}
                disabled={isSavingPost}
                className="rounded-lg border border-primary/40 bg-primary/20 px-4 py-2 text-sm font-semibold text-primary-light hover:bg-primary/30 disabled:opacity-50"
              >
                {isSavingPost ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isUnavailable && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-100">Feature unavailable until migration is applied.</p>
          <p className="text-xs text-red-200/80 mt-1">
            Apply the resident endorsements migration, then refresh this screen.
          </p>
        </div>
      )}
    </div>
  );

  const feedRegion = loading && !isUnavailable ? (
    <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      Loading endorsements...
    </div>
  ) : (
    <div className="mt-2 space-y-3">
      {!sortedPosts.length && !isUnavailable && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">No endorsements yet.</p>
          <p className="text-xs text-slate-500 mt-1">Resident updates will appear here.</p>
        </div>
      )}

      {sortedPosts.map((post) => {
        const isExpanded = expandedPostIds.has(post.id);
        const canManagePost = post.created_by === userId || canModerate;

        return (
          <article key={post.id} className={`rounded-2xl border border-white/10 border-l-2 bg-[#121e2e]/85 p-3.5 space-y-3 transition-colors ${getCategoryAccent(post.tags[0])}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {post.is_pinned && (
                    <span className="inline-flex items-center rounded-md border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                      <span className="material-icons text-[12px] mr-1">push_pin</span>
                      PINNED
                    </span>
                  )}
                  {!!post.tags[0] && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-bold normal-case tracking-normal text-cyan-200">
                      <span className="material-icons text-[12px]">{getCategoryIcon(post.tags[0])}</span>
                      <span>{post.tags[0]}</span>
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-slate-500">
                  {post.author_name || 'Staff'} | {toDisplayDateTime(post.created_at)}
                </p>
              </div>

              {canManagePost && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePinned(post)}
                    className={`h-8 w-8 rounded-lg border transition-colors ${post.is_pinned
                      ? 'border-amber-400/45 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    aria-label={post.is_pinned ? 'Unpin post' : 'Pin post'}
                    title={post.is_pinned ? 'Unpin post' : 'Pin post'}
                  >
                    <span className="material-icons text-[16px]">push_pin</span>
                  </button>
                  <button
                    onClick={() => openEditPost(post)}
                    className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10"
                    aria-label="Edit endorsement"
                  >
                    <span className="material-icons text-[16px]">edit</span>
                  </button>
                  <button
                    onClick={() => removePost(post.id)}
                    className="h-8 w-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                    aria-label="Delete endorsement"
                  >
                    <span className="material-icons text-[16px]">delete</span>
                  </button>
                </div>
              )}
            </div>

            {editingPostId === post.id ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="relative">
                  <select
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                  >
                    {ENDORSEMENT_CATEGORIES.map((category) => (
                      <option key={category} value={category} className="bg-surface text-white">
                        {category}
                      </option>
                    ))}
                  </select>
                  <span className="material-icons pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                    expand_more
                  </span>
                </div>
                <textarea
                  value={editMessage}
                  onChange={(event) => setEditMessage(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-primary/60 resize-y"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingPostId(null)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={savePostEdit}
                    disabled={isSavingPost}
                    className="rounded-lg border border-primary/40 bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary-light hover:bg-primary/30 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-100 whitespace-pre-wrap">{post.message}</p>
                {post.attachments && post.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {post.attachments.map((item, idx) => (
                      <a
                        key={`${post.id}-att-${idx}`}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-cyan-200 hover:border-cyan-300/50 hover:bg-cyan-500/10"
                      >
                        <span className="material-icons text-[12px]">
                          {String(item.type || '').startsWith('image/') ? 'image' : 'description'}
                        </span>
                        <span className="max-w-[170px] truncate">{item.name || 'Attachment'}</span>
                        <span className="text-slate-400">({formatFileSize(Number(item.size || 0))})</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-white/10 pt-3">
              <button
                onClick={() =>
                  setExpandedPostIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(post.id)) next.delete(post.id);
                    else next.add(post.id);
                    return next;
                  })
                }
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                {isExpanded ? 'Hide' : 'Show'} comments ({post.comments.length})
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-2">
                  {post.comments.map((comment) => {
                    const canManageComment = comment.created_by === userId || canModerate;
                    return (
                      <div key={comment.id} className="rounded-xl border border-white/8 bg-black/25 p-2.5 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-400">
                            {comment.author_name || 'Staff'} | {toDisplayDateTime(comment.created_at)}
                          </p>
                          {canManageComment && (
                            <button
                              onClick={() => removeComment(comment.id)}
                              className="h-7 w-7 rounded-md border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                              aria-label="Delete comment"
                            >
                              <span className="material-icons text-[14px]">delete</span>
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap mt-1">{comment.message}</p>
                      </div>
                    );
                  })}

                  {canWrite && (
                    <div className="flex gap-2">
                      <input
                        value={commentDrafts[post.id] || ''}
                        onChange={(event) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [post.id]: event.target.value,
                          }))
                        }
                        placeholder="Add a comment..."
                        className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary/60"
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        className="rounded-lg border border-primary/40 bg-primary/20 px-3 py-2 text-xs font-semibold text-primary-light hover:bg-primary/30"
                      >
                        Comment
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <NewsPageShell
      title="Endorsements"
      headerAction={headerAction}
      searchFilterBar={searchFilterBar}
      topUtilityRegion={topUtilityRegion}
      feedRegion={feedRegion}
    />
  );
};

export default ResidentEndorsementsScreen;
