import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getMonthlyCensusByMonth, upsertMonthlyCensus } from '../services/monthlyCensusService';
import { supabase } from '../services/supabase';
import { toastError, toastSuccess } from '../utils/toast';
import {
  getMonthlyCensusErrorMessage,
  isValidMonthlyCensusRotation,
  MONTHLY_CENSUS_ROTATIONS,
  parseNonNegativeInt,
  parseNonNegativeScore,
} from '../utils/monthlyCensusValidation';

interface MonthlyCensusPageProps {
  onBack: () => void;
  onHome: () => void;
  onSubmitted: () => void;
  residentId: string | null;
}

type EvidenceKey =
  | 'fuente_ct'
  | 'fuente_mri'
  | 'fuente_xray'
  | 'mandaue_ct'
  | 'mandaue_mri'
  | 'attendance';

interface MonthlyCensusFormState {
  month: string;
  rotation: string;
  dictationMet: boolean | null;
  ctMriTargetMet: boolean | null;
  mskPediaTargetMet: boolean | null;
  comments: string;
  interestingCasesSubmitted: string;
  notesCount: string;
  fuenteCtCensus: string;
  fuenteMriCensus: string;
  fuenteXrayCensus: string;
  mandaueCtCensus: string;
  mandaueMriCensus: string;
  platesCount: string;
  latesCount: string;
  overallScore: string;
  absenceDays: string;
}

interface EvidenceState {
  fuente_ct: string | null;
  fuente_mri: string | null;
  fuente_xray: string | null;
  mandaue_ct: string | null;
  mandaue_mri: string | null;
  attendance: string | null;
}

const EVIDENCE_BUCKET = 'resident-census-evidence';
const MAX_EVIDENCE_MB = 10;

const getCurrentMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getDefaultFormState = (): MonthlyCensusFormState => ({
  month: getCurrentMonthValue(),
  rotation: '',
  dictationMet: null,
  ctMriTargetMet: null,
  mskPediaTargetMet: null,
  comments: '',
  interestingCasesSubmitted: '0',
  notesCount: '0',
  fuenteCtCensus: '0',
  fuenteMriCensus: '0',
  fuenteXrayCensus: '0',
  mandaueCtCensus: '0',
  mandaueMriCensus: '0',
  platesCount: '0',
  latesCount: '0',
  overallScore: '0',
  absenceDays: '0',
});

const getDefaultEvidenceState = (): EvidenceState => ({
  fuente_ct: null,
  fuente_mri: null,
  fuente_xray: null,
  mandaue_ct: null,
  mandaue_mri: null,
  attendance: null,
});

const MonthlyCensusPage: React.FC<MonthlyCensusPageProps> = ({ onBack, onHome, onSubmitted, residentId }) => {
  const [form, setForm] = useState<MonthlyCensusFormState>(getDefaultFormState);
  const [evidenceUrls, setEvidenceUrls] = useState<EvidenceState>(getDefaultEvidenceState);
  const [evidenceFiles, setEvidenceFiles] = useState<Partial<Record<EvidenceKey, File>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTargetsOpen, setIsTargetsOpen] = useState(false);

  const fileInputRefs = useRef<Record<EvidenceKey, HTMLInputElement | null>>({
    fuente_ct: null,
    fuente_mri: null,
    fuente_xray: null,
    mandaue_ct: null,
    mandaue_mri: null,
    attendance: null,
  });

  const reportMonth = useMemo(() => `${form.month}-01`, [form.month]);
  const isPediaRotation = form.rotation === 'Pedia/MSK';

  const loadExisting = async (month: string) => {
    if (!residentId) return;

    setIsLoading(true);
    try {
      const existing = await getMonthlyCensusByMonth(residentId, `${month}-01`);
      if (!existing) {
        setForm((prev) => ({ ...getDefaultFormState(), month, platesCount: prev.platesCount }));
        setEvidenceUrls(getDefaultEvidenceState());
        setEvidenceFiles({});
        return;
      }

      const monthValue = existing.report_month.slice(0, 7);
      setForm({
        month: monthValue,
        rotation: existing.rotation ?? '',
        dictationMet: typeof existing.dictation_met === 'boolean' ? existing.dictation_met : null,
        ctMriTargetMet: typeof existing.ct_mri_target_met === 'boolean' ? existing.ct_mri_target_met : null,
        mskPediaTargetMet: typeof existing.msk_pedia_target_met === 'boolean' ? existing.msk_pedia_target_met : null,
        comments: existing.comments ?? '',
        interestingCasesSubmitted: String(existing.interesting_cases_submitted),
        notesCount: String(existing.notes_count),
        fuenteCtCensus: String(existing.fuente_ct_census),
        fuenteMriCensus: String(existing.fuente_mri_census),
        fuenteXrayCensus: String(existing.fuente_xray_census),
        mandaueCtCensus: String(existing.mandaue_ct_census ?? 0),
        mandaueMriCensus: String(existing.mandaue_mri_census ?? 0),
        platesCount: String(existing.plates_count ?? 0),
        latesCount: String(existing.lates_count ?? 0),
        overallScore: String(existing.overall_score ?? 0),
        absenceDays: String(existing.absence_days ?? 0),
      });

      setEvidenceUrls({
        fuente_ct: existing.fuente_ct_evidence_url ?? null,
        fuente_mri: existing.fuente_mri_evidence_url ?? null,
        fuente_xray: existing.fuente_xray_evidence_url ?? null,
        mandaue_ct: existing.mandaue_ct_evidence_url ?? null,
        mandaue_mri: existing.mandaue_mri_evidence_url ?? null,
        attendance: existing.attendance_evidence_url ?? null,
      });
      setEvidenceFiles({});
    } catch (error: any) {
      console.error('Failed to load monthly census:', error);
      toastError('Unable to load census data', getMonthlyCensusErrorMessage(error, 'Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialState = getDefaultFormState();
    setForm(initialState);
    setEvidenceUrls(getDefaultEvidenceState());
    setEvidenceFiles({});
    setIsTargetsOpen(false);
    loadExisting(initialState.month).catch((error) => console.error(error));
  }, [residentId]);

  const onPickEvidence = (key: EvidenceKey) => {
    fileInputRefs.current[key]?.click();
  };

  const handleEvidenceSelected = (key: EvidenceKey, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toastError('Invalid file', 'Please upload an image file (jpg/png/webp).');
      return;
    }

    if (file.size > MAX_EVIDENCE_MB * 1024 * 1024) {
      toastError('File too large', `Maximum file size is ${MAX_EVIDENCE_MB}MB.`);
      return;
    }

    setEvidenceFiles((prev) => ({ ...prev, [key]: file }));
    setEvidenceUrls((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  };

  const clearEvidence = (key: EvidenceKey) => {
    setEvidenceFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setEvidenceUrls((prev) => ({ ...prev, [key]: null }));
  };

  const uploadEvidenceFile = async (key: EvidenceKey, file: File) => {
    if (!residentId) throw new Error('Missing resident ID');

    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
    const safeMonth = form.month;
    const zone = key === 'attendance' ? 'attendance' : `census/${key}`;
    const objectPath = `${residentId}/${safeMonth}/${zone}/${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(objectPath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(objectPath);

    return publicUrl;
  };

  const uploadEvidenceIfNeeded = async () => {
    const uploaded: Partial<Record<EvidenceKey, string>> = {};

    const keys: EvidenceKey[] = ['fuente_ct', 'fuente_mri', 'fuente_xray', 'mandaue_ct', 'mandaue_mri', 'attendance'];

    for (const key of keys) {
      const file = evidenceFiles[key];
      if (!file) continue;
      uploaded[key] = await uploadEvidenceFile(key, file);
    }

    return uploaded;
  };

  const validateAndBuildPayload = (uploadedEvidence: Partial<Record<EvidenceKey, string>>) => {
    const rotation = form.rotation.trim();
    const interestingCasesSubmitted = parseNonNegativeInt(form.interestingCasesSubmitted);
    const notesCount = parseNonNegativeInt(form.notesCount);
    const fuenteCtCensus = parseNonNegativeInt(form.fuenteCtCensus);
    const fuenteMriCensus = parseNonNegativeInt(form.fuenteMriCensus);
    const fuenteXrayCensus = parseNonNegativeInt(form.fuenteXrayCensus);
    const mandaueCtCensus = parseNonNegativeInt(form.mandaueCtCensus);
    const mandaueMriCensus = parseNonNegativeInt(form.mandaueMriCensus);
    const latesCount = parseNonNegativeInt(form.latesCount);
    const overallScore = parseNonNegativeScore(form.overallScore);
    const absenceDays = parseNonNegativeInt(form.absenceDays);

    if (!residentId) {
      toastError('Missing user', 'Please sign in again.');
      return null;
    }

    if (!rotation || !isValidMonthlyCensusRotation(rotation)) {
      toastError('Rotation required', 'Please select a valid rotation.');
      return null;
    }

    if (form.dictationMet === null || form.ctMriTargetMet === null) {
      toastError('Missing status', 'Please choose met/not met for Dictation and CT/MRI Target.');
      return null;
    }

    if (rotation === 'Pedia/MSK' && form.mskPediaTargetMet === null) {
      toastError('Missing status', 'Please choose met/not met for MSK/Pedia Target.');
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
      mandaueCtCensus === null ||
      mandaueMriCensus === null ||
      latesCount === null ||
      overallScore === null ||
      absenceDays === null
    ) {
      toastError('Invalid values', 'Counts must be whole numbers >= 0. Overall score allows up to 2 decimals.');
      return null;
    }

    const withEvidence = (key: EvidenceKey) => uploadedEvidence[key] ?? evidenceUrls[key] ?? null;

    return {
      resident_id: residentId,
      report_month: reportMonth,
      rotation,
      dictation_met: form.dictationMet,
      ct_mri_target_met: form.ctMriTargetMet,
      msk_pedia_target_met: rotation === 'Pedia/MSK' ? form.mskPediaTargetMet : null,
      comments: form.comments.trim() ? form.comments.trim() : null,
      interesting_cases_submitted: interestingCasesSubmitted,
      notes_count: notesCount,
      fuente_ct_census: fuenteCtCensus,
      fuente_mri_census: fuenteMriCensus,
      fuente_xray_census: fuenteXrayCensus,
      mandaue_ct_census: mandaueCtCensus,
      mandaue_mri_census: mandaueMriCensus,
      plates_count: parseNonNegativeInt(form.platesCount) ?? 0,
      lates_count: latesCount,
      overall_score: overallScore,
      has_absence: absenceDays > 0,
      absence_days: absenceDays,
      fuente_ct_evidence_url: withEvidence('fuente_ct'),
      fuente_mri_evidence_url: withEvidence('fuente_mri'),
      fuente_xray_evidence_url: withEvidence('fuente_xray'),
      mandaue_ct_evidence_url: withEvidence('mandaue_ct'),
      mandaue_mri_evidence_url: withEvidence('mandaue_mri'),
      attendance_evidence_url: withEvidence('attendance'),
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsSaving(true);
    try {
      const uploadedEvidence = await uploadEvidenceIfNeeded();
      const payload = validateAndBuildPayload(uploadedEvidence);
      if (!payload) return;

      await upsertMonthlyCensus(payload);
      toastSuccess('Monthly census submitted');
      onSubmitted();
    } catch (error: any) {
      console.error('Failed to save monthly census:', error);
      toastError('Unable to submit census', getMonthlyCensusErrorMessage(error, 'Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  const sectionLabelClass = 'text-[11px] font-bold uppercase tracking-wider text-slate-400';
  const sectionBoxClass = 'rounded-xl border border-white/10 bg-white/[0.02] p-2.5 space-y-2';
  const compactRowClass = 'flex items-center justify-between gap-2';
  const compactInputClass = 'h-9 w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-sm text-white text-center focus:border-primary';
  const iconButtonClass =
    'h-10 w-10 rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 transition-colors flex items-center justify-center';
  const chipClass = 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300';
  const sectionTitleClass = 'text-[11px] font-bold uppercase tracking-wider text-primary-light';

  const renderEvidenceChip = (key: EvidenceKey) => {
    const url = evidenceUrls[key];
    if (!url) return null;

    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className={chipClass}>Uploaded</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-primary-light hover:underline">
          View
        </a>
        <button type="button" onClick={() => onPickEvidence(key)} className="text-[11px] text-slate-300 hover:text-white">
          Replace
        </button>
        <button type="button" onClick={() => clearEvidence(key)} className="text-[11px] text-slate-500 hover:text-slate-300">
          Remove
        </button>
      </div>
    );
  };

  const renderCompactNumberRow = (params: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    step?: number;
    min?: number;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    widthClass?: string;
  }) => (
    <label className={compactRowClass}>
      <span className="text-[12px] text-slate-300">{params.label}</span>
      <input
        type="number"
        min={params.min ?? 0}
        step={params.step ?? 1}
        inputMode={params.inputMode ?? 'numeric'}
        value={params.value}
        onChange={(e) => params.onChange(e.target.value)}
        className={`${compactInputClass} ${params.widthClass ?? ''}`}
        required
      />
    </label>
  );

  const renderCompactEvidenceRow = (params: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    evidenceKey: Exclude<EvidenceKey, 'attendance'>;
  }) => (
    <div>
      <div className={compactRowClass}>
        <span className="text-[12px] text-slate-300">{params.label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={params.value}
            onChange={(e) => params.onChange(e.target.value)}
            className={compactInputClass}
            required
          />
          <button
            type="button"
            onClick={() => onPickEvidence(params.evidenceKey)}
            className={iconButtonClass}
            title="Upload evidence"
            aria-label={`Upload ${params.label} evidence`}
          >
            <span className="material-icons text-[16px]">upload</span>
          </button>
        </div>
      </div>
      {renderEvidenceChip(params.evidenceKey)}
      <input
        ref={(el) => {
          fileInputRefs.current[params.evidenceKey] = el;
        }}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleEvidenceSelected(params.evidenceKey, e.target.files)}
      />
    </div>
  );

  const renderMetStatusRow = (params: {
    label: string;
    value: boolean | null;
    onChange: (value: boolean) => void;
    note: string;
    disabled?: boolean;
  }) => (
    <div className="space-y-1.5">
      <div className={compactRowClass}>
        <span className="text-[12px] text-slate-300">{params.label}</span>
        <div className="inline-flex w-[170px] items-center rounded-lg border border-white/10 bg-white/[0.03] p-1 gap-1">
          <button
            type="button"
            disabled={params.disabled}
            onClick={() => params.onChange(true)}
            className={`h-7 flex-1 px-2 rounded-md text-[11px] font-semibold transition-colors ${
              params.disabled
                ? 'text-slate-500'
                : params.value === true
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            Met
          </button>
          <button
            type="button"
            disabled={params.disabled}
            onClick={() => params.onChange(false)}
            className={`h-7 flex-1 px-2 rounded-md text-[11px] font-semibold transition-colors ${
              params.disabled
                ? 'text-slate-500'
                : params.value === false
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            Not met
          </button>
        </div>
      </div>
      {params.note ? <p className="text-[10px] text-slate-500">{params.note}</p> : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-app px-4 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200">
      <div className="max-w-md mx-auto space-y-2">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="px-0 py-1">
            <div className="max-w-md mx-auto flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-2 py-1.5">
              <button
                type="button"
                onClick={onBack}
                className="h-10 px-3 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 inline-flex items-center gap-1.5 text-sm font-medium"
                aria-label="Go back to Residents Corner"
              >
                <span className="material-icons text-[18px]">arrow_back</span>
                <span>Back</span>
              </button>
              <h2 className="text-[17px] font-semibold text-white tracking-tight">Monthly Census</h2>
              <button
                type="button"
                onClick={onHome}
                className="h-10 w-10 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 flex items-center justify-center"
                aria-label="Go to Home"
              >
                <span className="material-icons text-[18px]">home</span>
              </button>
            </div>
          </div>

          {!residentId && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              Sign in is required to submit monthly census.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="block rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
              <span className={sectionLabelClass}>Month</span>
              <input
                type="month"
                value={form.month}
                onChange={(e) => {
                  const month = e.target.value;
                  setForm((prev) => ({ ...prev, month }));
                  loadExisting(month).catch((error) => console.error(error));
                }}
                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-sm text-white focus:border-primary"
                required
              />
            </label>

            <label className="block rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
              <span className={sectionLabelClass}>Rotation</span>
              <select
                value={form.rotation}
                onChange={(e) => {
                  const rotation = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    rotation,
                    mskPediaTargetMet: rotation === 'Pedia/MSK' ? prev.mskPediaTargetMet : null,
                  }));
                }}
                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-sm text-white focus:border-primary"
                required
              >
                <option value="" className="bg-[#0B101A] text-slate-300">
                  Select rotation
                </option>
                {MONTHLY_CENSUS_ROTATIONS.map((rotation) => (
                  <option key={rotation} value={rotation} className="bg-[#0B101A] text-slate-100">
                    {rotation}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsTargetsOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2.5 text-left transition-colors ${isTargetsOpen ? 'bg-primary/10' : 'bg-white/[0.01]'}`}
              aria-expanded={isTargetsOpen}
              aria-controls="monthly-census-targets-panel"
            >
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="material-icons text-[14px] text-primary-light/90">info</span>
                <span className="text-[11px] font-bold uppercase tracking-wider">Monthly Targets</span>
              </span>
              <span className={`material-icons text-[16px] text-slate-400 transition-transform ${isTargetsOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>
            <div
              id="monthly-census-targets-panel"
              className={`grid transition-all duration-200 ${isTargetsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <div className="overflow-hidden px-2.5 pb-2.5">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 space-y-1.5">
                  <p className="text-[12px] text-slate-200">
                    <span className="font-semibold text-white">CT+MRI:</span> 8/day
                  </p>
                  <p className="text-[12px] text-slate-200">
                    <span className="font-semibold text-white">Interesting Cases:</span> 4/month
                  </p>
                  <p className="text-[12px] text-slate-200">
                    <span className="font-semibold text-white">Notes:</span> 2/month
                  </p>
                  <p className="text-[12px] text-slate-200">
                    <span className="font-semibold text-white">Dictation:</span> 1/day or 20/month
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
            <section className="space-y-2">
              <div className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2">
                <h3 className={sectionTitleClass}>Census</h3>
              </div>
              <div className={sectionBoxClass}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-white">Fuente</span>
                </div>
                {renderCompactEvidenceRow({
                  label: 'CT',
                  value: form.fuenteCtCensus,
                  onChange: (value) => setForm((prev) => ({ ...prev, fuenteCtCensus: value })),
                  evidenceKey: 'fuente_ct',
                })}
                {renderCompactEvidenceRow({
                  label: 'MRI',
                  value: form.fuenteMriCensus,
                  onChange: (value) => setForm((prev) => ({ ...prev, fuenteMriCensus: value })),
                  evidenceKey: 'fuente_mri',
                })}
                {renderCompactEvidenceRow({
                  label: 'X-ray',
                  value: form.fuenteXrayCensus,
                  onChange: (value) => setForm((prev) => ({ ...prev, fuenteXrayCensus: value })),
                  evidenceKey: 'fuente_xray',
                })}
              </div>

              <div className={sectionBoxClass}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-white">Mandaue</span>
                </div>
                {renderCompactEvidenceRow({
                  label: 'CT',
                  value: form.mandaueCtCensus,
                  onChange: (value) => setForm((prev) => ({ ...prev, mandaueCtCensus: value })),
                  evidenceKey: 'mandaue_ct',
                })}
                {renderCompactEvidenceRow({
                  label: 'MRI',
                  value: form.mandaueMriCensus,
                  onChange: (value) => setForm((prev) => ({ ...prev, mandaueMriCensus: value })),
                  evidenceKey: 'mandaue_mri',
                })}
              </div>
            </section>

            <section className="space-y-2 border-t border-white/10 pt-2 mt-2">
              <div className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2">
                <h3 className={sectionTitleClass}>Productivity</h3>
              </div>
              <div className={sectionBoxClass}>
                {renderCompactNumberRow({
                  label: 'Interesting Cases',
                  value: form.interestingCasesSubmitted,
                  onChange: (value) => setForm((prev) => ({ ...prev, interestingCasesSubmitted: value })),
                })}
                {renderCompactNumberRow({
                  label: 'Notes',
                  value: form.notesCount,
                  onChange: (value) => setForm((prev) => ({ ...prev, notesCount: value })),
                })}
                {renderCompactNumberRow({
                  label: 'Lates',
                  value: form.latesCount,
                  onChange: (value) => setForm((prev) => ({ ...prev, latesCount: value })),
                })}
                {renderMetStatusRow({
                  label: 'Dictation',
                  value: form.dictationMet,
                  onChange: (value) => setForm((prev) => ({ ...prev, dictationMet: value })),
                  note: '',
                })}
              </div>
            </section>

            <section className="space-y-2 border-t border-white/10 pt-2 mt-2">
              <div className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2">
                <h3 className={sectionTitleClass}>Status</h3>
              </div>
              <div className={sectionBoxClass}>
                {renderCompactNumberRow({
                  label: 'Overall Score',
                  value: form.overallScore,
                  onChange: (value) => setForm((prev) => ({ ...prev, overallScore: value })),
                  step: 0.01,
                  inputMode: 'decimal',
                  widthClass: 'w-24',
                })}
                {renderCompactNumberRow({
                  label: 'Absence Days',
                  value: form.absenceDays,
                  onChange: (value) => setForm((prev) => ({ ...prev, absenceDays: value })),
                  widthClass: 'w-24',
                })}
                {renderMetStatusRow({
                  label: 'CT+MRI Combined Target',
                  value: form.ctMriTargetMet,
                  onChange: (value) => setForm((prev) => ({ ...prev, ctMriTargetMet: value })),
                  note: '',
                })}
                {renderMetStatusRow({
                  label: 'MSK/Pedia Target',
                  value: isPediaRotation ? form.mskPediaTargetMet : null,
                  onChange: (value) => setForm((prev) => ({ ...prev, mskPediaTargetMet: value })),
                  note: '',
                  disabled: !isPediaRotation,
                })}
                <label className="block space-y-1">
                  <span className="text-[12px] text-slate-300">Notes/Comments</span>
                  <textarea
                    value={form.comments}
                    onChange={(e) => setForm((prev) => ({ ...prev, comments: e.target.value.slice(0, 1000) }))}
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-lg border border-white/15 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary resize-y"
                    placeholder="Add comments (optional)"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-2 border-t border-white/10 pt-2 mt-2">
              <div className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2">
                <h3 className={sectionTitleClass}>Attendance</h3>
              </div>
              <div className={sectionBoxClass}>
                <div className={compactRowClass}>
                  <span className="text-[12px] text-slate-300">Attendance Photo</span>
                  <button
                    type="button"
                    onClick={() => onPickEvidence('attendance')}
                    className={`${iconButtonClass} w-auto px-2.5 gap-1.5`}
                    aria-label="Upload attendance evidence"
                  >
                    <span className="material-icons text-[15px]">upload</span>
                    <span className="text-[11px] font-semibold">Upload</span>
                  </button>
                </div>
                {renderEvidenceChip('attendance')}
                <input
                  ref={(el) => {
                    fileInputRefs.current.attendance = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleEvidenceSelected('attendance', e.target.files)}
                />
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between gap-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onBack}
              className="h-10 px-4 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isSaving || !residentId}
              className="h-10 min-w-[124px] px-4 rounded-lg bg-primary text-white font-semibold text-sm disabled:opacity-50"
            >
              {isSaving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MonthlyCensusPage;
