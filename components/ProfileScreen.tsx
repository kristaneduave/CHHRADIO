
import React, { useState } from 'react';
import { PROFILE_IMAGE, SPECIALTIES } from '../constants';

const ProfileScreen: React.FC = () => {
  const [settings, setSettings] = useState({
    aiAssistant: true,
    rotationAlerts: true,
    biometrics: true,
    boardReviewMode: true
  });

  const trainingStats = [
    { label: 'Cases Logged', value: '842', icon: 'description', color: 'text-primary' },
    { label: 'Milestones', value: '78%', icon: 'verified', color: 'text-emerald-400' },
    { label: 'Procedures', value: '42', icon: 'medical_services', color: 'text-amber-400' }
  ];

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const SettingRow = ({ label, description, icon, active, onClick }: { label: string, description: string, icon: string, active: boolean, onClick: () => void }) => (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0 group">
      <div className="flex gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${active ? 'bg-primary/10 text-primary' : 'bg-white/5 text-slate-500'}`}>
          <span className="material-icons text-xl">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{label}</h4>
          <p className="text-[10px] text-slate-500 truncate">{description}</p>
        </div>
      </div>
      <button 
        onClick={onClick}
        className="ml-4 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none"
        style={{ backgroundColor: active ? '#0da2e7' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${active ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );

  return (
    <div className="px-6 pt-12 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Resident Identity Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="relative mb-4">
          <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-blue-600 rounded-full blur opacity-25"></div>
          <div className="relative w-24 h-24 rounded-full p-1 border border-white/10 glass-card-enhanced">
            <img 
              src={PROFILE_IMAGE} 
              alt="Profile" 
              className="w-full h-full rounded-full object-cover shadow-2xl grayscale-[0.2]"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shadow-lg border-2 border-[#050B14]">
              <span className="text-[10px] font-bold">R3</span>
            </div>
          </div>
        </div>
        <h1 className="text-xl font-bold text-white mb-0.5">Dr. Alex Smith</h1>
        <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-2">PGY-4 Resident • Neuroradiology</p>
        
        {/* Progress Bar for Residency Year */}
        <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-primary w-[72%] shadow-[0_0_8px_rgba(13,162,231,0.5)]"></div>
        </div>
        <p className="text-slate-600 text-[9px] font-medium uppercase">Residency Completion: 72%</p>
      </div>

      {/* Clinical Dashboard Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {trainingStats.map((stat, i) => (
          <div key={i} className="glass-card-enhanced p-3 rounded-2xl text-center border-white/5">
            <span className={`material-icons text-base mb-1 ${stat.color}`}>{stat.icon}</span>
            <span className="block text-base font-bold text-white">{stat.value}</span>
            <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-tighter">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Current Rotation Block */}
      <div className="glass-card-enhanced p-5 rounded-2xl mb-6 border-l-2 border-l-primary">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Rotation</h3>
            <p className="text-sm font-bold text-white">Advanced Neuro-Interventional</p>
          </div>
          <span className="text-[9px] text-primary font-bold px-2 py-0.5 rounded bg-primary/10">Wk 3/4</span>
        </div>
        <div className="flex items-center gap-3 py-3 border-t border-white/5">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">CV</div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Attending Supervisor</p>
            <p className="text-xs text-slate-200">Dr. Catherine Vance</p>
          </div>
          <button className="ml-auto w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <span className="material-icons text-sm">chat_bubble_outline</span>
          </button>
        </div>
      </div>

      {/* Academic Performance Pulse */}
      <div className="glass-card-enhanced p-5 rounded-2xl mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Academic Pulse</h3>
          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <span className="material-icons text-xs">trending_up</span>
            +12% vs last month
          </span>
        </div>
        <div className="flex items-end justify-between gap-1 h-12 px-1">
          {[40, 65, 45, 80, 55, 90, 85, 95].map((h, i) => (
            <div key={i} className="flex-1 bg-primary/20 rounded-t-sm relative group">
              <div 
                className="absolute bottom-0 left-0 right-0 bg-primary/60 group-hover:bg-primary transition-all rounded-t-sm" 
                style={{ height: `${h}%` }}
              ></div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[8px] text-slate-600 font-bold uppercase">
          <span>Oct 01</span>
          <span>Today</span>
        </div>
      </div>

      {/* Training Settings */}
      <div className="glass-card-enhanced p-5 rounded-2xl mb-6">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Training Preferences</h3>
        <SettingRow 
          label="Radiology AI Copilot" 
          description="Context-aware clinical reasoning support"
          icon="biotech"
          active={settings.aiAssistant}
          onClick={() => toggleSetting('aiAssistant')}
        />
        <SettingRow 
          label="Board Review Reminders" 
          description="Daily high-yield case notifications"
          icon="school"
          active={settings.boardReviewMode}
          onClick={() => toggleSetting('boardReviewMode')}
        />
        <SettingRow 
          label="Rotation Alerts" 
          description="Department-wide schedule changes"
          icon="sync_alt"
          active={settings.rotationAlerts}
          onClick={() => toggleSetting('rotationAlerts')}
        />
      </div>

      {/* Portfolio Actions */}
      <div className="space-y-3">
        <button className="w-full py-4 glass-card-enhanced rounded-2xl flex items-center justify-center gap-3 text-xs font-bold text-white hover:bg-white/5 transition-all uppercase tracking-widest">
          <span className="material-icons text-lg text-slate-500">download</span>
          Export Training Log (PDF)
        </button>
        <button className="w-full py-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-center justify-center gap-3 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all uppercase tracking-widest">
          <span className="material-icons text-lg">logout</span>
          End Session
        </button>
      </div>

      <p className="text-center mt-8 text-[9px] text-slate-700 font-bold uppercase tracking-[0.4em]">
        Department Portal v3.1.0
      </p>
    </div>
  );
};

export default ProfileScreen;
