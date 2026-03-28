import React from 'react';
import {
  ConsultantDeckingColumnKey,
  ConsultantDeckingDifficulty,
  ConsultantDeckingEntry,
  ConsultantDeckingPatientSource,
} from '../types';
import {
  createConsultantDeckingEntry,
  deleteConsultantDeckingEntry,
  listConsultantDeckingEntries,
  moveConsultantDeckingEntry,
  reorderDeckingEntries,
  subscribeToConsultantDeckingEntries,
  updateConsultantDeckingEntry,
} from '../services/consultantDeckingService';
import { toastError, toastSuccess } from '../utils/toast';
import PageHeader from './ui/PageHeader';
import PageSection from './ui/PageSection';
import PageShell from './ui/PageShell';
import ScreenStatusNotice from './ui/ScreenStatusNotice';

interface ConsultantDeckingBoardScreenProps {
  currentUserId: string | null;
  onBack: () => void;
}

type DraftState = {
  patientName: string;
  patientAge: string;
  patientSex: '' | 'M' | 'F';
  difficulty: ConsultantDeckingDifficulty;
  patientSource: ConsultantDeckingPatientSource;
  studyDate: string;
  studyTime: string;
  studyDescription: string;
};

type ActiveDragState = {
  entryId: string;
  sourceColumnKey: ConsultantDeckingColumnKey;
  sourceIndex: number;
} | null;

type DropTarget = {
  columnKey: ConsultantDeckingColumnKey;
  index: number;
  zone: 'pill' | 'lane' | 'unassigned';
} | null;

type ConsultantDeckingColumnMeta = {
  key: ConsultantDeckingColumnKey;
  label: string;
};

type StudyFamily = 'CT' | 'CTA' | 'MRI' | 'MRA' | 'OTHER' | 'UNSET';

type StudyOptionGroup = {
  label: string;
  options: readonly string[];
};

const DOCTOR_COLUMNS: Array<ConsultantDeckingColumnMeta & { accent: string }> = [
  { key: 'reynes', label: 'Dr. Reynes', accent: 'border-violet-300/25 bg-violet-500/[0.08] text-violet-100' },
  { key: 'alvarez', label: 'Dr. Alvarez', accent: 'border-amber-300/25 bg-amber-500/[0.08] text-amber-100' },
  { key: 'co-ng', label: 'Dr. Co-Ng', accent: 'border-emerald-300/25 bg-emerald-500/[0.08] text-emerald-100' },
  { key: 'vano-yu', label: 'Dr. Vaño-Yu', accent: 'border-rose-300/25 bg-rose-500/[0.08] text-rose-100' },
];

const DIFFICULTY_OPTIONS: ConsultantDeckingDifficulty[] = ['easy', 'medium', 'hard'];
const PATIENT_SOURCE_OPTIONS: ConsultantDeckingPatientSource[] = ['inpatient', 'er', 'outpatient'];
const PATIENT_SEX_OPTIONS: Array<DraftState['patientSex']> = ['M', 'F'];

const DIFFICULTY_TONE: Record<ConsultantDeckingDifficulty, string> = {
  easy: 'border-emerald-300/70 bg-emerald-400/10 text-emerald-50',
  medium: 'border-amber-300/75 bg-amber-400/10 text-amber-50',
  hard: 'border-rose-300/80 bg-rose-400/10 text-rose-50',
};

const SOURCE_TONE: Record<ConsultantDeckingPatientSource, string> = {
  inpatient: 'border-slate-300/30 bg-slate-400/14 text-slate-50',
  er: 'border-sky-300/30 bg-sky-400/14 text-sky-50',
  outpatient: 'border-teal-300/30 bg-teal-400/14 text-teal-50',
};

const DIFFICULTY_ACCENT: Record<ConsultantDeckingDifficulty, string> = {
  easy: '',
  medium: '',
  hard: '',
};

const SOURCE_LABEL: Record<ConsultantDeckingPatientSource, string> = {
  inpatient: 'IN',
  er: 'ER',
  outpatient: 'OPD',
};

const STUDY_FAMILY_TONE: Record<StudyFamily, string> = {
  CT: 'border-sky-300/25 bg-sky-400/12 text-sky-50',
  CTA: 'border-cyan-300/30 bg-cyan-400/16 text-cyan-50',
  MRI: 'border-violet-300/25 bg-violet-400/12 text-violet-50',
  MRA: 'border-fuchsia-300/25 bg-fuchsia-400/14 text-fuchsia-50',
  OTHER: 'border-white/10 bg-white/[0.06] text-white',
  UNSET: 'border-amber-300/25 bg-amber-400/10 text-amber-50',
};

const DIFFICULTY_PRIORITY: Record<ConsultantDeckingDifficulty, number> = {
  hard: 0,
  medium: 1,
  easy: 2,
};

const SOURCE_PRIORITY: Record<ConsultantDeckingPatientSource, number> = {
  er: 0,
  inpatient: 1,
  outpatient: 2,
};

const STUDY_OPTION_GROUPS: readonly StudyOptionGroup[] = [
  {
    label: 'CT',
    options: [
      'CT head facial',
      'CT brain plain',
      'CT brain with contrast',
      'CT chest plain',
      'CT chest with contrast',
      'CT stonogram',
      'CT whole abdomen plain',
      'CT whole abdomen with contrast',
      'CT abdomen - Urography',
      'CT chest and whole abdomen plain',
      'CT chest and whole abdomen with contrast',
      'CT upper abdomen plain',
      'CT upper abdomen with contrast',
      'CT neck plain',
      'CT neck with contrast',
      'CT hip plain',
      'CT pelvis plain',
      'CT lower abdomen plain',
      'CT lower abdomen with contrast',
      'CT spine - Lumbar',
      'CT extremities - Leg',
      'CT paranasal sinuses plain',
      'CT paranasal sinuses with contrast',
      'CT temporal fossa plain',
    ],
  },
  {
    label: 'CTA',
    options: [
      'CT angiography-PE',
      'CT angiography - Extremities',
      'CT angiography - Coronary',
      'CT angiography - Chest',
      'CT angiography - Brain',
      'CT angiography - Lower extremities',
    ],
  },
  {
    label: 'MRI',
    options: [
      'MR knee (left)',
      'MR knee (right)',
      'MR Lumbar spine plain',
      'MR Lumbar spine plain with spine screening',
      'MR Lumbar spine with contrast',
      'MR brain plain',
      'MR brain with contrast',
      'MR thoracolumbar plain',
      'MR Lumbar spine with spine screening',
      'MR shoulder (left)',
      'MR shoulder (right)',
      'MR thoracic spine plain',
      'MR thoracic spine plain with spine screening',
      'MR cervical spine plain',
      'MR cervical spine plain with spine screening',
      'MR multiparametric prostate',
      'MR biparametric prostate',
      'MR wrist (left)',
      'MR wrist (right)',
      'MR pelvis with contrast',
      'MR pelvis plain',
      'MR cardiac plain',
      'MR cardiac with contrast',
      'MR whole spine plain',
    ],
  },
  {
    label: 'MRA',
    options: [
      'MRA brain plain',
      'MRA brain with contrast',
      'MRA brain plain with spine screening',
    ],
  },
  {
    label: 'Other',
    options: ['Calcium score'],
  },
] as const;

const EXPORT_COLUMNS: ConsultantDeckingColumnMeta[] = DOCTOR_COLUMNS.map(({ key, label }) => ({ key, label }));

const EXPORT_HEADER_ACCENT: Record<Exclude<ConsultantDeckingColumnKey, 'inbox'>, { background: string; text: string; border: string; glow: string }> = {
  reynes: { background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)', text: '#5b21b6', border: '#c4b5fd', glow: 'rgba(139, 92, 246, 0.18)' },
  alvarez: { background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', text: '#b45309', border: '#fcd34d', glow: 'rgba(245, 158, 11, 0.18)' },
  'co-ng': { background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', text: '#047857', border: '#86efac', glow: 'rgba(34, 197, 94, 0.16)' },
  'vano-yu': { background: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)', text: '#be123c', border: '#fda4af', glow: 'rgba(244, 63, 94, 0.18)' },
};

const labelize = (value: string) => {
  if (value === 'er') return 'ER';
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const toLocalDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalTimeInputValue = (value: Date) => {
  const hours = `${value.getHours()}`.padStart(2, '0');
  const minutes = `${value.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
};

const createEmptyDraft = (now: Date = new Date()): DraftState => ({
  patientName: '',
  patientAge: '',
  patientSex: '',
  difficulty: 'medium',
  patientSource: 'er',
  studyDate: toLocalDateInputValue(now),
  studyTime: toLocalTimeInputValue(now),
  studyDescription: '',
});

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatStudyDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
  });
};

const formatStudyTime = (value?: string | null) => {
  if (!value) return null;
  const [hours, minutes] = value.split(':');
  if (!hours || !minutes) return value;
  const parsed = new Date();
  parsed.setHours(Number(hours), Number(minutes), 0, 0);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatStudyDateTimeLabel = (entry: Pick<ConsultantDeckingEntry, 'studyDate' | 'studyTime'>) =>
  [formatStudyDate(entry.studyDate), formatStudyTime(entry.studyTime)].filter(Boolean).join(' | ') || 'Study date/time pending';

const formatExportStudyDateTime = (entry: Pick<ConsultantDeckingEntry, 'studyDate' | 'studyTime'>) => {
  if (!entry.studyDate || !entry.studyTime) return 'Study date/time pending';
  const parsed = new Date(`${entry.studyDate}T${entry.studyTime}`);
  if (Number.isNaN(parsed.getTime())) {
    return `${entry.studyDate} ${entry.studyTime}`;
  }

  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatAgeSex = (entry: Pick<ConsultantDeckingEntry, 'patientAge' | 'patientSex'>) => {
  const parts = [
    typeof entry.patientAge === 'number' ? `${entry.patientAge}` : null,
    entry.patientSex || null,
  ].filter(Boolean);
  return parts.join('/') || null;
};

const resolveStudyFamily = (studyDescription?: string | null): StudyFamily => {
  const normalized = (studyDescription || '').trim();
  if (!normalized) return 'UNSET';

  const upper = normalized.toUpperCase();
  if (upper.startsWith('CT ANGIOGRAPHY') || upper.startsWith('CTA')) return 'CTA';
  if (upper.startsWith('MRA')) return 'MRA';
  if (upper.startsWith('MR')) return 'MRI';
  if (upper.startsWith('CT')) return 'CT';
  return 'OTHER';
};

const buildLaneSummary = (entries: ConsultantDeckingEntry[]) => ({
  difficulty: {
    hard: entries.filter((entry) => entry.difficulty === 'hard').length,
    medium: entries.filter((entry) => entry.difficulty === 'medium').length,
    easy: entries.filter((entry) => entry.difficulty === 'easy').length,
  },
  source: {
    er: entries.filter((entry) => entry.patientSource === 'er').length,
    inpatient: entries.filter((entry) => entry.patientSource === 'inpatient').length,
    outpatient: entries.filter((entry) => entry.patientSource === 'outpatient').length,
  },
});

const formatLaneSummary = (entries: ConsultantDeckingEntry[]) => {
  const summary = buildLaneSummary(entries);
  const difficultyParts = [
    summary.difficulty.hard > 0 ? `Hard ${summary.difficulty.hard}` : null,
    summary.difficulty.medium > 0 ? `Medium ${summary.difficulty.medium}` : null,
    summary.difficulty.easy > 0 ? `Easy ${summary.difficulty.easy}` : null,
  ].filter(Boolean);
  const sourceParts = [
    summary.source.er > 0 ? `ER ${summary.source.er}` : null,
    summary.source.inpatient > 0 ? `Inpatient ${summary.source.inpatient}` : null,
    summary.source.outpatient > 0 ? `OPD ${summary.source.outpatient}` : null,
  ].filter(Boolean);

  return {
    difficulty: difficultyParts.join(', '),
    source: sourceParts.join(', '),
  };
};

const formatSourceStatus = (entry: Pick<ConsultantDeckingEntry, 'patientSource'>) =>
  SOURCE_LABEL[entry.patientSource];

const STATUS_TONE_BY_COMBINATION: Record<ConsultantDeckingPatientSource, Record<ConsultantDeckingDifficulty, string>> = {
  inpatient: {
    easy: 'border-slate-300/80 bg-slate-100 text-slate-900',
    medium: 'border-slate-300/80 bg-slate-100 text-slate-900',
    hard: 'border-slate-300/80 bg-slate-100 text-slate-900',
  },
  er: {
    easy: 'border-rose-300/80 bg-rose-400 text-slate-950',
    medium: 'border-rose-300/80 bg-rose-400 text-slate-950',
    hard: 'border-rose-300/80 bg-rose-400 text-slate-950',
  },
  outpatient: {
    easy: 'border-amber-300/80 bg-amber-300 text-amber-950',
    medium: 'border-amber-300/80 bg-amber-300 text-amber-950',
    hard: 'border-amber-300/80 bg-amber-300 text-amber-950',
  },
};

const sortDeckingEntriesForDisplay = (
  entries: ConsultantDeckingEntry[],
  columnKey: ConsultantDeckingColumnKey,
) =>
  [...entries].sort((left, right) => {
    if (columnKey !== 'inbox') {
      const difficultyGap = DIFFICULTY_PRIORITY[left.difficulty] - DIFFICULTY_PRIORITY[right.difficulty];
      if (difficultyGap !== 0) return difficultyGap;

      const sourceGap = SOURCE_PRIORITY[left.patientSource] - SOURCE_PRIORITY[right.patientSource];
      if (sourceGap !== 0) return sourceGap;
    }

    if (left.position !== right.position) return left.position - right.position;
    return left.patientName.localeCompare(right.patientName);
  });

const buildDeckingExportHtml = (
  groupedEntries: Map<ConsultantDeckingColumnKey, ConsultantDeckingEntry[]>,
) => {
  const sections = EXPORT_COLUMNS.map((column) => {
    const columnEntries = groupedEntries.get(column.key) || [];
    const accent = EXPORT_HEADER_ACCENT[column.key as Exclude<ConsultantDeckingColumnKey, 'inbox'>];
    const items = columnEntries.length
      ? '<div class="list">' + columnEntries.map((entry) =>
          '<article class="item"><div class="row"><strong>' + escapeHtml(labelize(entry.patientSource).toUpperCase()) + ' - ' + escapeHtml(entry.patientName) + (formatAgeSex(entry) ? ' ' + escapeHtml(formatAgeSex(entry)) : '') + '</strong></div><div class="study">' + escapeHtml((entry.studyDescription || 'Study pending').toUpperCase()) + '</div><div class="meta"><span>' + escapeHtml(formatExportStudyDateTime(entry)) + '</span></div></article>'
        ).join('') + '</div>'
      : '<p class="empty">No patients assigned.</p>';

    return '<section><div class="section-header" style="background:' + accent.background + ';color:' + accent.text + ';border-color:' + accent.border + ';--header-glow:' + accent.glow + ';"><h2>' + escapeHtml(column.label) + '</h2></div>' + items + '</section>';
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>CT Fuente deck (Saturday 7 am to Sunday 7 am)</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: "Aptos", "Segoe UI", "Helvetica Neue", sans-serif;
        margin: 0;
        color: #0f172a;
        line-height: 1.15;
        background: #ffffff;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: #0f172a;
      }
      p { margin: 0; }
      .canvas { padding: 14px; }
      .sheet {
        width: 1380px;
        min-height: 860px;
        margin: 0 auto;
        border: 2px solid rgba(30, 41, 59, 0.8);
        border-radius: 0;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
        padding: 14px 12px 14px 14px;
        box-shadow:
          0 22px 50px rgba(15, 23, 42, 0.16),
          0 0 0 8px rgba(255, 255, 255, 0.45);
      }
      .sheet-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 2px 0 10px;
        margin-bottom: 12px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.24);
        text-align: center;
      }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; align-items: stretch; }
      section {
        border: 1px solid rgba(51, 65, 85, 0.2);
        border-radius: 0;
        background: rgba(255, 255, 255, 0.88);
        padding: 8px 5px 8px 8px;
        min-height: 395px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      .section-header {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        margin: -1px 0 8px;
        padding: 7px 12px;
        border: 1px solid #94a3b8;
        border-radius: 0;
        box-shadow: 0 10px 22px var(--header-glow);
      }
      h2 {
        margin: 0;
        font-size: 17px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .list { display: grid; gap: 4px; }
      .item {
        border-top: 1px solid rgba(148, 163, 184, 0.28);
        padding: 5px 2px 0 1px;
      }
      .item:first-child { border-top: 0; padding-top: 0; }
      .row { display: block; }
      .row strong {
        font-size: 14.6px;
        line-height: 1.12;
        word-break: break-word;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: #0f172a;
      }
      .meta {
        display: block;
        margin-top: 3px;
        color: #64748b;
        font-size: 12px;
        font-weight: 600;
      }
      .study {
        margin-top: 3px;
        color: #1e293b;
        font-size: 12.6px;
        line-height: 1.18;
        word-break: break-word;
        font-weight: 700;
        letter-spacing: 0.01em;
      }
      .empty { color: #64748b; font-size: 11px; }
    </style>
  </head>
  <body>
    <div class="canvas">
        <div class="sheet">
          <div class="sheet-header">
            <h1>CT Fuente deck (Saturday 7 am to Sunday 7 am)</h1>
          </div>
          <div class="grid">${sections}</div>
        </div>
    </div>
  </body>
</html>`;
};

const PatientPill: React.FC<{
  entry: ConsultantDeckingEntry;
  onOpen: (entry: ConsultantDeckingEntry) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  isDropMarker?: boolean;
  isDragging?: boolean;
}> = ({
  entry,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDropMarker = false,
  isDragging = false,
}) => {
  return (
    <div className="space-y-1.5 pt-2.5">
      {isDropMarker ? <div className="h-[3px] rounded-full bg-cyan-300/80" /> : null}
      <div
        role="button"
        tabIndex={0}
        draggable
        onClick={() => onOpen(entry)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(entry);
          }
        }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`group relative flex w-full cursor-grab items-start gap-3 rounded-[1.6rem] border px-4 pb-2.5 pt-2.5 text-left transition-all hover:border-white/18 hover:bg-white/[0.06] active:cursor-grabbing ${DIFFICULTY_TONE[entry.difficulty]} ${DIFFICULTY_ACCENT[entry.difficulty]} ${
          isDragging ? 'opacity-60' : ''
        }`}
        aria-label={`Edit ${entry.patientName}`}
      >
        <span className={`absolute right-3 top-0 -translate-y-[42%] inline-flex rounded-full border px-2.5 py-[5px] text-[10px] font-bold leading-none tracking-[0.12em] shadow-[0_8px_18px_rgba(2,6,23,0.16)] ${STATUS_TONE_BY_COMBINATION[entry.patientSource][entry.difficulty]}`}>
          {formatSourceStatus(entry)}
        </span>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-right">
          {entry.studyDate ? (
            <span className="block text-[10px] font-medium text-white/55">
              {formatStudyDate(entry.studyDate)}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start justify-center gap-0.5 text-left">
            <span className="break-words text-[14px] font-semibold leading-tight tracking-[-0.01em] text-white">
              {entry.patientName}
            </span>
            <span className="break-words text-[12px] font-normal leading-snug text-white/74">
              {entry.studyDescription || 'Study pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConsultantDeckingBoardScreen: React.FC<ConsultantDeckingBoardScreenProps> = ({
  currentUserId,
  onBack,
}) => {
  const [entries, setEntries] = React.useState<ConsultantDeckingEntry[]>([]);
  const [loading, setLoading] = React.useState(Boolean(currentUserId));
  const [isSaving, setIsSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftState>(() => createEmptyDraft());
  const [activeDrag, setActiveDrag] = React.useState<ActiveDragState>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget>(null);
  const [editingEntry, setEditingEntry] = React.useState<ConsultantDeckingEntry | null>(null);
  const [editDraft, setEditDraft] = React.useState<DraftState>(() => createEmptyDraft());
  const [editColumnKey, setEditColumnKey] = React.useState<ConsultantDeckingColumnKey>('inbox');
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isClearingAll, setIsClearingAll] = React.useState(false);

  const groupedEntries = React.useMemo(() => {
    const grouped = new Map<ConsultantDeckingColumnKey, ConsultantDeckingEntry[]>();
    grouped.set('inbox', []);
    DOCTOR_COLUMNS.forEach((column) => grouped.set(column.key, []));
    entries.forEach((entry) => {
      const current = grouped.get(entry.columnKey) || [];
      current.push(entry);
      grouped.set(entry.columnKey, current);
    });
    grouped.forEach((columnEntries, columnKey) => {
      grouped.set(columnKey, sortDeckingEntriesForDisplay(columnEntries, columnKey));
    });
    return grouped;
  }, [entries]);

  const unassignedEntries = groupedEntries.get('inbox') || [];

  const loadEntries = React.useCallback(async (options?: { silent?: boolean; force?: boolean; suppressError?: boolean }) => {
    if (!currentUserId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const nextEntries = await listConsultantDeckingEntries({ force: options?.force });
      setEntries(nextEntries);
    } catch (error: any) {
      if (!options?.suppressError) {
        toastError('Unable to load consultant decking board', error?.message || 'Please refresh and try again.');
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [currentUserId]);

  React.useEffect(() => {
    loadEntries().catch(() => undefined);
  }, [loadEntries]);

  React.useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    return subscribeToConsultantDeckingEntries(() => {
      loadEntries({ silent: true, force: true, suppressError: true }).catch(() => undefined);
    });
  }, [currentUserId, loadEntries]);

  React.useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const runRefresh = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      loadEntries({ silent: true, force: true, suppressError: true }).catch(() => undefined);
    };

    const intervalId = window.setInterval(runRefresh, 5000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUserId, loadEntries]);

  const resetDraft = () => setDraft(createEmptyDraft());

  const handleCreateEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUserId) {
      toastError('Sign in required', 'Please sign in to add consultant decking patients.');
      return;
    }

    const patientName = draft.patientName.trim();
    if (!patientName) {
      toastError('Patient name required', 'Please enter the patient name before adding a patient.');
      return;
    }
    if (!draft.studyDate || !draft.studyTime || !draft.studyDescription) {
      toastError('Study details required', 'Please complete the study date, time, and description.');
      return;
    }

    try {
      setIsSaving(true);
      await createConsultantDeckingEntry({
        patientName,
        patientAge: draft.patientAge ? Number(draft.patientAge) : null,
        patientSex: draft.patientSex || null,
        difficulty: draft.difficulty,
        patientSource: draft.patientSource,
        studyDate: draft.studyDate,
        studyTime: draft.studyTime,
        studyDescription: draft.studyDescription,
      });
      resetDraft();
      await loadEntries({ force: true });
      toastSuccess('Patient added');
    } catch (error: any) {
      toastError('Unable to add patient', error?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDropMove = async (
    event: React.DragEvent<HTMLElement>,
    columnKey: ConsultantDeckingColumnKey,
    index: number,
  ) => {
    const draggedEntryId = activeDrag?.entryId || event.dataTransfer.getData('text/plain').trim();
    if (!draggedEntryId) return;

    const previousEntries = entries;
    setEntries((current) => reorderDeckingEntries(current, draggedEntryId, columnKey, index));
    setDropTarget(null);
    setActiveDrag(null);

    try {
      await moveConsultantDeckingEntry(draggedEntryId, columnKey, index);
    } catch (error: any) {
      setEntries(previousEntries);
      toastError('Unable to move patient', error?.message || 'Please try again.');
      await loadEntries({ silent: true, force: true });
    }
  };

  const openEditor = (entry: ConsultantDeckingEntry) => {
    setEditingEntry(entry);
    setEditDraft({
      patientName: entry.patientName,
      patientAge: typeof entry.patientAge === 'number' ? String(entry.patientAge) : '',
      patientSex: entry.patientSex || '',
      difficulty: entry.difficulty,
      patientSource: entry.patientSource,
      studyDate: entry.studyDate || '',
      studyTime: entry.studyTime || '',
      studyDescription: entry.studyDescription || '',
    });
    setEditColumnKey(entry.columnKey);
  };

  const closeEditor = () => {
    setEditingEntry(null);
    setEditDraft(createEmptyDraft());
    setEditColumnKey('inbox');
    setIsSubmittingEdit(false);
  };

  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEntry) return;

    const patientName = editDraft.patientName.trim();
    if (!patientName) {
      toastError('Patient name required', 'Please enter the patient name before saving.');
      return;
    }
    if (!editDraft.studyDate || !editDraft.studyTime || !editDraft.studyDescription) {
      toastError('Study details required', 'Please complete the study date, time, and description.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      await updateConsultantDeckingEntry(editingEntry.id, {
        patientName,
        patientAge: editDraft.patientAge ? Number(editDraft.patientAge) : null,
        patientSex: editDraft.patientSex || null,
        difficulty: editDraft.difficulty,
        patientSource: editDraft.patientSource,
        studyDate: editDraft.studyDate,
        studyTime: editDraft.studyTime,
        studyDescription: editDraft.studyDescription,
      });

      if (editColumnKey !== editingEntry.columnKey) {
        const destinationCount =
          editColumnKey === 'inbox'
            ? unassignedEntries.length
            : groupedEntries.get(editColumnKey)?.length || 0;
        await moveConsultantDeckingEntry(editingEntry.id, editColumnKey, destinationCount);
      }

      await loadEntries({ force: true });
      closeEditor();
      toastSuccess('Patient updated');
    } catch (error: any) {
      toastError('Unable to update patient', error?.message || 'Please try again.');
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry) return;

    try {
      setIsSubmittingEdit(true);
      await deleteConsultantDeckingEntry(editingEntry.id);
      await loadEntries({ force: true });
      closeEditor();
      toastSuccess('Patient removed');
    } catch (error: any) {
      toastError('Unable to delete patient', error?.message || 'Please try again.');
      setIsSubmittingEdit(false);
    }
  };

  const handleExportSummary = () => {
    try {
      setIsExporting(true);
      const html = buildDeckingExportHtml(groupedEntries);
      const exportWindow = window.open('', 'consultant-decking-export', 'width=1480,height=980,resizable=yes,scrollbars=yes');

      if (!exportWindow) {
        throw new Error('Popup blocked. Please allow popups for this site and try again.');
      }

      exportWindow.document.open();
      exportWindow.document.write(html);
      exportWindow.document.close();
      exportWindow.focus();
      toastSuccess('Screenshot view opened');
    } catch (error: any) {
      toastError('Unable to export summary', error?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAll = async () => {
    if (!currentUserId || !entries.length) return;

    try {
      setIsClearingAll(true);
      await Promise.all(entries.map((entry) => deleteConsultantDeckingEntry(entry.id)));
      await loadEntries({ force: true });
      closeEditor();
      toastSuccess('Board cleared');
    } catch (error: any) {
      toastError('Unable to clear board', error?.message || 'Please try again.');
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <PageShell layoutMode="wide" contentClassName="space-y-6 pb-28 xl:pb-32">
      <PageHeader
        title="Consultant Decking"
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={!currentUserId || loading || isClearingAll || !entries.length}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearingAll ? 'Clearing...' : 'Clear All'}
            </button>
            <button
              type="button"
              onClick={handleExportSummary}
              disabled={!currentUserId || loading || isExporting || isClearingAll}
              className="rounded-full border border-cyan-200/30 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-50 transition-colors hover:border-cyan-200/45 hover:bg-cyan-400/28 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export Summary'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:text-white"
            >
              Back
            </button>
          </div>
        )}
      />

      {!currentUserId ? (
        <PageSection>
          <ScreenStatusNotice
            message="Sign in is required to view and update the shared consultant decking board."
            tone="info"
          />
        </PageSection>
      ) : null}

      <PageSection className="space-y-5">

        <form
          className="grid gap-x-3 gap-y-2 xl:grid-cols-[108px_minmax(230px,1.65fr)_64px_84px_minmax(186px,1.05fr)_minmax(210px,1fr)_100px_88px] xl:items-end"
          onSubmit={handleCreateEntry}
        >
          <label className="space-y-1.5">
            <span className="pl-1 text-xs font-semibold leading-none text-slate-400">Source</span>
            <select
              value={draft.patientSource}
              onChange={(event) => setDraft((current) => ({ ...current, patientSource: event.target.value as ConsultantDeckingPatientSource }))}
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
              aria-label="Patient source"
            >
              {PATIENT_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="pl-1 text-xs font-semibold leading-none text-slate-400">Patient name</span>
            <input
              type="text"
              value={draft.patientName}
              onChange={(event) => setDraft((current) => ({ ...current, patientName: event.target.value }))}
              placeholder="Enter patient name"
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/40"
              aria-label="Patient name"
            />
          </label>

          <label className="space-y-1.5">
            <span className="pl-1 text-xs font-semibold leading-none text-slate-400">Age</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={draft.patientAge}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^\d]/g, '');
                if (!nextValue) {
                  setDraft((current) => ({ ...current, patientAge: '' }));
                  return;
                }
                const bounded = Math.min(Number(nextValue), 100);
                setDraft((current) => ({ ...current, patientAge: String(bounded) }));
              }}
              inputMode="numeric"
              className="w-full appearance-none rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 [appearance:textfield] focus:border-cyan-300/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Patient age"
            />
          </label>

          <label className="space-y-1.5">
            <span className="pl-1 text-xs font-semibold leading-none text-slate-400">Sex</span>
            <select
              value={draft.patientSex}
              onChange={(event) => setDraft((current) => ({ ...current, patientSex: event.target.value as DraftState['patientSex'] }))}
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
              aria-label="Patient sex"
            >
              <option value=""></option>
              {PATIENT_SEX_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="pl-1 text-xs font-semibold leading-none text-slate-400">Study schedule</span>
            <input
              type="datetime-local"
              value={draft.studyDate && draft.studyTime ? `${draft.studyDate}T${draft.studyTime}` : ''}
              onClick={(e) => {
                try {
                  if (typeof e.currentTarget.showPicker === 'function') {
                    e.currentTarget.showPicker();
                  }
                } catch (err) {
                  // Ignore errors, browser might not support showPicker or gesture requirement
                }
              }}
              onChange={(event) => {
                const val = event.target.value;
                if (!val) {
                  setDraft((current) => ({ ...current, studyDate: '', studyTime: '' }));
                  return;
                }
                const [datePart, timePart] = val.split('T');
                setDraft((current) => ({ ...current, studyDate: datePart || '', studyTime: timePart || '' }));
              }}
              className="w-full cursor-pointer rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-clear-button]:hidden"
              aria-label="Study schedule"
            />
          </label>

          <label className="space-y-1.5">
            <span className="pl-1 text-xs font-semibold leading-none text-slate-400">Study description</span>
            <select
              value={draft.studyDescription}
              onChange={(event) => setDraft((current) => ({ ...current, studyDescription: event.target.value }))}
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
              aria-label="Study description"
            >
              <option value="">Select study description</option>
              {STUDY_OPTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="pl-1 text-xs font-semibold leading-none text-slate-400">Difficulty</span>
            <select
              value={draft.difficulty}
              onChange={(event) => setDraft((current) => ({ ...current, difficulty: event.target.value as ConsultantDeckingDifficulty }))}
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
              aria-label="Case difficulty"
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={!currentUserId || isSaving}
            className="mt-auto w-full rounded-full border border-cyan-300/40 bg-cyan-500/25 px-4 py-3 text-sm font-bold text-cyan-50 shadow-[0_0_16px_rgba(6,182,212,0.2)] transition-all hover:-translate-y-px hover:border-cyan-200/50 hover:bg-cyan-400/35 hover:shadow-[0_0_24px_rgba(6,182,212,0.35)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:border-cyan-300/40 disabled:hover:bg-cyan-500/25 disabled:hover:shadow-[0_0_16px_rgba(6,182,212,0.2)]"
          >
            {isSaving ? 'Adding...' : 'Add'}
          </button>
        </form>

        <div className="border-t border-white/8 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Unassigned patients</p>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
              {unassignedEntries.length}
            </span>
          </div>

          <div
            className={`min-h-[5rem] rounded-[1.5rem] border border-dashed px-3 py-3 transition-colors ${
              dropTarget?.columnKey === 'inbox' ? 'border-cyan-300/40 bg-cyan-500/[0.05]' : 'border-white/10 bg-white/[0.02]'
            }`}
            onDragOver={(event) => {
              if (!currentUserId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropTarget({ columnKey: 'inbox', index: unassignedEntries.length, zone: 'unassigned' });
            }}
            onDragEnter={(event) => {
              if (!currentUserId) return;
              event.preventDefault();
              setDropTarget({ columnKey: 'inbox', index: unassignedEntries.length, zone: 'unassigned' });
            }}
            onDragLeave={() => {
              setDropTarget((current) => (current?.columnKey === 'inbox' ? null : current));
            }}
            onDrop={(event) => {
              if (!currentUserId) return;
              event.preventDefault();
              handleDropMove(event, 'inbox', unassignedEntries.length).catch(() => undefined);
            }}
          >
            {loading ? (
              <div className="flex min-h-[4rem] items-center justify-center text-sm text-slate-500">Loading patients...</div>
            ) : unassignedEntries.length ? (
              <div className="flex flex-wrap gap-2">
                {unassignedEntries.map((entry, index) => (
                  <PatientPill
                    key={entry.id}
                    entry={entry}
                    onOpen={openEditor}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', entry.id);
                      setActiveDrag({ entryId: entry.id, sourceColumnKey: entry.columnKey, sourceIndex: index });
                    }}
                    onDragEnd={() => {
                      setActiveDrag(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(event) => {
                      if (!currentUserId) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDropTarget({ columnKey: 'inbox', index, zone: 'pill' });
                    }}
                    onDrop={(event) => {
                      if (!currentUserId) return;
                      event.preventDefault();
                      handleDropMove(event, 'inbox', index).catch(() => undefined);
                    }}
                    isDropMarker={dropTarget?.columnKey === 'inbox' && dropTarget.index === index}
                    isDragging={activeDrag?.entryId === entry.id}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[4rem] items-center justify-center text-sm text-slate-500">No unassigned patients</div>
            )}
          </div>
        </div>
      </PageSection>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1040px] gap-4 xl:min-w-0 xl:grid-cols-4">
          {DOCTOR_COLUMNS.map((column) => {
            const columnEntries = groupedEntries.get(column.key) || [];
            const isDropColumn = dropTarget?.columnKey === column.key;
            const laneSummaryText = formatLaneSummary(columnEntries);

            return (
              <PageSection
                key={column.key}
                className={`min-h-[20rem] border-white/8 bg-white/[0.02] ${isDropColumn ? 'border-cyan-300/35 bg-cyan-500/[0.04]' : ''}`}
              >
                <div
                  className="flex h-full flex-col gap-4"
                  onDragOver={(event) => {
                    if (!currentUserId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDropTarget({ columnKey: column.key, index: columnEntries.length, zone: 'lane' });
                  }}
                  onDragEnter={(event) => {
                    if (!currentUserId) return;
                    event.preventDefault();
                    setDropTarget({ columnKey: column.key, index: columnEntries.length, zone: 'lane' });
                  }}
                  onDragLeave={() => {
                    setDropTarget((current) => (current?.columnKey === column.key ? null : current));
                  }}
                  onDrop={(event) => {
                    if (!currentUserId) return;
                    event.preventDefault();
                    handleDropMove(event, column.key, columnEntries.length).catch(() => undefined);
                  }}
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="h-8" />
                    <h2 className="text-center text-base font-semibold text-white">{column.label}</h2>
                    <div className="h-8" />
                  </div>

                  {loading ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading lane...</div>
                  ) : columnEntries.length ? (
                    <div className="space-y-2">
                      {columnEntries.map((entry, index) => (
                        <PatientPill
                          key={entry.id}
                          entry={entry}
                          onOpen={openEditor}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', entry.id);
                            setActiveDrag({ entryId: entry.id, sourceColumnKey: entry.columnKey, sourceIndex: index });
                          }}
                          onDragEnd={() => {
                            setActiveDrag(null);
                            setDropTarget(null);
                          }}
                          onDragOver={(event) => {
                            if (!currentUserId) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            setDropTarget({ columnKey: column.key, index, zone: 'pill' });
                          }}
                          onDrop={(event) => {
                            if (!currentUserId) return;
                            event.preventDefault();
                            handleDropMove(event, column.key, index).catch(() => undefined);
                          }}
                          isDropMarker={dropTarget?.columnKey === column.key && dropTarget.index === index}
                          isDragging={activeDrag?.entryId === entry.id}
                        />
                      ))}
                      {dropTarget?.columnKey === column.key && dropTarget.index === columnEntries.length ? (
                        <div className="h-[3px] rounded-full bg-cyan-300/80" />
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className="flex flex-1 items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-slate-950/25 px-4 text-center text-sm text-slate-500"
                      onDragOver={(event) => {
                        if (!currentUserId) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTarget({ columnKey: column.key, index: 0, zone: 'lane' });
                      }}
                      onDragEnter={(event) => {
                        if (!currentUserId) return;
                        event.preventDefault();
                        setDropTarget({ columnKey: column.key, index: 0, zone: 'lane' });
                      }}
                      onDrop={(event) => {
                        if (!currentUserId) return;
                        event.preventDefault();
                        handleDropMove(event, column.key, 0).catch(() => undefined);
                      }}
                    >
                      Drop patients here
                    </div>
                  )}

                  <div className="mt-auto border-t border-white/8 pt-3">
                    <div className="space-y-1 text-[12px] font-medium text-slate-300">
                      <p>{laneSummaryText.difficulty}</p>
                      <p>{laneSummaryText.source}</p>
                    </div>
                  </div>
                </div>
              </PageSection>
            );
          })}
        </div>
      </div>

      {editingEntry ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/72 px-4 pb-4 pt-10 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Edit consultant decking patient"
          onClick={closeEditor}
        >
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Edit patient</h2>
                <p className="mt-1 text-sm text-slate-400">Update details or move this patient to another lane.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:text-white"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSaveEdit}>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-400">Patient name</span>
                <input
                  type="text"
                  value={editDraft.patientName}
                  onChange={(event) => setEditDraft((current) => ({ ...current, patientName: event.target.value }))}
                  aria-label="Edit patient name"
                  className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Age</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editDraft.patientAge}
                    onChange={(event) => setEditDraft((current) => ({ ...current, patientAge: event.target.value }))}
                    aria-label="Edit patient age"
                    className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Sex</span>
                  <select
                    value={editDraft.patientSex}
                    onChange={(event) => setEditDraft((current) => ({ ...current, patientSex: event.target.value as DraftState['patientSex'] }))}
                    aria-label="Edit patient sex"
                    className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                  >
                    <option value="">Select sex</option>
                    {PATIENT_SEX_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Difficulty</span>
                  <select
                    value={editDraft.difficulty}
                    onChange={(event) => setEditDraft((current) => ({ ...current, difficulty: event.target.value as ConsultantDeckingDifficulty }))}
                    aria-label="Edit difficulty"
                    className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {labelize(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Source</span>
                  <select
                    value={editDraft.patientSource}
                    onChange={(event) => setEditDraft((current) => ({ ...current, patientSource: event.target.value as ConsultantDeckingPatientSource }))}
                    aria-label="Edit patient source"
                    className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                  >
                    {PATIENT_SOURCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {labelize(option)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-400">Study schedule</span>
                <input
                  type="datetime-local"
                  value={editDraft.studyDate && editDraft.studyTime ? `${editDraft.studyDate}T${editDraft.studyTime}` : ''}
                  onClick={(e) => {
                    try {
                      if (typeof e.currentTarget.showPicker === 'function') {
                        e.currentTarget.showPicker();
                      }
                    } catch (err) {
                      // Ignore errors
                    }
                  }}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (!val) {
                      setEditDraft((current) => ({ ...current, studyDate: '', studyTime: '' }));
                      return;
                    }
                    const [datePart, timePart] = val.split('T');
                    setEditDraft((current) => ({ ...current, studyDate: datePart || '', studyTime: timePart || '' }));
                  }}
                  aria-label="Edit study schedule"
                  className="w-full cursor-pointer rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-clear-button]:hidden"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-400">Study description</span>
                <select
                  value={editDraft.studyDescription}
                  onChange={(event) => setEditDraft((current) => ({ ...current, studyDescription: event.target.value }))}
                  aria-label="Edit study description"
                  className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                >
                  <option value="">Select study description</option>
                  {STUDY_OPTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </optgroup>
              ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-400">Move to</span>
                <select
                  value={editColumnKey}
                  onChange={(event) => setEditColumnKey(event.target.value as ConsultantDeckingColumnKey)}
                  aria-label="Move to lane"
                  className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                >
                  <option value="inbox">Unassigned patients</option>
                  {DOCTOR_COLUMNS.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={handleDeleteEntry}
                  disabled={isSubmittingEdit}
                  className="rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition-colors hover:border-rose-300/40 hover:bg-rose-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="rounded-full border border-cyan-300/25 bg-cyan-500/12 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
};

export default ConsultantDeckingBoardScreen;
