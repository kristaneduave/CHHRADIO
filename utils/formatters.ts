const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripHtmlToPlainText = (value: string) => {
  if (!value) return '';
  if (typeof window === 'undefined') {
    return collapseWhitespace(value.replace(/<[^>]+>/g, ' '));
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  return collapseWhitespace(doc.body.textContent || '');
};

const compactText = (value: unknown, maxLength: number) => {
  const normalized = collapseWhitespace(String(value || ''));
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const getSubmissionLabel = (submissionType?: string) => {
  if (submissionType === 'rare_pathology') return 'Rare Pathology';
  if (submissionType === 'aunt_minnie') return 'Aunt Minnie';
  return 'Case';
};

export const generateViberText = (data: any): string => {
  const {
    submissionType,
    initials,
    age,
    sex,
    modality,
    organSystem,
    clinicalData,
    findings,
    impression,
    notes,
    diagnosis,
    patientId,
    publicUrl,
    title,
  } = data;

  const previewTitle = compactText(
    title || impression || diagnosis || getSubmissionLabel(submissionType),
    110
  );
  const normalizedPatientId = String(patientId || diagnosis || '').trim();
  const notesText = stripHtmlToPlainText(String(notes || ''));

  if (publicUrl) {
    const summary =
      submissionType === 'rare_pathology'
        ? compactText(
            `${findings || ''} ${data.radiologicClinchers || data.radiologic_clinchers || ''}`.trim(),
            220
          )
        : submissionType === 'aunt_minnie'
          ? compactText(`${findings || ''} ${notesText || ''}`.trim(), 180)
          : compactText(`${findings || ''} ${impression || ''}`.trim(), 220);

    const examLabel = [modality, organSystem].filter(Boolean).join(' - ');

    return [
      '*CHH Radiology Portal*',
      `*${getSubmissionLabel(submissionType)} Report*`,
      previewTitle ? `Case: ${previewTitle}` : null,
      examLabel ? `Exam: ${examLabel}` : null,
      normalizedPatientId ? `PACS Patient ID: ${normalizedPatientId}` : null,
      summary ? `Summary: ${summary}` : null,
      'Full report:',
      publicUrl,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (submissionType === 'rare_pathology') {
    return `*RARE PATHOLOGY*

*Clinical Data:*
${clinicalData || 'No clinical data provided.'}

*Findings:*
${findings || 'No specific findings.'}

*Radiologic Clinchers:*
${data.radiologicClinchers || data.radiologic_clinchers || 'No radiologic clinchers provided.'}`;
  }

  if (submissionType === 'aunt_minnie') {
    return `*AUNT MINNIE*

*Description:*
${findings || 'No description provided.'}

*Notes / Remarks:*
${notesText || 'No notes provided.'}`;
  }

  return `*INTERESTING CASE*

*Pt:* ${initials || 'N/A'} (${age || '?'} / ${sex || '?'})
*Exam:* ${modality || 'N/A'} - ${organSystem || 'N/A'}
${clinicalData ? `*Clinical:* ${clinicalData}` : ''}

*Findings:*
${findings || 'No specific findings.'}

*Impression:*
${impression || 'Pending Diagnosis'}
${diagnosis ? `*Code:* ${diagnosis}` : ''}

*Notes:*
${notesText || 'No notes provided.'}`;
};

export const generateConsultantShareText = (data: any): string => {
  const publicUrl = String(data?.publicUrl || '').trim();
  const impressionText = compactText(
    data?.impression || data?.title || data?.diagnosis || '',
    220
  );

  if (!publicUrl) {
    return '';
  }

  return [
    impressionText ? `Impression: ${impressionText}` : null,
    'Please click the link for the full report:',
    publicUrl,
  ]
    .filter(Boolean)
    .join('\n\n');
};
