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
import { getNewsCategoryStyleTokens, NEWS_SURFACE_BASE_CLASS, NEWS_SURFACE_INTERACTIVE_CLASS } from '../utils/newsStyleTokens';

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

  const renderCard = (post: Announcement) => {
    const metaDateTime = post.createdAt
      ? `${new Date(post.createdAt).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })} ${new Date(post.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : post.date;
    const normalizedCategory = normalizeCategoryForUi(post.category);
    const watermarkKey =
      normalizedCategory === 'Research'
        ? 'research'
        : normalizedCategory === 'Event'
          ? 'event'
          : normalizedCategory === 'Miscellaneous'
            ? 'misc'
            : 'announcement';
    const typeStyles = getNewsCategoryStyleTokens(normalizedCategory);
    const canManageCard = canManageAnnouncement(post.author_id);
    const canHideCard = canManageAnyAnnouncement;
    const showActionMenu = canManageCard || canHideCard;
    const isActionMenuOpen = actionMenuPostId === post.id;

    return (
      <button
        type="button"
        key={post.id}
        onClick={() => {
          setActionMenuPostId(null);
          setSelectedAnnouncement(post);
        }}
        className={`group ${NEWS_SURFACE_BASE_CLASS} ${NEWS_SURFACE_INTERACTIVE_CLASS} w-full min-h-[92px] overflow-visible rounded-b-xl rounded-t-none px-4 py-3.5 text-left ${isActionMenuOpen ? 'z-40' : 'z-0'}`}
      >
        <span className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-b-xl rounded-t-none">
          <span className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
          <span className={`absolute left-0 right-0 top-0 h-[2px] rounded-none ${typeStyles.railTint} opacity-15 blur-[0.5px]`} />
          <span className="absolute left-0 right-0 top-[1px] h-[1px] rounded-none bg-[linear-gradient(90deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.3)_100%)] shadow-[0_0_6px_rgba(255,255,255,0.08)] backdrop-blur-[8px]" />
          <span
            className={`absolute -left-16 top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 opacity-[0.02] ${typeStyles.watermark}`}
            style={{
              WebkitMaskImage: `url(/news-symbols/${watermarkKey}.svg)`,
              maskImage: `url(/news-symbols/${watermarkKey}.svg)`,
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'left center',
              maskPosition: 'left center',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
          />
        </span>
        <div className="relative z-10 flex min-h-[64px] items-center gap-2.5">
          <div className="min-w-0 flex-1 self-center pr-2">
            <h3 className="line-clamp-1 text-[18px] font-semibold leading-tight tracking-[0.005em] text-white sm:line-clamp-2 sm:text-[20px]">
              {post.title}
            </h3>
          </div>
          <div className="relative flex shrink-0 items-center">
            <div className="flex min-w-0 flex-col items-end gap-0.5 pr-9">
              <div className="flex items-center gap-1 text-xs text-white/85">
                <span className="max-w-[112px] truncate text-white/85">{post.author}</span>
                <div className="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-700">
                  {post.authorAvatar ? (
                    <img src={post.authorAvatar} alt={post.author} className="block h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] font-semibold text-slate-200">
                      {String(post.author || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-[12px] font-medium text-white/75">{metaDateTime}</span>
            </div>
            {showActionMenu ? (
              <div className="absolute right-0 top-0 shrink-0" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setActionMenuPostId((prev) => (prev === post.id ? null : post.id))}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                  aria-label="Open card actions"
                >
                  <span className="material-icons text-[14px]">more_horiz</span>
                </button>
                {isActionMenuOpen && (
                  <div className="absolute right-0 top-8 z-30 min-w-[122px] rounded-lg border border-white/10 bg-[#122034] p-1.5 shadow-xl">
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
              <span className="material-icons absolute right-0 top-0 shrink-0 text-[14px] text-slate-600 transition-colors group-hover:text-slate-400">visibility_off</span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const clearSearch = () => setSearchQuery('');
  const resetView = () => {
    setSearchQuery('');
    setViewPrefs(DEFAULT_VIEW_PREFS);
  };
  const resultCount = sortedAnnouncements.length;

  return (
    <div className="min-h-full pb-24">
      <div className="sticky top-0 z-20 px-4 pb-2 pt-3">
        <div className="mx-auto w-full max-w-md">
          <h1 className="mb-2 text-2xl font-semibold text-white">News</h1>
          <div className="flex items-center gap-2">
            {canCreateAnnouncement && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="h-10 shrink-0 rounded-xl bg-primary px-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95 sm:px-4"
                title="Add Post"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-icons text-[18px]">add</span>
                  <span className="hidden sm:inline">Add Post</span>
                </span>
              </button>
            )}
            <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05]">
              <div className="flex h-10 items-center overflow-hidden rounded-xl">
                <div className="relative flex-1">
                  <span className="material-icons pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">search</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search..."
                    className="h-10 w-full border-0 bg-transparent pl-10 pr-3 text-base text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <span className="h-5 w-px bg-white/10" />
                <div className="relative w-[132px] shrink-0">
                  <select
                    value={viewPrefs.typeFilter}
                    onChange={(event) =>
                      setViewPrefs((prev) => ({
                        ...prev,
                        typeFilter: event.target.value as TypeFilter,
                      }))
                    }
                    className="h-10 w-full appearance-none border-0 bg-transparent px-3 pr-9 text-sm font-semibold text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="Announcement">Announcement</option>
                    <option value="Research">Research</option>
                    <option value="Event">Event</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                  <span className="material-icons pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-slate-500">filter_list</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-1.5">
        {pinnedItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-200/90">Pinned</h2>
            <div className="space-y-3">{pinnedItems.map(renderCard)}</div>
          </section>
        )}

        {regularItems.length > 0 && (
          <section className="space-y-3">
            <div className="space-y-3">{regularItems.map(renderCard)}</div>
          </section>
        )}

        {!loading && resultCount === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
            <span className="material-icons mb-3 text-4xl text-slate-600">inbox</span>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">No news found</p>
            {searchQuery.trim().length > 0 && (
              <button
                onClick={clearSearch}
                className="mt-4 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
              >
                Clear search
              </button>
            )}
            <button
              onClick={resetView}
              className="mt-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
            >
              Reset filters
            </button>
            {canCreateAnnouncement && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
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
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300 hover:bg-white/[0.08]"
            >
              Retry loading
            </button>
          )}
        </div>
      </div>

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
          onClose={() => setSelectedAnnouncement(null)}
          onHide={handleHideAnnouncement}
          onEdit={handleEditAnnouncement}
          onDelete={handleDeleteAnnouncement}
          canManage={canManageAnnouncement(selectedAnnouncement.author_id)}
          supportsSaved={false}
        />
      )}
    </div>
  );
};

export default AnnouncementsScreen;

