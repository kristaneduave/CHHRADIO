
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { PROFILE_IMAGE } from '../constants';
import { UserRole } from '../types';
import AdminUserManagement from './AdminUserManagement';
import LoadingButton from './LoadingButton';
import LoadingState from './LoadingState';
import {
  fetchHiddenAnnouncements,
  unhideAllAnnouncementsForUser,
  unhideAnnouncementForUser,
} from '../services/announcementVisibilityService';
import {
  fetchHiddenNotificationsForUser,
  unhideAllNotificationsForUser,
  unhideNotificationForUser,
} from '../services/newsfeedService';
import { toastError, toastSuccess } from '../utils/toast';
import ThemeToggle from './ThemeToggle';

interface ProfileScreenProps {
  onEditCase?: (caseItem: any) => void;
  onViewCase?: (caseItem: any) => void; // Added for navigation
}

const getSubmissionTypeMeta = (submissionType?: string) => {
  switch (submissionType) {
    case 'rare_pathology':
      return {
        icon: 'biotech',
        tintClass: 'text-rose-400',
        boxClass: 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]',
        glowClass: 'bg-rose-500/20',
        unreadCardClass: 'bg-rose-500/[0.08] border border-rose-500/30 shadow-[0_4px_24px_-8px_rgba(225,29,72,0.25)] hover:bg-rose-500/[0.12]',
        unreadBadgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/35',
      };
    case 'aunt_minnie':
      return {
        icon: 'psychology',
        tintClass: 'text-amber-400',
        boxClass: 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
        glowClass: 'bg-amber-500/20',
        unreadCardClass: 'bg-amber-500/[0.08] border border-amber-500/30 shadow-[0_4px_24px_-8px_rgba(217,119,6,0.25)] hover:bg-amber-500/[0.12]',
        unreadBadgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/35',
      };
    default:
      return {
        icon: 'library_books',
        tintClass: 'text-sky-400',
        boxClass: 'bg-sky-500/20 border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.3)]',
        glowClass: 'bg-sky-500/20',
        unreadCardClass: 'bg-sky-500/[0.08] border border-sky-500/30 shadow-[0_4px_24px_-8px_rgba(14,165,233,0.25)] hover:bg-sky-500/[0.12]',
        unreadBadgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/35',
      };
  }
};

const getPrimaryMeta = (item: any) => {
  const type = item?.submission_type || 'interesting_case';
  if (type === 'interesting_case') return 'Interesting Case';
  if (type === 'rare_pathology') return 'Rare Pathology';
  if (type === 'aunt_minnie') return 'Aunt Minnie';
  if (item?.organ_system) return item.organ_system;
  if (item?.modality) return item.modality;
  return 'Case';
};

const getDisplayTitle = (item: any) => {
  const type = item?.submission_type || 'interesting_case';
  if (type === 'aunt_minnie') {
    return String(item?.findings || item?.title || item?.analysis_result?.impression || item?.diagnosis || 'Aunt Minnie').toUpperCase();
  }
  if (type === 'rare_pathology') {
    return String(item?.title || item?.analysis_result?.impression || item?.diagnosis || 'Rare Pathology').toUpperCase();
  }
  return String(item?.analysis_result?.impression || item?.diagnosis || item?.title || 'Interesting Case').toUpperCase();
};

const buildFallbackNickname = (fullName?: string, username?: string, email?: string | null): string => {
  const byName = String(fullName || '').trim();
  if (byName.length >= 3) return byName;
  const byUsername = String(username || '').trim();
  if (byUsername.length >= 3) return byUsername;
  const byEmail = String(email || '').split('@')[0].trim();
  if (byEmail.length >= 3) return byEmail;
  return 'Resident';
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onEditCase, onViewCase }) => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [profile, setProfile] = useState({
    full_name: '',
    username: '',
    bio: '',
    year_level: '',
    specialty: 'Radiology',

    avatar_url: '',
    role: 'resident' as UserRole,
    nickname: '' // Added nickname
  });
  const [myCases, setMyCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null); // For delete confirmation
  const [hiddenAnnouncements, setHiddenAnnouncements] = useState<any[]>([]);
  const [loadingHiddenAnnouncements, setLoadingHiddenAnnouncements] = useState(false);
  const [unhidingAnnouncementId, setUnhidingAnnouncementId] = useState<string | null>(null);
  const [hiddenNotifications, setHiddenNotifications] = useState<any[]>([]);
  const [unhidingNotificationId, setUnhidingNotificationId] = useState<string | null>(null);
  const [unhidingAll, setUnhidingAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProfile();
    getMyCases();
    getHiddenAnnouncements();
    getHiddenNotifications();
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
        const safeNickname = buildFallbackNickname(data.full_name, data.username, user.email);
        setProfile({
          full_name: data.full_name || '',
          username: data.username || '',
          bio: data.bio || '',
          year_level: data.year_level || '',
          specialty: 'Radiology',

          avatar_url: data.avatar_url || '',
          role: (data.role as UserRole) || 'resident',
          nickname: data.nickname || safeNickname
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getHiddenAnnouncements = async () => {
    try {
      setLoadingHiddenAnnouncements(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const rows = await fetchHiddenAnnouncements(user.id, 50);
      setHiddenAnnouncements(rows);
    } catch (error) {
      console.error('Error loading hidden announcements:', error);
    } finally {
      setLoadingHiddenAnnouncements(false);
    }
  };

  const getHiddenNotifications = async () => {
    try {
      setLoadingHiddenAnnouncements(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const rows = await fetchHiddenNotificationsForUser(user.id, 50);
      setHiddenNotifications(rows);
    } catch (error) {
      console.error('Error loading hidden notifications:', error);
    } finally {
      setLoadingHiddenAnnouncements(false);
    }
  };

  const updateProfile = async (avatarUrl?: string) => {
    try {
      setUpdating(true);
      setMessage(null);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('No user');

      // Guard against DB username length checks for newly created accounts.
      const normalizedUsername = String(profile.username || '')
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase();
      const fallbackBase =
        String(profile.full_name || user.email?.split('@')[0] || 'user')
          .trim()
          .replace(/\s+/g, '_')
          .toLowerCase() || 'user';
      const minLen = 3;
      const safeUsername =
        normalizedUsername.length >= minLen
          ? normalizedUsername
          : `${fallbackBase}${Math.random().toString(36).slice(2, 6)}`.slice(0, 24);

      const updates = {
        id: user.id,
        full_name: profile.full_name,
        username: safeUsername,
        nickname: profile.nickname.trim(),
        bio: profile.bio,
        year_level: profile.year_level,
        avatar_url: avatarUrl || profile.avatar_url,
        role: profile.role, // FIX: Ensure role is included to satisfy constraint
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) throw error;
      setProfile((prev) => ({ ...prev, username: safeUsername }));
      setMessage({ type: 'success', text: 'Profile updated successfully!' });

      if (!avatarUrl) { // Don't close editing if just uploading avatar
        setTimeout(() => {
          setIsEditing(false);
          setMessage(null);
        }, 1500);
      }

    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || 'Error updating profile' });
    } finally {
      setUpdating(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUpdating(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      await updateProfile(publicUrl);

    } catch (error: any) {
      alert(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
  }

  const handleDeleteCase = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase
        .from('cases')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;

      setMyCases(prev => prev.filter(c => c.id !== deletingId));
      setDeletingId(null);
      alert('Case deleted successfully.');
    } catch (error: any) {
      console.error('Error deleting case:', error);
      alert('Failed to delete case: ' + error.message);
    }
  }

  if (loading) {
    return <LoadingState title="Loading profile..." />;
  }

  const nicknameTrimmed = String(profile.nickname || '').trim();
  const nicknameError =
    nicknameTrimmed.length < 3
      ? 'Display name is required and must be at least 3 characters.'
      : null;
  const canSaveProfile = !nicknameError && !updating;

  const handleUnhideAnnouncement = async (announcementId: string) => {
    try {
      setUnhidingAnnouncementId(announcementId);
      await unhideAnnouncementForUser(announcementId);
      setHiddenAnnouncements(prev => prev.filter((item) => item.id !== announcementId));
      toastSuccess('News restored');
    } catch (error: any) {
      console.error('Error unhiding announcement:', error);
      toastError('Failed to restore announcement', error?.message || 'Please try again.');
    } finally {
      setUnhidingAnnouncementId(null);
    }
  };

  const handleUnhideAllAnnouncements = async () => {
    try {
      setUnhidingAll(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');
      await Promise.all([
        unhideAllAnnouncementsForUser(),
        unhideAllNotificationsForUser(user.id),
      ]);
      setHiddenAnnouncements([]);
      setHiddenNotifications([]);
      toastSuccess('All hidden items restored');
    } catch (error: any) {
      console.error('Error restoring hidden announcements:', error);
      toastError('Failed to restore hidden items', error?.message || 'Please try again.');
    } finally {
      setUnhidingAll(false);
    }
  };

  const handleUnhideNotification = async (notificationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');
      setUnhidingNotificationId(notificationId);
      await unhideNotificationForUser(notificationId, user.id);
      setHiddenNotifications(prev => prev.filter((item) => item.id !== notificationId));
      toastSuccess('Notification restored');
    } catch (error: any) {
      console.error('Error unhiding notification:', error);
      toastError('Failed to restore notification', error?.message || 'Please try again.');
    } finally {
      setUnhidingNotificationId(null);
    }
  };

  return (
    <div className="px-6 pt-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Resident Identity Header Card */}
      <div className="flex flex-col items-center text-center bg-[#0a0f18]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 pt-8 shadow-[0_0_40px_-10px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none transform translate-y-1/2 -translate-x-1/2" />

        <div className="relative mb-5 group cursor-pointer z-10" onClick={() => fileInputRef.current?.click()}>
          <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-blue-600 rounded-full blur opacity-25 group-hover:opacity-50 transition-opacity"></div>
          <div className="relative w-24 h-24 rounded-full p-1 border border-white/10 glass-card-enhanced overflow-hidden shadow-2xl">
            <img
              src={profile.avatar_url || PROFILE_IMAGE}
              alt="Profile"
              className="w-full h-full rounded-full object-cover shadow-inner group-hover:opacity-50 transition-all"
            />
            {/* Overlay Icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-icons text-white drop-shadow-lg text-2xl">photo_camera</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-[#0a0f18] text-primary flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-primary/30 group-hover:border-primary/60 transition-colors">
              <span className="text-[11px] font-black uppercase tracking-wider">{profile.year_level || 'R1'}</span>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            className="hidden"
            accept="image/*"
          />
        </div>

        {/* View Mode Header */}
        {!isEditing && (
          <div className="z-10 w-full mb-2">
            <h1 className="text-[22px] font-extrabold text-white tracking-tight leading-tight">{profile.full_name || 'Doctor'}</h1>
            <p className="text-primary text-[11px] font-black uppercase tracking-[0.2em] mb-3 mt-1 opacity-90">
              {profile.year_level || 'Resident'} • {profile.specialty}
            </p>
            <p className="text-slate-400 text-xs italic max-w-[260px] mx-auto mb-5 leading-relaxed">"{profile.bio || 'No bio yet.'}"</p>

            {/* Stats Row */}
            <div className="flex justify-center gap-8 pt-5 border-t border-white/5 pb-1">
              <div className="text-center group">
                <span className="block text-xl font-black text-white group-hover:text-primary transition-colors">{myCases.length}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1 block group-hover:text-slate-400 transition-colors">Total Cases</span>
              </div>
              <div className="text-center group">
                <span className="block text-xl font-black text-white group-hover:text-primary transition-colors">{myCases.filter(c => c.status === 'published').length}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1 block group-hover:text-slate-400 transition-colors">Published</span>
              </div>
            </div>
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <div className="w-full max-w-sm space-y-4 z-10 mb-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-left">Identity</p>
              <div>
                <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  name="full_name"
                  value={profile.full_name}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                  placeholder="Dr. Alex Smith"
                />
              </div>
              <div>
                <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Display Name (Required)</label>
                <input
                  name="nickname"
                  value={profile.nickname || ''}
                  onChange={handleChange}
                  className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600 ${nicknameError ? 'border-rose-500/50' : 'border-white/10'}`}
                  placeholder="How others will see your name"
                />
                <p className="mt-1.5 text-[10px] text-slate-500 text-left">Used in covers, activity feeds, and presence.</p>
                {nicknameError ? <p className="mt-1 text-[10px] text-rose-400 text-left">{nicknameError}</p> : null}
              </div>
              <div>
                <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Year Level</label>
                <input
                  name="year_level"
                  value={profile.year_level}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                  placeholder="e.g. R1, R2, Fellow"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-left">About</p>
              <div>
                <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bio</label>
                <textarea
                  name="bio"
                  value={profile.bio}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none placeholder:text-slate-600"
                  placeholder="Resident physician..."
                />
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className={`mt-4 px-4 py-2 rounded-xl text-xs font-bold z-10 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Settings Block */}
      <div>
        <div className="w-full">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/80 mb-3 px-2">Settings & Actions</p>
          <div className="space-y-1.5">

            {/* Appearance */}
            <div className="w-full p-2 bg-white/[0.02] rounded-2xl border border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-3.5 px-2">
                <div className="w-[34px] h-[34px] rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                  <span className="material-icons text-[18px]">palette</span>
                </div>
                <span className="block text-[12px] font-bold text-white tracking-wider uppercase">Appearance</span>
              </div>
              <div className="pr-1">
                <ThemeToggle showSystem={false} />
              </div>
            </div>

            {/* Admin Action */}
            {profile.role === 'admin' && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="w-full p-2.5 rounded-2xl bg-rose-500/[0.03] border border-rose-500/10 hover:bg-rose-500/[0.08] hover:border-rose-500/20 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5 w-full">
                  <div className="w-[34px] h-[34px] rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.15)] group-hover:shadow-[0_0_15px_rgba(249,115,22,0.25)] transition-all">
                    <span className="material-icons text-[18px]">admin_panel_settings</span>
                  </div>
                  <span className="block text-[12px] font-bold text-orange-400 group-hover:text-orange-300 transition-colors tracking-wider uppercase flex-1">Manage Users</span>
                  <span className="material-icons text-orange-400/40 text-[20px] group-hover:text-orange-400/80 transition-colors">chevron_right</span>
                </div>
              </button>
            )}

            {/* Edit / Save Actions */}
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2 pt-1.5">
                <LoadingButton
                  onClick={() => updateProfile()}
                  isLoading={updating}
                  loadingText="Saving..."
                  disabled={!canSaveProfile}
                  className="w-full py-3 bg-primary hover:bg-primary-dark rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold text-white transition-all uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  Save Profile
                </LoadingButton>
                <button
                  onClick={() => { setIsEditing(false); setMessage(null); }}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400 hover:text-white transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5 w-full">
                  <div className="w-[34px] h-[34px] rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shadow-[0_0_10px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all">
                    <span className="material-icons text-[18px]">edit</span>
                  </div>
                  <span className="block text-[12px] font-bold text-slate-300 group-hover:text-white transition-colors tracking-wider uppercase flex-1">Edit Profile</span>
                  <span className="material-icons text-white/20 text-[20px] group-hover:text-white/60 transition-colors">chevron_right</span>
                </div>
              </button>
            )}

            {/* Sign Out */}
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-rose-500/[0.05] hover:border-rose-500/20 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 w-full">
                <div className="w-[34px] h-[34px] rounded-xl bg-slate-500/10 group-hover:bg-rose-500/10 text-slate-400 group-hover:text-rose-400 flex items-center justify-center border border-slate-500/20 group-hover:border-rose-500/20 shadow-none group-hover:shadow-[0_0_10px_rgba(244,63,94,0.15)] transition-all">
                  <span className="material-icons text-[18px]">logout</span>
                </div>
                <span className="block text-[12px] font-bold text-slate-400 group-hover:text-rose-400 transition-colors tracking-wider uppercase flex-1">Sign Out</span>
                <span className="material-icons text-white/20 text-[20px] group-hover:text-rose-400/60 transition-colors">chevron_right</span>
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* My Cases Section */}
      <div>
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-2">My Case Library</h2>

        {loadingCases ? (
          <div className="text-center py-8 text-slate-500 text-xs">Loading cases...</div>
        ) : myCases.length === 0 ? (
          <div className="bg-[#0a0f18]/80 backdrop-blur-2xl p-8 rounded-[2rem] flex flex-col items-center justify-center text-center opacity-80 border-dashed border border-white/10">
            <span className="material-icons text-4xl text-slate-600 mb-3">folder_open</span>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">No cases yet</p>
            <p className="text-[10px] text-slate-500">Go to Upload tab to add new cases.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {myCases.map((c) => {
              const typeMeta = getSubmissionTypeMeta(c.submission_type || 'interesting_case');
              const displayTitle = getDisplayTitle(c);
              const primaryMeta = getPrimaryMeta(c);

              const isRarePathology = c.submission_type === 'rare_pathology';
              const isAuntMinnie = c.submission_type === 'aunt_minnie';

              const tintColorClass = isRarePathology ? 'text-rose-400' : isAuntMinnie ? 'text-amber-400' : 'text-sky-400';
              const bgGlowClass = isRarePathology ? 'bg-rose-500/10' : isAuntMinnie ? 'bg-amber-500/10' : 'bg-sky-500/10';
              const borderGlowClass = isRarePathology ? 'border-rose-500/20' : isAuntMinnie ? 'border-amber-500/20' : 'border-sky-500/20';
              const shadowClass = isRarePathology ? 'shadow-[0_0_15px_rgba(244,63,94,0.15)] group-hover:shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                : isAuntMinnie ? 'shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'shadow-[0_0_15px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_20px_rgba(56,189,248,0.25)]';

              return (
                <div
                  key={c.id}
                  onClick={() => onViewCase && onViewCase(c)}
                  className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 w-full z-10 relative">
                    <div className={`w-[38px] h-[38px] rounded-[14px] ${bgGlowClass} ${tintColorClass} flex items-center justify-center border ${borderGlowClass} ${shadowClass} transition-all shrink-0`}>
                      <span className="material-icons text-[18px]">{typeMeta.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0 pr-1">
                      <h4 className={`text-[12px] sm:text-[13px] truncate tracking-widest font-extrabold ${tintColorClass} group-hover:brightness-110 mb-0.5 uppercase`}>
                        {displayTitle}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[9px] truncate uppercase tracking-widest font-bold">
                        <span className="text-white/70">{primaryMeta}</span>
                        <span className="text-white/20">•</span>
                        <span className="text-white/40">{new Date(c.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditCase && onEditCase(c); }}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                        title="Edit Case"
                      >
                        <span className="material-icons text-[15px]">edit</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmDelete(c.id); }}
                        className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-500 hover:text-rose-400 transition-colors"
                        title="Delete Case"
                      >
                        <span className="material-icons text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden News Section */}
      <div>
        <div className="mb-4 ml-2 flex items-center justify-between">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Hidden News</h2>
          {(hiddenAnnouncements.length > 0 || hiddenNotifications.length > 0) && (
            <button
              onClick={handleUnhideAllAnnouncements}
              disabled={unhidingAll}
              className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors mt-1"
            >
              {unhidingAll ? 'Restoring...' : 'Unhide all'}
            </button>
          )}
        </div>

        {loadingHiddenAnnouncements ? (
          <div className="text-center py-6 text-slate-500 text-xs">Loading hidden news...</div>
        ) : hiddenAnnouncements.length === 0 && hiddenNotifications.length === 0 ? (
          <div className="bg-[#0a0f18]/80 backdrop-blur-2xl p-5 rounded-[2rem] border border-white/10 text-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No hidden news.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hiddenAnnouncements.map((item) => (
              <div
                key={item.id}
                className="bg-white/[0.03] p-3 rounded-2xl border border-white/5 flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-extrabold text-white truncate tracking-wide">{item.title}</p>
                  <p className="text-[9px] font-bold text-slate-500 truncate uppercase mt-0.5 tracking-wider">By {item.author} • {item.date}</p>
                </div>
                <button
                  onClick={() => handleUnhideAnnouncement(item.id)}
                  disabled={unhidingAnnouncementId === item.id}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  {unhidingAnnouncementId === item.id ? 'Restoring...' : 'Unhide'}
                </button>
              </div>
            ))}
            {hiddenNotifications.map((item) => (
              <div
                key={`notif-${item.id}`}
                className="bg-white/[0.03] p-3 rounded-2xl border border-white/5 flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-extrabold text-white truncate tracking-wide">
                    {(item.type || 'Notification').replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} by {item.actorName || 'Hospital Staff'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 truncate uppercase mt-0.5 tracking-wider">
                    {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => handleUnhideNotification(item.id)}
                  disabled={unhidingNotificationId === item.id}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  {unhidingNotificationId === item.id ? 'Restoring...' : 'Unhide'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {
        deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200" onClick={() => setDeletingId(null)}>
            <div className="bg-[#0c1829] border border-white/10 rounded-3xl p-6 w-full max-w-[320px] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                  <span className="material-icons text-rose-500 text-3xl">delete_forever</span>
                </div>
                <h3 className="text-[17px] font-black text-white">Delete Case?</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-bold">This operation cannot be undone. Area you sure?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-bold text-slate-300 uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCase}
                  className="w-full py-3.5 bg-rose-500 hover:bg-rose-400 rounded-xl text-[11px] font-bold text-white uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      }

      <p className="text-center mt-12 text-[9px] text-slate-700 font-bold uppercase tracking-[0.4em]">
        Department Portal v3.2.0
      </p>

      {
        showAdminPanel && (
          <AdminUserManagement onClose={() => setShowAdminPanel(false)} />
        )
      }
    </div>
  );
};

export default ProfileScreen;
