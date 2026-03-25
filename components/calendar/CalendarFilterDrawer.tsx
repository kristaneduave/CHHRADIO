import React from 'react';
import { EventType } from '../../types';
import InlinePillGroup from '../ui/InlinePillGroup';
import { CalendarFilterOption, CalendarScopeOption, CalendarViewScope, CalendarViewport } from './types';

interface CalendarFilterDrawerProps {
  isOpen: boolean;
  draftFilter: EventType | 'all';
  draftViewScope: CalendarViewScope;
  eventTypeOptions: CalendarFilterOption[];
  viewScopeOptions: CalendarScopeOption[];
  viewport: CalendarViewport;
  onDraftFilterChange: (value: EventType | 'all') => void;
  onDraftViewScopeChange: (value: CalendarViewScope) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}

const CalendarFilterDrawer: React.FC<CalendarFilterDrawerProps> = ({
  isOpen,
  draftFilter,
  draftViewScope,
  eventTypeOptions,
  viewScopeOptions,
  viewport,
  onDraftFilterChange,
  onDraftViewScopeChange,
  onReset,
  onApply,
  onClose,
}) => {
  const responsiveClass =
    viewport === 'desktop'
      ? 'max-w-[36rem]'
      : viewport === 'tablet'
        ? 'max-w-[42rem]'
        : 'max-w-none';

  return (
    <div
      id="calendar-filter-menu"
      className={`absolute inset-x-0 top-full mt-3 origin-top rounded-[2rem] border border-cyan-500/15 bg-[#06111b]/94 p-5 backdrop-blur-xl transition-all duration-200 z-50 ${responsiveClass} ${
        isOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95'
      }`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">Schedule filters</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">
            Filter the visible schedule without changing the underlying calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-slate-200"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-slate-300">Event type</label>
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
            <InlinePillGroup
              options={eventTypeOptions.map((option) => option.id)}
              value={draftFilter}
              onChange={(value) => onDraftFilterChange(value as EventType | 'all')}
              getLabel={(value) => eventTypeOptions.find((option) => option.id === value)?.label || value}
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-[11px] font-medium text-slate-300">View scope</span>
          <div className={`grid gap-2 ${viewport === 'mobile' ? 'grid-cols-1' : 'grid-cols-3'}`}>
            {viewScopeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onDraftViewScopeChange(option.id)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  draftViewScope === option.id
                    ? 'border-cyan-400/24 bg-cyan-500/10 text-cyan-100'
                    : 'border-white/10 bg-slate-900/50 text-slate-300 hover:bg-white/[0.04]'
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em]">{option.label}</div>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApply}
          className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CalendarFilterDrawer;
