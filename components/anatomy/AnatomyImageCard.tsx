import React from 'react';
import { AnatomyImageItem } from '../../types';

interface AnatomyImageCardProps {
  item: AnatomyImageItem;
  onOpen: (itemId: string) => void;
}

const AnatomyImageCard: React.FC<AnatomyImageCardProps> = ({ item, onOpen }) => {
  const [thumbnailFailed, setThumbnailFailed] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="group overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.035] text-left transition-transform hover:-translate-y-0.5 hover:border-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
      aria-label={`Open ${item.title}`}
    >
      <div className="relative h-56 overflow-hidden bg-slate-950/80">
        {thumbnailFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-950/90 text-center">
            <span className="material-icons text-[30px] text-slate-500">broken_image</span>
            <p className="text-sm font-semibold text-slate-200">Image unavailable</p>
          </div>
        ) : (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
            onError={() => setThumbnailFailed(true)}
          />
        )}

        {item.modality ? (
          <span className="absolute left-3 top-3 rounded-full border border-black/10 bg-black/45 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md">
            {item.modality}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">{item.title}</h3>
          {item.subtitle ? <p className="text-sm text-slate-300">{item.subtitle}</p> : null}
          {item.caption ? <p className="text-sm leading-6 text-slate-400">{item.caption}</p> : null}
        </div>

        {!!item.tags?.length && (
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
};

export default AnatomyImageCard;
