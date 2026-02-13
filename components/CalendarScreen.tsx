
import React, { useState } from 'react';
import { MOCK_EVENTS } from '../constants';
import { CalendarEvent } from '../types';

const CalendarScreen: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth(year, month) }, (_, i) => null);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (day: number) => {
    return selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  };

  const hasEvents = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return MOCK_EVENTS.some(e => e.date === dateStr);
  };

  const getEventsForSelected = () => {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    return MOCK_EVENTS.filter(e => e.date === dateStr);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const eventTypeStyles = {
    rounds: 'bg-orange-500/20 text-orange-400 border-orange-500/20',
    consultation: 'bg-primary/20 text-primary border-primary/20',
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
              className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all hover:bg-white/5 ${
                isSelected(day) ? 'bg-primary text-white shadow-[0_0_15px_rgba(13,162,231,0.4)]' : 
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

      {/* Events for Selected Day */}
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
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
              <div className={`w-1 h-10 rounded-full ${event.type === 'rounds' ? 'bg-orange-500' : event.type === 'consultation' ? 'bg-primary' : 'bg-indigo-500'}`}></div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-sm font-bold text-white">{event.title}</h4>
                  <span className="text-[10px] text-slate-500 font-bold">{event.time}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {event.description || 'No additional details provided for this event.'}
                </p>
                <div className="mt-2 flex gap-2">
                  <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-md border ${eventTypeStyles[event.type]}`}>
                    {event.type}
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

      {/* Simple Add Event Modal Placeholder */}
      {showAddEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card-enhanced w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-bold text-white mb-4">New Event</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 block">Title</label>
                <input type="text" placeholder="Event name" className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-0" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 block">Time</label>
                <input type="time" className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-0" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddEvent(false)} className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white bg-white/5 rounded-xl transition-all">Cancel</button>
              <button onClick={() => setShowAddEvent(false)} className="flex-1 py-3 text-xs font-bold bg-primary text-white rounded-xl shadow-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarScreen;
