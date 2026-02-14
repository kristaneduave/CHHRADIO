
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisResult, CaseData } from '../types';

export const generateCasePDF = (
    data: any,
    unusedAnalysis: any,
    images: Array<{ url: string, description?: string }> | string[] | string | null,
    customTitle?: string,
    uploaderName?: string
) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        let yPos = 0;

        const {
            initials, age, sex, modality, organSystem, findings, impression, notes, diagnosis, clinical_history
        } = data;

        // --- 1. Header Section ---
        doc.setFillColor(0, 102, 204); // Primary Blue
        doc.rect(0, 0, pageWidth, 40, 'F'); // Compact header height

        // Title
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(customTitle || 'Radiology Case Report', margin, 20);

        yPos = 55; // Start content higher up

        // --- 2. Patient & Exam Metadata ---
        const col1X = margin;
        const col2X = pageWidth / 2 + 10;

        doc.setTextColor(0, 0, 0);

        // Column 1: Patient
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text('PATIENT', col1X, yPos);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 20, 20);
        doc.text(`${initials || 'N/A'}  |  ${age || '?'} yo  |  ${sex || '?'}`, col1X + 25, yPos);

        // Column 2: Date
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text('DATE', col2X, yPos);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 20, 20);
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        doc.text(dateStr, col2X + 20, yPos);

        yPos += 8;

        // Row 2: Clinical Details
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text('EXAM', col1X, yPos);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 20, 20);
        doc.text(`${modality || 'N/A'}  -  ${organSystem || 'N/A'}`, col1X + 25, yPos);

        // Column 2 Row 2: Diagnostic Code
        const rawCode = diagnosis || data.diagnosticCode;
        if (rawCode && !rawCode.toUpperCase().includes('PENDING')) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 102, 204);
            doc.text('CODE', col2X, yPos);

            doc.setFont('helvetica', 'bold'); // Bold for the code itself
            doc.setTextColor(20, 20, 20);
            doc.text(rawCode, col2X + 20, yPos);
        }

        yPos += 20; // Space before findings

        // --- 3. Findings ---
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('FINDINGS', margin, yPos);
        yPos += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const findingsText = findings || 'No specific findings recorded.';
        const splitFindings = doc.splitTextToSize(findingsText, pageWidth - (margin * 2));
        doc.text(splitFindings, margin, yPos);
        yPos += (splitFindings.length * 5) + 8; // Compact spacing

        // --- 4. Clinical Notes ---
        const notesText = notes || clinical_history;
        if (notesText) {
            if (yPos + 30 > pageHeight) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('CLINICAL NOTES', margin, yPos);
            yPos += 6;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(40, 40, 40);

            const splitNotes = doc.splitTextToSize(notesText, pageWidth - (margin * 2));
            doc.text(splitNotes, margin, yPos);
            yPos += (splitNotes.length * 5) + 8;
        }

        // --- FORCE PAGE BREAK FOR IMPRESSION & IMAGES ---
        doc.addPage();
        yPos = 20;

        // --- 5. Impression ---
        doc.setFontSize(11); // Same size as other headers
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('IMPRESSION', margin, yPos);
        yPos += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold'); // Keep content bold
        doc.setTextColor(0, 0, 0);
        const impText = impression || diagnosis || 'Pending Diagnosis';

        const splitImpression = doc.splitTextToSize(impText, pageWidth - (margin * 2));
        doc.text(splitImpression, margin, yPos);

        yPos += (splitImpression.length * 6) + 15; // Space before images

        // --- 6. Image Gallery (2-Column Grid) ---
        let imageList: Array<{ url: string, description?: string }> = [];
        if (Array.isArray(images)) {
            imageList = images.map(img => {
                if (typeof img === 'string') return { url: img, description: '' };
                return img;
            });
        } else if (typeof images === 'string') {
            imageList = [{ url: images, description: '' }];
        }

        if (imageList.length > 0) {
            // No Header needed, implicit

            const colWidth = (pageWidth - (margin * 3)) / 2; // 2 columns with margin gap
            let currentRowMaxHeight = 0;

            imageList.forEach((img, index) => {
                // Page Check
                if (yPos + 50 > pageHeight) {
                    doc.addPage();
                    yPos = 20;
                    currentRowMaxHeight = 0;
                }

                const x = index % 2 === 0 ? margin : margin + colWidth + margin;

                try {
                    const imgProps = doc.getImageProperties(img.url);
                    const imgHeight = (imgProps.height * colWidth) / imgProps.width;

                    if (imgHeight > currentRowMaxHeight) {
                        currentRowMaxHeight = imgHeight;
                    }

                    doc.addImage(img.url, 'JPEG', x, yPos, colWidth, imgHeight);
                    // No border

                    if (img.description) {
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(80, 80, 80);
                        const desc = doc.splitTextToSize(img.description, colWidth);
                        doc.text(desc, x, yPos + imgHeight + 4);
                    }

                } catch (e) {
                    // Error placeholder
                    const fallbackHeight = colWidth * 0.75;
                    doc.setFillColor(245, 245, 245);
                    doc.rect(x, yPos, colWidth, fallbackHeight, 'F');
                    doc.setFontSize(8);
                    doc.setTextColor(255, 0, 0);
                    doc.text('Image Error', x + 5, yPos + 10);
                    if (fallbackHeight > currentRowMaxHeight) currentRowMaxHeight = fallbackHeight;
                }

                if (index % 2 === 1 || index === imageList.length - 1) {
                    yPos += currentRowMaxHeight + 10; // Tighter spacing
                    currentRowMaxHeight = 0;
                }
            });
        }

        // --- 7. Footer (Page Numbers) ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);

            // Only Page Number
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }

        // --- Save ---
        const safeTitle = (customTitle || 'Case').replace(/[^a-z0-9]/gi, '_').substring(0, 20);
        const safeInitials = (initials || 'Pt').replace(/[^a-z0-9]/gi, '_');
        const filename = `${dateStr}_${safeTitle}_${safeInitials}.pdf`;
        doc.save(filename);

    } catch (error: any) {
        console.error('CRITICAL PDF ERROR:', error);
        alert('Failed to generate PDF. Error: ' + (error.message || error));
    }
};
