import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { archiveCaseToDrive } from '../services/caseArchiveService';
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

type RowStatus = { state: 'running' | 'done' | 'failed'; message: string };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Admin tool: archives many cases to the department Google Drive in one go, largest first. Runs in
// this browser tab because the PDFs are drawn here, one case at a time.
const CaseArchiveManager: React.FC<CaseArchiveManagerProps> = ({ onClose }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
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

  const toggle = (caseId: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(caseId)) next.delete(caseId); else next.add(caseId);
    return next;
  });

  const setStatus = (caseId: string, status: RowStatus) => setStatuses((prev) => ({ ...prev, [caseId]: status }));

  const archiveOne = async (caseId: string) => {
    const { data: caseRow, error } = await supabase.from('cases').select('*').eq('id', caseId).single();
    if (error || !caseRow) throw new Error(error?.message || 'Case not found.');
    const { data: profile } = await supabase.from('profiles').select('nickname, full_name').eq('id', caseRow.created_by).maybeSingle();
    return archiveCaseToDrive(caseRow, profile?.nickname || profile?.full_name || 'Radiologist', (stage, fraction) => {
      setStatus(caseId, {
        state: 'running',
        message: stage === 'preparing' ? 'Preparing PDF' : stage === 'uploading' ? `Uploading ${Math.round((fraction || 0) * 100)}%` : 'Removing images',
      });
    });
  };

  const runArchive = async () => {
    if (selectedRows.length === 0) return;
    const confirmed = window.confirm(
      `Archive ${selectedRows.length} case(s) to the department Google Drive?\n\n`
      + `Each case's PDF is saved to Drive, then its images (about ${megabytes(selectedBytes)}) are removed from the app. `
      + 'This cannot be undone. Keep this tab open until it finishes.'
    );
    if (!confirmed) return;

    stopRequested.current = false;
    setIsRunning(true);
    let archived = 0;
    let failed = 0;
    for (const row of selectedRows) {
      if (stopRequested.current) break;
      setStatus(row.case_id, { state: 'running', message: 'Starting' });
      try {
        const result = await archiveOne(row.case_id);
        archived += 1;
        setStatus(row.case_id, {
          state: 'done',
          message: result.removedImages < result.imagesToRemove ? 'Archived; some images left for cleanup' : 'Archived',
        });
      } catch (error) {
        failed += 1;
        setStatus(row.case_id, { state: 'failed', message: error instanceof Error ? error.message : String(error) });
      }
    }
    setIsRunning(false);
    setSelected(new Set());
    if (failed > 0) toastError(`Archived ${archived} case(s); ${failed} failed`, 'Failed cases kept their images. You can retry them.');
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
              Saves each case's PDF to the department Drive, then removes its images from the app.
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
                        <p className={`truncate text-[11px] font-bold ${status.state === 'failed' ? 'text-rose-300' : status.state === 'done' ? 'text-emerald-300' : 'text-cyan-300'}`}>
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
            <button
              type="button"
              disabled={selectedRows.length === 0}
              onClick={runArchive}
              className="rounded-xl bg-cyan-500/90 px-4 py-2.5 text-[12px] font-black text-[#04121c] transition-colors hover:bg-cyan-400 disabled:opacity-40"
            >
              Archive {selectedRows.length || ''} selected{selectedRows.length ? ` (${megabytes(selectedBytes)})` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseArchiveManager;
