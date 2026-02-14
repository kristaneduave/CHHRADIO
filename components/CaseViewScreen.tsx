import React, { useState, useEffect } from 'react';
import { generateCasePDF } from '../services/pdfService';
import { generateViberText } from '../utils/formatters';
import { supabase } from '../services/supabase';

interface CaseViewScreenProps {
    caseData: any;
    onBack: () => void;
    onEdit: () => void;
}

const CaseViewScreen: React.FC<CaseViewScreenProps> = ({ caseData, onBack, onEdit }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isOwner, setIsOwner] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'discussion'>('details');

    useEffect(() => {
        checkOwnership();
    }, [caseData]);

    const checkOwnership = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && caseData.created_by === user.id) {
            setIsOwner(true);
        }
    };

    const images = caseData.image_urls || [caseData.image_url].filter(Boolean);
    const reliabilityColor = {
        'Certain': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        'Probable': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        'Possible': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        'Unlikely': 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    }[caseData.analysis_result?.reliability || 'Certain'];

    const handleCopyToViber = () => {
        // Map DB fields to formatter expectation
        const formattedData = {
            initials: caseData.patient_initials,
            age: caseData.patient_age,
            sex: caseData.patient_sex,
            modality: caseData.modality,
            organSystem: caseData.organ_system,
            findings: caseData.findings,
            impression: caseData.analysis_result?.impression || caseData.diagnosis, // Fallback
            reliability: caseData.analysis_result?.reliability,
            notes: caseData.clinical_history
        };
        const text = generateViberText(formattedData);
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard! Ready to paste into Viber.');
        });
    };

    const handleExportPDF = () => {
        // Prepare images with descriptions
        const pdfImages = images.map((url: string, idx: number) => ({
            url,
            description: caseData.analysis_result?.imagesMetadata?.[idx]?.description || ''
        }));

        const formattedData = {
            initials: caseData.patient_initials,
            age: caseData.patient_age,
            sex: caseData.patient_sex,
            modality: caseData.modality,
            organSystem: caseData.organ_system,
            findings: caseData.findings,
            impression: caseData.analysis_result?.impression || caseData.diagnosis,
            reliability: caseData.analysis_result?.reliability,
            notes: caseData.clinical_history
        };

        try {
            generateCasePDF(formattedData, null, pdfImages, caseData.title, 'Radiologist');
        } catch (e: any) {
            alert('Export failed: ' + e.message);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#050B14] relative overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="px-6 pt-12 pb-4 flex items-center justify-between z-10 bg-[#050B14]/80 backdrop-blur-md sticky top-0">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                >
                    <span className="material-icons text-lg">arrow_back</span>
                </button>

                <div className="text-center">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Diagnostic Code</div>
                    <div className="text-lg font-mono font-bold text-primary tracking-widest">{caseData.diagnosis || 'PENDING'}</div>
                </div>

                <div className="w-10 h-10 flex items-center justify-center">
                    {isOwner && (
                        <button
                            onClick={onEdit}
                            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
                            title="Edit Case"
                        >
                            <span className="material-icons text-lg">edit</span>
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Hero Section - Image Gallery */}
                <div className="relative w-full aspect-[4/3] bg-black group bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
                    {images.length > 0 ? (
                        <>
                            <img
                                src={images[currentImageIndex]}
                                className="w-full h-full object-contain"
                                alt="Case Scan"
                            />

                            {/* Image Navigation Overlays */}
                            {images.length > 1 && (
                                <>
                                    <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2 z-10">
                                        {images.map((_: any, idx: number) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentImageIndex(idx)}
                                                className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-primary w-4' : 'bg-white/30 hover:bg-white/50'}`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="material-icons text-sm">chevron_left</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="material-icons text-sm">chevron_right</span>
                                    </button>
                                </>
                            )}

                            {/* Image Description Overlay */}
                            {caseData.analysis_result?.imagesMetadata?.[currentImageIndex]?.description && (
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-12">
                                    <p className="text-sm text-white font-medium text-center">
                                        {caseData.analysis_result.imagesMetadata[currentImageIndex].description}
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <div className="text-center">
                                <span className="material-icons text-4xl mb-2">image_not_supported</span>
                                <p className="text-xs">No images available</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Case Details Container */}
                <div className="px-6 py-6 space-y-8">

                    {/* Header Info */}
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2 leading-tight">
                                {caseData.title || `Case ${caseData.patient_initials}`}
                            </h1>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="px-2 py-1 rounded-md bg-white/5 text-slate-300 border border-white/5 font-medium">
                                    {caseData.modality}
                                </span>
                                <span className="px-2 py-1 rounded-md bg-white/5 text-slate-300 border border-white/5 font-medium">
                                    {caseData.organ_system}
                                </span>
                                <span className="text-slate-500">{new Date(caseData.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${reliabilityColor}`}>
                            {caseData.analysis_result?.reliability || 'Certain'}
                        </div>
                    </div>

                    {/* Patient Demographics */}
                    <div className="glass-card-enhanced p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-blue-600/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                {caseData.patient_sex || '?'}
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Patient</div>
                                <div className="text-white font-bold">{caseData.patient_initials} <span className="text-slate-500 font-normal">| {caseData.patient_age} yo</span></div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status</div>
                            <div className="text-emerald-400 font-bold flex items-center justify-end gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Published
                            </div>
                        </div>
                    </div>

                    {/* Main Content Tabs (Optional visual separation) */}
                    <div className="space-y-6">

                        {/* Findings */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons text-sm">search</span>
                                Findings
                            </h3>
                            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line pl-4 border-l-2 border-white/10">
                                {caseData.findings || "No findings recorded."}
                            </div>
                        </div>

                        {/* Vertical Divider */}
                        <div className="h-px w-full bg-white/5"></div>

                        {/* Impression */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons text-sm">lightbulb</span>
                                Impression
                            </h3>
                            <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-xl p-4">
                                <p className="text-base font-bold text-white leading-relaxed">
                                    {caseData.analysis_result?.impression || caseData.diagnosis || "Pending Diagnosis"}
                                </p>
                            </div>
                        </div>

                        {/* Notes */}
                        {caseData.clinical_history && (
                            <div className="space-y-2 pt-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="material-icons text-sm">sticky_note_2</span>
                                    Clinical Notes
                                </h3>
                                <p className="text-xs text-slate-400 italic leading-relaxed pl-4">
                                    "{caseData.clinical_history}"
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4 pt-4 pb-12">
                        <button
                            onClick={handleCopyToViber}
                            className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-[#7360f2]/10 text-[#7360f2] hover:bg-[#7360f2]/20 border border-[#7360f2]/20 transition-all font-bold text-xs uppercase tracking-wider group"
                        >
                            <span className="material-icons group-hover:scale-110 transition-transform">content_copy</span>
                            Copy for Viber
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 transition-all font-bold text-xs uppercase tracking-wider group"
                        >
                            <span className="material-icons group-hover:scale-110 transition-transform">picture_as_pdf</span>
                            Export PDF
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CaseViewScreen;
