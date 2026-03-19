import jsPDF from 'jspdf';
import { ReferenceSource, SubmissionType } from '../types';

type PdfImage = {
  url: string;
  description?: string;
};

type PdfExportData = {
  submissionType: SubmissionType;
  title: string;
  uploadDate?: string;
  patientInitials?: string | null;
  patientAge?: string | number | null;
  patientSex?: string | null;
  modality?: string | null;
  organSystem?: string | null;
  findings?: string | null;
  clinicalData?: string | null;
  radiologicClinchers?: string | null;
  notesHtml?: string | null;
  diagnosis?: string | null;
  reference?: ReferenceSource | null;
  images: PdfImage[];
};

type PdfTypographyScale = {
  coverKicker: number;
  coverTitle: number;
  coverMeta: number;
  pageTitle: number;
  sectionTitle: number;
  metaLabel: number;
  body: number;
  caption: number;
  footer: number;
};

type PdfLayoutMetrics = {
  margin: number;
  bottomMargin: number;
  sectionGap: number;
  paragraphGap: number;
  bodyLineHeight: number;
  headerRuleOffset: number;
  imageGap: number;
};

type PdfThemeTokens = {
  accent: [number, number, number];
  accentMuted: [number, number, number];
  textPrimary: [number, number, number];
  textSecondary: [number, number, number];
  textMuted: [number, number, number];
  border: [number, number, number];
  fillSubtle: [number, number, number];
  fillMuted: [number, number, number];
  typography: PdfTypographyScale;
  layout: PdfLayoutMetrics;
};

type PdfSectionSpec = {
  minHeight: number;
};

type InlineSegment = {
  text: string;
  bold?: boolean;
  color?: string;
  highlight?: string;
  fontSize?: string;
};

type RichBlock =
  | { type: 'paragraph'; segments: InlineSegment[] }
  | { type: 'heading2'; segments: InlineSegment[] }
  | { type: 'heading3'; segments: InlineSegment[] }
  | { type: 'blockquote'; blocks: RichBlock[] }
  | { type: 'unorderedList'; items: RichBlock[][] }
  | { type: 'orderedList'; items: RichBlock[][] };

type RenderContext = {
  y: number;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  bottomMargin: number;
};

type RunStyle = {
  fontSize: number;
  lineHeight: number;
  color?: string;
  bold?: boolean;
  indent?: number;
};

const PDF_THEME_BY_SUBMISSION: Record<SubmissionType, PdfThemeTokens> = {
  interesting_case: {
    accent: [37, 99, 235],
    accentMuted: [96, 165, 250],
    textPrimary: [15, 23, 42],
    textSecondary: [51, 65, 85],
    textMuted: [100, 116, 139],
    border: [226, 232, 240],
    fillSubtle: [248, 250, 252],
    fillMuted: [241, 245, 249],
    typography: {
      coverKicker: 8,
      coverTitle: 26,
      coverMeta: 9,
      pageTitle: 16,
      sectionTitle: 11.5,
      metaLabel: 8,
      body: 10,
      caption: 8,
      footer: 8,
    },
    layout: {
      margin: 18,
      bottomMargin: 18,
      sectionGap: 8,
      paragraphGap: 3,
      bodyLineHeight: 5,
      headerRuleOffset: 5,
      imageGap: 8,
    },
  },
  rare_pathology: {
    accent: [190, 24, 93],
    accentMuted: [244, 114, 182],
    textPrimary: [15, 23, 42],
    textSecondary: [51, 65, 85],
    textMuted: [100, 116, 139],
    border: [226, 232, 240],
    fillSubtle: [248, 250, 252],
    fillMuted: [253, 242, 248],
    typography: {
      coverKicker: 8,
      coverTitle: 26,
      coverMeta: 9,
      pageTitle: 16,
      sectionTitle: 11.5,
      metaLabel: 8,
      body: 10,
      caption: 8,
      footer: 8,
    },
    layout: {
      margin: 18,
      bottomMargin: 18,
      sectionGap: 8,
      paragraphGap: 3,
      bodyLineHeight: 5,
      headerRuleOffset: 5,
      imageGap: 8,
    },
  },
  aunt_minnie: {
    accent: [180, 83, 9],
    accentMuted: [251, 191, 36],
    textPrimary: [15, 23, 42],
    textSecondary: [51, 65, 85],
    textMuted: [100, 116, 139],
    border: [226, 232, 240],
    fillSubtle: [255, 251, 235],
    fillMuted: [254, 243, 199],
    typography: {
      coverKicker: 8,
      coverTitle: 26,
      coverMeta: 9,
      pageTitle: 16,
      sectionTitle: 11.5,
      metaLabel: 8,
      body: 10,
      caption: 8,
      footer: 8,
    },
    layout: {
      margin: 18,
      bottomMargin: 18,
      sectionGap: 8,
      paragraphGap: 3,
      bodyLineHeight: 5,
      headerRuleOffset: 5,
      imageGap: 8,
    },
  },
};

const SECTION_SPEC: Record<'metadata' | 'section' | 'imageRow', PdfSectionSpec> = {
  metadata: { minHeight: 28 },
  section: { minHeight: 16 },
  imageRow: { minHeight: 76 },
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeText = (value?: string | number | null) => String(value ?? '').trim();

const joinWithSeparator = (values: Array<string | null | undefined>, separator = ' | ') =>
  values.map((value) => normalizeText(value)).filter(Boolean).join(separator);

const ensureHtmlString = (value?: string | null) => {
  const text = normalizeText(value);
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return `<p>${escapeHtml(text)}</p>`;
};

const normalizeImages = (
  images: Array<{ url: string; description?: string }> | string[] | string | null
): PdfImage[] => {
  if (!images) return [];
  if (typeof images === 'string') return [{ url: images, description: '' }];
  return images
    .map((image) => (typeof image === 'string' ? { url: image, description: '' } : image))
    .map((image) => ({ url: normalizeText(image.url), description: normalizeText(image.description) }))
    .filter((image) => image.url.length > 0);
};

const normalizeReference = (data: any): ReferenceSource | null => {
  const source = data.reference || data.analysis_result?.reference;
  const reference: ReferenceSource = {
    sourceType: source?.sourceType || data.referenceSourceType,
    title: source?.title || data.referenceTitle,
    page: source?.page || data.referencePage,
  };

  return reference.sourceType || reference.title || reference.page ? reference : null;
};

const normalizePdfExportData = (
  data: any,
  customTitle?: string,
  images?: Array<{ url: string; description?: string }> | string[] | string | null
): PdfExportData => {
  const submissionType = (data.submissionType || 'interesting_case') as SubmissionType;
  return {
    submissionType,
    title:
      normalizeText(customTitle) ||
      normalizeText(data.title) ||
      (submissionType === 'rare_pathology'
        ? 'Rare Pathology'
        : submissionType === 'aunt_minnie'
          ? 'Aunt Minnie'
          : 'Radiology Case Report'),
    uploadDate: normalizeText(data.uploadDate || data.date || data.analysis_result?.studyDate) || undefined,
    patientInitials: normalizeText(data.patientInitials || data.initials || data.patient_initials) || null,
    patientAge: normalizeText(data.patientAge || data.age || data.patient_age) || null,
    patientSex: normalizeText(data.patientSex || data.sex || data.patient_sex) || null,
    modality: normalizeText(data.modality) || null,
    organSystem: normalizeText(data.organSystem || data.organ_system || data.analysis_result?.anatomy_region) || null,
    findings: normalizeText(data.findings) || null,
    clinicalData: normalizeText(data.clinicalData || data.clinical_history || data.clinicalHistory) || null,
    radiologicClinchers: normalizeText(data.radiologicClinchers || data.radiologic_clinchers) || null,
    notesHtml: ensureHtmlString(data.notes || data.educational_summary || data.additionalNotes || data.pearl),
    diagnosis: normalizeText(data.diagnosis || data.diagnosticCode) || null,
    reference: normalizeReference(data),
    images: normalizeImages(images),
  };
};

const parseColor = (value?: string | null): string | undefined => {
  const normalized = normalizeText(value);
  return normalized || undefined;
};

const parseFontSize = (value?: string | null): string | undefined => {
  const normalized = normalizeText(value);
  return normalized || undefined;
};

const parseInlineNodes = (nodes: NodeListOf<ChildNode> | ChildNode[], inherited: Omit<InlineSegment, 'text'> = {}) => {
  const segments: InlineSegment[] = [];
  Array.from(nodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) segments.push({ text: node.textContent, ...inherited });
      return;
    }

    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'BR') {
      segments.push({ text: '\n', ...inherited });
      return;
    }

    const nextInherited: Omit<InlineSegment, 'text'> = {
      ...inherited,
      bold: inherited.bold || node.tagName === 'STRONG' || node.tagName === 'B',
      color: parseColor(node.style.color) || inherited.color,
      fontSize: parseFontSize(node.style.fontSize) || inherited.fontSize,
    };

    segments.push(...parseInlineNodes(Array.from(node.childNodes), nextInherited));
  });

  return segments;
};

const parseBlockNode = (node: ChildNode): RichBlock[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeText(node.textContent);
    return text ? [{ type: 'paragraph', segments: [{ text }] }] : [];
  }

  if (!(node instanceof HTMLElement)) return [];

  const tag = node.tagName;
  if (tag === 'P') return [{ type: 'paragraph', segments: parseInlineNodes(Array.from(node.childNodes)) }];
  if (tag === 'H2') return [{ type: 'heading2', segments: parseInlineNodes(Array.from(node.childNodes)) }];
  if (tag === 'H3') return [{ type: 'heading3', segments: parseInlineNodes(Array.from(node.childNodes)) }];
  if (tag === 'BLOCKQUOTE') {
    return Array.from(node.childNodes).flatMap((child) => parseBlockNode(child));
  }
  if (tag === 'UL' || tag === 'OL') {
    const items = Array.from(node.children)
      .filter((child) => child.tagName === 'LI')
      .map((li) => {
        const childBlocks = Array.from(li.childNodes).flatMap((child) => parseBlockNode(child));
        if (childBlocks.length > 0) return childBlocks;
        const inlineSegments = parseInlineNodes(Array.from(li.childNodes));
        return inlineSegments.length ? [{ type: 'paragraph', segments: inlineSegments } as RichBlock] : [];
      });
    return [{ type: tag === 'OL' ? 'orderedList' : 'unorderedList', items }];
  }
  if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') {
    return Array.from(node.childNodes).flatMap((child) => parseBlockNode(child));
  }

  const inlineSegments = parseInlineNodes([node]);
  return inlineSegments.length ? [{ type: 'paragraph', segments: inlineSegments }] : [];
};

const parseRichContent = (html?: string | null): RichBlock[] => {
  const normalized = ensureHtmlString(html);
  if (!normalized) return [];
  const parser = new DOMParser();
  const parsed = parser.parseFromString(normalized, 'text/html');
  const blocks = Array.from(parsed.body.childNodes).flatMap((node) => parseBlockNode(node));
  return blocks.length ? blocks : [{ type: 'paragraph', segments: [{ text: parsed.body.textContent || '' }] }];
};

const withRgb = (value: string | undefined, fallback: [number, number, number]) => {
  if (!value) return fallback;
  const match = value.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return fallback;
  return [Number(match[0]), Number(match[1]), Number(match[2])] as [number, number, number];
};

const getReadableTextColor = (color: string | undefined, fallback: [number, number, number]) => withRgb(color, fallback);

const formatDisplayDate = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getSubmissionTypeLabel = (value: SubmissionType) => {
  if (value === 'rare_pathology') return 'Rare Pathology';
  if (value === 'aunt_minnie') return 'Aunt Minnie';
  return 'Interesting Case';
};

const getPdfSectionOrder = () => ['details', 'images'] as const;

const getCompactMetadataGroups = (items: Array<{ label: string; value: string; fullWidth?: boolean }>) => {
  const activeItems = items.filter((item) => normalizeText(item.value));
  const byLabel = new Map(activeItems.map((item) => [item.label, item] as const));

  return {
    rows: [
      {
        columns: [
          byLabel.get('Patient') ?? null,
          byLabel.get('Patient ID') ?? null,
          byLabel.get('Date') ?? null,
        ],
      },
      {
        columns: [
          byLabel.get('Clinical Data') ?? null,
          byLabel.get('Exam') ?? null,
          byLabel.get('Reference Source') ?? null,
        ],
      },
    ].filter((row) => row.columns.some(Boolean)),
  };
};

const buildDocumentProperties = (data: PdfExportData, uploaderName?: string) => ({
  title: data.title,
  subject: `${getSubmissionTypeLabel(data.submissionType)} Radiology Case Report`,
  author: normalizeText(uploaderName) || 'RadCore',
  keywords: `radiology, case report, ${getSubmissionTypeLabel(data.submissionType).toLowerCase()}`,
});

const sanitizeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const buildFilename = (data: PdfExportData, customFileName?: string) => {
  if (customFileName) {
    return `${customFileName.replace(/[^a-z0-9 _.()-]/gi, '_')}.pdf`;
  }

  const datePart = formatIsoDate();
  const typePart = sanitizeFilenamePart(getSubmissionTypeLabel(data.submissionType));
  const safeTitle = sanitizeFilenamePart(data.title).slice(0, 60) || 'Case';
  return `${datePart}_${typePart}_${safeTitle}.pdf`;
};

const ensurePageSpace = (doc: jsPDF, ctx: RenderContext, neededHeight: number) => {
  if (ctx.y + neededHeight <= ctx.pageHeight - ctx.bottomMargin) return;
  doc.addPage();
  ctx.y = ctx.margin;
};

const ensureSectionSpace = (doc: jsPDF, ctx: RenderContext, spec: PdfSectionSpec) => {
  ensurePageSpace(doc, ctx, spec.minHeight);
};

const ensureHeadingAndBodySpace = (doc: jsPDF, ctx: RenderContext, headingHeight: number, bodyEstimate: number) => {
  ensurePageSpace(doc, ctx, headingHeight + bodyEstimate);
};

const ensureImageRowSpace = (doc: jsPDF, ctx: RenderContext, rowHeight: number) => {
  ensurePageSpace(doc, ctx, Math.max(SECTION_SPEC.imageRow.minHeight, rowHeight));
};

const inferImageFormat = (url: string): 'PNG' | 'JPEG' => {
  if (/^data:image\/png/i.test(url) || /\.png($|\?)/i.test(url)) return 'PNG';
  return 'JPEG';
};

const getImageSize = (doc: jsPDF, url: string, targetWidth: number, fallbackRatio = 0.68) => {
  try {
    const props = doc.getImageProperties(url);
    return {
      width: targetWidth,
      height: (props.height * targetWidth) / props.width,
    };
  } catch {
    return {
      width: targetWidth,
      height: targetWidth * fallbackRatio,
    };
  }
};

const drawImageFrame = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  image: PdfImage,
  theme: PdfThemeTokens,
  captionWidth: number
) => {
  doc.setDrawColor(...theme.border);
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'S');
  try {
    doc.addImage(image.url, inferImageFormat(image.url), x, y, width, height);
  } catch {
    doc.setFillColor(...theme.fillMuted);
    doc.roundedRect(x, y, width, height, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.typography.body);
    doc.setTextColor(...theme.textMuted);
    doc.text('Image could not be rendered', x + 8, y + 16);
  }

  const description = normalizeText(image.description);
  return description ? doc.splitTextToSize(description, captionWidth) : [];
};

const drawTitleBar = (
  doc: jsPDF,
  ctx: RenderContext,
  data: PdfExportData,
  theme: PdfThemeTokens
) => {
  const boxX = Math.max(8, ctx.margin - 10);
  const boxY = ctx.y || 8;
  const boxWidth = ctx.pageWidth - boxX * 2;
  const titleLines = doc.splitTextToSize(data.title, boxWidth - 32);
  const boxHeight = Math.max(38, 16 + Math.max(titleLines.length, 1) * 8 + 10);

  ensurePageSpace(doc, ctx, boxHeight + 4);

  doc.setFillColor(...theme.accent);
  doc.setDrawColor(...theme.accent);
  doc.setLineWidth(0.8);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2.8, 2.8, 'FD');

  const titleLineHeight = 8;
  const titleBlockHeight = Math.max(titleLines.length, 1) * titleLineHeight;
  const titleY = boxY + ((boxHeight - titleBlockHeight) / 2) + (titleLineHeight * 0.72);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  titleLines.forEach((line, index) => {
    doc.text(line, boxX + boxWidth / 2, titleY + index * titleLineHeight, { align: 'center' });
  });

  ctx.y = boxY + boxHeight + 8;
};

const writeSectionHeader = (doc: jsPDF, ctx: RenderContext, label: string, theme: PdfThemeTokens) => {
  ensureSectionSpace(doc, ctx, SECTION_SPEC.section);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...theme.accent);
  doc.text(label, ctx.margin, ctx.y);
  ctx.y += 4;
};

const writeParagraphText = (
  doc: jsPDF,
  ctx: RenderContext,
  value: string,
  theme: PdfThemeTokens,
  fontStyle: 'normal' | 'bold' = 'normal'
) => {
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(theme.typography.body);
  doc.setTextColor(...theme.textSecondary);
  const lines = doc.splitTextToSize(value, ctx.pageWidth - ctx.margin * 2);
  ensurePageSpace(doc, ctx, lines.length * theme.layout.bodyLineHeight + 2);
  doc.text(lines, ctx.margin, ctx.y);
  ctx.y += lines.length * theme.layout.bodyLineHeight + theme.layout.paragraphGap;
};

const drawCompactMetadataSummary = (
  doc: jsPDF,
  ctx: RenderContext,
  items: Array<{ label: string; value: string; fullWidth?: boolean }>,
  theme: PdfThemeTokens
) => {
  const { rows } = getCompactMetadataGroups(items);
  if (rows.length === 0) return;

  const columnGap = 12;
  const columnWidth = (ctx.pageWidth - ctx.margin * 2 - columnGap * 2) / 3;
  const columnX = [
    ctx.margin,
    ctx.margin + columnWidth + columnGap,
    ctx.margin + (columnWidth + columnGap) * 2,
  ];
  const labelFontSize = 6.2;
  const valueFontSize = theme.typography.body;
  const labelToValueGap = 4.4;
  const valueLineHeight = 4.2;
  const rowGap = 4.6;

  const getCellMetrics = (item: { label: string; value: string } | null, width: number) => {
    if (!item) {
      return {
        lines: [] as string[],
        height: 0,
      };
    }

    const lines = doc.splitTextToSize(item.value, width);
    const height = labelToValueGap + Math.max(lines.length, 1) * valueLineHeight;
    return { lines, height };
  };

  const neededHeight = rows.reduce((sum, row) => {
    const rowHeight = Math.max(
      ...row.columns.map((item) => getCellMetrics(item, columnWidth).height),
      0
    );
    return sum + rowHeight;
  }, 0) + Math.max(rows.length - 1, 0) * rowGap + 2;
  ensureSectionSpace(doc, ctx, { minHeight: Math.max(SECTION_SPEC.section.minHeight, neededHeight) });

  const drawCell = (
    item: { label: string; value: string } | null,
    startX: number,
    startY: number,
    width: number
  ) => {
    const metrics = getCellMetrics(item, width);
    if (!item) return startY + metrics.height;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(labelFontSize);
    doc.setTextColor(...theme.textMuted);
    doc.text(item.label.toUpperCase(), startX, startY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(valueFontSize);
    doc.setTextColor(...theme.textPrimary);
    doc.text(metrics.lines, startX, startY + labelToValueGap);
    return startY + metrics.height;
  };

  let rowY = ctx.y;
  rows.forEach((row) => {
    const bottomY = Math.max(
      ...row.columns.map((item, columnIndex) => drawCell(item, columnX[columnIndex], rowY, columnWidth)),
      rowY
    );
    rowY = bottomY + rowGap;
  });

  ctx.y = rowY - rowGap + 10;
};

const tokenize = (text: string) => text.split(/(\s+|\n)/).filter((token) => token.length > 0);

const resolveSegmentFontSize = (fontSize: string | undefined, fallback: number) => {
  if (!fontSize) return fallback;
  const parsed = Number.parseFloat(fontSize);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(8, Math.min(11.5, parsed * 0.75));
};

const estimateStyledSegmentsHeight = (
  doc: jsPDF,
  segments: InlineSegment[],
  style: RunStyle,
  ctx: RenderContext
) => {
  const baseX = ctx.margin + (style.indent || 0);
  const maxWidth = ctx.pageWidth - ctx.margin - baseX;
  let lineCount = 1;
  let lineWidth = 0;

  segments.forEach((segment) => {
    const tokens = tokenize(segment.text);
    tokens.forEach((token) => {
      if (token === '\n') {
        lineCount += 1;
        lineWidth = 0;
        return;
      }

      const isWhitespace = /^\s+$/.test(token);
      const resolvedFontSize = resolveSegmentFontSize(segment.fontSize, style.fontSize);
      doc.setFont('helvetica', segment.bold || style.bold ? 'bold' : 'normal');
      doc.setFontSize(resolvedFontSize);
      const tokenWidth = doc.getTextWidth(token);

      if (!isWhitespace && lineWidth + tokenWidth > maxWidth && lineWidth > 0) {
        lineCount += 1;
        lineWidth = 0;
      }

      lineWidth += tokenWidth;
    });
  });

  return lineCount * style.lineHeight;
};

const estimateRichBlocksHeight = (
  doc: jsPDF,
  blocks: RichBlock[],
  theme: PdfThemeTokens,
  ctx: RenderContext,
  depth = 0
): number => {
  let height = 0;

  blocks.forEach((block) => {
    switch (block.type) {
      case 'paragraph':
        height += estimateStyledSegmentsHeight(doc, block.segments, {
          fontSize: theme.typography.body,
          lineHeight: theme.layout.bodyLineHeight,
          indent: depth * 8,
        }, ctx) + 2;
        break;
      case 'heading2':
        height += estimateStyledSegmentsHeight(doc, block.segments, {
          fontSize: theme.typography.sectionTitle,
          lineHeight: 5.2,
          bold: true,
          indent: depth * 8,
        }, ctx) + 2;
        break;
      case 'heading3':
        height += estimateStyledSegmentsHeight(doc, block.segments, {
          fontSize: theme.typography.body,
          lineHeight: 4.9,
          bold: true,
          indent: depth * 8,
        }, ctx) + 2;
        break;
      case 'blockquote':
        height += estimateRichBlocksHeight(doc, block.blocks, theme, ctx, depth + 1) + 8;
        break;
      case 'unorderedList':
      case 'orderedList':
        block.items.forEach((itemBlocks) => {
          height += estimateRichBlocksHeight(doc, itemBlocks, theme, ctx, depth + 1) + 1;
        });
        height += 1;
        break;
    }
  });

  return height;
};

const renderStyledSegments = (
  doc: jsPDF,
  ctx: RenderContext,
  segments: InlineSegment[],
  style: RunStyle,
  theme: PdfThemeTokens
) => {
  const baseX = ctx.margin + (style.indent || 0);
  const maxX = ctx.pageWidth - ctx.margin;
  let x = baseX;
  let y = ctx.y;

  const newLine = () => {
    x = baseX;
    y += style.lineHeight;
    if (y + style.lineHeight > ctx.pageHeight - ctx.bottomMargin) {
      doc.addPage();
      y = ctx.margin;
    }
  };

  segments.forEach((segment) => {
    const tokens = tokenize(segment.text);
    tokens.forEach((token) => {
      if (token === '\n') {
        newLine();
        return;
      }

      const isWhitespace = /^\s+$/.test(token);
      const fontStyle = segment.bold || style.bold ? 'bold' : 'normal';
      const resolvedFontSize = resolveSegmentFontSize(segment.fontSize, style.fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setFontSize(resolvedFontSize);
      const tokenWidth = doc.getTextWidth(token);

      if (!isWhitespace && x + tokenWidth > maxX && x > baseX) {
        newLine();
      }

      const drawColor = getReadableTextColor(segment.color || style.color, theme.textSecondary);
      doc.setTextColor(...drawColor);
      doc.text(token, x, y);
      x += tokenWidth;
    });
  });

  ctx.y = y + style.lineHeight * 0.5;
};

const writeRichBlocks = (
  doc: jsPDF,
  ctx: RenderContext,
  blocks: RichBlock[],
  theme: PdfThemeTokens,
  depth = 0
) => {
  blocks.forEach((block) => {
    switch (block.type) {
      case 'paragraph':
        renderStyledSegments(doc, ctx, block.segments, {
          fontSize: theme.typography.body,
          lineHeight: theme.layout.bodyLineHeight,
          indent: depth * 8,
        }, theme);
        ctx.y += 2;
        break;
      case 'heading2':
        renderStyledSegments(doc, ctx, block.segments, {
          fontSize: theme.typography.sectionTitle,
          lineHeight: 5.2,
          bold: true,
          indent: depth * 8,
        }, theme);
        ctx.y += 2;
        break;
      case 'heading3':
        renderStyledSegments(doc, ctx, block.segments, {
          fontSize: theme.typography.body,
          lineHeight: 4.9,
          bold: true,
          indent: depth * 8,
        }, theme);
        ctx.y += 2;
        break;
      case 'blockquote': {
        const quoteStartY = ctx.y;
        const quotePaddingY = 4;
        const quotePaddingX = 5;
        const estimatedHeight = estimateRichBlocksHeight(doc, block.blocks, theme, ctx, depth + 1);
        const quoteHeight = Math.max(estimatedHeight + quotePaddingY * 2, 14);
        ensurePageSpace(doc, ctx, quoteHeight + 2);

        doc.setFillColor(...theme.fillSubtle);
        doc.setDrawColor(...theme.border);
        doc.roundedRect(
          ctx.margin + depth * 8,
          ctx.y,
          ctx.pageWidth - ctx.margin * 2 - depth * 8,
          quoteHeight,
          2.5,
          2.5,
          'FD'
        );
        doc.setDrawColor(...theme.accentMuted);
        doc.setLineWidth(0.8);
        doc.line(
          ctx.margin + depth * 8 + 2,
          ctx.y + 2,
          ctx.margin + depth * 8 + 2,
          ctx.y + quoteHeight - 2
        );

        const renderCtx: RenderContext = {
          ...ctx,
          y: quoteStartY + quotePaddingY,
          margin: ctx.margin + quotePaddingX,
        };
        writeRichBlocks(doc, renderCtx, block.blocks, theme, depth + 1);
        ctx.y = Math.max(quoteStartY + quoteHeight, renderCtx.y + 2) + 2;
        break;
      }
      case 'unorderedList':
      case 'orderedList':
        block.items.forEach((itemBlocks, index) => {
          ensurePageSpace(doc, ctx, 8);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(theme.typography.body);
          doc.setTextColor(...theme.textSecondary);
          const bullet = block.type === 'orderedList' ? `${index + 1}.` : '-';
          doc.text(bullet, ctx.margin + depth * 8, ctx.y);
          const itemCtx: RenderContext = { ...ctx, y: ctx.y };
          writeRichBlocks(doc, itemCtx, itemBlocks, theme, depth + 1);
          ctx.y = itemCtx.y;
        });
        ctx.y += 1;
        break;
    }
  });
};

const renderRichNotes = (doc: jsPDF, ctx: RenderContext, html: string, theme: PdfThemeTokens) => {
  const blocks = parseRichContent(html);
  if (blocks.length === 0) {
    writeParagraphText(doc, ctx, 'No notes recorded.', theme);
    return;
  }
  writeRichBlocks(doc, ctx, blocks, theme);
};

const renderImageGrid = (
  doc: jsPDF,
  ctx: RenderContext,
  images: PdfImage[],
  theme: PdfThemeTokens,
) => {
  if (images.length === 0) return;

  writeSectionHeader(doc, ctx, 'Images', theme);

  if (images.length === 1) {
    const width = ctx.pageWidth - ctx.margin * 2;
    const image = images[0];
    const size = getImageSize(doc, image.url, width, 0.6);
    const imageHeight = Math.min(size.height, 110);
    const captionLines = normalizeText(image.description)
      ? doc.splitTextToSize(normalizeText(image.description), width)
      : [];
    ensureImageRowSpace(doc, ctx, imageHeight + captionLines.length * 4 + 8);
    drawImageFrame(doc, ctx.margin, ctx.y, width, imageHeight, image, theme, width);
    if (captionLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(theme.typography.caption);
      doc.setTextColor(...theme.textMuted);
      doc.text(captionLines, ctx.margin, ctx.y + imageHeight + 5);
      ctx.y += imageHeight + captionLines.length * 4 + 7;
    } else {
      ctx.y += imageHeight + 6;
    }
    return;
  }

  const gutter = theme.layout.imageGap;
  const colWidth = (ctx.pageWidth - ctx.margin * 2 - gutter) / 2;
  let rowY = ctx.y;
  let rowHeight = 0;

  images.forEach((image, index) => {
    const isLeft = index % 2 === 0;
    const x = isLeft ? ctx.margin : ctx.margin + colWidth + gutter;
    const size = getImageSize(doc, image.url, colWidth, 0.72);
    const imageHeight = Math.min(size.height, 78);
    const captionLines = normalizeText(image.description)
      ? doc.splitTextToSize(normalizeText(image.description), colWidth)
      : [];
    const cellHeight = imageHeight + (captionLines.length ? captionLines.length * 4 + 6 : 0);

    if (isLeft) {
      ensureImageRowSpace(doc, ctx, cellHeight);
      rowY = ctx.y;
      rowHeight = cellHeight;
    } else {
      rowHeight = Math.max(rowHeight, cellHeight);
    }

    drawImageFrame(doc, x, rowY, colWidth, imageHeight, image, theme, colWidth);
    if (captionLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(theme.typography.caption);
      doc.setTextColor(...theme.textMuted);
      doc.text(captionLines, x, rowY + imageHeight + 5);
    }

    if (!isLeft || index === images.length - 1) {
      ctx.y = rowY + rowHeight + gutter;
    }
  });
};

const addFooter = (doc: jsPDF, margin: number, pageHeight: number, title: string, submissionType: SubmissionType, theme: PdfThemeTokens) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const titleFragment = title.length > 48 ? `${title.slice(0, 45)}...` : title;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...theme.border);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 14, doc.internal.pageSize.width - margin, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(theme.typography.footer);
    doc.setTextColor(...theme.textMuted);
    doc.text(`RADCORE | ${titleFragment}`, margin, pageHeight - 9);
    doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.width - margin, pageHeight - 9, { align: 'right' });
  }
};

export const generateCasePDF = (
  data: any,
  unusedAnalysis: any,
  images: Array<{ url: string; description?: string }> | string[] | string | null,
  customTitle?: string,
  uploaderName?: string,
  customFileName?: string
) => {
  try {
    const normalized = normalizePdfExportData(data, customTitle, images);
    const doc = new jsPDF();
    const theme = PDF_THEME_BY_SUBMISSION[normalized.submissionType];
    const ctx: RenderContext = {
      y: 0,
      margin: theme.layout.margin,
      pageWidth: doc.internal.pageSize.width,
      pageHeight: doc.internal.pageSize.height,
      bottomMargin: theme.layout.bottomMargin,
    };

    doc.setDocumentProperties(buildDocumentProperties(normalized, uploaderName));
    ctx.y = 8;
    drawTitleBar(doc, ctx, normalized, theme);

    const overviewRows =
      normalized.submissionType === 'interesting_case'
        ? [
            {
              label: 'Patient',
              value: joinWithSeparator(
                [
                  normalized.patientInitials,
                  normalized.patientAge ? `${normalized.patientAge} yo` : '',
                  normalized.patientSex,
                ],
                ' | '
              ),
            },
            { label: 'Date', value: formatDisplayDate(normalized.uploadDate) },
            { label: 'Exam', value: joinWithSeparator([normalized.modality, normalized.organSystem], ' - ') },
            { label: 'Patient ID', value: normalized.diagnosis || '' },
            { label: 'Clinical Data', value: normalized.clinicalData || '', fullWidth: true },
            ...(normalized.reference
              ? [{
                  label: 'Reference Source',
                  value: joinWithSeparator(
                    [
                      normalizeText(normalized.reference.sourceType),
                      normalizeText(normalized.reference.title),
                      normalizeText(normalized.reference.page),
                    ],
                    ' - '
                  ),
                  fullWidth: true,
                }]
              : []),
          ]
        : [
            { label: 'Date', value: formatDisplayDate(normalized.uploadDate) },
            { label: 'Exam', value: joinWithSeparator([normalized.modality, normalized.organSystem], ' - ') },
            { label: 'Patient ID', value: normalized.diagnosis || '' },
            ...(normalized.clinicalData ? [{ label: 'Clinical Data', value: normalized.clinicalData, fullWidth: true }] : []),
            ...(normalized.reference && normalized.submissionType !== 'aunt_minnie'
              ? [{
                  label: 'Reference Source',
                  value: joinWithSeparator(
                    [
                      normalizeText(normalized.reference.sourceType),
                      normalizeText(normalized.reference.title),
                      normalizeText(normalized.reference.page),
                    ],
                    ' - '
                  ),
                  fullWidth: true,
                }]
              : []),
          ];

    writeSectionHeader(doc, ctx, 'Case Information', theme);
    drawCompactMetadataSummary(doc, ctx, overviewRows, theme);

    ensureHeadingAndBodySpace(doc, ctx, 12, 18);
    writeSectionHeader(
      doc,
      ctx,
      normalized.submissionType === 'aunt_minnie' ? 'Description' : 'Findings',
      theme
    );
    writeParagraphText(
      doc,
      ctx,
      normalized.findings ||
        (normalized.submissionType === 'aunt_minnie' ? 'No description recorded.' : 'No findings recorded.'),
      theme
    );

    if (normalized.submissionType === 'rare_pathology' && normalized.radiologicClinchers) {
      ensureHeadingAndBodySpace(doc, ctx, 12, 14);
      writeSectionHeader(doc, ctx, 'Radiologic Clinchers', theme);
      writeParagraphText(doc, ctx, normalized.radiologicClinchers, theme);
    }

    if (normalized.notesHtml && normalized.submissionType !== 'rare_pathology') {
      ensureHeadingAndBodySpace(doc, ctx, 12, 18);
      writeSectionHeader(doc, ctx, 'Notes / Remarks', theme);
      renderRichNotes(doc, ctx, normalized.notesHtml, theme);
    }

    doc.addPage();
    ctx.y = 8;
    drawTitleBar(doc, ctx, normalized, theme);

    if (normalized.images.length > 0) {
      renderImageGrid(doc, ctx, normalized.images, theme);
    } else {
      writeSectionHeader(doc, ctx, 'Images', theme);
      const placeholderY = ctx.y;
      const width = ctx.pageWidth - ctx.margin * 2;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...theme.border);
      doc.roundedRect(ctx.margin, placeholderY, width, 34, 3, 3, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(theme.typography.body);
      doc.setTextColor(...theme.textMuted);
      doc.text('No images attached for this case.', ctx.margin + 8, placeholderY + 19);
      ctx.y = placeholderY + 42;
    }

    addFooter(doc, ctx.margin, ctx.pageHeight, normalized.title, normalized.submissionType, theme);
    doc.save(buildFilename(normalized, customFileName));
  } catch (error: any) {
    console.error('CRITICAL PDF ERROR:', error);
    alert(`Failed to generate PDF. Error: ${error.message || error}`);
  }
};

export const __testables = {
  buildDocumentProperties,
  buildFilename,
  ensureHtmlString,
  formatDisplayDate,
  formatIsoDate,
  getSubmissionTypeLabel,
  joinWithSeparator,
  normalizeImages,
  normalizePdfExportData,
  parseRichContent,
  sanitizeFilenamePart,
  getPdfSectionOrder,
  getCompactMetadataGroups,
};
