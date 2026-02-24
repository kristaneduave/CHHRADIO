import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../services/supabase';
import { Announcement } from '../types';
import { saveAnnouncementForUser, unsaveAnnouncementForUser } from '../services/announcementSaveService';
import { toastError, toastSuccess } from '../utils/toast';
import {
  getNewsSymbolAssetPath,
  resolveNewsWatermarkSymbol,
} from '../utils/newsPresentation';
import { readingTimeLabel } from '../utils/newsFeedUtils';
import { getNewsCategoryStyleTokens, NEWS_SURFACE_BASE_CLASS } from '../utils/newsStyleTokens';
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
  const [saving, setSaving] = useState(false);
  const readingLabel = useMemo(() => readingTimeLabel(announcement.readingMinutes || 0), [announcement.readingMinutes]);
  const categoryStyles = getNewsCategoryStyleTokens(announcement.category);
  const categorySymbol = resolveNewsWatermarkSymbol(announcement.icon, announcement.category);

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

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4 sm:p-6" onClick={onClose}>
      <div
        className={`${NEWS_SURFACE_BASE_CLASS} w-full max-w-lg rounded-b-2xl rounded-t-none shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-auto max-h-[85vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-b-2xl rounded-t-none">
          <span className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
          <span className="absolute inset-[1px] rounded-b-[0.95rem] rounded-t-none border border-white/5" />
          <span className={`absolute left-0 right-0 top-0 h-[2px] rounded-none ${categoryStyles.railTint} opacity-15 blur-[0.5px]`} />
          <span className="absolute left-0 right-0 top-[1px] h-[1px] rounded-none bg-[linear-gradient(90deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.3)_100%)] shadow-[0_0_6px_rgba(255,255,255,0.08)] backdrop-blur-[8px]" />
          <span
            className={`absolute -left-10 top-1/2 h-[22rem] w-[22rem] -translate-y-1/2 opacity-[0.025] ${categoryStyles.watermark}`}
            style={{
              WebkitMaskImage: `url(${getNewsSymbolAssetPath(categorySymbol)})`,
              maskImage: `url(${getNewsSymbolAssetPath(categorySymbol)})`,
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'left center',
              maskPosition: 'left center',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
          />
        </span>
        <div className="flex justify-between items-start p-4 border-b border-white/10 shrink-0 bg-transparent relative z-20">
          <div className="pr-8">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {announcement.is_pinned ? <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${categoryStyles.accentText}`}>Pinned</span> : null}
            </div>
            <h2 className="text-[22px] font-semibold leading-tight tracking-[0.005em] text-white">{announcement.title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full border border-border-default/70 bg-black/15 hover:bg-white/10 text-slate-400 hover:text-white transition-all -mr-2 -mt-2">
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
            <NewsActionChip onClick={handleToggleSave} disabled={!supportsSaved || saving} icon={isSaved ? 'bookmark' : 'bookmark_border'} className="disabled:opacity-40">
              {isSaved ? 'Saved' : 'Save'}
            </NewsActionChip>
            <NewsActionChip onClick={() => onHide?.(announcement.id)} icon="visibility_off">
              Hide
            </NewsActionChip>
            <NewsActionChip onClick={handleShare} icon="share">
              Share
            </NewsActionChip>
            {canManage && (
              <>
                <NewsActionChip onClick={() => onEdit?.(announcement.id)} icon="edit">
                  Edit
                </NewsActionChip>
                <NewsActionChip onClick={() => onDelete?.(announcement.id)} icon="delete" danger>
                  Delete
                </NewsActionChip>
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

        <div className="p-3 border-t border-white/10 bg-transparent flex items-center justify-between shrink-0 relative z-10">
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
          <NewsActionChip onClick={onClose} icon="close">Close</NewsActionChip>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AnnouncementDetailModal;
