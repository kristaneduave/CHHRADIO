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

const DOCTOR_COLUMNS: { key: ConsultantDeckingColumnKey; label: string; accent: string }[] = [
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
};

const DIFFICULTY_TONE: Record<ConsultantDeckingDifficulty, string> = {
  easy: 'border-emerald-300/45 bg-emerald-400/24 text-emerald-50',
  medium: 'border-amber-300/45 bg-amber-400/24 text-amber-50',
  hard: 'border-rose-300/45 bg-rose-400/26 text-rose-50',
};

const SOURCE_TONE: Record<ConsultantDeckingPatientSource, string> = {
  inpatient: 'border-slate-300/15 bg-slate-500/10 text-slate-100',
  er: 'border-cyan-300/25 bg-cyan-500/12 text-cyan-100',
  outpatient: 'border-fuchsia-300/20 bg-fuchsia-500/12 text-fuchsia-100',
};

const DIFFICULTY_ACCENT: Record<ConsultantDeckingDifficulty, string> = {
  easy: 'shadow-[0_0_0_1px_rgba(52,211,153,0.28),0_10px_24px_rgba(16,185,129,0.12)]',
  medium: 'shadow-[0_0_0_1px_rgba(252,211,77,0.28),0_10px_24px_rgba(245,158,11,0.12)]',
  hard: 'shadow-[0_0_0_1px_rgba(253,164,175,0.3),0_10px_24px_rgba(244,63,94,0.14)]',
};

const DIFFICULTY_LABEL: Record<ConsultantDeckingDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const SOURCE_LABEL: Record<ConsultantDeckingPatientSource, string> = {
  inpatient: 'Inpatient',
  er: 'ER',
  outpatient: 'OPD',
};

const SOURCE_SYMBOL: Record<ConsultantDeckingPatientSource, string> = {
  inpatient: 'I',
  er: 'ER',
  outpatient: 'O',
};

const labelize = (value: string) => {
  if (value === 'er') return 'ER';
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
      className={`group inline-flex w-full cursor-grab items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-left transition-all hover:border-white/18 hover:bg-white/[0.06] active:cursor-grabbing ${DIFFICULTY_TONE[entry.difficulty]} ${DIFFICULTY_ACCENT[entry.difficulty]} ${
        isDragging ? 'opacity-60' : ''
      }`}
      aria-label={`Edit ${entry.patientName}`}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{entry.patientName}</span>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_TONE[entry.patientSource]}`}>
        {SOURCE_SYMBOL[entry.patientSource]}
      </span>
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

  const groupedEntries = React.useMemo(() => {
    const grouped = new Map<ConsultantDeckingColumnKey, ConsultantDeckingEntry[]>();
    grouped.set('inbox', []);
    DOCTOR_COLUMNS.forEach((column) => grouped.set(column.key, []));
    entries.forEach((entry) => {
      const current = grouped.get(entry.columnKey) || [];
      current.push(entry);
      grouped.set(entry.columnKey, current);
    });
    grouped.forEach((columnEntries) => columnEntries.sort((left, right) => left.position - right.position));
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

    try {
      setIsSaving(true);
      await createConsultantDeckingEntry({
        patientName,
        difficulty: draft.difficulty,
        patientSource: draft.patientSource,
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

    try {
      setIsSubmittingEdit(true);
      await updateConsultantDeckingEntry(editingEntry.id, {
        patientName,
        difficulty: editDraft.difficulty,
        patientSource: editDraft.patientSource,
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

  return (
    <PageShell layoutMode="wide" contentClassName="space-y-6">
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
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">
            {entries.length} active
          </div>
        </div>

        <form className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_180px_180px_auto]" onSubmit={handleCreateEntry}>
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

          <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span className={`rounded-full border px-2.5 py-1 ${DIFFICULTY_TONE.easy}`}>{DIFFICULTY_LABEL.easy}</span>
            <span className={`rounded-full border px-2.5 py-1 ${DIFFICULTY_TONE.medium}`}>{DIFFICULTY_LABEL.medium}</span>
            <span className={`rounded-full border px-2.5 py-1 ${DIFFICULTY_TONE.hard}`}>{DIFFICULTY_LABEL.hard}</span>
            <span className={`rounded-full border px-2.5 py-1 ${SOURCE_TONE.inpatient}`}>{SOURCE_SYMBOL.inpatient} {SOURCE_LABEL.inpatient}</span>
            <span className={`rounded-full border px-2.5 py-1 ${SOURCE_TONE.er}`}>{SOURCE_SYMBOL.er} {SOURCE_LABEL.er}</span>
            <span className={`rounded-full border px-2.5 py-1 ${SOURCE_TONE.outpatient}`}>{SOURCE_SYMBOL.outpatient} {SOURCE_LABEL.outpatient}</span>
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
