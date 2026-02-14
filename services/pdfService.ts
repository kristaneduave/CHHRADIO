
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisResult, CaseData } from '../types';

export const generateCasePDF = (
    data: any,
    unusedAnalysis: any,
    images: Array<{ url: string, description?: string }> | string[] | string | null,
    customTitle?: string,
    uploaderName?: string,
    customFileName?: string
) => {
    try {
        const doc = new jsPDF();
        // ... (lines 14-239 unchanged effectively, just updating signature)

        // --- Save ---
        let filename = 'Case_Report.pdf';
        if (customFileName) {
            // Sanitize but keep structure
            filename = customFileName.replace(/[^a-z0-9 \-\(\)\_\.]/gi, '_') + '.pdf';
        } else {
            const safeTitle = (customTitle || 'Case').replace(/[^a-z0-9]/gi, '_').substring(0, 20);
            const safeInitials = (data.initials || 'Pt').replace(/[^a-z0-9]/gi, '_');
            const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).replace(/\//g, '-');
            filename = `${dateStr}_${safeTitle}_${safeInitials}.pdf`;
        }

        doc.save(filename);

    } catch (error: any) {
        console.error('CRITICAL PDF ERROR:', error);
        alert('Failed to generate PDF. Error: ' + (error.message || error));
    }
};
