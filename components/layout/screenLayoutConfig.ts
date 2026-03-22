import { Screen } from '../../types';

export type ScreenLayoutMode = 'narrow' | 'content' | 'split' | 'wide';

export const SCREEN_LAYOUT_CONFIG: Record<Screen, ScreenLayoutMode> = {
  dashboard: 'content',
  upload: 'wide',
  quiz: 'wide',
  'live-aunt-minnie': 'wide',
  search: 'split',
  database: 'split',
  'activity-log': 'split',
  calendar: 'wide',
  profile: 'split',
  announcements: 'content',
  'case-view': 'wide',
  'residents-corner': 'wide',
  'resident-endorsements': 'content',
  'article-library': 'split',
  newsfeed: 'split',
  'monthly-census': 'wide',
  anatomy: 'content',
};

export const getScreenLayoutMode = (screen: Screen): ScreenLayoutMode => SCREEN_LAYOUT_CONFIG[screen] ?? 'content';
