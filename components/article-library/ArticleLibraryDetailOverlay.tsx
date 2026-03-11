import React from 'react';
import { createPortal } from 'react-dom';

interface DetailSectionNavItem {
  id: string;
  label: string;
}

interface ArticleLibraryDetailOverlayProps {
  overlayRoot: HTMLElement | null;
  isDesktopDetail: boolean;
  isMobileDetailOpen: boolean;
  hasSelectedItem: boolean;
  detailTitle: string;
  detailSections: DetailSectionNavItem[];
  activeSectionId: string | null;
  effectiveDateLabel: string | null;
  hasDetailSource: boolean;
  detailSourceHref: string;
  sectionNavRef: React.RefObject<HTMLDivElement | null>;
  scrollToSection: (sectionId: string) => void;
  scrollToTopOfDetail: () => void;
  handleCloseDetail: () => void;
  setDesktopDetailScrollNode: (node: HTMLDivElement | null) => void;
  setMobileDetailScrollNode: (node: HTMLDivElement | null) => void;
  detailPanel: React.ReactNode;
}

const ArticleLibraryDetailOverlay: React.FC<ArticleLibraryDetailOverlayProps> = ({
  overlayRoot,
  isDesktopDetail,
  isMobileDetailOpen,
  hasSelectedItem,
  detailTitle,
  detailSections,
  activeSectionId,
  effectiveDateLabel,
  hasDetailSource,
  detailSourceHref,
  sectionNavRef,
  scrollToSection,
  scrollToTopOfDetail,
  handleCloseDetail,
  setDesktopDetailScrollNode,
  setMobileDetailScrollNode,
  detailPanel,
}) => {
  if (!overlayRoot) return null;

  if (isDesktopDetail && hasSelectedItem) {
    return createPortal(
      <div
        className="fixed inset-0 z-[160] hidden items-center justify-center bg-[#020611]/88 px-6 py-6 backdrop-blur-md xl:flex"
        onClick={(event) => {
          if (event.target === event.currentTarget) handleCloseDetail();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Guide details"
          className="relative z-10 flex h-[min(92vh,1040px)] w-[min(1100px,calc(100vw-5rem))] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#06101a]/[0.985] shadow-[0_36px_110px_rgba(0,0,0,0.62)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative bg-[#091524]/96 px-6 py-5 shadow-[0_12px_28px_rgba(2,8,18,0.22)] backdrop-blur-xl">
            <button
              type="button"
              onClick={handleCloseDetail}
              className="absolute right-6 top-5 inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/12 text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
              aria-label="Close guide details"
            >
              <span className="material-icons text-[20px]">close</span>
            </button>
            <div className="min-w-0 pr-16">
              <h2 className="mx-auto max-w-none whitespace-nowrap text-center text-[1.8rem] font-black leading-[1.06] tracking-[-0.03em] text-white">
                {detailTitle}
              </h2>
              {effectiveDateLabel ? (
                <p className="mt-2 text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{effectiveDateLabel}</p>
              ) : null}
            </div>
            {detailSections.length ? (
              <div ref={sectionNavRef} className="mt-4 flex items-center justify-center gap-3">
                <label className="min-w-0 flex-[0_1_32%] rounded-xl border border-white/5 bg-black/40 p-[3px] shadow-inner backdrop-blur-md transition focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                  <span className="sr-only">Jump to section</span>
                  <select
                    value={activeSectionId || detailSections[0]?.id || ''}
                    onChange={(event) => scrollToSection(event.target.value)}
                    className="h-[40px] w-full appearance-none rounded-[0.85rem] border-0 bg-transparent px-4 text-[13px] font-bold text-white outline-none focus:ring-0"
                    aria-label="Jump to section"
                    style={{ colorScheme: 'dark' }}
                  >
                    {detailSections.map((section) => (
                      <option key={section.id} value={section.id} className="bg-slate-950 text-white">
                        {section.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={scrollToTopOfDetail}
                  className="shrink-0 rounded-xl border border-cyan-300/25 bg-cyan-400/12 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Top
                </button>
                {hasDetailSource ? (
                  <a
                    href={detailSourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/12 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  >
                    <span className="material-icons text-[18px]" aria-hidden="true">article</span>
                    <span>Read full</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/14 bg-cyan-400/[0.05] px-4 py-3 text-sm font-semibold text-cyan-50/45 opacity-70"
                    aria-label="Read full article"
                  >
                    <span className="material-icons text-[18px]" aria-hidden="true">article</span>
                    <span>Read full</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
          <div ref={setDesktopDetailScrollNode} className="flex-1 overflow-y-auto px-6 pb-6 pt-0">
            {detailPanel}
          </div>
        </div>
      </div>,
      overlayRoot,
    );
  }

  if (!isDesktopDetail && isMobileDetailOpen && hasSelectedItem) {
    return createPortal(
      <div
        className="fixed inset-0 z-[160] h-[100dvh] bg-app/88 backdrop-blur-sm xl:hidden"
        onClick={(event) => {
          if (event.target === event.currentTarget) handleCloseDetail();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Guide details"
          className="absolute inset-0 flex h-[100dvh] flex-col bg-app"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-20 bg-app/92 px-4 py-3 shadow-[0_12px_28px_rgba(2,8,18,0.22)] backdrop-blur-xl">
            <div className="min-w-0">
              <h2 className="mx-auto max-w-full text-center text-[1.4rem] font-black leading-[1.08] tracking-[-0.03em] text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden text-balance">
                {detailTitle}
              </h2>
            </div>
            {detailSections.length ? (
              <div ref={sectionNavRef} className="mt-3 flex items-center gap-2">
                <label className="min-w-0 flex-[0_1_56%] rounded-xl border border-white/5 bg-black/40 p-[3px] shadow-inner backdrop-blur-md transition focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                  <span className="sr-only">Jump to section</span>
                  <select
                    value={activeSectionId || detailSections[0]?.id || ''}
                    onChange={(event) => scrollToSection(event.target.value)}
                    className="h-[40px] w-full appearance-none rounded-[0.85rem] border-0 bg-transparent px-4 text-[13px] font-bold text-white outline-none focus:ring-0"
                    aria-label="Jump to section"
                    style={{ colorScheme: 'dark' }}
                  >
                    {detailSections.map((section) => (
                      <option key={section.id} value={section.id} className="bg-slate-950 text-white">
                        {section.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={scrollToTopOfDetail}
                  className="shrink-0 rounded-xl border border-cyan-300/25 bg-cyan-400/12 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Top
                </button>
                {hasDetailSource ? (
                  <a
                    href={detailSourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/12 px-3 py-3 text-[11px] font-semibold text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    aria-label="Read full article"
                  >
                    <span className="material-icons text-[16px]" aria-hidden="true">article</span>
                    <span>Read full</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/14 bg-cyan-400/[0.05] px-3 py-3 text-[11px] font-semibold text-cyan-50/45 opacity-70"
                    aria-label="Read full article"
                  >
                    <span className="material-icons text-[16px]" aria-hidden="true">article</span>
                    <span>Read full</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/12 text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  aria-label="Close guide details"
                >
                  <span className="material-icons text-[20px]">close</span>
                </button>
              </div>
            ) : null}
          </div>
          <div ref={setMobileDetailScrollNode} className="flex-1 overflow-y-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
            <div className="space-y-6">{detailPanel}</div>
          </div>
        </div>
      </div>,
      overlayRoot,
    );
  }

  return null;
};

export default ArticleLibraryDetailOverlay;
