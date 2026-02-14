import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { PROFILE_IMAGE } from '../constants';

interface ProfileScreenProps {
  onEditCase?: (caseItem: any) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onEditCase }) => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [profile, setProfile] = useState({
    full_name: '',
    username: '',
    bio: '',
    year_level: '',
    specialty: 'Radiology', // Default, kept for UI if needed or add to DB
    avatar_url: ''
  });
  const [myCases, setMyCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  useEffect(() => {
    getProfile();
    getMyCases();
  }, []);

  const getMyCases = async () => {
    try {
      setLoadingCases(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyCases(data || []);
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoadingCases(false);
    }
  };

  const getProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('No user');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          username: data.username || '',
          bio: data.bio || '',
          year_level: data.year_level || '',
          specialty: 'Radiology', // Hardcoded for now as it was removed from DB req
          avatar_url: data.avatar_url || ''
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    try {
      setUpdating(true);
      setMessage(null);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('No user');

      const updates = {
        id: user.id,
        full_name: profile.full_name,
        username: profile.username,
        bio: profile.bio,
        year_level: profile.year_level,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => {
        setIsEditing(false);
        setMessage(null);
      }, 1500);

    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || 'Error updating profile' });
    } finally {
      setUpdating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading profile...</div>;
  }

  return (
    <div className="px-6 pt-12 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Resident Identity Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="relative mb-4">
          <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-blue-600 rounded-full blur opacity-25"></div>
          <div className="relative w-24 h-24 rounded-full p-1 border border-white/10 glass-card-enhanced">
            <img
              src={profile.avatar_url || PROFILE_IMAGE}
              alt="Profile"
              className="w-full h-full rounded-full object-cover shadow-2xl"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shadow-lg border-2 border-[#050B14]">
              <span className="text-[10px] font-bold">{profile.year_level || 'R1'}</span>
            </div>
          </div>
        </div>

        {/* View Mode Header */}
        {!isEditing && (
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white mb-0.5">{profile.full_name || 'Doctor'}</h1>
            <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
              {profile.year_level || 'Resident'} • {profile.specialty}
            </p>
            <p className="text-slate-400 text-xs italic max-w-xs mx-auto">"{profile.bio || 'No bio yet.'}"</p>
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
              <input
                name="full_name"
                value={profile.full_name}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="Dr. Alex Smith"
              />
            </div>
            <div>
              <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Username</label>
              <input
                name="username"
                value={profile.username}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="asmith"
              />
            </div>
            <div>
              <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bio</label>
              <textarea
                name="bio"
                value={profile.bio}
                onChange={handleChange}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                placeholder="Resident physician..."
              />
            </div>
            <div>
              <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Year Level</label>
              <input
                name="year_level"
                value={profile.year_level}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="e.g. R1, R2, Fellow"
              />
            </div>
          </div>
        )}

        {message && (
          <div className={`mt-4 px-4 py-2 rounded-lg text-xs font-bold ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {message.text}
          </div>
        )}

      </div>

      {/* Actions */}
      <div className="space-y-3 mt-8">
        {isEditing ? (
          <>
            <button
              onClick={updateProfile}
              disabled={updating}
              className="w-full py-4 bg-primary hover:bg-primary-dark rounded-2xl flex items-center justify-center gap-3 text-xs font-bold text-white transition-all uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => { setIsEditing(false); setMessage(null); }}
              className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center gap-3 text-xs font-bold text-slate-400 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-xs font-bold text-white transition-all uppercase tracking-widest"
          >
            <span className="material-icons text-sm">edit</span>
            Edit Profile
          </button>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full py-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-center justify-center gap-3 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all uppercase tracking-widest"
        >
          <span className="material-icons text-lg">logout</span>
          Sign Out
        </button>
      </div>

      {/* My Cases Section */}
      <div className="mt-10">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">My Case Library</h2>

        {loadingCases ? (
          <div className="text-center py-8 text-slate-500 text-xs">Loading cases...</div>
        ) : myCases.length === 0 ? (
          <div className="glass-card-enhanced p-8 rounded-2xl flex flex-col items-center justify-center text-center opacity-80">
            <span className="material-icons text-4xl text-slate-600 mb-2">folder_open</span>
            <p className="text-slate-400 text-xs">No cases uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myCases.map((c) => (
              <div key={c.id} className="glass-card-enhanced p-4 rounded-xl border border-white/5 flex items-center gap-4 hover:bg-white/5 transition-all group">
                <div className="w-16 h-16 rounded-lg bg-black/50 border border-white/10 overflow-hidden shrink-0">
                  {c.image_url ? (
                    <img src={c.image_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <span className="material-icons text-xl">image</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-bold text-white truncate pr-2">{c.title}</h4>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${c.status === 'published' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {c.status || 'Draft'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-2">{c.analysis_result?.impression || c.findings || 'No description'}</p>
                  <p className="text-[9px] text-slate-600 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>

                <button
                  onClick={() => onEditCase && onEditCase(c)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-primary transition-colors"
                >
                  <span className="material-icons text-base">edit</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center mt-12 text-[9px] text-slate-700 font-bold uppercase tracking-[0.4em]">
        Department Portal v3.2.0
      </p>
    </div>
  );
};

export default ProfileScreen;
