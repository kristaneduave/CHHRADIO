import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getMonthlyCensusByMonth, upsertMonthlyCensus } from '../services/monthlyCensusService';
import { supabase } from '../services/supabase';
import { toastError, toastSuccess } from '../utils/toast';
import { getMonthlyCensusErrorMessage, parseNonNegativeInt, parseNonNegativeScore } from '../utils/monthlyCensusValidation';

interface MonthlyCensusModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const MonthlyCensusModal: React.FC<MonthlyCensusModalProps> = ({ isOpen, onClose, residentId }) => {
  const [form, setForm] = useState<MonthlyCensusFormState>(getDefaultFormState);
  const [evidenceUrls, setEvidenceUrls] = useState<EvidenceState>(getDefaultEvidenceState);
  const [evidenceFiles, setEvidenceFiles] = useState<Partial<Record<EvidenceKey, File>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    census: true,
    productivity: false,
    status: false,
    evidence: false,
  });

  const fileInputRefs = useRef<Record<EvidenceKey, HTMLInputElement | null>>({
    fuente_ct: null,
    fuente_mri: null,
    fuente_xray: null,
    mandaue_ct: null,
    mandaue_mri: null,
    attendance: null,
  });

  const reportMonth = useMemo(() => `${form.month}-01`, [form.month]);

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
    if (!isOpen) return;
    const initialState = getDefaultFormState();
    setForm(initialState);
    setEvidenceUrls(getDefaultEvidenceState());
    setEvidenceFiles({});
    setExpandedSections({
      census: true,
      productivity: false,
      status: false,
      evidence: false,
    });
    loadExisting(initialState.month).catch((error) => console.error(error));
  }, [isOpen, residentId]);

  if (!isOpen) return null;

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
      onClose();
    } catch (error: any) {
      console.error('Failed to save monthly census:', error);
      toastError('Unable to submit census', getMonthlyCensusErrorMessage(error, 'Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  const sectionLabelClass = 'text-[11px] font-bold uppercase tracking-wider text-slate-400';
  const sectionBoxClass = 'rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-2';
  const compactRowClass = 'flex items-center justify-between gap-2';
  const compactInputClass = 'h-9 w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-sm text-white text-center focus:border-primary';
  const iconButtonClass =
    'h-10 w-10 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors flex items-center justify-center';
  const chipClass = 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300';

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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderSection = (params: {
    keyName: keyof typeof expandedSections;
    title: string;
    children: React.ReactNode;
  }) => {
    const expanded = expandedSections[params.keyName];

    return (
      <section className="space-y-2">
        <button
          type="button"
          onClick={() => toggleSection(params.keyName)}
          className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 hover:bg-white/[0.04] transition-colors"
          aria-expanded={expanded}
          aria-controls={`monthly-census-${params.keyName}`}
        >
          <span className={sectionLabelClass}>{params.title}</span>
          <span className={`material-icons text-[16px] text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>
        {expanded && (
          <div id={`monthly-census-${params.keyName}`} className="animate-in fade-in duration-150">
            {params.children}
          </div>
        )}
      </section>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Submit monthly census"
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 my-2 sm:my-4 w-full max-w-[380px] max-h-[92dvh] rounded-2xl border border-white/10 bg-[#0B101A] shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit} className="h-full overflow-y-auto p-3 sm:p-4 space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-1.5 bg-[#0B101A]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0B101A]/80 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Monthly Census</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center shrink-0"
              aria-label="Close modal"
            >
              <span className="material-icons text-sm">close</span>
            </button>
          </div>

          <label className="block">
            <span className={sectionLabelClass}>Month</span>
            <input
              type="month"
              value={form.month}
              onChange={(e) => {
                const month = e.target.value;
                setForm((prev) => ({ ...prev, month }));
                loadExisting(month).catch((error) => console.error(error));
              }}
              className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-white/[0.02] px-2.5 text-sm text-white focus:border-primary"
              required
            />
          </label>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
            {renderSection({
              keyName: 'census',
              title: 'Census',
              children: (
                <div className="space-y-2">
                  <div className={sectionBoxClass}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-white">Fuente</span>
                      <span className="text-[11px] text-slate-400">
                        {[
                          parseNonNegativeInt(form.fuenteCtCensus) ?? 0,
                          parseNonNegativeInt(form.fuenteMriCensus) ?? 0,
                          parseNonNegativeInt(form.fuenteXrayCensus) ?? 0,
                        ].reduce((sum, item) => sum + item, 0)}
                      </span>
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
                      <span className="text-[11px] text-slate-400">
                        {[
                          parseNonNegativeInt(form.mandaueCtCensus) ?? 0,
                          parseNonNegativeInt(form.mandaueMriCensus) ?? 0,
                        ].reduce((sum, item) => sum + item, 0)}
                      </span>
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
                </div>
              ),
            })}

            {renderSection({
              keyName: 'productivity',
              title: 'Productivity',
              children: (
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
                </div>
              ),
            })}

            {renderSection({
              keyName: 'status',
              title: 'Status',
              children: (
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
                  })}
                  <p className="text-[11px] text-slate-500">Use 0 when there are no absences this month.</p>
                </div>
              ),
            })}

            {renderSection({
              keyName: 'evidence',
              title: 'Evidence',
              children: (
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
              ),
            })}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 sticky bottom-0 -mx-3 sm:-mx-4 px-3 sm:px-4 py-1.5 bg-[#0B101A]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0B101A]/80">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isSaving}
              className="h-9 px-3 rounded-lg bg-primary text-white font-semibold text-sm disabled:opacity-50"
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
