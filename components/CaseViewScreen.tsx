import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { loadGenerateCasePDF, prefetchGenerateCasePDF } from '../services/pdfServiceLoader';
import { generateViberText } from '../utils/formatters';
import { supabase } from '../services/supabase';
import { fetchCaseComments, submitCaseComment } from '../services/caseInteractionService';
import { CaseComment } from '../types';

interface CaseViewScreenProps {
    caseData: any;
    onBack: () => void;
    onEdit: () => void;
}

const CaseViewScreen: React.FC<CaseViewScreenProps> = ({ caseData, onBack, onEdit }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const submissionType = caseData.submission_type || 'interesting_case';
    const isInterestingCase = submissionType === 'interesting_case';
    const resolvedImpression = caseData.title || caseData.analysis_result?.impression || caseData.diagnosis;

    const [comments, setComments] = useState<CaseComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

    useEffect(() => {
        checkOwnership();
        loadInteractions();
    }, [caseData]);

    useEffect(() => {
        if (typeof window === 'undefined' || navigator.connection?.saveData) {
            return;
        }

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let idleId: number | null = null;

        const triggerPrefetch = () => {
            void prefetchGenerateCasePDF();
        };

        if (typeof window.requestIdleCallback === 'function') {
            idleId = window.requestIdleCallback(() => {
                triggerPrefetch();
            });
        } else {
            timeoutId = setTimeout(() => {
                triggerPrefetch();
            }, 900);
        }

        return () => {
            if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        };
    }, []);

    const loadInteractions = async () => {
        const commentsData = await fetchCaseComments(caseData.id);
        setComments(commentsData);
    };

    const handlePostComment = async () => {
        if (!newComment.trim()) return;
        setIsSubmittingComment(true);
        const comment = await submitCaseComment(caseData.id, newComment.trim());
        if (comment) {
            setComments(prev => [...prev, comment]);
            setNewComment('');
        }
        setIsSubmittingComment(false);
    };

    const checkOwnership = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && caseData.created_by === user.id) {
            setIsOwner(true);
        }
    };

    const images = caseData.image_urls || [caseData.image_url].filter(Boolean);
    function goToPreviousImage() {
        setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }
    function goToNextImage() {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }
    const openImageModal = () => {
        if (!images.length) return;
        setIsImageModalOpen(true);
    };
    const closeImageModal = () => {
        setIsImageModalOpen(false);
    };

    useEffect(() => {
        if (typeof document === 'undefined' || !isImageModalOpen) {
            return;
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsImageModalOpen(false);
            }
            if (images.length > 1 && event.key === 'ArrowLeft') {
                goToPreviousImage();
            }
            if (images.length > 1 && event.key === 'ArrowRight') {
                goToNextImage();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [images.length, isImageModalOpen]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.dispatchEvent(new CustomEvent('radcore-bottom-nav-visibility', { detail: { hidden: isImageModalOpen } }));

        return () => {
            window.dispatchEvent(new CustomEvent('radcore-bottom-nav-visibility', { detail: { hidden: false } }));
        };
    }, [isImageModalOpen]);

    useEffect(() => {
        setCurrentImageIndex(0);
    }, [caseData?.id]);

    useEffect(() => {
        if (images.length <= 1 || typeof window === 'undefined') {
            return;
        }

        const adjacentIndexes = [
            (currentImageIndex + 1) % images.length,
            (currentImageIndex - 1 + images.length) % images.length,
        ];

        adjacentIndexes.forEach((index) => {
            const src = images[index];
            if (!src) return;
            const img = new Image();
            img.src = src;
        });
    }, [currentImageIndex, images]);
    const handleCopyToViber = () => {
        // Map DB fields to formatter expectation
        const formattedData = {
            initials: caseData.patient_initials,
            age: caseData.patient_age,
            sex: caseData.patient_sex,
            modality: caseData.modality,
            organSystem: caseData.organ_system,
            findings: caseData.findings,
            impression: resolvedImpression,
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
            impression: resolvedImpression,
            notes: caseData.educational_summary,
            clinicalData: caseData.clinical_history || caseData.clinicalData,
            radiologicClinchers: caseData.radiologic_clinchers,
            pearl: caseData.pearl || caseData.analysis_result?.pearl,
            additionalNotes: caseData.notes,
            uploadDate: caseData.analysis_result?.studyDate,
            reference: caseData.analysis_result?.reference,
            title: caseData.title,
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

    const getThemeConfig = () => {
        if (submissionType === 'rare_pathology') {
            return {
                tintColor: 'text-rose-400',
                bgClass: 'bg-rose-500/10',
                borderClass: 'border-rose-500/20',
                buttonBg: 'bg-rose-500 hover:bg-rose-400 text-white',
            };
        } else if (submissionType === 'aunt_minnie') {
            return {
                tintColor: 'text-amber-400',
                bgClass: 'bg-amber-500/10',
                borderClass: 'border-amber-500/20',
                buttonBg: 'bg-amber-500 hover:bg-amber-400 text-slate-900',
            };
        }
        return {
            tintColor: 'text-sky-400',
            bgClass: 'bg-sky-500/10',
            borderClass: 'border-sky-500/20',
            buttonBg: 'bg-sky-500 hover:bg-sky-400 text-white',
        };
    };
    const theme = getThemeConfig();

    return (
        <div className="flex flex-col h-full relative overflow-hidden antialiased text-slate-200">
            {isImageModalOpen && images.length > 0 && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 px-4 py-6 backdrop-blur-md"
                    onClick={closeImageModal}
                >
                    <div
                        className="relative flex h-full max-h-[94vh] w-full max-w-[1600px] flex-col rounded-[28px] border border-white/10 bg-[#03060a] shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-4 sm:px-6">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Image Viewer</p>
                                <p className="truncate text-sm font-semibold text-white/90">
                                    {currentImageIndex + 1} / {images.length}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeImageModal}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition-colors hover:bg-white/[0.08]"
                                aria-label="Close full screen image viewer"
                            >
                                <span className="material-icons text-[22px]">close</span>
                            </button>
                        </div>

                        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:px-6 sm:py-6">
                            <img
                                src={images[currentImageIndex]}
                                className="max-h-full max-w-full object-contain"
                                alt={`Case scan ${currentImageIndex + 1}`}
                            />

                            {images.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={goToPreviousImage}
                                        className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition-colors hover:bg-black/75 sm:left-6"
                                        aria-label="Previous image"
                                    >
                                        <span className="material-icons text-[24px]">chevron_left</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToNextImage}
                                        className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition-colors hover:bg-black/75 sm:right-6"
                                        aria-label="Next image"
                                    >
                                        <span className="material-icons text-[24px]">chevron_right</span>
                                    </button>
                                </>
                            )}
                        </div>

                        {(images.length > 1 || caseData.analysis_result?.imagesMetadata?.[currentImageIndex]?.description) && (
                            <div className="border-t border-white/8 px-4 py-4 sm:px-6">
                                {images.length > 1 && (
                                    <div className="mb-4 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                                        {images.map((image: string, idx: number) => (
                                            <button
                                                key={`modal-thumb-${idx}`}
                                                type="button"
                                                onClick={() => setCurrentImageIndex(idx)}
                                                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border transition-all duration-200 ${idx === currentImageIndex
                                                    ? `border-white/45 ${theme.bgClass} shadow-[0_0_0_1px_rgba(255,255,255,0.14)]`
                                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                                                    }`}
                                                aria-label={`View image ${idx + 1}`}
                                            >
                                                <img
                                                    src={image}
                                                    alt={`Modal thumbnail ${idx + 1}`}
                                                    className="h-full w-full object-cover opacity-80"
                                                />
                                                {idx === currentImageIndex && (
                                                    <span className={`absolute inset-x-2 bottom-1 h-0.5 rounded-full ${theme.bgClass.replace('/10', '')}`} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {caseData.analysis_result?.imagesMetadata?.[currentImageIndex]?.description && (
                                    <p className="text-center text-sm leading-relaxed text-slate-300">
                                        {caseData.analysis_result.imagesMetadata[currentImageIndex].description}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Floating Top Navigation Buttons */}
            <div className="absolute top-0 inset-x-0 p-4 flex flex-col gap-4 pointer-events-none z-50 mt-2">
                <div className="flex justify-between w-full relative">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors pointer-events-auto border border-white/10"
                    >
                        <span className="material-icons text-[20px]">arrow_back</span>
                    </button>

                    {isOwner && (
                        <button
                            onClick={onEdit}
                            className={`pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border px-4 ${theme.borderClass} ${theme.buttonBg} shadow-[0_12px_28px_rgba(15,23,42,0.32)] backdrop-blur-md transition-all hover:scale-[1.02] hover:shadow-[0_16px_34px_rgba(15,23,42,0.38)]`}
                            title="Edit Case"
                        >
                            <span className="material-icons text-[18px]">edit</span>
                            <span className="text-[12px] font-bold uppercase tracking-[0.18em]">Edit Case</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
                {/* Hero Section - Image Gallery */}
                <div className="relative w-full bg-black overflow-hidden border-b border-[#1e293b]">
                    {images.length > 0 ? (
                        <>
                            <div className="mx-auto w-full max-w-[1180px] px-4 pt-4 pb-4">
                                <button
                                    type="button"
                                    onClick={openImageModal}
                                    className="relative flex h-[54vh] min-h-[340px] max-h-[760px] w-full items-center justify-center overflow-hidden rounded-[28px] bg-[#04070c] text-left sm:h-[62vh]"
                                    aria-label="Open image in full screen"
                                >
                                    <img
                                        src={images[currentImageIndex]}
                                        className="relative z-10 max-h-full max-w-full object-contain transition-opacity duration-200"
                                        alt="Case Scan"
                                    />

                                    <div className="absolute bottom-5 left-5 z-20 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80 backdrop-blur-md">
                                        Tap to expand
                                    </div>

                                    {images.length > 1 && (
                                        <>
                                            <div className="absolute right-5 top-5 z-30 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] font-bold tracking-[0.18em] text-white/75 backdrop-blur-md">
                                                {currentImageIndex + 1} / {images.length}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goToPreviousImage();
                                                }}
                                                className="absolute left-5 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition-colors hover:bg-black/75"
                                                aria-label="Previous image"
                                            >
                                                <span className="material-icons text-[22px]">chevron_left</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goToNextImage();
                                                }}
                                                className="absolute right-5 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition-colors hover:bg-black/75"
                                                aria-label="Next image"
                                            >
                                                <span className="material-icons text-[22px]">chevron_right</span>
                                            </button>
                                        </>
                                    )}
                                </button>

                                {images.length > 1 && (
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <button
                                            onClick={goToPreviousImage}
                                            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80 transition-colors hover:bg-white/[0.08]"
                                        >
                                            <span className="material-icons text-[16px]">west</span>
                                            Previous
                                        </button>

                                        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto px-1 py-1 custom-scrollbar">
                                            {images.map((image: string, idx: number) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setCurrentImageIndex(idx)}
                                                    className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-xl border transition-all duration-200 ${idx === currentImageIndex
                                                        ? `border-white/40 ${theme.bgClass} shadow-[0_0_0_1px_rgba(255,255,255,0.14)]`
                                                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                                                        }`}
                                                    aria-label={`View image ${idx + 1}`}
                                                >
                                                    <img
                                                        src={image}
                                                        alt={`Thumbnail ${idx + 1}`}
                                                        className="h-full w-full object-cover opacity-80"
                                                    />
                                                    {idx === currentImageIndex && (
                                                        <span className={`absolute inset-x-2 bottom-1 h-0.5 rounded-full ${theme.bgClass.replace('/10', '')}`} />
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={goToNextImage}
                                            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80 transition-colors hover:bg-white/[0.08]"
                                        >
                                            Next
                                            <span className="material-icons text-[16px]">east</span>
                                        </button>
                                    </div>
                                )}

                                {caseData.analysis_result?.imagesMetadata?.[currentImageIndex]?.description && (
                                    <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                                        <p className="text-sm text-slate-300 text-center tracking-wide leading-relaxed">
                                            {caseData.analysis_result.imagesMetadata[currentImageIndex].description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 relative z-10 border border-dashed border-[#1e293b] m-4 rounded-xl mx-auto max-w-sm max-h-[200px] mt-12 bg-[#131b26]">
                            <div className="text-center space-y-3">
                                <span className={`material-icons text-5xl mb-2 ${theme.tintColor} opacity-50`}>image_not_supported</span>
                                <p className="text-xs uppercase tracking-widest font-bold">No Image Feed Active</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Case Details Container */}
                <div className="px-6 py-5 space-y-4 relative z-10">

                    {/* Metadata Section - Hidden by default */}
                    <div className="flex flex-col gap-2.5">
                        {/* Toggle Button */}
                        <button
                            onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                            className="w-full flex items-center justify-between group outline-none bg-[#131b26] border border-[#1e293b] rounded-xl px-4 py-3 hover:bg-[#1a2332] transition-colors"
                        >
                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <span className={`material-icons text-sm ${theme.tintColor}`}>info</span>
                                Case Details
                            </span>

                            <span className={`material-icons text-slate-400 text-sm transition-transform duration-300 ${isMetadataExpanded ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>

                        {/* Collapsible Content */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isMetadataExpanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}>
                            <div className="bg-[#131b26] border border-[#1e293b] rounded-xl p-5 flex flex-col gap-5">

                                {/* Diagnostic Code */}
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <span className="material-icons text-[12px]">local_hospital</span>
                                        Diagnostic Code
                                    </div>
                                    <div className="text-xl sm:text-2xl font-black text-white tracking-wide leading-none select-text">
                                        {caseData.diagnosis || 'PENDING'}
                                    </div>
                                </div>

                                {/* Tags & Classification */}
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                        <span className="material-icons text-[12px]">category</span>
                                        Classification
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold tracking-widest uppercase border ${theme.bgClass} ${theme.tintColor} ${theme.borderClass}`}>
                                            {submissionType === 'rare_pathology' ? 'Rare Pathology' : submissionType === 'aunt_minnie' ? 'Aunt Minnie' : 'Interesting Case'}
                                        </span>

                                        {caseData.modality && (
                                            <span className="px-2.5 py-1 rounded-md bg-[#1e293b] text-slate-300 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase border border-white/5">
                                                {caseData.modality}
                                            </span>
                                        )}
                                        {caseData.organ_system && (
                                            <span className="px-2.5 py-1 rounded-md bg-[#1e293b] text-slate-300 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase border border-white/5">
                                                {caseData.organ_system}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Date and Status */}
                                <div className="pt-4 border-t border-[#1e293b] flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <span className="material-icons text-[14px]">calendar_today</span>
                                        <span className="text-[11px] font-bold tracking-widest uppercase">
                                            {new Date(caseData.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite]"></span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Published</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Sections */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-8 shadow-none relative">
                        {isInterestingCase && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                    <h3 className="text-[10px] font-bold text-slate-600/70 uppercase tracking-widest">
                                        PATIENT INFO
                                    </h3>
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[13px] text-slate-300">
                                        <span className="font-semibold text-white truncate max-w-[120px]">{caseData.patient_initials || 'UNKNOWN'}</span>
                                        <span className="text-slate-600 shrink-0">|</span>
                                        <span className="whitespace-nowrap">{caseData.patient_age || '?'}{caseData.patient_sex ? `/${caseData.patient_sex}` : ''}</span>
                                    </div>
                                    {caseData.clinical_history && (
                                        <div className="text-[13px] text-slate-400 leading-relaxed whitespace-pre-line object-top">
                                            {caseData.clinical_history}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Clinical Data (Non-Interesting Case) */}
                        {submissionType !== 'aunt_minnie' && !isInterestingCase && caseData.clinical_history && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                    <h3 className="text-[10px] font-bold text-slate-600/70 uppercase tracking-widest">
                                        CLINICAL DATA
                                    </h3>
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                </div>
                                <div className="text-[13px] text-slate-400/80 leading-relaxed whitespace-pre-line text-justify">
                                    {caseData.clinical_history}
                                </div>
                            </div>
                        )}

                        {/* Findings */}
                        {caseData.findings && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                    <h3 className="text-[10px] font-bold text-slate-600/70 uppercase tracking-widest">
                                        FINDINGS
                                    </h3>
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                </div>
                                <div className="text-[13px] text-slate-400/80 leading-relaxed whitespace-pre-line text-justify">
                                    {caseData.findings}
                                </div>
                            </div>
                        )}

                        {/* Descriptions (Aunt Minnie specific) */}
                        {submissionType === 'aunt_minnie' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                    <h3 className="text-[10px] font-bold text-slate-600/70 uppercase tracking-widest">
                                        DESCRIPTION
                                    </h3>
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                </div>
                                <div className="text-[13px] text-slate-400/80 leading-relaxed whitespace-pre-line text-justify">
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

                        {/* Impression */}
                        {(isInterestingCase || submissionType === 'rare_pathology') && resolvedImpression && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                    <h3 className="text-[10px] font-bold text-slate-600/70 uppercase tracking-widest">
                                        IMPRESSION
                                    </h3>
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                </div>
                                <div className="text-[14px] font-medium text-white leading-relaxed whitespace-pre-line text-justify tracking-wide">
                                    {resolvedImpression}
                                </div>
                            </div>
                        )}

                        {/* Notes / Remarks */}
                        {caseData.educational_summary && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                    <h3 className="text-[10px] font-bold text-slate-600/70 uppercase tracking-widest">
                                        NOTES
                                    </h3>
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                </div>
                                <div
                                    className="case-rich-preview text-[13px] text-slate-300/90 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(caseData.educational_summary) }}
                                />
                                <style>{`
                                  .case-rich-preview h2,
                                  .case-rich-preview h3 {
                                    margin: 0.65rem 0 0.4rem;
                                    font-weight: 800;
                                    color: #f8fafc;
                                    letter-spacing: -0.01em;
                                  }

                                  .case-rich-preview h2 {
                                    font-size: 1rem;
                                  }

                                  .case-rich-preview h3 {
                                    font-size: 0.95rem;
                                  }

                                  .case-rich-preview p {
                                    margin: 0.4rem 0;
                                    color: rgba(203, 213, 225, 0.92);
                                  }

                                  .case-rich-preview ul,
                                  .case-rich-preview ol {
                                    margin: 0.45rem 0;
                                    padding-left: 1.2rem;
                                  }

                                  .case-rich-preview li {
                                    margin: 0.2rem 0;
                                  }

                                  .case-rich-preview strong {
                                    color: #ffffff;
                                  }

                                  .case-rich-preview span[style*="color"] {
                                    filter: saturate(0.95) brightness(1.05);
                                  }
                                `}</style>
                            </div>
                        )}

                        {/* Radiologic Clinchers */}
                        {submissionType === 'rare_pathology' && caseData.radiologic_clinchers && (
                            <div className="space-y-4 relative overflow-hidden">
                                <div className="flex items-center gap-4 mb-4 relative z-10">
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                    <h3 className="text-[10px] font-bold text-slate-600/70 uppercase tracking-widest">
                                        RADIOLOGIC CLINCHERS
                                    </h3>
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                </div>
                                <div className="text-[13px] text-slate-400/80 leading-relaxed whitespace-pre-line text-justify relative z-10">
                                    {caseData.radiologic_clinchers}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-4 pb-28 relative z-10">
                        <button
                            onClick={handleCopyToViber}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1e293b] hover:bg-[#334155] py-3.5 w-full text-[13px] font-bold text-slate-200 transition-colors"
                        >
                            <span className="material-icons text-[16px]">content_copy</span>
                            <span className="truncate">Copy Text</span>
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={isExportingPdf}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-xl ${theme.buttonBg} py-3.5 w-full text-[13px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <span className="material-icons text-[16px]">picture_as_pdf</span>
                            <span className="truncate">{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
                        </button>
                    </div>

                    {/* Discussion Section */}
                    <div className="mt-8 pt-8 border-t border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                                <span className="material-icons text-base text-primary">forum</span>
                                Discussion Thread
                            </h3>
                        </div>

                        <div className="space-y-4 mb-6">
                            {comments.length === 0 ? (
                                <p className="text-xs text-slate-500 italic text-center py-4 bg-[#131b26] rounded-xl border border-dashed border-[#1e293b]">
                                    No comments yet. Be the first to discuss!
                                </p>
                            ) : (
                                comments.map(comment => (
                                    <div key={comment.id} className="bg-[#131b26] rounded-xl p-4 flex gap-3 shadow-none">
                                        <img
                                            src={comment.user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                                            alt="avatar"
                                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/20"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-xs font-bold text-white truncate">
                                                    {comment.user?.nickname || comment.user?.full_name || 'Anonymous User'}
                                                </span>
                                                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                    {new Date(comment.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                                                {comment.content}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Comment */}
                        {/* Add Comment */}
                        <div className="flex items-end gap-3 bg-[#131b26] p-2 rounded-2xl border border-[#1e293b] focus-within:border-sky-500/50 transition-colors shadow-none">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add to the discussion..."
                                rows={1}
                                className="flex-1 bg-transparent border-none text-sm text-slate-200 focus:ring-0 resize-none px-3 py-2 custom-scrollbar min-h-[40px] max-h-[120px] outline-none"
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                                }}
                            />
                            <button
                                onClick={handlePostComment}
                                disabled={isSubmittingComment || !newComment.trim()}
                                className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 disabled:bg-[#1e293b] disabled:text-slate-500 disabled:cursor-not-allowed hover:bg-sky-400 transition-colors shadow-none"
                            >
                                <span className="material-icons text-lg">{isSubmittingComment ? 'hourglass_empty' : 'send'}</span>
                            </button>
                        </div>
                    </div>

                </div >
            </div >
        </div >
    );
};

export default CaseViewScreen;
