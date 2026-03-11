import React from 'react';
import { EventType } from '../../types';
import CalendarWeekStrip from './CalendarWeekStrip';
import { CalendarViewport, CalendarWeekDayMeta } from './types';

interface CalendarMonthNavigatorProps {
  panelClass: string;
  controlPillClass: string;
  monthIndex: number;
  monthLabel: string;
  monthYearLabel: string;
  year: number;
  days: number[];
  padding: null[];
  eventDotColors: Record<EventType, string>;
  weekRangeLabel: string;
  weekDayMeta: CalendarWeekDayMeta[];
  isWeekDrawerOpen: boolean;
  viewport: CalendarViewport;
  getEventTypesForDay: (day: number) => EventType[];
  isSelected: (day: number) => boolean;
  isToday: (day: number) => boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onHideWeekStrip: () => void;
  onShowWeekStrip: () => void;
}

const CalendarMonthNavigator: React.FC<CalendarMonthNavigatorProps> = ({
  panelClass,
  controlPillClass,
  monthIndex,
  monthLabel,
  monthYearLabel,
  year,
  days,
  padding,
  eventDotColors,
  weekRangeLabel,
  weekDayMeta,
  isWeekDrawerOpen,
  viewport,
  getEventTypesForDay,
  isSelected,
  isToday,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onHideWeekStrip,
  onShowWeekStrip,
}) => {
  return (
    <section data-testid="calendar-month-panel" className={`${panelClass} p-5 md:p-6 h-full flex flex-col`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">
            {monthLabel} <span className="font-medium text-slate-500">{year}</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={onToday}
          className="shrink-0 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
        >
          Today
        </button>
      </div>

      <div className={`${controlPillClass} mb-5 flex items-center justify-between`}>
        <button
          onClick={onPrevMonth}
          className="h-10 w-10 rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Previous month"
        >
          <span className="material-icons text-[20px]">chevron_left</span>
        </button>

        <div className="text-sm font-bold tracking-tight text-white">{monthYearLabel}</div>

        <button
          onClick={onNextMonth}
          className="h-10 w-10 rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Next month"
        >
          <span className="material-icons text-[20px]">chevron_right</span>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-3">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dayName) => (
          <div key={dayName} className="text-center text-[10px] font-bold text-slate-500 tracking-[0.16em] py-2">
            {dayName}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-2 gap-x-1 content-start">
        {padding.map((_, index) => (
          <div key={`p-${index}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const dotTypes = getEventTypesForDay(day);
          const isActive = isSelected(day);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day}
              onClick={() => onSelectDate(new Date(year, monthIndex, day))}
              className={`relative aspect-square rounded-2xl border transition ${isActive
                  ? 'border-cyan-400/28 bg-cyan-500/12 text-white'
                  : isCurrentDay
                    ? 'border-cyan-400/24 bg-transparent text-cyan-100 hover:bg-white/[0.03]'
                    : 'border-transparent text-slate-200 hover:border-white/10 hover:bg-white/[0.03]'
                }`}
              aria-label={`Select ${monthLabel} ${day}, ${year}`}
            >
              <div className="flex h-full flex-col items-center justify-center">
                <span className={`text-[15px] leading-none ${isActive || isCurrentDay ? 'font-bold' : 'font-medium'}`}>{day}</span>
                <div className="mt-2 flex min-h-[6px] items-center justify-center gap-[3px] px-1">
                  {dotTypes.slice(0, 3).map((type) => (
                    <span
                      key={type}
                      className={`w-[4px] h-[4px] rounded-full ${isActive ? 'bg-white' : eventDotColors[type] || 'bg-slate-400'}`}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 min-h-[108px]">
        <div className={`overflow-hidden transition-all duration-200 ${isWeekDrawerOpen ? 'max-h-[240px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <CalendarWeekStrip
            weekRangeLabel={weekRangeLabel}
            weekDayMeta={weekDayMeta}
            viewport={viewport}
            onPrevWeek={onPrevWeek}
            onNextWeek={onNextWeek}
            onSelectDate={onSelectDate}
            onHide={viewport === 'desktop' ? undefined : onHideWeekStrip}
          />
        </div>
        {!isWeekDrawerOpen ? (
          <button
            type="button"
            onClick={onShowWeekStrip}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.04]"
          >
            Show week strip
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default CalendarMonthNavigator;
