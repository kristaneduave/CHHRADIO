
import React, { useState, useEffect } from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen } from '../types';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-[#050B14] pb-24">
      {/* Glass App Bar (Sticky Header) */}
      <header className="sticky top-0 z-50 bg-[#050B14]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-[0.1em]">
            CHH RADIOLOGY
          </h1>
          <p className="text-[10px] text-cyan-500 font-bold tracking-widest uppercase opacity-80">
            {format(new Date(), 'EEEE, MMM d')}
          </p>
        </div>

        <button
          onClick={() => onNavigate('profile')}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden hover:border-cyan-500/50 transition-colors"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="material-icons text-slate-400">person</span>
          )}
        </button>
      </header>

      {/* Welcome Section */}
      <section className="px-6 pt-8 pb-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <h2 className="text-2xl font-light text-white mb-1">
          {getTimeGreeting()}, <br />
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            {profile?.nickname || profile?.full_name?.split(' ')[0] || 'Doctor'}
          </span>
        </h2>
      </section>

      {/* Quick Actions Grid (The Boxes) */}
      <section className="px-6 pb-24">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 pl-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="glass-card-enhanced group p-5 rounded-2xl border border-white/5 hover:border-cyan-500/30 hover:bg-white/5 transition-all active:scale-[0.98] flex flex-col items-start gap-4 relative overflow-hidden shadow-lg"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Hover Glow Effect */}
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

              <div className={`w-12 h-12 rounded-xl bg-slate-800/50 border border-white/5 flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform duration-300 shadow-inner relative z-10`}>
                <span className="material-icons text-2xl">{action.icon}</span>
              </div>

              <div className="relative z-10 w-full">
                <span className="block text-sm font-bold text-slate-200 group-hover:text-white transition-colors leading-tight mb-1">
                  {action.label}
                </span>
                <span className="block text-[10px] text-slate-500 font-medium group-hover:text-slate-400 transition-colors line-clamp-1">
                  {action.subtitle}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
