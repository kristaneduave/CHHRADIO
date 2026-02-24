import React, { useState, useEffect } from 'react';
import { loadGenerateCasePDF } from '../services/pdfServiceLoader';
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
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const submissionType = caseData.submission_type || 'interesting_case';
    const isInterestingCase = submissionType === 'interesting_case';

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
            notes: caseData.clinical_history
        };
        const text = generateViberText(formattedData);
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard! Ready to paste into Viber.');
        });
    };

    const handleExportPDF = async () => {
        setIsExportingPdf(true);
        // Prepare images with descriptions
        const pdfImages = images.map((url: string, idx: number) => ({
            url,
            description: caseData.analysis_result?.imagesMetadata?.[idx]?.description || ''
        }));

        const formattedData = {
            submissionType: caseData.submission_type || 'interesting_case',
            initials: caseData.patient_initials,
            age: caseData.patient_age,
            sex: caseData.patient_sex,
            modality: caseData.modality,
            organSystem: caseData.organ_system,
            findings: caseData.findings,
            impression: caseData.analysis_result?.impression || caseData.diagnosis,
            notes: caseData.educational_summary,
            clinicalData: caseData.clinical_history || caseData.clinicalData,
            radiologicClinchers: caseData.radiologic_clinchers,
            pearl: caseData.pearl || caseData.analysis_result?.pearl,
            additionalNotes: caseData.notes // Attempt to pass generic notes if they exist
        };

        try {
            const generateCasePDF = await loadGenerateCasePDF().catch((error) => {
                throw new Error(`Unable to load export module: ${String(error)}`);
            });
            // Header: User input title (e.g. "SINONASAL MENINGIOMA")
            const headerTitle = (caseData.title || 'RADIOLOGY CASE').toUpperCase();

            // Filename: TITLE
            const fileName = `${caseData.title || 'CASE'}`.toUpperCase();

            generateCasePDF(formattedData, null, pdfImages, headerTitle, 'Radiologist', fileName);
        } catch (e: any) {
            const message = e instanceof Error ? e.message : String(e);
            if (message.includes('Unable to load export module')) {
                alert('Unable to load export module: ' + message);
            } else {
                alert('Export failed: ' + message);
            }
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-app relative overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="px-6 pt-12 pb-4 flex items-center justify-between z-10 bg-app/80 backdrop-blur-md sticky top-0">
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
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                {isInterestingCase && (
                                    <span className="px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/30 font-bold uppercase tracking-wide">
                                        Interesting Case
                                    </span>
                                )}
                                {caseData.modality && (
                                    <span className="px-2 py-1 rounded-md bg-white/5 text-slate-300 border border-white/5 font-medium">
                                        {caseData.modality}
                                    </span>
                                )}
                                {caseData.organ_system && (
                                    <span className="px-2 py-1 rounded-md bg-white/5 text-slate-300 border border-white/5 font-medium">
                                        {caseData.organ_system}
                                    </span>
                                )}
                                {submissionType === 'aunt_minnie' && (
                                    <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/25 font-bold uppercase tracking-wide">
                                        Aunt Minnie
                                    </span>
                                )}
                                {submissionType === 'rare_pathology' && (
                                    <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/25 font-bold uppercase tracking-wide">
                                        Rare Pathology
                                    </span>
                                )}
                                <span className="text-slate-500 whitespace-nowrap">{new Date(caseData.created_at).toLocaleDateString()}</span>
                                <span className="text-slate-600 hidden sm:inline">|</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-1 whitespace-nowrap">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Published
                                </span>
                            </div>
                        </div>

                    </div>

                    {/* Main Content */}
                    <div className="space-y-6">
                        {isInterestingCase && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                    <span className="material-icons text-base text-primary">person</span>
                                    Patient + Clinical Data
                                </h3>
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[15px] text-slate-200 leading-relaxed whitespace-pre-line">
                                    <span>{caseData.patient_initials || 'N/A'} {caseData.patient_age || '?'}{caseData.patient_sex ? `/${caseData.patient_sex}` : ''}</span>
                                    <span className="mx-2 text-slate-500">presented with</span>
                                    <span className="text-slate-300">{caseData.clinical_history || 'no clinical data recorded'}</span>
                                </div>
                            </div>
                        )}

                        {/* Clinical Data */}
                        {submissionType !== 'aunt_minnie' && !isInterestingCase && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                <span className="material-icons text-base text-primary">medical_information</span>
                                Clinical Data
                            </h3>
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-base text-white leading-relaxed whitespace-pre-line text-justify">
                                {caseData.clinical_history || "No clinical data recorded."}
                            </div>
                        </div>
                        )}

                        {/* Findings */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                <span className="material-icons text-base text-primary">search</span>
                                Findings
                            </h3>
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-base text-white leading-relaxed whitespace-pre-line text-justify">
                                {caseData.findings || "No findings recorded."}
                            </div>
                        </div>

                        {submissionType === 'aunt_minnie' && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                    <span className="material-icons text-base text-primary">image</span>
                                    Description
                                </h3>
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-base text-white leading-relaxed whitespace-pre-line text-justify">
                                    {(() => {
                                        const descriptions = (caseData.analysis_result?.imagesMetadata || [])
                                          .map((item: any) => item?.description?.trim())
                                          .filter((value: string) => Boolean(value));
                                        if (descriptions.length > 0) return descriptions.join('\n');
                                        return caseData.findings || "No description recorded.";
                                    })()}
                                </div>
                            </div>
                        )}

                        {submissionType === 'aunt_minnie' && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                    <span className="material-icons text-base text-primary">description</span>
                                    Notes / Remarks
                                </h3>
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-base text-white leading-relaxed whitespace-pre-line text-justify">
                                    {caseData.educational_summary || "No notes recorded."}
                                </div>
                            </div>
                        )}

                        {/* Impression */}
                        {isInterestingCase && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                    <span className="material-icons text-base text-primary">assignment_turned_in</span>
                                    Impression
                                </h3>
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-base text-white leading-relaxed whitespace-pre-line text-justify">
                                    {caseData.analysis_result?.impression || caseData.diagnosis || "No impression recorded."}
                                </div>
                            </div>
                        )}

                        {/* Notes / Remarks */}
                        {isInterestingCase && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                    <span className="material-icons text-base text-primary">description</span>
                                    Notes / Remarks
                                </h3>
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-base text-white leading-relaxed whitespace-pre-line text-justify">
                                    {caseData.educational_summary || "No notes recorded."}
                                </div>
                            </div>
                        )}

                        {/* Radiologic Clinchers */}
                        {submissionType === 'rare_pathology' && caseData.radiologic_clinchers && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                    <span className="material-icons text-base text-primary">flare</span>
                                    Radiologic Clinchers
                                </h3>
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-base text-white leading-relaxed whitespace-pre-line text-justify">
                                    {caseData.radiologic_clinchers}
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
                            disabled={isExportingPdf}
                            className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 transition-all font-bold text-xs uppercase tracking-wider group disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons group-hover:scale-110 transition-transform">picture_as_pdf</span>
                            {isExportingPdf ? 'Exporting PDF...' : 'Export PDF'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CaseViewScreen;


