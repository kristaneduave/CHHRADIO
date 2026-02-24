import { describe, expect, it } from 'vitest';
import { Announcement } from '../types';
import {
  NewsFilterState,
  applyNewsFilters,
  estimateReadingMinutes,
  getActiveFilterSummary,
  nextFiltersForQuickMode,
  sortAnnouncementsByPriority,
  toCurrentPrimaryTab,
  toLegacyImportantOnly,
} from '../utils/newsFeedUtils';

const makeAnnouncement = (overrides: Partial<Announcement>): Announcement => ({
  id: Math.random().toString(36).slice(2),
  title: 'Title',
  summary: 'Summary',
  content: 'Summary',
  createdAt: '2026-02-24T00:00:00.000Z',
  author: 'Hospital Staff',
  author_id: 'author-id',
  authorAvatar: null,
  authorTitle: 'Staff',
  date: '2/24/2026',
  category: 'Announcement',
  views: 0,
  ...overrides,
});

describe('newsFeedUtils', () => {
  it('sorts pinned then important then recency', () => {
    const items = [
      makeAnnouncement({ id: 'recent', createdAt: '2026-02-24T10:00:00.000Z' }),
      makeAnnouncement({ id: 'important', is_important: true, createdAt: '2026-02-22T10:00:00.000Z' }),
      makeAnnouncement({ id: 'pinned', is_pinned: true, createdAt: '2026-02-20T10:00:00.000Z' }),
    ];

    const sorted = sortAnnouncementsByPriority(items);
    expect(sorted.map((item) => item.id)).toEqual(['pinned', 'important', 'recent']);
  });

  it('filters pinned, important, category, and saved views correctly', () => {
    const items = [
      makeAnnouncement({ id: 'pinned', is_pinned: true, is_saved: true }),
      makeAnnouncement({ id: 'important', is_important: true, is_saved: false }),
      makeAnnouncement({ id: 'research', category: 'Research' }),
    ];

    const pinnedFilters: NewsFilterState = { primaryTab: 'Pinned', category: null, savedOnly: false, importantOnly: false, sortMode: 'priority_newest' };
    const importantFilters: NewsFilterState = { primaryTab: 'All', category: null, savedOnly: false, importantOnly: true, sortMode: 'priority_newest' };
    const researchFilters: NewsFilterState = { primaryTab: 'All', category: 'Research', savedOnly: false, importantOnly: false, sortMode: 'priority_newest' };
    const savedFilters: NewsFilterState = { primaryTab: 'All', category: null, savedOnly: true, importantOnly: false, sortMode: 'priority_newest' };

    expect(applyNewsFilters(items, pinnedFilters).map((item) => item.id)).toEqual(['pinned']);
    expect(applyNewsFilters(items, importantFilters).map((item) => item.id)).toEqual(['important']);
    expect(applyNewsFilters(items, researchFilters).map((item) => item.id)).toEqual(['research']);
    expect(applyNewsFilters(items, savedFilters).map((item) => item.id)).toEqual(['pinned']);
  });

  it('computes reading time with sensible minimum', () => {
    expect(estimateReadingMinutes('')).toBe(0);
    expect(estimateReadingMinutes('short post')).toBe(1);
  });

  it('maps quick filter modes consistently', () => {
    const base: NewsFilterState = {
      primaryTab: 'All',
      category: 'Research',
      savedOnly: false,
      importantOnly: true,
      sortMode: 'priority_newest',
      quickMode: 'all',
    };
    expect(nextFiltersForQuickMode(base, 'all')).toMatchObject({ primaryTab: 'All', savedOnly: false, importantOnly: true, quickMode: 'all' });
    expect(nextFiltersForQuickMode(base, 'saved')).toMatchObject({ primaryTab: 'All', savedOnly: true, quickMode: 'saved' });
    expect(nextFiltersForQuickMode(base, 'pinned')).toMatchObject({ primaryTab: 'Pinned', savedOnly: false, importantOnly: false, quickMode: 'pinned' });
  });

  it('builds human-readable filter summary', () => {
    const filters: NewsFilterState = {
      primaryTab: 'All',
      category: 'Event',
      savedOnly: true,
      importantOnly: true,
      sortMode: 'priority_newest',
      quickMode: 'saved',
    };
    expect(getActiveFilterSummary(filters)).toBe('Saved · Important · Event · Priority+Newest');
  });

  it('maps legacy Important tab storage to importantOnly', () => {
    expect(toCurrentPrimaryTab('Important')).toBe('All');
    expect(toLegacyImportantOnly('Important')).toBe(true);
    expect(toCurrentPrimaryTab('Pinned')).toBe('Pinned');
    expect(toLegacyImportantOnly('All')).toBe(false);
  });
});
