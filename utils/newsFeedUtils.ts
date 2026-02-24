import { Announcement } from '../types';
import { normalizeCategoryForUi } from './newsPresentation';

export type NewsPrimaryTab = 'All' | 'Pinned' | 'Important';
export type NewsCategoryFilter = 'Announcement' | 'Research' | 'Event' | 'Miscellaneous' | null;
export type NewsSortMode = 'priority_newest' | 'newest' | 'oldest';

export interface NewsFilterState {
  primaryTab: NewsPrimaryTab;
  category: NewsCategoryFilter;
  savedOnly: boolean;
  sortMode: NewsSortMode;
}

export interface NewsDigest {
  headline: Announcement | null;
  topPinned: Announcement | null;
  criticalUpdate: Announcement | null;
}

export const NEWS_FILTER_STORAGE_KEY = 'chh_news_filter_state_v2';

export const normalizeAnnouncementPinned = (item: Partial<Announcement> & { pinned?: boolean }): boolean =>
  Boolean(item.is_pinned ?? item.pinned ?? false);

export const normalizeAnnouncementImportant = (item: Partial<Announcement>): boolean => Boolean(item.is_important ?? false);

export const estimateReadingMinutes = (value: string | null | undefined): number => {
  const text = String(value || '').trim();
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
};

export const readingTimeLabel = (minutes: number): string => {
  if (minutes <= 0) return 'Quick read';
  if (minutes === 1) return '1 min read';
  return `${minutes} min read`;
};

export const sortAnnouncementsByPriority = <T extends Partial<Announcement> & { pinned?: boolean }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aPinned = normalizeAnnouncementPinned(a) ? 1 : 0;
    const bPinned = normalizeAnnouncementPinned(b) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    const aImportant = normalizeAnnouncementImportant(a) ? 1 : 0;
    const bImportant = normalizeAnnouncementImportant(b) ? 1 : 0;
    if (aImportant !== bImportant) return bImportant - aImportant;

    const aDate = a.createdAt || a.pinned_at || '';
    const bDate = b.createdAt || b.pinned_at || '';
    const aTs = aDate ? new Date(aDate).getTime() : 0;
    const bTs = bDate ? new Date(bDate).getTime() : 0;
    return bTs - aTs;
  });

export const sortAnnouncements = (items: Announcement[], mode: NewsSortMode): Announcement[] => {
  if (mode === 'priority_newest') return sortAnnouncementsByPriority(items);
  const sorted = [...items].sort((a, b) => {
    const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTs - aTs;
  });
  return mode === 'oldest' ? sorted.reverse() : sorted;
};

export const applyNewsFilters = (items: Announcement[], filters: NewsFilterState): Announcement[] => {
  let list = [...items];
  if (filters.primaryTab === 'Pinned') list = list.filter((item) => normalizeAnnouncementPinned(item));
  if (filters.primaryTab === 'Important') list = list.filter((item) => normalizeAnnouncementImportant(item));
  if (filters.category) {
    list = list.filter((item) => normalizeCategoryForUi(item.category) === filters.category);
  }
  if (filters.savedOnly) {
    list = list.filter((item) => Boolean(item.is_saved));
  }
  return sortAnnouncements(list, filters.sortMode);
};

export const selectDigest = (items: Announcement[]): NewsDigest => {
  const ordered = sortAnnouncementsByPriority(items);
  const headline = ordered[0] || null;
  const topPinned = ordered.find((item) => normalizeAnnouncementPinned(item)) || null;
  const criticalUpdate = ordered.find((item) => normalizeAnnouncementImportant(item)) || null;
  return { headline, topPinned, criticalUpdate };
};
