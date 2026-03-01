import React, { useEffect, useState, useRef } from 'react';

// Simulated events for the Battle Chat / Activity Log
const BATTLE_LOG_EVENTS = [
    "A wild [Consultant] appeared at MRI!",
    "[Resident] Level 2 claimed Workstation 4.",
    "[Fellow] cast 'Review Scan'. It's super effective!",
    "[Secretary] updated the Census.",
    "[Resident] Level 1 is idling at GenRad.",
    "System: Daily tasks reset."
];

const BattleChatLog: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const endOfLogRef = useRef<HTMLDivElement>(null);

    // Simulate incoming events
    useEffect(() => {
        // Initial set
        setLogs([
            "Welcome to the Live Map Zone.",
            "Radar online. Tracking local radiologists..."
        ]);

        const interval = setInterval(() => {
            const randomEvent = BATTLE_LOG_EVENTS[Math.floor(Math.random() * BATTLE_LOG_EVENTS.length)];
            setLogs(prev => {
                const newLogs = [...prev, `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${randomEvent}`];
                // Keep only last 20 messages
                if (newLogs.length > 20) newLogs.shift();
                return newLogs;
            });
        }, 8000); // 8 seconds

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        endOfLogRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="flex flex-col h-48 border-t border-white/10 bg-[#0a1018] shrink-0 mt-auto shadow-[inset_0_4px_15px_rgba(0,0,0,0.5)]">
            <div className="px-4 py-2 border-b border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent flex items-center gap-2">
                <span className="material-icons text-[14px] text-emerald-400">terminal</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none mt-0.5">Activity Log</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide font-mono text-[10px]">
                {logs.map((log, index) => (
                    <div
                        key={index}
                        className={`leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300 ${index === logs.length - 1 ? 'text-white' : 'text-slate-400'}`}
                    >
                        {/* Simple syntax highlighting for RPG terms */}
                        {log.split(/(\[.*?\])/g).map((part, i) => {
                            if (part.startsWith('[') && part.endsWith(']')) {
                                return <span key={i} className="text-cyan-400 font-bold">{part}</span>;
                            }
                            return part;
                        })}
                    </div>
                ))}
                <div ref={endOfLogRef} />
            </div>
        </div>
    );
};

export default BattleChatLog;
