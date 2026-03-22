
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { PROFILE_IMAGE } from '../constants';
import { NoteSaveState, UserRole } from '../types';
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
import { ResidentBadges } from './ResidentBadges';
import { ProfileEditor } from './ProfileEditor';
import { MyCaseLibrary } from './MyCaseLibrary';
import { getMyProfileNote, upsertMyProfileNote } from '../services/profileNotesService';
import {
  fetchHiddenAnnouncementsForProfileHome,
  fetchMyCasesForProfileHome,
  getCachedProfileHomeWorkspace,
  getProfileHomeWorkspace,
  fetchProfileNotePreview,
  fetchProfileRecord,
} from '../services/profileHomeService';
import { useAppViewport } from './responsive/useViewport';
import PageShell from './ui/PageShell';
import PageHeader from './ui/PageHeader';
import PageSection from './ui/PageSection';

interface ProfileScreenProps {
  currentUserId?: string | null;
  onEditCase?: (caseItem: any) => void;
  onViewCase?: (caseItem: any) => void; // Added for navigation
}


const buildFallbackNickname = (fullName?: string, username?: string, email?: string | null): string => {
  const byName = String(fullName || '').trim();
  if (byName.length >= 3) return byName;
  const byUsername = String(username || '').trim();
  if (byUsername.length >= 3) return byUsername;
  const byEmail = String(email || '').split('@')[0].trim();
  if (byEmail.length >= 3) return byEmail;
  return 'Resident';
};

const PROFILE_NOTES_MAX_LENGTH = 5000;
const getProfileNotesDraftKey = (userId: string) => `profile:notes:draft:${userId}`;
const getHiddenNewsDismissedKey = (userId: string) => `profile:hidden-news:dismissed:${userId}`;
const formatSavedAt = (iso: string | null): string => {
  if (!iso) return 'Not saved yet';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 'Not saved yet';
  return dt.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ currentUserId, onEditCase, onViewCase }) => {
  const viewport = useAppViewport();
  const cachedWorkspace = currentUserId ? getCachedProfileHomeWorkspace(currentUserId) : null;
  const [loading, setLoading] = useState(!cachedWorkspace);
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
    nickname: '', // Added nickname
    title: '',
    motto: '',
    work_mode: 'Focused',
    avatar_seed: '',
    main_modality: 'CT',
    faction: '',
    map_status: 'At Workstation'
  });
  const [activeBadges, setActiveBadges] = useState<string[]>([]);
  const [myCases, setMyCases] = useState<any[]>(cachedWorkspace?.myCases || []);
  const [loadingCases, setLoadingCases] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null); // For delete confirmation
  const [hiddenAnnouncements, setHiddenAnnouncements] = useState<any[]>(cachedWorkspace?.hiddenAnnouncements || []);
  const [loadingHiddenAnnouncements, setLoadingHiddenAnnouncements] = useState(!cachedWorkspace);
  const [unhidingAnnouncementId, setUnhidingAnnouncementId] = useState<string | null>(null);
  const [hiddenNotifications, setHiddenNotifications] = useState<any[]>(cachedWorkspace?.hiddenNotifications || []);
  const [unhidingNotificationId, setUnhidingNotificationId] = useState<string | null>(null);
  const [unhidingAll, setUnhidingAll] = useState(false);
  const [dismissedHiddenNewsIds, setDismissedHiddenNewsIds] = useState<string[]>([]);
  const [profileNotesUserId, setProfileNotesUserId] = useState<string | null>(currentUserId || null);
  const [noteContent, setNoteContent] = useState(cachedWorkspace?.notePreview?.content || '');
  const [noteLoaded, setNoteLoaded] = useState(Boolean(cachedWorkspace));
  const [noteSaveState, setNoteSaveState] = useState<NoteSaveState>('idle');
  const [noteLastSavedAt, setNoteLastSavedAt] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [notesFeatureUnavailable, setNotesFeatureUnavailable] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      setDismissedHiddenNewsIds([]);
      return;
    }

    const stored = localStorage.getItem(getHiddenNewsDismissedKey(currentUserId));
    if (!stored) {
      setDismissedHiddenNewsIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setDismissedHiddenNewsIds(Array.isArray(parsed) ? parsed.map((value) => String(value)) : []);
    } catch {
      setDismissedHiddenNewsIds([]);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!cachedWorkspace?.profileRecord) return;
    const data = cachedWorkspace.profileRecord;
    const safeNickname = buildFallbackNickname(data.full_name, data.username, null);
    setProfile({
      full_name: data.full_name || '',
      username: data.username || '',
      bio: data.bio || '',
      year_level: data.year_level || '',
      specialty: 'Radiology',
      avatar_url: data.avatar_url || '',
      role: (data.role as UserRole) || 'resident',
      nickname: data.nickname || safeNickname,
      title: data.title || '',
      motto: data.motto || '',
      work_mode: data.work_mode || 'Focused',
      avatar_seed: data.avatar_seed || currentUserId || '',
      main_modality: data.main_modality || 'CT',
      faction: data.faction || '',
      map_status: data.map_status || 'At Workstation'
    });
    setActiveBadges(data.active_badges || []);
    setNoteLastSavedAt(cachedWorkspace.notePreview?.updated_at || null);
  }, [cachedWorkspace, currentUserId]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!cachedWorkspace) {
        setLoading(true);
        setLoadingCases(true);
        setLoadingHiddenAnnouncements(true);
        setNoteLoaded(false);
      }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setProfileNotesUserId(null);
          setNoteLoaded(true);
          return;
        }
        setProfileNotesUserId(user.id);

        const workspace = await getProfileHomeWorkspace(user.id);
        applyWorkspaceData(user, workspace);
      } catch (error) {
        console.error('Error fetching profile data:', error);
        setNoteLoaded(true);
      } finally {
        setLoading(false);
        setLoadingCases(false);
        setLoadingHiddenAnnouncements(false);
      }
    };
    fetchAllData();
  }, []);

  const applyWorkspaceData = (user: any, workspace: Awaited<ReturnType<typeof getProfileHomeWorkspace>>) => {
    setProfileNotesUserId(user.id);
    const data = workspace.profileRecord;
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
        nickname: data.nickname || safeNickname,
        title: data.title || '',
        motto: data.motto || '',
        work_mode: data.work_mode || 'Focused',
        avatar_seed: data.avatar_seed || user.id,
        main_modality: data.main_modality || 'CT',
        faction: data.faction || '',
        map_status: data.map_status || 'At Workstation'
      });
      setActiveBadges(data.active_badges || []);
    }
    setMyCases(workspace.myCases || []);
    setHiddenAnnouncements(workspace.hiddenAnnouncements || []);
    setHiddenNotifications(workspace.hiddenNotifications || []);
    setNoteContent(workspace.notePreview?.content || '');
    setNoteLastSavedAt(workspace.notePreview?.updated_at || null);
    setNoteSaveState('idle');
    setNoteError(null);
    setNoteLoaded(true);
  };

  const fetchMyCasesData = async (user: any) => {
    try {
      const rows = await fetchMyCasesForProfileHome(user.id);
      setMyCases(rows || []);
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  };

  const getMyCases = async () => {
    setLoadingCases(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await fetchMyCasesData(user);
    setLoadingCases(false);
  };

  const fetchProfileData = async (user: any) => {
    try {
      const data = await fetchProfileRecord(user.id);

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
          nickname: data.nickname || safeNickname,
          title: data.title || '',
          motto: data.motto || '',
          work_mode: data.work_mode || 'Focused',
          avatar_seed: data.avatar_seed || user.id,
          main_modality: data.main_modality || 'CT',
          faction: data.faction || '',
          map_status: data.map_status || 'At Workstation'
        });
        setActiveBadges(data.active_badges || []);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error.message);
    }
  };

  const getProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await fetchProfileData(user);
    setLoading(false);
  };

  const fetchHiddenAnnouncementsData = async (user: any) => {
    try {
      const rows = await fetchHiddenAnnouncementsForProfileHome(user.id, 50);
      setHiddenAnnouncements(rows);
    } catch (error) {
      console.error('Error loading hidden announcements:', error);
    }
  };

  const getHiddenAnnouncements = async () => {
    setLoadingHiddenAnnouncements(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await fetchHiddenAnnouncementsData(user);
    setLoadingHiddenAnnouncements(false);
  };

  const fetchHiddenNotificationsData = async (user: any) => {
    try {
      const rows = await fetchHiddenNotificationsForUser(user.id, 50);
      setHiddenNotifications(rows);
    } catch (error) {
      console.error('Error loading hidden notifications:', error);
    }
  };

  const getHiddenNotifications = async () => {
    setLoadingHiddenAnnouncements(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await fetchHiddenNotificationsData(user);
    setLoadingHiddenAnnouncements(false);
  };

  const fetchProfileNoteData = async (user: any) => {
    const userId = String(user?.id || '');
    if (!userId) {
      setNoteContent('');
      setNoteSaveState('idle');
      setNoteLastSavedAt(null);
      setNoteError(null);
      setNotesFeatureUnavailable(false);
      setNoteLoaded(true);
      return;
    }

    const draftKey = getProfileNotesDraftKey(userId);
    setNotesFeatureUnavailable(false);
    try {
      const remoteNote = await fetchProfileNotePreview(userId);
      const draft = localStorage.getItem(draftKey);

      if (draft !== null) {
        setNoteContent(String(draft).slice(0, PROFILE_NOTES_MAX_LENGTH));
        setNoteSaveState('dirty');
        setNoteError('Local draft restored. Save to sync this note.');
        setNoteLastSavedAt(remoteNote?.updated_at || null);
      } else {
        setNoteContent(remoteNote?.content || '');
        setNoteSaveState('idle');
        setNoteError(null);
        setNoteLastSavedAt(remoteNote?.updated_at || null);
      }
    } catch (error: any) {
      const draft = localStorage.getItem(draftKey);
      if (draft !== null) {
        setNoteContent(String(draft).slice(0, PROFILE_NOTES_MAX_LENGTH));
        setNoteSaveState('dirty');
        setNoteError('Could not load cloud note. Using local draft.');
      } else {
        setNoteContent('');
        setNoteSaveState('error');
        setNoteError('Notes feature is temporarily unavailable.');
      }

      if (error?.code === '42P01') {
        setNotesFeatureUnavailable(true);
      }
    } finally {
      setNoteLoaded(true);
    }
  };

  const saveNoteNow = async () => {
    if (!noteLoaded || notesFeatureUnavailable || !profileNotesUserId) return;

    const draftKey = getProfileNotesDraftKey(profileNotesUserId);
    try {
      setNoteSaveState('saving');
      setNoteError(null);
      const saved = await upsertMyProfileNote(noteContent);
      setNoteContent(saved.content);
      setNoteLastSavedAt(saved.updated_at);
      setNoteSaveState('saved');
      localStorage.removeItem(draftKey);
    } catch (error) {
      localStorage.setItem(draftKey, noteContent);
      setNoteSaveState('error');
      setNoteError('Save failed. Retry.');
    }
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = String(e.target.value || '').slice(0, PROFILE_NOTES_MAX_LENGTH);
    setNoteContent(value);
    setNoteSaveState('dirty');
    setNoteError(null);

    if (profileNotesUserId) {
      localStorage.setItem(getProfileNotesDraftKey(profileNotesUserId), value);
    }
  };

  const retrySaveNote = async () => {
    await saveNoteNow();
  };

  useEffect(() => {
    if (!noteLoaded || notesFeatureUnavailable || noteSaveState !== 'dirty') return;

    if (noteAutosaveTimerRef.current) {
      clearTimeout(noteAutosaveTimerRef.current);
    }
    noteAutosaveTimerRef.current = setTimeout(() => {
      saveNoteNow();
    }, 800);

    return () => {
      if (noteAutosaveTimerRef.current) {
        clearTimeout(noteAutosaveTimerRef.current);
      }
    };
  }, [noteContent, noteLoaded, noteSaveState, notesFeatureUnavailable]);

  useEffect(() => {
    return () => {
      if (noteAutosaveTimerRef.current) {
        clearTimeout(noteAutosaveTimerRef.current);
      }
    };
  }, []);

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
        title: profile.title,
        motto: profile.motto,
        work_mode: profile.work_mode,
        avatar_seed: profile.avatar_seed,
        main_modality: profile.main_modality,
        faction: profile.faction,
        map_status: profile.map_status,
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
      toastError(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleRerollAvatar = () => {
    // Generate a random string as the new seed
    const newSeed = Math.random().toString(36).substring(2, 10);
    setProfile(prev => ({ ...prev, avatar_seed: newSeed }));
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
      toastSuccess('Case deleted successfully.');
    } catch (error: any) {
      console.error('Error deleting case:', error);
      toastError('Failed to delete case: ' + error.message);
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
  const noteStatusLabel =
    noteSaveState === 'saving'
      ? 'Saving...'
      : noteSaveState === 'saved'
        ? 'Saved'
        : noteSaveState === 'dirty'
          ? 'Unsaved changes'
          : noteSaveState === 'error'
            ? 'Save failed'
            : 'Idle';
  const noteStatusClassName =
    noteSaveState === 'saving'
      ? 'text-sky-300 bg-sky-500/10 border-sky-500/20'
      : noteSaveState === 'saved'
        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
        : noteSaveState === 'dirty'
          ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
          : noteSaveState === 'error'
            ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
            : 'text-slate-400 bg-white/5 border-white/10';

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

  const persistDismissedHiddenNews = (nextIds: string[]) => {
    setDismissedHiddenNewsIds(nextIds);
    if (!currentUserId) return;
    localStorage.setItem(getHiddenNewsDismissedKey(currentUserId), JSON.stringify(nextIds));
  };

  const handleDismissHiddenNewsItem = (itemId: string) => {
    if (dismissedHiddenNewsIds.includes(itemId)) return;
    persistDismissedHiddenNews([...dismissedHiddenNewsIds, itemId]);
  };

  const handleDismissAllHiddenNews = () => {
    const allIds = [
      ...hiddenAnnouncements.map((item) => `announcement:${item.id}`),
      ...hiddenNotifications.map((item) => `notification:${item.id}`),
    ];
    persistDismissedHiddenNews(Array.from(new Set([...dismissedHiddenNewsIds, ...allIds])));
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

  const visibleHiddenAnnouncements = hiddenAnnouncements.filter(
    (item) => !dismissedHiddenNewsIds.includes(`announcement:${item.id}`),
  );
  const visibleHiddenNotifications = hiddenNotifications.filter(
    (item) => !dismissedHiddenNewsIds.includes(`notification:${item.id}`),
  );
  const hasVisibleHiddenNews = visibleHiddenAnnouncements.length > 0 || visibleHiddenNotifications.length > 0;

  return (
    <PageShell layoutMode="split">
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" data-profile-viewport={viewport}>
      <div className="xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start xl:gap-6">
      <aside className="space-y-6 xl:sticky xl:top-6">
      <PageSection className="space-y-6 bg-[#0a0f18]/70">
      <div className="relative mb-5 flex h-24 w-24 cursor-pointer group mx-auto z-10" onClick={() => fileInputRef.current?.click()}>
        <div className="absolute -inset-2 rounded-full bg-primary/18 blur-xl opacity-55 transition-opacity duration-300 group-hover:opacity-75" />
        <div className="absolute -inset-[3px] rounded-full border border-primary/18 opacity-70 shadow-[0_0_24px_rgba(56,189,248,0.14)] transition-opacity duration-300 group-hover:opacity-90" />

        <div className="relative h-24 w-24 rounded-full border border-white/10 bg-[#0a0f18] p-1 shadow-2xl overflow-hidden z-10">
          <img
            src={profile.avatar_url || PROFILE_IMAGE}
            alt="Profile"
            className="w-full h-full rounded-full object-cover shadow-inner hover:opacity-80 transition-opacity duration-300"
          />
          {/* Overlay Icon */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="material-icons text-white drop-shadow-lg text-2xl">photo_camera</span>
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
        <div className="z-10 w-full mb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">{profile.full_name || 'Doctor'}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 mb-5 opacity-90">
            {profile.year_level && (
              <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-[0.15em] shadow-sm">
                {profile.year_level}
              </span>
            )}
            <span className="text-slate-300 text-[12px] font-bold uppercase tracking-wider">
              {profile.role} • {profile.specialty}
            </span>
          </div>

          {/* Badges Display */}
          <ResidentBadges activeBadges={activeBadges} />

          {/* Stats Box */}
          <div className="flex justify-center md:justify-start gap-8 mt-6 bg-white/[0.02] border border-white/5 rounded-2xl p-4 md:px-8 max-w-fit shadow-xl backdrop-blur-sm">
            <div className="text-center md:text-left group">
              <span className="block text-2xl font-black text-white group-hover:text-primary transition-colors">{myCases.length}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-bold mt-1 block transition-colors">Total Cases</span>
            </div>
            <div className="w-[1px] bg-white/5 self-stretch" />
            <div className="text-center md:text-left group">
              <span className="block text-2xl font-black text-white group-hover:text-emerald-400 transition-colors">{myCases.filter(c => c.status === 'published').length}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-bold mt-1 block transition-colors">Published</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {isEditing && (
        <ProfileEditor
          profile={profile}
          handleChange={handleChange}
          handleRerollAvatar={handleRerollAvatar}
          nicknameError={nicknameError}
        />
      )}

      {message && (
        <div className={`mt-4 px-4 py-2 rounded-xl text-xs font-bold z-10 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {message.text}
        </div>
      )}

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
      </div >
      </PageSection>
      </aside>

      <main className="space-y-6 mt-6 xl:mt-0">

      {/* My Notes Section */}
      <PageSection className="bg-[#0a0f18]/72">
        <div className="mb-4 ml-2 flex items-center justify-between">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">My Notes</h2>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Private to your account</span>
        </div>
        <div className="bg-black/10 backdrop-blur-2xl p-4 rounded-[1.5rem] border border-white/10 space-y-3">
          {!noteLoaded ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 w-28 rounded bg-white/10" />
              <div className="h-28 rounded-xl bg-white/5" />
              <div className="h-3 w-40 rounded bg-white/10" />
            </div>
          ) : notesFeatureUnavailable ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
              <p className="text-sm font-bold text-rose-300">Notes feature is temporarily unavailable.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${noteStatusClassName}`}>
                  {noteStatusLabel}
                </span>
                {noteSaveState === 'error' && (
                  <button
                    onClick={retrySaveNote}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>

              <textarea
                value={noteContent}
                onChange={handleNoteChange}
                onBlur={() => {
                  if (noteSaveState === 'dirty') {
                    saveNoteNow();
                  }
                }}
                maxLength={PROFILE_NOTES_MAX_LENGTH}
                rows={6}
                placeholder="Write personal notes..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none transition-all resize-none"
              />

              <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                <span>Last saved: {formatSavedAt(noteLastSavedAt)}</span>
                <span>{noteContent.length}/{PROFILE_NOTES_MAX_LENGTH}</span>
              </div>

              {noteError && <p className="text-[11px] text-amber-300">{noteError}</p>}
            </>
          )}
        </div>
      </PageSection>

      {/* My Cases Section */}
      < MyCaseLibrary
        loadingCases={loadingCases}
        myCases={myCases}
        onViewCase={onViewCase}
        onEditCase={onEditCase}
        confirmDelete={confirmDelete}
      />

      {/* Hidden News Section */}
      <PageSection className="bg-[#0a0f18]/72">
        <div className="mb-4 ml-2 flex items-center justify-between">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Hidden News</h2>
          {hasVisibleHiddenNews && (
            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={handleDismissAllHiddenNews}
                className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                Clear list
              </button>
              <button
                onClick={handleUnhideAllAnnouncements}
                disabled={unhidingAll}
                className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
              >
                {unhidingAll ? 'Restoring...' : 'Unhide all'}
              </button>
            </div>
          )}
        </div>

        {
          loadingHiddenAnnouncements ? (
            <div className="text-center py-6 text-slate-500 text-xs">Loading hidden news...</div>
          ) : !hasVisibleHiddenNews ? (
            <div className="bg-[#0a0f18]/80 backdrop-blur-2xl p-5 rounded-[2rem] border border-white/10 text-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No hidden news.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleHiddenAnnouncements.map((item) => (
                <div
                  key={item.id}
                  className="bg-white/[0.03] p-3 rounded-2xl border border-white/5 flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-extrabold text-white truncate tracking-wide">{item.title}</p>
                    <p className="text-[9px] font-bold text-slate-500 truncate uppercase mt-0.5 tracking-wider">By {item.author} • {item.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDismissHiddenNewsItem(`announcement:${item.id}`)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleUnhideAnnouncement(item.id)}
                      disabled={unhidingAnnouncementId === item.id}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {unhidingAnnouncementId === item.id ? 'Restoring...' : 'Unhide'}
                    </button>
                  </div>
                </div>
              ))}
              {visibleHiddenNotifications.map((item) => (
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDismissHiddenNewsItem(`notification:${item.id}`)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleUnhideNotification(item.id)}
                      disabled={unhidingNotificationId === item.id}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {unhidingNotificationId === item.id ? 'Restoring...' : 'Unhide'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </PageSection>

      <p className="text-center mt-8 text-[9px] text-slate-700 font-bold uppercase tracking-[0.4em]">
        Department Portal v3.2.0
      </p>
      </main>
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

      {
        showAdminPanel && (
          <AdminUserManagement onClose={() => setShowAdminPanel(false)} />
        )
      }
    </div>
    </PageShell>
  );
};

export default ProfileScreen;
