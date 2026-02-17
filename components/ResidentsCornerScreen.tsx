
import React, { useState } from 'react';
import { RESIDENT_TOOLS } from '../constants';

// Mock data for initial state
const INITIAL_COVER = [
    { id: '1', modality: 'CT Scan', primary: 'Dr. Reynolds', covering: 'Dr. Emily Chen' },
    { id: '2', modality: 'MRI', primary: 'Dr. House', covering: 'Dr. Wilson' },
    { id: '3', modality: 'Ultrasound', primary: 'Dr. Cuddy', covering: 'Dr. Chase' },
    { id: '4', modality: 'X-Ray', primary: 'Dr. Dorian', covering: 'Dr. Turk' },
    { id: '5', modality: 'Interventional', primary: 'Dr. Shepherd', covering: 'Dr. Grey' },
];

const ResidentsCornerScreen: React.FC = () => {
    const [coverData, setCoverData] = useState(INITIAL_COVER);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempCovering, setTempCovering] = useState('');

    const handleEdit = (id: string, currentCovering: string) => {
        setEditingId(id);
        setTempCovering(currentCovering);
    };

    const handleSave = (id: string) => {
        setCoverData(prev => prev.map(item =>
            item.id === id ? { ...item, covering: tempCovering } : item
        ));
        setEditingId(null);
    };

    return (
        <div className="px-6 pt-12 pb-24 flex flex-col min-h-full animate-in fade-in duration-700">
            <header className="mb-8">
                <h1 className="text-xl font-bold text-white tracking-tight">Resident's Corner</h1>
                <p className="text-slate-500 text-[11px] uppercase tracking-[0.2em] mt-1">Tools & Cover</p>
            </header>

            <div className="space-y-8">
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

                {/* Consultant Cover Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <span className="material-icons text-lg text-rose-500">medical_services</span>
                            Consultant Cover
                        </h2>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20">Live Updates</span>
                    </div>

                    <div className="glass-card-enhanced rounded-xl border border-white/10 overflow-hidden">
                        <div className="grid grid-cols-12 bg-white/5 p-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            <div className="col-span-4">Modality</div>
                            <div className="col-span-4">Primary</div>
                            <div className="col-span-4">Covering</div>
                        </div>
                        <div className="divide-y divide-white/5">
                            {coverData.map((item) => (
                                <div key={item.id} className="grid grid-cols-12 p-4 items-center gap-2 hover:bg-white/5 transition-colors">
                                    <div className="col-span-4">
                                        <span className="text-sm font-medium text-white block">{item.modality}</span>
                                    </div>
                                    <div className="col-span-4">
                                        <span className="text-xs text-slate-400 block">{item.primary}</span>
                                    </div>
                                    <div className="col-span-4 relative group/edit">
                                        {editingId === item.id ? (
                                            <div className="flex items-center gap-2 animate-in fadeIn duration-200">
                                                <input
                                                    autoFocus
                                                    className="w-full bg-[#050B14] border border-primary/50 text-xs text-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                    value={tempCovering}
                                                    onChange={(e) => setTempCovering(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSave(item.id)}
                                                    onBlur={() => handleSave(item.id)}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="flex items-center justify-between cursor-pointer group-hover/edit:text-primary transition-colors"
                                                onClick={() => handleEdit(item.id, item.covering)}
                                            >
                                                <span className={`text-xs font-medium ${item.covering !== item.primary ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {item.covering}
                                                </span>
                                                <span className="material-icons text-[14px] text-slate-600 opacity-0 group-hover/edit:opacity-100 transition-opacity">edit</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2 text-center">Tap on a covering consultant to update availability.</p>
                </section>
            </div>
        </div>
    );
};

export default ResidentsCornerScreen;
