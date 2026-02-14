
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
        const margin = 20; // Increased margin for better readability
        let yPos = 0;

        const {
            initials, age, sex, modality, organSystem, findings, impression, notes, diagnosis, clinical_history
        } = data;

        // --- 1. Header Section ---
        // Blue Banner
        doc.setFillColor(0, 102, 204); // Primary Blue
        doc.rect(0, 0, pageWidth, 45, 'F'); // Slightly taller

        // Title
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(customTitle || 'Radiology Case Report', margin, 25);

        // Sub-header Info (Right aligned)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(dateStr, pageWidth - margin, 18, { align: 'right' });

        // Only show code if it's a real code (not "Pending")
        const rawCode = diagnosis || data.diagnosticCode;
        if (rawCode && !rawCode.toUpperCase().includes('PENDING')) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`CODE: ${rawCode}`, pageWidth - margin, 32, { align: 'right' });
        }

        yPos = 60;

        // --- 2. Patient & Exam Metadata (2-Column Grid) ---
        const col1X = margin;
        const col2X = pageWidth / 2 + 10;

        doc.setTextColor(0, 0, 0);

        // Column 1: Patient
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text('PATIENT DETAILS', col1X, yPos);
        yPos += 10;

        doc.setFontSize(11); // Slightly larger
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 20, 20); // Darker gray
        doc.text(`Initials: ${initials || 'N/A'}`, col1X, yPos);
        yPos += 7;
        doc.text(`Age/Sex: ${age || '?'} / ${sex || '?'}`, col1X, yPos);

        // Reset Y for Col 2
        yPos -= 17;

        // Column 2: Exam
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text('EXAM DETAILS', col2X, yPos);
        yPos += 10;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 20, 20);
        doc.text(`Modality: ${modality || 'N/A'}`, col2X, yPos);
        yPos += 7;
        doc.text(`Organ System: ${organSystem || 'N/A'}`, col2X, yPos);

        yPos += 20;

        // Line Divider
        doc.setDrawColor(220, 220, 220); // Lighter line
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 15;

        // --- 3. Findings (Emphasized) ---
        doc.setFontSize(14); // Larger header
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('FINDINGS', margin, yPos);
        yPos += 10;

        doc.setFontSize(11); // Readable body text
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const findingsText = findings || 'No specific findings recorded.';
        const splitFindings = doc.splitTextToSize(findingsText, pageWidth - (margin * 2));
        doc.text(splitFindings, margin, yPos);
        yPos += (splitFindings.length * 6) + 15; // More spacing

        // --- 4. Clinical Notes (Moved Up & Emphasized) ---
        const notesText = notes || clinical_history;
        if (notesText) {
            if (yPos + 40 > pageHeight) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('CLINICAL NOTES', margin, yPos);
            yPos += 10;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'italic'); // Keep italic but standard color
            doc.setTextColor(20, 20, 20);

            const splitNotes = doc.splitTextToSize(notesText, pageWidth - (margin * 2));
            doc.text(splitNotes, margin, yPos);
            yPos += (splitNotes.length * 6) + 15;
        }

        // --- 5. Impression (De-emphasized / Standardized) ---
        if (yPos + 30 > pageHeight) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102); // Same header style as Findings
        doc.text('IMPRESSION', margin, yPos);
        yPos += 10;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold'); // Bold text but no box
        doc.setTextColor(0, 0, 0);
        const impText = impression || diagnosis || 'Pending Diagnosis';

        const splitImpression = doc.splitTextToSize(impText, pageWidth - (margin * 2));
        doc.text(splitImpression, margin, yPos);

        yPos += (splitImpression.length * 7) + 20;

        // --- 6. Image Gallery (2-Column Grid with Aspect Ratio) ---
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
            if (yPos + 80 > pageHeight) {
                doc.addPage();
                yPos = 25;
            } else {
                yPos += 10;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('DIAGNOSTIC IMAGING', margin, yPos);
            yPos += 15;

            const colWidth = (pageWidth - (margin * 3)) / 2; // 2 columns with margin gap

            // Track height of the tallest image in the current row to know where to start the next row
            let currentRowMaxHeight = 0;

            imageList.forEach((img, index) => {
                // New Page Check
                if (yPos + 50 > pageHeight) {
                    doc.addPage();
                    yPos = 25;
                    currentRowMaxHeight = 0;
                }

                const x = index % 2 === 0 ? margin : margin + colWidth + margin;

                try {
                    // Get aspect ratio
                    const imgProps = doc.getImageProperties(img.url);
                    const imgHeight = (imgProps.height * colWidth) / imgProps.width;

                    // Update row height tracker
                    if (imgHeight > currentRowMaxHeight) {
                        currentRowMaxHeight = imgHeight;
                    }

                    // Draw Image
                    doc.addImage(img.url, 'JPEG', x, yPos, colWidth, imgHeight);

                    // Border (Optional - lets make it subtle)
                    doc.setDrawColor(230, 230, 230);
                    doc.rect(x, yPos, colWidth, imgHeight);

                    // Caption
                    if (img.description) {
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(60, 60, 60);
                        const desc = doc.splitTextToSize(img.description, colWidth);
                        // Place caption below this specific image
                        doc.text(desc, x, yPos + imgHeight + 5);

                        // Account for caption in row height if needed, 
                        // but usually row spacing covers it.
                    }

                } catch (e) {
                    // Error block
                    const fallbackHeight = colWidth * 0.75;
                    doc.setFillColor(245, 245, 245);
                    doc.rect(x, yPos, colWidth, fallbackHeight, 'F');
                    doc.setFontSize(8);
                    doc.setTextColor(255, 0, 0);
                    doc.text('Image Error', x + 5, yPos + 10);
                    if (fallbackHeight > currentRowMaxHeight) currentRowMaxHeight = fallbackHeight;
                }

                // If end of row (odd index) or last image, advance Y
                if (index % 2 === 1 || index === imageList.length - 1) {
                    yPos += currentRowMaxHeight + 20; // Row height + spacing
                    currentRowMaxHeight = 0; // Reset for next row
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
