
export type Screen = 'dashboard' | 'upload' | 'quiz' | 'calendar' | 'announcements' | 'profile' | 'search' | 'database' | 'case-view' | 'activity-log' | 'residents-corner' | 'newsfeed';
export type SubmissionType = 'interesting_case' | 'rare_pathology' | 'aunt_minnie';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

export interface ScreenMeta {
  screen: Screen;
  label: string;
  icon: string;
}

export interface Activity {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  createdAt?: string;
  icon: string;
  colorClass: string;
}

export interface ErrorResponse {
  message: string;
  code?: string;
  details?: unknown;
}

export interface WorkspacePlayer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role?: UserRole;
  floorId: string | null;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  isWalking: boolean;
  statusMessage: string | null;
}

export interface WorkspaceAreaPresenceRow {
  id: string;
  userId: string;
  floorId: string;
  x: number;
  y: number;
  statusMessage: string | null;
  isPresent: boolean;
  lastSeenAt: string;
  clearedAt: string | null;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  avatarUrl: string | null;
  role?: UserRole;
}

export interface MergedWorkspacePlayer extends WorkspacePlayer {
  source: 'realtime' | 'persistent';
  persisted: boolean;
}

export interface QuickAction {
  label: string;
  icon: string;
  target: Screen;
  subtitle?: string;
  color: string;
  gradient: string;
}

export interface CaseData {
  initials: string;
  age: string;
  gender?: string;
  isPediatric: boolean;
  specialty: string;
  clinicalHistory: string;
  findings: string;
  modality?: string;
  anatomy?: string;
  organSystem?: string; // Standardized category
  clinicalData?: string; // New field for clinical data
  tags?: string[];
  imageUrls: string[]; // Array of image URLs
  // Manual fields
  diagnosis?: string;
  differentials?: Differential[];
  pearl?: string;
  teachingPoints?: string[];
  redFlags?: string[];
  planOfCare?: string[];
  severity?: 'Routine' | 'Urgent' | 'Critical';
}

export interface Differential {
  condition: string;
  confidence: number;
  rationale: string;
}

export interface CaseComment {
  id: string;
  case_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    full_name: string | null;
    avatar_url: string | null;
    nickname?: string | null;
  };
}

export interface CaseRating {
  id: string;
  case_id: string;
  user_id: string;
  rating: number;
  created_at: string;
}

export interface AnalysisResult {
  keyFindings: string[];
  differentials: Differential[];
  planOfCare: string[];
  educationalSummary: string;
  severity: 'Routine' | 'Urgent' | 'Critical';
  modality?: string;
  anatomy_region?: string;
  teachingPoints?: string[];
  pearl?: string;
  redFlags?: string[];
}

export interface PatientRecord {
  id: string;
  name: string;
  initials: string;
  age: number;
  date: string;
  specialty: string;
  diagnosticCode: string;
  status: 'Completed' | 'Pending' | 'Draft' | 'Published';
  submission_type?: SubmissionType;
  radiologic_clinchers?: string;
  author?: string;
}

export interface SearchFilters {
  startDate: string;
  endDate: string;
  specialty: string;
  diagnosticCode: string;
  submissionType: '' | SubmissionType;
  datePreset: 'all' | '7d' | '30d' | '90d' | '365d' | 'custom';
}

export type EventType = 'rotation' | 'call' | 'lecture' | 'exam' | 'leave' | 'meeting' | 'pcr' | 'pickleball';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  event_type: EventType;
  location?: string;
  created_by: string;
  assigned_to?: string;
  covered_by?: string;
  covered_user?: {
    full_name: string | null;
    avatar_url: string | null;
    nickname?: string | null; // Added nickname
  };
  user?: {
    full_name: string | null;
    avatar_url: string | null;
    nickname?: string | null;
  };
  creator?: {
    full_name: string | null;
    avatar_url: string | null;
    nickname?: string | null;
  };
  coverage_details?: {
    user_id: string;
    name?: string; // Manual name entry
    modalities: string[]; // Changed from modality: string
    user?: {
      full_name: string | null;
      avatar_url: string | null;
      nickname?: string | null;
    };
  }[];
  is_all_day: boolean;
  created_at?: string;

  // Legacy fields for backward compatibility during refactor (optional)
  time?: string;
  date?: string;
  type?: EventType; // mapped to event_type
}

// ... existing types ...

export type UserRole = 'admin' | 'moderator' | 'consultant' | 'resident' | 'fellow' | 'training_officer';

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  year_level: string | null;
  avatar_url: string | null;
  role: UserRole; // Added role field
  nickname?: string | null;
  updated_at: string;
}



export interface Announcement {
  id: string;
  title: string;
  summary: string; // We can keep summary or rename to content, plan says content but keeping summary for now to match interface till full refactor
  content?: string; // Adding content field for full text
  createdAt?: string;
  author: string;
  author_id: string;
  authorAvatar: string | null;
  authorTitle: string;
  authorNickname?: string | null; // Added
  authorFullName?: string | null; // Added
  date: string;
  category: 'Research' | 'Announcement' | 'Event' | 'Misc' | 'Clinical';
  is_pinned?: boolean;
  is_important?: boolean;
  is_saved?: boolean;
  pinned_at?: string | null;
  readingMinutes?: number;
  imageUrl?: string;
  views: number;
  viewers?: {
    avatar_url: string | null;
    full_name: string | null;
  }[];
  attachments?: { url: string; type: string; name: string; size: number }[];
  externalLink?: string; // Deprecated
  links?: { url: string; title: string }[];
  icon?: string;
}

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface NewsfeedNotification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  type: string;
  time: string;
  createdAt: string;
  read: boolean;
  actorName?: string;
  linkScreen?: Screen | null;
  linkEntityId?: string | null;
}

export interface NewsfeedOnlineUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role?: UserRole;
}

export interface DutyRosterEntry {
  id: string;
  dutyDate: string;
  userId: string | null;
  displayName: string;
  role: string | null;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardSnapshotData {
  newAnnouncementsCount: number;
  latestAnnouncementTitle?: string;
  newCaseLibraryCount: number;
  latestCaseTitle?: string;
  newCalendarCount: number;
  latestCalendarTitle?: string;
  leaveToday: Array<{ id: string; name: string; coverageNames: string[] }>;
  onDutyToday: DutyRosterEntry[];
}

export interface Floor {
  id: string;
  name: string;
  image_url: string;
  width: number;
  height: number;
  bounds?: any;
}

export interface Workstation {
  id: string;
  floor_id: string;
  label: string;
  x: number;
  y: number;
  section?: string | null;
  status_override?: string | null;
  notes?: string | null;
}

export interface OccupancySession {
  id: string;
  workstation_id: string;
  user_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at?: string | null;
  display_name_snapshot?: string | null;
  client_type?: 'qr' | 'kiosk' | 'mobile' | 'web';
  metadata_json?: any;
  status_message?: string | null;
}

export interface CurrentWorkstationStatus {
  id: string;
  label: string;
  x: number;
  y: number;
  floor_id: string;
  section?: string | null;
  status: 'AVAILABLE' | 'IN_USE' | string;
  occupant_name?: string | null;
  occupant_id?: string | null;
  started_at?: string | null;
  last_seen_at?: string | null;
  status_message?: string | null;
  occupancy_mode?: 'self' | 'assigned_user' | 'assigned_external';
  assigned_by_user_id?: string | null;
  expires_at?: string | null;
  occupant_avatar_url?: string | null;
  occupant_role?: UserRole | null;
  occupant_nickname?: string | null;
}

export interface AssignOccupancyPayload {
  mode: 'assigned_user' | 'assigned_external';
  occupantUserId?: string;
  occupantDisplayName?: string;
  statusMessage?: string | null;
}

export interface AssignableOccupant {
  id: string;
  displayName: string;
  role?: UserRole;
  avatarUrl: string | null;
}

export interface QuizExam {
  id: string;
  title: string;
  specialty: string;
  description: string | null;
  duration_minutes: number;
  pass_mark_percent: number;
  status: 'draft' | 'published' | 'archived';
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: 'mcq' | 'image';
  image_url: string | null;
  options: string[];
  correct_answer_index: number;
  explanation: string | null;
  points: number;
  sort_order: number;
  estimated_time_sec?: number | null;
  created_at: string;
}

export interface QuizAttemptSummary {
  attempt_id: string;
  score: number;
  total_points: number;
  correct_count: number;
  is_pass: boolean;
  duration_seconds: number;
  completed_at: string;
}

export type QuizAnswerMap = Record<string, { selected_answer_index?: number; response_time_ms: number }>;

export interface QuizClientEvent {
  event_type: string;
  question_id: string | null;
  event_at: string;
  meta: Record<string, unknown>;
}

export interface QuizExamAnalyticsRow {
  exam_id: string;
  exam_title: string;
  specialty: string;
  attempts_count: number;
  avg_score_percent: number;
  pass_rate_percent: number;
}

export interface QuizQuestionAnalyticsRow {
  question_id: string;
  exam_id: string;
  exam_title: string;
  question_text: string;
  sort_order: number;
  correct_rate_percent: number;
  avg_response_time_ms: number;
  discrimination_proxy: number;
}

export interface QuizUserAnalyticsRow {
  user_id: string;
  full_name: string | null;
  username: string | null;
  role: UserRole | string | null;
  attempts_count: number;
  avg_score_percent: number;
  pass_rate_percent: number;
}

export interface QuizGroupAnalyticsRow {
  role: UserRole | string | null;
  year_level: string | null;
  attempts_count: number;
  learners_count: number;
  avg_score_percent: number;
}

export interface ResidentMonthlyCensus {
  id: string;
  resident_id: string;
  report_month: string;
  interesting_cases_submitted: number;
  notes_count: number;
  fuente_ct_census: number;
  fuente_mri_census: number;
  fuente_xray_census: number;
  plates_count: number;
  has_absence: boolean;
  absence_days: number;
  created_at: string;
  updated_at: string;
}

export interface ResidentMonthlyCensusInput {
  resident_id: string;
  report_month: string;
  interesting_cases_submitted: number;
  notes_count: number;
  fuente_ct_census: number;
  fuente_mri_census: number;
  fuente_xray_census: number;
  plates_count: number;
  has_absence: boolean;
  absence_days: number;
}

export type AccountAccessRequestRole = 'resident' | 'consultant' | 'fellow';
export type AccountAccessRequestStatusType = 'pending' | 'approved' | 'rejected';

export interface AccountAccessRequestInput {
  fullName: string;
  email: string;
  requestedRole: AccountAccessRequestRole;
  yearLevel?: string | null;
}

export interface AccountAccessRequestStatus {
  publicToken: string;
  email: string;
  requestedRole: AccountAccessRequestRole;
  yearLevel: string | null;
  status: AccountAccessRequestStatusType;
  createdAt: string;
  reviewedAt: string | null;
}
