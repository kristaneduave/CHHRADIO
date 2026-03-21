
export type Screen = 'dashboard' | 'upload' | 'quiz' | 'calendar' | 'announcements' | 'profile' | 'search' | 'database' | 'case-view' | 'activity-log' | 'residents-corner' | 'resident-endorsements' | 'newsfeed' | 'anatomy' | 'monthly-census' | 'article-library';
export type SubmissionType = 'interesting_case' | 'rare_pathology' | 'aunt_minnie';
export type GuidelineSyncStatus = 'draft' | 'published' | 'failed';
export type PathologyGuidelineSourceKind = 'google_drive' | 'pdf' | 'external';
export type PathologyGuidelineVersionOrigin = 'pdf_json_import' | 'manual_edit' | 'drive_sync' | 'draft_clone';
export type PathologyGuidelineRequestType = 'topic' | 'pdf_source' | 'guideline_update';
export type PathologyGuidelineRequestStatus = 'pending' | 'reviewed' | 'approved' | 'rejected' | 'completed';
export type PathologyGuidelineContentType = 'checklist' | 'guideline' | 'review';

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
  presenceSource?: 'realtime' | 'persistent' | 'merged';
  isStale?: boolean;
  lastSeenAt?: string | null;
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

export interface ReferenceSource {
  sourceType?: string;
  title?: string;
  page?: string;
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
  impression?: string;
  imagesMetadata?: Array<{ description?: string }>;
  studyDate?: string;
  reference?: ReferenceSource;
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
    user_id?: string; // Optional when coverage is entered as a manual name
    name?: string; // Manual coverage name entry
    modalities: string[]; // Coverage modalities
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

export type UserRole = 'admin' | 'faculty' | 'moderator' | 'consultant' | 'resident' | 'fellow' | 'training_officer';

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  year_level: string | null;
  avatar_url: string | null;
  role: UserRole; // Added role field
  nickname?: string | null;
  title?: string | null;
  motto?: string | null;
  work_mode?: string | null;
  main_modality?: string | null;
  faction?: string | null;
  map_status?: string | null;
  avatar_seed?: string | null;
  active_badges?: string[] | null;
  updated_at: string;
}

export interface ProfilePrivateNote {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface PathologyChecklistItem {
  id: string;
  label: string;
  section?: string | null;
  order: number;
  notes?: string | null;
}

export type ArticleLibraryChecklistItem = PathologyChecklistItem;

export interface PathologyGuidelineListItem {
  guideline_id: string;
  slug: string;
  pathology_name: string;
  specialty?: string | null;
  synonyms: string[];
  keywords: string[];
  source_title?: string | null;
  issuing_body?: string | null;
  version_label?: string | null;
  effective_date?: string | null;
  synced_at?: string | null;
  published_at?: string | null;
  source_kind?: PathologyGuidelineSourceKind;
  primary_topic: string | null;
  secondary_topics: string[];
  clinical_tags: string[];
  anatomy_terms: string[];
  problem_terms: string[];
  content_type: PathologyGuidelineContentType;
  is_featured: boolean;
  search_priority: number;
  related_guideline_slugs: string[];
  match_reason?: string | null;
  tldr_md?: string | null;
}

export interface PathologyGuidelineDetail extends PathologyGuidelineListItem {
  source_url: string;
  google_drive_url: string;
  tldr_md: string;
  rich_summary_md: string;
  reporting_takeaways: string[];
  reporting_red_flags: string[];
  suggested_report_phrases: string[];
  checklist_items: PathologyChecklistItem[];
  parse_notes?: string | null;
  raw_text_excerpt?: string | null;
}

export interface PathologyGuidelineVersion {
  id: string;
  guideline_id: string;
  version_label?: string | null;
  effective_date?: string | null;
  sync_status: GuidelineSyncStatus;
  origin: PathologyGuidelineVersionOrigin;
  source_revision?: string | null;
  source_title?: string | null;
  issuing_body?: string | null;
  source_url: string;
  tldr_md: string;
  rich_summary_md: string;
  reporting_takeaways: string[];
  reporting_red_flags: string[];
  suggested_report_phrases: string[];
  checklist_items: PathologyChecklistItem[];
  parse_notes?: string | null;
  raw_text_excerpt?: string | null;
  synced_at: string;
  published_at?: string | null;
}

export interface EditableDraftPatch {
  version_label?: string | null;
  effective_date?: string | null;
  source_title?: string | null;
  issuing_body?: string | null;
  tldr_md?: string;
  rich_summary_md?: string;
  reporting_takeaways?: string[];
  reporting_red_flags?: string[];
  suggested_report_phrases?: string[];
  checklist_items?: PathologyChecklistItem[];
  parse_notes?: string | null;
}

export interface PathologyGuidelineImportPayload {
  filename?: string | null;
  slug?: string | null;
  pathology_name: string;
  specialty?: string | null;
  synonyms: string[];
  keywords: string[];
  source_title?: string | null;
  issuing_body?: string | null;
  version_label?: string | null;
  effective_date?: string | null;
  tldr_md?: string | null;
  rich_summary_md: string;
  reporting_takeaways?: string[];
  reporting_red_flags?: string[];
  suggested_report_phrases?: string[];
  checklist_items: PathologyChecklistItem[];
  parse_notes?: string | null;
}

export interface PathologyGuidelineSourceInput {
  slug: string;
  pathology_name: string;
  specialty?: string | null;
  synonyms?: string[];
  keywords?: string[];
  source_url: string;
  source_kind: PathologyGuidelineSourceKind;
  google_drive_url: string;
  google_drive_file_id: string;
  source_title?: string | null;
  issuing_body?: string | null;
  is_active?: boolean;
  primary_topic?: string | null;
  secondary_topics?: string[];
  clinical_tags?: string[];
  anatomy_terms?: string[];
  problem_terms?: string[];
  content_type?: PathologyGuidelineContentType;
  is_featured?: boolean;
  search_priority?: number;
  related_guideline_slugs?: string[];
}

export interface PathologyGuidelineSource extends PathologyGuidelineSourceInput {
  id: string;
  created_at?: string;
  updated_at?: string;
}

export interface PathologyGuidelineRequest {
  id: string;
  created_by: string;
  requester_name?: string | null;
  requester_username?: string | null;
  request_type: PathologyGuidelineRequestType;
  title: string;
  description?: string | null;
  source_url?: string | null;
  status: PathologyGuidelineRequestStatus;
  review_notes?: string | null;
  fulfilled_guideline_id?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PathologyGuidelineRequestInput {
  request_type: PathologyGuidelineRequestType;
  title: string;
  description?: string | null;
  source_url?: string | null;
}

export interface PathologyGuidelineRequestUpdate {
  status?: PathologyGuidelineRequestStatus;
  review_notes?: string | null;
  fulfilled_guideline_id?: string | null;
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

export type DutyShift = 'AM' | 'PM' | 'NIGHT';

export interface ResidentEndorsementComment {
  id: string;
  post_id: string;
  message: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  author_name?: string;
  author_role?: string | null;
  author_avatar_url?: string | null;
}

export interface ResidentEndorsementPost {
  id: string;
  duty_date: string;
  shift: DutyShift;
  message: string;
  tags: string[];
  attachments?: { url: string; type: string; name: string; size: number }[];
  is_pinned?: boolean;
  pinned_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
  author_name?: string;
  author_role?: string | null;
  author_avatar_url?: string | null;
  comments: ResidentEndorsementComment[];
}

export interface ResidentEndorsementPostInput {
  duty_date: string;
  shift: DutyShift;
  message: string;
  tags?: string[];
  attachments?: { url: string; type: string; name: string; size: number }[];
  is_pinned?: boolean;
  pinned_at?: string | null;
}

export interface ResidentEndorsementCommentInput {
  post_id: string;
  message: string;
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
  occupant_title?: string | null;
  occupant_motto?: string | null;
  occupant_work_mode?: string | null;
  occupant_main_modality?: string | null;
  occupant_faction?: string | null;
  occupant_map_status?: string | null;
  occupant_avatar_seed?: string | null;
  occupant_active_badges?: string[] | null;
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

export type QuizStatus = 'draft' | 'published' | 'archived';
export type QuizAvailability = 'open' | 'scheduled' | 'closed';
export type QuizTargetLevel = 'junior' | 'senior' | 'board' | 'mixed';
export type QuestionDifficulty = 'junior' | 'senior' | 'board';
export type QuizCorrectOption = 'A' | 'B' | 'C' | 'D' | 'E';
export type QuizAttemptStatus = 'in_progress' | 'submitted' | 'abandoned';

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  specialty: string;
  target_level: QuizTargetLevel;
  timer_enabled: boolean;
  timer_minutes: number | null;
  opens_at: string;
  closes_at: string;
  status: QuizStatus;
  created_by: string;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  question_count?: number;
  author_name?: string | null;
  author_role?: UserRole | null;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  sort_order: number;
  stem: string;
  clinical_context: string | null;
  image_url: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_option: QuizCorrectOption;
  explanation: string;
  teaching_point: string | null;
  pitfall: string | null;
  modality: string | null;
  anatomy_region: string | null;
  difficulty: QuestionDifficulty;
  created_at?: string;
  updated_at?: string;
}

export interface QuizAnswer {
  questionId: string;
  selectedOption: QuizCorrectOption | null;
  isCorrect: boolean;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number;
  total_questions: number;
  percentage: number;
  timer_enabled: boolean;
  timer_minutes: number | null;
  time_spent_seconds: number | null;
  status: QuizAttemptStatus;
  answers: QuizAnswer[];
  quiz?: QuizListItem;
}

export interface QuizListItem extends Quiz {
  availability: QuizAvailability;
  can_start: boolean;
}

export interface QuizQuestionFormValues {
  id?: string;
  stem: string;
  clinical_context: string;
  image_url: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_option: QuizCorrectOption;
  explanation: string;
  teaching_point: string;
  pitfall: string;
  modality: string;
  anatomy_region: string;
  difficulty: QuestionDifficulty;
}

export interface QuizAuthorFormValues {
  title: string;
  description: string;
  specialty: string;
  target_level: QuizTargetLevel;
  timer_enabled: boolean;
  timer_minutes: number | '';
  opens_at: string;
  closes_at: string;
  status: QuizStatus;
  questions: QuizQuestionFormValues[];
}

export interface ResidentMonthlyCensus {
  id: string;
  resident_id: string;
  report_month: string;
  rotation: string;
  dictation_met: boolean;
  ct_mri_target_met: boolean;
  msk_pedia_target_met?: boolean | null;
  comments?: string | null;
  interesting_cases_submitted: number;
  notes_count: number;
  fuente_ct_census: number;
  fuente_mri_census: number;
  fuente_xray_census: number;
  mandaue_ct_census: number;
  mandaue_mri_census: number;
  plates_count: number;
  lates_count: number;
  overall_score: number;
  has_absence: boolean;
  absence_days: number;
  fuente_ct_evidence_url?: string | null;
  fuente_mri_evidence_url?: string | null;
  fuente_xray_evidence_url?: string | null;
  mandaue_ct_evidence_url?: string | null;
  mandaue_mri_evidence_url?: string | null;
  attendance_evidence_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResidentMonthlyCensusInput {
  resident_id: string;
  report_month: string;
  rotation: string;
  dictation_met: boolean;
  ct_mri_target_met: boolean;
  msk_pedia_target_met?: boolean | null;
  comments?: string | null;
  interesting_cases_submitted: number;
  notes_count: number;
  fuente_ct_census: number;
  fuente_mri_census: number;
  fuente_xray_census: number;
  mandaue_ct_census: number;
  mandaue_mri_census: number;
  plates_count: number;
  lates_count: number;
  overall_score: number;
  has_absence: boolean;
  absence_days: number;
  fuente_ct_evidence_url?: string | null;
  fuente_mri_evidence_url?: string | null;
  fuente_xray_evidence_url?: string | null;
  mandaue_ct_evidence_url?: string | null;
  mandaue_mri_evidence_url?: string | null;
  attendance_evidence_url?: string | null;
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

export type NeedleDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface NeedleRiskZone {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
}

export interface NeedleTargetConfig {
  x: number;
  baseY: number;
  radiusX: number;
  radiusY: number;
  amplitude: number;
  frequencyHz: number;
  jitter: number;
}

export interface NeedleRiskConfig {
  nearMissDistance: number;
  zones: NeedleRiskZone[];
}

export interface NeedleScenario {
  id: string;
  title: string;
  anatomy: string;
  difficulty: NeedleDifficulty;
  time_limit_sec: number;
  field_width: number;
  field_height: number;
  needle_entry_x: number;
  needle_entry_y: number;
  max_depth: number;
  target_config: NeedleTargetConfig;
  risk_config: NeedleRiskConfig;
  is_active?: boolean;
}

export interface NeedleRunEvent {
  event_type:
  | 'start'
  | 'angle_change'
  | 'depth_change'
  | 'commit_attempt'
  | 'risk_enter'
  | 'risk_exit'
  | 'success'
  | 'timeout'
  | 'abandon';
  event_at: string;
  meta: Record<string, unknown>;
}

export interface NeedleScoreBreakdown {
  accuracy: number;
  trajectory: number;
  safety: number;
  efficiency: number;
}

export interface NeedleSessionMetrics {
  elapsed_ms: number;
  puncture_attempts: number;
  redirects: number;
  risk_hits: number;
  risk_exposure_ms: number;
  near_miss_ms: number;
  stable_ms_at_commit: number;
  final_distance_px: number;
  success: boolean;
}

export interface NeedleSessionResult {
  id: string;
  scenario_id: string;
  user_id?: string | null;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  score: number;
  competency_band: 'Excellent' | 'Safe' | 'Needs Practice';
  metrics: NeedleSessionMetrics;
  breakdown: NeedleScoreBreakdown;
}

export interface NeedleLeaderboardRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role?: UserRole | null;
  runs_count: number;
  avg_score: number;
  best_score: number;
}

export interface NeedleUserStats {
  user_id: string;
  runs_count: number;
  avg_score: number;
  best_score: number;
  excellent_count: number;
}

export type PickleballDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface PickleballRunMetrics {
  duration_ms: number;
  rally_count: number;
  max_combo: number;
  miss_count: number;
  sweet_hits: number;
}

export interface PickleballRunResult {
  id: string;
  user_id?: string | null;
  score: number;
  difficulty: PickleballDifficulty;
  metrics: PickleballRunMetrics;
  started_at: string;
  completed_at: string;
}

export interface PickleballLeaderboardRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role?: UserRole | null;
  runs_count: number;
  avg_score: number;
  best_score: number;
}

export interface PickleballUserStats {
  user_id: string;
  runs_count: number;
  avg_score: number;
  best_score: number;
  top10_count: number;
}
