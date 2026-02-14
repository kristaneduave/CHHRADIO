
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AnalysisResult, CaseData } from '../types';

declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

export const generateCasePDF = (caseData: CaseData, analysis: AnalysisResult, imageUrls: string[] | null) => {
    const doc = new jsPDF();
    const marginLeft = 20;
    let cursorY = 20;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 102, 204); // Primary Blue
    doc.text('Clinical Case Report', marginLeft, cursorY);
    cursorY += 10;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, marginLeft, cursorY);
    cursorY += 15;

    // Patient Info Block
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, cursorY, 190, cursorY);
    cursorY += 10;

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Patient Demographics', marginLeft, cursorY);
    cursorY += 8;

    doc.setFontSize(11);
    doc.text(`Initials: ${caseData.initials}`, marginLeft, cursorY);
    doc.text(`Age: ${caseData.age}`, marginLeft + 50, cursorY);
    doc.text(`Sex: ${caseData.gender || 'N/A'}`, marginLeft + 100, cursorY);
    cursorY += 7;
    doc.text(`Specialty: ${caseData.specialty}`, marginLeft, cursorY);
    cursorY += 15;

    // Clinical History
    doc.setFontSize(14);
    doc.text('Clinical Presentation', marginLeft, cursorY);
    cursorY += 8;
    doc.setFontSize(11);
    const splitHistory = doc.splitTextToSize(caseData.clinicalHistory || 'No history provided.', 170);
    doc.text(splitHistory, marginLeft, cursorY);
    cursorY += (splitHistory.length * 7) + 10;

    // Images Loop
    if (imageUrls && imageUrls.length > 0) {
        doc.addPage();
        cursorY = 20;
        doc.setFontSize(14);
        doc.setTextColor(0, 102, 204);
        doc.text('Diagnostic Imaging', marginLeft, cursorY);
        cursorY += 10;

        imageUrls.forEach((url, index) => {
            if (cursorY > 200) { doc.addPage(); cursorY = 20; }
            try {
                // Determine layout. If multiple, fit 2 per page? 
                // For simplicity, 2 per page roughly.
                const imgProps = doc.getImageProperties(url);
                const pdfWidth = 120;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                doc.text(`Image ${index + 1}`, marginLeft, cursorY);
                cursorY += 5;
                doc.addImage(url, 'PNG', marginLeft, cursorY, pdfWidth, pdfHeight);
                cursorY += pdfHeight + 15;

            } catch (e) {
                console.error("Error adding image", e);
            }
        });
    }

    // Findings
    if (cursorY > 250) { doc.addPage(); cursorY = 20; }

    doc.setFontSize(14);
    doc.setTextColor(0, 102, 204);
    doc.text('Radiographic Findings', marginLeft, cursorY);
    cursorY += 10;

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    // Manual Findings (from textarea)
    if (caseData.findings) {
        const splitFindings = doc.splitTextToSize(caseData.findings, 170);
        doc.text(splitFindings, marginLeft, cursorY);
        cursorY += (splitFindings.length * 7) + 5;
    }

    // AI/Manual Key Findings (if any remained from AnalysisResult structure)
    if (analysis && analysis.keyFindings && analysis.keyFindings.length > 0) {
        analysis.keyFindings.forEach((finding) => {
            if (finding !== caseData.findings) { // Duplicate check if we mapped manual to keyFindings
                doc.text(`• ${finding}`, marginLeft + 5, cursorY);
                cursorY += 7;
            }
        });
    }
    cursorY += 10;

    // Teaching Points / Pearls (Manual or AI)
    if (cursorY > 230) { doc.addPage(); cursorY = 20; }

    // Use CaseData values primarily for manual flow
    const pearl = caseData.pearl || analysis.pearl;
    const points = caseData.teachingPoints || analysis.teachingPoints;

    if (pearl || points) {
        doc.setFontSize(12);
        doc.setTextColor(0, 100, 0); // Dark Green
        doc.text('Educational Pearls', marginLeft, cursorY);
        cursorY += 8;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        if (pearl) {
            const splitPearl = doc.splitTextToSize(`💡 Pearl: ${pearl}`, 170);
            doc.text(splitPearl, marginLeft, cursorY);
            cursorY += (splitPearl.length * 6) + 5;
        }

        if (points) {
            doc.text('Key Points:', marginLeft, cursorY);
            cursorY += 6;
            const ptArray = Array.isArray(points) ? points : [points];
            ptArray.forEach((tp: string) => {
                const splitTp = doc.splitTextToSize(`• ${tp}`, 160);
                doc.text(splitTp, marginLeft + 5, cursorY);
                cursorY += (splitTp.length * 6) + 2;
            });
        }
    }

    // Disclaimer Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Disclaimer: Generated Report. Not for clinical use.', marginLeft, 285);
        doc.text(`Page ${i} of ${pageCount}`, 170, 285);
    }

    doc.save(`Case_${caseData.initials}.pdf`);
};
