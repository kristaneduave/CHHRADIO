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
  } = data;

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
${notes || 'No notes provided.'}`;
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
${notes || 'No notes provided.'}`;
};
