import React from 'react';
import { CalendarEvent } from '../../types';
import EmptyState from '../EmptyState';
import CalendarAgendaCard from './CalendarAgendaCard';
import { CalendarViewScope, CalendarViewport } from './types';

interface CalendarSchedulePanelProps {
  panelClass: string;
  viewport: CalendarViewport;
  fetchError: string;
  searchError: string;
  agendaHeaderTitle: string;
  agendaHeaderDescription: string;
  agendaEvents: CalendarEvent[];
  selectedDateLabel: string;
  selectedDateButtonLabel: string;
  isSearchMode: boolean;
  isPrivilegedCalendarManager: boolean;
  activeFilterLabel: string;
  activeViewScope: CalendarViewScope;
  expandedEventId: string | null;
  onAddEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent, e?: React.MouseEvent) => void;
  onToggleActions: (eventId: string) => void;
  canManageEvent: (event: CalendarEvent) => boolean;
  formatEventTypeLabel: (type: any) => string;
  eventTypeStyles: Record<string, string>;
}

const CalendarSchedulePanel: React.FC<CalendarSchedulePanelProps> = ({
  panelClass,
  viewport,
  fetchError,
  searchError,
  agendaHeaderTitle,
  agendaHeaderDescription,
  agendaEvents,
  selectedDateLabel,
  selectedDateButtonLabel,
  isSearchMode,
  isPrivilegedCalendarManager,
  activeFilterLabel,
  activeViewScope,
  expandedEventId,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleActions,
  canManageEvent,
  formatEventTypeLabel,
  eventTypeStyles,
}) => {
  return (
    <section data-testid="calendar-schedule-panel" className={`${panelClass} p-5 md:p-6 flex flex-col min-h-[28rem] xl:min-h-[36rem]`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="mt-2 text-[1.45rem] md:text-[1.55rem] font-black tracking-tight text-white">{agendaHeaderTitle}</h2>
        </div>

      </div>

      <div className={`space-y-3 flex-1 ${viewport === 'desktop' ? 'overflow-y-auto custom-scrollbar pr-2 pb-4' : ''}`}>
        {fetchError ? (
          <div className="mb-2">
            <EmptyState icon="error_outline" title="Could not load events" description={fetchError} compact />
          </div>
        ) : null}

        {searchError ? (
          <div className="mb-2">
            <EmptyState icon="search_off" title="Search failed" description={searchError} compact />
          </div>
        ) : null}

        {!fetchError && !searchError && agendaEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-8">
            <EmptyState
              icon="event_busy"
              title={
                isSearchMode
                  ? 'No search matches'
                  : activeFilterLabel !== 'All events'
                    ? `No ${activeFilterLabel.toLowerCase()} found`
                    : activeViewScope === 'week'
                      ? 'No events this week'
                      : activeViewScope === 'upcoming'
                        ? 'No upcoming events'
                        : 'No events on this day'
              }
              description={
                isSearchMode
                  ? 'Try another search term or clear the search to browse the schedule.'
                  : activeViewScope === 'week'
                    ? 'There are no scheduled activities in the selected week.'
                    : activeViewScope === 'upcoming'
                      ? 'There are no scheduled activities coming up right now.'
                      : `Nothing is scheduled for ${selectedDateLabel}.`
              }
              compact
            />
          </div>
        ) : null}

        {agendaEvents.map((event) => (
          <CalendarAgendaCard
            key={event.id}
            event={event}
            viewport={viewport}
            expandedEventId={expandedEventId}
            canManage={canManageEvent(event)}
            eventTypeClassName={eventTypeStyles[event.event_type] || eventTypeStyles.leave}
            eventTypeLabel={formatEventTypeLabel(event.event_type)}
            onToggleActions={onToggleActions}
            onEdit={() => onEditEvent(event)}
            onDelete={(e) => onDeleteEvent(event, e)}
          />
        ))}
      </div>
    </section>
  );
};

export default CalendarSchedulePanel;
