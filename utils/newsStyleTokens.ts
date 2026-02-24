import { normalizeCategoryForUi } from './newsPresentation';

export interface NewsCategoryStyleTokens {
  watermark: string;
  railTint: string;
  accentText: string;
}

export const NEWS_SURFACE_BASE_CLASS =
  'relative overflow-hidden glass-card-enhanced border border-border-default/70';

export const NEWS_SURFACE_INTERACTIVE_CLASS =
  'transition-all duration-200 hover:border-border-default hover:bg-white/[0.04]';

export const NEWS_ACTION_CHIP_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-border-default/70 bg-black/15 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.08]';

export const NEWS_ACTION_CHIP_DANGER_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/20';

export const getNewsCategoryStyleTokens = (category?: string | null): NewsCategoryStyleTokens => {
  const normalized = normalizeCategoryForUi(category || 'Announcement');
  if (normalized === 'Research') {
    return {
      watermark: 'bg-sky-300/90',
      railTint: 'bg-sky-300/45',
      accentText: 'text-sky-200',
    };
  }
  if (normalized === 'Event') {
    return {
      watermark: 'bg-emerald-300/90',
      railTint: 'bg-emerald-300/45',
      accentText: 'text-emerald-200',
    };
  }
  if (normalized === 'Miscellaneous') {
    return {
      watermark: 'bg-rose-300/90',
      railTint: 'bg-rose-300/45',
      accentText: 'text-rose-200',
    };
  }
  return {
    watermark: 'bg-amber-300/90',
    railTint: 'bg-amber-300/45',
    accentText: 'text-amber-200',
  };
};
