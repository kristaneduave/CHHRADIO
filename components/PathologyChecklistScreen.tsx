import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import { LayoutScrollContext } from './Layout';
import { supabase } from '../services/supabase';
import {
  createPathologyGuidelineDraftFromCurrent,
  createPathologyGuidelineSource,
  getCurrentPathologyGuidelines,
  getFeaturedPathologyGuidelines,
  getGuidelineDraftVersions,
  getLatestEditableDraft,
  getPathologyGuidelineDetail,
  getPathologyGuidelineSource,
  getRelatedPathologyGuidelines,
  importPathologyGuidelineVersion,
  publishPathologyGuidelineVersion,
  searchPathologyGuidelines,
  syncPathologyGuideline,
  updatePathologyGuidelineDraft,
  updatePathologyGuidelineSource,
} from '../services/pathologyChecklistService';
import {
  createPathologyGuidelineRequest,
  deletePathologyGuidelineRequest,
  listPathologyGuidelineRequests,
  updatePathologyGuidelineRequest,
} from '../services/pathologyGuidelineRequestService';
import {
  EditableDraftPatch,
  PathologyChecklistItem,
  PathologyGuidelineContentType,
  PathologyGuidelineDetail,
  PathologyGuidelineImportPayload,
  PathologyGuidelineListItem,
  PathologyGuidelineRequest,
  PathologyGuidelineRequestStatus,
  PathologyGuidelineRequestType,
  PathologyGuidelineSource,
  PathologyGuidelineSourceKind,
  PathologyGuidelineVersion,
  UserRole,
} from '../types';
import { canEditPathologyChecklists, normalizeUserRole } from '../utils/roles';
import { toastError, toastInfo, toastSuccess } from '../utils/toast';

interface PathologyChecklistScreenProps {
  onBack: () => void;
}

interface SourceFormState {
  slug: string;
  pathology_name: string;
  specialty: string;
  synonyms: string;
  keywords: string;
  source_url: string;
  source_kind: PathologyGuidelineSourceKind;
  google_drive_url: string;
  google_drive_file_id: string;
  source_title: string;
  issuing_body: string;
  is_active: boolean;
  primary_topic: string;
  secondary_topics: string;
  clinical_tags: string;
  anatomy_terms: string;
  problem_terms: string;
  content_type: PathologyGuidelineContentType;
  is_featured: boolean;
  search_priority: string;
  related_guideline_slugs: string;
}

interface RequestFormState {
  request_type: PathologyGuidelineRequestType;
  title: string;
  description: string;
  source_url: string;
}

interface ChecklistDetailSection {
  id: string;
  label: string;
}

interface GroupedChecklistSection {
  id: string;
  label: string;
  items: PathologyChecklistItem[];
}

interface RadioGraphicsTopicHub {
  id: string;
  topic: string;
  icon: string;
  description: string;
  activeDescription: string;
  count: number;
  sourceTopics: string[];
  tags: string[];
  featuredItems: PathologyGuidelineListItem[];
}

interface RadioGraphicsSearchMatchReason {
  label: string;
}

interface RadioGraphicsBrowseSection {
  id: string;
  title: string;
  description: string;
  items: PathologyGuidelineListItem[];
}

const TOPIC_OPTIONS = [
  'Thoracic',
  'Abdominal',
  'Genitourinary',
  'Hepatobiliary / Pancreas',
  'Gastrointestinal',
  'Musculoskeletal',
  'Neuro / Head and Neck',
  'Breast',
  'Emergency / Acute findings',
  'Pediatrics',
  'Procedures / Interventions',
  'General reporting pearls',
];

const QUICK_SEARCH_CHIPS = [
  'Mass',
  'Nodule',
  'Incidental findings',
  'Follow-up',
  'Emergency',
  'Pediatrics',
];

const CURATED_TRAINING_HUBS = [
  {
    id: 'chest',
    topic: 'Chest',
    icon: 'air',
    description: 'Thoracic and cardiothoracic imaging',
    activeDescription: 'Thoracic and cardiothoracic guides',
    matchers: ['thoracic', 'chest', 'cardiac', 'lung', 'pulmonary', 'heart'],
  },
  {
    id: 'abdomen',
    topic: 'Abdomen',
    icon: 'dashboard',
    description: 'GI, liver, pancreas, and abdominal imaging',
    activeDescription: 'Abdominal and GI guides',
    matchers: ['abdominal', 'gastrointestinal', 'hepatobiliary', 'pancreas', 'liver', 'bowel', 'gi', 'abdomen'],
  },
  {
    id: 'gu-obgyn',
    topic: 'GU / OB-Gyn',
    icon: 'water_drop',
    description: 'Genitourinary and OB-Gyn imaging',
    activeDescription: 'GU and OB-Gyn guides',
    matchers: ['genitourinary', 'renal', 'kidney', 'urinary', 'bladder', 'obstetric', 'gynecologic', 'ob', 'gyn', 'uterus', 'ovary', 'adnexa', 'pelvic'],
  },
  {
    id: 'neuro-head-neck',
    topic: 'Neuro / Head & Neck',
    icon: 'neurology',
    description: 'Brain, spine, and head-neck imaging',
    activeDescription: 'Neuro and head-neck guides',
    matchers: ['neuro', 'neuroradiology', 'head and neck', 'brain', 'spine', 'sinus', 'orbit', 'neck', 'head'],
  },
  {
    id: 'musculoskeletal',
    topic: 'Musculoskeletal',
    icon: 'accessibility_new',
    description: 'Bone, joint, and soft-tissue imaging',
    activeDescription: 'MSK guides',
    matchers: ['musculoskeletal', 'msk', 'bone', 'joint', 'tendon', 'ligament', 'soft tissue', 'orthopedic'],
  },
  {
    id: 'breast',
    topic: 'Breast',
    icon: 'favorite',
    description: 'Screening, diagnostic, and breast imaging',
    activeDescription: 'Breast imaging guides',
    matchers: ['breast'],
  },
  {
    id: 'pediatrics',
    topic: 'Pediatrics',
    icon: 'child_care',
    description: 'Pediatric imaging across systems',
    activeDescription: 'Pediatric imaging guides',
    matchers: ['pediatrics', 'pediatric', 'child', 'neonatal'],
  },
  {
    id: 'procedures-ir',
    topic: 'Procedures / IR',
    icon: 'medical_services',
    description: 'Interventional and procedural imaging',
    activeDescription: 'Interventional and procedural guides',
    matchers: ['interventional', 'vascular', 'procedure', 'intervention', 'biopsy', 'drainage', 'embolization', 'catheter', 'angiography', 'ultrasound'],
  },
  {
    id: 'general-other',
    topic: 'General & Other',
    icon: 'category',
    description: 'Practice, methods, science, and other topics',
    activeDescription: 'Practice, science, and miscellaneous guides',
    matchers: [
      'professionalism',
      'safety and quality',
      'health policy',
      'leadership',
      'management',
      'education',
      'informatics',
      'research',
      'statistical',
      'physics',
      'basic science',
      'artificial intelligence',
      'biomarkers',
      'quantitative imaging',
      'molecular imaging',
      'nuclear medicine',
      'radiation oncology',
      'other',
      'general',
      'multisystem',
    ],
  },
] as const;

const GENERAL_OTHER_HUB_ID = 'general-other';

const DEFAULT_FORM: SourceFormState = {
  slug: '',
  pathology_name: '',
  specialty: '',
  synonyms: '',
  keywords: '',
  source_url: '',
  source_kind: 'pdf',
  google_drive_url: '',
  google_drive_file_id: '',
  source_title: '',
  issuing_body: '',
  is_active: true,
  primary_topic: '',
  secondary_topics: '',
  clinical_tags: '',
  anatomy_terms: '',
  problem_terms: '',
  content_type: 'checklist',
  is_featured: false,
  search_priority: '0',
  related_guideline_slugs: '',
};

const DEFAULT_REQUEST_FORM: RequestFormState = {
  request_type: 'topic',
  title: '',
  description: '',
  source_url: '',
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const normalizeListInput = (value: string) =>
  Array.from(new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean)));

const formatListInput = (values?: string[] | null) => (values || []).join(', ');
const normalizeTopicMatcherText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const makeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const makeChecklistSectionId = (value: string) => `section-checklist-${makeSlug(value || 'checklist')}`;
const isValidDateValue = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
const normalizeStringListForSave = (items: string[] = []) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
const parseTextareaList = (value: string) => normalizeStringListForSave(value.split('\n'));
const formatTextareaList = (values?: string[] | null) => (values || []).join('\n');

const getSourceKindLabel = (sourceKind?: PathologyGuidelineSourceKind | null) => {
  if (sourceKind === 'pdf') return 'PDF source';
  if (sourceKind === 'external') return 'External source';
  return 'Google Drive source';
};

const getSourceActionLabel = (sourceKind?: PathologyGuidelineSourceKind | null) => (sourceKind === 'pdf' ? 'Open PDF' : 'Open source');

const getOriginLabel = (origin?: PathologyGuidelineVersion['origin']) => {
  if (origin === 'pdf_json_import') return 'Imported from PDF JSON';
  if (origin === 'drive_sync') return 'Synced from Drive';
  if (origin === 'draft_clone') return 'Edited draft';
  return 'Manual draft';
};

const getRequestTypeLabel = (requestType: PathologyGuidelineRequestType) => {
  if (requestType === 'pdf_source') return 'PDF source';
  if (requestType === 'guideline_update') return 'Guideline update';
  return 'Topic';
};

const getRequestStatusLabel = (status: PathologyGuidelineRequestStatus) => {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'completed') return 'Completed';
  return 'Pending';
};

const getTrainingHubIdForItem = (item: PathologyGuidelineListItem) => {
  const searchableValues = [
    item.primary_topic,
    item.specialty,
    ...item.secondary_topics,
    item.pathology_name,
    ...item.clinical_tags,
    ...item.anatomy_terms,
    ...item.problem_terms,
  ]
    .filter(Boolean)
    .map((value) => normalizeTopicMatcherText(String(value)));

  const combined = searchableValues.join(' ');

  for (const hub of CURATED_TRAINING_HUBS) {
    if (hub.id === GENERAL_OTHER_HUB_ID) continue;
    if (hub.matchers.some((matcher) => combined.includes(normalizeTopicMatcherText(matcher)))) {
      return hub.id;
    }
  }

  return GENERAL_OTHER_HUB_ID;
};

const getTrainingHubDefinition = (hubId: string) =>
  CURATED_TRAINING_HUBS.find((hub) => hub.id === hubId) || CURATED_TRAINING_HUBS[CURATED_TRAINING_HUBS.length - 1];

const buildCuratedTopicHubs = (items: PathologyGuidelineListItem[]): RadioGraphicsTopicHub[] =>
  CURATED_TRAINING_HUBS.map((hub) => {
    const hubItems = items
      .filter((item) => getTrainingHubIdForItem(item) === hub.id)
      .sort((left, right) => Number(right.is_featured) - Number(left.is_featured) || right.search_priority - left.search_priority || left.pathology_name.localeCompare(right.pathology_name));

    return {
      id: hub.id,
      topic: hub.topic,
      icon: hub.icon,
      description: hub.description,
      activeDescription: hub.activeDescription,
      count: hubItems.length,
      sourceTopics: Array.from(new Set(hubItems.map((item) => item.primary_topic || item.specialty || '').filter(Boolean))).slice(0, 6),
      tags: Array.from(new Set(hubItems.flatMap((item) => [...item.clinical_tags, ...item.problem_terms]).filter(Boolean))).slice(0, 4),
      featuredItems: hubItems.slice(0, 3),
    };
  }).filter((hub) => hub.count > 0);

const normalizeImportedParagraph = (value: string) =>
  value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeImportedSummary = (summary: string) =>
  summary
    .split(/\n{2,}/)
    .map((entry) => normalizeImportedParagraph(entry))
    .filter(Boolean);

const renderSummaryBlocks = (summary: string) => {
  const paragraphs = normalizeImportedSummary(summary);
  if (!paragraphs.length) return <p className="text-sm text-slate-400">No summary available for this guideline version.</p>;
  return paragraphs.map((paragraph, index) => (
    <p key={`${index}-${paragraph.slice(0, 16)}`} className="text-sm leading-6 text-slate-200">{paragraph}</p>
  ));
};

const renderQuickList = (items: string[], accent: 'cyan' | 'amber' | 'emerald' = 'cyan') => {
  if (!items.length) return null;
  const accentClasses =
    accent === 'amber'
      ? 'border-white/5 bg-white/[0.03] text-amber-50/90'
      : accent === 'emerald'
        ? 'border-white/5 bg-white/[0.03] text-emerald-50/90'
        : 'border-white/5 bg-white/[0.03] text-slate-100';
  return (
    <div className={`rounded-2xl border p-4 ${accentClasses}`}>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="mt-0.5 text-sm leading-6 opacity-80">-</span>
            <p className="text-sm leading-6">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const normalizeChecklistItemsForSave = (items: PathologyChecklistItem[]) =>
  items
    .map((item, index) => ({
      id: item.id.trim(),
      label: item.label.trim(),
      section: item.section?.trim() || null,
      order: Number(item.order) || index + 1,
      notes: item.notes?.trim() || null,
    }))
    .sort((left, right) => left.order - right.order);

const groupChecklistItems = (items: PathologyChecklistItem[]): GroupedChecklistSection[] => {
  const grouped: Record<string, PathologyChecklistItem[]> = items.reduce((acc, item) => {
    const key = item.section?.trim() || 'Checklist';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, PathologyChecklistItem[]>);

  return Object.entries(grouped).map(([label, sectionItems]) => ({
    id: makeChecklistSectionId(label),
    label,
    items: sectionItems,
  }));
};

const mergeImportPayloadIntoForm = (current: SourceFormState, payload: PathologyGuidelineImportPayload): SourceFormState => ({
  ...current,
  pathology_name: payload.pathology_name || current.pathology_name,
  slug: payload.slug || current.slug || makeSlug(payload.pathology_name || current.pathology_name),
  specialty: payload.specialty || current.specialty,
  synonyms: payload.synonyms?.length ? formatListInput(payload.synonyms) : current.synonyms,
  keywords: payload.keywords?.length ? formatListInput(payload.keywords) : current.keywords,
  source_kind: 'pdf',
  source_title: payload.source_title || current.source_title,
  issuing_body: payload.issuing_body || current.issuing_body,
  source_url: current.source_url,
  google_drive_url: '',
  google_drive_file_id: '',
});

const validateImportPayload = (raw: string): { payload: PathologyGuidelineImportPayload | null; errors: string[] } => {
  try {
    const parsed = JSON.parse(raw);
    const errors: string[] = [];
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { payload: null, errors: ['JSON must be an object.'] };
    const checklistItems = Array.isArray(parsed.checklist_items) ? normalizeChecklistItemsForSave(parsed.checklist_items as PathologyChecklistItem[]) : [];
    if (!String(parsed.pathology_name || '').trim()) errors.push('pathology_name is required.');
    if (!String(parsed.tldr_md || '').trim() && !String(parsed.rich_summary_md || '').trim()) errors.push('tldr_md or rich_summary_md is required.');
    if (!String(parsed.rich_summary_md || '').trim()) errors.push('rich_summary_md is required.');
    if (!checklistItems.length) errors.push('checklist_items must contain at least one item.');
    const ids = new Set<string>();
    const orders = new Set<number>();
    checklistItems.forEach((item, index) => {
      if (!item.id) errors.push(`Checklist item ${index + 1} is missing an id.`);
      if (!item.label) errors.push(`Checklist item ${index + 1} is missing a label.`);
      if (ids.has(item.id)) errors.push(`Duplicate checklist id: ${item.id}`);
      if (orders.has(item.order)) errors.push(`Duplicate checklist order: ${item.order}`);
      ids.add(item.id);
      orders.add(item.order);
    });
    const effectiveDate = String(parsed.effective_date || '').trim();
    if (!isValidDateValue(effectiveDate)) errors.push('effective_date must use YYYY-MM-DD or be empty.');
    if (errors.length) return { payload: null, errors };
    return {
      payload: {
        filename: String(parsed.filename || '').trim() || null,
        slug: String(parsed.slug || '').trim() || null,
        pathology_name: String(parsed.pathology_name).trim(),
        specialty: String(parsed.specialty || '').trim() || null,
        synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms.map((item) => String(item).trim()).filter(Boolean) : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((item) => String(item).trim()).filter(Boolean) : [],
        source_title: String(parsed.source_title || '').trim() || null,
        issuing_body: String(parsed.issuing_body || '').trim() || null,
        version_label: String(parsed.version_label || '').trim() || null,
        effective_date: effectiveDate || null,
        tldr_md: String(parsed.tldr_md || '').trim() || String(parsed.rich_summary_md || '').trim(),
        rich_summary_md: String(parsed.rich_summary_md).trim(),
        reporting_takeaways: Array.isArray(parsed.reporting_takeaways) ? parsed.reporting_takeaways.map((item) => String(item).trim()).filter(Boolean) : [],
        reporting_red_flags: Array.isArray(parsed.reporting_red_flags) ? parsed.reporting_red_flags.map((item) => String(item).trim()).filter(Boolean) : [],
        suggested_report_phrases: Array.isArray(parsed.suggested_report_phrases) ? parsed.suggested_report_phrases.map((item) => String(item).trim()).filter(Boolean) : [],
        checklist_items: checklistItems,
        parse_notes: String(parsed.parse_notes || '').trim() || null,
      },
      errors: [],
    };
  } catch (error: any) {
    return { payload: null, errors: [error?.message || 'Invalid JSON.'] };
  }
};

const getMatchReason = (item: PathologyGuidelineListItem): RadioGraphicsSearchMatchReason | null => (item.match_reason ? { label: item.match_reason } : null);

const TopicHubGrid: React.FC<{
  hubs: RadioGraphicsTopicHub[];
  activeTopic: string | null;
  onSelectTopic: (topic: string) => void;
}> = ({
  hubs,
  activeTopic,
  onSelectTopic,
}) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {hubs.map((hub) => {
      const active = hub.topic === activeTopic;
      return (
        <button
          key={hub.id}
          type="button"
          onClick={() => onSelectTopic(hub.topic)}
          className={`w-full rounded-2xl border px-4 py-5 text-left transition ${active ? 'border-cyan-400/18 bg-cyan-950/[0.16]' : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'}`}
          aria-label={`${hub.topic}, ${hub.count} ${hub.count === 1 ? 'guide' : 'guides'}`}
        >
          <span className={`material-icons text-[24px] ${active ? 'text-cyan-200' : 'text-cyan-300'}`}>{hub.icon}</span>
          <div className="mt-3 min-w-0">
            <p className="text-sm font-semibold text-white">{hub.topic}</p>
          </div>
        </button>
      );
    })}
  </div>
);

const GuidelineResultCard: React.FC<{
  item: PathologyGuidelineListItem;
  active: boolean;
  onClick: () => void;
  variant?: 'browse' | 'search';
  topicLabel?: string;
}> = ({
  item,
  active,
  onClick,
  variant = 'search',
  topicLabel,
}) => {
  const matchReason = getMatchReason(item);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border text-left transition ${variant === 'browse'
        ? `${active ? 'border-cyan-400/18 bg-cyan-950/[0.08]' : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]'} px-3 py-3`
        : `${active ? 'border-cyan-400/22 bg-cyan-950/[0.08] shadow-[0_0_0_1px_rgba(8,145,178,0.05)]' : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.05]'} p-3`
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="line-clamp-2 text-sm font-semibold text-white">{item.pathology_name}</p>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${variant === 'browse' ? 'border border-cyan-400/14 bg-cyan-500/[0.06] tracking-[0.12em] text-cyan-100/80' : 'border border-cyan-400/20 bg-cyan-500/10 tracking-[0.18em] text-cyan-100'}`}>{topicLabel || item.primary_topic || 'General'}</span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-400">{[item.specialty, item.issuing_body].filter(Boolean).join(' • ') || 'Published guideline'}</p>
        {item.tldr_md ? <p className={`mt-2 line-clamp-2 text-xs leading-5 ${variant === 'browse' ? 'text-slate-400' : 'text-slate-300'}`}>{normalizeImportedParagraph(item.tldr_md)}</p> : null}
        {variant === 'search' && matchReason ? <p className="mt-2 text-[11px] font-medium text-cyan-200">{matchReason.label}</p> : null}
        <div className={`mt-3 flex flex-wrap gap-2 text-[10px] uppercase ${variant === 'browse' ? 'tracking-[0.14em] text-slate-500' : 'tracking-[0.18em] text-slate-500'}`}>
          {item.effective_date ? <span>{formatDateLabel(item.effective_date)}</span> : null}
          {item.content_type ? <span>{item.content_type}</span> : null}
        </div>
      </div>
    </button>
  );
};

const ReferenceSourceSection: React.FC<{ detail: PathologyGuidelineDetail }> = ({ detail }) => {
  const hasLink = Boolean(detail.source_url || detail.google_drive_url);
  return (
    <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-icons text-[18px] text-cyan-300">menu_book</span>
        <h3 className="text-sm font-semibold text-white">Reference source</h3>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <p className="font-medium text-white">{detail.source_title || 'Untitled source'}</p>
        <p>{[detail.issuing_body, detail.version_label, detail.effective_date ? formatDateLabel(detail.effective_date) : null].filter(Boolean).join(' • ') || 'Reference metadata pending'}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{getSourceKindLabel(detail.source_kind)}</p>
      </div>
      {hasLink ? <a href={detail.source_url || detail.google_drive_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">{getSourceActionLabel(detail.source_kind)}</a> : null}
    </section>
  );
};

const RelatedGuidelinesSection: React.FC<{
  items: PathologyGuidelineListItem[];
  onSelectItem: (item: PathologyGuidelineListItem) => void;
}> = ({
  items,
  onSelectItem,
}) => {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-icons text-[18px] text-cyan-300">hub</span>
        <h3 className="text-sm font-semibold text-white">Related guidelines</h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => <GuidelineResultCard key={item.guideline_id} item={item} active={false} onClick={() => onSelectItem(item)} variant="browse" />)}
      </div>
    </section>
  );
};

const ChecklistSection: React.FC<{
  sections: GroupedChecklistSection[];
  bindSectionRef: (sectionId: string) => (node: HTMLElement | null) => void;
  bindSectionContainerRef: (sectionId: string) => (node: HTMLElement | null) => void;
}> = ({
  sections,
  bindSectionRef,
  bindSectionContainerRef,
}) => (
  <div className="space-y-3">
    {sections.map((section) => (
      <section key={section.id} ref={bindSectionContainerRef(section.id)} className="scroll-mt-24 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4">
        <div id={section.id} ref={bindSectionRef(section.id)} className="mb-2 flex scroll-mt-24 items-center gap-2">
          <span className="material-icons text-[18px] text-cyan-300">checklist</span>
          <h3 className="text-sm font-semibold text-white">{section.label}</h3>
        </div>
        <div className="space-y-2">
          {section.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-500/10">
                  <span className="material-icons text-[14px] text-cyan-200">done</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">{item.label}</p>
                  {item.notes ? <p className="mt-1 text-xs leading-5 text-slate-400">{item.notes}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);

const PathologyChecklistScreen: React.FC<PathologyChecklistScreenProps> = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [results, setResults] = useState<PathologyGuidelineListItem[]>([]);
  const [libraryItems, setLibraryItems] = useState<PathologyGuidelineListItem[]>([]);
  const [topicHubs, setTopicHubs] = useState<RadioGraphicsTopicHub[]>([]);
  const [featuredGuidelines, setFeaturedGuidelines] = useState<PathologyGuidelineListItem[]>([]);
  const [recentGuidelines, setRecentGuidelines] = useState<PathologyGuidelineListItem[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeBrowseTag, setActiveBrowseTag] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PathologyGuidelineListItem | null>(null);
  const [detail, setDetail] = useState<PathologyGuidelineDetail | null>(null);
  const [relatedGuidelines, setRelatedGuidelines] = useState<PathologyGuidelineListItem[]>([]);
  const [versions, setVersions] = useState<PathologyGuidelineVersion[]>([]);
  const [sourceRecord, setSourceRecord] = useState<PathologyGuidelineSource | null>(null);
  const [form, setForm] = useState<SourceFormState>(DEFAULT_FORM);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [publishingVersionId, setPublishingVersionId] = useState<string | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableDraft, setEditableDraft] = useState<PathologyGuidelineVersion | null>(null);
  const [draftForm, setDraftForm] = useState<EditableDraftPatch>({
    version_label: '',
    effective_date: '',
    source_title: '',
    issuing_body: '',
    tldr_md: '',
    rich_summary_md: '',
    reporting_takeaways: [],
    reporting_red_flags: [],
    suggested_report_phrases: [],
    checklist_items: [],
    parse_notes: '',
  });
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftFormErrors, setDraftFormErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'paste' | 'upload'>('upload');
  const [rawImportJson, setRawImportJson] = useState('');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importValidationErrors, setImportValidationErrors] = useState<string[]>([]);
  const [validatedImportPayload, setValidatedImportPayload] = useState<PathologyGuidelineImportPayload | null>(null);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [requestForm, setRequestForm] = useState<RequestFormState>(DEFAULT_REQUEST_FORM);
  const [requests, setRequests] = useState<PathologyGuidelineRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestStatusDrafts, setRequestStatusDrafts] = useState<Record<string, PathologyGuidelineRequestStatus>>({});
  const [requestNotesDrafts, setRequestNotesDrafts] = useState<Record<string, string>>({});
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const sectionContainerRefs = useRef<Record<string, HTMLElement | null>>({});
  const sectionNavRef = useRef<HTMLDivElement | null>(null);
  const scrollContainer = useContext(LayoutScrollContext);

  const canEdit = canEditPathologyChecklists(currentUserRole);
  const canSyncFromDrive = form.source_kind === 'google_drive' && !!form.google_drive_file_id.trim();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const loadRole = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) {
          if (active) {
            setCurrentUserId(null);
            setCurrentUserRole(null);
          }
          return;
        }
        if (active) setCurrentUserId(user.id);
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (active) setCurrentUserRole(normalizeUserRole(data?.role));
      } finally {
        if (active) setIsRoleLoading(false);
      }
    };
    loadRole().catch((error) => {
      console.error('Failed to load user role:', error);
      if (active) setIsRoleLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const loadLibraryCollections = async () => {
    setIsLoadingLibrary(true);
    try {
      const [allItems, featured] = await Promise.all([
        getCurrentPathologyGuidelines(),
        getFeaturedPathologyGuidelines(),
      ]);
      setLibraryItems(allItems);
      setTopicHubs(buildCuratedTopicHubs(allItems));
      setFeaturedGuidelines(featured);
      setRecentGuidelines(
        [...allItems]
          .sort((left, right) => (right.published_at || right.effective_date || '').localeCompare(left.published_at || left.effective_date || ''))
          .slice(0, 6),
      );
    } catch (error) {
      console.error('Failed to load RadioGraphics library:', error);
      toastError('Unable to load pathology checklists', 'Confirm the pathology guideline migrations have been applied.');
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  useEffect(() => {
    loadLibraryCollections().catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    let active = true;
    const loadRequests = async () => {
      setIsLoadingRequests(true);
      try {
        const nextRequests = await listPathologyGuidelineRequests();
        if (!active) return;
        setRequests(nextRequests);
        setRequestStatusDrafts(nextRequests.reduce<Record<string, PathologyGuidelineRequestStatus>>((acc, request) => ({ ...acc, [request.id]: request.status }), {}));
        setRequestNotesDrafts(nextRequests.reduce<Record<string, string>>((acc, request) => ({ ...acc, [request.id]: request.review_notes || '' }), {}));
      } catch (error) {
        console.error('Failed to load pathology checklist requests:', error);
      } finally {
        if (active) setIsLoadingRequests(false);
      }
    };
    loadRequests().catch((error) => console.error(error));
    return () => {
      active = false;
    };
  }, [canEdit]);

  useEffect(() => {
    let active = true;
    const runSearch = async () => {
      if (!debouncedQuery.trim()) {
        if (active) {
          setResults([]);
          setIsLoadingResults(false);
        }
        return;
      }
      setIsLoadingResults(true);
      try {
        const next = await searchPathologyGuidelines(debouncedQuery);
        if (active) setResults(next);
      } catch (error) {
        console.error('Failed to load pathology guidelines:', error);
        toastError('Unable to search pathology checklists', 'Try refreshing the page and searching again.');
        if (active) setResults([]);
      } finally {
        if (active) setIsLoadingResults(false);
      }
    };
    runSearch().catch((error) => console.error(error));
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const activeHub = useMemo(
    () => topicHubs.find((hub) => hub.topic === activeTopic) || null,
    [activeTopic, topicHubs],
  );

  const hubTags = useMemo(() => {
    if (!activeTopic) return [];
    return Array.from(
      new Set(
        libraryItems
          .filter((item) => getTrainingHubDefinition(getTrainingHubIdForItem(item)).topic === activeTopic)
          .flatMap((item) => [...item.clinical_tags, ...item.problem_terms])
          .filter(Boolean),
      ),
    ).slice(0, 8);
  }, [activeTopic, libraryItems]);

  const displayResults = useMemo(() => {
    if (debouncedQuery.trim()) return results;
    if (!activeTopic) return [];
    return libraryItems
      .filter((item) => getTrainingHubDefinition(getTrainingHubIdForItem(item)).topic === activeTopic)
      .filter((item) => !activeBrowseTag || [...item.clinical_tags, ...item.problem_terms].includes(activeBrowseTag))
      .sort((left, right) => Number(right.is_featured) - Number(left.is_featured) || right.search_priority - left.search_priority || left.pathology_name.localeCompare(right.pathology_name));
  }, [activeBrowseTag, activeTopic, debouncedQuery, libraryItems, results]);

  const browseSections = useMemo<RadioGraphicsBrowseSection[]>(() => {
    if (!activeTopic || debouncedQuery.trim()) return [];
    if (!displayResults.length) return [];
    return [
      { id: 'featured', title: `${activeTopic} highlights`, description: activeHub?.activeDescription || 'Curated training guides.', items: displayResults.filter((item) => item.is_featured).slice(0, 4) },
      { id: 'library', title: 'Full library', description: 'All published guides in this topic.', items: displayResults },
    ].filter((section) => section.items.length);
  }, [activeHub?.activeDescription, activeTopic, debouncedQuery, displayResults]);

  useEffect(() => {
    if (!displayResults.length) {
      if (!debouncedQuery.trim() && !activeTopic) {
        setSelectedItem(null);
        setDetail(null);
        setRelatedGuidelines([]);
      }
      return;
    }
    if (!selectedItem || !displayResults.some((item) => item.guideline_id === selectedItem.guideline_id)) {
      setSelectedItem(displayResults[0]);
    }
  }, [activeTopic, debouncedQuery, displayResults, selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;
    let active = true;
    const loadDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const nextDetail = await getPathologyGuidelineDetail(selectedItem.slug);
        if (!active) return;
        setDetail(nextDetail);
        if (nextDetail) {
          const nextRelated = await getRelatedPathologyGuidelines(nextDetail);
          if (active) setRelatedGuidelines(nextRelated);
        } else if (active) {
          setRelatedGuidelines([]);
        }
        if (canEdit) {
          const [source, draftVersions] = await Promise.all([
            getPathologyGuidelineSource(selectedItem.guideline_id),
            getGuidelineDraftVersions(selectedItem.guideline_id),
          ]);
          if (!active) return;
          setSourceRecord(source);
          setVersions(draftVersions);
          if (source) {
            setForm({
              slug: source.slug,
              pathology_name: source.pathology_name,
              specialty: source.specialty || '',
              synonyms: formatListInput(source.synonyms),
              keywords: formatListInput(source.keywords),
              source_url: source.source_url || source.google_drive_url,
              source_kind: source.source_kind || 'pdf',
              google_drive_url: source.google_drive_url,
              google_drive_file_id: source.google_drive_file_id,
              source_title: source.source_title || '',
              issuing_body: source.issuing_body || '',
              is_active: source.is_active ?? true,
              primary_topic: source.primary_topic || '',
              secondary_topics: formatListInput(source.secondary_topics),
              clinical_tags: formatListInput(source.clinical_tags),
              anatomy_terms: formatListInput(source.anatomy_terms),
              problem_terms: formatListInput(source.problem_terms),
              content_type: source.content_type || 'checklist',
              is_featured: source.is_featured ?? false,
              search_priority: String(source.search_priority ?? 0),
              related_guideline_slugs: formatListInput(source.related_guideline_slugs),
            });
          }
        } else {
          setSourceRecord(null);
          setVersions([]);
        }
      } catch (error) {
        console.error('Failed to load pathology guideline detail:', error);
        toastError('Unable to load checklist detail', 'Try refreshing the page or selecting another pathology.');
      } finally {
        if (active) setIsLoadingDetail(false);
      }
    };
    loadDetail().catch((error) => console.error(error));
    return () => {
      active = false;
    };
  }, [canEdit, selectedItem]);

  const draftVersions = useMemo(() => versions.filter((version) => version.sync_status !== 'published'), [versions]);
  const checklistSections = useMemo(() => groupChecklistItems(detail?.checklist_items || []), [detail?.checklist_items]);
  const detailSections = useMemo<ChecklistDetailSection[]>(() => {
    if (!detail || isEditMode) return [];
    return [
      detail.tldr_md ? { id: 'section-tldr', label: 'Quick Summary' } : null,
      ...checklistSections.map((section) => ({ id: section.id, label: section.label })),
      detail.reporting_takeaways.length ? { id: 'section-reporting-takeaways', label: 'Takeaways' } : null,
      detail.reporting_red_flags.length ? { id: 'section-red-flags', label: 'Red flags' } : null,
      detail.suggested_report_phrases.length ? { id: 'section-report-phrases', label: 'Phrases' } : null,
      detail.rich_summary_md ? { id: 'section-rich-summary', label: 'Summary' } : null,
      { id: 'section-reference-source', label: 'Reference source' },
      relatedGuidelines.length ? { id: 'section-related-guidelines', label: 'Related' } : null,
      detail.parse_notes ? { id: 'section-notes', label: 'Notes' } : null,
    ].filter(Boolean) as ChecklistDetailSection[];
  }, [checklistSections, detail, isEditMode, relatedGuidelines.length]);

  useEffect(() => {
    if (!detailSections.length || isEditMode) {
      setActiveSectionId(null);
      return;
    }
    const updateActiveSection = () => {
      const sectionsWithNodes = detailSections
        .map((section) => ({ section, node: sectionRefs.current[section.id] }))
        .filter((entry): entry is { section: ChecklistDetailSection; node: HTMLElement } => Boolean(entry.node));
      if (!sectionsWithNodes.length) {
        setActiveSectionId(detailSections[0]?.id || null);
        return;
      }
      const navBottom = sectionNavRef.current?.getBoundingClientRect().bottom ?? 96;
      const viewportBottom = window.innerHeight - 110;
      const readingTop = navBottom + 8;
      const readingBottom = Math.max(readingTop + 120, viewportBottom);
      const nextActiveId = sectionsWithNodes.reduce<{ id: string; visibleHeight: number; distanceToReadingTop: number }>((best, entry) => {
        const containerNode = sectionContainerRefs.current[entry.section.id] || entry.node;
        const rect = containerNode.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, readingTop);
        const visibleBottom = Math.min(rect.bottom, readingBottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const distanceToReadingTop = Math.abs(entry.node.getBoundingClientRect().top - readingTop);
        if (visibleHeight > best.visibleHeight) return { id: entry.section.id, visibleHeight, distanceToReadingTop };
        if (visibleHeight === best.visibleHeight && distanceToReadingTop < best.distanceToReadingTop) {
          return { id: entry.section.id, visibleHeight, distanceToReadingTop };
        }
        return best;
      }, { id: sectionsWithNodes[0].section.id, visibleHeight: -1, distanceToReadingTop: Number.POSITIVE_INFINITY }).id;
      setActiveSectionId(nextActiveId);
    };
    updateActiveSection();
    scrollContainer?.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      scrollContainer?.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [detailSections, isEditMode, scrollContainer]);

  const scrollToSection = (sectionId: string) => {
    const node = sectionRefs.current[sectionId];
    if (!node) return;
    setActiveSectionId(sectionId);
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTopOfDetail = () => {
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => {
        if (scrollContainer.scrollTop > 0) scrollContainer.scrollTop = 0;
      }, 250);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bindSectionRef = (sectionId: string) => (node: HTMLElement | null) => {
    sectionRefs.current[sectionId] = node;
  };
  const bindSectionContainerRef = (sectionId: string) => (node: HTMLElement | null) => {
    sectionContainerRefs.current[sectionId] = node;
  };

  const handleSelectItem = (item: PathologyGuidelineListItem) => {
    setSelectedItem(item);
    setIsEditMode(false);
    if (isAdminPanelOpen && sourceRecord?.id !== item.guideline_id) setIsAdminPanelOpen(false);
  };
  const handleSelectQuickChip = (chip: string) => {
    setActiveTopic(null);
    setActiveBrowseTag(null);
    setQuery(chip);
  };
  const handleSelectTopic = (topic: string) => {
    setQuery('');
    setDebouncedQuery('');
    setActiveBrowseTag(null);
    setActiveTopic((prev) => (prev === topic ? null : topic));
  };

  const resetAdminForm = () => {
    setSourceRecord(null);
    setVersions([]);
    setForm({ ...DEFAULT_FORM, pathology_name: query.trim(), slug: makeSlug(query.trim()), primary_topic: '' });
    setIsAdminPanelOpen(true);
    setIsEditMode(false);
  };

  const refreshCurrentSelection = async () => {
    await loadLibraryCollections();
    if (!debouncedQuery.trim()) return;
    const nextResults = await searchPathologyGuidelines(debouncedQuery);
    setResults(nextResults);
    if (!selectedItem) return;
    const nextSelection = nextResults.find((item) => item.guideline_id === selectedItem.guideline_id) || null;
    if (nextSelection) setSelectedItem(nextSelection);
  };

  const refreshRequests = async () => {
    const nextRequests = await listPathologyGuidelineRequests();
    setRequests(nextRequests);
    setRequestStatusDrafts(nextRequests.reduce<Record<string, PathologyGuidelineRequestStatus>>((acc, request) => ({ ...acc, [request.id]: request.status }), {}));
    setRequestNotesDrafts(nextRequests.reduce<Record<string, string>>((acc, request) => ({ ...acc, [request.id]: request.review_notes || '' }), {}));
  };

  const loadDraftIntoForm = (draft: PathologyGuidelineVersion) => {
    setEditableDraft(draft);
    setDraftForm({
      version_label: draft.version_label || '',
      effective_date: draft.effective_date || '',
      source_title: draft.source_title || '',
      issuing_body: draft.issuing_body || '',
      tldr_md: draft.tldr_md || '',
      rich_summary_md: draft.rich_summary_md || '',
      reporting_takeaways: draft.reporting_takeaways || [],
      reporting_red_flags: draft.reporting_red_flags || [],
      suggested_report_phrases: draft.suggested_report_phrases || [],
      checklist_items: draft.checklist_items.map((item) => ({ ...item })),
      parse_notes: draft.parse_notes || '',
    });
    setDraftFormErrors([]);
  };

  const validateDraftForm = (): string[] => {
    const errors: string[] = [];
    if (!(draftForm.tldr_md || '').trim()) errors.push('Quick summary / immediate take-home is required.');
    if (!(draftForm.rich_summary_md || '').trim()) errors.push('Rich summary is required.');
    if (!isValidDateValue((draftForm.effective_date || '').trim())) errors.push('Effective date must use YYYY-MM-DD.');
    const items = normalizeChecklistItemsForSave(draftForm.checklist_items || []);
    if (!items.length) errors.push('At least one checklist item is required.');
    const ids = new Set<string>();
    const orders = new Set<number>();
    items.forEach((item, index) => {
      if (!item.id) errors.push(`Checklist item ${index + 1} is missing an id.`);
      if (!item.label) errors.push(`Checklist item ${index + 1} is missing a label.`);
      if (!Number.isInteger(item.order) || item.order <= 0) errors.push(`Checklist item ${index + 1} has an invalid order.`);
      if (item.id && ids.has(item.id)) errors.push(`Checklist item id "${item.id}" is duplicated.`);
      if (orders.has(item.order)) errors.push(`Checklist order ${item.order} is duplicated.`);
      ids.add(item.id);
      orders.add(item.order);
    });
    return errors;
  };

  const persistSourceRecord = async (): Promise<PathologyGuidelineSource> => {
    const pathologyName = form.pathology_name.trim();
    const slug = (form.slug.trim() || makeSlug(pathologyName)).trim();
    const sourceKind = form.source_kind;
    const sourceUrl = form.source_url.trim();
    const googleDriveUrl = sourceKind === 'google_drive' ? (form.google_drive_url.trim() || sourceUrl) : '';
    const googleDriveFileId = sourceKind === 'google_drive' ? form.google_drive_file_id.trim() : '';
    const primaryTopic = form.primary_topic.trim();
    const clinicalTags = normalizeListInput(form.clinical_tags);
    const anatomyTerms = normalizeListInput(form.anatomy_terms);
    const problemTerms = normalizeListInput(form.problem_terms);
    if (!pathologyName || !slug) throw new Error('Pathology name and slug are required.');
    if (form.is_active) {
      if (!primaryTopic) throw new Error('Primary topic is required for active guidelines.');
      if (!anatomyTerms.length) throw new Error('At least one anatomy term is required for active guidelines.');
      if (!clinicalTags.length && !problemTerms.length) throw new Error('Add at least one clinical tag or problem term for active guidelines.');
    }
    const payload = {
      slug,
      pathology_name: pathologyName,
      specialty: form.specialty.trim() || null,
      synonyms: normalizeListInput(form.synonyms),
      keywords: normalizeListInput(form.keywords),
      source_url: sourceUrl,
      source_kind: sourceKind,
      google_drive_url: googleDriveUrl,
      google_drive_file_id: googleDriveFileId,
      source_title: form.source_title.trim() || null,
      issuing_body: form.issuing_body.trim() || null,
      is_active: form.is_active,
      primary_topic: primaryTopic || null,
      secondary_topics: normalizeListInput(form.secondary_topics),
      clinical_tags: clinicalTags,
      anatomy_terms: anatomyTerms,
      problem_terms: problemTerms,
      content_type: form.content_type,
      is_featured: form.is_featured,
      search_priority: Math.max(0, Number(form.search_priority) || 0),
      related_guideline_slugs: normalizeListInput(form.related_guideline_slugs),
    };
    if (sourceRecord?.id) {
      await updatePathologyGuidelineSource(sourceRecord.id, payload);
      const updatedSource = await getPathologyGuidelineSource(sourceRecord.id);
      if (!updatedSource) throw new Error('Updated source could not be reloaded.');
      return updatedSource;
    }
    const created = await createPathologyGuidelineSource(payload);
    const createdSource = await getPathologyGuidelineSource(created.id);
    if (!createdSource) throw new Error('Created source could not be loaded.');
    return createdSource;
  };

  const handleSaveSource = async () => {
    setIsSavingSource(true);
    try {
      const persistedSource = await persistSourceRecord();
      setSourceRecord(persistedSource);
      toastSuccess(sourceRecord?.id ? 'Guideline source updated' : 'Guideline source created');
      await refreshCurrentSelection();
    } catch (error: any) {
      console.error('Failed to save pathology guideline source:', error);
      toastError('Unable to save guideline source', error?.message || 'Please review the metadata and try again.');
    } finally {
      setIsSavingSource(false);
    }
  };

  const handleSync = async () => {
    if (!sourceRecord?.id) return toastInfo('Save the source first', 'Create or update the source record before syncing from Drive.');
    if (!canSyncFromDrive) return toastInfo('Drive sync unavailable', 'Only Google Drive sources with a file id can sync from Drive.');
    setIsSyncing(true);
    try {
      const data = await syncPathologyGuideline(sourceRecord.id);
      toastSuccess('Draft synced from Google Drive', data.sourceTitle || 'Review the parsed checklist before publishing.');
      setVersions(await getGuidelineDraftVersions(sourceRecord.id));
    } catch (error: any) {
      console.error('Failed to sync pathology guideline:', error);
      toastError('Guideline sync failed', error?.message || 'Check Drive access and Edge Function secrets.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePublish = async (versionId: string) => {
    setPublishingVersionId(versionId);
    try {
      await publishPathologyGuidelineVersion(versionId);
      toastSuccess('Guideline version published');
      await refreshCurrentSelection();
      if (selectedItem) {
        const [nextDetail, nextVersions] = await Promise.all([getPathologyGuidelineDetail(selectedItem.slug), getGuidelineDraftVersions(selectedItem.guideline_id)]);
        setDetail(nextDetail);
        setVersions(nextVersions);
      }
    } catch (error: any) {
      console.error('Failed to publish pathology guideline version:', error);
      toastError('Unable to publish version', error?.message || 'Please try again.');
    } finally {
      setPublishingVersionId(null);
    }
  };

  const handleEditDraft = async () => {
    if (!selectedItem) return;
    setIsPreparingDraft(true);
    try {
      const draft = (await getLatestEditableDraft(selectedItem.guideline_id)) || (await createPathologyGuidelineDraftFromCurrent(selectedItem.guideline_id));
      loadDraftIntoForm(draft);
      setIsEditMode(true);
      setIsAdminPanelOpen(true);
    } catch (error: any) {
      console.error('Failed to prepare editable draft:', error);
      toastError('Unable to prepare draft', error?.message || 'Please try again.');
    } finally {
      setIsPreparingDraft(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!editableDraft?.id) return false;
    const errors = validateDraftForm();
    setDraftFormErrors(errors);
    if (errors.length) return false;
    setIsSavingDraft(true);
    try {
      const payload: EditableDraftPatch = {
        version_label: draftForm.version_label?.trim() || null,
        effective_date: draftForm.effective_date?.trim() || null,
        source_title: draftForm.source_title?.trim() || null,
        issuing_body: draftForm.issuing_body?.trim() || null,
        tldr_md: draftForm.tldr_md?.trim() || '',
        rich_summary_md: draftForm.rich_summary_md?.trim() || '',
        reporting_takeaways: normalizeStringListForSave(draftForm.reporting_takeaways || []),
        reporting_red_flags: normalizeStringListForSave(draftForm.reporting_red_flags || []),
        suggested_report_phrases: normalizeStringListForSave(draftForm.suggested_report_phrases || []),
        checklist_items: normalizeChecklistItemsForSave(draftForm.checklist_items || []),
        parse_notes: draftForm.parse_notes?.trim() || null,
      };
      await updatePathologyGuidelineDraft(editableDraft.id, payload);
      const nextDraft = await getLatestEditableDraft(editableDraft.guideline_id);
      setVersions(await getGuidelineDraftVersions(editableDraft.guideline_id));
      if (nextDraft) loadDraftIntoForm(nextDraft);
      toastSuccess('Draft saved');
      return true;
    } catch (error: any) {
      console.error('Failed to save checklist draft:', error);
      toastError('Unable to save draft', error?.message || 'Please review the checklist fields and try again.');
      return false;
    } finally {
      setIsSavingDraft(false);
    }
  };

  const addChecklistItem = () => setDraftForm((prev) => ({
    ...prev,
    checklist_items: [...(prev.checklist_items || []), { id: `item-${(prev.checklist_items || []).length + 1}`, label: '', order: (prev.checklist_items || []).length + 1, section: 'Checklist', notes: null }],
  }));
  const updateChecklistItem = (index: number, patch: Partial<PathologyChecklistItem>) => setDraftForm((prev) => {
    const items = [...(prev.checklist_items || [])];
    items[index] = { ...items[index], ...patch };
    return { ...prev, checklist_items: items };
  });
  const deleteChecklistItem = (index: number) => setDraftForm((prev) => ({
    ...prev,
    checklist_items: (prev.checklist_items || []).filter((_, currentIndex) => currentIndex !== index).map((item, currentIndex) => ({ ...item, order: currentIndex + 1 })),
  }));

  const handleValidateImportJson = () => {
    const { payload, errors } = validateImportPayload(rawImportJson);
    setImportValidationErrors(errors);
    setValidatedImportPayload(payload);
    const warnings: string[] = [];
    if (payload) {
      if (sourceRecord?.pathology_name && sourceRecord.pathology_name.trim().toLowerCase() !== payload.pathology_name.trim().toLowerCase()) warnings.push(`Imported pathology "${payload.pathology_name}" differs from current source "${sourceRecord.pathology_name}".`);
      if ((sourceRecord?.source_title || '').trim() && (sourceRecord?.source_title || '').trim().toLowerCase() !== (payload.source_title || '').trim().toLowerCase()) warnings.push('Imported source title differs from the current source metadata.');
      toastSuccess('JSON ready', `${payload.checklist_items.length} checklist items ready to save as draft.`);
      if (!sourceRecord?.id) setForm((prev) => mergeImportPayloadIntoForm(prev, payload));
    }
    setImportWarnings(warnings);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawImportJson(text);
    setImportFileName(file.name);
    const { payload, errors } = validateImportPayload(text);
    setImportValidationErrors(errors);
    setValidatedImportPayload(payload);
    const warnings: string[] = [];
    if (payload) {
      if (sourceRecord?.pathology_name && sourceRecord.pathology_name.trim().toLowerCase() !== payload.pathology_name.trim().toLowerCase()) warnings.push(`Imported pathology "${payload.pathology_name}" differs from current source "${sourceRecord.pathology_name}".`);
      if ((sourceRecord?.source_title || '').trim() && (sourceRecord?.source_title || '').trim().toLowerCase() !== (payload.source_title || '').trim().toLowerCase()) warnings.push('Imported source title differs from the current source metadata.');
      toastSuccess('JSON ready', `${payload.checklist_items.length} checklist items loaded from ${file.name}.`);
      if (!sourceRecord?.id) setForm((prev) => mergeImportPayloadIntoForm(prev, payload));
    }
    setImportWarnings(warnings);
  };

  const handleImportJson = async () => {
    if (!validatedImportPayload) return toastInfo('Validate the JSON first', 'Fix any import errors before saving a draft.');
    setIsImportingJson(true);
    try {
      const persistedSource = sourceRecord?.id ? sourceRecord : await persistSourceRecord();
      if (!sourceRecord?.id) setSourceRecord(persistedSource);
      const createdVersion = await importPathologyGuidelineVersion(persistedSource.id, validatedImportPayload);
      setVersions(await getGuidelineDraftVersions(persistedSource.id));
      loadDraftIntoForm(createdVersion);
      setIsEditMode(true);
      setIsAdminPanelOpen(true);
      toastSuccess('Draft imported', 'Review the draft and publish when ready.');
    } catch (error: any) {
      console.error('Failed to import JSON guideline draft:', error);
      toastError('Unable to import JSON draft', error?.message || 'Please review the metadata and try again.');
    } finally {
      setIsImportingJson(false);
    }
  };

  const handleSubmitRequest = async () => {
    const title = requestForm.title.trim();
    if (title.length < 3) return toastInfo('Add more detail', 'Please enter a request title with at least 3 characters.');
    setIsSubmittingRequest(true);
    try {
      await createPathologyGuidelineRequest({ request_type: requestForm.request_type, title, description: requestForm.description.trim() || null, source_url: requestForm.source_url.trim() || null });
      setRequestForm(DEFAULT_REQUEST_FORM);
      toastSuccess('Request sent');
      await refreshRequests();
    } catch (error: any) {
      console.error('Failed to submit pathology checklist request:', error);
      toastError('Unable to submit request', error?.message || 'Please try again.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleUpdateRequest = async (requestId: string) => {
    setUpdatingRequestId(requestId);
    try {
      await updatePathologyGuidelineRequest(requestId, { status: requestStatusDrafts[requestId], review_notes: requestNotesDrafts[requestId] || null });
      toastSuccess('Request updated');
      await refreshRequests();
    } catch (error: any) {
      console.error('Failed to update pathology checklist request:', error);
      toastError('Unable to update request', error?.message || 'Please try again.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    setDeletingRequestId(requestId);
    try {
      await deletePathologyGuidelineRequest(requestId);
      toastSuccess('Request deleted');
      await refreshRequests();
    } catch (error: any) {
      console.error('Failed to delete pathology checklist request:', error);
      toastError('Unable to delete request', error?.message || 'Please try again.');
    } finally {
      setDeletingRequestId(null);
    }
  };

  const renderBrowseSection = (section: RadioGraphicsBrowseSection) => (
    <div key={section.id} className="space-y-2">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{section.title}</h4>
        {section.description ? <p className="mt-1 text-xs text-slate-500">{section.description}</p> : null}
      </div>
      <div className="space-y-2">
        {section.items.map((item) => (
          <GuidelineResultCard
            key={`${section.id}-${item.guideline_id}`}
            item={item}
            active={item.guideline_id === selectedItem?.guideline_id}
            onClick={() => handleSelectItem(item)}
            variant="browse"
            topicLabel={getTrainingHubDefinition(getTrainingHubIdForItem(item)).topic}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-app px-6 pb-64 pt-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="pt-2">
          <h1 className="text-3xl font-bold text-white">RadioGraphics</h1>
        </header>

        <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 backdrop-blur-sm">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Search</label>
          <div className="relative">
            <span className="material-icons pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (event.target.value.trim()) {
                  setActiveTopic(null);
                  setActiveBrowseTag(null);
                }
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                if (!query.trim()) {
                  setIsSearchFocused(false);
                }
              }}
              placeholder="Search pathology, syndrome, or keyword"
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/24"
            />
          </div>
          {(isSearchFocused || query.trim().length > 0) ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_SEARCH_CHIPS.map((chip) => (
                <button key={chip} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => handleSelectQuickChip(chip)} className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] transition ${query === chip ? 'border-cyan-400/24 bg-cyan-500/10 text-cyan-100' : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'}`}>
                  {chip}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="space-y-4">
            <button type="button" onClick={() => setIsSuggestionOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/[0.04]">
              <div><h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Suggest</h2><p className="mt-1 text-xs leading-5 text-slate-400">Request a topic</p></div>
              <span className={`material-icons text-cyan-200 transition-transform ${isSuggestionOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            {isSuggestionOpen ? <div className="space-y-4"><p className="text-xs leading-5 text-slate-400">Request a topic, file, or update.</p><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Title</span><input value={requestForm.title} onChange={(event) => setRequestForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="What do you want added?" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Link</span><input value={requestForm.source_url} onChange={(event) => setRequestForm((prev) => ({ ...prev, source_url: event.target.value }))} placeholder="Optional source link" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Note</span><textarea value={requestForm.description} onChange={(event) => setRequestForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} placeholder="Optional context" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label><div className="flex flex-wrap gap-2"><button onClick={handleSubmitRequest} disabled={isSubmittingRequest} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSubmittingRequest ? 'Sending...' : 'Send request'}</button></div><div className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{canEdit ? 'Requests' : 'Your requests'}</h3>{isLoadingRequests ? <LoadingState compact title="Loading requests..." /> : requests.length ? requests.map((request) => <div key={request.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">{getRequestTypeLabel(request.request_type)}</span><span className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getRequestStatusLabel(request.status)}</span><span className="text-xs text-slate-500">{formatDateLabel(request.created_at)}</span></div><p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">Requested by {request.requester_name || request.requester_username || 'Unknown requester'}</p><p className="mt-2 text-sm font-semibold text-white">{request.title}</p>{request.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{request.description}</p> : null}{request.source_url ? <a href={request.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-cyan-200 hover:text-cyan-100">Open link</a> : null}{!canEdit && request.review_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{request.review_notes}</p> : null}</div>{(canEdit || request.created_by === currentUserId) ? <button onClick={() => handleDeleteRequest(request.id)} disabled={deletingRequestId === request.id} className="rounded-xl border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.12] disabled:cursor-not-allowed disabled:opacity-60">{deletingRequestId === request.id ? 'Deleting...' : 'Delete'}</button> : null}</div>{canEdit ? <div className="mt-3 space-y-3 border-t border-white/5 pt-3"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Status</span><select value={requestStatusDrafts[request.id] || request.status} onChange={(event) => setRequestStatusDrafts((prev) => ({ ...prev, [request.id]: event.target.value as PathologyGuidelineRequestStatus }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35"><option value="pending">Pending</option><option value="reviewed">Reviewed</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select></label></div><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Review note</span><textarea value={requestNotesDrafts[request.id] || ''} onChange={(event) => setRequestNotesDrafts((prev) => ({ ...prev, [request.id]: event.target.value }))} rows={3} placeholder="Optional note" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><button onClick={() => handleUpdateRequest(request.id)} disabled={updatingRequestId === request.id} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">{updatingRequestId === request.id ? 'Saving...' : 'Save'}</button></div> : null}</div>) : <EmptyState compact icon="forum" title="No requests yet" description={canEdit ? 'Requests will appear here.' : 'Your requests will appear here.'} />}</div></div> : null}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
              {debouncedQuery.trim() ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Search results</h2>
                      <p className="mt-1 text-xs text-slate-400">Direct guideline hits for "{debouncedQuery.trim()}".</p>
                    </div>
                    <button type="button" onClick={() => setQuery('')} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]">Clear</button>
                  </div>
                  {isLoadingResults ? <LoadingState compact title="Searching RadioGraphics..." /> : displayResults.length ? <div className="space-y-2">{displayResults.map((item) => <GuidelineResultCard key={item.guideline_id} item={item} active={item.guideline_id === selectedItem?.guideline_id} onClick={() => handleSelectItem(item)} topicLabel={getTrainingHubDefinition(getTrainingHubIdForItem(item)).topic} />)}</div> : <EmptyState compact icon="rule" title="No pathology matched that search term" description="Try a broader pathology name, synonym, or keyword." />}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Topic hubs</h2>
                      <p className="mt-1 text-xs text-slate-400">Quick links for core training areas.</p>
                    </div>
                    {activeTopic ? <button type="button" onClick={() => { setActiveTopic(null); setActiveBrowseTag(null); }} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]">All topics</button> : null}
                  </div>
                  {isLoadingLibrary ? <LoadingState compact title="Loading RadioGraphics library..." /> : <TopicHubGrid hubs={topicHubs} activeTopic={activeTopic} onSelectTopic={handleSelectTopic} />}
                  {activeTopic ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{activeTopic}</h3>
                        <p className="mt-1 text-xs text-slate-400">{activeHub?.activeDescription || 'Curated training guides.'}</p>
                      </div>
                      {hubTags.length ? <div className="flex flex-wrap gap-2">{hubTags.map((tag) => <button key={tag} type="button" onClick={() => setActiveBrowseTag((prev) => (prev === tag ? null : tag))} className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${activeBrowseTag === tag ? 'border-cyan-400/24 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>{tag}</button>)}</div> : null}
                      <div className="space-y-5">
                        {browseSections.map((section) => renderBrowseSection({
                          ...section,
                          description: section.items.length <= 2 ? '' : section.description,
                        }))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {featuredGuidelines.length ? renderBrowseSection({ id: 'featured', title: 'Featured', description: 'Fast-start references for common resident lookups.', items: featuredGuidelines.slice(0, 4) }) : null}
                      {recentGuidelines.length ? renderBrowseSection({ id: 'recent', title: 'Recently updated', description: 'Latest updates.', items: recentGuidelines }) : null}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
              {isLoadingDetail ? <LoadingState compact title="Loading checklist detail..." /> : detail ? <div className="space-y-3"><div className="rounded-3xl border border-white/[0.04] bg-white/[0.02] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">{detail.primary_topic || 'General reporting pearls'}</span><span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">{detail.content_type}</span>{detail.effective_date ? <span className="text-xs text-slate-500">{formatDateLabel(detail.effective_date)}</span> : null}</div><h2 className="mt-3 text-2xl font-black tracking-tight text-white">{detail.pathology_name}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{normalizeImportedParagraph(detail.tldr_md || 'Checklist-first reference page for this topic.')}</p>{detail.clinical_tags.length || detail.problem_terms.length ? <div className="mt-4 flex flex-wrap gap-2">{[...detail.clinical_tags, ...detail.problem_terms].slice(0, 8).map((tag, index) => <span key={`${tag}-${index}`} className="rounded-full border border-white/[0.04] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">{tag}</span>)}</div> : null}</div>{canEdit ? <button onClick={handleEditDraft} disabled={isPreparingDraft} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isPreparingDraft ? 'Preparing...' : 'Edit checklist draft'}</button> : null}</div></div>{detailSections.length ? <div ref={sectionNavRef} className="sticky top-0 z-10 rounded-2xl border border-white/[0.04] bg-[#0d1623]/88 p-2 backdrop-blur"><div className="flex items-center gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Jump to section</span><select value={activeSectionId || detailSections[0]?.id || ''} onChange={(event) => scrollToSection(event.target.value)} className="w-full appearance-none rounded-lg border border-white/[0.05] bg-slate-950/90 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/20" aria-label="Jump to section" style={{ colorScheme: 'dark' }}>{detailSections.map((section) => <option key={section.id} value={section.id} className="bg-slate-950 text-white">{section.label}</option>)}</select></label><button onClick={scrollToTopOfDetail} className="shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06]">Top</button></div></div> : null}<div className="space-y-3">{detail.tldr_md ? <section ref={bindSectionContainerRef('section-tldr')} className="rounded-2xl border border-emerald-400/12 bg-emerald-500/[0.04] p-4"><div id="section-tldr" ref={bindSectionRef('section-tldr')} className="mb-2 flex items-center gap-2"><span className="material-icons text-[18px] text-emerald-300">bolt</span><h3 className="text-sm font-semibold text-white">Quick Summary</h3></div><p className="text-sm leading-6 text-emerald-50/90">{normalizeImportedParagraph(detail.tldr_md)}</p></section> : null}<ChecklistSection sections={checklistSections} bindSectionRef={bindSectionRef} bindSectionContainerRef={bindSectionContainerRef} />{detail.reporting_takeaways.length ? <section ref={bindSectionContainerRef('section-reporting-takeaways')} className="space-y-2"><div id="section-reporting-takeaways" ref={bindSectionRef('section-reporting-takeaways')} className="flex scroll-mt-24 items-center gap-2"><span className="material-icons text-[18px] text-cyan-300">assignment</span><h3 className="text-sm font-semibold text-white">Reporting takeaways</h3></div>{renderQuickList(detail.reporting_takeaways, 'cyan')}</section> : null}{detail.reporting_red_flags.length ? <section ref={bindSectionContainerRef('section-red-flags')} className="space-y-2"><div id="section-red-flags" ref={bindSectionRef('section-red-flags')} className="flex scroll-mt-24 items-center gap-2"><span className="material-icons text-[18px] text-amber-300">warning</span><h3 className="text-sm font-semibold text-white">Red flags</h3></div>{renderQuickList(detail.reporting_red_flags, 'amber')}</section> : null}{detail.suggested_report_phrases.length ? <section ref={bindSectionContainerRef('section-report-phrases')} className="space-y-2"><div id="section-report-phrases" ref={bindSectionRef('section-report-phrases')} className="flex scroll-mt-24 items-center gap-2"><span className="material-icons text-[18px] text-emerald-300">edit_note</span><h3 className="text-sm font-semibold text-white">Report phrases</h3></div>{renderQuickList(detail.suggested_report_phrases, 'emerald')}</section> : null}<section ref={bindSectionContainerRef('section-rich-summary')} className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4"><div id="section-rich-summary" ref={bindSectionRef('section-rich-summary')} className="mb-2 flex scroll-mt-24 items-center gap-2"><span className="material-icons text-[18px] text-cyan-300">article</span><h3 className="text-sm font-semibold text-white">Rich summary</h3></div><div className="space-y-2">{renderSummaryBlocks(detail.rich_summary_md)}</div></section><div ref={bindSectionContainerRef('section-reference-source')}><div id="section-reference-source" ref={bindSectionRef('section-reference-source')} className="scroll-mt-24" /><ReferenceSourceSection detail={detail} /></div><div ref={bindSectionContainerRef('section-related-guidelines')}><div id="section-related-guidelines" ref={bindSectionRef('section-related-guidelines')} className="scroll-mt-24" /><RelatedGuidelinesSection items={relatedGuidelines} onSelectItem={handleSelectItem} /></div>{detail.parse_notes ? <section ref={bindSectionContainerRef('section-notes')} className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4"><div id="section-notes" ref={bindSectionRef('section-notes')} className="mb-2 flex scroll-mt-24 items-center gap-2"><span className="material-icons text-[18px] text-amber-300">info</span><h3 className="text-sm font-semibold text-amber-100">Notes / caveats</h3></div><p className="text-sm leading-6 text-amber-50/85">{detail.parse_notes}</p></section> : null}</div></div> : <EmptyState compact icon="fact_check" title={activeTopic ? `Choose a ${activeTopic} guide` : 'Choose a pathology'} description={activeTopic ? 'Select a curated result to view the latest published checklist and summary.' : 'Choose a topic or guide to begin.'} />}
            </section>
            {(canEdit || isRoleLoading) ? <section className="rounded-3xl border border-fuchsia-500/15 bg-fuchsia-950/10 p-4 backdrop-blur-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold uppercase tracking-[0.22em] text-fuchsia-200">Editor controls</h2><p className="mt-1 text-xs text-slate-400">Manage topic metadata, import JSON drafts, and publish versions.</p></div>{!isRoleLoading && canEdit ? <div className="flex gap-2"><button onClick={() => setIsAdminPanelOpen((value) => !value)} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15">{isAdminPanelOpen ? 'Hide' : 'Manage'}</button><button onClick={resetAdminForm} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10">New source</button></div> : null}</div>{isRoleLoading ? <LoadingState compact title="Checking permissions..." /> : canEdit && isAdminPanelOpen ? <div className="mt-4 space-y-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Pathology name</span><input value={form.pathology_name} onChange={(event) => setForm((prev) => ({ ...prev, pathology_name: event.target.value, slug: prev.slug || makeSlug(event.target.value) }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Slug</span><input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Primary topic</span><select value={form.primary_topic} onChange={(event) => setForm((prev) => ({ ...prev, primary_topic: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35"><option value="">Select topic</option>{TOPIC_OPTIONS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Specialty</span><input value={form.specialty} onChange={(event) => setForm((prev) => ({ ...prev, specialty: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Clinical tags</span><input value={form.clinical_tags} onChange={(event) => setForm((prev) => ({ ...prev, clinical_tags: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Anatomy terms</span><input value={form.anatomy_terms} onChange={(event) => setForm((prev) => ({ ...prev, anatomy_terms: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Problem terms</span><input value={form.problem_terms} onChange={(event) => setForm((prev) => ({ ...prev, problem_terms: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Related slugs</span><input value={form.related_guideline_slugs} onChange={(event) => setForm((prev) => ({ ...prev, related_guideline_slugs: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Synonyms</span><input value={form.synonyms} onChange={(event) => setForm((prev) => ({ ...prev, synonyms: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Keywords</span><input value={form.keywords} onChange={(event) => setForm((prev) => ({ ...prev, keywords: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Content type</span><select value={form.content_type} onChange={(event) => setForm((prev) => ({ ...prev, content_type: event.target.value as PathologyGuidelineContentType }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35"><option value="checklist">Checklist</option><option value="guideline">Guideline</option><option value="review">Review</option></select></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Search priority</span><input type="number" min="0" value={form.search_priority} onChange={(event) => setForm((prev) => ({ ...prev, search_priority: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Source title</span><input value={form.source_title} onChange={(event) => setForm((prev) => ({ ...prev, source_title: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Issuing body</span><input value={form.issuing_body} onChange={(event) => setForm((prev) => ({ ...prev, issuing_body: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Source kind</span><select value={form.source_kind} onChange={(event) => setForm((prev) => ({ ...prev, source_kind: event.target.value as PathologyGuidelineSourceKind }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35"><option value="pdf">PDF</option><option value="external">External</option><option value="google_drive">Google Drive</option></select></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Source URL</span><input value={form.source_url} onChange={(event) => setForm((prev) => ({ ...prev, source_url: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label></div>{form.source_kind === 'google_drive' ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Google Drive URL</span><input value={form.google_drive_url} onChange={(event) => setForm((prev) => ({ ...prev, google_drive_url: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Google Drive file id</span><input value={form.google_drive_file_id} onChange={(event) => setForm((prev) => ({ ...prev, google_drive_file_id: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label></div> : null}<div className="flex flex-wrap gap-4"><label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Source is active</label><label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_featured} onChange={(event) => setForm((prev) => ({ ...prev, is_featured: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Featured on landing</label></div><div className="flex flex-wrap gap-2"><button onClick={handleSaveSource} disabled={isSavingSource} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSavingSource ? 'Saving...' : 'Save source'}</button>{form.source_kind === 'google_drive' ? <button onClick={handleSync} disabled={isSyncing || !canSyncFromDrive} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSyncing ? 'Syncing...' : 'Sync from Drive'}</button> : null}</div>{isEditMode ? <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">Edit checklist draft</h3><button onClick={() => setIsEditMode(false)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Close</button></div>{!!draftFormErrors.length ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-3">{draftFormErrors.map((error) => <p key={error} className="text-xs text-rose-100/90">{error}</p>)}</div> : null}<label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Quick Summary</span><textarea value={draftForm.tldr_md || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, tldr_md: event.target.value }))} rows={3} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Rich summary</span><textarea value={draftForm.rich_summary_md || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, rich_summary_md: event.target.value }))} rows={5} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label><div className="space-y-2"><div className="flex items-center justify-between gap-2"><h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Checklist items</h4><button onClick={addChecklistItem} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">Add item</button></div>{(draftForm.checklist_items || []).map((item, index) => <div key={`${item.id}-${index}`} className="space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3"><input value={item.label} onChange={(event) => updateChecklistItem(index, { label: event.target.value })} placeholder="Checklist label" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input value={item.id} onChange={(event) => updateChecklistItem(index, { id: event.target.value })} placeholder="item-id" className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /><input value={item.section || ''} onChange={(event) => updateChecklistItem(index, { section: event.target.value || null })} placeholder="Section" className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /><button onClick={() => deleteChecklistItem(index)} className="rounded-xl border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.12]">Remove</button></div></div>)}</div><button onClick={handleSaveDraft} disabled={isSavingDraft} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSavingDraft ? 'Saving...' : 'Save draft'}</button></div> : null}<div className="space-y-3 rounded-2xl border border-cyan-500/15 bg-cyan-950/10 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Import checklist JSON</h3><p className="mt-1 text-xs text-slate-400">Create draft content from structured PDF output.</p></div><div className="flex gap-2"><button onClick={() => setImportMode('paste')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === 'paste' ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>Paste</button><button onClick={() => setImportMode('upload')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === 'upload' ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>Upload</button></div></div>{importMode === 'upload' ? <input type="file" accept=".json,application/json" onChange={handleImportFile} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-cyan-100" /> : null}<textarea value={rawImportJson} onChange={(event) => { setRawImportJson(event.target.value); setValidatedImportPayload(null); setImportValidationErrors([]); setImportWarnings([]); }} rows={8} placeholder='{"pathology_name":"Appendicitis","rich_summary_md":"...","checklist_items":[...]}' className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400/35" />{!!importValidationErrors.length ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3">{importValidationErrors.map((error) => <p key={error} className="text-xs text-rose-100/90">{error}</p>)}</div> : null}{!!importWarnings.length ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">{importWarnings.map((warning) => <p key={warning} className="text-xs text-amber-100/90">{warning}</p>)}</div> : null}<div className="flex flex-wrap gap-2"><button onClick={handleValidateImportJson} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">{importMode === 'upload' ? 'Recheck JSON' : 'Validate JSON'}</button><button onClick={handleImportJson} disabled={isImportingJson || !validatedImportPayload} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isImportingJson ? 'Saving...' : 'Save Draft'}</button></div></div><div className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Version history</h3>{versions.length ? versions.map((version) => <div key={version.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${version.sync_status === 'published' ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : version.sync_status === 'failed' ? 'border border-rose-400/20 bg-rose-500/10 text-rose-100' : 'border border-amber-400/20 bg-amber-500/10 text-amber-100'}`}>{version.sync_status}</span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getOriginLabel(version.origin)}</span><span className="text-xs text-slate-500">{formatDateLabel(version.synced_at)}</span></div><p className="mt-2 text-sm font-semibold text-white">{version.source_title || 'Untitled version'}</p></div>{version.sync_status !== 'published' ? <button onClick={() => handlePublish(version.id)} disabled={publishingVersionId === version.id} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">{publishingVersionId === version.id ? 'Publishing...' : 'Publish'}</button> : null}</div>{version.parse_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{version.parse_notes}</p> : null}</div>) : <EmptyState compact icon="cloud_sync" title="No synced versions yet" description="After you import, edit, or sync a guideline, versions will appear here." />}</div></div> : <p className="mt-3 text-sm text-slate-500">Privileged editor tools are hidden for your account.</p>}</section> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PathologyChecklistScreen;
