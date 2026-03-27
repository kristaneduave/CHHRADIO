import React from 'react';
import { createPortal } from 'react-dom';
import { AnatomyImageItem, AnatomySection } from '../../types';

interface AnatomyImageViewerProps {
  items: AnatomyImageItem[];
  activeIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
  sectionsById: Map<string, AnatomySection>;
}

const AnatomyImageViewer: React.FC<AnatomyImageViewerProps> = ({
  items,
  activeIndex,
  isOpen,
  onClose,
  onNavigate,
  sectionsById,
}) => {
  const [failedImageIds, setFailedImageIds] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (items.length > 1 && event.key === 'ArrowLeft') {
        onNavigate(activeIndex === 0 ? items.length - 1 : activeIndex - 1);
      }
      if (items.length > 1 && event.key === 'ArrowRight') {
        onNavigate(activeIndex === items.length - 1 ? 0 : activeIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.dispatchEvent(new CustomEvent('radcore-bottom-nav-visibility', { detail: { hidden: true } }));

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.dispatchEvent(new CustomEvent('radcore-bottom-nav-visibility', { detail: { hidden: false } }));
    };
  }, [activeIndex, isOpen, items.length, onClose, onNavigate]);

  React.useEffect(() => {
    if (!isOpen) {
      setFailedImageIds({});
    }
  }, [isOpen]);

  if (!isOpen || !items.length || typeof document === 'undefined') {
    return null;
  }

  const item = items[activeIndex];
  if (!item) {
    return null;
  }

  const sectionLabel = sectionsById.get(item.section)?.label || item.section;
  const imageFailed = Boolean(failedImageIds[item.id]);
  const hasExternalAlbum = Boolean(item.externalUrl);

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-slate-950/95" onClick={onClose} role="dialog" aria-modal="true" aria-label="Anatomy image viewer">
      <div className="flex h-full w-full flex-col">
        <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6" onClick={(event) => event.stopPropagation()}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">{sectionLabel}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{item.title}</h2>
            {item.subtitle ? <p className="mt-1 text-sm text-slate-300">{item.subtitle}</p> : null}
            {item.caption ? <p className="mt-2 max-w-2xl text-sm text-slate-400">{item.caption}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
              {activeIndex + 1}/{items.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100"
              aria-label="Close anatomy image viewer"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-6" onClick={(event) => event.stopPropagation()}>
          <div className="relative flex h-full w-full max-w-6xl items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-black/40">
            {hasExternalAlbum ? (
              <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-4 bg-slate-950/95 px-6 text-center">
                <span className="material-icons text-[36px] text-cyan-300">photo_library</span>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-white">External teaching album</p>
                  <p className="max-w-lg text-sm leading-6 text-slate-400">
                    This anatomy set is hosted as a Google Photos album. Open it in a new tab to browse the full axial PD FS series.
                  </p>
                </div>
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-200/50 hover:bg-cyan-400/15"
                >
                  <span>{item.externalLabel || 'Open external album'}</span>
                  <span className="material-icons text-[18px]">open_in_new</span>
                </a>
              </div>
            ) : imageFailed ? (
              <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 bg-slate-950/95 text-center">
                <span className="material-icons text-[36px] text-slate-500">broken_image</span>
                <p className="text-base font-semibold text-white">Image unavailable</p>
                <p className="max-w-sm text-sm text-slate-400">
                  The full-size anatomy image could not be loaded, but you can continue browsing the gallery.
                </p>
              </div>
            ) : (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="max-h-full max-w-full object-contain"
                onError={() => setFailedImageIds((current) => ({ ...current, [item.id]: true }))}
              />
            )}

            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate(activeIndex === 0 ? items.length - 1 : activeIndex - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white backdrop-blur-sm"
                  aria-label="Previous anatomy image"
                >
                  <span className="material-icons text-[20px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(activeIndex === items.length - 1 ? 0 : activeIndex + 1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white backdrop-blur-sm"
                  aria-label="Next anatomy image"
                >
                  <span className="material-icons text-[20px]">chevron_right</span>
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AnatomyImageViewer;
