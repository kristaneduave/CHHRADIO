import { describe, expect, it } from 'vitest';
import { Announcement } from '../types';
import {
  NewsFilterState,
  applyNewsFilters,
  estimateReadingMinutes,
  selectDigest,
  sortAnnouncementsByPriority,
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

  it('filters pinned and important views correctly', () => {
    const items = [
      makeAnnouncement({ id: 'pinned', is_pinned: true, is_saved: true }),
      makeAnnouncement({ id: 'important', is_important: true, is_saved: false }),
      makeAnnouncement({ id: 'research', category: 'Research' }),
    ];

    const pinnedFilters: NewsFilterState = { primaryTab: 'Pinned', category: null, savedOnly: false, sortMode: 'priority_newest' };
    const importantFilters: NewsFilterState = { primaryTab: 'Important', category: null, savedOnly: false, sortMode: 'priority_newest' };
    const researchFilters: NewsFilterState = { primaryTab: 'All', category: 'Research', savedOnly: false, sortMode: 'priority_newest' };
    const savedFilters: NewsFilterState = { primaryTab: 'All', category: null, savedOnly: true, sortMode: 'priority_newest' };

    expect(applyNewsFilters(items, pinnedFilters).map((item) => item.id)).toEqual(['pinned']);
    expect(applyNewsFilters(items, importantFilters).map((item) => item.id)).toEqual(['important']);
    expect(applyNewsFilters(items, researchFilters).map((item) => item.id)).toEqual(['research']);
    expect(applyNewsFilters(items, savedFilters).map((item) => item.id)).toEqual(['pinned']);
  });

  it('selects digest cards deterministically', () => {
    const items = [
      makeAnnouncement({ id: 'n1', createdAt: '2026-02-20T00:00:00.000Z' }),
      makeAnnouncement({ id: 'n2', is_pinned: true, createdAt: '2026-02-21T00:00:00.000Z' }),
      makeAnnouncement({ id: 'n3', is_important: true, createdAt: '2026-02-22T00:00:00.000Z' }),
    ];

    const digest = selectDigest(items);
    expect(digest.headline?.id).toBe('n2');
    expect(digest.topPinned?.id).toBe('n2');
    expect(digest.criticalUpdate?.id).toBe('n3');
  });

  it('computes reading time with sensible minimum', () => {
    expect(estimateReadingMinutes('')).toBe(0);
    expect(estimateReadingMinutes('short post')).toBe(1);
  });
});
