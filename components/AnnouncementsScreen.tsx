import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { Announcement, UserRole } from '../types';
import CreateAnnouncementModal from './CreateAnnouncementModal';
import AnnouncementDetailModal from './AnnouncementDetailModal';
import { getRoleLabel, normalizeUserRole } from '../utils/roles';
import { fetchHiddenAnnouncementIds, hideAnnouncementForUser } from '../services/announcementVisibilityService';
import { fetchSavedAnnouncementIds } from '../services/announcementSaveService';
import { toastError, toastInfo, toastSuccess } from '../utils/toast';
import { getNewsCategoryRailClass } from '../utils/newsPresentation';
import {
  NEWS_FILTER_STORAGE_KEY,
  NewsCategoryFilter,
  NewsFilterState,
  applyNewsFilters,
  estimateReadingMinutes,
  normalizeAnnouncementImportant,
  normalizeAnnouncementPinned,
  readingTimeLabel,
  selectDigest,
  sortAnnouncementsByPriority,
} from '../utils/newsFeedUtils';

interface AnnouncementsScreenProps {
  initialOpenAnnouncementId?: string | null;
  onHandledInitialOpen?: () => void;
}

const NEWS_EDITORIAL_V2 = true;
const ITEMS_PER_PAGE = 8;
const DEFAULT_FILTERS: NewsFilterState = {
  primaryTab: 'All',
  category: null,
  savedOnly: false,
  sortMode: 'priority_newest',
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

const parseStoredFilters = (): NewsFilterState => {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(NEWS_FILTER_STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<NewsFilterState>;
    const primaryTab = parsed.primaryTab === 'Pinned' || parsed.primaryTab === 'Important' ? parsed.primaryTab : 'All';
    const sortMode = parsed.sortMode === 'newest' || parsed.sortMode === 'oldest' ? parsed.sortMode : 'priority_newest';
    const categoryOptions: Array<NewsCategoryFilter> = ['Announcement', 'Research', 'Event', 'Miscellaneous', null];
    const category = categoryOptions.includes((parsed.category ?? null) as NewsCategoryFilter)
      ? ((parsed.category ?? null) as NewsCategoryFilter)
      : null;
    return {
      primaryTab,
      category,
      savedOnly: Boolean(parsed.savedOnly),
      sortMode,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
};

const AnnouncementsScreen: React.FC<AnnouncementsScreenProps> = ({ initialOpenAnnouncementId, onHandledInitialOpen }) => {
  const [userRole, setUserRole] = useState<UserRole>('resident');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [filters, setFilters] = useState<NewsFilterState>(() => parseStoredFilters());
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [hiddenAnnouncementIds, setHiddenAnnouncementIds] = useState<Set<string>>(new Set());
  const [savedAnnouncementIds, setSavedAnnouncementIds] = useState<Set<string>>(new Set());
  const [supportsSavedTable, setSupportsSavedTable] = useState(true);
  const [supportsPriorityColumns, setSupportsPriorityColumns] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [syncTick, setSyncTick] = useState(0);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const lastHandledInitialOpenRef = useRef<string | null>(null);

  const canCreateAnnouncement = ['admin', 'training_officer', 'moderator', 'consultant'].includes(userRole);
  const canManageAnyAnnouncement = ['admin', 'training_officer', 'moderator'].includes(userRole);
  const canManageOwnAnnouncement = (authorId: string) => userRole === 'consultant' && currentUserId === authorId;
  const canManageAnnouncement = (authorId: string) => canManageAnyAnnouncement || canManageOwnAnnouncement(authorId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NEWS_FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const isMissingPriorityColumnError = (error: any) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('is_pinned') || message.includes('is_important') || message.includes('pinned_at');
  };

  const isMissingSavedTableError = (error: any) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('announcement_user_saved') || message.includes('saved_at');
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

  const loadSavedIds = async (userId: string) => {
    if (!supportsSavedTable || !userId) return;
    try {
      const ids = await fetchSavedAnnouncementIds(userId);
      setSavedAnnouncementIds(ids);
    } catch (error: any) {
      if (isMissingSavedTableError(error)) {
        setSupportsSavedTable(false);
        setSavedAnnouncementIds(new Set());
        if (filters.savedOnly) {
          setFilters((prev) => ({ ...prev, savedOnly: false }));
          toastInfo('Saved posts unavailable', 'Saved feature will appear after migration.');
        }
        return;
      }
      console.error('Error loading saved announcements:', error);
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
        await loadSavedIds(user.id);
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data?.role) {
          setUserRole(normalizeUserRole(data.role));
        }
      }
      await fetchAnnouncements(0, true);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    loadSavedIds(currentUserId);
  }, [currentUserId, syncTick]);

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
        is_saved: supportsSavedTable ? savedAnnouncementIds.has(item.id) : false,
        readingMinutes: item.readingMinutes ?? estimateReadingMinutes(item.content || item.summary),
      })),
    [announcements, savedAnnouncementIds, supportsSavedTable],
  );

  const filteredAnnouncements = useMemo(() => applyNewsFilters(hydratedAnnouncements, filters), [hydratedAnnouncements, filters]);
  const digest = useMemo(() => selectDigest(filteredAnnouncements), [filteredAnnouncements]);
  const featuredPinned = useMemo(
    () => (filters.primaryTab === 'All' ? filteredAnnouncements.filter((item) => normalizeAnnouncementPinned(item)).slice(0, 3) : []),
    [filteredAnnouncements, filters.primaryTab],
  );
  const latestItems = useMemo(
    () => (filters.primaryTab === 'All' ? filteredAnnouncements.filter((item) => !normalizeAnnouncementPinned(item)) : filteredAnnouncements),
    [filteredAnnouncements, filters.primaryTab],
  );

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

  const renderPriorityChip = (post: Announcement) => {
    if (normalizeAnnouncementPinned(post)) {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200">
          Pinned
        </span>
      );
    }
    if (normalizeAnnouncementImportant(post)) {
      return (
        <span className="inline-flex items-center rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-200">
          Important
        </span>
      );
    }
    return null;
  };

  const renderDigestItem = (label: string, item: Announcement | null) => (
    <button
      type="button"
      onClick={() => item && setSelectedAnnouncement(item)}
      disabled={!item}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-70"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm text-slate-100">{item?.title || 'No highlight yet'}</p>
      </div>
      <span className="material-icons text-[16px] text-slate-500">{item ? 'arrow_forward' : 'remove'}</span>
    </button>
  );

  const renderCard = (post: Announcement) => (
    <button
      type="button"
      key={post.id}
      onClick={() => setSelectedAnnouncement(post)}
      className="group relative w-full overflow-hidden rounded-2xl border border-border-default/60 bg-surface/70 px-4 pb-4 pt-3 text-left transition-all hover:border-white/20 hover:bg-surface/85"
    >
      <span className={`absolute left-0 right-0 top-0 h-[1.5px] ${getNewsCategoryRailClass(post.category)} opacity-55 transition-opacity group-hover:opacity-80`} />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-h-[20px]">{renderPriorityChip(post)}</div>
        <span className="text-[10px] text-slate-500">{post.date}</span>
      </div>
      <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug text-white">{post.title}</h3>
      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-400">{post.summary}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-6 w-6 overflow-hidden rounded-full border border-white/10 bg-slate-700">
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt="Author" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-white">{post.author.charAt(0)}</div>
            )}
          </div>
          <span className="truncate text-xs text-slate-300">{post.author}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>{readingTimeLabel(post.readingMinutes || 0)}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <span className="material-icons text-[13px]">visibility</span>
            {post.views}
          </span>
        </div>
      </div>
    </button>
  );

  const clearSecondaryFilters = () => {
    setFilters((prev) => ({ ...prev, category: null, savedOnly: false, sortMode: 'priority_newest' }));
  };

  if (!NEWS_EDITORIAL_V2) {
    return <div className="px-6 pt-7 pb-20 text-slate-400">News v2 disabled.</div>;
  }

  return (
    <div className="min-h-full pb-24">
      <div className="px-6 pt-7 pb-3">
        <h1 className="mb-3 text-2xl font-semibold text-white">News</h1>
        <div className="rounded-xl border border-border-default/60 bg-surface/60 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
              {(['All', 'Pinned', 'Important'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilters((prev) => ({ ...prev, primaryTab: tab }))}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    filters.primaryTab === tab ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilterDrawer(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-slate-400 transition-colors hover:text-white hover:bg-white/[0.08]"
                title="Open filters"
              >
                <span className="material-icons text-[16px]">tune</span>
              </button>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">{filteredAnnouncements.length} item(s)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-5">
        <section className="space-y-2">
          {renderDigestItem("Today's Headline", digest.headline)}
          {renderDigestItem('Top Pinned', digest.topPinned)}
          {renderDigestItem('Critical Update', digest.criticalUpdate)}
        </section>

        {filters.primaryTab === 'All' && featuredPinned.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-200/90">Featured</h2>
            <div className="space-y-3">{featuredPinned.map(renderCard)}</div>
          </section>
        )}

        {latestItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Latest</h2>
            <div className="space-y-4">{latestItems.map(renderCard)}</div>
          </section>
        )}

        {!loading && filteredAnnouncements.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
            <span className="material-icons mb-3 text-4xl text-slate-600">inbox</span>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">No news found</p>
            {canCreateAnnouncement && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
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

      {canCreateAnnouncement && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-24 right-6 z-40 h-11 w-11 rounded-full border border-border-default/80 bg-surface text-slate-200 shadow-clinical transition-colors hover:bg-surface-alt hover:text-white"
          aria-label="Create news"
        >
          <span className="material-icons text-[20px]">add</span>
        </button>
      )}

      {showFilterDrawer && (
        <div className="fixed inset-0 z-[95] flex justify-end bg-black/45 p-0" onClick={() => setShowFilterDrawer(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-full w-[86%] max-w-sm border-l border-white/10 bg-[#0f1720] px-4 py-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Filters</h3>
              <button onClick={() => setShowFilterDrawer(false)} className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                <span className="material-icons text-base">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">Category</p>
                <select
                  value={filters.category || ''}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      category: (event.target.value || null) as NewsCategoryFilter,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="">All categories</option>
                  <option value="Announcement">Announcement</option>
                  <option value="Research">Research</option>
                  <option value="Event">Event</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div>
                  <p className="text-sm text-slate-100">Saved only</p>
                  {!supportsSavedTable && <p className="text-[11px] text-slate-500">Run saved migration to enable.</p>}
                </div>
                <button
                  disabled={!supportsSavedTable}
                  onClick={() => setFilters((prev) => ({ ...prev, savedOnly: !prev.savedOnly }))}
                  className={`h-6 w-11 rounded-full border transition-colors ${
                    filters.savedOnly ? 'border-primary/60 bg-primary/30' : 'border-white/20 bg-white/10'
                  } disabled:opacity-40`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                      filters.savedOnly ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">Sort</p>
                <select
                  value={filters.sortMode}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      sortMode: event.target.value as NewsFilterState['sortMode'],
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="priority_newest">Priority + Newest</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>

              <div className="pt-1">
                <button
                  onClick={clearSecondaryFilters}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.07em] text-slate-300 hover:bg-white/[0.08]"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          supportsSaved={supportsSavedTable}
          onSavedChanged={() => setSyncTick((prev) => prev + 1)}
        />
      )}
    </div>
  );
};

export default AnnouncementsScreen;
