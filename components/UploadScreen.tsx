
import React, { useState, useRef, useEffect } from 'react';
import { loadGenerateCasePDF } from '../services/pdfServiceLoader';
import { supabase } from '../services/supabase';
import { createSystemNotification, fetchAllRecipientUserIds } from '../services/newsfeedService';
import { generateViberText } from '../utils/formatters';
import { SubmissionType } from '../types';
import { toastError, toastSuccess, toastInfo } from '../utils/toast';

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

interface ImageUpload {
  url: string;
  file: File;
  description: string;
}

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
    organSystem: existingCase?.anatomy_region || 'Neuroradiology',
    clinicalData: existingCase?.clinical_history || '',
    findings: existingCase?.findings || '',
    impression: existingCase?.analysis_result?.impression || '',
    notes: existingCase?.educational_summary || '', // Mapped to educational_summary for notes
    radiologicClinchers: existingCase?.radiologic_clinchers || '',
    diagnosis: existingCase?.diagnosis || '',
    date: existingCase?.analysis_result?.studyDate || new Date().toISOString().split('T')[0]
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const newImages: ImageUpload[] = [];
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

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      // Auto-generate Diagnostic Code if publishing and doesn't exist
      let finalDiagnosis = formData.diagnosis;
      if (status === 'published' && !finalDiagnosis) {
        // Generate random 6-digit code prepended with RAD
        finalDiagnosis = 'RAD-' + Math.floor(100000 + Math.random() * 900000).toString();
        // Update state to reflect it immediately in UI
        setFormData(prev => ({ ...prev, diagnosis: finalDiagnosis }));
      }

      // 1. Upload New Images (Skip existing ones)
      const distinctUploadedUrls: string[] = [];

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.file.size === 0 && img.url.startsWith('http')) {
          // Existing image
          distinctUploadedUrls.push(img.url);
        } else {
          // New image
          const blob = img.file;
          const fileName = `${user.id}/${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}.png`;

          const { error: uploadError } = await supabase.storage
            .from('case-images')
            .upload(fileName, blob);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('case-images')
            .getPublicUrl(fileName);

          distinctUploadedUrls.push(publicUrl);
        }
      }

      const imageMetadata = images.map(img => ({ description: img.description }));

      const isMinimalSubmission = formData.submissionType === 'rare_pathology' || formData.submissionType === 'aunt_minnie';
      const casePayload = {
        title: customTitle
          || (formData.submissionType === 'rare_pathology' ? 'Rare Pathology Case' : formData.submissionType === 'aunt_minnie' ? 'Aunt Minnie Case' : `Case: ${formData.initials}`),
        patient_initials: isMinimalSubmission ? null : formData.initials, // Ensure these match DB columns
        patient_age: isMinimalSubmission ? null : formData.age,
        patient_sex: isMinimalSubmission ? null : formData.sex,
        clinical_history: formData.submissionType === 'aunt_minnie' ? null : formData.clinicalData, // Updated to use clinicalData
        educational_summary: formData.submissionType === 'rare_pathology' ? null : formData.notes, // Keep notes for Aunt Minnie and Interesting Case
        radiologic_clinchers: formData.submissionType === 'rare_pathology' ? formData.radiologicClinchers : null,
        submission_type: formData.submissionType,
        findings: formData.findings,
        image_url: distinctUploadedUrls[0], // Primary thumbnail
        image_urls: distinctUploadedUrls,   // All images
        difficulty: 'Medium',
        created_by: user.id,
        category: isMinimalSubmission ? null : formData.organSystem,
        organ_system: isMinimalSubmission ? null : formData.organSystem,
        diagnosis: finalDiagnosis, // Save generated or existing code
        analysis_result: {
          modality: isMinimalSubmission ? null : formData.modality,
          anatomy_region: isMinimalSubmission ? null : formData.organSystem,
          keyFindings: [formData.findings],
          impression: isMinimalSubmission ? null : formData.impression,
          educationalSummary: formData.submissionType === 'rare_pathology' ? null : formData.notes,
          imagesMetadata: imageMetadata, // Store descriptions here
          studyDate: formData.date
        },
        modality: isMinimalSubmission ? null : formData.modality,
        status: status
      };

      const writeCase = async (payload: any): Promise<{ id: string | null; error: any }> => {
        if (existingCase?.id) {
          const { error: updateError } = await supabase
            .from('cases')
            .update(payload)
            .eq('id', existingCase.id);
          return { id: existingCase.id, error: updateError };
        }
        const { data: insertedCase, error: insertError } = await supabase
          .from('cases')
          .insert(payload)
          .select('id')
          .single();
        return { id: insertedCase?.id || null, error: insertError };
      };

      let { id: savedCaseId, error } = await writeCase(casePayload);
      if (error) {
        const message = String(error?.message || '');
        const missingNewColumns =
          message.includes("radiologic_clinchers")
          || message.includes("submission_type")
          || message.includes("schema cache");

        if (missingNewColumns) {
          // Backward-compatible fallback for older schemas: only Interesting Case can proceed.
          if (formData.submissionType !== 'interesting_case') {
            toastError(
              'Database migration required',
              'Please run the latest Supabase migration to use Rare Pathology and Aunt Minnie.'
            );
            return;
          }

          const { radiologic_clinchers, submission_type, ...legacyPayload } = casePayload as any;
          void radiologic_clinchers;
          void submission_type;
          const legacyWrite = await writeCase(legacyPayload);
          savedCaseId = legacyWrite.id;
          error = legacyWrite.error;
        }
      }

      if (error) throw error;

      if (status === 'published') {
        try {
          const recipients = await fetchAllRecipientUserIds();
          const submissionLabel =
            formData.submissionType === 'rare_pathology'
              ? 'Rare Pathology'
              : formData.submissionType === 'aunt_minnie'
                ? 'Aunt Minnie'
                : 'Interesting Case';
          await createSystemNotification({
            actorUserId: user.id,
            type: formData.submissionType,
            severity: 'info',
            title: existingCase?.id ? 'Case Updated' : 'New Case Uploaded',
            message: `${submissionLabel}: ${customTitle || casePayload.title}`,
            linkScreen: 'search',
            linkEntityId: savedCaseId || undefined,
            recipientUserIds: recipients.length > 0 ? recipients : [user.id],
          });
        } catch (notifError) {
          console.error('Failed to emit case notification:', notifError);
        }
      }

      if (status === 'published') {
        toastSuccess('Case published', `Diagnostic Code: ${finalDiagnosis}`);
      } else {
        toastSuccess('Private draft saved');
      }

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
          diagnosis: '',
          date: new Date().toISOString().split('T')[0]
        });
        setImages([]);
        setCustomTitle('');
      }

    } catch (error: any) {
      console.error('Error saving case:', error);
      toastError('Failed to save case', error.message);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  }

  // Helper to extract visuals for PDF service
  const getImagesForPdf = () => {
    return images.map(img => ({
      url: img.url,
      description: img.description
    }));
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const generateCasePDF = await loadGenerateCasePDF().catch((error) => {
        throw new Error(`Unable to load export module: ${String(error)}`);
      });
      const extendedData = {
        ...formData
      };
      generateCasePDF(extendedData, null, getImagesForPdf(), customTitle, uploaderName);
    } catch (e) {
      console.error('Export failed:', e);
      const message = e instanceof Error ? e.message : String(e);
      const title = message.includes('Unable to load export module') ? 'Unable to load export module' : 'Export failed';
      toastError(title, message);
    } finally {
      setIsExportingPdf(false);
    }
  };

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
            <header className="text-center flex flex-row items-center justify-center gap-3">
              <h1 className="text-3xl font-bold text-white tracking-tight leading-none pt-1">{customTitle || 'Case Report'}</h1>
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

          </div>
        </div>
      )}

      {/* Modern Stepper (Hidden in Screenshot Mode) */}
      {!isScreenshotMode && (
        <div className="px-6 pt-12 flex justify-between items-center mb-4 shrink-0">
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
            <header className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, submissionType: 'interesting_case' }))}
                  className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                    formData.submissionType === 'interesting_case'
                      ? 'bg-primary text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  Interesting Case
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, submissionType: 'rare_pathology' }))}
                  className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                    formData.submissionType === 'rare_pathology'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  Rare Pathology
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, submissionType: 'aunt_minnie' }))}
                  className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                    formData.submissionType === 'aunt_minnie'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  Aunt Minnie
                </button>
              </div>
              <input
                type="text"
                value={customTitle}
                onChange={handleTitleChange}
                placeholder={formData.submissionType === 'rare_pathology' ? 'Enter Pathology Name...' : formData.submissionType === 'aunt_minnie' ? 'Enter Aunt Minnie Title...' : 'Enter Case Title...'}
                autoComplete="off"
                className="text-2xl font-bold text-white bg-transparent border-none focus:ring-0 placeholder-slate-600 w-full p-0"
              />

              {/* Date Row */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-base md:text-xs text-white focus:border-primary transition-all max-w-[130px]"
                  />
                </div>
              </div>
            </header>

            {/* Multi-Image Gallery */}
            <div className="space-y-4">
              {/* Clean, Large Upload Area */}
              {images.length === 0 ? (
                <div
                  onClick={triggerFileInput}
                  className="w-full aspect-video border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => processFiles(e.target.files)}
                    className="hidden"
                    accept="image/*"
                    multiple // Enable multiple files
                  />
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-icons text-3xl">add_photo_alternate</span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">Tap into Upload Images</p>
                    <p className="text-xs text-slate-500 mt-1">Select multiple (Max 8)</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Horizontal Scroll Gallery */}
                  <div className="flex flex-col gap-4">
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                      {images.length < 8 && (
                        <div
                          onClick={triggerFileInput}
                          className="shrink-0 w-40 h-56 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all snap-start"
                        >
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => processFiles(e.target.files)}
                            className="hidden"
                            accept="image/*"
                            multiple
                          />
                          <span className="material-icons text-primary/50 text-2xl">add</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Add New</span>
                        </div>
                      )}

                      {images.map((img, idx) => (
                        <div key={idx} className="shrink-0 w-48 bg-white/5 rounded-2xl p-2 snap-start">
                          <div className="relative w-full aspect-square mb-2 group">
                            <img src={img.url} className="w-full h-full object-cover rounded-xl border border-white/10 bg-black" alt={`Scan ${idx}`} />
                            <button onClick={(e) => { e.stopPropagation(); removeImage(idx); }} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg pointer-events-auto z-10">
                              <span className="material-icons text-[10px]">close</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={img.description}
                            onChange={(e) => handleImageDescriptionChange(idx, e.target.value)}
                            placeholder="Description..."
                            className="w-full bg-black/20 border-white/10 rounded-lg px-2 py-1.5 text-base md:text-[10px] text-white focus:border-primary transition-all"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 text-center italic">Scroll to view all images</p>
                  </div>
                </div>
              )}
              {fieldErrors.images && (
                <p className="text-[10px] text-rose-400">{fieldErrors.images}</p>
              )}
            </div>

            <div className="glass-card-enhanced p-5 rounded-2xl space-y-4">
              {/* Row 1: Initials, Age, Sex */}
              {formData.submissionType === 'interesting_case' && (
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-5 space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Initials</label>
                  <input name="initials" value={formData.initials} onChange={handleInputChange} autoComplete="off" placeholder="Pt Initials" className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary transition-all" />
                  {fieldErrors.initials && <p className="text-[10px] text-rose-400">{fieldErrors.initials}</p>}
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Age</label>
                  <input type="number" name="age" value={formData.age} onChange={handleInputChange} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary transition-all" />
                </div>
                <div className="col-span-4 space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1 text-center block">Sex</label>
                  <div className="flex justify-center gap-2">
                    {['M', 'F'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setFormData(prev => ({ ...prev, sex: s }))}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${formData.sex === s ? 'bg-primary text-white shadow-lg scale-110' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              )}

              {/* Row 2: Modality, Organ System */}
              {formData.submissionType === 'interesting_case' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Modality</label>
                  <div className="relative">
                    <select name="modality" value={formData.modality} onChange={handleInputChange} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary appearance-none">
                      {MODALITIES.map(m => (
                        <option key={m} value={m} className="bg-surface text-white">{m}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <span className="material-icons text-sm">expand_more</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Organ System</label>
                  <div className="relative">
                    <select name="organSystem" value={formData.organSystem} onChange={handleInputChange} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary appearance-none">
                      {ORGAN_SYSTEMS.map(os => (
                        <option key={os} value={os} className="bg-surface text-white">{os}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <span className="material-icons text-sm">expand_more</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* New Row: Clinical Data */}
              {formData.submissionType !== 'aunt_minnie' && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Clinical Data</label>
                <textarea name="clinicalData" value={formData.clinicalData} onChange={handleInputChange} rows={2} placeholder="Patient presentation..." className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary transition-all resize-none" />
                {fieldErrors.clinicalData && <p className="text-[10px] text-rose-400">{fieldErrors.clinicalData}</p>}
              </div>
              )}

              {/* Row 3: Findings */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">{formData.submissionType === 'aunt_minnie' ? 'Description' : 'Findings'}</label>
                <textarea name="findings" value={formData.findings} onChange={handleInputChange} rows={4} placeholder={formData.submissionType === 'aunt_minnie' ? 'Enter description...' : 'Key observations...'} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary transition-all resize-none" />
                {fieldErrors.findings && <p className="text-[10px] text-rose-400">{fieldErrors.findings}</p>}
              </div>

              {formData.submissionType === 'rare_pathology' && (
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Radiologic Clinchers</label>
                  <textarea
                    name="radiologicClinchers"
                    value={formData.radiologicClinchers}
                    onChange={handleInputChange}
                    rows={2}
                    placeholder="Distinctive radiologic features..."
                    className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary transition-all resize-none"
                  />
                  {fieldErrors.radiologicClinchers && <p className="text-[10px] text-rose-400">{fieldErrors.radiologicClinchers}</p>}
                </div>
              )}

              {/* Row 4: Impression */}
              {formData.submissionType === 'interesting_case' && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Impression</label>
                <input name="impression" value={formData.impression} onChange={handleInputChange} placeholder="Diagnosis" className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary transition-all" />
              </div>
              )}

              {/* Row 5: Notes / Remarks */}
              {formData.submissionType === 'interesting_case' && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Notes / Remarks</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="Education / Extra info..." className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary transition-all resize-none" />
              </div>
              )}

              {formData.submissionType === 'aunt_minnie' && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Notes / Remarks</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="Additional notes..." className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-sm text-white focus:border-primary transition-all resize-none" />
              </div>
              )}
            </div>

            <button onClick={handleGenerateReport} disabled={images.length === 0} className="w-full py-4 bg-primary text-white rounded-2xl font-bold transition-all shadow-[0_10px_20px_-5px_rgba(13,162,231,0.4)] disabled:opacity-30 flex items-center justify-center gap-2">
              Generate Reports
              <span className="material-icons text-sm">arrow_forward</span>
            </button>
          </div>
        )}

        {step === 2 && !isScreenshotMode && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500 pb-12">
            <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-white mb-0.5">{customTitle || 'New Case'}</h1>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">{formData.date}</span>
                  {formData.submissionType === 'rare_pathology' && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span className="text-rose-300 font-bold uppercase tracking-wide">Rare Pathology</span>
                    </>
                  )}
                  {formData.submissionType === 'aunt_minnie' && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span className="text-amber-300 font-bold uppercase tracking-wide">Aunt Minnie</span>
                    </>
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
                <button onClick={() => handleSave('draft')} className="w-full py-3 text-sm font-bold text-slate-400 bg-white/5 rounded-xl hover:bg-white/10 transition-colors uppercase tracking-wider">
                  {existingCase ? 'Update Private Draft' : 'Save as Private Draft'}
                </button>
                <button onClick={() => handleSave('published')} className="w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors uppercase tracking-wider shadow-lg shadow-blue-900/20">
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

