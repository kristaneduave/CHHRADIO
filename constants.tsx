
import { Activity, QuickAction, PatientRecord, CalendarEvent, Announcement } from './types';

export const ACTIVITIES: Activity[] = [
  {
    id: '1',
    title: 'Completed Neuro Quiz',
    subtitle: 'Score: 92% • 20 questions',
    time: '2h ago',
    icon: 'check_circle',
    colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500'
  },
  {
    id: '2',
    title: 'Case Upload: Chest X-Ray',
    subtitle: 'Pending Review • ID #4921',
    time: '5h ago',
    icon: 'upload_file',
    colorClass: 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary'
  },
  {
    id: '3',
    title: 'Dr. Chen replied to you',
    subtitle: '"Great observation on the..."',
    time: '1d ago',
    icon: 'comment',
    colorClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 group-hover:bg-indigo-500'
  },
  {
    id: '4',
    title: 'Grand Rounds Scheduled',
    subtitle: 'Tomorrow, 09:00 AM',
    time: '1d ago',
    icon: 'event',
    colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20 group-hover:bg-orange-500'
  }
];

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Upload Case',
    icon: 'cloud_upload',
    target: 'upload',
    subtitle: 'Add new studies',
    color: 'text-cyan-400',
    gradient: 'from-slate-800/40 to-slate-900/40' // Unified dark theme
  },
  {
    label: 'Start Quiz',
    icon: 'quiz',
    target: 'quiz',
    subtitle: 'Test your knowledge',
    color: 'text-cyan-400',
    gradient: 'from-slate-800/40 to-slate-900/40'
  },
  {
    label: 'Calendar',
    icon: 'calendar_month',
    target: 'calendar',
    subtitle: 'Department schedule',
    color: 'text-cyan-400',
    gradient: 'from-slate-800/40 to-slate-900/40'
  },
  {
    label: 'Announcements',
    icon: 'campaign',
    target: 'announcements',
    subtitle: 'Latest news',
    color: 'text-cyan-400',
    gradient: 'from-slate-800/40 to-slate-900/40'
  },
  {
    label: 'Resident\'s Corner',
    icon: 'school',
    target: 'residents-corner',
    subtitle: 'Schedules & guides',
    color: 'text-cyan-400',
    gradient: 'from-slate-800/40 to-slate-900/40'
  }
];

export const RESIDENT_TOOLS = [
  { name: 'Radiopaedia', url: 'https://radiopaedia.org/', icon: 'menu_book', description: 'The wiki-based collaborative radiology resource.' },
  { name: 'e-Anatomy', url: 'https://www.imaios.com/en/e-Anatomy', icon: 'accessibility_new', description: 'Interactive atlas of human anatomy.' },
  { name: 'StatDx', url: 'https://www.statdx.com/', icon: 'library_books', description: 'Diagnostic decision support system.' },
  { name: 'ACR Appropriateness Criteria', url: 'https://www.acr.org/Clinical-Resources/ACR-Appropriateness-Criteria', icon: 'assignment_turned_in', description: 'Evidence-based guidelines for specific clinical conditions.' },
  { name: 'RSNA', url: 'https://www.rsna.org/', icon: 'medical_services', description: 'Radiological Society of North America.' }
];

export const PROFILE_IMAGE = "https://lh3.googleusercontent.com/aida-public/AB6AXuB-x0-omqmt3sjc_U-NudpSCPInH2TI-8DgF1wcb0rj6sqDlc7i-xj2jJf_3X4KkgL602OK0aiFuI22M7U7kgSQEgT2uGZudJcFhMifhsrSe6XxvvZRhCRtsqcrkhg5ZqP1l0CQy-kd0F9W1Mq-H_RLCMQRlqHD4yfeNK9ixhw4tyKp4XvavVNz1CEJyYtpAwG8ynwEFOuPAINAQd_KqYbiqKdWRgCSAzt0mTCYiWygqryZql68elToElXDQ8jvlygZnWwi3-k";

export const MOCK_PATIENTS: PatientRecord[] = [
  { id: '101', name: 'James Wilson', initials: 'JW', age: 45, date: '2024-03-15', specialty: 'Neuroradiology', diagnosticCode: 'G30.9', status: 'Completed' },
  { id: '102', name: 'Sarah Miller', initials: 'SM', age: 32, date: '2024-03-18', specialty: 'Cardiology', diagnosticCode: 'I21.9', status: 'Pending' },
  { id: '103', name: 'Robert Chen', initials: 'RC', age: 58, date: '2024-03-20', specialty: 'Pulmonology', diagnosticCode: 'J44.9', status: 'Completed' },
  { id: '104', name: 'Emily Davis', initials: 'ED', age: 12, date: '2024-03-22', specialty: 'Neuroradiology', diagnosticCode: 'Q04.3', status: 'Completed' },
  { id: '105', name: 'Michael Brown', initials: 'MB', age: 67, date: '2024-03-25', specialty: 'Gastrointestinal', diagnosticCode: 'K50.0', status: 'Draft' },
  { id: '106', name: 'Alice Thompson', initials: 'AT', age: 29, date: '2024-03-28', specialty: 'Oncology', diagnosticCode: 'C34.9', status: 'Pending' },
];

export const SPECIALTIES = [
  'Neuroradiology',
  'Gastrointestinal',
  'Cardiology',
  'Orthopedics',
  'Pulmonology',
  'Emergency Medicine',
  'Oncology'
];

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Grand Rounds: Neuro-oncology',
    start_time: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
    event_type: 'meeting', // Mapped from rounds
    type: 'meeting',
    description: 'Weekly presentation of complex oncology cases in the main auditorium.',
    created_by: 'system',
    is_all_day: false
  },
  {
    id: 'e2',
    title: 'Patient Consult: Case #4921',
    start_time: new Date(new Date().setHours(11, 30, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
    event_type: 'exam', // approximate
    type: 'exam',
    created_by: 'system',
    is_all_day: false
  },
  {
    id: 'e3',
    title: 'Department Research Meeting',
    start_time: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
    event_type: 'meeting',
    type: 'meeting',
    created_by: 'system',
    is_all_day: false
  },
  {
    id: 'e4',
    title: 'Radiology Lab Review',
    start_time: new Date(new Date(Date.now() + 86400000).setHours(10, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date(Date.now() + 86400000).setHours(11, 0, 0, 0)).toISOString(),
    event_type: 'exam',
    type: 'exam',
    created_by: 'system',
    is_all_day: false
  }
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'b1',
    category: 'Research',
    title: 'Breakthrough in Non-Invasive Glioblastoma Detection',
    summary: 'A multi-center study led by the Radiology department shows 94% accuracy using new contrast-enhanced spectral imaging protocols.',
    author: 'Dr. Sarah Vance',
    authorTitle: 'Head of Research',
    author_id: 'u1',
    authorAvatar: null,
    date: 'Oct 24, 2024',
    views: 1240,
    imageUrl: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'b2',
    category: 'Announcement',
    title: 'New MRI Suite Opening in Wing C',
    summary: 'The hospital is proud to announce the installation of two state-of-the-art 3T MRI units, operational starting next Monday.',
    author: 'Admin Office',
    authorTitle: 'Hospital Operations',
    author_id: 'u2',
    authorAvatar: null,
    date: 'Oct 22, 2024',
    views: 856
  },
  {
    id: 'b3',
    category: 'Event',
    title: 'Annual Neuro-Radiology Symposium',
    summary: 'Join us for a 3-day deep dive into AI integration in modern radiology. Registration is now open for all staff members.',
    author: 'CME Committee',
    authorTitle: 'Medical Education',
    author_id: 'u3',
    authorAvatar: null,
    date: 'Nov 12, 2024',
    views: 432,
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'b4',
    category: 'Clinical',
    title: 'Updated COVID-19 Staff Vaccination Policy',
    summary: 'Please review the updated guidelines regarding the mandatory booster shots for clinical staff in patient-facing roles.',
    author: 'Infection Control',
    authorTitle: 'Staff Health',
    author_id: 'u4',
    authorAvatar: null,
    date: 'Oct 20, 2024',
    views: 3105
  }
];
