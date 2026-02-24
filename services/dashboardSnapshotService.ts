import { CalendarService } from './CalendarService';
import { supabase } from './supabase';
import { DashboardSnapshotData, Screen } from '../types';

export const APP_OPEN_STORAGE_KEY = 'chh_last_app_open_at';
export const SNAPSHOT_BASELINE_STORAGE_KEY = 'chh_snapshot_baseline_open_at';
export const SNAPSHOT_SEEN_ANNOUNCEMENTS_KEY = 'chh_snapshot_seen_announcements_at';
export const SNAPSHOT_SEEN_CASES_KEY = 'chh_snapshot_seen_cases_at';
export const SNAPSHOT_SEEN_CALENDAR_KEY = 'chh_snapshot_seen_calendar_at';

type SnapshotSection = 'announcements' | 'cases' | 'calendar' | 'leaveToday' | 'auth';

export interface DashboardSnapshotResult {
  data: DashboardSnapshotData | null;
  sectionErrors: Partial<Record<SnapshotSection, string>>;
}

const setSeenKeyNow = (key: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, new Date().toISOString());
};

export const markSnapshotSectionSeen = (section: 'announcements' | 'cases' | 'calendar'): void => {
  if (section === 'announcements') {
    setSeenKeyNow(SNAPSHOT_SEEN_ANNOUNCEMENTS_KEY);
    return;
  }
  if (section === 'calendar') {
    setSeenKeyNow(SNAPSHOT_SEEN_CALENDAR_KEY);
    return;
  }
  setSeenKeyNow(SNAPSHOT_SEEN_CASES_KEY);
};

export const markSnapshotSectionsSeenForScreen = (screen: Screen): void => {
  if (screen === 'announcements') {
    markSnapshotSectionSeen('announcements');
    return;
  }
  if (screen === 'calendar') {
    markSnapshotSectionSeen('calendar');
    return;
  }
  if (screen === 'search' || screen === 'database') {
    markSnapshotSectionSeen('cases');
  }
};

const getEffectiveBaseline = (seenKey: string): string | null => {
  if (typeof window === 'undefined') return null;

  const appBaseline = window.localStorage.getItem(SNAPSHOT_BASELINE_STORAGE_KEY);
  const sectionSeen = window.localStorage.getItem(seenKey);
  if (!appBaseline) return null;
  if (!sectionSeen) return appBaseline;

  const appMs = new Date(appBaseline).getTime();
  const seenMs = new Date(sectionSeen).getTime();
  if (Number.isNaN(appMs)) return sectionSeen;
  if (Number.isNaN(seenMs)) return appBaseline;
  return new Date(Math.max(appMs, seenMs)).toISOString();
};

export const fetchDashboardSnapshot = async (): Promise<DashboardSnapshotResult> => {
  const sectionErrors: Partial<Record<SnapshotSection, string>> = {};

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    sectionErrors.auth = 'User session unavailable.';
    return { data: null, sectionErrors };
  }

  const announcementsBaseline = getEffectiveBaseline(SNAPSHOT_SEEN_ANNOUNCEMENTS_KEY);
  const casesBaseline = getEffectiveBaseline(SNAPSHOT_SEEN_CASES_KEY);
  const calendarBaseline = getEffectiveBaseline(SNAPSHOT_SEEN_CALENDAR_KEY);

  const [announcementsResult, casesResult, calendarResult, leaveResult] = await Promise.allSettled([
    announcementsBaseline
      ? supabase
          .from('announcements')
          .select('id,title,created_at')
          .gt('created_at', announcementsBaseline)
          .order('is_pinned', { ascending: false })
          .order('is_important', { ascending: false })
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    casesBaseline
      ? supabase
          .from('cases')
          .select('id,title,created_at,status')
          .eq('status', 'published')
          .gt('created_at', casesBaseline)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    calendarBaseline
      ? supabase
          .from('events')
          .select('id,title,created_at')
          .gt('created_at', calendarBaseline)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    CalendarService.getLeaveEvents(new Date()),
  ]);

  let newAnnouncementsCount = 0;
  let latestAnnouncementTitle: string | undefined;
  if (announcementsResult.status === 'fulfilled') {
    if (announcementsResult.value.error) {
      sectionErrors.announcements = 'Unable to load announcements.';
    } else {
      const rows = announcementsResult.value.data || [];
      newAnnouncementsCount = rows.length;
      latestAnnouncementTitle = rows[0]?.title;
    }
  } else {
    sectionErrors.announcements = 'Unable to load announcements.';
  }

  let newCaseLibraryCount = 0;
  let latestCaseTitle: string | undefined;
  if (casesResult.status === 'fulfilled') {
    if (casesResult.value.error) {
      sectionErrors.cases = 'Unable to load case library.';
    } else {
      const rows = casesResult.value.data || [];
      newCaseLibraryCount = rows.length;
      latestCaseTitle = rows[0]?.title;
    }
  } else {
    sectionErrors.cases = 'Unable to load case library.';
  }

  let newCalendarCount = 0;
  let latestCalendarTitle: string | undefined;
  if (calendarResult.status === 'fulfilled') {
    if (calendarResult.value.error) {
      sectionErrors.calendar = 'Unable to load calendar updates.';
    } else {
      const rows = calendarResult.value.data || [];
      newCalendarCount = rows.length;
      latestCalendarTitle = rows[0]?.title;
    }
  } else {
    sectionErrors.calendar = 'Unable to load calendar updates.';
  }

  let leaveToday: DashboardSnapshotData['leaveToday'] = [];
  if (leaveResult.status === 'fulfilled') {
    const events = leaveResult.value || [];
    leaveToday = events.map((event: any) => {
      const description = typeof event.description === 'string' ? event.description : '';
      const matchedFromDescription = description.match(/On Leave:\s*([^\n\r]+)/i);
      const parsedLeaveName = matchedFromDescription?.[1]?.trim();
      const normalizedTitle = typeof event.title === 'string' ? event.title.trim() : '';
      const titleName = normalizedTitle && normalizedTitle.toLowerCase() !== 'leave' ? normalizedTitle : '';

      // Prefer the explicitly entered leave name over the creator profile.
      const fallbackName =
        parsedLeaveName ||
        titleName ||
        event.assigned_name ||
        event.assigned_to_name ||
        event.assigned_to_display_name ||
        event.user?.nickname ||
        event.user?.full_name ||
        'Unknown';

      const coverageNames = (event.coverage_details || [])
        .map((detail: any) => detail.name || detail.user?.nickname || detail.user?.full_name)
        .filter(Boolean);

      return {
        id: event.id,
        name: fallbackName,
        coverageNames,
      };
    });
  } else {
    sectionErrors.leaveToday = 'Unable to load leave coverage.';
  }

  const data: DashboardSnapshotData = {
    newAnnouncementsCount,
    latestAnnouncementTitle,
    newCaseLibraryCount,
    latestCaseTitle,
    newCalendarCount,
    latestCalendarTitle,
    leaveToday,
  };

  return { data, sectionErrors };
};
