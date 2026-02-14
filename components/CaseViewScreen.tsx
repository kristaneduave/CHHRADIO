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
            notes: caseData.clinical_history,
            clinicalData: caseData.clinicalData, // Pass explicit clinicalData if exists
            pearl: caseData.pearl || caseData.analysis_result?.pearl,
            additionalNotes: caseData.notes // Attempt to pass generic notes if they exist
        };

        try {
            // Header: User input title (e.g. "SINONASAL MENINGIOMA")
            const headerTitle = (caseData.title || 'RADIOLOGY CASE').toUpperCase();

            // Filename: ORGAN SYSTEM - TITLE (RELIABILITY)
            const fileName = `${caseData.organ_system || 'GENERAL'} - ${caseData.title || 'CASE'} (${caseData.analysis_result?.reliability || 'N/A'})`.toUpperCase();

            generateCasePDF(formattedData, null, pdfImages, headerTitle, 'Radiologist', fileName);
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
                            <h1 className={`text-2xl font-bold mb-2 leading-tight ${reliabilityColor.split(' ')[0]}`}>
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
                                <span className="text-slate-600">•</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Published
                                </span>
                            </div>
                        </div>

                        <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${reliabilityColor}`}>
                            {caseData.analysis_result?.reliability || 'Certain'}
                        </div>
                    </div>

                    {/* Patient Demographics */}
                    <div className="glass-card-enhanced p-4 rounded-xl space-y-4">
                        <div className="flex items-center gap-4">
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Patient</div>
                                <div className="text-white font-bold flex items-center gap-2">
                                    {caseData.patient_initials}
                                    <span className="text-slate-500 font-normal">|</span>
                                    <span>{caseData.patient_age} yo</span>
                                    <span className="text-slate-500 font-normal">|</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-md ${caseData.patient_sex === 'M' ? 'bg-blue-500/10 text-blue-400' : 'bg-pink-500/10 text-pink-400'}`}>
                                        {caseData.patient_sex || '?'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {caseData.clinical_history && (
                            <div className="pt-2 border-t border-white/5">
                                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Clinical Data</div>
                                <div className="text-sm text-slate-300 italic">
                                    "{caseData.clinical_history}"
                                </div>
                            </div>
                        )}
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

                        {/* Notes / Remarks */}
                        {caseData.educational_summary && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="material-icons text-sm">description</span>
                                    Notes / Remarks
                                </h3>
                                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line pl-4 border-l-2 border-rose-500/20">
                                    {caseData.educational_summary}
                                </div>
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
