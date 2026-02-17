
export type Screen = 'dashboard' | 'upload' | 'quiz' | 'calendar' | 'announcements' | 'profile' | 'search' | 'case-view' | 'activity-log' | 'quick-links' | 'institution';

export interface Activity {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  colorClass: string;
}

export interface QuickAction {
  label: string;
  icon: string;
  target: Screen;
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
}

export interface SearchFilters {
  startDate: string;
  endDate: string;
  specialty: string;
  diagnosticCode: string;
}

export type EventType = 'rotation' | 'call' | 'lecture' | 'exam' | 'leave' | 'meeting' | 'pcr' | 'other';

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
  };
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  coverage_details?: {
    user_id: string;
    name?: string; // Manual name entry
    modalities: string[]; // Changed from modality: string
    user?: {
      full_name: string | null;
      avatar_url: string | null;
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

export type UserRole = 'admin' | 'faculty' | 'consultant' | 'resident';

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  year_level: string | null;
  avatar_url: string | null;
  role: UserRole; // Added role field
  updated_at: string;
}



export interface Announcement {
  id: string;
  title: string;
  summary: string; // We can keep summary or rename to content, plan says content but keeping summary for now to match interface till full refactor
  content?: string; // Adding content field for full text
  author: string;
  author_id?: string; // Added for RBAC ownership checks
  authorTitle: string;
  date: string;
  category: 'Research' | 'Announcement' | 'Event' | 'Misc' | 'Clinical';
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
