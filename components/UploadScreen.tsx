
import React, { useState, useRef, useEffect, DragEvent } from 'react';
import { supabase } from '../services/supabase';
import { generateViberText } from '../utils/formatters';
import { SubmissionType } from '../types';
import { toastError, toastSuccess, toastInfo } from '../utils/toast';
import { ImageAnnotatorDialog } from './ImageAnnotatorDialog';
import { useCaseSubmission, ImageUpload } from '../hooks/useCaseSubmission';

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
    const { name, value } = e.target;
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

  const inputClassName = 'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:shadow-[inset_0_0_10px_rgba(6,182,212,0.18)] transition-all';
  const textareaClassName = `${inputClassName} resize-y custom-scrollbar`;
  const sectionCardClassName = 'rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-xl backdrop-blur-xl sm:p-6';
  const canShowReferenceFields = formData.submissionType !== 'aunt_minnie';
  const imageCountLabel = `${images.length} / 8 images`;

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

      {/* Modern Stepper (Hidden in Screenshot Mode) */}
      {!isScreenshotMode && (
        <div className="px-6 pt-6 flex justify-between items-center mb-4 shrink-0">
          <div className="flex gap-2">
            {[1, 2].map(i => (
              <div key={i} className={`h-1 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-primary shadow-[0_0_10px_rgba(13,162,231,0.5)]' : 'w-4 bg-white/10'}`} />
            ))}
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar ${isScreenshotMode ? 'hidden' : ''}`}>
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <section className={`${sectionCardClassName} space-y-5`}>
              <div className="flex bg-black/40 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl relative w-full overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, submissionType: 'interesting_case' }))}
                  className={`flex-1 py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all duration-300 z-10 ${formData.submissionType === 'interesting_case'
                    ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                >
                  Interesting Case
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, submissionType: 'rare_pathology' }))}
                  className={`flex-1 py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all duration-300 z-10 ${formData.submissionType === 'rare_pathology'
                    ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                >
                  Rare Pathology
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, submissionType: 'aunt_minnie' }))}
                  className={`flex-1 py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all duration-300 z-10 ${formData.submissionType === 'aunt_minnie'
                    ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                >
                  Aunt Minnie
                </button>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Case Title</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={handleTitleChange}
                    placeholder={formData.submissionType === 'rare_pathology' ? 'Enter pathology or syndrome name...' : formData.submissionType === 'aunt_minnie' ? 'Enter pattern-recognition title...' : 'Enter teaching case title...'}
                    autoComplete="off"
                    className="w-full bg-transparent text-2xl font-black tracking-wide text-white border-none focus:ring-0 placeholder:text-slate-600 p-0 md:text-3xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Study Date</label>
                  <div className="max-w-[220px]">
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className={inputClassName}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section
              ref={setFieldRef('images')}
              className={`${sectionCardClassName} space-y-5 ${isDragging ? 'ring-2 ring-cyan-500/60 bg-cyan-500/10' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Images</h2>
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
                  className={`w-full min-h-[240px] rounded-[28px] border border-dashed px-6 py-10 text-center transition-all duration-300 md:min-h-[320px] ${isDragging ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.2)]' : 'border-white/20 bg-black/40 hover:border-cyan-400 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(6,182,212,0.16)]'}`}
                >
                  <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                      <span className="material-icons text-3xl">add_photo_alternate</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-white">Upload case images</p>
                      <p className="text-sm text-slate-300">Drag images here or tap to browse</p>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Up to 8 images. You can annotate each image after upload.</p>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-3 sm:p-4">
                      <div
                        className="group relative mb-3 aspect-square overflow-hidden rounded-2xl border border-white/10 cursor-pointer"
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
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Image Note</label>
                      <input
                        type="text"
                        value={img.description}
                        onChange={(e) => handleImageDescriptionChange(idx, e.target.value)}
                        placeholder="What should viewers notice in this image?"
                        className={inputClassName}
                      />
                    </div>
                  ))}

                  {images.length < 8 && (
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      className="min-h-[260px] rounded-[24px] border border-dashed border-white/20 bg-black/35 p-6 text-left transition-all hover:border-cyan-400 hover:bg-white/5"
                    >
                      <div className="flex h-full flex-col justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                          <span className="material-icons text-2xl">add</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-bold text-white">Add images</p>
                          <p className="text-sm text-slate-400">Add more views or sequences without leaving the form.</p>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Drag here or tap to browse</p>
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

            <section className={`${sectionCardClassName} space-y-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Required Information</h2>
                  <p className="mt-1 text-sm text-slate-400">Complete the essentials first so the case is ready to preview and publish.</p>
                </div>
                {Object.keys(fieldErrors).length > 0 && (
                  <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">Missing required fields</span>
                )}
              </div>

              {formData.submissionType !== 'aunt_minnie' && (
                <div ref={setFieldRef('clinicalData')} className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Clinical Data</label>
                  <textarea
                    name="clinicalData"
                    value={formData.clinicalData}
                    onChange={handleInputChange}
                    rows={5}
                    placeholder="Example: 54-year-old with chronic cough, weight loss, and prior treated TB..."
                    className={`${textareaClassName} min-h-[120px]`}
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
                  placeholder="Example: CT chest shows a spiculated right upper lobe mass with central cavitation..."
                  className={`${textareaClassName} min-h-[180px]`}
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
                    placeholder="Example: fluid-fluid levels, cortical expansion, narrow zone of transition..."
                    className={`${textareaClassName} min-h-[120px]`}
                  />
                  {fieldErrors.radiologicClinchers && <p className="text-sm text-rose-400">{fieldErrors.radiologicClinchers}</p>}
                </div>
              )}
            </section>

            {formData.submissionType === 'interesting_case' && (
              <section className={`${sectionCardClassName} space-y-5`}>
                <div>
                  <h2 className="text-lg font-bold text-white">Case Details</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div ref={setFieldRef('initials')} className="space-y-2 sm:col-span-5">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Initials</label>
                    <input name="initials" value={formData.initials} onChange={handleInputChange} autoComplete="off" placeholder="Pt initials" className={inputClassName} />
                    {fieldErrors.initials && <p className="text-sm text-rose-400">{fieldErrors.initials}</p>}
                  </div>
                  <div className="space-y-2 sm:col-span-3">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Age</label>
                    <input type="number" name="age" value={formData.age} onChange={handleInputChange} placeholder="Age" className={inputClassName} />
                  </div>
                  <div className="space-y-2 sm:col-span-4">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Sex</label>
                    <div className="flex rounded-2xl border border-white/10 bg-black/50 p-1">
                      {['M', 'F'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, sex: s }))}
                          className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold transition-all ${formData.sex === s ? 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Modality</label>
                    <div className="relative">
                      <select name="modality" value={formData.modality} onChange={handleInputChange} className={`${inputClassName} appearance-none cursor-pointer pr-10`}>
                        {MODALITIES.map(m => (
                          <option key={m} value={m} className="bg-app text-white">{m}</option>
                        ))}
                      </select>
                      <span className="material-icons pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">expand_more</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Organ System</label>
                    <div className="relative">
                      <select name="organSystem" value={formData.organSystem} onChange={handleInputChange} className={`${inputClassName} appearance-none cursor-pointer pr-10`}>
                        {ORGAN_SYSTEMS.map(os => (
                          <option key={os} value={os} className="bg-app text-white">{os}</option>
                        ))}
                      </select>
                      <span className="material-icons pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">expand_more</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className={`${sectionCardClassName} space-y-5`}>
              <div>
                <h2 className="text-lg font-bold text-white">Optional Teaching Details</h2>
              </div>

              {formData.submissionType === 'interesting_case' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Impression</label>
                  <input name="impression" value={formData.impression} onChange={handleInputChange} placeholder="Example: Primary bronchogenic carcinoma" className={inputClassName} />
                </div>
              )}

              {(formData.submissionType === 'interesting_case' || formData.submissionType === 'aunt_minnie') && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Notes / Remarks</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={5}
                    placeholder="Add teaching pearls, differential points, or additional remarks..."
                    className={`${textareaClassName} min-h-[120px]`}
                  />
                </div>
              )}

              {canShowReferenceFields && (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Reference Source</h3>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Source Type</label>
                    <div className="relative">
                      <select name="referenceSourceType" value={formData.referenceSourceType} onChange={handleInputChange} className={`${inputClassName} appearance-none cursor-pointer pr-10`}>
                        <option value="" className="bg-app text-white">Select source type</option>
                        {REFERENCE_SOURCE_TYPES.map((type) => (
                          <option key={type} value={type} className="bg-app text-white">{type}</option>
                        ))}
                      </select>
                      <span className="material-icons pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">expand_more</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Title / Source Name</label>
                      <input name="referenceTitle" value={formData.referenceTitle} onChange={handleInputChange} placeholder="Felson's Principles of Chest Roentgenology" className={inputClassName} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Page / Figure</label>
                      <input name="referencePage" value={formData.referencePage} onChange={handleInputChange} placeholder="p. 214" className={inputClassName} />
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className={`${sectionCardClassName} space-y-4`}>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Ready to continue?</p>
                <p className="text-xs text-slate-400">Preview the report once you have at least one image. You can still come back and edit before saving.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:max-w-[320px]">
                <button
                  type="button"
                  onClick={() => handleSave('draft')}
                  disabled={isSaving || images.length === 0}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={images.length === 0}
                  className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all shadow-[0_10px_20px_-5px_rgba(13,162,231,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Preview Report
                </button>
              </div>
            </section>
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
                  <span className="text-slate-500">{formData.date}</span>
                  <span className="text-slate-600">|</span>
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

              {/* Diagnostic Code Display */}
              {formData.diagnosis && (
                <div>
                  <span className="text-[9px] text-primary font-bold uppercase tracking-wider">Diagnostic Code</span>
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
                  <p className="text-slate-300 text-sm">{formData.notes || 'No notes provided.'}</p>
                </div>
              )}
              {formData.submissionType === 'interesting_case' && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Notes</span>
                  <p className="text-slate-400 text-xs italic">"{formData.notes}"</p>
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
  );
};

export default UploadScreen;
