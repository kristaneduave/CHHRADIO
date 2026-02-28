import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { Announcement, UserRole } from '../types';
import CreateAnnouncementModal from './CreateAnnouncementModal';
import AnnouncementDetailModal from './AnnouncementDetailModal';
import { getRoleLabel, normalizeUserRole } from '../utils/roles';
import { fetchHiddenAnnouncementIds, hideAnnouncementForUser } from '../services/announcementVisibilityService';
import { toastError, toastSuccess } from '../utils/toast';
import {
  NEWS_FILTER_STORAGE_KEY,
  estimateReadingMinutes,
  normalizeAnnouncementPinned,
  sortAnnouncementsByPriority,
} from '../utils/newsFeedUtils';
import {
  normalizeCategoryForUi,
} from '../utils/newsPresentation';
import { getNewsCategoryStyleTokens } from '../utils/newsStyleTokens';
import LoadingState from './LoadingState';
import NewsPageShell from './news/NewsPageShell';
import NewsCardBase from './news/NewsCardBase';
import NewsCardBadge from './news/NewsCardBadge';

interface AnnouncementsScreenProps {
  initialOpenAnnouncementId?: string | null;
  onHandledInitialOpen?: () => void;
}

type TypeFilter = 'all' | 'Announcement' | 'Research' | 'Event' | 'Miscellaneous';
type SortOrder = 'newest' | 'oldest';

interface NewsViewPrefs {
  typeFilter: TypeFilter;
  sortOrder: SortOrder;
}

const ITEMS_PER_PAGE = 8;
const NEWS_READ_STORAGE_KEY = 'chh_news_read_ids_v1';
const DEFAULT_VIEW_PREFS: NewsViewPrefs = {
  typeFilter: 'all',
  sortOrder: 'newest',
};

const mapAnnouncementRow = (item: any): Announcement => ({
  id: item.id,
  title: item.title,
  summary: item.content.length > 220 ? `${item.content.substring(0, 220)}...` : item.content,
  content: item.content,
  createdAt: item.created_at,
  author: item.profiles?.nickname || item.profiles?.full_name || 'Hospital Staff',
  authorFullName: item.profiles?.full_name || 'Hospital Staff',
  authorNickname: item.profiles?.nickname,
  author_id: item.author_id,
  authorAvatar: item.profiles?.avatar_url,
  authorTitle: getRoleLabel(item.profiles?.role),
  date: new Date(item.created_at).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
  category: item.category,
  is_pinned: Boolean(item.is_pinned ?? item.pinned ?? false),
  is_important: Boolean(item.is_important ?? false),
  pinned_at: item.pinned_at || null,
  imageUrl: item.image_url,
  views: item.views || 0,
  attachments: item.attachments || [],
  externalLink: item.external_link,
  links: item.links || [],
  icon: item.icon,
  readingMinutes: estimateReadingMinutes(item.content),
});

const parseStoredViewPrefs = (): NewsViewPrefs => {
  if (typeof window === 'undefined') return DEFAULT_VIEW_PREFS;
  try {
    const raw = window.localStorage.getItem(NEWS_FILTER_STORAGE_KEY);
    if (!raw) return DEFAULT_VIEW_PREFS;

    const parsed = JSON.parse(raw) as any;
    const legacyType = parsed?.category ? normalizeCategoryForUi(String(parsed.category)) : 'all';
    const typeFilter: TypeFilter =
      parsed?.typeFilter === 'Announcement' ||
        parsed?.typeFilter === 'Research' ||
        parsed?.typeFilter === 'Event' ||
        parsed?.typeFilter === 'Miscellaneous'
        ? parsed.typeFilter
        : legacyType === 'Announcement' || legacyType === 'Research' || legacyType === 'Event' || legacyType === 'Miscellaneous'
          ? legacyType
          : 'all';

    const sortOrder: SortOrder = parsed?.sortOrder === 'oldest' || parsed?.sortMode === 'oldest' ? 'oldest' : 'newest';
    return { typeFilter, sortOrder };
  } catch {
    return DEFAULT_VIEW_PREFS;
  }
};

const resolveCategoryIcon = (category: TypeFilter | 'all'): string => {
  if (category === 'Research') return 'biotech';
  if (category === 'Event') return 'event';
  if (category === 'Miscellaneous') return 'description';
  return 'campaign';
};

const AnnouncementsScreen: React.FC<AnnouncementsScreenProps> = ({ initialOpenAnnouncementId, onHandledInitialOpen }) => {
  const [userRole, setUserRole] = useState<UserRole>('resident');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewPrefs, setViewPrefs] = useState<NewsViewPrefs>(() => parseStoredViewPrefs());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [actionMenuPostId, setActionMenuPostId] = useState<string | null>(null);
  const [hiddenAnnouncementIds, setHiddenAnnouncementIds] = useState<Set<string>>(new Set());
  const [supportsPriorityColumns, setSupportsPriorityColumns] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      const raw = window.localStorage.getItem(NEWS_READ_STORAGE_KEY);
      if (!raw) return new Set<string>();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set<string>(parsed.filter((id) => typeof id === 'string')) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const lastHandledInitialOpenRef = useRef<string | null>(null);

  const canCreateAnnouncement = ['admin', 'training_officer', 'moderator', 'consultant'].includes(userRole);
  const canManageAnyAnnouncement = ['admin', 'training_officer', 'moderator'].includes(userRole);
  const canManageOwnAnnouncement = (authorId: string) => userRole === 'consultant' && currentUserId === authorId;
  const canManageAnnouncement = (authorId: string) => canManageAnyAnnouncement || canManageOwnAnnouncement(authorId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NEWS_FILTER_STORAGE_KEY, JSON.stringify(viewPrefs));
  }, [viewPrefs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NEWS_READ_STORAGE_KEY, JSON.stringify(Array.from(readAnnouncementIds)));
  }, [readAnnouncementIds]);

  const isMissingPriorityColumnError = (error: any) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('is_pinned') || message.includes('is_important') || message.includes('pinned_at');
  };

  const queryAnnouncementsPage = async (from: number, to: number) => {
    if (supportsPriorityColumns) {
      const prioritized = await supabase
        .from('announcements')
        .select(
          `*,
          profiles:author_id (
            full_name,
            avatar_url,
            role,
            nickname
          )`,
        )
        .order('is_pinned', { ascending: false })
        .order('is_important', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!prioritized.error) return prioritized;
      if (!isMissingPriorityColumnError(prioritized.error)) return prioritized;
      setSupportsPriorityColumns(false);
    }

    return supabase
      .from('announcements')
      .select(
        `*,
        profiles:author_id (
          full_name,
          avatar_url,
          role,
          nickname
        )`,
      )
      .order('created_at', { ascending: false })
      .range(from, to);
  };

  const fetchAnnouncements = async (pageNumber: number, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setLoadMoreError(null);
      } else {
        setLoadingMore(true);
      }

      const from = pageNumber * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const { data, error } = await queryAnnouncementsPage(from, to);
      if (error) throw error;
      if (!data) return;

      const mapped = sortAnnouncementsByPriority(data.map(mapAnnouncementRow));
      const visible = mapped.filter((item) => !hiddenAnnouncementIds.has(item.id));

      if (reset) {
        setAnnouncements(visible);
      } else {
        setAnnouncements((prev) => sortAnnouncementsByPriority([...prev, ...visible]));
      }

      setHasMore(data.length >= ITEMS_PER_PAGE);
    } catch (error: any) {
      console.error('Error fetching announcements:', error);
      if (reset) {
        toastError('Failed to load news', error?.message || 'Please refresh and try again.');
      } else {
        setLoadMoreError('Could not load more posts.');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const hiddenIds = await fetchHiddenAnnouncementIds(user.id);
        setHiddenAnnouncementIds(hiddenIds);
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data?.role) setUserRole(normalizeUserRole(data.role));
      }
      await fetchAnnouncements(0, true);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (!hiddenAnnouncementIds.size) return;
    setAnnouncements((prev) => prev.filter((item) => !hiddenAnnouncementIds.has(item.id)));
  }, [hiddenAnnouncementIds]);

  useEffect(() => {
    if (!loaderRef.current) return;
    if (!hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchAnnouncements(nextPage, false);
      },
      { rootMargin: '180px 0px' },
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, announcements.length]);

  useEffect(() => {
    const targetId = initialOpenAnnouncementId || null;
    if (!targetId || lastHandledInitialOpenRef.current === targetId) return;
    if (hiddenAnnouncementIds.has(targetId)) {
      lastHandledInitialOpenRef.current = targetId;
      onHandledInitialOpen?.();
      return;
    }

    const existing = announcements.find((item) => item.id === targetId);
    if (existing) {
      lastHandledInitialOpenRef.current = targetId;
      setSelectedAnnouncement(existing);
      onHandledInitialOpen?.();
      return;
    }

    let active = true;
    const fetchTargetAnnouncement = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select(
            `*,
            profiles:author_id (
              full_name,
              avatar_url,
              role,
              nickname
            )`,
          )
          .eq('id', targetId)
          .single();

        if (!active) return;
        lastHandledInitialOpenRef.current = targetId;
        if (error || !data) {
          onHandledInitialOpen?.();
          return;
        }

        const mapped = mapAnnouncementRow(data);
        setAnnouncements((prev) => sortAnnouncementsByPriority(prev.some((item) => item.id === mapped.id) ? prev : [mapped, ...prev]));
        setSelectedAnnouncement(mapped);
        onHandledInitialOpen?.();
      } catch (error) {
        console.error('Error opening announcement from notification:', error);
        if (!active) return;
        lastHandledInitialOpenRef.current = targetId;
        onHandledInitialOpen?.();
      }
    };

    fetchTargetAnnouncement();
    return () => {
      active = false;
    };
  }, [initialOpenAnnouncementId, announcements, hiddenAnnouncementIds, onHandledInitialOpen]);

  const hydratedAnnouncements = useMemo(
    () =>
      announcements.map((item) => ({
        ...item,
        readingMinutes: item.readingMinutes ?? estimateReadingMinutes(item.content || item.summary),
      })),
    [announcements],
  );

  const searchedAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return hydratedAnnouncements;
    return hydratedAnnouncements.filter((item) => {
      const title = String(item.title || '').toLowerCase();
      const content = String(item.content || item.summary || '').toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }, [hydratedAnnouncements, searchQuery]);

  const typeFilteredAnnouncements = useMemo(() => {
    if (viewPrefs.typeFilter === 'all') return searchedAnnouncements;
    return searchedAnnouncements.filter((item) => normalizeCategoryForUi(item.category) === viewPrefs.typeFilter);
  }, [searchedAnnouncements, viewPrefs.typeFilter]);

  const sortedAnnouncements = useMemo(() => {
    const list = [...typeFilteredAnnouncements];
    list.sort((a, b) => {
      const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return viewPrefs.sortOrder === 'newest' ? bTs - aTs : aTs - bTs;
    });
    return list;
  }, [typeFilteredAnnouncements, viewPrefs.sortOrder]);

  const pinnedItems = useMemo(() => sortedAnnouncements.filter((item) => normalizeAnnouncementPinned(item)), [sortedAnnouncements]);
  const regularItems = useMemo(() => sortedAnnouncements.filter((item) => !normalizeAnnouncementPinned(item)), [sortedAnnouncements]);
  const orderedAnnouncements = useMemo(() => [...pinnedItems, ...regularItems], [pinnedItems, regularItems]);

  const handleHideAnnouncement = async (announcementId: string) => {
    try {
      await hideAnnouncementForUser(announcementId);
      setHiddenAnnouncementIds((prev) => new Set(prev).add(announcementId));
      if (selectedAnnouncement?.id === announcementId) setSelectedAnnouncement(null);
      toastSuccess('News hidden');
    } catch (error: any) {
      console.error('Error hiding announcement:', error);
      toastError('Failed to hide news', error?.message || 'Please try again.');
    }
  };

  const handleEditAnnouncement = (announcementId: string) => {
    const target = hydratedAnnouncements.find((item) => item.id === announcementId);
    if (!target) return;
    setSelectedAnnouncement(null);
    setEditingAnnouncement(target);
    setShowCreateModal(true);
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!window.confirm('Are you sure you want to delete this news post?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', announcementId);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((item) => item.id !== announcementId));
      setSelectedAnnouncement(null);
      toastSuccess('News deleted');
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      toastError('Failed to delete news', error?.message || 'Please try again.');
    }
  };

  const isMissingPinColumnError = (error: any) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('is_pinned') || message.includes('pinned_at') || message.includes("'pinned'");
  };

  const handleTogglePinAnnouncement = async (announcementId: string) => {
    const target = announcements.find((item) => item.id === announcementId);
    if (!target || !canManageAnnouncement(target.author_id)) return;

    const nextPinned = !normalizeAnnouncementPinned(target);
    const pinnedAt = nextPinned ? new Date().toISOString() : null;
    const attempts: Array<Record<string, any>> = [
      { is_pinned: nextPinned, pinned_at: pinnedAt },
      { is_pinned: nextPinned },
      { pinned: nextPinned, pinned_at: pinnedAt },
      { pinned: nextPinned },
    ];

    try {
      let updated = false;
      for (const patch of attempts) {
        const { error } = await supabase.from('announcements').update(patch).eq('id', announcementId);
        if (!error) {
          updated = true;
          break;
        }
        if (!isMissingPinColumnError(error)) throw error;
      }

      if (!updated) throw new Error('Unable to update pin state.');

      setAnnouncements((prev) =>
        prev.map((item) =>
          item.id === announcementId
            ? {
                ...item,
                is_pinned: nextPinned,
                pinned_at: pinnedAt,
              }
            : item,
        ),
      );
      setSelectedAnnouncement((prev) =>
        prev && prev.id === announcementId
          ? {
              ...prev,
              is_pinned: nextPinned,
              pinned_at: pinnedAt,
            }
          : prev,
      );
      toastSuccess(nextPinned ? 'Pinned' : 'Unpinned');
    } catch (error: any) {
      toastError('Unable to update pin', error?.message || 'Please try again.');
    }
  };

  const markAnnouncementAsRead = (announcementId: string) => {
    if (!announcementId) return;
    setReadAnnouncementIds((prev) => {
      if (prev.has(announcementId)) return prev;
      const next = new Set(prev);
      next.add(announcementId);
      return next;
    });
  };

  const renderCard = (post: Announcement) => {
    const metaDateTime = post.createdAt
      ? `${new Date(post.createdAt).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })} ${new Date(post.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : post.date;
    const normalizedCategory = normalizeCategoryForUi(post.category);
    const typeStyles = getNewsCategoryStyleTokens(normalizedCategory);
    const canManageCard = canManageAnnouncement(post.author_id);
    const canHideCard = canManageAnyAnnouncement;
    const showActionMenu = canManageCard || canHideCard;
    const isActionMenuOpen = actionMenuPostId === post.id;
    const isPinned = normalizeAnnouncementPinned(post);
    const isImportant = Boolean(post.is_important);
    const createdAtMs = post.createdAt ? new Date(post.createdAt).getTime() : 0;
    const isRecent = createdAtMs > 0 && (Date.now() - createdAtMs) < (24 * 60 * 60 * 1000);
    const isRead = readAnnouncementIds.has(post.id);
    const isPinnedHighlight = isPinned;
    const isUnreadHighlight = (!isRead) && (isImportant || isRecent);
    const isHighlighted = isPinnedHighlight || isUnreadHighlight;
    const iconName = resolveCategoryIcon(normalizedCategory as TypeFilter);
    const unreadTone = (() => {
      if (normalizedCategory === 'Announcement') {
        return {
          cardClass: 'bg-amber-500/[0.08] border border-amber-500/30 shadow-[0_4px_24px_-8px_rgba(217,119,6,0.25)] hover:bg-amber-500/[0.12]',
          glowClass: 'bg-amber-500/20',
          iconClass: 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
        };
      }
      if (normalizedCategory === 'Research') {
        return {
          cardClass: 'bg-indigo-500/[0.08] border border-indigo-500/30 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.25)] hover:bg-indigo-500/[0.12]',
          glowClass: 'bg-indigo-500/20',
          iconClass: 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(129,140,248,0.3)]',
        };
      }
      if (normalizedCategory === 'Event') {
        return {
          cardClass: 'bg-emerald-500/[0.08] border border-emerald-500/30 shadow-[0_4px_24px_-8px_rgba(16,185,129,0.25)] hover:bg-emerald-500/[0.12]',
          glowClass: 'bg-emerald-500/20',
          iconClass: 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 shadow-[0_0_15px_rgba(52,211,153,0.3)]',
        };
      }
      return {
        cardClass: 'bg-[#A95F3B]/[0.1] border border-[#A95F3B]/35 shadow-[0_4px_24px_-8px_rgba(169,95,59,0.25)] hover:bg-[#A95F3B]/[0.14]',
        glowClass: 'bg-[#A95F3B]/20',
        iconClass: 'bg-[#A95F3B]/20 border border-[#A95F3B]/40 text-[#EBC7A4] shadow-[0_0_15px_rgba(169,95,59,0.3)]',
      };
    })();

    return (
      <NewsCardBase
        key={post.id}
        isElevated={isActionMenuOpen}
        className={
          isPinnedHighlight
            ? 'bg-rose-500/[0.08] border border-rose-500/30 shadow-[0_4px_24px_-8px_rgba(225,29,72,0.25)] hover:bg-rose-500/[0.12]'
            : isUnreadHighlight
            ? unreadTone.cardClass
            : 'bg-white/[0.03] border border-white/5 opacity-80 hover:bg-white/[0.05]'
        }
        onClick={() => {
          setActionMenuPostId(null);
          setSelectedAnnouncement(post);
        }}
      >
        {isHighlighted && (
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl">
            <div
              className={`absolute top-0 right-0 w-36 h-36 blur-[54px] rounded-full transform -translate-y-1/2 translate-x-1/2 ${
                isPinnedHighlight ? 'bg-rose-500/20' : unreadTone.glowClass
              }`}
            />
          </div>
        )}

        {isPinned && (
          <span className="absolute top-[-3px] -left-2 px-2 py-0.5 rounded-[4px] text-[9px] leading-none font-bold tracking-wider uppercase z-20 bg-slate-900 text-rose-400 border border-rose-500/30 shadow-[0_2px_8px_rgba(225,29,72,0.2)]">
            Pinned
          </span>
        )}

        <div className="relative z-10 flex items-start gap-3 w-full">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isPinnedHighlight
                ? 'mt-2 bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                : isUnreadHighlight
                ? `mt-0.5 ${unreadTone.iconClass}`
                : 'mt-0.5 bg-black/40 border border-white/5 text-primary-light opacity-80'
            }`}
          >
            <span className="material-icons text-[20px]">{iconName}</span>
          </div>

          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <h3 className={`truncate text-[14px] sm:text-[15px] tracking-tight font-bold uppercase ${isPinned ? 'text-rose-300' : typeStyles.accentText}`}>
                  {String(post.title || '').toUpperCase()}
                </h3>
                {isImportant && <NewsCardBadge label="New" className="bg-rose-500/15 border-rose-400/35 text-rose-200" />}
              </div>
              <span className="text-[10px] sm:text-[11px] whitespace-nowrap font-medium uppercase tracking-wider text-white/80">{metaDateTime}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-1.5 text-[11px] sm:text-[12px] truncate uppercase tracking-wider">
                <span className="font-semibold text-white">{normalizedCategory}</span>
                <span className="text-white/70 font-bold px-0.5">|</span>
                <span className="truncate normal-case tracking-normal text-white">by {post.author}</span>
              </div>

              {showActionMenu ? (
                <div className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setActionMenuPostId((prev) => (prev === post.id ? null : post.id))}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300"
                    aria-label="Open card actions"
                  >
                    <span className="material-icons text-[15px]">more_horiz</span>
                  </button>
                  {isActionMenuOpen && (
                    <div className="absolute right-0 top-7 z-30 min-w-[128px] rounded-xl border border-white/10 bg-surface p-1.5 shadow-xl">
                      {canManageCard && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenuPostId(null);
                            void handleTogglePinAnnouncement(post.id);
                          }}
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
                        >
                          {isPinned ? 'Unpin' : 'Pin news'}
                        </button>
                      )}
                      {canManageCard && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenuPostId(null);
                            handleEditAnnouncement(post.id);
                          }}
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
                        >
                          Edit
                        </button>
                      )}
                      {canManageCard && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenuPostId(null);
                            handleDeleteAnnouncement(post.id);
                          }}
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-200 hover:bg-rose-500/15"
                        >
                          Delete
                        </button>
                      )}
                      {canHideCard && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenuPostId(null);
                            handleHideAnnouncement(post.id);
                          }}
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
                        >
                          Hide
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="material-icons shrink-0 text-[14px] text-slate-600 transition-colors group-hover:text-slate-400">visibility_off</span>
              )}
            </div>
          </div>
        </div>
      </NewsCardBase>
    );
  };

  const clearSearch = () => setSearchQuery('');
  const resetView = () => {
    setSearchQuery('');
    setViewPrefs(DEFAULT_VIEW_PREFS);
  };
  const resultCount = sortedAnnouncements.length;

  return (
    <>
      <NewsPageShell
        title="News"
        headerAction={
          canCreateAnnouncement ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-10 shrink-0 rounded-xl bg-primary px-3.5 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95 sm:px-4"
              title="Add Post"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="material-icons text-[18px]">add</span>
                <span className="hidden sm:inline">Add Post</span>
              </span>
            </button>
          ) : null
        }
        searchFilterBar={
          <div className="relative mb-0">
            <div className="relative group flex bg-black/40 p-1.5 rounded-[1.25rem] border border-white/5 backdrop-blur-md shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 -mx-1.5">
              <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[19px] text-slate-500 group-focus-within:text-primary transition-colors">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title or content..."
                className="w-full h-10 bg-transparent border-0 rounded-xl pl-[2.75rem] pr-[11rem] text-[13px] font-bold text-white placeholder-slate-500 focus:ring-0 focus:outline-none transition-all"
                aria-label="Search news"
              />
              {searchQuery ? (
                <button
                  onClick={clearSearch}
                  className="absolute right-[8.7rem] top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Clear search"
                >
                  <span className="material-icons text-sm">close</span>
                </button>
              ) : null}
              <div className="absolute right-1.5 top-1.5 h-10 w-[126px]">
                <select
                  value={viewPrefs.typeFilter}
                  onChange={(event) =>
                    setViewPrefs((prev) => ({
                      ...prev,
                      typeFilter: event.target.value as TypeFilter,
                    }))
                  }
                  className="h-full w-full appearance-none border border-white/10 bg-white/[0.03] pl-3 pr-8 text-[12px] font-bold text-slate-200 focus:outline-none hover:bg-white/[0.07] rounded-xl transition-colors"
                  aria-label="Filter news type"
                >
                  <option value="all" className="bg-surface">All</option>
                  <option value="Announcement" className="bg-surface">Announcement</option>
                  <option value="Research" className="bg-surface">Research</option>
                  <option value="Event" className="bg-surface">Event</option>
                  <option value="Miscellaneous" className="bg-surface">Misc</option>
                </select>
                <span className="material-icons pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[17px] text-slate-500">tune</span>
              </div>
            </div>
          </div>
        }
        topUtilityRegion={
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {resultCount} item(s)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setViewPrefs((prev) => ({
                    ...prev,
                    sortOrder: prev.sortOrder === 'newest' ? 'oldest' : 'newest',
                  }))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-white/[0.08] transition-colors"
                aria-label="Toggle sort order"
              >
                <span className="material-icons text-[12px]">swap_vert</span>
                {viewPrefs.sortOrder === 'newest' ? 'Newest' : 'Oldest'}
              </button>
              {(searchQuery || viewPrefs.typeFilter !== 'all' || viewPrefs.sortOrder !== DEFAULT_VIEW_PREFS.sortOrder) && (
                <button
                  type="button"
                  onClick={resetView}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-white/[0.08] transition-colors"
                >
                  <span className="material-icons text-[12px]">restart_alt</span>
                  Reset
                </button>
              )}
            </div>
          </div>
        }
        feedRegion={
          <div className="space-y-4 pt-2">
            {loading && resultCount === 0 ? (
              <LoadingState title="Loading News..." compact />
            ) : (
              <>
                {orderedAnnouncements.length > 0 && (
                  <section className="space-y-3">
                    <div className="space-y-3">{orderedAnnouncements.map(renderCard)}</div>
                  </section>
                )}
              </>
            )}

            {!loading && resultCount === 0 && (
              <div className="glass-card-enhanced rounded-2xl border border-white/10 p-8 text-center">
                <span className="material-icons mb-3 text-4xl text-slate-600">inbox</span>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-500">No news found</p>
                <p className="mt-2 text-xs text-slate-500">Adjust filters or try a different search term.</p>
                {searchQuery.trim().length > 0 && (
                  <button
                    onClick={clearSearch}
                    className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
                  >
                    Clear search
                  </button>
                )}
                <button
                  onClick={resetView}
                  className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
                >
                  Reset filters
                </button>
                {canCreateAnnouncement && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
                  >
                    Create News
                  </button>
                )}
              </div>
            )}

            <div ref={loaderRef} className="flex min-h-[56px] items-center justify-center">
              {loadingMore && <p className="text-xs text-slate-500">Loading more...</p>}
              {!loadingMore && loadMoreError && (
                <button
                  onClick={() => {
                    setLoadMoreError(null);
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchAnnouncements(nextPage, false);
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                >
                  Retry loading
                </button>
              )}
            </div>
          </div>
        }
      />

      {showCreateModal && (
        <CreateAnnouncementModal
          onClose={() => {
            setShowCreateModal(false);
            setEditingAnnouncement(null);
          }}
          onSuccess={() => {
            setPage(0);
            fetchAnnouncements(0, true);
            setShowCreateModal(false);
            setEditingAnnouncement(null);
          }}
          editingAnnouncement={editingAnnouncement}
        />
      )}

      {selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          onClose={() => {
            markAnnouncementAsRead(selectedAnnouncement.id);
            setSelectedAnnouncement(null);
          }}
          onHide={handleHideAnnouncement}
          onEdit={handleEditAnnouncement}
          onDelete={handleDeleteAnnouncement}
          canManage={canManageAnnouncement(selectedAnnouncement.author_id)}
          supportsSaved={false}
          onSavedChanged={() => {
            setPage(0);
            fetchAnnouncements(0, true);
          }}
        />
      )}
    </>
  );
};

export default AnnouncementsScreen;
