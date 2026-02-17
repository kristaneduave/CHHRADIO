import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CalendarEvent, EventType } from '../types';
import { CalendarService } from '../services/CalendarService';
import { supabase } from '../services/supabase';

const CalendarScreen: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<EventType | 'all'>('all');
  const [searchResults, setSearchResults] = useState<CalendarEvent[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const data = await CalendarService.getEvents(start, end);
      setEvents(data);

      const upcoming = await CalendarService.getUpcomingEvents(10);
      setUpcomingEvents(upcoming);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        try {
          const results = await CalendarService.searchEvents(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error("Search error", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pre-fill dates when opening modal
  useEffect(() => {
    if (showAddEvent) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setNewEventStartDate(dateStr);
      setNewEventEndDate(dateStr);
      // Reset complex state
      setCoverageDetails([]);
      setNewEventType('leave');
      setAssignedToName('');
      setNewEventDescription('');
      setIsAllDay(true);
      setShowMoreOptions(false); // Reset minimalist view
    }
  }, [showAddEvent, selectedDate]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (day: number) => {
    return selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  };

  const isSelectedDateToday = () => {
    const today = new Date();
    return selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear();
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

    let baseEvents = [];

    if (searchQuery.length > 1) {
      baseEvents = searchResults;
    } else if (isSelectedDateToday()) {
      baseEvents = upcomingEvents;
    } else {
      const startOfSelected = new Date(selectedDate);
      startOfSelected.setHours(0, 0, 0, 0);
      baseEvents = events.filter(e => new Date(e.end_time) >= startOfSelected)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }

    if (activeFilter !== 'all') {
      baseEvents = baseEvents.filter(e => e.event_type === activeFilter);
    }

    return baseEvents;
  };

  const agendaEvents = getAgendaEvents();

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

  const handleCreateEvent = async () => {
    let title = '';
    if (newEventType === 'leave') {
      title = assignedToName ? `${assignedToName} - Leave` : 'Leave';
    } else {
      title = `${newEventType.charAt(0).toUpperCase() + newEventType.slice(1)}`;
    }

    try {
      let start: Date, end: Date;

      if (isAllDay) {
        start = new Date(newEventStartDate);
        start.setHours(0, 0, 0, 0);

        end = new Date(newEventEndDate);
        end.setHours(23, 59, 59, 999);
      } else {
        start = new Date(`${newEventStartDate}T${newEventTime}`);
        end = new Date(`${newEventStartDate}T${newEventEndTime}`);
      }

      const finalDescription = newEventType === 'leave' && assignedToName
        ? `On Leave: ${assignedToName}\n\n${newEventDescription}`
        : newEventDescription;

      await CalendarService.createEvent({
        title: title,
        description: finalDescription,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        event_type: newEventType,
        is_all_day: isAllDay,
        location: '',
        coverage_details: coverageDetails.filter(d => d.name.trim() !== '')
      });

      setShowAddEvent(false);
      fetchEvents();
    } catch (e) {
      console.error("Error creating event", e);
      alert("Failed to create event");
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



  return (
    <div className="px-6 pt-8 pb-12 flex flex-col lg:h-full min-h-screen animate-in fade-in duration-500 max-w-7xl mx-auto w-full relative">
      {/* Top Header with Search and Filter */}
      <header className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">


          {/* Title Row */}
          <div className="w-full xl:w-auto mb-2 xl:mb-0">
            <h1 className="text-3xl font-bold text-white tracking-tight whitespace-nowrap">{monthNames[month]} <span className="text-slate-500 font-light">{year}</span></h1>
          </div>

          {/* Controls Container */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:w-auto">

            {/* Row 1 (Mobile): Nav + Add Event */}
            <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
              <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 shrink-0">
                <button onClick={prevMonth} className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                  <span className="material-icons text-xl">chevron_left</span>
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all uppercase tracking-wide">
                  Today
                </button>
                <button onClick={nextMonth} className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                  <span className="material-icons text-xl">chevron_right</span>
                </button>
              </div>

              <button
                onClick={() => setShowAddEvent(true)}
                className="flex-1 md:flex-initial bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
              >
                <span className="material-icons text-lg">add</span>
                Add Event
              </button>
            </div>

            {/* Row 2 (Mobile): Filter + Search */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Filter Dropdown */}
              <div className="relative group z-50 shrink-0">
                <button className="flex items-center gap-2 bg-[#09101d] border border-white/5 text-slate-300 hover:text-white px-4 py-3 rounded-xl transition-all text-sm font-medium justify-between min-w-[140px]">
                  <span className="truncate">{activeFilter === 'all' ? 'All Events' : (activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1))}</span>
                  <span className="material-icons text-lg text-slate-500 group-hover:text-white transition-colors">filter_list</span>
                </button>

                {/* Dropdown Menu */}
                <div className="absolute left-0 md:left-auto md:right-0 top-full mt-2 w-48 md:w-56 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left md:origin-top-right scale-95 group-hover:scale-100">
                  <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {([
                      { id: 'all', label: 'All Events' },
                      { id: 'leave', label: 'Leaves' },
                      { id: 'exam', label: 'Exams' },
                      { id: 'lecture', label: 'Lectures' },
                      { id: 'meeting', label: 'Meetings' },
                      { id: 'pcr', label: 'PCR' },
                      { id: 'pickleball', label: 'Pickleball' }
                    ] as { id: EventType | 'all', label: string }[]).map(filter => (
                      <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-all border-b border-white/5 last:border-0 hover:bg-white/5 flex items-center justify-between
                              ${activeFilter === filter.id
                            ? 'text-primary bg-primary/5'
                            : 'text-slate-400'
                          }`}
                      >
                        {filter.label}
                        {activeFilter === filter.id && <span className="material-icons text-sm">check</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex-1 relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-500 group-focus-within:text-white transition-colors text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#09101d] border border-white/5 rounded-xl pl-10 pr-3 py-3 text-sm text-white focus:bg-[#0f172a] focus:border-white/10 focus:ring-1 focus:ring-white/10 outline-none transition-all placeholder:text-slate-600 shadow-inner"
                />
              </div>
            </div>

          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 lg:overflow-hidden relative z-0">
        {/* Calendar Grid */}
        <div className="flex-[2] flex flex-col gap-6 lg:overflow-hidden">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full flex flex-col">
            <div className="grid grid-cols-7 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 flex-1 content-start">
              {padding.map((_, i) => <div key={`p-${i}`} className="aspect-square"></div>)}
              {days.map(day => {
                const dotTypes = getEventTypesForDay(day);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all hover:bg-white/5 group ${isSelected(day) ? 'bg-primary text-white shadow-[0_0_20px_rgba(13,162,231,0.4)] z-10 scale-105' :
                      isToday(day) ? 'text-primary border border-primary/30 bg-primary/5' : 'text-slate-300'
                      }`}
                  >
                    <span className={`text-sm font-medium ${isToday(day) && !isSelected(day) ? 'font-bold' : ''}`}>{day}</span>

                    {/* Colored Event Dots */}
                    <div className="absolute bottom-2 flex gap-1 justify-center px-1 w-full">
                      {dotTypes.map(type => (
                        <span
                          key={type}
                          className={`w-1.5 h-1.5 rounded-full ${isSelected(day) ? 'bg-white' : eventDotColors[type] || 'bg-slate-400'}`}
                        ></span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>


        </div>

        {/* Agenda */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6 lg:overflow-hidden relative">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex-1 lg:overflow-hidden flex flex-col relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-icons text-sm">view_agenda</span> Agenda
              </h3>
              <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-400 border border-white/5">
                {searchQuery ? `Searching "${searchQuery}"` : isSelectedDateToday() ? 'Upcoming' : `For ${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()].substring(0, 3)}`}
              </span>
            </div>

            {/* PADDED CONTAINER to fix Agenda overlap - Increased to pb-40 */}
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2 pb-40">
              {agendaEvents.length > 0 ? (
                agendaEvents.map(event => (
                  <div key={event.id} className="flex gap-4 items-center p-4 rounded-2xl bg-[#09101d] border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">

                    {/* Boxed Date Style */}
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-800/50 rounded-xl border border-white/10 shrink-0">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{new Date(event.start_time).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                      <span className="text-lg font-black text-white leading-none">{new Date(event.start_time).getDate()}</span>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h4 className="text-sm font-bold text-white truncate leading-tight mb-1">{event.title}</h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {event.is_all_day ? 'All Day' : new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>

                      {/* Coverage Pills if any */}
                      {event.coverage_details && event.coverage_details.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {event.coverage_details.map((d: any, idx) => (
                            <span key={idx} className="text-[9px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 border border-purple-500/10">
                              <span className="material-icons text-[9px] rotate-180">reply</span>
                              {d.name || d.user?.full_name?.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Badge Style */}
                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${eventTypeStyles[event.event_type]}`}>
                      {event.event_type}
                    </div>

                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center opacity-40">
                  <span className="material-icons text-3xl text-slate-600 mb-2">event_busy</span>
                  <p className="text-xs text-slate-500 font-medium">No events for this period</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Render Portal Modal directly without nested component */}
      {showAddEvent && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-[#050B14] animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-white/10 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-visible flex flex-col h-auto max-h-full">

            <div className="absolute top-4 right-4 z-50">
              <button onClick={() => setShowAddEvent(false)} className="bg-white/5 hover:bg-white/10 rounded-full p-2 text-slate-400 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-1 pb-4">

              {/* Type Selection */}
              <div className="pt-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 block">Select Event Type</label>
                <div className="flex flex-wrap gap-2">
                  {allowedTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setNewEventType(type as EventType)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize shadow-sm flex-1 outline-none ring-offset-2 ring-offset-[#0f172a] focus:ring-2
                                            ${newEventType === type ? eventTypeColors[type] + ' ring-primary/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
                                        `}
                    >
                      {type === 'pcr' ? 'PCR' : type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <span className="material-icons text-base text-primary">event_note</span> Date & Time
                  </span>

                  <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${isAllDay ? 'bg-primary/20 border-primary/50 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                    onClick={() => setIsAllDay(!isAllDay)}
                  >
                    <div className={`w-2 h-2 rounded-full ${isAllDay ? 'bg-primary' : 'bg-slate-500'}`}></div>
                    <span className="text-[10px] font-bold uppercase tracking-wide">All Day</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-bold pl-1">Starts</label>
                    <input
                      type="date"
                      value={newEventStartDate}
                      onChange={(e) => setNewEventStartDate(e.target.value)}
                      className="w-full bg-[#050b14] rounded-xl px-3 py-3 text-xs text-white border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all shadow-inner"
                    />
                    {!isAllDay && (
                      <input
                        type="time"
                        value={newEventTime}
                        onChange={(e) => setNewEventTime(e.target.value)}
                        className="w-full bg-[#050b14] rounded-xl px-3 py-3 text-xs text-white border border-white/10 focus:border-primary/50 outline-none transition-all shadow-inner"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-bold pl-1">Ends</label>
                    <input
                      type="date"
                      value={newEventEndDate}
                      onChange={(e) => setNewEventEndDate(e.target.value)}
                      className="w-full bg-[#050b14] rounded-xl px-3 py-3 text-xs text-white border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all shadow-inner"
                    />
                    {!isAllDay && (
                      <input
                        type="time"
                        value={newEventEndTime}
                        onChange={(e) => setNewEventEndTime(e.target.value)}
                        className="w-full bg-[#050b14] rounded-xl px-3 py-3 text-xs text-white border border-white/10 focus:border-primary/50 outline-none transition-all shadow-inner"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Basic Who/Title Input always visible */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block pl-1">
                  {newEventType === 'leave' ? 'Who is on Leave?' : 'Title'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-500 text-sm">
                    {newEventType === 'leave' ? 'person' : 'title'}
                  </span>
                  <input
                    type="text"
                    value={assignedToName}
                    onChange={(e) => setAssignedToName(e.target.value)}
                    placeholder={newEventType === 'leave' ? "Enter name (e.g., Dr. Reyes)" : "Event Title"}
                    className="w-full bg-slate-900 border border-white/5 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                    autoFocus // Add autoFocus to help focus
                  />
                </div>
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
                    <div className="bg-slate-900/30 rounded-2xl border border-white/5 p-4">
                      <div
                        className="flex justify-between items-center cursor-pointer mb-3"
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-icons text-xs text-purple-400">group_add</span> Coverage
                        </span>
                      </div>

                      <div className="space-y-3">
                        {coverageDetails.map((detail, idx) => (
                          <div key={idx} className="bg-[#050b14] p-3 rounded-xl border border-white/5 animate-in slide-in-from-right-2">
                            <div className="flex gap-2 mb-2">
                              <input
                                type="text"
                                value={detail.name}
                                onChange={(e) => updateCoverageName(idx, e.target.value)}
                                placeholder="Who is covering?"
                                className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none border border-white/5 placeholder:text-slate-600 focus:border-purple-500/50"
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
                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 text-xs font-bold hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                          >
                            <span className="material-icons text-sm">add</span> Add Coverage
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
                      className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none resize-none placeholder:text-slate-600"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 mt-2 border-t border-white/5">
              <button
                onClick={handleCreateEvent}
                className="w-full py-4 text-sm font-bold bg-primary hover:bg-primary-dark text-white rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-icons">check</span>
                Save Event
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default CalendarScreen;
