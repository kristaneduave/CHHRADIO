
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
        const margin = 15;
        let yPos = 0;

        const {
            initials, age, sex, modality, organSystem, findings, impression, notes, diagnosis, clinical_history
        } = data;

        // --- 1. Header Section ---
        // Blue Banner
        doc.setFillColor(0, 102, 204); // Primary Blue
        doc.rect(0, 0, pageWidth, 40, 'F');

        // Title
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(customTitle || 'Radiology Case Report', margin, 20);

        // Sub-header Info (Right aligned)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(dateStr, pageWidth - margin, 15, { align: 'right' });

        const diagnosticCode = diagnosis || data.diagnosticCode || 'PENDING';
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`CODE: ${diagnosticCode}`, pageWidth - margin, 28, { align: 'right' });

        yPos = 55;

        // --- 2. Patient & Exam Metadata (2-Column Grid) ---
        const col1X = margin;
        const col2X = pageWidth / 2 + 5;

        doc.setTextColor(0, 0, 0);

        // Column 1: Patient
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text('PATIENT DETAILS', col1X, yPos);
        yPos += 8;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(`Initials: ${initials || 'N/A'}`, col1X, yPos);
        yPos += 6;
        doc.text(`Age/Sex: ${age || '?'} / ${sex || '?'}`, col1X, yPos);

        // Reset Y for Col 2
        yPos -= 14;

        // Column 2: Exam
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text('EXAM DETAILS', col2X, yPos);
        yPos += 8;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(`Modality: ${modality || 'N/A'}`, col2X, yPos);
        yPos += 6;
        doc.text(`Organ System: ${organSystem || 'N/A'}`, col2X, yPos);

        yPos += 15;

        // Line Divider
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;

        // --- 3. Clinical Findings ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('FINDINGS', margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const findingsText = findings || 'No specific findings recorded.';
        const splitFindings = doc.splitTextToSize(findingsText, pageWidth - (margin * 2));
        doc.text(splitFindings, margin, yPos);
        yPos += (splitFindings.length * 5) + 10;

        // --- 4. Impression (Highlighted Box) ---
        // Check for page break
        if (yPos + 40 > pageHeight) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(240, 248, 255); // AliceBlue background
        doc.setDrawColor(0, 102, 204);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 25, 'FD');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text('IMPRESSION', margin + 5, yPos + 8);

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0); // Black text for diagnosis
        const impText = impression || diagnosis || 'Pending Diagnosis';

        // Handle long impression text
        const splitImpression = doc.splitTextToSize(impText, pageWidth - (margin * 2) - 10);
        doc.text(splitImpression, margin + 5, yPos + 18);

        yPos += 25 + 10; // Box height + spacing

        // --- 5. Clinical Notes (Optional) ---
        const notesText = notes || clinical_history;
        if (notesText) {
            if (yPos + 30 > pageHeight) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            const prefix = 'Clinical Notes: ';
            const splitNotes = doc.splitTextToSize(prefix + notesText, pageWidth - (margin * 2));
            doc.text(splitNotes, margin, yPos);
            yPos += (splitNotes.length * 5) + 10;
        }

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
            // Start images on a new page if not enough space
            if (yPos + 100 > pageHeight) {
                doc.addPage();
                yPos = 20;
            } else {
                yPos += 10;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('DIAGNOSTIC IMAGING', margin, yPos);
            yPos += 10;

            const colWidth = (pageWidth - (margin * 3)) / 2; // 2 columns with margin gap
            const imgHeight = colWidth * 0.75; // 4:3 Aspect Ratio standard

            imageList.forEach((img, index) => {
                // Check if we need a new page
                // If it's the second image in a row, we check Y pos from the row start
                // We increment Y only after completing a row (every 2 images)

                if (index % 2 === 0) {
                    if (yPos + imgHeight + 20 > pageHeight) {
                        doc.addPage();
                        yPos = 20;
                    }
                }

                const x = index % 2 === 0 ? margin : margin + colWidth + margin;

                try {
                    // Draw Image
                    doc.addImage(img.url, 'JPEG', x, yPos, colWidth, imgHeight);

                    // Draw box/border around image
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(x, yPos, colWidth, imgHeight);

                    // Caption
                    if (img.description) {
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(80, 80, 80);
                        const desc = doc.splitTextToSize(img.description, colWidth);
                        doc.text(desc, x, yPos + imgHeight + 5);
                    }

                } catch (e) {
                    console.error('Image load error', e);
                    doc.setFillColor(240, 240, 240);
                    doc.rect(x, yPos, colWidth, imgHeight, 'F');
                    doc.setTextColor(255, 0, 0);
                    doc.setFontSize(8);
                    doc.text('Image Load Error', x + 5, yPos + 10);
                }

                // If this was the second image in the row, or the last image, move Y down
                if (index % 2 === 1 || index === imageList.length - 1) {
                    yPos += imgHeight + 15; // Row height + spacing
                }
            });
        }

        // --- 7. Footer ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);

            // Left Footer
            doc.text('Confidential Medical Report - Use with Discretion', margin, pageHeight - 10);

            // Right Footer
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
