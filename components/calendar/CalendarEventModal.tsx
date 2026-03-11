import React from 'react';
import ReactDOM from 'react-dom';
import { EventType } from '../../types';
import { CalendarViewport } from './types';

interface ValidationErrors {
  title?: string;
  date?: string;
  time?: string;
}

interface CoverageDetail {
  user_id: string;
  name: string;
  modalities: string[];
}

interface CalendarEventModalProps {
  isOpen: boolean;
  viewport: CalendarViewport;
  editingEventId: string | null;
  selectedDateLabel: string;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
  allowedTypes: EventType[];
  availableModalities: string[];
  eventTypeColors: Record<EventType, string>;
  newEventType: EventType;
  isAllDay: boolean;
  newEventStartDate: string;
  newEventEndDate: string;
  newEventTime: string;
  newEventEndTime: string;
  assignedToName: string;
  newEventDescription: string;
  showMoreOptions: boolean;
  coverageDetails: CoverageDetail[];
  onClose: () => void;
  onSave: () => void;
  setNewEventType: (value: EventType) => void;
  setIsAllDay: (value: boolean) => void;
  setNewEventStartDate: (value: string) => void;
  setNewEventEndDate: (value: string) => void;
  setNewEventTime: (value: string) => void;
  setNewEventEndTime: (value: string) => void;
  setAssignedToName: (value: string) => void;
  setNewEventDescription: (value: string) => void;
  setShowMoreOptions: (value: boolean) => void;
  addCoverage: () => void;
  removeCoverage: (index: number) => void;
  updateCoverageName: (index: number, name: string) => void;
  toggleCoverageModality: (index: number, modality: string) => void;
}

const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  viewport,
  editingEventId,
  selectedDateLabel,
  isSubmitting,
  validationErrors,
  allowedTypes,
  availableModalities,
  eventTypeColors,
  newEventType,
  isAllDay,
  newEventStartDate,
  newEventEndDate,
  newEventTime,
  newEventEndTime,
  assignedToName,
  newEventDescription,
  showMoreOptions,
  coverageDetails,
  onClose,
  onSave,
  setNewEventType,
  setIsAllDay,
  setNewEventStartDate,
  setNewEventEndDate,
  setNewEventTime,
  setNewEventEndTime,
  setAssignedToName,
  setNewEventDescription,
  setShowMoreOptions,
  addCoverage,
  removeCoverage,
  updateCoverageName,
  toggleCoverageModality,
}) => {
  if (!isOpen) return null;

  const isDesktop = viewport === 'desktop';

  return ReactDOM.createPortal(
    <div className={`fixed inset-0 z-50 animate-in fade-in duration-200 ${isDesktop ? 'flex items-center justify-center p-6' : 'flex items-end justify-center p-0'}`}>
      <div className="fixed inset-0 bg-app/90 backdrop-blur-md transition-opacity" onClick={onClose} />
      <div
        data-testid={isDesktop ? 'calendar-event-modal-desktop' : 'calendar-event-modal-sheet'}
        className={`relative z-10 flex flex-col overflow-hidden border border-white/5 bg-[#0B101A] ${
          isDesktop
            ? 'w-full max-w-lg rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] max-h-[90vh]'
            : 'w-full rounded-t-[2rem] max-h-[92vh] min-h-[78vh]'
        }`}
      >
        <div className="p-5 bg-black/40 border-b border-white/5 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 blur-[60px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                <span className="material-icons text-sky-400 text-sm">event</span>
              </div>
              {editingEventId ? 'Edit event' : `Add event on ${selectedDateLabel}`}
            </h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close event modal"
            >
              <span className="material-icons text-xl">close</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="pt-2">
            <label className="text-[11px] text-slate-400 font-medium block mb-1.5 ml-1">Select event type</label>
            <div className="flex flex-wrap gap-2">
              {allowedTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setNewEventType(type)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize shadow-sm flex-1 outline-none ring-offset-2 ring-offset-[#0B101A] focus:ring-2 ${
                    newEventType === type
                      ? `${eventTypeColors[type]} ring-primary/50`
                      : 'bg-black/40 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {type === 'pcr' ? 'PCR' : type}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <span className="material-icons text-base text-sky-400">event_note</span> Date &amp; Time
              </span>

              <button
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${
                  isAllDay ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' : 'bg-black/40 border-white/5 text-slate-500 hover:bg-white/5'
                }`}
                onClick={() => setIsAllDay(!isAllDay)}
              >
                <div className={`w-2 h-2 rounded-full ${isAllDay ? 'bg-sky-500' : 'bg-slate-500'}`} />
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
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600"
                />
                {!isAllDay ? (
                  <input
                    type="time"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 mt-2"
                  />
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium block mb-1.5 ml-1">Ends</label>
                <input
                  type="date"
                  value={newEventEndDate}
                  onChange={(e) => setNewEventEndDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600"
                />
                {!isAllDay ? (
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={(e) => setNewEventEndTime(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 mt-2"
                  />
                ) : null}
              </div>
            </div>
            {validationErrors.date ? <p className="mt-2 text-xs text-rose-300">{validationErrors.date}</p> : null}
            {validationErrors.time ? <p className="mt-1 text-xs text-rose-300">{validationErrors.time}</p> : null}
          </div>

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
                placeholder={newEventType === 'leave' ? 'Enter name (e.g., Dr. Reyes)' : 'Event Title'}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600"
              />
            </div>
            {validationErrors.title ? <p className="mt-1 text-xs text-rose-300">{validationErrors.title}</p> : null}
          </div>

          <button
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"
          >
            <span className="material-icons text-sm">{showMoreOptions ? 'expand_less' : 'expand_more'}</span>
            {showMoreOptions ? 'Hide details' : 'More options (Coverage, Notes)'}
          </button>

          {showMoreOptions ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              {newEventType === 'leave' ? (
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
                  <div className="flex justify-between items-center cursor-pointer mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-icons text-xs text-purple-400">group_add</span> Coverage
                    </span>
                  </div>

                  <div className="space-y-3">
                    {coverageDetails.map((detail, index) => (
                      <div key={index} className="bg-black/40 p-3 rounded-xl border border-white/5 animate-in slide-in-from-right-2">
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={detail.name}
                            onChange={(e) => updateCoverageName(index, e.target.value)}
                            placeholder="Who is covering?"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all placeholder:text-slate-600"
                          />

                          <button
                            onClick={() => removeCoverage(index)}
                            className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg w-8 flex items-center justify-center transition-colors"
                          >
                            <span className="material-icons text-base">remove</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {availableModalities.map((modality) => {
                            const isActive = detail.modalities?.includes(modality);
                            return (
                              <button
                                key={modality}
                                onClick={() => toggleCoverageModality(index, modality)}
                                className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${
                                  isActive
                                    ? 'bg-purple-500 text-white border-purple-500'
                                    : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'
                                }`}
                              >
                                {modality}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {coverageDetails.length < 5 ? (
                      <button
                        onClick={addCoverage}
                        className="w-full py-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <span className="material-icons text-[20px]">add</span>
                        <span className="text-[13px] font-bold tracking-wide">Add Coverage</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div>
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  rows={3}
                  placeholder="Add notes..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 resize-none"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-5 bg-black/40 border-t border-white/5 flex gap-3 mt-auto shrink-0">
          <button
            onClick={onClose}
            className="px-6 flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-transparent"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSubmitting || !assignedToName.trim()}
            className="px-6 flex-[2] py-2.5 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="material-icons animate-spin text-[16px]">autorenew</span>
                Saving...
              </>
            ) : editingEventId ? (
              'Update event'
            ) : (
              'Create event'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CalendarEventModal;
