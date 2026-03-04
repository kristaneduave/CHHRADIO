import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CalendarEvent, EventType } from '../types';
import { CalendarService } from '../services/CalendarService';
import { supabase } from '../services/supabase';
import { createSystemNotification, fetchAllRecipientUserIds } from '../services/newsfeedService';
import EmptyState from './EmptyState';
import { normalizeUserRole } from '../utils/roles';
import { buildEventDateTimeRange, formatWeekRange, getWeekDays, getWeekStart, isSameDay, toLocalDateInputValue } from '../utils/calendarView';
import { toastError, toastSuccess } from '../utils/toast';

type ValidationErrors = {
  title?: string;
  date?: string;
  time?: string;
};

const CalendarScreen: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null); // Quick actions menu target
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<EventType | 'all'>('all');
  const [searchResults, setSearchResults] = useState<CalendarEvent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const [isWeekDrawerOpen, setIsWeekDrawerOpen] = useState(true);

  // Form state
  // Form state - Minimalist by default
  const [showMoreOptions, setShowMoreOptions] = useState(false); // Toggle for advanced fields
  const [newEventStartDate, setNewEventStartDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('08:00');
  const [newEventEndTime, setNewEventEndTime] = useState('17:00');
  const [newEventType, setNewEventType] = useState<EventType>('leave');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);

  // Leave Specific State
  const [assignedToName, setAssignedToName] = useState('');

  // Complex Coverage State - Now with NAME for manual entry
  const [coverageDetails, setCoverageDetails] = useState<{ user_id: string, name: string, modalities: string[] }[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<'admin' | 'moderator' | 'consultant' | 'resident' | 'fellow' | 'training_officer'>('resident');
  const isMountedRef = useRef(true);
  const eventsFetchSeqRef = useRef(0);
  const searchSeqRef = useRef(0);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth(year, month) }, (_, i) => null);

  // Color definitions moved up for reuse
  const eventTypeColors: Record<EventType, string> = {
    leave: 'bg-rose-600 text-white border-2 border-rose-400/50 shadow-[0_0_15px_rgba(225,29,72,0.4)]',
    meeting: 'bg-blue-500 text-white border border-blue-400/30',
    lecture: 'bg-purple-500 text-white border border-purple-400/30',
    exam: 'bg-yellow-500 text-white border border-yellow-400/30',

    pickleball: 'bg-emerald-500 text-white border border-emerald-400/30',
    rotation: 'bg-indigo-500 text-white',
    call: 'bg-red-500 text-white',
    pcr: 'bg-cyan-500 text-white border border-cyan-400/30'
  };

  const eventDotColors: Record<EventType, string> = {
    leave: 'bg-rose-500',
    meeting: 'bg-blue-500',
    lecture: 'bg-purple-500',
    exam: 'bg-yellow-500',

    pickleball: 'bg-emerald-500',
    rotation: 'bg-indigo-500',
    call: 'bg-red-500',
    pcr: 'bg-cyan-500'
  };

  const weekStartDate = useMemo(() => getWeekStart(selectedDate, true), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(selectedDate, true), [selectedDate]);
  const weekEndDate = useMemo(() => {
    const end = new Date(weekStartDate);
    end.setDate(weekStartDate.getDate() + 6);
    return end;
  }, [weekStartDate]);

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
    setLoading(true);
    setFetchError('');
    try {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const data = await CalendarService.getEvents(start, end);
      let mergedData = data;

      if (isWeekDrawerOpen && (weekStartDate < start || weekEndDate > end)) {
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
    } finally {
      if (!isMountedRef.current || seq !== eventsFetchSeqRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate, selectedDate, isWeekDrawerOpen]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadCurrentUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (data?.role) setUserRole(normalizeUserRole(data.role));
    };
    loadCurrentUserRole();
  }, []);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        const seq = ++searchSeqRef.current;
        setIsSearching(true);
        setSearchError('');
        try {
          const results = await CalendarService.searchEvents(searchQuery);
          if (!isMountedRef.current || seq !== searchSeqRef.current) return;
          setSearchResults(results);
        } catch (error: any) {
          console.error("Search error", error);
          setSearchError(error?.message || 'Unable to search calendar events.');
        } finally {
          if (!isMountedRef.current || seq !== searchSeqRef.current) return;
          setIsSearching(false);
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

    const handleFilterClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleFilterClickOutside);
    return () => document.removeEventListener('mousedown', handleFilterClickOutside);
  }, [isFilterMenuOpen]);

  // Pre-fill dates when opening modal
  useEffect(() => {
    if (showAddEvent && !editingEventId) {
      const dateStr = toLocalDateInputValue(selectedDate);
      setNewEventStartDate(dateStr);
      setNewEventEndDate(dateStr);
      // Reset complex state
      setCoverageDetails([]);
      setNewEventType('leave');
      setAssignedToName('');
      setNewEventDescription('');
      setIsAllDay(true);
      setShowMoreOptions(false); // Reset minimalist view
      setValidationErrors({});
    } else if (!showAddEvent) {
      setEditingEventId(null);
      setValidationErrors({});
    }
  }, [showAddEvent, selectedDate, editingEventId]);

  // Click outside to close expanded actions - Optional but nice
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Simple logic: if click target is not inside an event card, collapse all
      const target = e.target as HTMLElement;
      if (!target.closest('.event-card')) {
        setExpandedEventId(null);
      }
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

  const isSelected = (day: number) => {
    return selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  };

  const isSelectedDateToday = () => {
    const today = new Date();
    return isSameDay(selectedDate, today);
  };

  // Updated: Get unique event types for a day to show dots
  const getEventTypesForDay = (day: number): EventType[] => {
    const targetStart = new Date(year, month, day, 0, 0, 0);
    const targetEnd = new Date(year, month, day, 23, 59, 59);

    const dayEvents = events.filter(e => {
      const eStart = new Date(e.start_time);
      const eEnd = new Date(e.end_time);
      return eStart <= targetEnd && eEnd >= targetStart;
    });

    const types = Array.from(new Set(dayEvents.map(e => e.event_type))) as EventType[];
    // Sort to ensure consistency (e.g. Leave always first if present?)
    return types.slice(0, 3); // Max 3 dots
  };

  const getAgendaEvents = () => {
    // If active filter is set to something other than 'all', filter everything by that type
    // If search query is present, return search results matching type if any

    let baseEvents: CalendarEvent[] = [];

    if (searchQuery.length > 1) {
      baseEvents = searchResults;
      if (isWeekDrawerOpen) {
        const start = toDayStart(weekStartDate);
        const end = toDayEnd(weekEndDate);
        baseEvents = baseEvents.filter((e) => eventOverlapsRange(e, start, end));
      }
    } else if (isWeekDrawerOpen) {
      const start = toDayStart(weekStartDate);
      const end = toDayEnd(weekEndDate);
      baseEvents = events
        .filter((e) => eventOverlapsRange(e, start, end))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    } else if (isSelectedDateToday()) {
      baseEvents = upcomingEvents;
    } else {
      const dayStart = toDayStart(selectedDate);
      const dayEnd = toDayEnd(selectedDate);
      baseEvents = events
        .filter((e) => eventOverlapsRange(e, dayStart, dayEnd))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }

    if (activeFilter !== 'all') {
      baseEvents = baseEvents.filter(e => e.event_type === activeFilter);
    }

    return baseEvents;
  };

  const agendaEvents = getAgendaEvents();
  const weekDayMeta = useMemo(() => {
    const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    return weekDays.map((date, index) => {
      const count = events.filter((event) => eventOverlapsRange(event, toDayStart(date), toDayEnd(date))).length;
      return {
        date,
        label: labels[index],
        isSelected: isSameDay(date, selectedDate),
        isToday: isSameDay(date, new Date()),
        count,
      };
    });
  }, [events, selectedDate, weekDays]);

  const isPrivilegedCalendarManager = ['admin', 'training_officer', 'moderator'].includes(userRole);
  const canManageEvent = (event: CalendarEvent): boolean =>
    isPrivilegedCalendarManager || (userRole === 'consultant' && event.created_by === currentUserId);

  // Coverage Management
  const addCoverage = () => {
    if (coverageDetails.length < 5) {
      setCoverageDetails([...coverageDetails, { user_id: '', name: '', modalities: [] }]);
    }
  };

  const removeCoverage = (index: number) => {
    const newDetails = [...coverageDetails];
    newDetails.splice(index, 1);
    setCoverageDetails(newDetails);
  };

  const updateCoverageName = (index: number, name: string) => {
    const newDetails = [...coverageDetails];
    newDetails[index] = { ...newDetails[index], name: name, user_id: '' };
    setCoverageDetails(newDetails);
  };

  const toggleCoverageModality = (index: number, modality: string) => {
    const newDetails = [...coverageDetails];
    const currentModalities = newDetails[index].modalities || [];

    if (currentModalities.includes(modality)) {
      newDetails[index].modalities = currentModalities.filter(m => m !== modality);
    } else {
      newDetails[index].modalities = [...currentModalities, modality];
    }
    setCoverageDetails(newDetails);
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

    // Coverage
    if (event.coverage_details && event.coverage_details.length > 0) {
      setCoverageDetails(event.coverage_details.map((d: any) => ({
        user_id: d.user_id || '',
        name: d.name || d.user?.full_name || '',
        modalities: d.modalities || []
      })));
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
    const target = events.find((event) => event.id === id) || searchResults.find((event) => event.id === id) || upcomingEvents.find((event) => event.id === id);
    const canDelete = Boolean(target) && canManageEvent(target!);

    if (!canDelete) {
      toastError('Permission denied', 'You do not have permission to delete this event.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await CalendarService.deleteEvent(id);
        toastSuccess('Event deleted');
        fetchEvents();
      } catch (error: any) {
        console.error("Error deleting event", error);
        toastError('Failed to delete event', error?.message || 'Please try again.');
      }
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
          .filter((d) => d.name.trim() !== '')
          .map((d) => ({ user_id: d.user_id || undefined, name: d.name.trim(), modalities: d.modalities })),
      };

      let savedEvent: CalendarEvent;
      if (editingEventId) {
        savedEvent = await CalendarService.updateEvent(editingEventId, payload);
      } else {
        savedEvent = await CalendarService.createEvent(payload);
      }

      try {
        const { data: auth } = await supabase.auth.getUser();
        const actorUserId = auth.user?.id || '';
        const recipients = await fetchAllRecipientUserIds();
        const recipientUserIds = recipients.length > 0
          ? recipients
          : Array.from(
            new Set(
              [
                ...(savedEvent.coverage_details || []).map((d) => d.user_id).filter(Boolean),
                ...coverageDetails.map((d) => d.user_id).filter(Boolean),
                savedEvent.assigned_to || '',
                savedEvent.covered_by || '',
              ].filter(Boolean),
            ),
          );

        if (actorUserId && recipientUserIds.length > 0) {
          const severity = newEventType === 'exam' ? 'warning' : 'info';
          const dateLabel = new Date(savedEvent.start_time).toLocaleDateString();
          await createSystemNotification({
            actorUserId,
            type: 'calendar',
            severity,
            title: editingEventId ? 'Calendar Event Updated' : 'New Calendar Event',
            message: `${savedEvent.title} - ${dateLabel}`,
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
    } catch (e: any) {
      console.error("Error saving event", e);
      toastError('Failed to save event', e?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const eventTypeStyles: Record<string, string> = {
    rotation: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20',
    call: 'bg-red-500/20 text-red-400 border-red-500/20',
    lecture: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    exam: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    leave: 'bg-rose-500/20 text-rose-400 border-rose-500/20', // Updated to match screenshot style
    meeting: 'bg-blue-500/20 text-blue-400 border-blue-500/20',

    pickleball: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
    pcr: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  };

  const allowedTypes: EventType[] = ['leave', 'meeting', 'pcr', 'lecture', 'exam', 'pickleball'];
  const availableModalities = ['CT', 'MRI', 'XRay', 'IR', 'Utz'];
  const panelClass = 'bg-black/40 border border-white/5 rounded-[2rem] backdrop-blur-md';
  const controlPillClass = 'bg-black/30 border border-white/10 rounded-2xl p-1';
  const weekRangeLabel = formatWeekRange(weekStartDate, weekEndDate);



  return (
    <div className="px-6 pt-6 pb-12 flex flex-col lg:h-full min-h-screen animate-in fade-in duration-500 max-w-7xl mx-auto w-full relative">
      <div className="pb-2">
        <header className="flex items-center justify-between min-h-[32px]">
          <h1 className="text-3xl font-bold text-white tracking-tight">Calendar</h1>
        </header>
      </div>

      <div className="pt-2 pb-4 w-full">
        {/* Database-Style Global Search and Filter Bar */}
        <div className="relative mb-4 z-50 w-full" ref={filterMenuRef}>
          <div className="relative group flex bg-black/40 p-1.5 rounded-[1.25rem] border border-white/5 backdrop-blur-md shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 -mx-1.5">
            <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[19px] text-slate-500 group-focus-within:text-primary transition-colors pointer-events-none">
              search
            </span>

            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 bg-transparent border-0 rounded-xl pl-[2.75rem] pr-[6rem] text-[13px] font-bold text-white placeholder-slate-500 focus:ring-0 focus:outline-none transition-all"
            />

            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchError('');
                }}
                className="absolute right-[3rem] top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Clear search"
              >
                <span className="material-icons text-sm">close</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${activeFilter !== 'all' ? 'bg-primary text-white shadow-[0_4px_12px_rgba(13,162,231,0.3)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              aria-label="Filter events"
              aria-expanded={isFilterMenuOpen}
              aria-controls="calendar-filter-menu"
            >
              <span className="material-icons text-[19px]">tune</span>
              {activeFilter !== 'all' && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border border-primary"></div>
              )}
            </button>
          </div>

          <div
            id="calendar-filter-menu"
            className={`absolute right-0 top-full mt-2 w-56 bg-[#1a2332] border border-white/5 rounded-2xl overflow-hidden transition-all duration-200 transform origin-top-right z-50 ${isFilterMenuOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95'}`}
          >
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Event Type
              </div>
              {([
                { id: 'all', label: 'All Events' },
                { id: 'leave', label: 'Leaves' },
                { id: 'exam', label: 'Exams' },
                { id: 'lecture', label: 'Lectures' },
                { id: 'meeting', label: 'Meetings' },
                { id: 'pcr', label: 'PCR' },
                { id: 'pickleball', label: 'Pickleball' },
              ] as { id: EventType | 'all', label: string }[]).map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFilter(f.id);
                    setIsFilterMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-semibold rounded-xl transition-all flex items-center justify-between ${activeFilter === f.id
                    ? 'bg-primary/20 text-primary border border-primary/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                >
                  {f.label}
                  {activeFilter === f.id && <span className="material-icons text-sm">check</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 lg:overflow-hidden relative z-0">
        {/* Calendar Grid */}
        <div className="flex-[2] flex flex-col gap-6 lg:overflow-hidden">
          <div className={`${panelClass} p-6 h-full flex flex-col`}>
            {/* Integrated Navigation and Title */}
            <div className="flex items-center justify-between w-full mb-6 relative">

              <div className="w-10"></div> {/* Spacer for perfect centering */}

              {/* Centered Month Navigation Pill */}
              <div className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-between ${controlPillClass} w-[280px]`}>
                <button
                  onClick={prevMonth}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all rounded-xl active:scale-95"
                >
                  <span className="material-icons text-[20px]">chevron_left</span>
                </button>

                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="flex flex-col items-center justify-center hover:bg-white/5 px-4 h-8 rounded-xl transition-all active:scale-95 group relative overflow-hidden min-w-[140px]"
                  title="Return to Today"
                >
                  <div className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-full">
                    <span className="text-[15px] font-bold text-white tracking-tight">
                      {monthNames[month]} <span className="text-slate-500 font-medium">{year}</span>
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center transition-transform duration-300 translate-y-full group-hover:translate-y-0">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Return to Today</span>
                  </div>
                </button>

                <button
                  onClick={nextMonth}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all rounded-xl active:scale-95"
                >
                  <span className="material-icons text-[20px]">chevron_right</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsWeekDrawerOpen((prev) => !prev)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isWeekDrawerOpen
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'text-slate-400 border border-white/10 hover:text-white hover:bg-white/5'
                  }`}
                aria-label="Toggle weekly drawer"
                title="Toggle weekly drawer"
              >
                <span className="material-icons text-[18px]">date_range</span>
              </button>
            </div>

            <div className="grid grid-cols-7 mb-4">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                <div key={d} className="text-center text-[11px] font-bold text-[#828b9c] tracking-widest py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-2 gap-x-1 flex-1 content-start">
              {padding.map((_, i) => <div key={`p-${i}`} className="aspect-square"></div>)}
              {days.map(day => {
                const dotTypes = getEventTypesForDay(day);
                const isActive = isSelected(day);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDateAndSyncMonth(new Date(year, month, day))}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all group ${isActive
                      ? 'bg-[#5b8cff] z-10'
                      : isToday(day)
                        ? 'text-[#5b8cff] font-bold hover:bg-white/[0.04]'
                        : 'text-white hover:bg-white/[0.04]'
                      }`}
                  >
                    <span className={`text-[15px] leading-none mb-1 ${isActive ? 'text-white font-bold' : 'font-medium opacity-90'}`}>{day}</span>

                    {/* Colored Event Dots */}
                    {dotTypes.length > 0 && (
                      <div className="flex gap-[3px] justify-center px-1 mt-1">
                        {dotTypes.map(type => (
                          <span
                            key={type}
                            className={`w-[4px] h-[4px] rounded-full ${isActive ? 'bg-white' : eventDotColors[type] || 'bg-slate-400'}`}
                          ></span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 min-h-[108px]">
              <div
                className={`overflow-hidden transition-all duration-300 ${isWeekDrawerOpen ? 'max-h-[220px] opacity-100 scale-100' : 'max-h-0 opacity-0 scale-[0.98]'
                  }`}
              >
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Week: {weekRangeLabel}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={prevWeek}
                        className="w-8 h-8 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                        aria-label="Previous week"
                      >
                        <span className="material-icons text-[18px]">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={nextWeek}
                        className="w-8 h-8 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                        aria-label="Next week"
                      >
                        <span className="material-icons text-[18px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <div className="flex gap-2 min-w-[560px] lg:min-w-0">
                      {weekDayMeta.map((dayMeta) => (
                        <button
                          key={dayMeta.date.toISOString()}
                          type="button"
                          onClick={() => setSelectedDateAndSyncMonth(new Date(dayMeta.date))}
                          className={`flex-1 min-w-[72px] rounded-xl border px-2 py-2.5 transition-all ${dayMeta.isSelected
                            ? 'bg-primary/20 border-primary/40 text-white'
                            : 'bg-black/25 border-white/10 text-slate-300 hover:bg-white/5'
                            }`}
                        >
                          <div className="text-[10px] font-bold tracking-widest uppercase">{dayMeta.label}</div>
                          <div className={`mt-1 text-sm font-bold ${dayMeta.isToday ? 'text-primary-light' : ''}`}>{dayMeta.date.getDate()}</div>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            {dayMeta.count > 0 ? (
                              <>
                                <span className={`w-1.5 h-1.5 rounded-full ${dayMeta.isSelected ? 'bg-white' : 'bg-primary'}`}></span>
                                <span className="text-[10px] font-semibold">{dayMeta.count}</span>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-500">0</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>

        {/* Agenda */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6 lg:overflow-hidden relative z-10">

          <div className={`${panelClass} p-6 flex-1 lg:overflow-hidden flex flex-col relative`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black/30 rounded-2xl flex items-center justify-center">
                  <span className="material-icons text-white">grid_view</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight leading-tight">AGENDA</h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {searchQuery
                      ? `Searching "${searchQuery}"`
                      : isWeekDrawerOpen
                        ? `Week of ${weekRangeLabel}`
                        : isSelectedDateToday()
                          ? 'Upcoming'
                          : `For ${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()].substring(0, 3)}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
              </div>
            </div>

            {/* PADDED CONTAINER to fix Agenda overlap - Increased to pb-40 */}
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2 pb-40">
              {activeFilter !== 'all' && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className="text-[10px] px-2 py-1 rounded-full bg-primary/15 border border-primary/35 text-primary-light"
                  >
                    Filter: {activeFilter} (clear)
                  </button>
                </div>
              )}
              {fetchError && (
                <div className="mb-2">
                  <EmptyState icon="error_outline" title="Could not load events" description={fetchError} compact />
                </div>
              )}
              {searchError && (
                <div className="mb-2">
                  <EmptyState icon="search_off" title="Search failed" description={searchError} compact />
                </div>
              )}
              {agendaEvents.length > 0 ? (
                agendaEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={() => {
                      if (canManageEvent(event)) {
                        handleEditEvent(event);
                      }
                    }}
                    className={`event-card relative group rounded-[1.25rem] transition-all cursor-pointer p-5 py-6 mb-3 select-none touch-manipulation [-webkit-tap-highlight-color:transparent] ${expandedEventId === event.id
                      ? 'bg-white/[0.06]'
                      : 'bg-white/[0.03] hover:bg-white/[0.05]'
                      }`}
                  >
                    <div className="flex flex-col gap-3 w-full z-10 relative">

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-black/30 text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-md tracking-widest flex items-center gap-1.5">
                            {event.is_all_day ? (
                              <span>ALL DAY</span>
                            ) : (
                              <span>
                                {new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time || event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            )}
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded opacity-70 ${eventTypeStyles[event.event_type] || eventTypeStyles.leave}`}>
                            {event.event_type}
                          </span>
                        </div>

                        {canManageEvent(event) && (
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                              className="w-8 h-8 rounded-full bg-black/20 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
                            >
                              <span className="material-icons text-[16px]">more_horiz</span>
                            </button>

                            {expandedEventId === event.id && (
                              <div className="absolute right-0 top-10 z-20 min-w-[138px] rounded-xl border border-white/10 bg-[#101826] p-1.5 shadow-xl">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedEventId(null);
                                    handleEditEvent(event);
                                  }}
                                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
                                >
                                  Edit Event
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    setExpandedEventId(null);
                                    void handleDeleteEvent(event.id, e);
                                  }}
                                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-200 hover:bg-rose-500/15"
                                >
                                  Delete Event
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 mt-1">
                        <h4 className="text-[18px] font-bold text-white tracking-tight">
                          {event.event_type === 'leave' ? event.title.replace(' - Leave', '') : event.title}
                        </h4>

                        {(event.creator || (event.coverage_details && event.coverage_details.length > 0)) && (
                          <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 font-medium">
                            {event.creator && (
                              <span>by {event.creator.nickname || event.creator.full_name?.split(' ')[0]}</span>
                            )}

                            {event.coverage_details && event.coverage_details.length > 0 && (
                              <span className="text-purple-400/80">
                                w/ {event.coverage_details.map((d: any) => d.name || d.user?.full_name?.split(' ')[0]).join(', ')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center mt-8">
                  <EmptyState
                    icon="event_busy"
                    title="No events"
                    description="There are no scheduled activities for this time."
                    compact
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Render Portal Modal directly without nested component */}
      {/* Floating Add Event Button (Visible to all users) */}
      <div className="fixed top-2 right-4 sm:right-6 lg:right-10 z-[60]">
        <div className="pointer-events-auto bg-[#1a232f]/80 backdrop-blur-xl shadow-2xl shadow-black/50 border border-white/[0.08] rounded-full p-2">
          <button
            type="button"
            onClick={() => {
              if (!currentUserId) {
                toastError('Sign in required', 'You need an authenticated session to create events.');
                return;
              }
              setShowAddEvent(true);
            }}
            disabled={!currentUserId}
            className="flex flex-col items-center justify-center w-[54px] h-[54px] relative group transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-full text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Create Event"
            title={currentUserId ? 'Create Event' : 'Sign in to create events'}
          >
            <span className="material-icons text-[26px]">post_add</span>
          </button>
        </div>
      </div>

      {/* Add Event Overlay / Modal */}
      {
        showAddEvent && ReactDOM.createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-app/90 backdrop-blur-md transition-opacity"
              onClick={() => setShowAddEvent(false)}
            ></div>

            {/* Modal Container */}
            <div className="w-full max-w-md bg-[#0B101A] border border-white/5 rounded-[2rem] sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden relative z-10 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 flex flex-col max-h-[85vh] sm:max-h-[90vh]">

              {/* Header */}
              <div className="p-5 bg-black/40 border-b border-white/5 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 blur-[60px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-center justify-between relative z-10">
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                      <span className="material-icons text-sky-400 text-sm">event</span>
                    </div>
                    {editingEventId ? 'Edit Event' : 'Create Event'}
                  </h2>
                  <button
                    onClick={() => setShowAddEvent(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <span className="material-icons text-xl">close</span>
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar flex-1">

                {/* Type Selection */}
                <div className="pt-2">
                  <label className="text-[11px] text-slate-400 font-medium block mb-1.5 ml-1">Select Event Type</label>
                  <div className="flex flex-wrap gap-2">
                    {allowedTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => setNewEventType(type as EventType)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize shadow-sm flex-1 outline-none ring-offset-2 ring-offset-[#0B101A] focus:ring-2
                                            ${newEventType === type ? eventTypeColors[type] + ' ring-primary/50' : 'bg-black/40 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}
                                        `}
                      >
                        {type === 'pcr' ? 'PCR' : type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date & Time */}
                <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <span className="material-icons text-base text-sky-400">event_note</span> Date & Time
                    </span>

                    <button
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${isAllDay ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' : 'bg-black/40 border-white/5 text-slate-500 hover:bg-white/5'}`}
                      onClick={() => setIsAllDay(!isAllDay)}
                    >
                      <div className={`w-2 h-2 rounded-full ${isAllDay ? 'bg-sky-500' : 'bg-slate-500'}`}></div>
                      <span className="text-[10px] font-bold uppercase tracking-wide">All Day</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 font-medium block mb-1.5 ml-1">Starts</label>
                      <input
                        type="date"
                        value={newEventStartDate}
                        onChange={(e) => setNewEventStartDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner"
                      />
                      {!isAllDay && (
                        <input
                          type="time"
                          value={newEventTime}
                          onChange={(e) => setNewEventTime(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner mt-2"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 font-medium block mb-1.5 ml-1">Ends</label>
                      <input
                        type="date"
                        value={newEventEndDate}
                        onChange={(e) => setNewEventEndDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner"
                      />
                      {!isAllDay && (
                        <input
                          type="time"
                          value={newEventEndTime}
                          onChange={(e) => setNewEventEndTime(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner mt-2"
                        />
                      )}
                    </div>
                  </div>
                  {validationErrors.date && <p className="mt-2 text-xs text-rose-300">{validationErrors.date}</p>}
                  {validationErrors.time && <p className="mt-1 text-xs text-rose-300">{validationErrors.time}</p>}
                </div>

                {/* Basic Who/Title Input always visible */}
                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1.5 ml-1">
                    {newEventType === 'leave' ? 'Who is on Leave?' : 'Title'}
                  </label>
                  <div className="relative group">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-icons text-slate-500 text-[18px] group-focus-within:text-sky-400 transition-colors">
                      {newEventType === 'leave' ? 'person' : 'title'}
                    </span>
                    <input
                      type="text"
                      value={assignedToName}
                      onChange={(e) => setAssignedToName(e.target.value)}
                      placeholder={newEventType === 'leave' ? "Enter name (e.g., Dr. Reyes)" : "Event Title"}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner"
                    />
                  </div>
                  {validationErrors.title && <p className="mt-1 text-xs text-rose-300">{validationErrors.title}</p>}
                </div>


                {/* Toggle More Options */}
                <button
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"
                >
                  <span className="material-icons text-sm">{showMoreOptions ? 'expand_less' : 'expand_more'}</span>
                  {showMoreOptions ? 'Hide Details' : 'More Options (Coverage, Notes)'}
                </button>

                {/* Collapsible Advanced Options */}
                {showMoreOptions && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    {/* Coverage Logic - Only for leave */}
                    {(newEventType === 'leave') && (
                      <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
                        <div
                          className="flex justify-between items-center cursor-pointer mb-3"
                        >
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-icons text-xs text-purple-400">group_add</span> Coverage
                          </span>
                        </div>

                        <div className="space-y-3">
                          {coverageDetails.map((detail, idx) => (
                            <div key={idx} className="bg-black/40 p-3 rounded-xl border border-white/5 animate-in slide-in-from-right-2">
                              <div className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  value={detail.name}
                                  onChange={(e) => updateCoverageName(idx, e.target.value)}
                                  placeholder="Who is covering?"
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all placeholder:text-slate-600 shadow-inner"
                                />

                                <button onClick={() => removeCoverage(idx)} className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg w-8 flex items-center justify-center transition-colors">
                                  <span className="material-icons text-base">remove</span>
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                {availableModalities.map(modality => {
                                  const isActive = detail.modalities?.includes(modality);
                                  return (
                                    <button
                                      key={modality}
                                      onClick={() => toggleCoverageModality(idx, modality)}
                                      className={`px-2 py-1 rounded text-[9px] font-bold border transition-all
                                                                            ${isActive
                                          ? 'bg-purple-500 text-white border-purple-500'
                                          : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'
                                        }`}
                                    >
                                      {modality}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}

                          {coverageDetails.length < 5 && (
                            <button
                              onClick={addCoverage}
                              className="w-full py-3 bg-sky-500/10 hover:bg-sky-500/20 shadow-none border border-sky-500/30 text-sky-400 rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                              <span className="material-icons text-[20px]">add</span>
                              <span className="text-[13px] font-bold tracking-wide">Add Coverage</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <textarea
                        value={newEventDescription}
                        onChange={(e) => setNewEventDescription(e.target.value)}
                        rows={3}
                        placeholder="Add notes..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner resize-none mb-4"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-5 bg-black/40 border-t border-white/5 flex gap-3 mt-auto shrink-0">
                <button
                  onClick={() => setShowAddEvent(false)}
                  className="px-6 flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-transparent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEvent}
                  disabled={isSubmitting || !assignedToName.trim()}
                  className="px-6 flex-[2] py-2.5 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all shadow-[0_4px_20px_-4px_rgba(14,165,233,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-icons animate-spin text-[16px]">autorenew</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      {editingEventId ? 'Update Event' : 'Save Event'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

    </div >
  );
};

export default CalendarScreen;



