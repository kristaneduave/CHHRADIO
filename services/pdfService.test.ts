import { describe, expect, it } from 'vitest';
import { __testables } from './pdfService';

describe('pdfService helpers', () => {
  it('builds archive-friendly filenames', () => {
    const filename = __testables.buildFilename({
      submissionType: 'interesting_case',
      title: 'Pulmonary nodule follow-up',
      images: [],
    });

    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}_Interesting_Case_Pulmonary_nodule_follow_up\.pdf$/);
  });

  it('keeps custom filenames as overrides', () => {
    const filename = __testables.buildFilename(
      {
        submissionType: 'rare_pathology',
        title: 'Ignored',
        images: [],
      },
      'MY CUSTOM FILE'
    );

    expect(filename).toBe('MY CUSTOM FILE.pdf');
  });

  it('normalizes sparse export data', () => {
    const normalized = __testables.normalizePdfExportData({
      submissionType: 'aunt_minnie',
      findings: 'Key clue',
      notes: 'Plain note',
    });

    expect(normalized.submissionType).toBe('aunt_minnie');
    expect(normalized.title).toBe('Aunt Minnie');
    expect(normalized.findings).toBe('Key clue');
    expect(normalized.notesHtml).toBe('<p>Plain note</p>');
  });

  it('preserves title, notes, diagnosis, reference, and images during normalization', () => {
    const normalized = __testables.normalizePdfExportData(
      {
        submissionType: 'interesting_case',
        title: 'Case Title',
        notes: '<p>Remark</p>',
        diagnosis: 'RAD-123456',
        referenceSourceType: 'Journal',
        referenceTitle: 'Chest Imaging',
        referencePage: 'p. 14',
      },
      undefined,
      [{ url: 'https://example.com/image.png', description: 'Axial' }]
    );

    expect(normalized.title).toBe('Case Title');
    expect(normalized.notesHtml).toBe('<p>Remark</p>');
    expect(normalized.diagnosis).toBe('RAD-123456');
    expect(normalized.reference).toEqual({
      sourceType: 'Journal',
      title: 'Chest Imaging',
      page: 'p. 14',
    });
    expect(normalized.images).toEqual([
      { url: 'https://example.com/image.png', description: 'Axial' },
    ]);
  });

  it('joins metadata values with clean separators', () => {
    expect(__testables.joinWithSeparator(['CT', 'Chest'], ' - ')).toBe('CT - Chest');
    expect(__testables.joinWithSeparator(['A', '', 'B'])).toBe('A | B');
  });

  it('normalizes multiple image input shapes', () => {
    expect(__testables.normalizeImages('https://example.com/one.png')).toEqual([
      { url: 'https://example.com/one.png', description: '' },
    ]);

    expect(__testables.normalizeImages([
      { url: 'https://example.com/two.png', description: '' },
      { url: ' https://example.com/three.png ', description: ' Axial ' },
    ])).toEqual([
      { url: 'https://example.com/two.png', description: '' },
      { url: 'https://example.com/three.png', description: 'Axial' },
    ]);
  });

  it('parses rich notes lists with standard bullets', () => {
    const blocks = __testables.parseRichContent('<ul><li>First</li><li>Second</li></ul>');
    expect(blocks[0]?.type).toBe('unorderedList');
    if (blocks[0]?.type !== 'unorderedList') {
      throw new Error('Expected unorderedList block');
    }
    expect(blocks[0].items).toHaveLength(2);
  });

  it('preserves nested list structure in rich notes parsing', () => {
    const blocks = __testables.parseRichContent(
      '<ul><li>Parent<ul><li>Child</li></ul></li><li>Sibling</li></ul>'
    );

    expect(blocks[0]?.type).toBe('unorderedList');
    if (blocks[0]?.type !== 'unorderedList') {
      throw new Error('Expected unorderedList block');
    }

    expect(blocks[0].items).toHaveLength(2);
    expect(blocks[0].items[0]?.some((block) => block.type === 'unorderedList')).toBe(true);
  });

  it('keeps inline wrappers inside a list item in the same paragraph block', () => {
    const blocks = __testables.parseRichContent(
      '<ul><li>transitional <span>meningioma</span> (40%): mixed histology</li></ul>'
    );

    expect(blocks[0]?.type).toBe('unorderedList');
    if (blocks[0]?.type !== 'unorderedList') {
      throw new Error('Expected unorderedList block');
    }

    expect(blocks[0].items[0]).toHaveLength(1);
    expect(blocks[0].items[0]?.[0]?.type).toBe('paragraph');
    if (blocks[0].items[0]?.[0]?.type !== 'paragraph') {
      throw new Error('Expected paragraph block');
    }

    expect(blocks[0].items[0][0].segments.map((segment) => segment.text).join('')).toBe(
      'transitional meningioma (40%): mixed histology'
    );
  });

  it('repairs spaced letter runs before parsing notes html', () => {
    const normalized = __testables.normalizePdfExportData({
      submissionType: 'interesting_case',
      notes: '<ul><li>t r a n s i t i o n a l meningioma (40%): mixed histology</li></ul>',
    });

    expect(normalized.notesHtml).toContain('transitional meningioma');
    expect(normalized.notesHtml).not.toContain('t r a n s i t i o n a l');
  });

  it('strips hidden control characters from notes html before rendering', () => {
    const normalized = __testables.normalizePdfExportData({
      submissionType: 'interesting_case',
      notes: '<ul><li>\u000Btransitional meningioma (40%): mixed histology</li></ul>',
    });

    expect(normalized.notesHtml).toContain('transitional meningioma');
    expect(normalized.notesHtml).not.toContain('\u000B');
  });

  it('builds document metadata with uploader fallback', () => {
    const metadata = __testables.buildDocumentProperties(
      {
        submissionType: 'rare_pathology',
        title: 'Medullary thyroid carcinoma',
        images: [],
      },
      'Dr. Reader'
    );

    expect(metadata).toEqual({
      title: 'Medullary thyroid carcinoma',
      subject: 'Rare Pathology Radiology Case Report',
      author: 'Dr. Reader',
      keywords: 'radiology, case report, rare pathology',
    });
  });

  it('defines a details-first PDF section order', () => {
    expect(__testables.getPdfSectionOrder()).toEqual(['details', 'images']);
  });

  it('groups compact metadata into fixed columns and inline long rows', () => {
    const grouped = __testables.getCompactMetadataGroups([
      { label: 'Patient', value: 'WE | 23 yo | M' },
      { label: 'Uploaded', value: 'Mar 18, 2026, 2:14 PM' },
      { label: 'Exam', value: 'CT Scan - Neuroradiology' },
      { label: 'Patient ID', value: 'RAD-479038' },
      { label: 'Clinical Data', value: 'Headache', fullWidth: true },
      { label: 'Reference Source', value: 'Book - Felsons - p 214', fullWidth: true },
    ]);

    expect(grouped.rows.map((row) => row.columns.map((item) => item?.label ?? null))).toEqual([
      ['Patient', 'Patient ID', 'Uploaded'],
      ['Clinical Data', 'Exam', 'Reference Source'],
    ]);
  });

  it('omits missing compact metadata fields without placeholders', () => {
    const grouped = __testables.getCompactMetadataGroups([
      { label: 'Uploaded', value: 'Mar 18, 2026, 2:14 PM' },
      { label: 'Patient ID', value: 'RAD-479038' },
      { label: 'Clinical Data', value: '', fullWidth: true },
    ]);

    expect(grouped.rows.map((row) => row.columns.map((item) => item?.label ?? null))).toEqual([
      [null, 'Patient ID', 'Uploaded'],
    ]);
  });
});
