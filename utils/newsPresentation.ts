export const NEWS_CATEGORY_OPTIONS = [
  'Announcement',
  'Research',
  'Event',
  'Miscellaneous',
] as const;

export type NewsSymbolKey =
  | 'announcement'
  | 'research'
  | 'event'
  | 'misc'
  | 'star'
  | 'bookmark'
  | 'alert'
  | 'clipboard'
  | 'target'
  | 'bolt'
  | 'idea'
  | 'shield';

const NEWS_SYMBOL_OPTIONS: Array<{ key: NewsSymbolKey; label: string }> = [
  { key: 'announcement', label: 'Announcement' },
  { key: 'research', label: 'Research' },
  { key: 'event', label: 'Event' },
  { key: 'misc', label: 'Miscellaneous' },
  { key: 'star', label: 'Star' },
  { key: 'bookmark', label: 'Bookmark' },
  { key: 'alert', label: 'Alert' },
  { key: 'clipboard', label: 'Clipboard' },
  { key: 'target', label: 'Target' },
  { key: 'bolt', label: 'Bolt' },
  { key: 'idea', label: 'Idea' },
  { key: 'shield', label: 'Shield' },
];

const NEWS_SYMBOL_KEY_SET = new Set(NEWS_SYMBOL_OPTIONS.map((option) => option.key));

const LEGACY_ICON_TO_SYMBOL: Record<string, NewsSymbolKey> = {
  announce: 'announcement',
  smile: 'misc',
  laugh: 'misc',
  hot: 'bolt',
  'thumbs-up': 'misc',
  party: 'star',
  heart: 'misc',
  hospital: 'misc',
  pill: 'research',
  stethoscope: 'research',
  ambulance: 'alert',
  lab: 'research',
  clipboard: 'clipboard',
  check: 'misc',
  warning: 'alert',
  attach: 'bookmark',
  calendar: 'event',
  wave: 'misc',
  star: 'star',
  idea: 'idea',
  '📣': 'announcement',
  '🧪': 'research',
  '📅': 'event',
  '✨': 'misc',
  '⭐': 'star',
  '🔖': 'bookmark',
  '⚠️': 'alert',
  '📋': 'clipboard',
  '🎯': 'target',
  '⚡': 'bolt',
  '💡': 'idea',
  '🛡️': 'shield',
};

export const normalizeCategoryForStorage = (category: string): 'Announcement' | 'Research' | 'Event' | 'Misc' => {
  if (category === 'Research') return 'Research';
  if (category === 'Event') return 'Event';
  if (category === 'Miscellaneous' || category === 'Misc') return 'Misc';
  return 'Announcement';
};

export const formatCategoryLabel = (category: string): string => {
  if (category === 'Misc' || category === 'Miscellaneous') return 'Miscellaneous';
  if (category === 'Research') return 'Research';
  if (category === 'Event') return 'Event';
  return 'Announcement';
};

export const normalizeCategoryForUi = (category: string): 'Announcement' | 'Research' | 'Event' | 'Miscellaneous' => {
  if (category === 'Research') return 'Research';
  if (category === 'Event') return 'Event';
  if (category === 'Misc' || category === 'Miscellaneous') return 'Miscellaneous';
  return 'Announcement';
};

export const getNewsCategoryRailClass = (category: string): string => {
  const normalized = normalizeCategoryForUi(category);
  if (normalized === 'Research') return 'bg-indigo-400/75';
  if (normalized === 'Event') return 'bg-emerald-400/75';
  if (normalized === 'Miscellaneous') return 'bg-slate-400/75';
  return 'bg-amber-400/75';
};

export const getNewsCategoryLabelClass = (category: string): string => {
  const normalized = normalizeCategoryForUi(category);
  if (normalized === 'Research') return 'text-indigo-300/90';
  if (normalized === 'Event') return 'text-emerald-300/90';
  if (normalized === 'Miscellaneous') return 'text-slate-300/90';
  return 'text-amber-300/90';
};

export const getNewsCategoryWatermarkClass = (category: string): string => {
  const normalized = normalizeCategoryForUi(category);
  if (normalized === 'Research') return 'bg-indigo-300/70';
  if (normalized === 'Event') return 'bg-emerald-300/70';
  if (normalized === 'Miscellaneous') return 'bg-slate-300/70';
  return 'bg-amber-300/70';
};

export const getNewsCategoryDefaultSymbolKey = (category: string): NewsSymbolKey => {
  const normalized = normalizeCategoryForUi(category);
  if (normalized === 'Research') return 'research';
  if (normalized === 'Event') return 'event';
  if (normalized === 'Miscellaneous') return 'misc';
  return 'announcement';
};

const normalizeSymbolKey = (value: string): NewsSymbolKey | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (NEWS_SYMBOL_KEY_SET.has(trimmed as NewsSymbolKey)) return trimmed as NewsSymbolKey;
  return LEGACY_ICON_TO_SYMBOL[trimmed] || null;
};

export const resolveNewsWatermarkSymbol = (icon: string | null | undefined, category: string): NewsSymbolKey => {
  if (!icon) return getNewsCategoryDefaultSymbolKey(category);
  const resolved = normalizeSymbolKey(icon);
  if (resolved) return resolved;
  return getNewsCategoryDefaultSymbolKey(category);
};

export const getNewsSymbolAssetPath = (symbolKey: NewsSymbolKey): string => `/news-symbols/${symbolKey}.svg`;

export const getNewsSymbolOptions = (): Array<{ key: NewsSymbolKey; label: string }> => NEWS_SYMBOL_OPTIONS;
