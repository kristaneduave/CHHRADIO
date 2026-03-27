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

const CONSULTANT_COLUMNS: { key: ConsultantDeckingColumnKey; label: string; accent: string }[] = [
  { key: 'inbox', label: 'Inbox', accent: 'border-cyan-400/30 bg-cyan-500/8 text-cyan-100' },
  { key: 'reynes', label: 'Dr. Reynes', accent: 'border-violet-400/30 bg-violet-500/8 text-violet-100' },
  { key: 'alvarez', label: 'Dr. Alvarez', accent: 'border-amber-400/30 bg-amber-500/8 text-amber-100' },
  { key: 'co-ng', label: 'Dr. Co-Ng', accent: 'border-emerald-400/30 bg-emerald-500/8 text-emerald-100' },
  { key: 'vano-yu', label: 'Dr. Vaño-Yu', accent: 'border-rose-400/30 bg-rose-500/8 text-rose-100' },
];

const DIFFICULTY_OPTIONS: ConsultantDeckingDifficulty[] = ['easy', 'medium', 'hard'];
const PATIENT_SOURCE_OPTIONS: ConsultantDeckingPatientSource[] = ['inpatient', 'er', 'outpatient'];

const EMPTY_DRAFT: DraftState = {
  patientName: '',
  difficulty: 'medium',
  patientSource: 'er',
};

const difficultyBadgeClass: Record<ConsultantDeckingDifficulty, string> = {
  easy: 'border-emerald-400/30 bg-emerald-500/12 text-emerald-100',
  medium: 'border-amber-400/30 bg-amber-500/12 text-amber-100',
  hard: 'border-rose-400/30 bg-rose-500/12 text-rose-100',
};

const patientSourceBadgeClass: Record<ConsultantDeckingPatientSource, string> = {
  inpatient: 'border-slate-400/20 bg-slate-500/10 text-slate-100',
  er: 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100',
  outpatient: 'border-fuchsia-400/30 bg-fuchsia-500/12 text-fuchsia-100',
};

const labelize = (value: string) => {
  if (value === 'er') return 'ER';
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const ConsultantDeckingBoardScreen: React.FC<ConsultantDeckingBoardScreenProps> = ({
  currentUserId,
  onBack,
}) => {
  const [entries, setEntries] = React.useState<ConsultantDeckingEntry[]>([]);
  const [loading, setLoading] = React.useState(Boolean(currentUserId));
  const [isSaving, setIsSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftState>(EMPTY_DRAFT);
  const [activeDrag, setActiveDrag] = React.useState<ActiveDragState>(null);
  const [dropTarget, setDropTarget] = React.useState<{ columnKey: ConsultantDeckingColumnKey; index: number } | null>(null);
  const [editingEntry, setEditingEntry] = React.useState<ConsultantDeckingEntry | null>(null);
  const [editDraft, setEditDraft] = React.useState<DraftState>(EMPTY_DRAFT);
  const [editColumnKey, setEditColumnKey] = React.useState<ConsultantDeckingColumnKey>('inbox');
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);

  const groupedEntries = React.useMemo(() => {
    const grouped = new Map<ConsultantDeckingColumnKey, ConsultantDeckingEntry[]>();
    for (const column of CONSULTANT_COLUMNS) {
      grouped.set(column.key, []);
    }
    entries.forEach((entry) => {
      const current = grouped.get(entry.columnKey) || [];
      current.push(entry);
      grouped.set(entry.columnKey, current);
    });
    grouped.forEach((columnEntries) => columnEntries.sort((left, right) => left.position - right.position));
    return grouped;
  }, [entries]);

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
      toastError('Sign in required', 'Please sign in to add consultant decking cards.');
      return;
    }

    const patientName = draft.patientName.trim();
    if (!patientName) {
      toastError('Patient name required', 'Please enter the patient name before adding a card.');
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
      toastSuccess('Patient added to inbox');
    } catch (error: any) {
      toastError('Unable to add patient', error?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDropMove = async (columnKey: ConsultantDeckingColumnKey, index: number) => {
    if (!activeDrag) return;
    setDropTarget(null);
    setActiveDrag(null);

    try {
      await moveConsultantDeckingEntry(activeDrag.entryId, columnKey, index);
      await loadEntries({ silent: true, force: true });
    } catch (error: any) {
      toastError('Unable to move patient card', error?.message || 'Please try again.');
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
        const destinationCount = groupedEntries.get(editColumnKey)?.length || 0;
        await moveConsultantDeckingEntry(editingEntry.id, editColumnKey, destinationCount);
      }

      await loadEntries({ force: true });
      closeEditor();
      toastSuccess('Patient card updated');
    } catch (error: any) {
      toastError('Unable to update patient card', error?.message || 'Please try again.');
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
      toastSuccess('Patient card removed');
    } catch (error: any) {
      toastError('Unable to delete patient card', error?.message || 'Please try again.');
      setIsSubmittingEdit(false);
    }
  };

  return (
    <PageShell layoutMode="wide" contentClassName="space-y-6">
      <PageHeader
        title="Consultant Decking Board"
        description="Create patient cards in the inbox, then drag them to the consultant handling the deck. Use the card editor as a reliable mobile fallback for reassignments."
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Create patient card</p>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              New cards start in the inbox. Add the patient, mark difficulty, and identify whether the case is inpatient, ER, or outpatient.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            {entries.length} active cards
          </div>
        </div>

        <form className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_auto_auto_auto]" onSubmit={handleCreateEntry}>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Patient name</span>
            <input
              type="text"
              value={draft.patientName}
              onChange={(event) => setDraft((current) => ({ ...current, patientName: event.target.value }))}
              placeholder="Enter patient name"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/40"
              aria-label="Patient name"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Difficulty</span>
            <select
              value={draft.difficulty}
              onChange={(event) => setDraft((current) => ({ ...current, difficulty: event.target.value as ConsultantDeckingDifficulty }))}
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
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
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Source</span>
            <select
              value={draft.patientSource}
              onChange={(event) => setDraft((current) => ({ ...current, patientSource: event.target.value as ConsultantDeckingPatientSource }))}
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
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
            className="mt-auto rounded-2xl border border-cyan-400/25 bg-cyan-500/12 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-500/16 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Adding...' : 'Add to inbox'}
          </button>
        </form>
      </PageSection>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1220px] gap-4 xl:min-w-0 xl:grid-cols-5">
          {CONSULTANT_COLUMNS.map((column) => {
            const columnEntries = groupedEntries.get(column.key) || [];
            const isDropColumn = dropTarget?.columnKey === column.key;

            return (
              <PageSection
                key={column.key}
                className={`flex min-h-[26rem] flex-col gap-4 ${isDropColumn ? 'border-cyan-300/30 bg-cyan-500/[0.05]' : ''}`}
                onDragOver={(event) => {
                  if (!currentUserId) return;
                  event.preventDefault();
                  setDropTarget({ columnKey: column.key, index: columnEntries.length });
                }}
                onDragLeave={() => {
                  setDropTarget((current) => (current?.columnKey === column.key ? null : current));
                }}
                onDrop={(event) => {
                  if (!currentUserId) return;
                  event.preventDefault();
                  handleDropMove(column.key, columnEntries.length).catch(() => undefined);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{column.label}</h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                      {column.key === 'inbox' ? 'Unassigned queue' : 'Consultant column'}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${column.accent}`}>
                    {columnEntries.length}
                  </span>
                </div>

                {loading ? (
                  <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-slate-950/30 text-sm text-slate-400">
                    Loading board...
                  </div>
                ) : columnEntries.length ? (
                  <div className="space-y-3">
                    {columnEntries.map((entry, index) => {
                      const isDropMarker = dropTarget?.columnKey === column.key && dropTarget.index === index;
                      return (
                        <div key={entry.id} className="space-y-3">
                          {isDropMarker ? <div className="h-2 rounded-full bg-cyan-300/60" /> : null}
                          <button
                            type="button"
                            draggable={Boolean(currentUserId)}
                            onDragStart={() => {
                              setActiveDrag({
                                entryId: entry.id,
                                sourceColumnKey: entry.columnKey,
                                sourceIndex: index,
                              });
                            }}
                            onDragEnd={() => {
                              setActiveDrag(null);
                              setDropTarget(null);
                            }}
                            onDragOver={(event) => {
                              if (!currentUserId) return;
                              event.preventDefault();
                              setDropTarget({ columnKey: column.key, index });
                            }}
                            onDrop={(event) => {
                              if (!currentUserId) return;
                              event.preventDefault();
                              handleDropMove(column.key, index).catch(() => undefined);
                            }}
                            onClick={() => openEditor(entry)}
                            className="group w-full rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-4 text-left transition-colors hover:border-white/20 hover:bg-slate-950/75"
                            aria-label={`Edit ${entry.patientName}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-white">{entry.patientName}</p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                                  Drag to reassign or tap to edit
                                </p>
                              </div>
                              <span className="material-icons text-[18px] text-slate-500 transition-colors group-hover:text-cyan-200">
                                drag_indicator
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${difficultyBadgeClass[entry.difficulty]}`}>
                                {labelize(entry.difficulty)}
                              </span>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${patientSourceBadgeClass[entry.patientSource]}`}>
                                {labelize(entry.patientSource)}
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                    {dropTarget?.columnKey === column.key && dropTarget.index === columnEntries.length ? (
                      <div className="h-2 rounded-full bg-cyan-300/60" />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-slate-950/30 px-4 text-center text-sm text-slate-500">
                    {column.key === 'inbox'
                      ? 'No patients waiting. Add a card above to start the deck.'
                      : 'No patients assigned yet. Drop a card here or move one from the editor.'}
                  </div>
                )}
              </PageSection>
            );
          })}
        </div>
      </div>

      {editingEntry ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 px-4" role="dialog" aria-modal="true" aria-label="Edit consultant decking card">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0b1220] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Edit patient card</h2>
                <p className="mt-1 text-sm text-slate-400">Update details, reassign the card, or remove it from the board.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:text-white"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSaveEdit}>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Patient name</span>
                <input
                  type="text"
                  value={editDraft.patientName}
                  onChange={(event) => setEditDraft((current) => ({ ...current, patientName: event.target.value }))}
                  aria-label="Edit patient name"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Difficulty</span>
                  <select
                    value={editDraft.difficulty}
                    onChange={(event) => setEditDraft((current) => ({ ...current, difficulty: event.target.value as ConsultantDeckingDifficulty }))}
                    aria-label="Edit difficulty"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {labelize(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Source</span>
                  <select
                    value={editDraft.patientSource}
                    onChange={(event) => setEditDraft((current) => ({ ...current, patientSource: event.target.value as ConsultantDeckingPatientSource }))}
                    aria-label="Edit patient source"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
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
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Move to column</span>
                <select
                  value={editColumnKey}
                  onChange={(event) => setEditColumnKey(event.target.value as ConsultantDeckingColumnKey)}
                  aria-label="Move to column"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/40"
                >
                  {CONSULTANT_COLUMNS.map((column) => (
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
                  className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition-colors hover:border-rose-300/40 hover:bg-rose-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete card
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="rounded-2xl border border-cyan-400/25 bg-cyan-500/12 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save changes'}
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
