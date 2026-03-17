import { useState } from 'react';
import { supabase } from '../services/supabase';
import { createSystemNotification, fetchAllRecipientUserIds } from '../services/newsfeedService';
import { loadGenerateCasePDF } from '../services/pdfServiceLoader';
import { toastError, toastSuccess } from '../utils/toast';

export interface ImageUpload {
    url: string;
    file: File;
    description: string;
}

interface SaveCaseParams {
    status: 'draft' | 'published';
    existingCase: any;
    formData: any;
    customTitle: string;
    images: ImageUpload[];
    onSuccess?: (savedId: string, diagnosisCode: string) => void;
    onSetFormData?: (updates: any) => void;
}

export function useCaseSubmission() {
    const [isSaving, setIsSaving] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const saveCase = async ({
        status,
        existingCase,
        formData,
        customTitle,
        images,
        onSuccess,
        onSetFormData
    }: SaveCaseParams) => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            // Auto-generate Diagnostic Code if publishing and doesn't exist
            let finalDiagnosis = formData.diagnosis;
            if (status === 'published' && !finalDiagnosis) {
                finalDiagnosis = 'RAD-' + Math.floor(100000 + Math.random() * 900000).toString();
                if (onSetFormData) onSetFormData({ diagnosis: finalDiagnosis });
            }

            // 1. Upload New Images (Parallel Uploads)
            const uploadPromises = images.map(async (img, i) => {
                if (img.file.size === 0 && img.url.startsWith('http')) {
                    // Existing image
                    return img.url;
                } else {
                    // New image
                    const blob = img.file;
                    const fileName = `${user.id}/${Date.now()}_${i}_${Math.random().toString(36).substring(2, 9)}.png`;

                    const { error: uploadError } = await supabase.storage
                        .from('case-images')
                        .upload(fileName, blob);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('case-images')
                        .getPublicUrl(fileName);

                    return publicUrl;
                }
            });

            const distinctUploadedUrls = await Promise.all(uploadPromises);

            const imageMetadata = images.map(img => ({ description: img.description }));
            const isMinimalSubmission = formData.submissionType === 'rare_pathology' || formData.submissionType === 'aunt_minnie';
            const existingAnalysisResult = existingCase?.analysis_result ?? {};
            const reference = formData.referenceSourceType || formData.referenceTitle || formData.referencePage
                ? {
                    sourceType: formData.referenceSourceType,
                    title: formData.referenceTitle,
                    page: formData.referencePage,
                }
                : undefined;

            const analysisResult = {
                ...existingAnalysisResult,
                modality: isMinimalSubmission ? null : formData.modality,
                anatomy_region: isMinimalSubmission ? null : formData.organSystem,
                keyFindings: [formData.findings],
                impression: isMinimalSubmission ? null : formData.impression,
                educationalSummary: formData.submissionType === 'rare_pathology' ? null : formData.notes,
                imagesMetadata: imageMetadata,
                studyDate: formData.date
            } as Record<string, unknown>;

            if (reference) {
                analysisResult.reference = reference;
            } else {
                delete analysisResult.reference;
            }

            const casePayload = {
                title: customTitle
                    || (formData.submissionType === 'rare_pathology' ? 'Rare Pathology Case' : formData.submissionType === 'aunt_minnie' ? 'Aunt Minnie Case' : `Case: ${formData.initials}`),
                patient_initials: isMinimalSubmission ? null : formData.initials,
                patient_age: isMinimalSubmission ? null : formData.age,
                patient_sex: isMinimalSubmission ? null : formData.sex,
                clinical_history: formData.submissionType === 'aunt_minnie' ? null : formData.clinicalData,
                educational_summary: formData.submissionType === 'rare_pathology' ? null : formData.notes,
                radiologic_clinchers: formData.submissionType === 'rare_pathology' ? formData.radiologicClinchers : null,
                submission_type: formData.submissionType,
                findings: formData.findings,
                image_url: distinctUploadedUrls[0], // Primary thumbnail
                image_urls: distinctUploadedUrls,   // All images
                difficulty: 'Medium',
                created_by: user.id,
                category: isMinimalSubmission ? null : formData.organSystem,
                organ_system: isMinimalSubmission ? null : formData.organSystem,
                diagnosis: finalDiagnosis,
                analysis_result: analysisResult,
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
                    if (formData.submissionType !== 'interesting_case') {
                        toastError(
                            'Database migration required',
                            'Please run the latest Supabase migration to use Rare Pathology and Aunt Minnie.'
                        );
                        setIsSaving(false);
                        return;
                    }

                    const { radiologic_clinchers, submission_type, ...legacyPayload } = casePayload as any;
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
                toastSuccess('Case published', `Diagnostic Code: ${finalDiagnosis}`);
            } else {
                toastSuccess('Private draft saved');
            }

            if (onSuccess) {
                onSuccess(savedCaseId!, finalDiagnosis);
            }

        } catch (error: any) {
            console.error('Error saving case:', error);
            toastError('Failed to save case', error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const exportPdf = async (
        formData: any,
        customTitle: string,
        uploaderName: string,
        images: ImageUpload[]
    ) => {
        setIsExportingPdf(true);
        try {
            const generateCasePDF = await loadGenerateCasePDF().catch((error) => {
                throw new Error(`Unable to load export module: ${String(error)}`);
            });
            const getImagesForPdf = () => images.map(img => ({
                url: img.url,
                description: img.description
            }));
            generateCasePDF({ ...formData }, null, getImagesForPdf(), customTitle, uploaderName);
        } catch (e) {
            console.error('Export failed:', e);
            const message = e instanceof Error ? e.message : String(e);
            const title = message.includes('Unable to load export module') ? 'Unable to load export module' : 'Export failed';
            toastError(title, message);
        } finally {
            setIsExportingPdf(false);
        }
    };

    return {
        saveCase,
        exportPdf,
        isSaving,
        isExportingPdf
    };
}
