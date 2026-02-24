import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../services/supabase';
import { Announcement } from '../types';
import { saveAnnouncementForUser, unsaveAnnouncementForUser } from '../services/announcementSaveService';
import { toastError, toastSuccess } from '../utils/toast';
import {
  formatCategoryLabel,
  getNewsSymbolAssetPath,
  getNewsCategoryLabelClass,
  getNewsCategoryWatermarkClass,
  resolveNewsWatermarkSymbol,
} from '../utils/newsPresentation';
import { readingTimeLabel } from '../utils/newsFeedUtils';

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
  const [saving, setSaving] = useState(false);
  const readingLabel = useMemo(() => readingTimeLabel(announcement.readingMinutes || 0), [announcement.readingMinutes]);

  useEffect(() => {
    setIsSaved(Boolean(announcement.is_saved));
  }, [announcement.id, announcement.is_saved]);

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

  const getCategoryBadgeStyle = (category: string) => {
    switch (category) {
      case 'Announcement':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Research':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'Event':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Miscellaneous':
      case 'Misc':
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

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
    const text = `${announcement.title}\n${announcement.content || announcement.summary}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: announcement.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        toastSuccess('Copied to clipboard');
      }
    } catch {
      // user cancelled share
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

  const priorityBadges: React.ReactNode[] = [];
  if (announcement.is_pinned) {
    priorityBadges.push(
      <span key="pinned" className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
        Pinned
      </span>,
    );
  }
  if (announcement.is_important) {
    priorityBadges.push(
      <span key="important" className="inline-flex items-center rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200">
        Important
      </span>,
    );
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-auto max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-4 border-b border-white/5 shrink-0 bg-surface relative z-20">
          <div className="pr-8">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getCategoryBadgeStyle(announcement.category)}`}>
                {formatCategoryLabel(announcement.category)}
              </span>
              {priorityBadges}
            </div>
            <div className="flex items-start gap-4">
              <span className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border bg-white/[0.03] ${getNewsCategoryLabelClass(announcement.category)}`}>
                <span
                  className={`h-5 w-5 ${getNewsCategoryWatermarkClass(announcement.category)}`}
                  style={{
                    WebkitMaskImage: `url(${getNewsSymbolAssetPath(resolveNewsWatermarkSymbol(announcement.icon, announcement.category))})`,
                    maskImage: `url(${getNewsSymbolAssetPath(resolveNewsWatermarkSymbol(announcement.icon, announcement.category))})`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                  }}
                />
              </span>
              <h2 className="text-lg font-bold text-white leading-tight">{announcement.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all -mr-2 -mt-2">
            <span className="material-icons text-sm">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center border border-white/10 shadow-lg overflow-hidden shrink-0">
                {announcement.authorAvatar ? (
                  <img src={announcement.authorAvatar} alt={announcement.author} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-white">{announcement.author.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{announcement.authorFullName || announcement.author}</p>
                <p className="text-[10px] text-slate-500 font-medium flex items-center gap-2">
                  {announcement.authorTitle || 'Hospital Staff'}
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  {announcement.date}
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  {readingLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={handleToggleSave}
              disabled={!supportsSaved || saving}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/[0.08] disabled:opacity-40"
            >
              <span className="material-icons text-[14px]">{isSaved ? 'bookmark' : 'bookmark_border'}</span>
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => onHide?.(announcement.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/[0.08]"
            >
              <span className="material-icons text-[14px]">visibility_off</span>
              Hide
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/[0.08]"
            >
              <span className="material-icons text-[14px]">share</span>
              Share
            </button>
            {canManage && (
              <>
                <button
                  onClick={() => onEdit?.(announcement.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/[0.08]"
                >
                  <span className="material-icons text-[14px]">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => onDelete?.(announcement.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-200 hover:bg-rose-500/20"
                >
                  <span className="material-icons text-[14px]">delete</span>
                  Delete
                </button>
              </>
            )}
          </div>

          {announcement.imageUrl && (
            <div className="mb-4 relative group rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/20">
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

          <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap mb-6">
            {announcement.content || announcement.summary}
          </div>

          {((announcement.links && announcement.links.length > 0) || announcement.externalLink) && (
            <div className="mb-6 space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Links</h3>
              {announcement.externalLink && !announcement.links?.find((l) => l.url === announcement.externalLink) && (
                <a
                  href={announcement.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                      <span className="material-icons text-blue-400 text-sm">link</span>
                    </div>
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
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                      <span className="material-icons text-blue-400 text-sm">link</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-blue-100 truncate">{link.title || 'External Link'}</span>
                      <span className="text-[10px] text-blue-300 truncate">{link.url}</span>
                    </div>
                  </div>
                  <span className="material-icons text-blue-400 group-hover:translate-x-1 transition-transform text-sm">open_in_new</span>
                </a>
              ))}
            </div>
          )}

          {announcement.attachments && announcement.attachments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Attachments</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {announcement.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                      {att.type.startsWith('image/') ? (
                        <span className="material-icons text-purple-400">image</span>
                      ) : (
                        <span className="material-icons text-blue-400">description</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-slate-200 truncate">{att.name}</span>
                      <span className="text-[10px] text-slate-500">{(att.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <span className="material-icons text-slate-500 group-hover:text-white ml-auto text-lg">download</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/5 bg-surface/50 flex items-center justify-between shrink-0">
          <div className="flex items-center mr-3">
            {viewers.length > 0 && (
              <>
                <div className="flex -space-x-2 overflow-hidden">
                  {viewers.slice(0, 5).map((viewer, i) => (
                    <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-[#0F1720] bg-slate-700 flex items-center justify-center overflow-hidden" title={viewer.nickname || viewer.full_name || 'User'}>
                      {viewer.avatar_url ? (
                        <img src={viewer.avatar_url} alt="Viewer" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] text-white font-bold">{(viewer.nickname || viewer.full_name || 'U').charAt(0)}</span>
                      )}
                    </div>
                  ))}
                </div>
                {viewers.length > 5 && <span className="text-[10px] text-slate-500 font-medium ml-2">+{viewers.length - 5} others</span>}
              </>
            )}
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AnnouncementDetailModal;
