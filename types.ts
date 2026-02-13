
export type Screen = 'dashboard' | 'upload' | 'quiz' | 'calendar' | 'bulletin' | 'profile' | 'search' | 'chat';

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
  isPediatric: boolean;
  specialty: string;
  clinicalHistory: string;
  findings: string;
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
}

export interface PatientRecord {
  id: string;
  name: string;
  initials: string;
  age: number;
  date: string;
  specialty: string;
  diagnosticCode: string;
  status: 'Completed' | 'Pending' | 'Draft';
}

export interface SearchFilters {
  startDate: string;
  endDate: string;
  specialty: string;
  diagnosticCode: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  date: string;
  type: 'consultation' | 'rounds' | 'meeting' | 'other';
  description?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  unread?: boolean;
  type: 'AI' | 'Peer';
}

export interface BulletinPost {
  id: string;
  title: string;
  summary: string;
  author: string;
  authorTitle: string;
  date: string;
  category: 'Research' | 'Announcement' | 'Event' | 'Clinical';
  imageUrl?: string;
  views: number;
}
