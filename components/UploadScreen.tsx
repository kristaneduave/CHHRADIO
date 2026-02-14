
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
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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
        setIsCameraActive(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const startCamera = async () => {
    if (previews.length >= 8) {
      alert("Maximum of 8 images allowed.");
      return;
    }
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setPreviews(prev => [...prev, dataUrl]);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraActive(false);
    }
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
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Images ({previews.length}/8)</span>
                {previews.length === 0 && <span className="text-[10px] text-rose-500">*Required</span>}
              </div>

              {isCameraActive ? (
                <div className="relative glass-card-enhanced rounded-2xl overflow-hidden aspect-video border-2 border-primary/30">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-4 flex justify-center items-center gap-8">
                    <button onClick={stopCamera} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center">
                      <span className="material-icons">close</span>
                    </button>
                    <button onClick={capturePhoto} className="w-14 h-14 rounded-full bg-white border-4 border-primary/30 flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
                      <div className="w-10 h-10 rounded-full border-2 border-slate-200" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                  {/* Add Button */}
                  {previews.length < 8 && (
                    <div className="shrink-0 w-24 h-24 rounded-2xl glass-card-enhanced flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/5 transition-colors snap-start" onClick={() => { }}>
                      <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} className="hidden" accept="image/*" />
                      <div className="flex gap-2">
                        <button onClick={startCamera} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"><span className="material-icons text-sm">camera_alt</span></button>
                        <button onClick={triggerFileInput} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"><span className="material-icons text-sm">upload</span></button>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 mt-1">Add Image</span>
                    </div>
                  )}

                  {/* Previews */}
                  {previews.map((src, idx) => (
                    <div key={idx} className="shrink-0 w-24 h-24 rounded-2xl relative group snap-start">
                      <img src={src} className="w-full h-full object-cover rounded-2xl border border-white/10" alt={`Scan ${idx}`} />
                      <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md">
                        <span className="material-icons text-[10px]">close</span>
                      </button>
                    </div>
                  ))}
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

              <button onClick={() => generateCasePDF(formData, null, previews)} className="w-full py-4 glass-card-enhanced text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 hover:bg-white/5">
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
