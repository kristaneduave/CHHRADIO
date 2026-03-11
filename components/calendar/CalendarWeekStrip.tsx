import React from 'react';
import { CalendarWeekDayMeta, CalendarViewport } from './types';

interface CalendarWeekStripProps {
  weekRangeLabel: string;
  weekDayMeta: CalendarWeekDayMeta[];
  viewport: CalendarViewport;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectDate: (date: Date) => void;
  onHide?: () => void;
}

const CalendarWeekStrip: React.FC<CalendarWeekStripProps> = ({
  weekRangeLabel,
  weekDayMeta,
  viewport,
  onPrevWeek,
  onNextWeek,
  onSelectDate,
  onHide,
}) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Week strip</span>
          <p className="mt-1 text-xs text-slate-500">{weekRangeLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevWeek}
            className="w-8 h-8 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            aria-label="Previous week"
          >
            <span className="material-icons text-[18px]">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            className="w-8 h-8 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            aria-label="Next week"
          >
            <span className="material-icons text-[18px]">chevron_right</span>
          </button>
          {viewport !== 'desktop' && onHide ? (
            <button
              type="button"
              onClick={onHide}
              className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Hide week strip"
            >
              Hide
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <div className={`flex gap-2 ${viewport === 'desktop' ? 'min-w-0' : 'min-w-[560px]'}`}>
          {weekDayMeta.map((dayMeta) => (
            <button
              key={dayMeta.date.toISOString()}
              type="button"
              onClick={() => onSelectDate(new Date(dayMeta.date))}
              className={`flex-1 min-w-[76px] rounded-xl border px-3 py-3 text-left transition-all ${
                dayMeta.isSelected
                  ? 'border-cyan-400/24 bg-cyan-500/10 text-white'
                  : dayMeta.isToday
                    ? 'border-cyan-400/18 bg-white/[0.02] text-cyan-100'
                    : 'bg-black/25 border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase">{dayMeta.label}</div>
              <div className="mt-1 text-lg font-bold">{dayMeta.date.getDate()}</div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    dayMeta.count > 0 ? (dayMeta.isSelected ? 'bg-white' : 'bg-cyan-300') : 'bg-slate-600'
                  }`}
                />
                <span>
                  {dayMeta.count} event{dayMeta.count === 1 ? '' : 's'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarWeekStrip;
