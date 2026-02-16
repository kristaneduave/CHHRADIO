import React, { useState, useEffect } from 'react';
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
  const [staffList, setStaffList] = useState<{ id: string, full_name: string }[]>([]);

  // Form state
  // Title is now auto-generated
  const [newEventStartDate, setNewEventStartDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('08:00');
  const [newEventEndTime, setNewEventEndTime] = useState('17:00'); // Default to end of work day
  const [newEventType, setNewEventType] = useState<EventType>('leave'); // Default to Leave as per context of request? Or keep 'meeting'? User focused on Leave.
  const [newEventDescription, setNewEventDescription] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);

  // Leave Specific State
  const [assignedToName, setAssignedToName] = useState(''); // Manual text input

  // Complex Coverage State
  const [coverageDetails, setCoverageDetails] = useState<{ user_id: string, modalities: string[] }[]>([]);
  const [showCoverage, setShowCoverage] = useState(true); // Default open if leave

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

      const upcoming = await CalendarService.getUpcomingEvents(10);
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
      // Reset complex state
      setCoverageDetails([]);
      setShowCoverage(true);
      setNewEventType('leave'); // User seems focused on leave, nice default
      setAssignedToName('');
      setNewEventDescription('');
      setIsAllDay(true);
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
    if (isSelectedDateToday()) {
      return upcomingEvents;
    }

    const startOfSelected = new Date(selectedDate);
    startOfSelected.setHours(0, 0, 0, 0);

    return events
      .filter(e => new Date(e.end_time) >= startOfSelected)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const agendaEvents = getAgendaEvents();

  // Coverage Management
  const addCoverage = () => {
    if (coverageDetails.length < 5) {
      setCoverageDetails([...coverageDetails, { user_id: '', modalities: [] }]);
      setShowCoverage(true);
    }
  };

  const removeCoverage = (index: number) => {
    const newDetails = [...coverageDetails];
    newDetails.splice(index, 1);
    setCoverageDetails(newDetails);
  };

  const updateCoverageUser = (index: number, userId: string) => {
    const newDetails = [...coverageDetails];
    newDetails[index] = { ...newDetails[index], user_id: userId };
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
    // Auto-generate title
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

      // For manual "Who is on Leave", we'll store the name in the description if it's a leave event
      // Or just rely on the Title we generated.
      // But we should probably preserve the description user entered too.
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
        // assigned_to: assignedTo || undefined, // We are not using the DB ID for assigned_to anymore for manual entry
        coverage_details: coverageDetails.filter(d => d.user_id) // Only save if user selected
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
    leave: 'bg-pink-500/20 text-pink-400 border-pink-500/20',
    meeting: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    other: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
  };

  // Updated colors as requested
  const eventTypeColors: Record<EventType, string> = {
    leave: 'bg-rose-600 text-white border-2 border-rose-400/50 shadow-[0_0_15px_rgba(225,29,72,0.4)]', // Red/Pink specific request
    meeting: 'bg-blue-500 text-white border border-blue-400/30',
    lecture: 'bg-purple-500 text-white border border-purple-400/30',
    exam: 'bg-yellow-500 text-white border border-yellow-400/30',
    other: 'bg-slate-600 text-white border border-slate-400/30',
    rotation: 'bg-indigo-500 text-white',
    call: 'bg-red-500 text-white'
  };

  const allowedTypes: EventType[] = ['leave', 'meeting', 'lecture', 'exam', 'other'];
  const availableModalities = ['CT', 'MRI', 'XRay', 'IR', 'Utz'];

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
        {/* Left Column: Calendar Grid */}
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

            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
              {agendaEvents.length > 0 ? (
                agendaEvents.map(event => (
                  <div key={event.id} className="flex gap-3 items-center p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group">
                    {/* Date Box */}
                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center border border-white/5 bg-white/5 shrink-0`}>
                      <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-0.5">{new Date(event.start_time).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-base font-bold text-white leading-none">{new Date(event.start_time).getDate()}</span>
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-primary transition-colors">{event.title}</h4>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ml-2 whitespace-nowrap ${eventTypeStyles[event.event_type]}`}>
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

                        {/* Coverage Info - Supports Multiplex */}
                        {event.coverage_details && event.coverage_details.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {event.coverage_details.map((d: any, idx) => (
                              <span key={idx} className="text-[9px] text-purple-400 bg-purple-500/10 px-1 rounded flex items-center gap-1">
                                <span className="material-icons text-[9px] rotate-180">reply</span>
                                {d.user?.full_name?.split(' ')[0]}
                                {d.modalities && d.modalities.length > 0 && ` (${d.modalities.join(', ')})`}
                              </span>
                            ))}
                          </div>
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

      {/* Refined Add Event Modal - Covering EVERYTHING with Z-Index and Solid Background */}
      {showAddEvent && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-[#050B14] animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-white/10 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-visible flex flex-col h-auto max-h-full">

            <div className="absolute top-4 right-4 z-50">
              <button onClick={() => setShowAddEvent(false)} className="bg-white/5 hover:bg-white/10 rounded-full p-2 text-slate-400 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            {/* Modal Header & Title */}
            {/* Removed Inputs/Titles as requested, minimal header with Type Selection */}
            <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-1">

              {/* Type Selection - Featured */}
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
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time - Clean Row */}
              <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <span className="material-icons text-base text-primary">event_note</span> Date & Time
                  </span>

                  {/* Improved All Day Toggle */}
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

              {/* Leave Logic: Manual Name & Coverage */}
              {(newEventType === 'leave') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block pl-1">Who is on Leave?</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-500 text-sm">person</span>
                      <input
                        type="text"
                        value={assignedToName}
                        onChange={(e) => setAssignedToName(e.target.value)}
                        placeholder="Enter name (e.g., Dr. Reyes)"
                        className="w-full bg-slate-900 border border-white/5 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Coverage Section */}
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
                            <select
                              value={detail.user_id}
                              onChange={(e) => updateCoverageUser(idx, e.target.value)}
                              className="flex-1 bg-slate-800 rounded-lg px-2 py-2 text-xs text-white outline-none border border-white/5"
                            >
                              <option value="">Select Staff Member...</option>
                              {staffList.map(staff => (
                                <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                              ))}
                            </select>
                            <button onClick={() => removeCoverage(idx)} className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg w-8 flex items-center justify-center transition-colors">
                              <span className="material-icons text-base">remove</span>
                            </button>
                          </div>

                          {/* Multi-modality Toggle Pills */}
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
                </div>
              )}

              {/* Description - Simplified */}
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

            {/* Footer Action */}
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
        </div>
      )}
    </div>
  );
};

export default CalendarScreen;
