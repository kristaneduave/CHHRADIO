import React from 'react';
import { EventType } from '../../types';
import CalendarFilterDrawer from './CalendarFilterDrawer';
import { CalendarFilterOption, CalendarScopeOption, CalendarViewScope, CalendarViewport } from './types';

interface CalendarSearchBarProps {
  filterMenuRef: React.RefObject<HTMLDivElement | null>;
  searchQuery: string;
  isFilterMenuOpen: boolean;
  activeFilter: EventType | 'all';
  activeViewScope: CalendarViewScope;
  activeFilterChips: string[];
  draftFilter: EventType | 'all';
  draftViewScope: CalendarViewScope;
  eventTypeOptions: CalendarFilterOption[];
  viewScopeOptions: CalendarScopeOption[];
  viewport: CalendarViewport;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
  onDraftFilterChange: (value: EventType | 'all') => void;
  onDraftViewScopeChange: (value: CalendarViewScope) => void;
  onResetDraftFilters: () => void;
  onApplyFilters: () => void;
  onCloseFilters: () => void;
}

const CalendarSearchBar: React.FC<CalendarSearchBarProps> = ({
  filterMenuRef,
  searchQuery,
  isFilterMenuOpen,
  activeFilter,
  activeViewScope,
  activeFilterChips,
  draftFilter,
  draftViewScope,
  eventTypeOptions,
  viewScopeOptions,
  viewport,
  onSearchChange,
  onClearSearch,
  onToggleFilters,
  onClearFilters,
  onDraftFilterChange,
  onDraftViewScopeChange,
  onResetDraftFilters,
  onApplyFilters,
  onCloseFilters,
}) => {
  return (
    <div className="pt-1 pb-1 w-full">
      <div className="relative z-50 w-full" ref={filterMenuRef}>
        <div className="relative group flex bg-black/40 p-1.5 rounded-[1.4rem] border border-white/5 backdrop-blur-md transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
          <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[19px] text-slate-500 group-focus-within:text-primary transition-colors pointer-events-none">
            search
          </span>

          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search calendar events"
            className="w-full h-10 bg-transparent border-0 rounded-xl pl-[2.75rem] pr-[6rem] text-[13px] font-bold text-white placeholder-slate-500 focus:ring-0 focus:outline-none transition-all"
          />

          {searchQuery ? (
            <button
              onClick={onClearSearch}
              className="absolute right-[3rem] top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Clear search"
            >
              <span className="material-icons text-sm">close</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggleFilters}
            className={`absolute right-1.5 top-1.5 inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
              activeFilter !== 'all' || activeViewScope !== 'week'
                ? 'bg-primary text-white shadow-[0_4px_12px_rgba(13,162,231,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            aria-label={isFilterMenuOpen ? 'Close schedule filters' : 'Open schedule filters'}
            aria-expanded={isFilterMenuOpen}
            aria-controls="calendar-filter-menu"
          >
            <span className="material-icons text-[18px]">tune</span>
          </button>
        </div>

        {activeFilterChips.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeFilterChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300"
              >
                {chip}
              </span>
            ))}
            {activeFilter !== 'all' || activeViewScope !== 'week' ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-500/15"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        <CalendarFilterDrawer
          isOpen={isFilterMenuOpen}
          draftFilter={draftFilter}
          draftViewScope={draftViewScope}
          eventTypeOptions={eventTypeOptions}
          viewScopeOptions={viewScopeOptions}
          viewport={viewport}
          onDraftFilterChange={onDraftFilterChange}
          onDraftViewScopeChange={onDraftViewScopeChange}
          onReset={onResetDraftFilters}
          onApply={onApplyFilters}
          onClose={onCloseFilters}
        />
      </div>
    </div>
  );
};

export default CalendarSearchBar;
