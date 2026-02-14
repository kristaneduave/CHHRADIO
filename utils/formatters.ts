import { CaseData } from '../types';

export const generateViberText = (data: any): string => {
    const {
        initials,
        age,
        sex,
        modality,
        organSystem,
        clinicalData,
        findings,
        impression,
        reliability,
        notes,
        diagnosis
    } = data;

    return `🚨 *INTERESTING CASE* 🚨
    
🎯 *Reliability:* ${reliability || 'N/A'}

👤 *Pt:* ${initials || 'N/A'} (${age || '?'} / ${sex || '?'})
📷 *Exam:* ${modality || 'N/A'} - ${organSystem || 'N/A'}
${clinicalData ? `📋 *Clinical:* ${clinicalData}` : ''}

📝 *Findings:*
${findings || 'No specific findings.'}

💡 *Impression:*
${impression || 'Pending Diagnosis'}
${diagnosis ? `🔑 *Code:* ${diagnosis}` : ''}

📌 *Notes:*
${notes || 'No notes provided.'}`;
};
