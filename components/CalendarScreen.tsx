import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventType } from '../types';
import { CalendarService } from '../services/CalendarService';
import { supabase } from '../services/supabase';

const CalendarScreen: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // We might still fetch upcoming for the "Today" default view if needed, 
  // but let's try to derive everything from 'events' for consistency in the "Month" context
  // actually, for "Today", upcoming is better across month boundaries.
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string, full_name: string }[]>([]);

  // Form state
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStartDate, setNewEventStartDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState('10:00');
  const [newEventType, setNewEventType] = useState<EventType>('meeting');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [coveredBy, setCoveredBy] = useState('');

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth(year, month) }, (_, i) => null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const data = await CalendarService.getEvents(start, end);
      setEvents(data);

      // Still fetch upcoming mostly for the "default" state if we want it, or purely for the Today view
      const upcoming = await CalendarService.getUpcomingEvents(10); // Fetch a bit more to populate list
      setUpcomingEvents(upcoming);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    if (data) setStaffList(data);
  };

  useEffect(() => {
    fetchEvents();
    fetchStaff();
  }, [currentDate]);

  // Pre-fill dates when opening modal
  useEffect(() => {
    if (showAddEvent) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setNewEventStartDate(dateStr);
      setNewEventEndDate(dateStr);
    }
  }, [showAddEvent, selectedDate]);

  // Auto-set all day for leave
  useEffect(() => {
    if (newEventType === 'leave') {
      setIsAllDay(true);
    }
  }, [newEventType]);

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

  const hasEvents = (day: number) => {
    const targetStart = new Date(year, month, day, 0, 0, 0);
    const targetEnd = new Date(year, month, day, 23, 59, 59);
    return events.some(e => {
      const eStart = new Date(e.start_time);
      const eEnd = new Date(e.end_time);
      return eStart <= targetEnd && eEnd >= targetStart;
    });
  };

  const getAgendaEvents = () => {
    // Logic:
    // If Today is selected: Show global "Upcoming Events" (cross-month).
    // If Specific Date selected: Show events starting/occurring on that date onwards (within current view).

    if (isSelectedDateToday()) {
      return upcomingEvents;
    }

    const startOfSelected = new Date(selectedDate);
    startOfSelected.setHours(0, 0, 0, 0);

    // Filter events that END after the start of selected day
    // And Sort by start time
    return events
      .filter(e => new Date(e.end_time) >= startOfSelected)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const agendaEvents = getAgendaEvents();

  const handleCreateEvent = async () => {
    if (!newEventTitle) return;

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

      await CalendarService.createEvent({
        title: newEventTitle,
        description: newEventDescription,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        event_type: newEventType,
        is_all_day: isAllDay,
        location: '',
        assigned_to: assignedTo || undefined,
        covered_by: coveredBy || undefined
      });

      setShowAddEvent(false);
      // Reset form
      setNewEventTitle('');
      setNewEventDescription('');
      setAssignedTo('');
      setCoveredBy('');
      setIsAllDay(false);
      fetchEvents();
    } catch (e) {
      console.error("Error creating event", e);
      alert("Failed to create event");
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const eventTypeStyles: Record<string, string> = {
    rotation: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    call: 'bg-red-500/20 text-red-400 border-red-500/20',
    lecture: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    exam: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    leave: 'bg-pink-500/20 text-pink-400 border-pink-500/20',
    meeting: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20',
    other: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
  };

  return (
    <div className="px-6 pt-8 pb-12 flex flex-col lg:h-full min-h-screen animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
      {/* Top Header with Month and Actions */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{monthNames[month]} <span className="text-slate-500 font-light">{year}</span></h1>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button onClick={prevMonth} className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <span className="material-icons text-xl">chevron_left</span>
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all uppercase tracking-wide">
              Today
            </button>
            <button onClick={nextMonth} className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <span className="material-icons text-xl">chevron_right</span>
            </button>
          </div>
          <button
            onClick={() => setShowAddEvent(true)}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/25 transition-all flex items-center gap-2"
          >
            <span className="material-icons text-lg">add</span>
            Add Event
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 lg:overflow-hidden">
        {/* Left Column: Calendar Grid - Takes more space now */}
        <div className="flex-[2] flex flex-col gap-6 lg:overflow-hidden">
          {/* Calendar Grid */}
          <div className="glass-card-enhanced rounded-2xl p-6 shadow-2xl h-full flex flex-col">
            <div className="grid grid-cols-7 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 flex-1 content-start">
              {padding.map((_, i) => <div key={`p-${i}`} className="aspect-square"></div>)}
              {days.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDate(new Date(year, month, day))}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all hover:bg-white/5 group ${isSelected(day) ? 'bg-primary text-white shadow-[0_0_20px_rgba(13,162,231,0.4)] z-10 scale-105' :
                    isToday(day) ? 'text-primary border border-primary/30 bg-primary/5' : 'text-slate-300'
                    }`}
                >
                  <span className={`text-sm font-medium ${isToday(day) && !isSelected(day) ? 'font-bold' : ''}`}>{day}</span>

                  {/* Event Dots */}
                  {hasEvents(day) && !isSelected(day) && (
                    <div className="absolute bottom-2 flex gap-1">
                      <span className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white transition-colors"></span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Unified Agenda Information */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6 lg:overflow-hidden">

          {/* Unified Agenda List */}
          <div className="glass-card-enhanced rounded-2xl p-6 flex-1 lg:overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-icons text-sm">view_agenda</span> Agenda
              </h3>
              <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-400 border border-white/5">
                {isSelectedDateToday() ? 'Upcoming' : `From ${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()].substring(0, 3)}`}
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
              {agendaEvents.length > 0 ? (
                agendaEvents.map(event => (
                  <div key={event.id} className="flex gap-4 items-center p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group">
                    {/* Date Box */}
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-white/5 bg-white/5 shrink-0`}>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">{new Date(event.start_time).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-lg font-bold text-white">{new Date(event.start_time).getDate()}</span>
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-primary transition-colors">{event.title}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ml-2 whitespace-nowrap ${eventTypeStyles[event.event_type]}`}>
                          {event.event_type}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        {/* Time */}
                        {!event.is_all_day ? (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <span className="material-icons text-[10px]">schedule</span>
                            {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500">All Day</p>
                        )}

                        {/* Assigned / Coverage Info */}
                        {event.user && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-4 h-4 rounded-full bg-slate-700 overflow-hidden shrink-0">
                              {event.user.avatar_url ? (
                                <img src={event.user.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <span className="flex items-center justify-center h-full text-[7px] font-bold text-white">{event.user.full_name?.charAt(0)}</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate">{event.user.full_name}</span>
                          </div>
                        )}

                        {event.covered_user && (
                          <p className="text-[10px] text-purple-400 mt-0.5 flex items-center gap-1">
                            <span className="material-icons text-[10px] rotate-180">reply</span>
                            Covered by {event.covered_user.full_name?.split(' ')[0]}
                          </p>
                        )}
                      </div>
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

            <div className="mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => setShowAddEvent(true)}
                className="w-full py-2.5 rounded-lg border border-dashed border-slate-700 text-slate-400 text-xs font-bold hover:text-white hover:border-slate-500 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-icons text-sm">add_circle_outline</span>
                Add Event for {selectedDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Add Event Modal - Kept the same as it was good */}
      {showAddEvent && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card-enhanced w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">New Event</h3>
                <p className="text-slate-400 text-xs mt-1">Add a new schedule item to the calendar</p>
              </div>
              <button onClick={() => setShowAddEvent(false)} className="text-slate-500 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-5 mb-8">
              {/* Title Input */}
              <div>
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Event Title</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g., Post-duty Leave, Neuro Rotation"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              {/* Type Selection */}
              <div>
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Event Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {['meeting', 'rotation', 'call', 'lecture', 'exam', 'leave', 'other'].map(type => (
                    <button
                      key={type}
                      onClick={() => setNewEventType(type as EventType)}
                      className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all capitalize
                                 ${newEventType === type ? 'bg-primary text-white border-primary' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}
                             `}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Toggle */}
              <div className="flex items-center gap-3 py-1">
                <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${isAllDay ? 'bg-primary' : 'bg-slate-700'}`} onClick={() => setIsAllDay(!isAllDay)}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isAllDay ? 'translate-x-4' : ''}`}></div>
                </div>
                <span className="text-sm font-medium text-slate-300">All Day Event / Range</span>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Start</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newEventStartDate}
                      onChange={(e) => setNewEventStartDate(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-primary outline-none"
                    />
                    {!isAllDay && (
                      <input
                        type="time"
                        value={newEventTime}
                        onChange={(e) => setNewEventTime(e.target.value)}
                        className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-primary outline-none"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">End</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newEventEndDate}
                      onChange={(e) => setNewEventEndDate(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-primary outline-none"
                    />
                    {!isAllDay && (
                      <input
                        type="time"
                        value={newEventEndTime}
                        onChange={(e) => setNewEventEndTime(e.target.value)}
                        className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-primary outline-none"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Staff Selectors - Enhanced Logic */}
              {(newEventType === 'leave' || newEventType === 'call' || newEventType === 'rotation') && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1">
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Assigned To</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-primary outline-none"
                    >
                      <option value="">Select Staff...</option>
                      {staffList.map(staff => (
                        <option key={staff.id} value={staff.id} className="bg-slate-900">{staff.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Covered By (Optional)</label>
                    <select
                      value={coveredBy}
                      onChange={(e) => setCoveredBy(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-primary outline-none"
                    >
                      <option value="">No Coverage / Self</option>
                      {staffList.map(staff => (
                        <option key={staff.id} value={staff.id} className="bg-slate-900">{staff.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Notes / Description</label>
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  rows={3}
                  placeholder="Additional details..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowAddEvent(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all">Cancel</button>
              <button
                onClick={handleCreateEvent}
                disabled={!newEventTitle}
                className="flex-1 py-3.5 text-sm font-bold bg-primary hover:bg-primary-dark text-white rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarScreen;
