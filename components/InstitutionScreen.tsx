
import React from 'react';

const InstitutionScreen: React.FC = () => {
    const departments = [
        { name: 'Neuroradiology', location: 'Wing A, 2nd Floor', extension: '201' },
        { name: 'Interventional', location: 'Wing B, 1st Floor', extension: '205' },
        { name: 'MRI Center', location: 'Wing C, Ground Floor', extension: '300' },
        { name: 'CT Scan', location: 'Wing C, Ground Floor', extension: '302' },
        { name: 'Ultrasound', location: 'Wing A, 1st Floor', extension: '210' },
    ];

    return (
        <div className="px-6 pt-12 pb-12 flex flex-col min-h-full animate-in fade-in duration-700">
            <header className="mb-8">
                <h1 className="text-xl font-medium text-white tracking-tight">Institution</h1>
                <p className="text-slate-500 text-[11px] uppercase tracking-[0.2em] mt-1">Chong Hua Hospital</p>
            </header>

            <div className="space-y-6">
                {/* Hospital Info Card */}
                <div className="glass-card-enhanced p-5 rounded-xl border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <h2 className="text-lg font-bold text-white mb-1">Cebu City Medical Center</h2>
                            <p className="text-xs text-slate-400">Department of Radiology</p>
                        </div>
                        <span className="material-icons text-white/20 text-4xl">local_hospital</span>
                    </div>
                    <div className="mt-6 space-y-2">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <span className="material-icons text-base text-primary">phone</span>
                            <span>(032) 255-8000</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <span className="material-icons text-base text-primary">location_on</span>
                            <span>Fuente Osmeña Blvd, Cebu City</span>
                        </div>
                    </div>
                </div>

                {/* Department Directory */}
                <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-4 ml-1">Department Directory</h3>
                    <div className="space-y-2">
                        {departments.map((dept, idx) => (
                            <div key={idx} className="glass-card-enhanced p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold text-white">{dept.name}</h4>
                                    <p className="text-[11px] text-slate-500">{dept.location}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">Ext. {dept.extension}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstitutionScreen;
