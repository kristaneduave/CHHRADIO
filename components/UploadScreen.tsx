
import React, { useState, useRef, useEffect, DragEvent } from 'react';
import { supabase } from '../services/supabase';
import { generateViberText } from '../utils/formatters';
import { SubmissionType } from '../types';
import { toastError, toastSuccess, toastInfo } from '../utils/toast';
import { ImageAnnotatorDialog } from './ImageAnnotatorDialog';
import { useCaseSubmission, ImageUpload } from '../hooks/useCaseSubmission';
import { RichTextEditor } from './RichTextEditor';

const ORGAN_SYSTEMS = [
  'Neuroradiology',
  'Head & Neck',
  'Chest / Thoracic',
  'Cardiovascular',
  'Gastrointestinal (GI)',
  'Genitourinary (GU)',
  'Musculoskeletal (MSK)',
  'Women\'s Imaging / Breast',
  'Pediatric',
  'Interventional',
  'Nuclear Medicine'
];

const MODALITIES = [
  'X-Ray',
  'CT Scan',
  'MRI',
  'Ultrasound',
  'Mammography',
  'Fluoroscopy',
  'Nuclear Medicine',
  'Interventional',
  'PET/CT'
];

const REFERENCE_SOURCE_TYPES = [
  'Book',
  'Journal Article',
  'Reviewer / Board Prep',
  'Online Resource',
  'Lecture / Handout'
];

const SUBMISSION_TYPE_OPTIONS: Array<{
  id: SubmissionType;
  label: string;
  description: string;
  shortDescription: string;
  icon: string;
  activeClass: string;
  activeIconClass: string;
  inactiveIconClass: string;
  glowClass: string;
}> = [
  {
    id: 'interesting_case',
    label: 'Interesting Case',
    description: 'Classic teaching case with findings and discussion',
    shortDescription: 'Findings and teaching discussion',
    icon: 'library_books',
    activeClass: 'border-sky-500/30 bg-sky-500/[0.08] text-sky-100 shadow-[0_4px_24px_-8px_rgba(14,165,233,0.25)]',
    activeIconClass: 'bg-sky-500/20 border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.3)] text-sky-400',
    inactiveIconClass: 'bg-black/40 border-white/5 text-sky-400',
    glowClass: 'bg-sky-500/20',
  },
  {
    id: 'rare_pathology',
    label: 'Rare Pathology',
    description: 'Highlight unusual pathology and key clinchers',
    shortDescription: 'Unusual pathology and key clinchers',
    icon: 'science',
    activeClass: 'border-rose-500/30 bg-rose-500/[0.08] text-rose-100 shadow-[0_4px_24px_-8px_rgba(225,29,72,0.25)]',
    activeIconClass: 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)] text-rose-400',
    inactiveIconClass: 'bg-black/40 border-white/5 text-rose-400',
    glowClass: 'bg-rose-500/20',
  },
  {
    id: 'aunt_minnie',
    label: 'Aunt Minnie',
    description: 'Pattern-recognition case with minimal prompting',
    shortDescription: 'Pattern recognition with minimal prompting',
    icon: 'psychology',
    activeClass: 'border-amber-500/30 bg-amber-500/[0.08] text-amber-100 shadow-[0_4px_24px_-8px_rgba(217,119,6,0.25)]',
    activeIconClass: 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)] text-amber-400',
    inactiveIconClass: 'bg-black/40 border-white/5 text-amber-400',
    glowClass: 'bg-amber-500/20',
  },
];

interface UploadScreenProps {
  existingCase?: any; // Replace with proper type if available, e.g., Case
  initialSubmissionType?: SubmissionType;
  onClose?: () => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ existingCase, initialSubmissionType = 'interesting_case', onClose }) => {
  const [formData, setFormData] = useState({
    submissionType: (existingCase?.submission_type as SubmissionType) || initialSubmissionType,
    initials: existingCase?.patient_initials || '',
    age: existingCase?.patient_age || '',
    sex: existingCase?.patient_sex || 'M',
    modality: existingCase?.modality || 'CT Scan',
    organSystem: existingCase?.organ_system || existingCase?.anatomy_region || existingCase?.analysis_result?.anatomy_region || 'Neuroradiology',
    clinicalData: existingCase?.clinical_history || '',
    findings: existingCase?.findings || '',
    impression: existingCase?.analysis_result?.impression || '',
    notes: existingCase?.educational_summary || '', // Mapped to educational_summary for notes
    radiologicClinchers: existingCase?.radiologic_clinchers || '',
    referenceSourceType: existingCase?.analysis_result?.reference?.sourceType || '',
    referenceTitle: existingCase?.analysis_result?.reference?.title || '',
    referencePage: existingCase?.analysis_result?.reference?.page || '',
    diagnosis: existingCase?.diagnosis || '',
    date: existingCase?.analysis_result?.studyDate || new Date().toISOString().split('T')[0]
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [annotatingImageIndex, setAnnotatingImageIndex] = useState<number | null>(null);

  const [customTitle, setCustomTitle] = useState(existingCase?.title || '');
  const [images, setImages] = useState<ImageUpload[]>(
    existingCase?.image_urls?.map((url: string, index: number) => ({
      url,
      file: new File([], "existing_image"), // Placeholder, won't need re-uploading unless changed
      description: existingCase?.analysis_result?.imagesMetadata?.[index]?.description || ''
    })) || []
  );
  const [step, setStep] = useState(1); // 1: Input, 2: Result
  const [uploaderName, setUploaderName] = useState<string>('');
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isNotesFocusOpen, setIsNotesFocusOpen] = useState(false);

  const { saveCase, exportPdf, isSaving, isExportingPdf } = useCaseSubmission();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const setFieldRef = (key: string) => (node: HTMLElement | null) => {
    fieldRefs.current[key] = node;
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isScreenshotMode && showControls) {
      timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [isScreenshotMode, showControls]);

  const handleScreenTap = () => {
    if (isScreenshotMode) {
      setShowControls(true);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to get profile name, fallback to email or 'Radiologist'
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        setUploaderName(profile?.full_name || user.email || 'Radiologist');
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!isNotesFocusOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNotesFocusOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isNotesFocusOpen]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('radcore-bottom-nav-visibility', { detail: { hidden: isNotesFocusOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('radcore-bottom-nav-visibility', { detail: { hidden: false } }));
    };
  }, [isNotesFocusOpen]);

  // Force reset form if no existing case (fixes potential stale state or browser autofill issues)
  useEffect(() => {
    if (!existingCase) {
      setFormData({
        submissionType: initialSubmissionType,
        initials: '',
        age: '',
        sex: 'M',
        modality: 'CT Scan',
        organSystem: 'Neuroradiology',
        clinicalData: '',
        findings: '',
        impression: '',
        notes: '',
        radiologicClinchers: '',
        referenceSourceType: '',
        referenceTitle: '',
        referencePage: '',
        diagnosis: '',
        date: new Date().toISOString().split('T')[0]
      });
      setCustomTitle('');
      setImages([]);
      setStep(1);
    }
  }, [existingCase, initialSubmissionType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    let { value } = e.target;

    if (name === 'initials') {
      value = value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
    }

    if (name === 'age') {
      value = value.replace(/\D/g, '').slice(0, 3);
    }

    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomTitle(e.target.value);
  }

  const processFiles = (files: FileList | null) => {
    if (!files) return;

    let count = images.length;

    Array.from(files).forEach(file => {
      if (count >= 8) return; // Hard limit
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => {
            if (prev.length >= 8) return prev;
            return [...prev, {
              url: reader.result as string,
              file: file,
              description: ''
            }];
          });
        };
        reader.readAsDataURL(file);
        count++;
      }
    });

    if (files.length + images.length > 8) {
      toastInfo('Maximum of 8 images allowed', 'Some images were skipped.');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleImageDescriptionChange = (index: number, text: string) => {
    setImages(prev => prev.map((img, i) => i === index ? { ...img, description: text } : img));
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateReport = () => {
    if (images.length === 0) {
      toastError('Please upload at least one image.');
      return;
    }
    setStep(2);
  };

  const handleCopyToViber = () => {
    const text = generateViberText({ ...formData, organ: formData.organSystem }); // Backward compat if needed
    navigator.clipboard.writeText(text).then(() => {
      toastSuccess('Copied to clipboard', 'Ready to paste into Viber.');
    });
  };

  const validateForPublish = () => {
    const nextErrors: Record<string, string> = {};
    if (formData.submissionType === 'interesting_case' && !formData.initials.trim()) nextErrors.initials = 'Initials are required.';
    if (formData.submissionType !== 'aunt_minnie' && !formData.clinicalData.trim()) nextErrors.clinicalData = 'Clinical data is required.';
    if (!formData.findings.trim()) {
      nextErrors.findings = formData.submissionType === 'aunt_minnie' ? 'Description is required for Aunt Minnie.' : 'Findings are required.';
    }
    if (images.length === 0) nextErrors.images = 'At least one image is required.';

    if (formData.submissionType === 'rare_pathology' && !formData.radiologicClinchers.trim()) {
      nextErrors.radiologicClinchers = 'Radiologic clinchers are required for Rare Pathology.';
    }

    setFieldErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      window.requestAnimationFrame(() => {
        fieldRefs.current[firstError]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async (status: 'draft' | 'published') => {
    if (status === 'published' && !validateForPublish()) {
      toastError('Please complete required fields before publishing.');
      return;
    }
    if (status === 'draft' && images.length === 0) {
      toastError('Draft needs at least one image.');
      return;
    }

    await saveCase({
      status,
      existingCase,
      formData,
      customTitle,
      images,
      onSetFormData: (updates) => setFormData(prev => ({ ...prev, ...updates })),
      onSuccess: () => {
        if (onClose) {
          onClose();
        } else {
          setStep(1);
          setFormData({
            submissionType: 'interesting_case',
            initials: '',
            age: '',
            sex: 'M',
            modality: 'CT Scan',
            organSystem: 'Neuroradiology',
            clinicalData: '',
            findings: '',
            impression: '',
            notes: '',
            radiologicClinchers: '',
            referenceSourceType: '',
            referenceTitle: '',
            referencePage: '',
            diagnosis: '',
            date: new Date().toISOString().split('T')[0]
          });
          setImages([]);
          setCustomTitle('');
        }
      }
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  }

  const handleExportPdf = async () => {
    await exportPdf(formData, customTitle, uploaderName, images);
  };

  const inputClassName = 'w-full rounded-xl border border-white/5 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30';
  const textareaClassName = `${inputClassName} resize-y custom-scrollbar`;
  const sectionCardClassName = 'rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm sm:p-5';
  const sectionLabelClassName = 'text-xs font-bold uppercase tracking-[0.18em] text-slate-300';
  const sectionHintClassName = 'mt-1 text-xs leading-5 text-slate-500';
  const segmentedPanelClassName = 'grid grid-cols-1 gap-2 md:grid-cols-3';
  const canShowReferenceFields = formData.submissionType !== 'aunt_minnie';
  const imageCountLabel = `${images.length} / 8 images`;
  const submissionTypeLabel = formData.submissionType === 'rare_pathology'
    ? 'Rare Pathology'
    : formData.submissionType === 'aunt_minnie'
      ? 'Aunt Minnie'
      : 'Interesting Case';
  const selectedSubmissionOption =
    SUBMISSION_TYPE_OPTIONS.find((option) => option.id === formData.submissionType) ?? SUBMISSION_TYPE_OPTIONS[0];
  const titlePlaceholder = formData.submissionType === 'rare_pathology'
    ? 'Enter pathology or syndrome name'
    : formData.submissionType === 'aunt_minnie'
      ? 'Enter pattern-recognition title'
      : 'Enter case title';
  const plainNotes = React.useMemo(() => {
    if (!formData.notes) return '';
    if (typeof window === 'undefined') {
      return String(formData.notes).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(formData.notes, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }, [formData.notes]);
  return (
    <div className="flex flex-col h-full bg-app relative">
      {/* Screenshot Overlay */}
      {isScreenshotMode && (
        <div
          onClick={handleScreenTap}
          className="fixed inset-0 z-[100] bg-app p-6 flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-y-auto cursor-pointer"
        >
          {/* Exit Button - Floating (Auto-hide) */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsScreenshotMode(false); }}
            className={`fixed top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all duration-500 z-50 backdrop-blur-md ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <span className="material-icons">close</span>
          </button>

          <div className="w-full max-w-md space-y-6 my-auto">
            <header className="text-center flex flex-row items-center justify-center gap-3 mb-4">
              <h1 className="text-3xl font-bold text-white">{customTitle || 'Case Report'}</h1>
            </header>

            {/* Grid of Images */}
            {/* Grid of Images - Smart Layout */}
            <div className={`grid gap-4 ${images.length === 1 ? 'grid-cols-1 max-w-[280px] mx-auto' : 'grid-cols-2'}`}>
              {images.map((img, idx) => (
                <div key={idx} className={`flex flex-col gap-2 ${images.length > 1 && images.length % 2 !== 0 && idx === images.length - 1 ? 'col-span-2 w-1/2 mx-auto' : ''}`}>
                  <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black/50 shadow-lg">
                    <img src={img.url} className="w-full h-full object-cover" alt="" />
                  </div>
                  {/* Description Below Image */}
                  {img.description && (
                    <p className="text-[10px] text-slate-300 font-medium text-center leading-tight px-1">
                      {img.description}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {formData.submissionType === 'interesting_case' && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Clinical Data</p>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-line">{formData.clinicalData || 'No clinical data provided.'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Findings</p>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-line">{formData.findings || 'No findings provided.'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Impression</p>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-line">{formData.impression || 'No impression provided.'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Notes / Remarks</p>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{formData.notes || 'No notes provided.'}</p>
                </div>
              </div>
            )}

            {formData.submissionType === 'rare_pathology' && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Clinical Data</p>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-line">{formData.clinicalData || 'No clinical data provided.'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Findings</p>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-line">{formData.findings || 'No findings provided.'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Radiologic Clinchers</p>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-line">{formData.radiologicClinchers || 'No radiologic clinchers provided.'}</p>
                </div>
              </div>
            )}

            {canShowReferenceFields && (formData.referenceSourceType || formData.referenceTitle || formData.referencePage) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Reference Source</p>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-line">
                    {[formData.referenceSourceType, formData.referenceTitle].filter(Boolean).join(' • ') || 'Reference provided'}
                  </p>
                  {formData.referencePage && (
                    <p className="text-xs text-slate-300 mt-1">{formData.referencePage}</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto custom-scrollbar ${isScreenshotMode ? 'hidden' : ''}`}>
        <div className="px-6 pt-6 pb-24 max-w-7xl mx-auto w-full">
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="px-1">
              <h1 className="text-3xl font-bold text-white">Upload</h1>
            </header>

            <section>
              <div className={`${sectionCardClassName} space-y-5`}>
                <div className="space-y-1">
                  <p className={sectionLabelClassName}>Case Identity</p>
                  <p className={sectionHintClassName}>Choose the upload format, then name the case in the same place.</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.88fr)_minmax(420px,1.12fr)] xl:items-start">
                  <div className="space-y-1.5">
                    {SUBMISSION_TYPE_OPTIONS.map((option) => {
                      const isActive = option.id === formData.submissionType;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, submissionType: option.id }))}
                          className={`relative w-full overflow-hidden rounded-3xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                            isActive
                              ? `${option.activeClass} px-3.5 py-2.5`
                              : 'border-white/5 bg-white/[0.03] px-3.5 py-1.5 hover:bg-white/[0.05]'
                          }`}
                        >
                          {isActive ? (
                            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                              <div className={`absolute top-0 right-0 h-14 w-14 ${option.glowClass} blur-[32px] rounded-full -translate-y-1/3 translate-x-1/3`} />
                            </div>
                          ) : null}
                          <div className="relative z-10 flex items-center gap-3">
                            <div className={`flex ${isActive ? 'h-10 w-10 rounded-[16px]' : 'h-8.5 w-8.5 rounded-xl'} shrink-0 items-center justify-center border shadow-inner ${isActive ? option.activeIconClass : option.inactiveIconClass}`}>
                              <span className={`material-icons ${isActive ? 'text-[18px]' : 'text-[16px]'}`}>{option.icon}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`${isActive ? 'text-[14px]' : 'text-[15px]'} font-bold leading-tight ${isActive ? 'text-white' : 'text-slate-200'}`}>{option.label}</p>
                              {!isActive ? <p className="mt-0.5 truncate text-[12px] leading-5 text-slate-500">{option.shortDescription}</p> : null}
                            </div>
                            {!isActive ? <span className="material-icons text-slate-500">chevron_right</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-4 rounded-[28px] bg-black/10 p-2 sm:p-3">
                    <div className="flex items-center gap-3 rounded-[22px] border border-white/6 bg-white/[0.02] px-3.5 py-3 sm:px-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border shadow-inner ${selectedSubmissionOption.activeIconClass}`}>
                        <span className="material-icons text-[18px]">{selectedSubmissionOption.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold leading-tight text-white sm:text-lg">{selectedSubmissionOption.label}</p>
                      </div>
                    </div>
                    <div className="space-y-2 px-1 sm:px-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Case Title</label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={handleTitleChange}
                        placeholder={titlePlaceholder}
                        autoComplete="off"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              ref={setFieldRef('images')}
              className={`${sectionCardClassName} space-y-4 ${isDragging ? 'border-cyan-400/20 bg-cyan-500/10' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={sectionLabelClassName}>Images</h2>
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => processFiles(e.target.files)}
                className="hidden"
                accept="image/*"
                multiple
              />

              {images.length === 0 ? (
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className={`w-full min-h-[220px] rounded-3xl border border-dashed px-6 py-10 text-center transition md:min-h-[260px] ${isDragging ? 'border-cyan-400/20 bg-cyan-500/10' : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]'}`}
                >
                  <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                      <span className="material-icons text-3xl">add_photo_alternate</span>
                    </div>
                    <div className="space-y-2 text-center">
                      <p className="text-base font-bold text-white">Upload images</p>
                      <p className="text-sm text-slate-300">Drag and drop or tap to browse.</p>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Max 8 images</p>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:p-4">
                      <div
                        className="group relative mb-3 aspect-square overflow-hidden rounded-xl border border-white/10 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setAnnotatingImageIndex(idx); }}
                      >
                        <img src={img.url} className="h-full w-full object-cover bg-black" alt={`Uploaded case image ${idx + 1}`} />
                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/85 via-black/30 to-transparent px-3 pb-3 pt-10">
                          <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">Annotate</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-slate-200 transition-colors hover:border-rose-400 hover:bg-rose-500 hover:text-white"
                            aria-label={`Remove image ${idx + 1}`}
                          >
                            <span className="material-icons text-[16px]">close</span>
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={img.description}
                        onChange={(e) => handleImageDescriptionChange(idx, e.target.value)}
                        placeholder="Add a note..."
                        className={inputClassName}
                      />
                    </div>
                  ))}

                      {images.length < 8 && (
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      className="min-h-[220px] rounded-2xl border border-dashed border-white/5 bg-white/[0.03] p-6 text-left transition hover:border-white/10 hover:bg-white/[0.05]"
                    >
                      <div className="flex h-full flex-col justify-between">
                        <div className="flex flex-col items-center justify-center p-6 space-y-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                            <span className="material-icons text-2xl">add</span>
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-base font-bold text-white leading-tight">Add<br />Images</p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tap to browse</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {fieldErrors.images && (
                <p className="text-sm text-rose-400">{fieldErrors.images}</p>
              )}
            </section>

            {formData.submissionType === 'interesting_case' && (
              <section className={`${sectionCardClassName} space-y-4`}>
                <div>
                  <h2 className={sectionLabelClassName}>Case Details</h2>
                </div>

                <div className="grid grid-cols-12 gap-4">
                  <div ref={setFieldRef('initials')} className="col-span-5 space-y-2 md:col-span-5">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Patient Initials</label>
                    <input name="initials" value={formData.initials} onChange={handleInputChange} autoComplete="off" placeholder="Patient initials" maxLength={2} className={inputClassName} />
                    {fieldErrors.initials && <p className="text-sm text-rose-400">{fieldErrors.initials}</p>}
                  </div>
                  <div className="col-span-3 space-y-2 md:col-span-3">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Age</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" name="age" value={formData.age} onChange={handleInputChange} placeholder="Age" className={`${inputClassName} appearance-none`} />
                  </div>
                  <div className="col-span-4 space-y-2 md:col-span-4">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Sex</label>
                    <div className="flex h-[42px] rounded-xl border border-white/5 bg-black/40 p-1">
                      {['M', 'F'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, sex: s }))}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${formData.sex === s ? 'bg-cyan-500/10 text-cyan-100' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-12 space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Modality</label>
                    <div className="relative">
                      <select name="modality" value={formData.modality} onChange={handleInputChange} className={`${inputClassName} appearance-none cursor-pointer`}>
                        {MODALITIES.map(m => (
                          <option key={m} value={m} className="bg-app text-white">{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="col-span-12 space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Organ System</label>
                    <div className="relative">
                      <select name="organSystem" value={formData.organSystem} onChange={handleInputChange} className={`${inputClassName} appearance-none cursor-pointer`}>
                        {ORGAN_SYSTEMS.map(os => (
                          <option key={os} value={os} className="bg-app text-white">{os}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className={`${sectionCardClassName} space-y-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabelClassName}>Case Information</h2>
                </div>
                {Object.keys(fieldErrors).length > 0 && (
                  <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">Missing required fields</span>
                )}
              </div>

              {formData.submissionType !== 'aunt_minnie' && (
                <div ref={setFieldRef('clinicalData')} className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Clinical Data</label>
                  <input
                    name="clinicalData"
                    value={formData.clinicalData}
                    onChange={handleInputChange}
                    placeholder="Enter clinical data..."
                    className={inputClassName}
                    autoComplete="off"
                  />
                  {fieldErrors.clinicalData && <p className="text-sm text-rose-400">{fieldErrors.clinicalData}</p>}
                </div>
              )}

              <div ref={setFieldRef('findings')} className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{formData.submissionType === 'aunt_minnie' ? 'Description' : 'Findings'}</label>
                <textarea
                  name="findings"
                  value={formData.findings}
                  onChange={handleInputChange}
                  rows={7}
                  placeholder="Enter findings..."
                  className={`${textareaClassName} min-h-[260px] sm:min-h-[180px]`}
                />
                {fieldErrors.findings && <p className="text-sm text-rose-400">{fieldErrors.findings}</p>}
              </div>

              {formData.submissionType === 'rare_pathology' && (
                <div ref={setFieldRef('radiologicClinchers')} className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Radiologic Clinchers</label>
                  <textarea
                    name="radiologicClinchers"
                    value={formData.radiologicClinchers}
                    onChange={handleInputChange}
                    rows={5}
                    placeholder="Enter radiologic clinchers..."
                    className={`${textareaClassName} min-h-[120px]`}
                  />
                  {fieldErrors.radiologicClinchers && <p className="text-sm text-rose-400">{fieldErrors.radiologicClinchers}</p>}
                </div>
              )}
            </section>

            <section className={`${sectionCardClassName} space-y-5`}>
              <div>
                <h2 className={sectionLabelClassName}>Teaching Details</h2>
              </div>

              <div className="space-y-6">
                {(formData.submissionType === 'interesting_case' || formData.submissionType === 'aunt_minnie') && (
                  <div className="space-y-3 min-w-0">
                    <div className="min-w-0">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Notes / Remarks</label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNotesFocusOpen(true)}
                      className="group flex w-full flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-6 text-center transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)]">
                        <span className="material-icons text-[24px]">{formData.notes ? 'edit_note' : 'note_add'}</span>
                      </div>
                      <p className="mt-4 text-base font-semibold text-white">{formData.notes ? 'Edit Notes / Remarks' : 'Add Notes / Remarks'}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {formData.notes ? 'Open full editor' : 'Open full editor'}
                      </p>
                    </button>
                  </div>
                )}

                {canShowReferenceFields && (
                  <div className="max-w-3xl space-y-4">
                    <div>
                      <h3 className={sectionLabelClassName}>Reference Source</h3>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Source Type</label>
                      <div className="relative">
                        <select name="referenceSourceType" value={formData.referenceSourceType} onChange={handleInputChange} className={`${inputClassName} appearance-none cursor-pointer`}>
                          <option value="" className="bg-app text-white">Select source type</option>
                          {REFERENCE_SOURCE_TYPES.map((type) => (
                            <option key={type} value={type} className="bg-app text-white">{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Title / Source Name</label>
                      <input name="referenceTitle" value={formData.referenceTitle} onChange={handleInputChange} placeholder="Felson's Principles of Chest Roentgenology" className={inputClassName} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Page / Figure</label>
                      <input name="referencePage" value={formData.referencePage} onChange={handleInputChange} placeholder="p. 214" className={inputClassName} />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className={`${sectionCardClassName} space-y-4`}>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Ready to continue?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:max-w-[320px]">
                <button
                  type="button"
                  onClick={() => handleSave('draft')}
                  disabled={isSaving || images.length === 0}
                  className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={images.length === 0}
                  className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Preview Report
                </button>
              </div>
            </section>
          </div>
        )}

        {isNotesFocusOpen && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Focused notes editor">
            <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#101922]/95 shadow-[0_30px_80px_rgba(2,6,23,0.65)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">Full Editor</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Notes / Remarks</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotesFocusOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close notes focus mode"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-hidden px-6 py-5">
                <RichTextEditor
                  value={formData.notes || ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, notes: val }))}
                  placeholder="Build out your teaching pearls, differential diagnosis, pitfalls, and takeaways..."
                  minHeight="52vh"
                  toolbarMode="expanded"
                  autoFocus
                  surface="paper"
                  className="h-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNotesFocusOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNotesFocusOpen(false)}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-[0_10px_20px_-5px_rgba(13,162,231,0.35)]"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Annotator Dialog */}
        {annotatingImageIndex !== null && (
          <ImageAnnotatorDialog
            imageSrc={images[annotatingImageIndex].url}
            onCancel={() => setAnnotatingImageIndex(null)}
            onSave={(base64) => {
              setImages(prev => {
                const next = [...prev];
                // Create a new file from base64 if it was a file upload, 
                // or just update url if we don't strictly need the File object immediately.
                // Since supabase upload uses the File object, we must convert base64 to File buffer
                // but for now, assigning base64 to url and making a dummy file is fine
                // to satisfy the type. The saving logic uses the blob.
                fetch(base64)
                  .then(res => res.blob())
                  .then(blob => {
                    const file = new File([blob], `annotated_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    next[annotatingImageIndex] = { ...next[annotatingImageIndex], url: base64, file };
                    setImages(next);
                  });
                return next;
              });
              setAnnotatingImageIndex(null);
            }}
          />
        )}

        {step === 2 && !isScreenshotMode && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500 pb-12">
            <header className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white">{customTitle || 'New Case'}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-100">{imageCountLabel}</span>
                  {formData.submissionType === 'rare_pathology' && (
                    <>
                      <span className="text-rose-300 font-bold uppercase tracking-wide">Rare Pathology</span>
                    </>
                  )}
                  {formData.submissionType === 'aunt_minnie' && (
                    <>
                      <span className="text-amber-300 font-bold uppercase tracking-wide">Aunt Minnie</span>
                    </>
                  )}
                  {formData.submissionType === 'interesting_case' && (
                    <span className="text-cyan-200 font-bold uppercase tracking-wide">Interesting Case</span>
                  )}
                </div>
              </div>
              <button onClick={() => setStep(1)} className="w-10 h-10 rounded-full glass-card-enhanced flex items-center justify-center text-slate-400"><span className="material-icons">edit</span></button>
            </header>

            {/* Preview Card */}
            <div className="glass-card-enhanced p-5 rounded-2xl border-primary/20 bg-primary/[0.02] space-y-4">
              {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {images.map((img, i) => (
                    <div key={i} className="shrink-0 space-y-1 w-24">
                      <img src={img.url} alt="" className="h-24 w-24 object-cover rounded-xl bg-black/40" />
                      {img.description && <p className="text-[9px] text-slate-400 truncate">{img.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                {formData.submissionType === 'interesting_case' && (
                  <>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Patient</span>
                      <p className="text-white text-sm font-bold">{formData.initials} ({formData.age}/{formData.sex})</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Exam</span>
                      <p className="text-white text-sm font-bold">{formData.modality}</p>
                      <p className="text-slate-400 text-xs">{formData.organSystem}</p>
                    </div>
                  </>
                )}
                {formData.submissionType !== 'aunt_minnie' && formData.clinicalData && (
                  <div className="col-span-2">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Clinical Data</span>
                    <p className="text-white text-xs">{formData.clinicalData}</p>
                  </div>
                )}
              </div>

              {/* Patient ID Display */}
              {formData.diagnosis && (
                <div>
                  <span className="text-[9px] text-primary font-bold uppercase tracking-wider">Patient ID</span>
                  <p className="text-white text-lg font-mono font-bold tracking-widest">{formData.diagnosis}</p>
                </div>
              )}

              {formData.submissionType === 'interesting_case' && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Impression</span>
                  <p className="text-white text-sm font-medium">{formData.impression}</p>
                </div>
              )}
              {formData.submissionType === 'rare_pathology' && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Radiologic Clinchers</span>
                  <p className="text-white text-sm font-medium">{formData.radiologicClinchers || 'Not provided'}</p>
                </div>
              )}
              {formData.submissionType === 'aunt_minnie' && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Description</span>
                  <p className="text-white text-sm font-medium">{formData.findings || 'Not provided'}</p>
                </div>
              )}
              {formData.submissionType === 'aunt_minnie' && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Notes / Remarks</span>
                  <p className="text-slate-300 text-sm whitespace-pre-line">{plainNotes || 'No notes provided.'}</p>
                </div>
              )}
              {formData.submissionType === 'interesting_case' && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Notes</span>
                  <p className="text-slate-300 text-sm whitespace-pre-line">{plainNotes || 'No notes provided.'}</p>
                </div>
              )}
              {canShowReferenceFields && (formData.referenceSourceType || formData.referenceTitle || formData.referencePage) && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Reference Source</span>
                  <p className="text-white text-sm font-medium">
                    {[formData.referenceSourceType, formData.referenceTitle].filter(Boolean).join(' • ') || 'Reference provided'}
                  </p>
                  {formData.referencePage && <p className="text-slate-400 text-xs">{formData.referencePage}</p>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => setIsScreenshotMode(true)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-3"
              >
                <span className="material-icons">crop_free</span>
                Screenshot Mode
              </button>

              <button onClick={handleCopyToViber} className="w-full py-4 bg-[#7360f2] hover:bg-[#5e4ecc] text-white rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-3">
                <span className="material-icons">content_copy</span>
                Copy for Viber
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="w-full py-4 glass-card-enhanced text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="material-icons text-rose-500">picture_as_pdf</span>
                {isExportingPdf ? 'Exporting PDF...' : 'Export to Drive (PDF)'}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleSave('draft')} disabled={isSaving} className="w-full py-3 text-sm font-bold text-slate-400 bg-white/5 rounded-xl hover:bg-white/10 transition-colors uppercase tracking-wider disabled:opacity-50">
                  {existingCase ? 'Update Private Draft' : 'Save as Private Draft'}
                </button>
                <button onClick={() => handleSave('published')} disabled={isSaving} className="w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors uppercase tracking-wider shadow-lg shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSaving && <span className="material-icons animate-spin text-[16px]">autorenew</span>}
                  {existingCase ? 'Update & Publish' : 'Publish to Database'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

    </div>
  );
};

export default UploadScreen;
