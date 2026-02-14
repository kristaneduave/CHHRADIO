
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
        console.log('generateCasePDF called');
        console.log('Data:', data);
        console.log('Images:', images);

        const doc = new jsPDF();

        const {
            initials, age, sex, modality, organSystem, findings, impression, notes
        } = data;

        // --- Header Section ---
        const titleText = customTitle || 'Radiology Case Report';
        const uploaderText = uploaderName ? `Uploaded by: ${uploaderName}` : '';
        const timestamp = new Date().toLocaleString();

        doc.setFontSize(18);
        doc.setTextColor(0, 51, 102);
        doc.text(titleText, 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        // Right-aligned timestamp
        doc.text(timestamp, 196, 22, { align: 'right' });

        if (uploaderText) {
            doc.setFontSize(9);
            doc.text(uploaderText, 14, 28);
        }

        // --- 8-Field Table ---
        autoTable(doc, {
            startY: 35,
            head: [['Field', 'Details']],
            body: [
                ['Initials', initials],
                ['Age', age],
                ['Sex', sex],
                ['Modality', modality],
                ['Organ System', organSystem],
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

        // --- Images Section ---
        let finalY = (doc as any).lastAutoTable?.finalY || 100;
        finalY += 10;

        // Normalize images input
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
            doc.setFontSize(14);
            doc.setTextColor(0, 51, 102);

            if (finalY > 250) {
                doc.addPage();
                finalY = 20;
            }
            doc.text('Diagnostic Imaging:', 14, finalY);
            finalY += 10;

            imageList.forEach((img, index) => {
                if (finalY > 220) { // Check space for image + desc
                    doc.addPage();
                    finalY = 20;
                }

                try {
                    const imgProps = doc.getImageProperties(img.url);
                    const pdfWidth = 120;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    // Header for Image (e.g. Image 1)
                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(`Image ${index + 1}`, 14, finalY);

                    // The Image
                    doc.addImage(img.url, 'PNG', 14, finalY + 5, pdfWidth, pdfHeight);
                    finalY += pdfHeight + 10;

                    // The Description
                    if (img.description) {
                        doc.setFontSize(10);
                        doc.setTextColor(50);
                        // Split text to fit width
                        const splitDesc = doc.splitTextToSize(`Description: ${img.description}`, 180);
                        doc.text(splitDesc, 14, finalY);
                        finalY += (splitDesc.length * 5) + 10; // Adjust spacing based on lines
                    } else {
                        finalY += 5;
                    }

                } catch (e) {
                    console.error('Error adding individual image to PDF:', e);
                    doc.setTextColor(255, 0, 0);
                    doc.text(`[Image ${index + 1} Failed to Load]`, 14, finalY);
                    finalY += 10;
                }
            });
        }

        // --- Save ---
        const safeTitle = (customTitle || 'Case').replace(/[^a-z0-9]/gi, '_').substring(0, 20);
        const safeInitials = (initials || 'Pt').replace(/[^a-z0-9]/gi, '_');
        const dateStr = new Date().toISOString().split('T')[0];

        const filename = `${dateStr}_${safeTitle}_${safeInitials}.pdf`;
        doc.save(filename);
        console.log('PDF saved successfully');

    } catch (error: any) {
        console.error('CRITICAL PDF ERROR:', error);
        alert('Failed to generate PDF. Error: ' + (error.message || error));
    }
};
