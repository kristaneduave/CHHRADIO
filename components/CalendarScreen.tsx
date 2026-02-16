import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventType } from '../types';
import { CalendarService } from '../services/CalendarService';
import { LeaveList } from './LeaveList';
import { supabase } from '../services/supabase';

const CalendarScreen: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState('10:00');
  const [newEventType, setNewEventType] = useState<EventType>('meeting');
  const [newEventDescription, setNewEventDescription] = useState('');

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth(year, month) }, (_, i) => null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Fetch for the whole month
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const data = await CalendarService.getEvents(start, end);
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (day: number) => {
    return selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  };

  const getEventsForDay = (day: number) => {
    // Naive check for single day events. 
    // For multi-day (rotations), we need to check overlap.
    const targetStart = new Date(year, month, day, 0, 0, 0);
    const targetEnd = new Date(year, month, day, 23, 59, 59);

    return events.filter(e => {
      const eStart = new Date(e.start_time);
      const eEnd = new Date(e.end_time);
      return eStart <= targetEnd && eEnd >= targetStart;
    });
  };

  const hasEvents = (day: number) => {
    return getEventsForDay(day).length > 0;
  };

  const getEventsForSelected = () => {
    return getEventsForDay(selectedDate.getDate());
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle) return;

    try {
      const start = new Date(selectedDate);
      const [sh, sm] = newEventTime.split(':').map(Number);
      start.setHours(sh, sm);

      const end = new Date(selectedDate);
      const [eh, em] = newEventEndTime.split(':').map(Number);
      end.setHours(eh, em);

      // Handle end time being possibly next day if < start time? No, let's assume same day for simple events
      // For leave, we might want multi-day.

      await CalendarService.createEvent({
        title: newEventTitle,
        description: newEventDescription,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        event_type: newEventType,
        is_all_day: false, // simplified
        location: '',
      });

      setShowAddEvent(false);
      setNewEventTitle('');
      setNewEventDescription('');
      fetchEvents(); // Refresh
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
    <div className="px-6 pt-12 pb-12 flex flex-col h-full animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{monthNames[month]}</h1>
          <p className="text-slate-400 text-xs font-medium tracking-widest uppercase">{year}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="w-10 h-10 rounded-xl glass-card-enhanced flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <span className="material-icons">chevron_left</span>
          </button>
          <button onClick={nextMonth} className="w-10 h-10 rounded-xl glass-card-enhanced flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <span className="material-icons">chevron_right</span>
          </button>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="glass-card-enhanced rounded-2xl p-4 mb-8">
        <div className="grid grid-cols-7 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {padding.map((_, i) => <div key={`p-${i}`} className="aspect-square"></div>)}
          {days.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDate(new Date(year, month, day))}
              className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all hover:bg-white/5 ${isSelected(day) ? 'bg-primary text-white shadow-[0_0_15px_rgba(13,162,231,0.4)]' :
                  isToday(day) ? 'text-primary border border-primary/30' : 'text-slate-300'
                }`}
            >
              {day}
              {hasEvents(day) && !isSelected(day) && (
                <span className="absolute bottom-1.5 w-1 h-1 bg-primary rounded-full"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Events for Selected Day */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-sm font-semibold text-slate-200">
              {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </h3>
            <button
              onClick={() => setShowAddEvent(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-widest hover:text-primary-dark transition-colors"
            >
              <span className="material-icons text-sm">add</span>
              Add Event
            </button>
          </div>

          {getEventsForSelected().length > 0 ? (
            getEventsForSelected().map(event => (
              <div key={event.id} className="glass-card-enhanced p-4 rounded-xl border border-white/5 flex gap-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className={`w-1 h-10 rounded-full ${event.event_type === 'rotation' ? 'bg-purple-500' : event.event_type === 'call' ? 'bg-red-500' : 'bg-primary'}`}></div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-bold text-white">{event.title}</h4>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {event.description || 'No additional details.'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-md border ${eventTypeStyles[event.event_type] || eventTypeStyles.other}`}>
                      {event.event_type}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                <span className="material-icons text-slate-600">event_available</span>
              </div>
              <p className="text-xs text-slate-500">No events scheduled for this day.</p>
            </div>
          )}
        </div>

        {/* Leave List Panel */}
        <div>
          <LeaveList date={selectedDate} />
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card-enhanced w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-bold text-white mb-4">New Event</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 block">Title</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Event name"
                  className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 block">Start Time</label>
                  <input
                    type="time"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 block">End Time</label>
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={(e) => setNewEventEndTime(e.target.value)}
                    className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-0"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 block">Type</label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value as EventType)}
                  className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-0 appearance-none"
                >
                  <option value="meeting" className="bg-slate-900">Meeting</option>
                  <option value="rotation" className="bg-slate-900">Rotation</option>
                  <option value="call" className="bg-slate-900">Call</option>
                  <option value="lecture" className="bg-slate-900">Lecture</option>
                  <option value="exam" className="bg-slate-900">Exam</option>
                  <option value="leave" className="bg-slate-900">Leave</option>
                  <option value="other" className="bg-slate-900">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 block">Description</label>
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-0"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddEvent(false)} className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white bg-white/5 rounded-xl transition-all">Cancel</button>
              <button onClick={handleCreateEvent} className="flex-1 py-3 text-xs font-bold bg-primary text-white rounded-xl shadow-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarScreen;
