import { normalizeRichTextNotesHtml } from '../utils/richTextNotesNormalizer';

// Turns a cases row into the arguments of generateCasePDF / renderCasePdfBlob, so the download and
// the Google Drive archive produce the same document.
export const buildCasePdfInput = (caseData: any) => {
  const submissionType = caseData.submission_type || 'interesting_case';
  const caseSource = submissionType === 'interesting_case'
    ? String(caseData.analysis_result?.caseSource || caseData.analysis_result?.case_source || '').trim() || null
    : null;
  const imageUrls: string[] = caseData.image_urls || [caseData.image_url].filter(Boolean);
  const images = imageUrls.map((url: string, idx: number) => ({
    url,
    description: caseData.analysis_result?.imagesMetadata?.[idx]?.description || '',
  }));

  const data = {
    submissionType,
    initials: caseData.patient_initials,
    age: caseData.patient_age,
    sex: caseData.patient_sex,
    modality: caseData.modality,
    organSystem: caseData.organ_system,
    findings: caseData.findings,
    impression: caseData.title || caseData.analysis_result?.impression || caseData.diagnosis,
    notes: normalizeRichTextNotesHtml(caseData.educational_summary),
    clinicalData: caseData.clinical_history || caseData.clinicalData,
    radiologicClinchers: caseData.radiologic_clinchers,
    pearl: caseData.pearl || caseData.analysis_result?.pearl,
    additionalNotes: caseData.notes,
    uploadDate: caseData.created_at,
    // Same value the case screen shows as Patient ID; older cases keep it in diagnosis.
    patientId: String(caseData.analysis_result?.patientId || '').trim() || String(caseData.diagnosis || '').trim() || null,
    caseSource,
    reference: caseData.analysis_result?.reference,
    references: caseData.analysis_result?.references,
    title: caseData.title,
  };

  return {
    data,
    images,
    // Header: user input title (e.g. "SINONASAL MENINGIOMA"); file name: the title too.
    headerTitle: (caseData.title || 'RADIOLOGY CASE').toUpperCase(),
    fileName: `${caseData.title || 'CASE'}`.toUpperCase(),
  };
};
