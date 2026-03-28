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

const DOCTOR_COLUMNS: Array<ConsultantDeckingColumnMeta & { accent: string }> = [
  { key: 'reynes', label: 'Dr. Reynes', accent: 'border-violet-300/25 bg-violet-500/[0.08] text-violet-100' },
  { key: 'alvarez', label: 'Dr. Alvarez', accent: 'border-amber-300/25 bg-amber-500/[0.08] text-amber-100' },
  { key: 'co-ng', label: 'Dr. Co-Ng', accent: 'border-emerald-300/25 bg-emerald-500/[0.08] text-emerald-100' },
  { key: 'vano-yu', label: 'Dr. Vaño-Yu', accent: 'border-rose-300/25 bg-rose-500/[0.08] text-rose-100' },
];

const DIFFICULTY_OPTIONS: ConsultantDeckingDifficulty[] = ['easy', 'medium', 'hard'];
const PATIENT_SOURCE_OPTIONS: ConsultantDeckingPatientSource[] = ['inpatient', 'er', 'outpatient'];

const EMPTY_DRAFT: DraftState = {
  patientName: '',
  difficulty: 'medium',
  patientSource: 'er',
  studyDate: '',
  studyTime: '',
  studyDescription: '',
};

const DIFFICULTY_TONE: Record<ConsultantDeckingDifficulty, string> = {
  easy: 'border-emerald-300/45 bg-emerald-400/24 text-emerald-50',
  medium: 'border-amber-300/45 bg-amber-400/24 text-amber-50',
  hard: 'border-rose-300/45 bg-rose-400/26 text-rose-50',
};

const SOURCE_TONE: Record<ConsultantDeckingPatientSource, string> = {
  inpatient: 'border-slate-200/20 bg-slate-400/15 text-slate-50',
  er: 'border-cyan-300/30 bg-cyan-400/16 text-cyan-50',
  outpatient: 'border-fuchsia-300/25 bg-fuchsia-400/16 text-fuchsia-50',
};

const DIFFICULTY_ACCENT: Record<ConsultantDeckingDifficulty, string> = {
  easy: 'shadow-[0_0_0_1px_rgba(52,211,153,0.28),0_10px_24px_rgba(16,185,129,0.12)]',
  medium: 'shadow-[0_0_0_1px_rgba(252,211,77,0.28),0_10px_24px_rgba(245,158,11,0.12)]',
  hard: 'shadow-[0_0_0_1px_rgba(253,164,175,0.3),0_10px_24px_rgba(244,63,94,0.14)]',
};

const SOURCE_LABEL: Record<ConsultantDeckingPatientSource, string> = {
  inpatient: 'INPATIENT',
  er: 'ER',
  outpatient: 'OPD',
};

const STUDY_KIND_TONE = {
  ready: 'border-white/10 bg-white/[0.06] text-white',
  pending: 'border-amber-300/25 bg-amber-400/10 text-amber-50',
} as const;

const getStudyKindLabel = (studyDescription?: string | null) => {
  const normalized = (studyDescription || '').trim();
  if (!normalized) return 'Study pending';

  const upper = normalized.toUpperCase();
  if (upper.startsWith('CT ANGIOGRAPHY') || upper.startsWith('CTA')) return 'CTA';
  if (upper.startsWith('MRA')) return 'MRA';
  if (upper.startsWith('MR')) return 'MRI';
  if (upper.startsWith('CT')) return 'CT';
  if (upper.startsWith('US')) return 'UTZ';
  if (upper.startsWith('XR') || upper.startsWith('X-RAY')) return 'XR';
  return normalized.split(/[\s-]+/)[0]?.slice(0, 12).toUpperCase() || 'STUDY';
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

const STUDY_DESCRIPTION_OPTIONS = [
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
  'CT angiography-PE',
  'CT neck plain',
  'CT neck with contrast',
  'Calcium score',
  'CT angiography - Extremities',
  'CT angiography - Coronary',
  'CT hip plain',
  'CT pelvis plain',
  'CT lower abdomen plain',
  'CT lower abdomen with contrast',
  'CT spine - Lumbar',
  'CT extremities - Leg',
  'CT paranasal sinuses plain',
  'CT paranasal sinuses with contrast',
  'CT angiography - Chest',
  'CT angiography - Brain',
  'CT temporal fossa plain',
  'CT angiography - Lower extremities',
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
  'MRA brain plain',
  'MRA brain with contrast',
  'MRA brain plain with spine screening',
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
] as const;

const EXPORT_COLUMNS: ConsultantDeckingColumnMeta[] = [
  { key: 'inbox', label: 'Unassigned patients' },
  ...DOCTOR_COLUMNS.map(({ key, label }) => ({ key, label })),
];

const labelize = (value: string) => {
  if (value === 'er') return 'ER';
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatExportDateTime = (value: Date) =>
  value.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const formatStudyDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
  [formatStudyDate(entry.studyDate), formatStudyTime(entry.studyTime)].filter(Boolean).join(' �?') || 'Study date/time pending';

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
  exportedAt: Date,
) => {
  const sections = EXPORT_COLUMNS.map((column) => {
    const columnEntries = groupedEntries.get(column.key) || [];
    const items = columnEntries.length
      ? `<ol>${columnEntries
          .map((entry) =>
            `<li><strong>${escapeHtml(entry.patientName)}</strong> <span>(${escapeHtml(labelize(entry.difficulty))}, ${escapeHtml(labelize(entry.patientSource))})</span><br /><span>${escapeHtml(entry.studyDescription || 'Study pending')}</span><br /><span>${escapeHtml([formatStudyDate(entry.studyDate), formatStudyTime(entry.studyTime)].filter(Boolean).join(' �?') || 'Study date/time pending')}</span></li>`)
          .join('')}</ol>`
      : '<p>No patients assigned.</p>';

    return `<section><h2>${escapeHtml(column.label)}</h2>${items}</section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Consultant Decking Export</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; color: #111827; line-height: 1.5; }
      h1 { margin-bottom: 4px; }
      h2 { margin-top: 28px; margin-bottom: 8px; font-size: 20px; }
      p { margin: 0 0 12px; }
      ol { margin: 0; padding-left: 24px; }
      li + li { margin-top: 6px; }
      span { color: #4b5563; }
    </style>
  </head>
  <body>
    <h1>Consultant Decking</h1>
    <p>Exported ${escapeHtml(formatExportDateTime(exportedAt))}</p>
    ${sections}
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
}) => (
  <div className="space-y-2">
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
      className={`group flex w-full cursor-grab items-start gap-3 rounded-[1.75rem] border border-white/10 px-3.5 py-3 text-left transition-all hover:border-white/18 hover:bg-white/[0.06] active:cursor-grabbing ${DIFFICULTY_TONE[entry.difficulty]} ${DIFFICULTY_ACCENT[entry.difficulty]} ${
        isDragging ? 'opacity-60' : ''
      }`}
      aria-label={`Edit ${entry.patientName}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-white">{entry.patientName}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] ${SOURCE_TONE[entry.patientSource]}`}>
              {SOURCE_LABEL[entry.patientSource]}
            </span>
            <span className="rounded-full border border-black/10 bg-black/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-white/90">
              {labelize(entry.difficulty).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] ${entry.studyDescription ? STUDY_KIND_TONE.ready : STUDY_KIND_TONE.pending}`}>
            {getStudyKindLabel(entry.studyDescription)}
          </span>
          <span className="min-w-0 truncate text-[12px] font-medium text-white/90">
            {entry.studyDescription || 'Study pending'}
          </span>
        </div>
        <span className="mt-2 block truncate text-[11px] text-white/70">
          {formatStudyDateTimeLabel(entry)}
        </span>
      </div>
    </div>
  </div>
);

const ConsultantDeckingBoardScreen: React.FC<ConsultantDeckingBoardScreenProps> = ({
  currentUserId,
  onBack,
}) => {
  const [entries, setEntries] = React.useState<ConsultantDeckingEntry[]>([]);
  const [loading, setLoading] = React.useState(Boolean(currentUserId));
  const [isSaving, setIsSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftState>(EMPTY_DRAFT);
  const [activeDrag, setActiveDrag] = React.useState<ActiveDragState>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget>(null);
  const [editingEntry, setEditingEntry] = React.useState<ConsultantDeckingEntry | null>(null);
  const [editDraft, setEditDraft] = React.useState<DraftState>(EMPTY_DRAFT);
  const [editColumnKey, setEditColumnKey] = React.useState<ConsultantDeckingColumnKey>('inbox');
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

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

  const loadEntries = React.useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
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
      toastError('Unable to load consultant decking board', error?.message || 'Please refresh and try again.');
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
      loadEntries({ silent: true, force: true }).catch(() => undefined);
    });
  }, [currentUserId, loadEntries]);

  const resetDraft = () => setDraft(EMPTY_DRAFT);

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
    setEditDraft(EMPTY_DRAFT);
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
      const exportedAt = new Date();
      const html = buildDeckingExportHtml(groupedEntries, exportedAt);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStamp = exportedAt.toISOString().slice(0, 10);
      link.href = url;
      link.download = `consultant-decking-${dateStamp}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toastSuccess('Summary exported');
    } catch (error: any) {
      toastError('Unable to export summary', error?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageShell layoutMode="wide" contentClassName="space-y-6 pb-28 xl:pb-32">
      <PageHeader
        title="Consultant Decking"
        description="Create patients below, then drag each pill to the assigned consultant."
        action={(
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:text-white"
          >
            Back
          </button>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Create patient</p>
            <p className="mt-1 text-sm text-slate-400">Add a patient, then drag the pill to the right consultant.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">
              {entries.length} active
            </div>
          </div>
        </div>

        <form className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_180px_180px_170px_160px_minmax(0,1fr)_auto]" onSubmit={handleCreateEntry}>
          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-400">Patient name</span>
            <input
              type="text"
              value={draft.patientName}
              onChange={(event) => setDraft((current) => ({ ...current, patientName: event.target.value }))}
              placeholder="Enter patient name"
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/40"
              aria-label="Patient name"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-400">Difficulty</span>
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

          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-400">Source</span>
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

          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-400">Study date</span>
            <input
              type="date"
              value={draft.studyDate}
              onChange={(event) => setDraft((current) => ({ ...current, studyDate: event.target.value }))}
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
              aria-label="Study date"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-400">Study time</span>
            <input
              type="time"
              value={draft.studyTime}
              onChange={(event) => setDraft((current) => ({ ...current, studyTime: event.target.value }))}
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
              aria-label="Study time"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-400">Study description</span>
            <select
              value={draft.studyDescription}
              onChange={(event) => setDraft((current) => ({ ...current, studyDescription: event.target.value }))}
              className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
              aria-label="Study description"
            >
              <option value="">Select study description</option>
              {STUDY_DESCRIPTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={!currentUserId || isSaving}
            className="mt-auto rounded-full border border-cyan-300/25 bg-cyan-500/12 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-500/16 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-white">{column.label}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${column.accent}`}>
                      {columnEntries.length}
                    </span>
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
                </div>
              </PageSection>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-40">
        <div className="rounded-[1.5rem] border border-cyan-300/20 bg-[#09111d]/88 p-3 shadow-[0_20px_60px_rgba(2,8,18,0.5)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Export consultant decking summary</p>
              <p className="mt-1 text-xs text-slate-400">Generate a clean snapshot of all assigned and unassigned studies.</p>
            </div>
            <button
              type="button"
              onClick={handleExportSummary}
              disabled={!currentUserId || loading || isExporting}
              className="w-full rounded-full border border-cyan-200/30 bg-cyan-400/20 px-5 py-3 text-sm font-semibold text-cyan-50 transition-colors hover:border-cyan-200/45 hover:bg-cyan-400/28 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
            >
              {isExporting ? 'Exporting...' : 'Export Summary'}
            </button>
          </div>
        </div>
      </div>
      {editingEntry ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/72 px-4 pb-4 pt-10 sm:items-center" role="dialog" aria-modal="true" aria-label="Edit consultant decking patient">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Study date</span>
                  <input
                    type="date"
                    value={editDraft.studyDate}
                    onChange={(event) => setEditDraft((current) => ({ ...current, studyDate: event.target.value }))}
                    aria-label="Edit study date"
                    className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Study time</span>
                  <input
                    type="time"
                    value={editDraft.studyTime}
                    onChange={(event) => setEditDraft((current) => ({ ...current, studyTime: event.target.value }))}
                    aria-label="Edit study time"
                    className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-400">Study description</span>
                <select
                  value={editDraft.studyDescription}
                  onChange={(event) => setEditDraft((current) => ({ ...current, studyDescription: event.target.value }))}
                  aria-label="Edit study description"
                  className="w-full rounded-full border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                >
                  <option value="">Select study description</option>
                  {STUDY_DESCRIPTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
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


