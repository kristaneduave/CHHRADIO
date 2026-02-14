
import React, { useState, useCallback, useRef } from 'react';
import { analyzeMedicalImage } from '../services/geminiService';
import { CaseData, AnalysisResult } from '../types';
import { generateCasePDF } from '../services/pdfService';
import { supabase } from '../services/supabase';


const SPECIALTIES = [
  'Neuroradiology',
  'Gastrointestinal',
  'Cardiology',
  'Orthopedics',
  'Pulmonology',
  'Emergency Medicine',
  'Oncology'
];

const UploadScreen: React.FC = () => {
  const [caseData, setCaseData] = useState<CaseData>({
    initials: '',
    age: '',
    isPediatric: false,
    specialty: 'Neuroradiology',
    clinicalHistory: '',
    findings: ''
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [step, setStep] = useState(1); // 1: Info, 2: Upload/Camera, 3: Result
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setCaseData(prev => ({ ...prev, [name]: val }));
  };

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setIsCameraActive(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
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
      setPreview(dataUrl);
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

  const handleAnalyze = async () => {
    if (!preview) return;
    setIsAnalyzing(true);
    const base64Data = preview.split(',')[1];
    const result = await analyzeMedicalImage(base64Data, caseData);

    if (!result) {
      setAnalysis({
        keyFindings: ["AI Analysis Unavailable (Key missing or error)"],
        differentials: [],
        planOfCare: [],
        educationalSummary: "Please configure the Gemini API Key to enable AI analysis.",
        severity: "Routine"
      });
      setIsAnalyzing(false);
      return;
    }

    setAnalysis(result);
    setIsAnalyzing(false);
    if (result) setStep(3);
  };

  const handleSave = async () => {
    if (!preview || !analysis || !caseData.initials) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      // 1. Upload Image
      const response = await fetch(preview);
      const blob = await response.blob();
      const fileName = `${user.id}/${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('case-images')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('case-images')
        .getPublicUrl(fileName);

      // 2. Insert Case
      const { error: insertError } = await supabase
        .from('cases')
        .insert({
          title: `Case: ${caseData.initials}`,
          clinical_history: caseData.clinicalHistory,
          findings: caseData.findings,
          image_url: publicUrl,
          difficulty: analysis.severity === 'Critical' ? 'Hard' : analysis.severity === 'Urgent' ? 'Medium' : 'Easy',
          created_by: user.id,
          category: caseData.specialty,
          analysis_result: analysis,
          modality: analysis.modality,
          anatomy_region: analysis.anatomy_region,
          teaching_points: JSON.stringify(analysis.teachingPoints), // Note: Storing as JSON string if text array not supported directly or use text[]
          pearl: analysis.pearl,
          red_flags: JSON.stringify(analysis.redFlags), // Same logic
          status: 'published' // Default to published for now, or add toggle
        });

      if (insertError) throw insertError;

      alert('Case saved successfully!');
      setStep(1);
      setCaseData({
        initials: '',
        age: '',
        isPediatric: false,
        specialty: 'Neuroradiology',
        clinicalHistory: '',
        findings: ''
      });
      setPreview(null);
      setAnalysis(null);

    } catch (error: any) {
      console.error('Error saving case:', error);
      alert('Failed to save case: ' + error.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050B14]">
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .scanner-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, transparent, #0da2e7, transparent);
          box-shadow: 0 0 20px 4px rgba(13, 162, 231, 0.9);
          animation: scan 3s ease-in-out infinite;
          z-index: 50;
        }
        .pulse-border {
          animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-ring {
          0%, 100% { border-color: rgba(13, 162, 231, 0.2); }
          50% { border-color: rgba(13, 162, 231, 0.8); }
        }
      `}</style>

      {/* Modern Stepper */}
      <div className="px-6 pt-12 flex justify-between items-center mb-8 shrink-0">
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-primary shadow-[0_0_10px_rgba(13,162,231,0.5)]' : 'w-4 bg-white/10'}`} />
          ))}
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {step === 1 ? 'Patient Data' : step === 2 ? 'Diagnostic Imaging' : 'Clinical Report'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <header>
              <h1 className="text-2xl font-bold text-white mb-1">Case Profile</h1>
              <p className="text-slate-500 text-xs">Establish the clinical baseline</p>
            </header>

            <div className="glass-card-enhanced p-5 rounded-2xl space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Initials</label>
                  <input name="initials" value={caseData.initials} onChange={handleInputChange} placeholder="E.G. J.W." className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Age</label>
                  <input type="number" name="age" value={caseData.age} onChange={handleInputChange} placeholder="Years" className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Clinical Specialty</label>
                <select name="specialty" value={caseData.specialty} onChange={handleInputChange} className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary appearance-none">
                  {SPECIALTIES.map(s => <option key={s} value={s} className="bg-[#0c1829]">{s}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">History & Symptoms</label>
                <textarea name="clinicalHistory" value={caseData.clinicalHistory} onChange={handleInputChange} rows={4} placeholder="Summary of presentation..." className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary transition-all resize-none" />
              </div>
            </div>

            <button onClick={() => setStep(2)} disabled={!caseData.initials || !caseData.age || !caseData.clinicalHistory} className="w-full py-4 bg-primary text-white rounded-2xl font-bold transition-all shadow-[0_10px_20px_-5px_rgba(13,162,231,0.4)] disabled:opacity-30 flex items-center justify-center gap-2">
              Next Step
              <span className="material-icons text-sm">arrow_forward</span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Diagnostic Input</h1>
                <p className="text-slate-500 text-xs">Capture or upload clinical studies</p>
              </div>
              <button onClick={() => setStep(1)} className="text-[10px] font-bold text-slate-500 uppercase hover:text-white transition-colors">Edit Profile</button>
            </header>

            {!preview && !isCameraActive ? (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={startCamera} className="glass-card-enhanced aspect-[3/4] rounded-2xl flex flex-col items-center justify-center gap-3 group hover:border-primary/50 transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <span className="material-icons text-2xl">camera_alt</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">Open Camera</span>
                </button>
                <div className="relative glass-card-enhanced aspect-[3/4] rounded-2xl flex flex-col items-center justify-center gap-3 group hover:border-primary/50 transition-all overflow-hidden">
                  <input type="file" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                    <span className="material-icons text-2xl">file_upload</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">Upload File</span>
                </div>
              </div>
            ) : isCameraActive ? (
              <div className="relative glass-card-enhanced rounded-2xl overflow-hidden aspect-[3/4] border-2 border-primary/30 pulse-border">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-6 flex justify-center items-center gap-8">
                  <button onClick={stopCamera} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center">
                    <span className="material-icons">close</span>
                  </button>
                  <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-primary/30 flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
                    <div className="w-12 h-12 rounded-full border-2 border-slate-200" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative glass-card-enhanced rounded-2xl overflow-hidden shadow-2xl">
                  <img src={preview!} alt="Preview" className="w-full h-80 object-contain bg-black" />
                  <button onClick={() => setPreview(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-rose-500/80 text-white flex items-center justify-center"><span className="material-icons text-sm">close</span></button>
                  {isAnalyzing && <div className="scanner-line" />}
                </div>

                <div className="glass-card-enhanced p-5 rounded-2xl space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Radiologist's Findings (Optional)</label>
                  <textarea name="findings" value={caseData.findings} onChange={handleInputChange} rows={3} placeholder="Initial observations to context the AI..." className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary transition-all resize-none" />
                </div>

                <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full py-5 bg-gradient-to-r from-primary to-blue-600 text-white rounded-2xl font-bold shadow-[0_10px_30px_-5px_rgba(13,162,231,0.5)] flex items-center justify-center gap-3 disabled:opacity-50">
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing Sequence...
                    </>
                  ) : (
                    <>
                      <span className="material-icons">auto_awesome</span>
                      Perform Clinical Analysis
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && analysis && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500 pb-12">
            <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-white mb-0.5">Clinical Report</h1>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${analysis.severity === 'Critical' ? 'bg-rose-500 text-white' :
                    analysis.severity === 'Urgent' ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-white'
                    }`}>
                    {analysis.severity}
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Educational Review</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => generateCasePDF(caseData, analysis, preview)} className="w-10 h-10 rounded-full glass-card-enhanced flex items-center justify-center text-slate-400 hover:text-white transition-colors" title="Download PDF">
                  <span className="material-icons">picture_as_pdf</span>
                </button>
                <button onClick={() => setStep(2)} className="w-10 h-10 rounded-full glass-card-enhanced flex items-center justify-center text-slate-400"><span className="material-icons">close</span></button>
              </div>
            </header>

            <div className="glass-card-enhanced p-5 rounded-2xl border-primary/20 bg-primary/[0.02]">
              <p className="text-sm text-slate-300 leading-relaxed italic">
                "{analysis.educationalSummary}"
              </p>
            </div>

            <div className="space-y-6">
              <section>
                <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="material-icons text-sm">visibility</span>
                  Key Findings
                </h3>
                <div className="space-y-2">
                  {analysis.keyFindings.map((f, i) => (
                    <div key={i} className="flex gap-3 items-start glass-card-enhanced p-3 rounded-xl border-white/5">
                      <span className="text-primary mt-0.5 material-icons text-xs">radio_button_checked</span>
                      <p className="text-xs text-slate-300 leading-normal">{f}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="material-icons text-sm">account_tree</span>
                  Differential Diagnosis
                </h3>
                <div className="space-y-3">
                  {analysis.differentials.map((d, i) => (
                    <div key={i} className="glass-card-enhanced rounded-xl overflow-hidden border-white/5">
                      <div className="p-3 bg-white/[0.02] flex justify-between items-center border-b border-white/5">
                        <span className="text-xs font-bold text-white">{d.condition}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${d.confidence > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${d.confidence}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-slate-500">{d.confidence}%</span>
                        </div>
                      </div>
                      <p className="p-3 text-[11px] text-slate-400 leading-normal italic">{d.rationale}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="material-icons text-sm">medical_services</span>
                  Proposed Care Path
                </h3>
                <div className="space-y-2">
                  {analysis.planOfCare.map((step, i) => (
                    <div key={i} className="flex items-center gap-4 glass-card-enhanced p-3 rounded-xl border-white/5">
                      <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold">
                        {i + 1}
                      </div>
                      <p className="text-xs text-slate-200">{step}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Enhanced Educational Content */}
              {(analysis.pearl || analysis.teachingPoints) && (
                <section>
                  <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <span className="material-icons text-sm">school</span>
                    Educational Pearls
                  </h3>
                  <div className="glass-card-enhanced p-4 rounded-xl border-indigo-500/20 bg-indigo-500/5 space-y-4">
                    {analysis.pearl && (
                      <div className="flex gap-3">
                        <span className="text-xl">💡</span>
                        <div>
                          <span className="text-xs font-bold text-white block mb-1">Clinical Pearl</span>
                          <p className="text-xs text-slate-300 italic">{analysis.pearl}</p>
                        </div>
                      </div>
                    )}
                    {analysis.teachingPoints && (
                      <div className="space-y-2 pt-2 border-t border-indigo-500/10">
                        <span className="text-xs font-bold text-white block">Key Takeaways</span>
                        <ul className="list-disc list-inside space-y-1">
                          {analysis.teachingPoints.map((tp, i) => (
                            <li key={i} className="text-xs text-slate-300">{tp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}

            </div>

            <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl">
              <p className="text-[9px] text-rose-300 font-medium leading-normal text-center uppercase tracking-wider">
                Simulation Only. Not for clinical diagnosis. Consult attending physician.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-4 glass-card-enhanced rounded-2xl text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-white transition-all">New Case</button>
              <button onClick={handleSave} className="flex-2 py-4 bg-primary text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-blue-600 transition-colors">Save Record</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadScreen;
