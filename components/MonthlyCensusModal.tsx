import React, { useEffect, useMemo, useState } from 'react';
import { getMonthlyCensusByMonth, upsertMonthlyCensus } from '../services/monthlyCensusService';
import { toastError, toastSuccess } from '../utils/toast';

interface MonthlyCensusModalProps {
  isOpen: boolean;
  onClose: () => void;
  residentId: string | null;
}

interface MonthlyCensusFormState {
  month: string;
  interestingCasesSubmitted: string;
  notesCount: string;
  fuenteCtCensus: string;
  fuenteMriCensus: string;
  fuenteXrayCensus: string;
  platesCount: string;
  hasAbsence: boolean;
  absenceDays: string;
}

const getCurrentMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getDefaultFormState = (): MonthlyCensusFormState => ({
  month: getCurrentMonthValue(),
  interestingCasesSubmitted: '0',
  notesCount: '0',
  fuenteCtCensus: '0',
  fuenteMriCensus: '0',
  fuenteXrayCensus: '0',
  platesCount: '0',
  hasAbsence: false,
  absenceDays: '0',
});

const parseNonNegativeInt = (value: string) => {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

const MonthlyCensusModal: React.FC<MonthlyCensusModalProps> = ({ isOpen, onClose, residentId }) => {
  const [form, setForm] = useState<MonthlyCensusFormState>(getDefaultFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const reportMonth = useMemo(() => `${form.month}-01`, [form.month]);

  const loadExisting = async (month: string) => {
    if (!residentId) return;

    setIsLoading(true);
    try {
      const existing = await getMonthlyCensusByMonth(residentId, `${month}-01`);
      if (!existing) {
        setForm((prev) => ({
          ...prev,
          month,
          interestingCasesSubmitted: '0',
          notesCount: '0',
          fuenteCtCensus: '0',
          fuenteMriCensus: '0',
          fuenteXrayCensus: '0',
          platesCount: '0',
          hasAbsence: false,
          absenceDays: '0',
        }));
        return;
      }

      const monthValue = existing.report_month.slice(0, 7);
      setForm({
        month: monthValue,
        interestingCasesSubmitted: String(existing.interesting_cases_submitted),
        notesCount: String(existing.notes_count),
        fuenteCtCensus: String(existing.fuente_ct_census),
        fuenteMriCensus: String(existing.fuente_mri_census),
        fuenteXrayCensus: String(existing.fuente_xray_census),
        platesCount: String(existing.plates_count),
        hasAbsence: existing.has_absence,
        absenceDays: String(existing.absence_days),
      });
    } catch (error: any) {
      console.error('Failed to load monthly census:', error);
      toastError('Unable to load census data', error?.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const initialState = getDefaultFormState();
    setForm(initialState);
    loadExisting(initialState.month).catch((error) => console.error(error));
  }, [isOpen, residentId]);

  if (!isOpen) return null;

  const validateAndBuildPayload = () => {
    const interestingCasesSubmitted = parseNonNegativeInt(form.interestingCasesSubmitted);
    const notesCount = parseNonNegativeInt(form.notesCount);
    const fuenteCtCensus = parseNonNegativeInt(form.fuenteCtCensus);
    const fuenteMriCensus = parseNonNegativeInt(form.fuenteMriCensus);
    const fuenteXrayCensus = parseNonNegativeInt(form.fuenteXrayCensus);
    const platesCount = parseNonNegativeInt(form.platesCount);
    const absenceDays = form.hasAbsence ? parseNonNegativeInt(form.absenceDays) : 0;

    if (!residentId) {
      toastError('Missing user', 'Please sign in again.');
      return null;
    }

    if (!form.month || !/^\d{4}-\d{2}$/.test(form.month)) {
      toastError('Invalid month', 'Please select a valid month.');
      return null;
    }

    if (
      interestingCasesSubmitted === null ||
      notesCount === null ||
      fuenteCtCensus === null ||
      fuenteMriCensus === null ||
      fuenteXrayCensus === null ||
      platesCount === null ||
      absenceDays === null
    ) {
      toastError('Invalid values', 'All counts must be whole numbers >= 0.');
      return null;
    }

    return {
      resident_id: residentId,
      report_month: reportMonth,
      interesting_cases_submitted: interestingCasesSubmitted,
      notes_count: notesCount,
      fuente_ct_census: fuenteCtCensus,
      fuente_mri_census: fuenteMriCensus,
      fuente_xray_census: fuenteXrayCensus,
      plates_count: platesCount,
      has_absence: form.hasAbsence,
      absence_days: absenceDays,
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = validateAndBuildPayload();
    if (!payload) return;

    setIsSaving(true);
    try {
      await upsertMonthlyCensus(payload);
      toastSuccess('Monthly census submitted');
      onClose();
    } catch (error: any) {
      console.error('Failed to save monthly census:', error);
      toastError('Unable to submit census', error?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Submit monthly census"
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0B101A] shadow-2xl">
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Monthly Census</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
              aria-label="Close modal"
            >
              <span className="material-icons text-sm">close</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">Submit your monthly resident census and activity totals.</p>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Month</span>
              <input
                type="month"
                value={form.month}
                onChange={(e) => {
                  const month = e.target.value;
                  setForm((prev) => ({ ...prev, month }));
                  loadExisting(month).catch((error) => console.error(error));
                }}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-primary"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-slate-400">Interesting Cases</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.interestingCasesSubmitted}
                  onChange={(e) => setForm((prev) => ({ ...prev, interestingCasesSubmitted: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-primary"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-400">Notes</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.notesCount}
                  onChange={(e) => setForm((prev) => ({ ...prev, notesCount: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-primary"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-400">Fuente CT Census</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.fuenteCtCensus}
                  onChange={(e) => setForm((prev) => ({ ...prev, fuenteCtCensus: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-primary"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-400">Fuente MRI Census</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.fuenteMriCensus}
                  onChange={(e) => setForm((prev) => ({ ...prev, fuenteMriCensus: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-primary"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-400">Fuente X-Ray Census</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.fuenteXrayCensus}
                  onChange={(e) => setForm((prev) => ({ ...prev, fuenteXrayCensus: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-primary"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-400">Plates</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.platesCount}
                  onChange={(e) => setForm((prev) => ({ ...prev, platesCount: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-primary"
                  required
                />
              </label>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Any absence this month?</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, hasAbsence: true }))}
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${form.hasAbsence ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, hasAbsence: false, absenceDays: '0' }))}
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${!form.hasAbsence ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    No
                  </button>
                </div>
              </div>

              {form.hasAbsence && (
                <label className="block">
                  <span className="text-[11px] text-slate-400">Absence Days</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.absenceDays}
                    onChange={(e) => setForm((prev) => ({ ...prev, absenceDays: e.target.value }))}
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-primary"
                    required
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isSaving}
              className="px-4 py-2 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
            >
              {isSaving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MonthlyCensusModal;
