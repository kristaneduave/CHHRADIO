import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { createPortal } from 'react-dom';
import { loadGenerateCasePDF, prefetchGenerateCasePDF } from '../services/pdfServiceLoader';
import { normalizeRichTextNotesHtml } from '../utils/richTextNotesNormalizer';
import { supabase } from '../services/supabase';
import { fetchCaseComments, submitCaseComment } from '../services/caseInteractionService';
import { createOrGetCaseShare, buildPublicCaseUrl, getCaseShareErrorMessage } from '../services/caseShareService';
import { CaseComment } from '../types';
import { toastError, toastSuccess } from '../utils/toast';
import { generateConsultantShareText } from '../utils/formatters';
import {
    IMAGE_DISMISS_SWIPE_THRESHOLD_PX,
    IMAGE_DOUBLE_TAP_DELAY_MS,
    IMAGE_SWIPE_THRESHOLD_PX,
    IMAGE_SWIPE_VERTICAL_TOLERANCE_PX,
} from '../utils/mobileGestures';

interface CaseViewScreenProps {
    caseData: any;
    onBack: () => void;
    onEdit?: () => void;
    mode?: 'internal' | 'public';
}

const normalizeCaseReferences = (caseData: any) => {
    const seededReferences = Array.isArray(caseData.analysis_result?.references) && caseData.analysis_result.references.length > 0
        ? caseData.analysis_result.references
        : caseData.analysis_result?.reference
            ? [caseData.analysis_result.reference]
            : [];

    return seededReferences
        .map((reference: any) => ({
            sourceType: String(reference?.sourceType || '').trim(),
            title: String(reference?.title || '').trim(),
            page: String(reference?.page || '').trim(),
        }))
        .filter((reference) => reference.sourceType || reference.title || reference.page);
};

const getReferenceDisplayText = (reference: { sourceType?: string; title?: string; page?: string }) =>
    [reference.sourceType, reference.title].filter(Boolean).join(' • ') || 'Reference provided';

const resolveCasePatientId = (caseData: any) =>
    String(caseData.analysis_result?.patientId || '').trim() || String(caseData.diagnosis || '').trim() || null;

const clampZoom = (value: number) => Math.min(3, Math.max(1, Number(value.toFixed(2))));

const CaseViewScreen: React.FC<CaseViewScreenProps> = ({ caseData, onBack, onEdit, mode = 'internal' }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [imageZoom, setImageZoom] = useState(1);
    const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
    const [isGestureActive, setIsGestureActive] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [isPreparingShare, setIsPreparingShare] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const submissionType = caseData.submission_type || 'interesting_case';
    const isInterestingCase = submissionType === 'interesting_case';
    const isPublicMode = mode === 'public';
    const resolvedImpression = caseData.title || caseData.analysis_result?.impression || caseData.diagnosis;
    const normalizedEducationalSummary = React.useMemo(
        () => normalizeRichTextNotesHtml(caseData.educational_summary),
        [caseData.educational_summary]
    );
    const normalizedReferences = React.useMemo(() => normalizeCaseReferences(caseData), [caseData]);
    const patientId = React.useMemo(() => resolveCasePatientId(caseData), [caseData]);
    const canShowShareActions = !isPublicMode && caseData?.status === 'published';

    const [comments, setComments] = useState<CaseComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
    const [publisherName, setPublisherName] = useState('Radiologist');
    const viewerSurfaceRef = useRef<HTMLDivElement | null>(null);
    const lastTapAtRef = useRef(0);
    const pinchDistanceRef = useRef<number | null>(null);
    const pinchZoomRef = useRef(1);
    const pinchCenterRef = useRef({ x: 0, y: 0 });
    const pinchStartOffsetRef = useRef({ x: 0, y: 0 });
    const touchStartXRef = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);
    const touchCurrentXRef = useRef<number | null>(null);
    const touchCurrentYRef = useRef<number | null>(null);
    const touchModeRef = useRef<'idle' | 'swipe' | 'pinch' | 'pan' | 'dismiss'>('idle');
    const panStartOffsetRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        checkOwnership();
        if (!isPublicMode) {
            loadInteractions();
        } else {
            setComments([]);
        }
        loadPublisherName();
    }, [caseData, isPublicMode]);

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
        if (isPublicMode) {
            setIsOwner(false);
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        setIsOwner(Boolean(user && caseData.created_by === user.id));
    };

    const loadPublisherName = async () => {
        const directName = String(caseData.author || caseData.publisherName || '').trim();
        if (directName) {
            setPublisherName(directName);
            return;
        }

        if (!caseData.created_by) {
            setPublisherName('Radiologist');
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('nickname, full_name')
            .eq('id', caseData.created_by)
            .maybeSingle();

        setPublisherName(profile?.nickname || profile?.full_name || 'Radiologist');
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
        setImageZoom(1);
        setImageOffset({ x: 0, y: 0 });
        setIsGestureActive(false);
        setIsImageModalOpen(true);
    };
    const closeImageModal = () => {
        setIsImageModalOpen(false);
        setImageZoom(1);
        setImageOffset({ x: 0, y: 0 });
        setIsGestureActive(false);
        lastTapAtRef.current = 0;
        pinchDistanceRef.current = null;
        pinchZoomRef.current = 1;
        pinchCenterRef.current = { x: 0, y: 0 };
        pinchStartOffsetRef.current = { x: 0, y: 0 };
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        touchCurrentXRef.current = null;
        touchCurrentYRef.current = null;
        touchModeRef.current = 'idle';
    };
    const zoomInImage = () => setImageZoom((prev) => clampZoom(prev + 0.25));
    const zoomOutImage = () => setImageZoom((prev) => clampZoom(prev - 0.25));
    const resetImageZoom = () => {
        setImageZoom(1);
        setImageOffset({ x: 0, y: 0 });
    };
    const getTouchDistance = (touches: React.TouchList) => {
        if (touches.length < 2) return null;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };
    const getSurfaceRelativePoint = (clientX: number, clientY: number) => {
        const surface = viewerSurfaceRef.current;
        if (!surface) return { x: 0, y: 0 };
        const rect = surface.getBoundingClientRect();
        return {
            x: clientX - (rect.left + rect.width / 2),
            y: clientY - (rect.top + rect.height / 2),
        };
    };
    const clampImageOffset = (offset: { x: number; y: number }, zoom: number) => {
        const surface = viewerSurfaceRef.current;
        if (!surface || zoom <= 1) return { x: 0, y: 0 };
        const rect = surface.getBoundingClientRect();
        const maxX = ((zoom - 1) * rect.width) / 2;
        const maxY = ((zoom - 1) * rect.height) / 2;
        return {
            x: Math.min(maxX, Math.max(-maxX, offset.x)),
            y: Math.min(maxY, Math.max(-maxY, offset.y)),
        };
    };
    const applyEdgeResistance = (offset: { x: number; y: number }, zoom: number) => {
        const surface = viewerSurfaceRef.current;
        if (!surface || zoom <= 1) return { x: 0, y: 0 };
        const rect = surface.getBoundingClientRect();
        const maxX = ((zoom - 1) * rect.width) / 2;
        const maxY = ((zoom - 1) * rect.height) / 2;
        const soften = (value: number, max: number) => {
            if (value > max) return max + (value - max) * 0.2;
            if (value < -max) return -max + (value + max) * 0.2;
            return value;
        };
        return { x: soften(offset.x, maxX), y: soften(offset.y, maxY) };
    };
    const getZoomedOffsetForPoint = (
        point: { x: number; y: number },
        startZoom: number,
        targetZoom: number,
        startOffset: { x: number; y: number },
    ) => {
        if (targetZoom <= 1 || startZoom <= 0) return { x: 0, y: 0 };
        return clampImageOffset({
            x: point.x - ((point.x - startOffset.x) / startZoom) * targetZoom,
            y: point.y - ((point.y - startOffset.y) / startZoom) * targetZoom,
        }, targetZoom);
    };
    const zoomViewerAtPoint = (clientX: number, clientY: number, targetZoom: number) => {
        const point = getSurfaceRelativePoint(clientX, clientY);
        const nextZoom = clampZoom(targetZoom);
        setImageZoom(nextZoom);
        setImageOffset((previous) => getZoomedOffsetForPoint(point, imageZoom, nextZoom, previous));
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
            if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                zoomInImage();
            }
            if (event.key === '-' || event.key === '_') {
                event.preventDefault();
                zoomOutImage();
            }
            if (event.key === '0') {
                event.preventDefault();
                resetImageZoom();
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
        setImageZoom(1);
        setImageOffset({ x: 0, y: 0 });
        setIsGestureActive(false);
        lastTapAtRef.current = 0;
        pinchDistanceRef.current = null;
        pinchZoomRef.current = 1;
        pinchCenterRef.current = { x: 0, y: 0 };
        pinchStartOffsetRef.current = { x: 0, y: 0 };
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        touchCurrentXRef.current = null;
        touchCurrentYRef.current = null;
        touchModeRef.current = 'idle';
    }, [currentImageIndex, isImageModalOpen]);

    useEffect(() => {
        setImageOffset((previous) => clampImageOffset(previous, imageZoom));
    }, [imageZoom]);

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
    const writeTextToClipboard = async (value: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(value);
                return true;
            } catch {
                // Fall through to the legacy copy strategy below.
            }
        }

        if (typeof document === 'undefined') {
            return false;
        }

        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.setAttribute('readonly', 'true');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            return document.execCommand('copy');
        } catch {
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    };

    const copyText = async (value: string, successTitle: string, successDescription?: string) => {
        const copied = await writeTextToClipboard(value);
        if (!copied) {
            throw new Error('Clipboard access is not available in this context.');
        }
        toastSuccess(successTitle, successDescription);
    };

    const buildConsultantShareText = (publicUrl: string) => {
        return generateConsultantShareText({
            findings: caseData.findings,
            title: caseData.title,
            impression: caseData.analysis_result?.impression || caseData.diagnosis,
            diagnosis: caseData.diagnosis,
            publicUrl,
        });
    };

    const ensureCaseShare = async () => {
        if (!caseData?.id) {
            throw new Error('Case is missing an id.');
        }

        return createOrGetCaseShare(String(caseData.id));
    };

    const getPreparedConsultantShareText = async () => {
        const share = await ensureCaseShare();
        const publicUrl = buildPublicCaseUrl(share.public_token);
        return buildConsultantShareText(publicUrl);
    };

    const handleCopyCaseText = async () => {
        if (!canShowShareActions) return;
        try {
            const shareText = await getPreparedConsultantShareText();
            await copyText(
                shareText,
                'Case text copied',
                'Upload the representative image in Viber, then paste the copied case text.'
            );
        } catch (error: any) {
            toastError('Unable to copy case text', getCaseShareErrorMessage(error));
        }
    };

    const handleShareToViber = async () => {
        if (!canShowShareActions) return;
        setIsPreparingShare(true);
        try {
            const shareText = await getPreparedConsultantShareText();
            const copied = await writeTextToClipboard(shareText);
            const viberUrl = `viber://forward?text=${encodeURIComponent(shareText)}`;

            if (typeof window !== 'undefined') {
                try {
                    const launchAnchor = document.createElement('a');
                    launchAnchor.href = viberUrl;
                    launchAnchor.target = '_self';
                    launchAnchor.rel = 'noopener noreferrer';
                    launchAnchor.style.display = 'none';
                    document.body.appendChild(launchAnchor);
                    launchAnchor.click();
                    document.body.removeChild(launchAnchor);
                } catch {
                    if (copied) {
                        toastSuccess('Case text copied', 'Open Viber, upload the representative image, then paste the copied case text.');
                    } else {
                        toastError('Unable to open Viber', 'Open Viber manually, then use Copy Case Text to copy the share message.');
                    }
                    return;
                }
            }

            if (copied) {
                toastSuccess('Viber ready', 'Viber is opening. Upload the representative image, then paste the copied case text.');
            } else {
                toastSuccess('Viber opening', 'Viber is opening. If paste is unavailable, return and tap Copy Case Text.');
            }
        } catch (error: any) {
            toastError('Unable to prepare Viber share', getCaseShareErrorMessage(error));
        } finally {
            setIsPreparingShare(false);
        }
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
            notes: normalizedEducationalSummary,
            clinicalData: caseData.clinical_history || caseData.clinicalData,
            radiologicClinchers: caseData.radiologic_clinchers,
            pearl: caseData.pearl || caseData.analysis_result?.pearl,
            additionalNotes: caseData.notes,
            uploadDate: caseData.created_at,
            patientId: caseData.analysis_result?.patientId,
            reference: caseData.analysis_result?.reference,
            references: caseData.analysis_result?.references,
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

            await generateCasePDF(formattedData, null, pdfImages, headerTitle, publisherName, fileName);
        } catch (e: any) {
            const message = e instanceof Error ? e.message : String(e);
            if (message.includes('Unable to load export module')) {
                toastError('Unable to load export module', message);
            } else {
                toastError('Export failed', message);
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
            {isImageModalOpen && images.length > 0 && typeof document !== 'undefined' && createPortal((
                <div
                    className="fixed inset-0 z-[120] bg-slate-950/95"
                    onClick={closeImageModal}
                >
                    <div className="flex h-full w-full flex-col">
                        <div
                            className="flex items-start justify-between gap-3 px-4 py-4 sm:px-6"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                                    <span>{currentImageIndex + 1}/{images.length}</span>
                                </div>
                                {caseData.analysis_result?.imagesMetadata?.[currentImageIndex]?.description && (
                                    <p className="mt-1 truncate text-xs text-slate-400">
                                        {caseData.analysis_result.imagesMetadata[currentImageIndex].description}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={resetImageZoom}
                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200"
                                    aria-label="Reset zoom"
                                >
                                    {Math.round(imageZoom * 100)}%
                                </button>
                                <button
                                    type="button"
                                    onClick={closeImageModal}
                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100"
                                    aria-label="Close full screen image viewer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div
                            ref={viewerSurfaceRef}
                            className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 py-4 sm:px-6 sm:py-6"
                            style={{ touchAction: 'none' }}
                            onWheel={(event) => {
                                if (!event.ctrlKey && !event.metaKey) return;
                                event.preventDefault();
                                const nextZoom = clampZoom(imageZoom + (event.deltaY < 0 ? 0.2 : -0.2));
                                const point = getSurfaceRelativePoint(event.clientX, event.clientY);
                                setImageZoom(nextZoom);
                                setImageOffset((previous) => getZoomedOffsetForPoint(point, imageZoom, nextZoom, previous));
                            }}
                            onTouchStart={(event) => {
                                if (event.touches.length >= 2) {
                                    const distance = getTouchDistance(event.touches);
                                    if (distance === null) return;
                                    touchModeRef.current = 'pinch';
                                    setIsGestureActive(true);
                                    pinchDistanceRef.current = distance;
                                    pinchZoomRef.current = imageZoom;
                                    pinchStartOffsetRef.current = imageOffset;
                                    pinchCenterRef.current = getSurfaceRelativePoint(
                                        (event.touches[0].clientX + event.touches[1].clientX) / 2,
                                        (event.touches[0].clientY + event.touches[1].clientY) / 2,
                                    );
                                    touchStartXRef.current = null;
                                    touchStartYRef.current = null;
                                    touchCurrentXRef.current = null;
                                    touchCurrentYRef.current = null;
                                    return;
                                }

                                if (event.touches.length === 1) {
                                    const tapAt = Date.now();
                                    if (tapAt - lastTapAtRef.current <= IMAGE_DOUBLE_TAP_DELAY_MS) {
                                        event.preventDefault();
                                        const targetZoom = imageZoom > 1.4 ? 1 : 2;
                                        zoomViewerAtPoint(event.touches[0].clientX, event.touches[0].clientY, targetZoom);
                                        lastTapAtRef.current = 0;
                                        touchModeRef.current = 'idle';
                                        touchStartXRef.current = null;
                                        touchStartYRef.current = null;
                                        touchCurrentXRef.current = null;
                                        touchCurrentYRef.current = null;
                                        return;
                                    }

                                    lastTapAtRef.current = tapAt;
                                    touchModeRef.current = imageZoom > 1.05 ? 'pan' : 'swipe';
                                    setIsGestureActive(imageZoom > 1.05);
                                    touchStartXRef.current = event.touches[0].clientX;
                                    touchStartYRef.current = event.touches[0].clientY;
                                    touchCurrentXRef.current = event.touches[0].clientX;
                                    touchCurrentYRef.current = event.touches[0].clientY;
                                    panStartOffsetRef.current = imageOffset;
                                }
                            }}
                            onTouchMove={(event) => {
                                if (event.touches.length >= 2) {
                                    const distance = getTouchDistance(event.touches);
                                    if (distance === null || pinchDistanceRef.current === null) return;
                                    touchModeRef.current = 'pinch';
                                    event.preventDefault();
                                    const scaleRatio = distance / pinchDistanceRef.current;
                                    const nextZoom = clampZoom(pinchZoomRef.current * scaleRatio);
                                    setImageZoom(nextZoom);
                                    setImageOffset(
                                        getZoomedOffsetForPoint(
                                            pinchCenterRef.current,
                                            pinchZoomRef.current,
                                            nextZoom,
                                            pinchStartOffsetRef.current,
                                        ),
                                    );
                                    return;
                                }

                                if (touchModeRef.current === 'pan' && event.touches.length === 1) {
                                    const startX = touchStartXRef.current;
                                    const startY = touchStartYRef.current;
                                    if (startX === null || startY === null) return;
                                    event.preventDefault();
                                    const deltaX = event.touches[0].clientX - startX;
                                    const deltaY = event.touches[0].clientY - startY;
                                    setImageOffset(
                                        applyEdgeResistance({
                                            x: panStartOffsetRef.current.x + deltaX,
                                            y: panStartOffsetRef.current.y + deltaY,
                                        }, imageZoom),
                                    );
                                    touchCurrentXRef.current = event.touches[0].clientX;
                                    touchCurrentYRef.current = event.touches[0].clientY;
                                    return;
                                }

                                if (touchModeRef.current === 'swipe' && event.touches.length === 1) {
                                    touchCurrentXRef.current = event.touches[0].clientX;
                                    touchCurrentYRef.current = event.touches[0].clientY;
                                    const startX = touchStartXRef.current;
                                    const startY = touchStartYRef.current;
                                    if (startX === null || startY === null || imageZoom > 1.05) return;
                                    const deltaX = touchCurrentXRef.current - startX;
                                    const deltaY = touchCurrentYRef.current - startY;
                                    if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0) {
                                        touchModeRef.current = 'dismiss';
                                        event.preventDefault();
                                        return;
                                    }
                                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                                        event.preventDefault();
                                    }
                                    return;
                                }

                                if (touchModeRef.current === 'dismiss' && event.touches.length === 1) {
                                    touchCurrentXRef.current = event.touches[0].clientX;
                                    touchCurrentYRef.current = event.touches[0].clientY;
                                    event.preventDefault();
                                }
                            }}
                            onTouchEnd={() => {
                                if (touchModeRef.current === 'pinch') {
                                    pinchDistanceRef.current = null;
                                    pinchZoomRef.current = imageZoom;
                                    setIsGestureActive(false);
                                    touchModeRef.current = 'idle';
                                    return;
                                }

                                if (touchModeRef.current === 'pan') {
                                    setIsGestureActive(false);
                                    setImageOffset((previous) => clampImageOffset(previous, imageZoom));
                                }

                                if (touchModeRef.current === 'swipe') {
                                    const startX = touchStartXRef.current;
                                    const startY = touchStartYRef.current;
                                    const endX = touchCurrentXRef.current;
                                    const endY = touchCurrentYRef.current;

                                    if (startX !== null && startY !== null && endX !== null && endY !== null && imageZoom <= 1.05) {
                                        const deltaX = endX - startX;
                                        const deltaY = endY - startY;
                                        const horizontalSwipe = Math.abs(deltaX) >= IMAGE_SWIPE_THRESHOLD_PX;
                                        const verticalEnough = Math.abs(deltaY) <= IMAGE_SWIPE_VERTICAL_TOLERANCE_PX;

                                        if (horizontalSwipe && verticalEnough) {
                                            if (deltaX < 0) {
                                                goToNextImage();
                                            } else {
                                                goToPreviousImage();
                                            }
                                        }
                                    }
                                }

                                if (touchModeRef.current === 'dismiss') {
                                    const startY = touchStartYRef.current;
                                    const endY = touchCurrentYRef.current;
                                    if (startY !== null && endY !== null && endY - startY >= IMAGE_DISMISS_SWIPE_THRESHOLD_PX && imageZoom <= 1.05) {
                                        closeImageModal();
                                        return;
                                    }
                                }

                                pinchDistanceRef.current = null;
                                pinchZoomRef.current = imageZoom;
                                touchStartXRef.current = null;
                                touchStartYRef.current = null;
                                touchCurrentXRef.current = null;
                                touchCurrentYRef.current = null;
                                touchModeRef.current = 'idle';
                            }}
                        >
                            <img
                                src={images[currentImageIndex]}
                                className={`max-h-full max-w-full select-none object-contain ${isGestureActive ? '' : 'transition-transform duration-150 ease-out'}`}
                                style={{
                                    transform: `translate3d(${imageOffset.x}px, ${imageOffset.y}px, 0) scale(${imageZoom})`,
                                    transformOrigin: 'center center',
                                    willChange: 'transform',
                                }}
                                alt={`Case scan ${currentImageIndex + 1}`}
                                draggable={false}
                                onClick={(event) => event.stopPropagation()}
                            />

                            {images.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            goToPreviousImage();
                                        }}
                                        className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white sm:left-6"
                                        aria-label="Previous image"
                                    >
                                        <span className="material-icons text-[22px]">chevron_left</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            goToNextImage();
                                        }}
                                        className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white sm:right-6"
                                        aria-label="Next image"
                                    >
                                        <span className="material-icons text-[22px]">chevron_right</span>
                                    </button>
                                </>
                            )}

                            {images.length > 1 && (
                                <div
                                    className="pointer-events-none absolute inset-x-0 bottom-5 flex items-center justify-center gap-2 sm:hidden"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    {images.map((image: string, idx: number) => (
                                        <button
                                            key={`modal-dot-${idx}-${image}`}
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setCurrentImageIndex(idx);
                                            }}
                                            className={`pointer-events-auto h-2 rounded-full transition-all ${idx === currentImageIndex ? 'w-5 bg-white' : 'w-2 bg-white/35'}`}
                                            aria-label={`View image ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {images.length > 1 && (
                            <div
                                className="hidden border-t border-white/8 px-4 py-4 sm:block sm:px-6"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="flex items-center justify-center gap-2 overflow-x-auto custom-scrollbar">
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
                            </div>
                        )}
                    </div>
                </div>
            ), document.body)}
            {/* Floating Top Navigation Buttons */}
            <div className="absolute top-0 inset-x-0 p-4 flex flex-col gap-4 pointer-events-none z-50 mt-2">
                <div className="flex justify-between w-full relative">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors pointer-events-auto border border-white/10"
                    >
                        <span className="material-icons text-[20px]">arrow_back</span>
                    </button>

                    {!isPublicMode && isOwner && onEdit && (
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

                                    {images.length > 1 && (
                                        <>
                                            <div className="absolute right-5 top-5 z-30 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] font-bold tracking-[0.18em] text-white/75 backdrop-blur-md">
                                                {currentImageIndex + 1} / {images.length}
                                            </div>
                                        </>
                                    )}
                                </button>

                                {caseData.analysis_result?.imagesMetadata?.[currentImageIndex]?.description && (
                                    <p className="mt-3 text-center text-sm leading-relaxed tracking-wide text-slate-300">
                                        {caseData.analysis_result.imagesMetadata[currentImageIndex].description}
                                    </p>
                                )}

                                {images.length > 1 && (
                                    <div className="mt-4 rounded-[22px] bg-[#09111b]/92 p-2.5 sm:p-3">
                                        <div className="flex items-center gap-3">
                                        <button
                                            onClick={goToPreviousImage}
                                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition-colors hover:bg-white/[0.08]"
                                            aria-label="Previous image"
                                        >
                                            <span className="material-icons text-[18px]">west</span>
                                        </button>

                                        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto px-1 py-1 custom-scrollbar">
                                            {images.map((image: string, idx: number) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setCurrentImageIndex(idx)}
                                                    className={`relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-2xl border transition-all duration-200 ${idx === currentImageIndex
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
                                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition-colors hover:bg-white/[0.08]"
                                            aria-label="Next image"
                                        >
                                            <span className="material-icons text-[18px]">east</span>
                                        </button>
                                        </div>
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

                                {/* Patient ID */}
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <span className="material-icons text-[12px]">local_hospital</span>
                                        PACS Patient ID
                                    </div>
                                    <div className="text-xl sm:text-2xl font-black text-white tracking-wide leading-none select-text">
                                        {patientId || 'PENDING'}
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
                                            {new Date(caseData.created_at).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
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
                        {(normalizedEducationalSummary || normalizedReferences.length > 0) && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                    <h3 className="text-[10px] font-bold text-slate-600/70 uppercase tracking-widest">
                                        NOTES
                                    </h3>
                                    <div className="h-[1px] flex-1 bg-white/[0.015]"></div>
                                </div>
                                {normalizedEducationalSummary ? (
                                    <div
                                        className="case-rich-preview text-[13px] text-slate-300/90 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(normalizedEducationalSummary) }}
                                    />
                                ) : (
                                    <p className="text-[13px] text-slate-400/80 leading-relaxed">No notes recorded.</p>
                                )}
                                {normalizedReferences.length > 0 && (
                                    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.025] px-4 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">References</p>
                                        <div className="mt-3 space-y-2.5">
                                            {normalizedReferences.map((reference, index) => (
                                                <div key={`${getReferenceDisplayText(reference)}-${reference.page}-${index}`} className="text-sm leading-relaxed text-slate-300">
                                                    <p className="font-medium text-white/90">{index + 1}. {getReferenceDisplayText(reference)}</p>
                                                    {reference.page && <p className="text-xs text-slate-400">{reference.page}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
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

                                  .case-rich-preview ul {
                                    list-style-type: disc;
                                  }

                                  .case-rich-preview ol {
                                    list-style-type: decimal;
                                  }

                                  .case-rich-preview ul ul {
                                    list-style-type: circle;
                                  }

                                  .case-rich-preview ol ol {
                                    list-style-type: lower-alpha;
                                  }

                                  .case-rich-preview li {
                                    display: list-item;
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
                    <div className="space-y-4 pt-4 pb-28 relative z-10">
                        {canShowShareActions ? (
                            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <button
                                        onClick={handleCopyCaseText}
                                        disabled={isPreparingShare}
                                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl ${theme.buttonBg} px-4 py-3.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
                                    >
                                        <span className="material-icons text-[18px]">content_copy</span>
                                        <span>Copy Case Text</span>
                                    </button>
                                    <button
                                        onClick={handleShareToViber}
                                        disabled={isPreparingShare}
                                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl ${theme.buttonBg} px-4 py-3.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
                                    >
                                        <span className="material-icons text-[18px]">send</span>
                                        <span>{isPreparingShare ? 'Opening Viber...' : 'Share to Viber'}</span>
                                    </button>
                                    <button
                                        onClick={handleExportPDF}
                                        disabled={isExportingPdf}
                                        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl ${theme.buttonBg} px-4 py-3.5 text-[13px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        <span className="material-icons text-[16px]">picture_as_pdf</span>
                                        <span className="truncate">{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={handleExportPDF}
                                    disabled={isExportingPdf}
                                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl ${theme.buttonBg} py-3.5 w-full text-[13px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <span className="material-icons text-[16px]">picture_as_pdf</span>
                                    <span className="truncate">{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Discussion Section */}
                    {!isPublicMode && (
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
                    )}

                </div >
            </div >
        </div >
    );
};

export default CaseViewScreen;
