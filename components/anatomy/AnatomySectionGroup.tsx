import React from 'react';
import { AnatomyImageItem, AnatomySection } from '../../types';
import AnatomyImageCard from './AnatomyImageCard';

interface AnatomySectionGroupProps {
  section: AnatomySection;
  items: AnatomyImageItem[];
  onOpen: (itemId: string) => void;
}

const AnatomySectionGroup: React.FC<AnatomySectionGroupProps> = ({ section, items, onOpen }) => {
  return (
    <section className="space-y-4" aria-labelledby={`anatomy-section-${section.id}`}>
      <div className="space-y-1">
        <h2 id={`anatomy-section-${section.id}`} className="text-xl font-semibold text-white">
          {section.label}
        </h2>
        {section.description ? <p className="max-w-3xl text-sm text-slate-400">{section.description}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <AnatomyImageCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
};

export default AnatomySectionGroup;
