
import React, { useState, useRef } from 'react';
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

const SEVERITIES = ['Routine', 'Urgent', 'Critical'];

const UploadScreen: React.FC = () => {
  // Flattened state for the 8 requested fields
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

  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState(1); // 1: Input, 2: Result
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const processFile = (file: File) => {
    if (previews.length >= 8) {
      alert("Maximum of 8 images allowed.");
      return;
    }
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateReport = () => {
    if (previews.length === 0) {
      alert("Please upload or capture at least one image.");
      return;
    }
    setStep(2);
  };

  const handleCopyToViber = () => {
    const text = generateViberText(formData);
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard! Ready to paste into Viber.');
    });
  };

  const handleSave = async () => {
    if (previews.length === 0 || !formData.initials) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      // 1. Upload Images Loop
      const uploadedUrls: string[] = [];

      for (let i = 0; i < previews.length; i++) {
        const response = await fetch(previews[i]);
        const blob = await response.blob();
        const fileName = `${user.id}/${Date.now()}_${i}.png`;

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
          title: `Case: ${formData.initials}`,
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
            educationalSummary: formData.notes
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
      setPreviews([]);

    } catch (error: any) {
      console.error('Error saving case:', error);
      alert('Failed to save case: ' + error.message);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  }

  return (
    <div className="flex flex-col h-full bg-[#050B14]">
      {/* Modern Stepper */}
      <div className="px-6 pt-12 flex justify-between items-center mb-8 shrink-0">
        <div className="flex gap-2">
          {[1, 2].map(i => (
            <div key={i} className={`h-1 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-primary shadow-[0_0_10px_rgba(13,162,231,0.5)]' : 'w-4 bg-white/10'}`} />
          ))}
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {step === 1 ? 'Data Entry' : 'Export'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <header>
              <h1 className="text-2xl font-bold text-white mb-1">New Case</h1>
              <p className="text-slate-500 text-xs">Enter clinical details</p>
            </header>

            {/* Multi-Image Gallery */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diagnostic Images ({previews.length}/8)</span>
                {previews.length === 0 && <span className="text-[10px] text-rose-500 font-bold uppercase">*Required</span>}
              </div>

              {/* Clean, Large Upload Area */}
              {previews.length === 0 ? (
                <div
                  onClick={triggerFileInput}
                  className="w-full aspect-video border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all group"
                >
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} className="hidden" accept="image/*" />
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-icons text-3xl">add_photo_alternate</span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">Tap to Upload Image</p>
                    <p className="text-xs text-slate-500 mt-1">Supports JPG, PNG</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Add Button for Subsequent Images (Horizontal List) */}
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                    {previews.length < 8 && (
                      <div
                        onClick={triggerFileInput}
                        className="shrink-0 w-32 h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all snap-start"
                      >
                        <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} className="hidden" accept="image/*" />
                        <span className="material-icons text-primary/50 text-2xl">add</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Add New</span>
                      </div>
                    )}

                    {previews.map((src, idx) => (
                      <div key={idx} className="shrink-0 w-32 h-32 rounded-2xl relative group snap-start shadow-lg">
                        <img src={src} className="w-full h-full object-cover rounded-2xl border border-white/10 bg-black" alt={`Scan ${idx}`} />
                        <button onClick={(e) => { e.stopPropagation(); removeImage(idx); }} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10">
                          <span className="material-icons text-xs">close</span>
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur rounded px-2 py-0.5 pointer-events-none">
                          <span className="text-[9px] font-bold text-white">Img {idx + 1}</span>
                        </div>
                      </div>
                    ))}
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

        {step === 2 && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500 pb-12">
            <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-white mb-0.5">Ready to Share</h1>
                <p className="text-slate-500 text-xs text-emerald-400">Generated successfully</p>
              </div>
              <button onClick={() => setStep(1)} className="w-10 h-10 rounded-full glass-card-enhanced flex items-center justify-center text-slate-400"><span className="material-icons">edit</span></button>
            </header>

            {/* Preview Card */}
            <div className="glass-card-enhanced p-5 rounded-2xl border-primary/20 bg-primary/[0.02] space-y-4">
              {previews.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {previews.map((src, i) => (
                    <img key={i} src={src} alt="" className="h-24 w-24 object-cover rounded-xl bg-black/40 shrink-0" />
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
              <button onClick={handleCopyToViber} className="w-full py-4 bg-[#7360f2] hover:bg-[#5e4ecc] text-white rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-3">
                <span className="material-icons">content_copy</span>
                Copy for Viber
              </button>

              <button onClick={() => {
                console.log('Export button clicked');
                try {
                  generateCasePDF(formData, null, previews);
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
