import React from 'react';
import { CalendarEvent } from '../../types';
import { CalendarViewport } from './types';

interface CalendarAgendaCardProps {
  event: CalendarEvent;
  viewport: CalendarViewport;
  expandedEventId: string | null;
  canManage: boolean;
  eventTypeClassName: string;
  eventTypeLabel: string;
  onToggleActions: (eventId: string) => void;
  onEdit: () => void;
  onDelete: (e?: React.MouseEvent) => void;
}

const CalendarAgendaCard: React.FC<CalendarAgendaCardProps> = ({
  event,
  viewport,
  expandedEventId,
  canManage,
  eventTypeClassName,
  eventTypeLabel,
  onToggleActions,
  onEdit,
  onDelete,
}) => {
  const isDesktop = viewport === 'desktop';

  return (
    <div
      onClick={() => {
        if (canManage) onEdit();
      }}
      className={`event-card relative rounded-[1.4rem] border transition-all cursor-pointer p-4 mb-3 select-none touch-manipulation [-webkit-tap-highlight-color:transparent] ${
        expandedEventId === event.id
          ? 'border-white/14 bg-white/[0.07]'
          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
      }`}
    >
      <div className="relative z-10 flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-black/30 text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-md tracking-widest flex items-center gap-1.5">
              {event.is_all_day ? (
                <span>ALL DAY</span>
              ) : (
                <span>
                  {new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
                  {new Date(event.end_time || event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </span>

            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-[0.12em] ${eventTypeClassName}`}>
              {eventTypeLabel}
            </span>
          </div>

          {canManage ? (
            isDesktop ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-lg border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/[0.12]"
                >
                  Delete
                </button>
              </div>
            ) : (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onToggleActions(event.id)}
                  className="w-10 h-10 rounded-full bg-black/20 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
                  aria-label="Open event actions"
                >
                  <span className="material-icons text-[16px]">more_horiz</span>
                </button>

                {expandedEventId === event.id ? (
                  <div className="absolute right-0 top-11 z-20 min-w-[144px] rounded-xl border border-white/10 bg-[#101826] p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={onEdit}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
                    >
                      Edit event
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-500/15"
                    >
                      Delete event
                    </button>
                  </div>
                ) : null}
              </div>
            )
          ) : null}
        </div>

        <div className="flex flex-col gap-1 mt-1">
          <h4 className="text-[16px] md:text-[17px] font-bold text-white tracking-tight">
            {event.event_type === 'leave' ? event.title.replace(' - Leave', '') : event.title}
          </h4>

          {(event.creator || (event.coverage_details && event.coverage_details.length > 0)) ? (
            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 font-medium">
              {event.creator ? <span>Created by {event.creator.nickname || event.creator.full_name?.split(' ')[0]}</span> : null}
              {event.coverage_details && event.coverage_details.length > 0 ? (
                <span className="text-purple-400/80">
                  Coverage: {event.coverage_details.map((detail: any) => detail.name || detail.user?.full_name?.split(' ')[0]).join(', ')}
                </span>
              ) : null}
            </div>
          ) : null}

          {event.description ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{event.description}</p> : null}
        </div>
      </div>
    </div>
  );
};

export default CalendarAgendaCard;
