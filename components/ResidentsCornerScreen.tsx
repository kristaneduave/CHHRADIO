import React, { useState } from 'react';
import { RESIDENT_TOOLS } from '../constants';
import { CONSULTANT_SCHEDULE } from './consultantScheduleData';

// Mock data for initial state (still potentially useful for other parts, or we might remove if fully replaced)
// Keeping it for now if we want to retain the 'resident cover' concept separately, 
// but the user asked to work on 'resident cover features' -> 'consultant cover', 
// so this might be replacing the previous simple list. 
// I will keep the resident tools section as it was, but replace the 'Consultant Cover' section.

const ResidentsCornerScreen: React.FC = () => {
    const [selectedHospitalId, setSelectedHospitalId] = useState('fuente');
    const [expandedModality, setExpandedModality] = useState<string | null>(null);

    const selectedHospital = CONSULTANT_SCHEDULE.find(h => h.id === selectedHospitalId);

    // Get current day to highlight
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIndex = new Date().getDay();
    const currentDayName = daysOfWeek[currentDayIndex];

    const toggleModality = (modalityId: string) => {
        if (expandedModality === modalityId) {
            setExpandedModality(null);
        } else {
            setExpandedModality(modalityId);
        }
    };

    return (
        <div className="px-6 pt-12 pb-24 flex flex-col min-h-full animate-in fade-in duration-700">
            <header className="mb-8">
                <h1 className="text-xl font-bold text-white tracking-tight">Resident's Corner</h1>
                <p className="text-slate-500 text-[11px] uppercase tracking-[0.2em] mt-1">Tools & Cover</p>
            </header>

            <div className="space-y-8">
                {/* Consultant Cover Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <span className="material-icons text-lg text-rose-500">medical_services</span>
                            Consultant Cover
                        </h2>
                    </div>

                    {/* Hospital Selector */}
                    <div className="flex overflow-x-auto gap-2 mb-4 pb-2 scrollbar-hide">
                        {CONSULTANT_SCHEDULE.map((hospital) => (
                            <button
                                key={hospital.id}
                                onClick={() => setSelectedHospitalId(hospital.id)}
                                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedHospitalId === hospital.id
                                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                {hospital.name}
                            </button>
                        ))}
                    </div>

                    {/* Schedule Display */}
                    <div className="space-y-3">
                        {selectedHospital?.modalities.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-xs italic">
                                Schedule not available yet.
                            </div>
                        ) : (
                            selectedHospital?.modalities.map((modality) => {
                                const isExpanded = expandedModality === modality.id;
                                const todaySchedule = modality.schedule[currentDayName] || [];

                                return (
                                    <div key={modality.id} className="glass-card-enhanced rounded-xl border border-white/10 overflow-hidden">
                                        <div
                                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() => toggleModality(modality.id)}
                                        >
                                            <div>
                                                <h3 className="text-sm font-bold text-white mb-1">{modality.name}</h3>
                                                {/* Today's Preview */}
                                                <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                                                    <span className="text-rose-400 font-medium">Today ({currentDayName}):</span>
                                                    {todaySchedule.length > 0 ? (
                                                        todaySchedule.map((item, i) => (
                                                            <span key={i} className="text-slate-300">
                                                                {item.doctor} <span className="opacity-50">({item.time})</span>
                                                                {i < todaySchedule.length - 1 && ", "}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="italic opacity-50">No schedule</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`material-icons text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                expand_more
                                            </span>
                                        </div>

                                        {/* Expanded Full Week Schedule */}
                                        {isExpanded && (
                                            <div className="border-t border-white/5 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                                {daysOfWeek.map((day) => {
                                                    const daySchedule = modality.schedule[day] || [];
                                                    if (daySchedule.length === 0) return null; // Skip days with no schedule? Or show empty? Let's skip to save space or show "No schedule" if needed.
                                                    // Better to show all days for completeness if requested, but let's hide empty ones for cleaner UI on mobile.
                                                    if (daySchedule.length === 0) return null;

                                                    const isToday = day === currentDayName;

                                                    return (
                                                        <div key={day} className={`p-3 grid grid-cols-12 gap-2 border-b border-white/5 last:border-0 ${isToday ? 'bg-rose-500/10' : ''}`}>
                                                            <div className="col-span-3">
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-rose-400' : 'text-slate-500'}`}>
                                                                    {day.substring(0, 3)}
                                                                </span>
                                                            </div>
                                                            <div className="col-span-9 space-y-1">
                                                                {daySchedule.map((item, idx) => (
                                                                    <div key={idx} className="flex flex-col">
                                                                        <span className="text-xs font-medium text-white">{item.doctor}</span>
                                                                        <span className="text-[10px] text-slate-400">
                                                                            {item.time} {item.subtext && <span className="text-amber-500/80 ml-1">{item.subtext}</span>}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* Tools Section */}
                <section>
                    <h2 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                        <span className="material-icons text-lg text-primary">build</span>
                        Essential Tools
                    </h2>
                    <div className="grid grid-cols-1 gap-3">
                        {RESIDENT_TOOLS.map((tool, idx) => (
                            <a
                                key={idx}
                                href={tool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glass-card-enhanced p-4 rounded-xl border border-white/5 flex items-center gap-4 group hover:bg-white/5 transition-all active:scale-[0.99]"
                            >
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <span className="material-icons text-xl">{tool.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{tool.name}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-1">{tool.description}</p>
                                </div>
                                <span className="material-icons text-slate-600 group-hover:text-slate-300">open_in_new</span>
                            </a>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};


