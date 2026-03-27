import React from 'react';
import { AnatomySection } from '../../types';

interface AnatomyFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  selectedSectionId: string;
  onSectionChange: (sectionId: string) => void;
  sections: AnatomySection[];
}

const AnatomyFilterBar: React.FC<AnatomyFilterBarProps> = ({
  query,
  onQueryChange,
  selectedSectionId,
  onSectionChange,
  sections,
}) => {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Search atlas
        </span>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
          <span className="material-icons text-[20px] text-cyan-200/80">search</span>
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search anatomy, modality, or keyword..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            aria-label="Search anatomy gallery"
          />
        </div>
      </label>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Sections</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSectionChange('all')}
            aria-pressed={selectedSectionId === 'all'}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
              selectedSectionId === 'all'
                ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-100'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white'
            }`}
          >
            All
          </button>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              aria-pressed={selectedSectionId === section.id}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                selectedSectionId === section.id
                  ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnatomyFilterBar;
