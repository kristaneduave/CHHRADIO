import { CaseData } from '../types';

export const generateViberText = (data: any): string => {
    const {
        initials,
        age,
        sex,
        modality,
        organ,
        findings,
        impression,
        notes
    } = data;

    return `🚨 *INTERESTING CASE* 🚨

👤 *Pt:* ${initials || 'N/A'} (${age || '?'} / ${sex || '?'})
📷 *Modality:* ${modality || 'N/A'}
🧠 *Organ:* ${organ || 'N/A'}

📝 *Findings:*
${findings || 'No specific findings.'}

💡 *Impression:*
${impression || 'Pending Diagnosis'}

📌 *Notes:*
${notes || 'No notes provided.'}`;
};
