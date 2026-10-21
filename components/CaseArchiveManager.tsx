import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  DRIVE_ARCHIVE_ENABLED,
  archiveCaseToDrive,
  archivePdfFileName,
  pickArchiveFolder,
  removeArchivedCaseImages,
  renderArchivePdf,
  saveArchivePdf,
} from '../services/caseArchiveService';
import { toastError, toastSuccess } from '../utils/toast';

interface CaseArchiveManagerProps {
  onClose: () => void;
}

interface Candidate {
  case_id: string;
  title: string | null;
  created_at: string | null;
  owner_name: string | null;
  image_count: number;
  bytes: number;
}

// saved: PDF is on this computer, images still in the app. done: images removed.
type RowStatus = { state: 'running' | 'saved' | 'done' | 'failed'; message: string };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Admin tool for freeing storage, largest cases first. Step 1 saves each case's PDF to a folder on
// this computer; the admin uploads that folder to the department Google Drive; step 2 removes the
// saved cases' images from the app. Runs in this tab because the PDFs are drawn here.
const CaseArchiveManager: React.FC<CaseArchiveManagerProps> = ({ onClose }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [pdfSizes, setPdfSizes] = useState<Record<string, number>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [uploadedUpTo, setUploadedUpTo] = useState('');
  const stopRequested = useRef(false);

  const loadCandidates = async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc('case_archive_candidates');
    if (error) {
      setLoadError(error.message);
    } else {
      setCandidates((data || []).map((row: any) => ({ ...row, bytes: Number(row.bytes) || 0 })));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadCandidates();
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isRunning]);

  // "Uploaded up to" includes the whole chosen day in local time.
  const cutoff = uploadedUpTo ? new Date(`${uploadedUpTo}T23:59:59.999`).getTime() : null;
  const visible = cutoff === null
    ? candidates
    : candidates.filter((row) => row.created_at && new Date(row.created_at).getTime() <= cutoff);
  const pending = visible.filter((row) => statuses[row.case_id]?.state !== 'done');
  const selectedRows = pending.filter((row) => selected.has(row.case_id));
  const selectedBytes = selectedRows.reduce((sum, row) => sum + row.bytes, 0);
  const totalBytes = pending.reduce((sum, row) => sum + row.bytes, 0);
  const savedRows = candidates.filter((row) => statuses[row.case_id]?.state === 'saved');
  const savedBytes = savedRows.reduce((sum, row) => sum + row.bytes, 0);

  const toggle = (caseId: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(caseId)) next.delete(caseId); else next.add(caseId);
    return next;
  });

  const setStatus = (caseId: string, status: RowStatus) => setStatuses((prev) => ({ ...prev, [caseId]: status }));

  const loadCase = async (caseId: string) => {
    const { data: caseRow, error } = await supabase.from('cases').select('*').eq('id', caseId).single();
    if (error || !caseRow) throw new Error(error?.message || 'Case not found.');
    const { data: profile } = await supabase.from('profiles').select('nickname, full_name').eq('id', caseRow.created_by).maybeSingle();
    return { caseRow, publisherName: profile?.nickname || profile?.full_name || 'Radiologist' };
  };

  // Runs one step for each row, in order, until done or stopped. Returns how many succeeded.
  const runEach = async (rows: Candidate[], step: (row: Candidate) => Promise<RowStatus>) => {
    stopRequested.current = false;
    setIsRunning(true);
    let succeeded = 0;
    for (const row of rows) {
      if (stopRequested.current) break;
      setStatus(row.case_id, { state: 'running', message: 'Starting' });
      try {
        setStatus(row.case_id, await step(row));
        succeeded += 1;
      } catch (error) {
        setStatus(row.case_id, { state: 'failed', message: errorMessage(error) });
      }
    }
    setIsRunning(false);
    setSelected(new Set());
    return succeeded;
  };

  const savePdfs = async () => {
    if (selectedRows.length === 0) return;
    let folder: Awaited<ReturnType<typeof pickArchiveFolder>> = null;
    try {
      folder = await pickArchiveFolder();
    } catch {
      return; // folder picker was cancelled
    }
    if (!folder && !window.confirm(
      `This browser can't save into a folder, so ${selectedRows.length} PDF(s) will download one by one. `
      + 'If the browser asks to allow multiple downloads, choose Allow.'
    )) return;

    const rows = selectedRows;
    const saved = await runEach(rows, async (row) => {
      setStatus(row.case_id, { state: 'running', message: 'Making PDF' });
      const { caseRow, publisherName } = await loadCase(row.case_id);
      const blob = await renderArchivePdf(caseRow, publisherName);
      const fileName = archivePdfFileName(caseRow);
      await saveArchivePdf(folder, fileName, blob);
      setPdfSizes((prev) => ({ ...prev, [row.case_id]: blob.size }));
      return { state: 'saved', message: `Saved as ${fileName} (${megabytes(blob.size)})` };
    });
    if (saved < rows.length) toastError(`Saved ${saved} of ${rows.length} PDF(s)`, 'Failed cases are marked in red. You can select them and try again.');
    else toastSuccess(`Saved ${saved} PDF(s)`, 'Upload them to the department Google Drive, then remove their images here.');
  };

  const removeSavedImages = async () => {
    if (savedRows.length === 0) return;
    const confirmed = window.confirm(
      `Have you uploaded the ${savedRows.length} saved PDF(s) to the department Google Drive and checked they open?\n\n`
      + `Their images (about ${megabytes(savedBytes)}) will be removed from the app. The case text stays. This cannot be undone.`
    );
    if (!confirmed) return;
    const rows = savedRows;
    const removed = await runEach(rows, async (row) => {
      setStatus(row.case_id, { state: 'running', message: 'Removing images' });
      const result = await removeArchivedCaseImages(row.case_id, pdfSizes[row.case_id]);
      return {
        state: 'done',
        message: result.removedImages < result.imagesToRemove ? 'Archived; some images left for the storage cleanup' : 'Archived; images removed',
      };
    });
    if (removed < rows.length) toastError(`Removed images for ${removed} of ${rows.length} case(s)`, 'Failed cases kept their images.');
    else toastSuccess(`Removed images for ${removed} case(s)`);
  };

  const archiveToDrive = async () => {
    if (selectedRows.length === 0) return;
    const confirmed = window.confirm(
      `Archive ${selectedRows.length} case(s) straight to the department Google Drive?\n\n`
      + `Each case's PDF is uploaded, then its images (about ${megabytes(selectedBytes)}) are removed from the app. `
      + 'This cannot be undone. Keep this tab open until it finishes.'
    );
    if (!confirmed) return;
    const rows = selectedRows;
    const archived = await runEach(rows, async (row) => {
      const { caseRow, publisherName } = await loadCase(row.case_id);
      const result = await archiveCaseToDrive(caseRow, publisherName, (stage, fraction) => {
        setStatus(row.case_id, {
          state: 'running',
          message: stage === 'preparing' ? 'Making PDF' : stage === 'uploading' ? `Uploading ${Math.round((fraction || 0) * 100)}%` : 'Removing images',
        });
      });
      return {
        state: 'done',
        message: result.removedImages < result.imagesToRemove ? 'Archived; some images left for the storage cleanup' : 'Archived to Drive',
      };
    });
    if (archived < rows.length) toastError(`Archived ${archived} of ${rows.length} case(s)`, 'Failed cases kept their images. You can retry them.');
    else toastSuccess(`Archived ${archived} case(s) to Google Drive`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={isRunning ? undefined : onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-[720px] flex-col rounded-[24px] border border-white/10 bg-[#102033] shadow-[0_24px_70px_rgba(0,0,0,0.42)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Admin</p>
            <h3 className="mt-1 text-lg font-black text-white">Archive cases to Google Drive</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              1. Save the PDFs to a folder. 2. Upload that folder to the department Google Drive. 3. Remove their images here.
              {!isLoading && !loadError && ` ${pending.length} case(s) still hold ${megabytes(totalBytes)} of images.`}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <span className="material-icons text-lg">close</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-5 py-2.5 text-[12px] text-slate-300">
          <label htmlFor="archive-uploaded-up-to" className="font-bold">Uploaded up to</label>
          <input
            id="archive-uploaded-up-to"
            type="date"
            value={uploadedUpTo}
            disabled={isRunning}
            onChange={(event) => setUploadedUpTo(event.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[12px] text-white [color-scheme:dark] disabled:opacity-50"
          />
          {uploadedUpTo ? (
            <button type="button" disabled={isRunning} onClick={() => setUploadedUpTo('')} className="font-bold text-slate-400 hover:text-white disabled:opacity-40">
              Show all dates
            </button>
          ) : (
            <span className="text-slate-500">All dates</span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-slate-400">Loading cases...</p>
          ) : loadError ? (
            <p className="py-8 text-center text-xs text-rose-300">Could not load cases: {loadError}</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              {candidates.length === 0 ? 'No cases have images left to archive.' : 'No cases with images were uploaded by that date.'}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {visible.map((row) => {
                const status = statuses[row.case_id];
                const isDone = status?.state === 'done';
                return (
                  <li key={row.case_id} className="flex items-center gap-3 px-2 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-cyan-400"
                      checked={selected.has(row.case_id) && !isDone}
                      disabled={isRunning || isDone}
                      onChange={() => toggle(row.case_id)}
                      aria-label={`Select ${row.title || 'case'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-slate-100">{row.title || 'Untitled case'}</p>
                      <p className="truncate text-[11px] text-slate-400">
                        {[row.owner_name, row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '', `${row.image_count} image(s)`].filter(Boolean).join(' · ')}
                      </p>
                      {status && (
                        <p className={`truncate text-[11px] font-bold ${
                          status.state === 'failed' ? 'text-rose-300' : status.state === 'done' ? 'text-emerald-300' : status.state === 'saved' ? 'text-amber-200' : 'text-cyan-300'
                        }`}>
                          {status.message}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[12px] font-bold tabular-nums text-slate-300">{megabytes(row.bytes)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {savedRows.length > 0 && !isRunning && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-300/20 bg-amber-300/[0.06] px-5 py-3">
            <p className="text-[12px] leading-relaxed text-amber-100">
              {savedRows.length} PDF(s) saved. Upload them to the department Google Drive, check they open, then remove their images.
            </p>
            <button
              type="button"
              onClick={removeSavedImages}
              className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2.5 text-[12px] font-black text-amber-100 hover:bg-amber-300/20"
            >
              Remove images of {savedRows.length} saved case(s)
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-5 py-3">
          <button
            type="button"
            disabled={isRunning || pending.length === 0}
            onClick={() => setSelected(selectedRows.length === pending.length ? new Set() : new Set(pending.map((row) => row.case_id)))}
            className="text-[12px] font-bold text-slate-300 hover:text-white disabled:opacity-40"
          >
            {selectedRows.length === pending.length && pending.length > 0 ? 'Clear selection' : 'Select all'}
          </button>
          {isRunning ? (
            <button
              type="button"
              onClick={() => { stopRequested.current = true; }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold text-slate-200 hover:bg-white/10"
            >
              Stop after this case
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {DRIVE_ARCHIVE_ENABLED && (
                <button
                  type="button"
                  disabled={selectedRows.length === 0}
                  onClick={archiveToDrive}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold text-slate-200 hover:bg-white/10 disabled:opacity-40"
                >
                  Archive straight to Drive
                </button>
              )}
              <button
                type="button"
                disabled={selectedRows.length === 0}
                onClick={savePdfs}
                className="rounded-xl bg-cyan-500/90 px-4 py-2.5 text-[12px] font-black text-[#04121c] transition-colors hover:bg-cyan-400 disabled:opacity-40"
              >
                Save {selectedRows.length || ''} PDF(s) to a folder{selectedRows.length ? ` (${megabytes(selectedBytes)})` : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseArchiveManager;
