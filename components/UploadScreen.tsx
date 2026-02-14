
import React, { useState, useRef, useEffect } from 'react';
import { generateCasePDF } from '../services/pdfService';
import { supabase } from '../services/supabase';
import { generateViberText } from '../utils/formatters';

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

interface ImageUpload {
  url: string;
  file: File;
  description: string;
}

const UploadScreen: React.FC = () => {
  const [formData, setFormData] = useState({
    initials: '',
    age: '',
    sex: 'M',
    modality: '',
    organSystem: 'Neuroradiology', // Default
    findings: '',
    impression: '', // Diagnosis
    notes: '' // Bite-sized notes
  });

  const [customTitle, setCustomTitle] = useState('');
  const [images, setImages] = useState<ImageUpload[]>([]);
  const [step, setStep] = useState(1); // 1: Input, 2: Result
  const [uploaderName, setUploaderName] = useState<string>('');
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
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
      alert("Maximum of 8 images allowed. Some images may have been skipped.");
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
      alert("Please upload at least one image.");
      return;
    }
    setStep(2);
  };

  const handleCopyToViber = () => {
    const text = generateViberText({ ...formData, organ: formData.organSystem }); // Backward compat if needed
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard! Ready to paste into Viber.');
    });
  };

  const handleSave = async () => {
    if (images.length === 0 || !formData.initials) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      // 1. Upload Images Loop
      const uploadedUrls: string[] = [];
      const imageMetadata = images.map(img => ({ description: img.description }));

      for (let i = 0; i < images.length; i++) {
        // We already have the file object in state
        const blob = images[i].file;
        const fileName = `${user.id}/${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}.png`;

        const { error: uploadError } = await supabase.storage
          .from('case-images')
          .upload(fileName, blob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('case-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      // 2. Insert Case
      const { error: insertError } = await supabase
        .from('cases')
        .insert({
          title: customTitle || `Case: ${formData.initials}`,
          clinical_history: formData.notes,
          findings: formData.findings,
          image_url: uploadedUrls[0], // Primary thumbnail
          image_urls: uploadedUrls,   // All images
          difficulty: 'Medium',
          created_by: user.id,
          category: formData.organSystem,
          organ_system: formData.organSystem,
          analysis_result: {
            modality: formData.modality,
            anatomy_region: formData.organSystem,
            keyFindings: [formData.findings],
            impression: formData.impression,
            educationalSummary: formData.notes,
            imagesMetadata: imageMetadata // Store descriptions here
          },
          modality: formData.modality,
          anatomy_region: formData.organSystem,
          status: 'published'
        });

      if (insertError) throw insertError;

      alert('Case saved successfully!');
      setStep(1);
      setFormData({
        initials: '',
        age: '',
        sex: 'M',
        modality: '',
        organSystem: 'Neuroradiology',
        findings: '',
        impression: '',
        notes: ''
      });
      setImages([]);
      setCustomTitle('');

    } catch (error: any) {
      console.error('Error saving case:', error);
      alert('Failed to save case: ' + error.message);
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

  return (
    <div className="flex flex-col h-full bg-[#050B14] relative">
      {/* Screenshot Overlay */}
      {isScreenshotMode && (
        <div className="fixed inset-0 z-[100] bg-[#050B14] p-6 flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-y-auto">
          {/* Exit Button - Floating */}
          <button
            onClick={() => setIsScreenshotMode(false)}
            className="fixed top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all z-50 backdrop-blur-md">
            <span className="material-icons">close</span>
          </button>

          <div className="w-full max-w-md space-y-6 my-auto">
            <header className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white tracking-tight">{customTitle || 'Case Report'}</h1>
              <p className="text-sm font-medium text-slate-400">
                {formData.initials} • {formData.age} / {formData.sex}
              </p>
            </header>

            {/* Grid of Images */}
            <div className="grid grid-cols-2 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black/50">
                  <img src={img.url} className="w-full h-full object-cover" alt="" />
                  {img.description && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-md p-2">
                      <p className="text-[10px] text-white font-medium text-center truncate">{img.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="glass-card-enhanced p-4 rounded-2xl space-y-3 bg-white/[0.03]">
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Impression</span>
                <p className="text-white text-sm font-medium mt-0.5">{formData.impression}</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Modality</span>
                <p className="text-slate-300 text-xs mt-0.5">{formData.modality} - {formData.organSystem}</p>
              </div>
            </div>

            <footer className="pt-4 text-center">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">CHH Radiology App</p>
            </footer>
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
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {step === 1 ? 'Data Entry' : 'Export'}
          </span>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar ${isScreenshotMode ? 'hidden' : ''}`}>
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <header>
              <input
                type="text"
                value={customTitle}
                onChange={handleTitleChange}
                placeholder="Enter Case Title..."
                className="text-2xl font-bold text-white bg-transparent border-none focus:ring-0 placeholder-slate-600 w-full p-0"
              />
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
                            className="w-full bg-black/20 border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:border-primary transition-all"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 text-center italic">Scroll to view all images</p>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card-enhanced p-5 rounded-2xl space-y-4">
              {/* Row 1: Initials, Age, Sex */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Initials</label>
                  <input name="initials" value={formData.initials} onChange={handleInputChange} placeholder="Pt Initials" className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary transition-all" />
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Age</label>
                  <input type="number" name="age" value={formData.age} onChange={handleInputChange} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary transition-all" />
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Sex</label>
                  <select name="sex" value={formData.sex} onChange={handleInputChange} className="w-full bg-white/5 border-white/10 rounded-xl px-2 py-2 text-sm text-white focus:border-primary appearance-none text-center">
                    <option value="M" className="bg-[#0c1829]">M</option>
                    <option value="F" className="bg-[#0c1829]">F</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Modality, Organ System */}
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Modality</label>
                  <input name="modality" value={formData.modality} onChange={handleInputChange} placeholder="CT, MRI..." className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Organ System</label>
                  <select name="organSystem" value={formData.organSystem} onChange={handleInputChange} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary appearance-none">
                    {ORGAN_SYSTEMS.map(os => (
                      <option key={os} value={os} className="bg-[#0c1829]">{os}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Findings */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Findings</label>
                <textarea name="findings" value={formData.findings} onChange={handleInputChange} rows={3} placeholder="Key observations..." className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary transition-all resize-none" />
              </div>

              {/* Row 4: Impression */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Impression</label>
                <input name="impression" value={formData.impression} onChange={handleInputChange} placeholder="Diagnosis" className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary transition-all" />
              </div>

              {/* Row 5: Notes */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="Bite-sized interesting facts..." className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary transition-all resize-none" />
              </div>
            </div>

            <button onClick={handleGenerateReport} disabled={!formData.initials} className="w-full py-4 bg-primary text-white rounded-2xl font-bold transition-all shadow-[0_10px_20px_-5px_rgba(13,162,231,0.4)] disabled:opacity-30 flex items-center justify-center gap-2">
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
                <p className="text-slate-500 text-xs text-emerald-400">Ready to Share</p>
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
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Patient</span>
                  <p className="text-white text-sm font-bold">{formData.initials} ({formData.age}/{formData.sex})</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Modality</span>
                  <p className="text-white text-sm font-bold">{formData.modality} - {formData.organSystem}</p>
                </div>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-bold">Impression</span>
                <p className="text-white text-sm font-medium">{formData.impression}</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-bold">Notes</span>
                <p className="text-slate-400 text-xs italic">"{formData.notes}"</p>
              </div>
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

              <button onClick={() => {
                console.log('Export button clicked');
                try {
                  generateCasePDF(formData, null, getImagesForPdf(), customTitle, uploaderName);
                } catch (e) {
                  console.error('Export failed immediately:', e);
                  alert('Export failed: ' + e);
                }
              }} className="w-full py-4 glass-card-enhanced text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 hover:bg-white/5">
                <span className="material-icons text-rose-500">picture_as_pdf</span>
                Export to Drive (PDF)
              </button>

              <button onClick={handleSave} className="w-full py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors">
                Save to Profile Only
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadScreen;
