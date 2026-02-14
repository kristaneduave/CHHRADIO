
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AnalysisResult, CaseData } from '../types';

declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

export const generateCasePDF = (data: any, unusedAnalysis: any, imageUrl: string | null) => {
    const doc = new jsPDF();
    const {
        initials, age, sex, modality, organ, findings, impression, notes
    } = data;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(0, 51, 102);
    doc.text('Radiology Case Report', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(new Date().toLocaleDateString(), 180, 22, { align: 'right' });

    // 8-Field Table
    doc.autoTable({
        startY: 30,
        head: [['Field', 'Details']],
        body: [
            ['Initials', initials],
            ['Age', age],
            ['Sex', sex],
            ['Modality', modality],
            ['Organ', organ],
            ['Findings', findings],
            ['Impression', impression],
            ['Notes', notes]
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 102, 204] }, // Primary Blue
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40 },
            1: { cellWidth: 'auto' }
        }
    });

    // Image (if exists)
    let finalY = (doc as any).lastAutoTable.finalY + 10;

    if (imageUrl) {
        if (finalY > 200) {
            doc.addPage();
            finalY = 20;
        }

        try {
            const imgProps = doc.getImageProperties(imageUrl);
            const pdfWidth = 120;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            doc.text('Diagnostic Image:', 14, finalY);
            doc.addImage(imageUrl, 'PNG', 14, finalY + 5, pdfWidth, pdfHeight);
        } catch (e) {
            console.error('Error adding image to PDF', e);
        }
    }

    // Save
    const safeInitials = (initials || 'Pt').replace(/[^a-z0-9]/gi, '_');
    const safeImpression = (impression || 'Case').substring(0, 15).replace(/[^a-z0-9]/gi, '_');
    const dateStr = new Date().toISOString().split('T')[0];

    const filename = `${dateStr}_${safeInitials}_${safeImpression}.pdf`;
    doc.save(filename);
};
