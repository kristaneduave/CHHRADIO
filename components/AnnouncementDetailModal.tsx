import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../services/supabase';
import { Announcement } from '../types';
import { saveAnnouncementForUser, unsaveAnnouncementForUser } from '../services/announcementSaveService';
import { toastError, toastSuccess } from '../utils/toast';
import { getNewsCategoryStyleTokens } from '../utils/newsStyleTokens';
import NewsActionChip from './news/NewsActionChip';

interface AnnouncementDetailModalProps {
  announcement: Announcement | null;
  onClose: () => void;
  onHide?: (announcementId: string) => void | Promise<void>;
  onEdit?: (announcementId: string) => void;
  onDelete?: (announcementId: string) => void | Promise<void>;
  canManage?: boolean;
  supportsSaved?: boolean;
  onSavedChanged?: () => void;
}

const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({
  announcement,
  onClose,
  onHide,
  onEdit,
  onDelete,
  canManage = false,
  supportsSaved = false,
  onSavedChanged,
}) => {
  if (!announcement) return null;

  const [viewers, setViewers] = useState<Array<{ avatar_url: string | null; full_name: string | null; nickname?: string | null }>>([]);
  const [isSaved, setIsSaved] = useState(Boolean(announcement.is_saved));
  const [isPinned, setIsPinned] = useState(Boolean(announcement.is_pinned));
  const [saving, setSaving] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState<{ top: number; left: number } | null>(null);
  const moreTriggerRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const categoryStyles = getNewsCategoryStyleTokens(announcement.category);

  useEffect(() => {
    setIsSaved(Boolean(announcement.is_saved));
    setIsPinned(Boolean(announcement.is_pinned));
    setIsMoreMenuOpen(false);
  }, [announcement.id, announcement.is_saved, announcement.is_pinned]);

  useEffect(() => {
    const trackView = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existingView } = await supabase
        .from('announcement_views')
        .select('id')
        .eq('announcement_id', announcement.id)
        .eq('user_id', user.id)
        .single();

      if (!existingView) {
        await supabase.from('announcement_views').insert({
          announcement_id: announcement.id,
          user_id: user.id,
        });
      }
    };

    const fetchViewers = async () => {
      const { data } = await supabase
        .from('announcement_views')
        .select(
          `
          user_id,
          profiles:user_id (
            avatar_url,
            full_name,
            nickname
          )`,
        )
        .eq('announcement_id', announcement.id)
        .limit(10);

      if (!data) return;
      setViewers(
        data.map((item: any) => ({
          avatar_url: item.profiles?.avatar_url,
          full_name: item.profiles?.full_name,
          nickname: item.profiles?.nickname,
        })),
      );
    };

    trackView();
    fetchViewers();
  }, [announcement.id]);

  const handleToggleSave = async () => {
    if (!supportsSaved || saving) return;
    try {
      setSaving(true);
      if (isSaved) {
        await unsaveAnnouncementForUser(announcement.id);
        setIsSaved(false);
        toastSuccess('Removed from saved');
      } else {
        await saveAnnouncementForUser(announcement.id);
        setIsSaved(true);
        toastSuccess('Saved');
      }
      onSavedChanged?.();
    } catch (error: any) {
      toastError('Unable to update saved state', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}`;
    const text = `${announcement.title}\n${announcement.summary || announcement.content || ''}\n\n${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: announcement.title, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(text);
        toastSuccess('News link copied');
      }
    } catch {
      // user cancelled share
    }
  };

  const isMissingPriorityColumnError = (error: any) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('is_pinned') || message.includes('pinned_at') || message.includes("'pinned'");
  };

  const updateAnnouncementPin = async (nextPinned: boolean) => {
    const pinnedAt = nextPinned ? new Date().toISOString() : null;
    const attempts: Array<Record<string, any>> = [
      { is_pinned: nextPinned, pinned_at: pinnedAt },
      { is_pinned: nextPinned },
      { pinned: nextPinned, pinned_at: pinnedAt },
      { pinned: nextPinned },
    ];

    let lastError: any = null;
    for (const patch of attempts) {
      const { error } = await supabase.from('announcements').update(patch).eq('id', announcement.id);
      if (!error) {
        onSavedChanged?.();
        return;
      }
      if (!isMissingPriorityColumnError(error)) {
        throw error;
      }
      lastError = error;
    }

    throw lastError || new Error('Unable to update pin state.');
  };

  const handleTogglePinned = async () => {
    if (!canManage) return;
    const next = !isPinned;
    try {
      await updateAnnouncementPin(next);
      setIsPinned(next);
      toastSuccess(next ? 'Pinned' : 'Unpinned');
    } catch (error: any) {
      toastError('Unable to update pin', error?.message || 'Please try again.');
    }
  };

  const handleDownloadImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!announcement.imageUrl) return;

    try {
      const response = await fetch(announcement.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `announcement-${announcement.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      window.open(announcement.imageUrl, '_blank');
    }
  };

  const closeMoreMenu = () => {
    setIsMoreMenuOpen(false);
    setMoreMenuPos(null);
  };

  const updateMoreMenuPosition = () => {
    if (!moreTriggerRef.current) return;
    const rect = moreTriggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(moreMenuRef.current?.offsetWidth ?? 0, 190);
    const menuHeight = Math.max(moreMenuRef.current?.offsetHeight ?? 0, canManage ? 170 : 84);
    const margin = 10;
    const gap = 8;

    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - menuWidth - margin));
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const shouldOpenBelow = spaceBelow >= menuHeight || spaceBelow >= spaceAbove;

    let top = shouldOpenBelow ? rect.bottom + gap : rect.top - menuHeight - gap;
    top = Math.max(margin, Math.min(top, window.innerHeight - menuHeight - margin));
    setMoreMenuPos({ top, left });
  };

  const toggleMoreMenu = () => {
    if (isMoreMenuOpen) {
      closeMoreMenu();
      return;
    }
    updateMoreMenuPosition();
    setIsMoreMenuOpen(true);
  };

  useEffect(() => {
    if (!isMoreMenuOpen) return;

    const onResizeOrScroll = () => updateMoreMenuPosition();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreMenuRef.current?.contains(target)) return;
      if (moreTriggerRef.current?.contains(target)) return;
      closeMoreMenu();
    };

    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    document.addEventListener('mousedown', onPointerDown);
    requestAnimationFrame(() => updateMoreMenuPosition());

    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isMoreMenuOpen, canManage]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app/90 backdrop-blur-md animate-in fade-in duration-200 p-4 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#0B101A] border border-white/5 rounded-[2rem] sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-black/40 border-b border-white/5 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 blur-[60px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {isPinned && (
                <span className={`mb-1 inline-block text-[11px] font-bold uppercase tracking-[0.08em] ${categoryStyles.accentText}`}>
                  Pinned
                </span>
              )}
              <h2 className="text-xl sm:text-[28px] font-bold leading-tight tracking-tight text-white truncate">{announcement.title}</h2>
              <p className="mt-1 text-[13px] text-slate-400 truncate">
                by <span className="text-sky-400 font-semibold">{announcement.authorFullName || announcement.author}</span>
                <span className="mx-1.5 opacity-40">|</span>
                <span>{announcement.date}</span>
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <span className="material-icons text-xl">close</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <NewsActionChip onClick={handleToggleSave} disabled={!supportsSaved || saving} icon={isSaved ? 'bookmark' : 'bookmark_border'} className="disabled:opacity-40">
              {isSaved ? 'Saved' : 'Save'}
            </NewsActionChip>
            <NewsActionChip onClick={handleShare} icon="share">
              Share
            </NewsActionChip>
            <div ref={moreTriggerRef}>
              <NewsActionChip onClick={toggleMoreMenu} icon="more_horiz" aria-expanded={isMoreMenuOpen}>
                More
              </NewsActionChip>
            </div>
          </div>

          {announcement.imageUrl && (
            <div className="relative group rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/20">
              <img src={announcement.imageUrl} alt={announcement.title} className="w-full h-auto max-h-[40vh] object-contain sm:object-cover" />
              <button
                onClick={handleDownloadImage}
                className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-lg text-white text-xs font-bold flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 sm:opacity-100"
              >
                <span className="material-icons text-sm">download</span>
                Save
              </button>
            </div>
          )}

          <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4">
            <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed whitespace-pre-wrap">
              {announcement.content || announcement.summary}
            </div>
          </div>

          {((announcement.links && announcement.links.length > 0) || announcement.externalLink || (announcement.attachments && announcement.attachments.length > 0)) && (
            <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 space-y-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resources</h3>
              {announcement.externalLink && !announcement.links?.find((l) => l.url === announcement.externalLink) && (
                <a
                  href={announcement.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-all group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-icons text-blue-400 text-sm shrink-0">link</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-blue-100 truncate">External Link</span>
                      <span className="text-[10px] text-blue-300 truncate">{announcement.externalLink}</span>
                    </div>
                  </div>
                  <span className="material-icons text-blue-400 group-hover:translate-x-1 transition-transform text-sm">open_in_new</span>
                </a>
              )}
              {announcement.links?.map((link, idx) => (
                <a
                  key={`link-${idx}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-all group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-icons text-blue-400 text-sm shrink-0">link</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-blue-100 truncate">{link.title || 'External Link'}</span>
                      <span className="text-[10px] text-blue-300 truncate">{link.url}</span>
                    </div>
                  </div>
                  <span className="material-icons text-blue-400 group-hover:translate-x-1 transition-transform text-sm">open_in_new</span>
                </a>
              ))}
              {announcement.attachments?.map((att, idx) => (
                <a
                  key={`att-${idx}`}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                    {att.type.startsWith('image/') ? (
                      <span className="material-icons text-purple-400">image</span>
                    ) : (
                      <span className="material-icons text-blue-400">description</span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-slate-200 truncate">{att.name}</span>
                    <span className="text-[10px] text-slate-500">{(att.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <span className="material-icons text-slate-500 group-hover:text-white ml-auto text-base">download</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 bg-black/40 border-t border-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center min-w-0">
            {viewers.length > 0 ? (
              <>
                <div className="flex -space-x-2 overflow-hidden shrink-0">
                  {viewers.slice(0, 5).map((viewer, i) => (
                    <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-[#0B101A] bg-slate-700 flex items-center justify-center overflow-hidden" title={viewer.nickname || viewer.full_name || 'User'}>
                      {viewer.avatar_url ? <img src={viewer.avatar_url} alt="Viewer" className="w-full h-full object-cover" /> : <span className="text-[8px] text-white font-bold">{(viewer.nickname || viewer.full_name || 'U').charAt(0)}</span>}
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-slate-500 font-medium ml-2 truncate">
                  {viewers.length > 5 ? `+${viewers.length - 5} others viewed` : `${viewers.length} viewed`}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-slate-600 font-medium">No views yet</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm tracking-wide shadow-[0_4px_20px_-4px_rgba(14,165,233,0.5)] transition-all flex items-center gap-2"
          >
            <span className="material-icons text-base">close</span>
            Close
          </button>
        </div>

        {isMoreMenuOpen && moreMenuPos && (
          <div
            ref={moreMenuRef}
            className="fixed z-[130] min-w-[170px] rounded-xl border border-white/10 bg-[#101826] p-1.5 shadow-xl"
            style={{ top: moreMenuPos.top, left: moreMenuPos.left }}
          >
            <button
              type="button"
              onClick={() => {
                closeMoreMenu();
                onHide?.(announcement.id);
              }}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
            >
              Hide
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  closeMoreMenu();
                  void handleTogglePinned();
                }}
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
              >
                {isPinned ? 'Unpin' : 'Pin news'}
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  closeMoreMenu();
                  onEdit?.(announcement.id);
                }}
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
              >
                Edit
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  closeMoreMenu();
                  onDelete?.(announcement.id);
                }}
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-200 hover:bg-rose-500/15"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default AnnouncementDetailModal;
