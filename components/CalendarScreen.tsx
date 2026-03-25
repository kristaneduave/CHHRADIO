import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarEvent, EventType, UserRole } from '../types';
import { CalendarService } from '../services/CalendarService';
import { supabase } from '../services/supabase';
import { createSystemNotification, fetchAllRecipientUserIds } from '../services/newsfeedService';
import { canManageCalendar, getCapabilitySet, hasRole } from '../utils/roles';
import { buildEventDateTimeRange, formatWeekRange, getWeekDays, getWeekStart, isSameDay, toLocalDateInputValue } from '../utils/calendarView';
import { toastError, toastSuccess } from '../utils/toast';
import TopRightCreateAction from './TopRightCreateAction';
import CalendarSearchBar from './calendar/CalendarSearchBar';
import CalendarMonthNavigator from './calendar/CalendarMonthNavigator';
import CalendarSchedulePanel from './calendar/CalendarSchedulePanel';
import CalendarEventModal from './calendar/CalendarEventModal';
import { CalendarViewScope, CalendarViewport } from './calendar/types';
import { getAppViewport } from './responsive/useViewport';
import { getCachedCalendarWorkspace } from '../services/calendarWorkspaceService';
import ScreenStatusNotice from './ui/ScreenStatusNotice';
import PageHeader from './ui/PageHeader';
import PageShell from './ui/PageShell';
import { getCurrentUserRoleState } from '../services/userRoleService';

type ValidationErrors = {
  title?: string;
  date?: string;
  time?: string;
};

const EVENT_TYPE_OPTIONS: Array<{ id: EventType | 'all'; label: string }> = [
  { id: 'all', label: 'All events' },
  { id: 'leave', label: 'Leaves' },
  { id: 'exam', label: 'Exams' },
  { id: 'lecture', label: 'Lectures' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'pcr', label: 'PCR' },
  { id: 'pickleball', label: 'Pickleball' },
];

const VIEW_SCOPE_OPTIONS: Array<{ id: CalendarViewScope; label: string; description: string }> = [
  { id: 'week', label: 'This week', description: 'Show the selected week in the schedule.' },
  { id: 'selected', label: 'Selected day', description: 'Focus only on the selected date.' },
  { id: 'upcoming', label: 'Upcoming', description: 'Show the next scheduled events across dates.' },
];

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatEventTypeLabel = (type: EventType | 'all') => {
  if (type === 'all') return 'All events';
  if (type === 'pcr') return 'PCR';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const getCalendarViewport = (): CalendarViewport => {
  return getAppViewport();
};

const CalendarScreen: React.FC = () => {
  const cachedWorkspace = getCachedCalendarWorkspace();
  const [viewport, setViewport] = useState<CalendarViewport>(getCalendarViewport);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(cachedWorkspace?.events || []);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>(cachedWorkspace?.upcomingEvents || []);
  const [fetchError, setFetchError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<EventType | 'all'>('all');
  const [activeViewScope, setActiveViewScope] = useState<CalendarViewScope>('week');
  const [searchResults, setSearchResults] = useState<CalendarEvent[]>([]);
  const [searchError, setSearchError] = useState('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<EventType | 'all'>('all');
  const [draftViewScope, setDraftViewScope] = useState<CalendarViewScope>('week');
  const [isWeekDrawerOpen, setIsWeekDrawerOpen] = useState(() => getCalendarViewport() !== 'mobile');
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [newEventStartDate, setNewEventStartDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('08:00');
  const [newEventEndTime, setNewEventEndTime] = useState('17:00');
  const [newEventType, setNewEventType] = useState<EventType>('leave');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [assignedToName, setAssignedToName] = useState('');
  const [coverageDetails, setCoverageDetails] = useState<{ user_id: string; name: string; modalities: string[] }[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [currentUserId, setCurrentUserId] = useState(cachedWorkspace?.currentUserId || '');
  const [userRoles, setUserRoles] = useState<UserRole[]>(cachedWorkspace?.userRoles || ['resident']);
  const isMountedRef = useRef(true);
  const eventsFetchSeqRef = useRef(0);
  const searchSeqRef = useRef(0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => index + 1);
  const padding = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);

  const eventTypeColors: Record<EventType, string> = {
    leave: 'bg-rose-600 text-white border-2 border-rose-400/50 shadow-[0_0_15px_rgba(225,29,72,0.4)]',
    meeting: 'bg-blue-500 text-white border border-blue-400/30',
    lecture: 'bg-purple-500 text-white border border-purple-400/30',
    exam: 'bg-yellow-500 text-white border border-yellow-400/30',
    pickleball: 'bg-emerald-500 text-white border border-emerald-400/30',
    rotation: 'bg-indigo-500 text-white',
    call: 'bg-red-500 text-white',
    pcr: 'bg-cyan-500 text-white border border-cyan-400/30',
  };

  const eventDotColors: Record<EventType, string> = {
    leave: 'bg-rose-500',
    meeting: 'bg-blue-500',
    lecture: 'bg-purple-500',
    exam: 'bg-yellow-500',
    pickleball: 'bg-emerald-500',
    rotation: 'bg-indigo-500',
    call: 'bg-red-500',
    pcr: 'bg-cyan-500',
  };

  const eventTypeStyles: Record<string, string> = {
    rotation: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20',
    call: 'bg-red-500/20 text-red-400 border-red-500/20',
    lecture: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    exam: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    leave: 'bg-rose-500/20 text-rose-400 border-rose-500/20',
    meeting: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    pickleball: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
    pcr: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  };

  const weekStartDate = useMemo(() => getWeekStart(selectedDate, true), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(selectedDate, true), [selectedDate]);
  const weekEndDate = useMemo(() => {
    const end = new Date(weekStartDate);
    end.setDate(weekStartDate.getDate() + 6);
    return end;
  }, [weekStartDate]);
  const weekRangeLabel = formatWeekRange(weekStartDate, weekEndDate);

  const toDayStart = (date: Date) => {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  };

  const toDayEnd = (date: Date) => {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  };

  const eventOverlapsRange = (event: CalendarEvent, start: Date, end: Date) => {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time || event.start_time);
    return eventStart <= end && eventEnd >= start;
  };

  const setSelectedDateAndSyncMonth = (date: Date) => {
    setSelectedDate(date);
    if (date.getMonth() !== currentDate.getMonth() || date.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const fetchEvents = async () => {
    const seq = ++eventsFetchSeqRef.current;
    setFetchError('');
    try {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const data = await CalendarService.getEvents(start, end);
      let mergedData = data;

      if ((isWeekDrawerOpen || activeViewScope === 'week') && (weekStartDate < start || weekEndDate > end)) {
        const spillStart = weekStartDate < start ? weekStartDate : start;
        const spillEnd = weekEndDate > end ? weekEndDate : end;
        const spillData = await CalendarService.getEvents(spillStart, spillEnd);
        const byId = new Map<string, CalendarEvent>();
        [...data, ...spillData].forEach((item) => byId.set(item.id, item));
        mergedData = Array.from(byId.values()).sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        );
      }

      if (!isMountedRef.current || seq !== eventsFetchSeqRef.current) return;
      setEvents(mergedData);

      const upcoming = await CalendarService.getUpcomingEvents(10);
      if (!isMountedRef.current || seq !== eventsFetchSeqRef.current) return;
      setUpcomingEvents(upcoming);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      setFetchError(error?.message || 'Unable to load calendar events.');
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [activeViewScope, currentDate, selectedDate, isWeekDrawerOpen]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const desktopQuery = window.matchMedia('(min-width: 1280px)');
    const tabletQuery = window.matchMedia('(min-width: 768px)');
    const syncViewport = () => {
      const nextViewport = getCalendarViewport();
      setViewport(nextViewport);
      if (nextViewport === 'desktop') setIsWeekDrawerOpen(true);
    };

    syncViewport();
    desktopQuery.addEventListener('change', syncViewport);
    tabletQuery.addEventListener('change', syncViewport);
    return () => {
      desktopQuery.removeEventListener('change', syncViewport);
      tabletQuery.removeEventListener('change', syncViewport);
    };
  }, []);

  useEffect(() => {
    const loadCurrentUserRole = async () => {
      if (cachedWorkspace) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const roleState = await getCurrentUserRoleState();
      if (roleState) {
        setUserRoles(roleState.roles);
      }
    };
    loadCurrentUserRole();
  }, [cachedWorkspace]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        const seq = ++searchSeqRef.current;
        setSearchError('');
        try {
          const results = await CalendarService.searchEvents(searchQuery);
          if (!isMountedRef.current || seq !== searchSeqRef.current) return;
          setSearchResults(results);
        } catch (error: any) {
          console.error('Search error', error);
          setSearchError(error?.message || 'Unable to search calendar events.');
        }
      } else {
        setSearchResults([]);
        setSearchError('');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isFilterMenuOpen) return;

    setDraftFilter(activeFilter);
    setDraftViewScope(activeViewScope);

    const handleFilterClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleFilterClickOutside);
    return () => document.removeEventListener('mousedown', handleFilterClickOutside);
  }, [activeFilter, activeViewScope, isFilterMenuOpen]);

  useEffect(() => {
    if (showAddEvent && !editingEventId) {
      const dateStr = toLocalDateInputValue(selectedDate);
      setNewEventStartDate(dateStr);
      setNewEventEndDate(dateStr);
      setCoverageDetails([]);
      setNewEventType('leave');
      setAssignedToName('');
      setNewEventDescription('');
      setIsAllDay(true);
      setShowMoreOptions(false);
      setValidationErrors({});
    } else if (!showAddEvent) {
      setEditingEventId(null);
      setValidationErrors({});
    }
  }, [showAddEvent, selectedDate, editingEventId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.event-card')) setExpandedEventId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() - 7);
    setSelectedDateAndSyncMonth(next);
  };
  const nextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    setSelectedDateAndSyncMonth(next);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (day: number) =>
    selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;

  const isSelectedDateToday = () => isSameDay(selectedDate, new Date());

  const getEventTypesForDay = (day: number): EventType[] => {
    const targetStart = new Date(year, month, day, 0, 0, 0);
    const targetEnd = new Date(year, month, day, 23, 59, 59);
    const dayEvents = events.filter((event) => {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      return start <= targetEnd && end >= targetStart;
    });
    return Array.from(new Set(dayEvents.map((event) => event.event_type))) as EventType[];
  };

  const getAgendaEvents = () => {
    let baseEvents: CalendarEvent[] = [];

    if (searchQuery.length > 1) {
      baseEvents = searchResults;
      if (activeViewScope === 'week') {
        baseEvents = baseEvents.filter((event) => eventOverlapsRange(event, toDayStart(weekStartDate), toDayEnd(weekEndDate)));
      } else if (activeViewScope === 'selected') {
        baseEvents = baseEvents.filter((event) => eventOverlapsRange(event, toDayStart(selectedDate), toDayEnd(selectedDate)));
      }
    } else if (activeViewScope === 'week') {
      baseEvents = events
        .filter((event) => eventOverlapsRange(event, toDayStart(weekStartDate), toDayEnd(weekEndDate)))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    } else if (activeViewScope === 'upcoming') {
      baseEvents = upcomingEvents;
    } else {
      baseEvents = events
        .filter((event) => eventOverlapsRange(event, toDayStart(selectedDate), toDayEnd(selectedDate)))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }

    if (activeFilter !== 'all') baseEvents = baseEvents.filter((event) => event.event_type === activeFilter);
    return baseEvents;
  };

  const agendaEvents = getAgendaEvents();
  const selectedDateLabel = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const isSearchMode = searchQuery.trim().length > 1;
  const agendaHeaderTitle = isSearchMode
    ? 'Search results'
    : activeViewScope === 'week'
      ? `Week of ${weekRangeLabel}`
      : activeViewScope === 'upcoming'
        ? 'Upcoming schedule'
        : isSelectedDateToday()
          ? 'Today'
          : 'Selected day';
  const agendaHeaderDescription = isSearchMode
    ? `Showing matches for "${searchQuery.trim()}"`
    : activeViewScope === 'week'
      ? `${agendaEvents.length} event${agendaEvents.length === 1 ? '' : 's'} in the selected week`
      : activeViewScope === 'upcoming'
        ? 'Next scheduled events across the calendar'
        : `${selectedDateLabel}${isSelectedDateToday() ? ' • Today' : ''}`;
  const activeFilterChips = [
    activeFilter !== 'all' ? `Type: ${formatEventTypeLabel(activeFilter)}` : null,
  ].filter(Boolean) as string[];

  const clearScheduleFilters = () => {
    setActiveFilter('all');
    setActiveViewScope('week');
  };

  const applyScheduleFilters = () => {
    setActiveFilter(draftFilter);
    setActiveViewScope(draftViewScope);
    setIsFilterMenuOpen(false);
  };

  const weekDayMeta = useMemo(() => {
    const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    return weekDays.map((date, index) => ({
      date,
      label: labels[index],
      isSelected: isSameDay(date, selectedDate),
      isToday: isSameDay(date, new Date()),
      count: events.filter((event) => eventOverlapsRange(event, toDayStart(date), toDayEnd(date))).length,
    }));
  }, [events, selectedDate, weekDays]);

  const capabilities = getCapabilitySet(userRoles);
  const isPrivilegedCalendarManager = capabilities.canManageCalendar;
  const canManageEvent = (event: CalendarEvent) =>
    isPrivilegedCalendarManager || (hasRole(userRoles, 'consultant') && event.created_by === currentUserId);

  const addCoverage = () => {
    if (coverageDetails.length < 5) {
      setCoverageDetails([...coverageDetails, { user_id: '', name: '', modalities: [] }]);
    }
  };
  const removeCoverage = (index: number) => {
    const next = [...coverageDetails];
    next.splice(index, 1);
    setCoverageDetails(next);
  };
  const updateCoverageName = (index: number, name: string) => {
    const next = [...coverageDetails];
    next[index] = { ...next[index], name, user_id: '' };
    setCoverageDetails(next);
  };
  const toggleCoverageModality = (index: number, modality: string) => {
    const next = [...coverageDetails];
    const currentModalities = next[index].modalities || [];
    next[index].modalities = currentModalities.includes(modality)
      ? currentModalities.filter((value) => value !== modality)
      : [...currentModalities, modality];
    setCoverageDetails(next);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setNewEventType(event.event_type);
    setAssignedToName(event.title);
    setNewEventDescription(event.description || '');

    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    setIsAllDay(event.is_all_day);
    setNewEventStartDate(toLocalDateInputValue(start));
    setNewEventEndDate(toLocalDateInputValue(end));

    if (!event.is_all_day) {
      setNewEventTime(start.toTimeString().slice(0, 5));
      setNewEventEndTime(end.toTimeString().slice(0, 5));
    } else {
      setNewEventTime('08:00');
      setNewEventEndTime('17:00');
    }

    if (event.coverage_details && event.coverage_details.length > 0) {
      setCoverageDetails(
        event.coverage_details.map((detail: any) => ({
          user_id: detail.user_id || '',
          name: detail.name || detail.user?.full_name || '',
          modalities: detail.modalities || [],
        })),
      );
      setShowMoreOptions(true);
    } else {
      setCoverageDetails([]);
      setShowMoreOptions(false);
    }

    setValidationErrors({});
    setShowAddEvent(true);
  };

  const handleDeleteEvent = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const target =
      events.find((event) => event.id === id) ||
      searchResults.find((event) => event.id === id) ||
      upcomingEvents.find((event) => event.id === id);

    if (!target || !canManageEvent(target)) {
      toastError('Permission denied', 'You do not have permission to delete this event.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      await CalendarService.deleteEvent(id);
      toastSuccess('Event deleted');
      fetchEvents();
    } catch (error: any) {
      console.error('Error deleting event', error);
      toastError('Failed to delete event', error?.message || 'Please try again.');
    }
  };

  const handleSaveEvent = async () => {
    const errors: ValidationErrors = {};
    if (!assignedToName.trim()) {
      errors.title = newEventType === 'leave' ? 'Name is required for leave events.' : 'Title is required.';
    }
    if (!newEventStartDate || !newEventEndDate) {
      errors.date = 'Start and end dates are required.';
    }
    if (!isAllDay && (!newEventTime || !newEventEndTime)) {
      errors.time = 'Start and end times are required.';
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const { start, end } = buildEventDateTimeRange({
        startDate: newEventStartDate,
        endDate: newEventEndDate,
        startTime: newEventTime,
        endTime: newEventEndTime,
        isAllDay,
      });

      if (end.getTime() < start.getTime()) {
        setValidationErrors((prev) => ({ ...prev, time: 'End date/time must be after start date/time.' }));
        return;
      }

      const payload = {
        title: assignedToName.trim(),
        description: newEventDescription.trim(),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        event_type: newEventType,
        is_all_day: isAllDay,
        location: '',
        coverage_details: coverageDetails
          .filter((detail) => detail.name.trim() !== '')
          .map((detail) => ({ user_id: detail.user_id || undefined, name: detail.name.trim(), modalities: detail.modalities })),
      };

      const savedEvent = editingEventId
        ? await CalendarService.updateEvent(editingEventId, payload)
        : await CalendarService.createEvent(payload);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const actorUserId = auth.user?.id || '';
        const recipients = await fetchAllRecipientUserIds();
        const recipientUserIds =
          recipients.length > 0
            ? recipients
            : Array.from(
              new Set(
                [
                  ...(savedEvent.coverage_details || []).map((detail) => detail.user_id).filter(Boolean),
                  ...coverageDetails.map((detail) => detail.user_id).filter(Boolean),
                  savedEvent.assigned_to || '',
                  savedEvent.covered_by || '',
                ].filter(Boolean),
              ),
            );

        if (actorUserId && recipientUserIds.length > 0) {
          await createSystemNotification({
            actorUserId,
            type: 'calendar',
            severity: newEventType === 'exam' ? 'warning' : 'info',
            title: editingEventId ? 'Calendar Event Updated' : 'New Calendar Event',
            message: `${savedEvent.title} - ${new Date(savedEvent.start_time).toLocaleDateString()}`,
            linkScreen: 'calendar',
            linkEntityId: savedEvent.id,
            recipientUserIds,
          });
        }
      } catch (notifError) {
        console.error('Failed to emit calendar notification:', notifError);
      }

      toastSuccess(editingEventId ? 'Event updated' : 'Event created');
      setShowAddEvent(false);
      setEditingEventId(null);
      fetchEvents();
    } catch (error: any) {
      console.error('Error saving event', error);
      toastError('Failed to save event', error?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allowedTypes: EventType[] = ['leave', 'meeting', 'pcr', 'lecture', 'exam', 'pickleball'];
  const availableModalities = ['CT', 'MRI', 'XRay', 'IR', 'Utz'];
  const panelClass = 'bg-white/[0.03] border border-white/8 rounded-[2rem] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.75)] backdrop-blur-md';
  const controlPillClass = 'bg-black/30 border border-white/10 rounded-2xl p-1';
  const isDesktop = viewport === 'desktop';
  const monthLabel = monthNames[month];
  const monthYearLabel = `${monthNames[month]} ${year}`;
  const selectedDayChip = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <PageShell layoutMode="wide">
      <div
        data-testid="calendar-layout"
        data-calendar-viewport={viewport}
        className="mobile-action-zone-clearance min-h-screen animate-in fade-in duration-500"
      >
        <div className="space-y-4">
          <PageHeader
            title="Calendar"
            description="Schedule, leave coverage, and upcoming exams."
            action={
              isPrivilegedCalendarManager ? (
                <TopRightCreateAction
                  label="Add event"
                  icon="event_available"
                  onClick={() => setShowAddEvent(true)}
                  aria-label="Create Event"
                  compact
                />
              ) : null
            }
          />

          <CalendarSearchBar
            filterMenuRef={filterMenuRef}
            searchQuery={searchQuery}
            isFilterMenuOpen={isFilterMenuOpen}
            activeFilter={activeFilter}
            activeViewScope={activeViewScope}
            activeFilterChips={activeFilterChips}
            draftFilter={draftFilter}
            draftViewScope={draftViewScope}
            eventTypeOptions={EVENT_TYPE_OPTIONS}
            viewScopeOptions={VIEW_SCOPE_OPTIONS}
            viewport={viewport}
            onSearchChange={setSearchQuery}
            onClearSearch={() => {
              setSearchQuery('');
              setSearchError('');
            }}
            onToggleFilters={() => setIsFilterMenuOpen((prev) => !prev)}
            onClearFilters={clearScheduleFilters}
            onDraftFilterChange={setDraftFilter}
            onDraftViewScopeChange={setDraftViewScope}
            onResetDraftFilters={() => {
              setDraftFilter('all');
              setDraftViewScope('week');
            }}
            onApplyFilters={applyScheduleFilters}
            onCloseFilters={() => setIsFilterMenuOpen(false)}
          />
          {fetchError ? <ScreenStatusNotice tone="error" message={fetchError} /> : null}
          {!fetchError && searchError ? <ScreenStatusNotice tone="error" message={searchError} /> : null}

          <div className={isDesktop ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]' : 'space-y-4'}>
            <CalendarSchedulePanel
              panelClass={panelClass}
              viewport={viewport}
              fetchError={fetchError}
              searchError={searchError}
              agendaHeaderTitle={agendaHeaderTitle}
              agendaHeaderDescription={agendaHeaderDescription}
              agendaEvents={agendaEvents}
              selectedDateLabel={selectedDateLabel}
              selectedDateButtonLabel={`Add event on ${selectedDayChip}`}
              isSearchMode={isSearchMode}
              isPrivilegedCalendarManager={isPrivilegedCalendarManager}
              activeFilterLabel={formatEventTypeLabel(activeFilter)}
              activeViewScope={activeViewScope}
              expandedEventId={expandedEventId}
              onAddEvent={() => setShowAddEvent(true)}
              onEditEvent={handleEditEvent}
              onDeleteEvent={(event, e) => void handleDeleteEvent(event.id, e)}
              onToggleActions={(eventId) => setExpandedEventId(expandedEventId === eventId ? null : eventId)}
              canManageEvent={canManageEvent}
              formatEventTypeLabel={formatEventTypeLabel}
              eventTypeStyles={eventTypeStyles}
            />

            <div className={isDesktop ? 'xl:sticky xl:top-6' : ''}>
              <CalendarMonthNavigator
                panelClass={panelClass}
                controlPillClass={controlPillClass}
                monthIndex={month}
                monthLabel={monthLabel}
                monthYearLabel={monthYearLabel}
                year={year}
                days={days}
                padding={padding}
                eventDotColors={eventDotColors}
                weekRangeLabel={weekRangeLabel}
                weekDayMeta={weekDayMeta}
                isWeekDrawerOpen={isWeekDrawerOpen}
                viewport={viewport}
                getEventTypesForDay={getEventTypesForDay}
                isSelected={isSelected}
                isToday={isToday}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onToday={() => setSelectedDateAndSyncMonth(new Date())}
                onSelectDate={setSelectedDateAndSyncMonth}
                onPrevWeek={prevWeek}
                onNextWeek={nextWeek}
                onHideWeekStrip={() => setIsWeekDrawerOpen(false)}
                onShowWeekStrip={() => setIsWeekDrawerOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <CalendarEventModal
        isOpen={showAddEvent}
        viewport={viewport}
        editingEventId={editingEventId}
        selectedDateLabel={selectedDayChip}
        isSubmitting={isSubmitting}
        validationErrors={validationErrors}
        allowedTypes={allowedTypes}
        availableModalities={availableModalities}
        eventTypeColors={eventTypeColors}
        newEventType={newEventType}
        isAllDay={isAllDay}
        newEventStartDate={newEventStartDate}
        newEventEndDate={newEventEndDate}
        newEventTime={newEventTime}
        newEventEndTime={newEventEndTime}
        assignedToName={assignedToName}
        newEventDescription={newEventDescription}
        showMoreOptions={showMoreOptions}
        coverageDetails={coverageDetails}
        onClose={() => setShowAddEvent(false)}
        onSave={handleSaveEvent}
        setNewEventType={setNewEventType}
        setIsAllDay={setIsAllDay}
        setNewEventStartDate={setNewEventStartDate}
        setNewEventEndDate={setNewEventEndDate}
        setNewEventTime={setNewEventTime}
        setNewEventEndTime={setNewEventEndTime}
        setAssignedToName={setAssignedToName}
        setNewEventDescription={setNewEventDescription}
        setShowMoreOptions={setShowMoreOptions}
        addCoverage={addCoverage}
        removeCoverage={removeCoverage}
        updateCoverageName={updateCoverageName}
        toggleCoverageModality={toggleCoverageModality}
      />
    </PageShell>
  );
};

export default CalendarScreen;
