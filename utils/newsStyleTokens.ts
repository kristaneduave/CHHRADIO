import { normalizeCategoryForUi } from './newsPresentation';

export interface NewsCategoryStyleTokens {
  watermark: string;
  railTint: string;
  accentText: string;
  iconContainer: string;
  iconText: string;
  badgeClass: string;
}

export const NEWS_SURFACE_BASE_CLASS =
  'relative overflow-hidden glass-card-enhanced border border-border-default/70 bg-white/[0.02]';

export const NEWS_SURFACE_INTERACTIVE_CLASS =
  'transition-all duration-300 hover:border-white/10 hover:bg-white/[0.05]';

export const NEWS_ACTION_CHIP_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-border-default/70 bg-surface/40 px-3 py-1.5 text-[11px] font-medium text-text-primary transition-colors hover:bg-surface-alt/70';

export const NEWS_ACTION_CHIP_DANGER_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/20';

export const getNewsCategoryStyleTokens = (category?: string | null): NewsCategoryStyleTokens => {
  const normalized = normalizeCategoryForUi(category || 'Announcement');
  if (normalized === 'Research') {
    return {
      watermark: 'bg-sky-300/90',
      railTint: 'bg-sky-300/45',
      accentText: 'text-sky-200',
      iconContainer: 'bg-sky-500/15 border-sky-500/35',
      iconText: 'text-sky-300',
      badgeClass: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    };
  }
  if (normalized === 'Event') {
    return {
      watermark: 'bg-emerald-300/90',
      railTint: 'bg-emerald-300/45',
      accentText: 'text-emerald-200',
      iconContainer: 'bg-emerald-500/15 border-emerald-500/35',
      iconText: 'text-emerald-300',
      badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    };
  }
  if (normalized === 'Miscellaneous') {
    return {
      watermark: 'bg-[#EBC7A4]/90',
      railTint: 'bg-[#A95F3B]/45',
      accentText: 'text-[#EBC7A4]',
      iconContainer: 'bg-[#A95F3B]/15 border-[#A95F3B]/35',
      iconText: 'text-[#EBC7A4]',
      badgeClass: 'bg-[#A95F3B]/10 border-[#A95F3B]/30 text-[#EBC7A4]',
    };
  }
  return {
    watermark: 'bg-amber-300/90',
    railTint: 'bg-amber-300/45',
    accentText: 'text-amber-200',
    iconContainer: 'bg-amber-500/15 border-amber-500/35',
    iconText: 'text-amber-300',
    badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  };
};
