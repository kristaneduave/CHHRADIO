import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import TopRightCreateAction from './TopRightCreateAction';
import { LayoutScrollContext } from './Layout';
import { supabase } from '../services/supabase';
import {
  createPathologyGuidelineDraftFromCurrent,
  createPathologyGuidelineSource,
  getCurrentPathologyGuidelines,
  deletePathologyGuidelineDraft,
  getFeaturedPathologyGuidelines,
  getGuidelineDraftVersions,
  getLatestEditableDraft,
  listPathologyGuidelineDrafts,
  getPathologyGuidelineDetail,
  getPathologyGuidelineSource,
  getPathologyGuidelineSourceBySlug,
  getRelatedPathologyGuidelines,
  importPathologyGuidelineVersion,
  publishPathologyGuidelineVersion,
  searchPathologyGuidelines,
  syncPathologyGuideline,
  updatePathologyGuidelineDraft,
  updatePathologyGuidelineSource,
  type PathologyGuidelineDraftListItem,
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
  PathologyGuidelineDetail,
  PathologyGuidelineImportPayload,
  PathologyGuidelineListItem,
  PathologyGuidelineRequest,
  PathologyGuidelineRequestStatus,
  PathologyGuidelineRequestType,
  PathologyGuidelineSource,
  PathologyGuidelineSourceKind,
  PathologyGuidelineVersion,
  PathologyGuidelineContentType,
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
  canonicalKey: string;
  label: string;
  icon: string;
  description: string;
  accent: 'cyan' | 'amber' | 'emerald';
  items: PathologyChecklistItem[];
}

interface CanonicalGuideSectionMeta {
  key: string;
  label: string;
  icon: string;
  description: string;
  accent: 'cyan' | 'amber' | 'emerald';
  aliases: string[];
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
  colorClass?: {
    base: string;
    text: string;
    activeBg: string;
    activeBorder: string;
    hoverBg: string;
    iconActive: string;
    iconInactive: string;
  };
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

interface RadioGraphicsDetailPanelProps {
  activeSectionId: string | null;
  articleControls?: React.ReactNode;
  activeTopic: string | null;
  bindSectionContainerRef: (sectionId: string) => (node: HTMLElement | null) => void;
  bindSectionRef: (sectionId: string) => (node: HTMLElement | null) => void;
  canEdit: boolean;
  checklistSections: GroupedChecklistSection[];
  detail: PathologyGuidelineDetail | null;
  detailSections: ChecklistDetailSection[];
  handleEditDraft: () => void;
  handleSelectItem: (item: PathologyGuidelineListItem) => void;
  isLoadingDetail: boolean;
  isPreparingDraft: boolean;
  relatedGuidelines: PathologyGuidelineListItem[];
}

interface RadioGraphicsSearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  isRequestDrawerOpen: boolean;
  onToggleRequestDrawer: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

interface RadioGraphicsQuickChipsProps {
  query: string;
  visible: boolean;
  chips: string[];
  onSelectChip: (chip: string) => void;
}

interface RadioGraphicsRequestDrawerProps {
  open: boolean;
  requestForm: RequestFormState;
  setRequestForm: React.Dispatch<React.SetStateAction<RequestFormState>>;
  onSubmit: () => void;
  isSubmitting: boolean;
}


const QUICK_SEARCH_CHIPS = [
  'Mass',
  'Nodule',
  'Incidental findings',
  'Follow-up',
  'Emergency',
  'Pediatrics',
];

const DESKTOP_DETAIL_MEDIA_QUERY = '(min-width: 1400px)';

const getIsDesktopDetail = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(DESKTOP_DETAIL_MEDIA_QUERY).matches;

const CURATED_TRAINING_HUBS = [
  {
    id: 'chest',
    topic: 'Chest',
    icon: 'pulmonology',
    description: 'Thoracic and cardiothoracic imaging',
    activeDescription: 'Thoracic and cardiothoracic guides',
    matchers: ['thoracic', 'chest', 'cardiac', 'lung', 'pulmonary', 'heart'],
    colorClass: {
      base: 'cyan',
      text: 'text-cyan-400',
      activeBg: 'bg-cyan-950/[0.16]',
      activeBorder: 'border-cyan-400/18',
      hoverBg: 'hover:bg-cyan-500/[0.04]',
      iconActive: 'text-cyan-200',
      iconInactive: 'text-cyan-400/60',
    }
  },
  {
    id: 'abdomen',
    topic: 'Abdomen',
    icon: 'gastroenterology',
    description: 'GI, liver, pancreas, and abdominal imaging',
    activeDescription: 'Abdominal and GI guides',
    matchers: ['abdominal', 'gastrointestinal', 'hepatobiliary', 'pancreas', 'liver', 'bowel', 'gi', 'abdomen'],
    colorClass: {
      base: 'emerald',
      text: 'text-emerald-400',
      activeBg: 'bg-emerald-950/[0.16]',
      activeBorder: 'border-emerald-400/18',
      hoverBg: 'hover:bg-emerald-500/[0.04]',
      iconActive: 'text-emerald-200',
      iconInactive: 'text-emerald-400/60',
    }
  },
  {
    id: 'gu-obgyn',
    topic: 'GU / OB-Gyn',
    icon: 'pregnant_woman',
    description: 'Genitourinary and OB-Gyn imaging',
    activeDescription: 'GU and OB-Gyn guides',
    matchers: ['genitourinary', 'renal', 'kidney', 'urinary', 'bladder', 'obstetric', 'gynecologic', 'ob', 'gyn', 'uterus', 'ovary', 'adnexa', 'pelvic'],
    colorClass: {
      base: 'pink',
      text: 'text-pink-400',
      activeBg: 'bg-pink-950/[0.16]',
      activeBorder: 'border-pink-400/18',
      hoverBg: 'hover:bg-pink-500/[0.04]',
      iconActive: 'text-pink-200',
      iconInactive: 'text-pink-400/60',
    }
  },
  {
    id: 'neuro-head-neck',
    topic: 'Neuro / Head & Neck',
    icon: 'neurology',
    description: 'Brain, spine, and head-neck imaging',
    activeDescription: 'Neuro and head-neck guides',
    matchers: ['neuro', 'neuroradiology', 'head and neck', 'brain', 'spine', 'sinus', 'orbit', 'neck', 'head'],
    colorClass: {
      base: 'purple',
      text: 'text-purple-400',
      activeBg: 'bg-purple-950/[0.16]',
      activeBorder: 'border-purple-400/18',
      hoverBg: 'hover:bg-purple-500/[0.04]',
      iconActive: 'text-purple-200',
      iconInactive: 'text-purple-400/60',
    }
  },
  {
    id: 'musculoskeletal',
    topic: 'Musculoskeletal',
    icon: 'orthopedics',
    description: 'Bone, joint, and soft-tissue imaging',
    activeDescription: 'MSK guides',
    matchers: ['musculoskeletal', 'msk', 'bone', 'joint', 'tendon', 'ligament', 'soft tissue', 'orthopedic'],
    colorClass: {
      base: 'orange',
      text: 'text-orange-400',
      activeBg: 'bg-orange-950/[0.16]',
      activeBorder: 'border-orange-400/18',
      hoverBg: 'hover:bg-orange-500/[0.04]',
      iconActive: 'text-orange-200',
      iconInactive: 'text-orange-400/60',
    }
  },
  {
    id: 'breast',
    topic: 'Breast',
    icon: 'monitor_heart',
    description: 'Screening, diagnostic, and breast imaging',
    activeDescription: 'Breast imaging guides',
    matchers: ['breast'],
    colorClass: {
      base: 'fuchsia',
      text: 'text-fuchsia-400',
      activeBg: 'bg-fuchsia-950/[0.16]',
      activeBorder: 'border-fuchsia-400/18',
      hoverBg: 'hover:bg-fuchsia-500/[0.04]',
      iconActive: 'text-fuchsia-200',
      iconInactive: 'text-fuchsia-400/60',
    }
  },
  {
    id: 'pediatrics',
    topic: 'Pediatrics',
    icon: 'pediatrics',
    description: 'Pediatric imaging across systems',
    activeDescription: 'Pediatric imaging guides',
    matchers: ['pediatrics', 'pediatric', 'child', 'neonatal'],
    colorClass: {
      base: 'amber',
      text: 'text-amber-400',
      activeBg: 'bg-amber-950/[0.16]',
      activeBorder: 'border-amber-400/18',
      hoverBg: 'hover:bg-amber-500/[0.04]',
      iconActive: 'text-amber-200',
      iconInactive: 'text-amber-400/60',
    }
  },
  {
    id: 'procedures-ir',
    topic: 'Procedures / IR',
    icon: 'vaccines',
    description: 'Interventional and procedural imaging',
    activeDescription: 'Interventional and procedural guides',
    matchers: ['interventional', 'vascular', 'procedure', 'intervention', 'biopsy', 'drainage', 'embolization', 'catheter', 'angiography', 'ultrasound'],
    colorClass: {
      base: 'rose',
      text: 'text-rose-400',
      activeBg: 'bg-rose-950/[0.16]',
      activeBorder: 'border-rose-400/18',
      hoverBg: 'hover:bg-rose-500/[0.04]',
      iconActive: 'text-rose-200',
      iconInactive: 'text-rose-400/60',
    }
  },
  {
    id: 'general-other',
    topic: 'General & Other',
    icon: 'medical_information',
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
    colorClass: {
      base: 'slate',
      text: 'text-slate-400',
      activeBg: 'bg-slate-800/[0.16]',
      activeBorder: 'border-slate-400/18',
      hoverBg: 'hover:bg-slate-500/[0.04]',
      iconActive: 'text-slate-200',
      iconInactive: 'text-slate-400/60',
    }
  },
] as const;

const GENERAL_OTHER_HUB_ID = 'general-other';

const CANONICAL_GUIDE_SECTIONS: CanonicalGuideSectionMeta[] = [
  {
    key: 'clinical-context',
    label: 'Clinical context',
    icon: 'stethoscope',
    description: 'Risk factors and patient context that change interpretation.',
    accent: 'cyan',
    aliases: ['clinical context', 'clinical setting', 'context', 'patient context', 'risk stratification', 'clinical scenario'],
  },
  {
    key: 'what-to-look-for',
    label: 'What to look for',
    icon: 'search',
    description: 'Key imaging patterns and features to identify first.',
    accent: 'cyan',
    aliases: ['what to look for', 'look for', 'findings', 'imaging findings', 'key imaging features', 'pattern recognition', 'what to identify'],
  },
  {
    key: 'what-to-report',
    label: 'What to report',
    icon: 'assignment',
    description: 'Report elements and management-facing details to include.',
    accent: 'cyan',
    aliases: ['what to report', 'reporting', 'reporting takeaways', 'reporting pearls', 'report', 'impression', 'management', 'recommendations'],
  },
  {
    key: 'red-flags',
    label: 'Red flags',
    icon: 'warning',
    description: 'Features that should escalate urgency, workup, or follow-up.',
    accent: 'amber',
    aliases: ['red flags', 'warning signs', 'critical features', 'high risk features', 'must not miss', 'when to escalate'],
  },
  {
    key: 'differential-pitfalls',
    label: 'Differential pitfalls',
    icon: 'rule',
    description: 'Common mimics, traps, and overcall risks.',
    accent: 'amber',
    aliases: ['differential pitfalls', 'pitfalls', 'differential', 'mimics', 'pearls and pitfalls'],
  },
  {
    key: 'takeaways',
    label: 'Takeaways',
    icon: 'checklist',
    description: 'High-yield bottom lines for rapid recall.',
    accent: 'cyan',
    aliases: ['takeaways', 'summary', 'bottom line', 'key points', 'pearls'],
  },
  {
    key: 'phrases',
    label: 'Phrases',
    icon: 'edit_note',
    description: 'Copy-ready report wording and recommendation language.',
    accent: 'emerald',
    aliases: ['phrases', 'report phrases', 'sample report', 'template language', 'dictation phrases'],
  },
  {
    key: 'notes',
    label: 'Notes',
    icon: 'info',
    description: 'Nuance, caveats, and exceptions from the source article.',
    accent: 'amber',
    aliases: ['notes', 'caveats', 'limitations', 'nuances'],
  },
  {
    key: 'checklist',
    label: 'Checklist',
    icon: 'fact_check',
    description: 'Structured article points not yet mapped to a canonical bucket.',
    accent: 'cyan',
    aliases: ['checklist'],
  },
];

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
      colorClass: (hub as any).colorClass,
    };
  });

const stripInlineMarkdown = (value: string) =>
  value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1');

const normalizeImportedParagraph = (value: string) =>
  stripInlineMarkdown(value)
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

const normalizeSectionHeading = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getCanonicalGuideSectionMeta = (value?: string | null): CanonicalGuideSectionMeta => {
  const normalizedValue = normalizeSectionHeading(value || '');
  if (!normalizedValue) return CANONICAL_GUIDE_SECTIONS[CANONICAL_GUIDE_SECTIONS.length - 1];
  return CANONICAL_GUIDE_SECTIONS.find((section) =>
    [section.label, ...section.aliases].some((alias) => normalizedValue.includes(normalizeSectionHeading(alias))),
  ) || CANONICAL_GUIDE_SECTIONS[CANONICAL_GUIDE_SECTIONS.length - 1];
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
  const grouped = items.reduce((acc, item) => {
    const sectionMeta = getCanonicalGuideSectionMeta(item.section);
    if (!acc[sectionMeta.key]) {
      acc[sectionMeta.key] = { meta: sectionMeta, items: [] };
    }
    acc[sectionMeta.key].items.push(item);
    return acc;
  }, {} as Record<string, { meta: CanonicalGuideSectionMeta; items: PathologyChecklistItem[] }>);

  return Object.values(grouped).map(({ meta, items: sectionItems }) => {
    const dedupedItems = Array.from(new Map(
      sectionItems.map((item) => [
        `${normalizeImportedParagraph(item.label)}::${normalizeImportedParagraph(item.notes || '')}`,
        item,
      ]),
    ).values());

    return {
      id: makeChecklistSectionId(meta.label),
      canonicalKey: meta.key,
      label: meta.label,
      icon: meta.icon,
      description: meta.description,
      accent: meta.accent,
      items: dedupedItems,
    };
  });
};

const createChecklistSectionFromStrings = (label: string, items: string[]): GroupedChecklistSection | null => {
  const cleanedItems = normalizeStringListForSave(items);
  if (!cleanedItems.length) return null;
  const meta = getCanonicalGuideSectionMeta(label);
  return {
    id: makeChecklistSectionId(meta.label),
    canonicalKey: meta.key,
    label: meta.label,
    icon: meta.icon,
    description: meta.description,
    accent: meta.accent,
    items: cleanedItems.map((item, index) => ({
      id: `${meta.key}-${index + 1}`,
      label: item,
      section: meta.label,
      order: index + 1,
      notes: null,
    })),
  };
};

const mergeChecklistSections = (sections: Array<GroupedChecklistSection | null>): GroupedChecklistSection[] => {
  const merged = new Map<string, GroupedChecklistSection>();

  sections.filter(Boolean).forEach((section) => {
    const currentSection = section as GroupedChecklistSection;
    const existing = merged.get(currentSection.canonicalKey);
    if (!existing) {
      merged.set(currentSection.canonicalKey, {
        ...currentSection,
        items: [...currentSection.items],
      });
      return;
    }

    const dedupedItems = Array.from(new Map(
      [...existing.items, ...currentSection.items].map((item, index) => [
        `${normalizeImportedParagraph(item.label)}::${normalizeImportedParagraph(item.notes || '')}`,
        { ...item, order: index + 1 },
      ]),
    ).values()).map((item, index) => ({ ...item, order: index + 1 }));

    merged.set(currentSection.canonicalKey, {
      ...existing,
      items: dedupedItems,
    });
  });

  const sectionOrder = new Map(CANONICAL_GUIDE_SECTIONS.map((section, index) => [section.key, index]));
  return Array.from(merged.values()).sort((left, right) => (sectionOrder.get(left.canonicalKey) ?? Number.MAX_SAFE_INTEGER) - (sectionOrder.get(right.canonicalKey) ?? Number.MAX_SAFE_INTEGER));
};

const inferPrimaryTopic = (values: {
  specialty?: string | null;
  pathologyName?: string | null;
  sourceTitle?: string | null;
  anatomyTerms?: string[];
  problemTerms?: string[];
  clinicalTags?: string[];
  keywords?: string[];
}) => {
  const combined = normalizeImportedParagraph([
    values.specialty || '',
    values.pathologyName || '',
    values.sourceTitle || '',
    ...(values.anatomyTerms || []),
    ...(values.problemTerms || []),
    ...(values.clinicalTags || []),
    ...(values.keywords || []),
  ].join(' ')).toLowerCase();

  if (!combined) return '';
  if (/(thoracic|chest|lung|pulmonary|cardiac|heart|mediast)/.test(combined)) return 'Thoracic';
  if (/(abdomen|abdomin|liver|hepatic|pancrea|biliary|gallbladder|bowel|mesenter|spleen|gastro)/.test(combined)) return 'Abdominal';
  if (/(renal|kidney|urinary|bladder|prostate|testic|ovar|uter|pelvi|gyne|obstet)/.test(combined)) return 'Genitourinary';
  if (/(brain|spine|neuro|head|neck|sinus|orbit|skull)/.test(combined)) return 'Neuro / Head and Neck';
  if (/(bone|joint|musculoskeletal|msk|fracture|tendon|ligament|soft tissue)/.test(combined)) return 'Musculoskeletal';
  if (/(breast|mammogra)/.test(combined)) return 'Breast';
  if (/(pediatric|paediatric|child|children|neonat|infant)/.test(combined)) return 'Pediatrics';
  if (/(procedure|intervention|biopsy|drainage|embolization|angiography|catheter|ablation|ir\b)/.test(combined)) return 'Procedures / Interventions';
  return 'General reporting pearls';
};

const createCanonicalChecklistItemsForImport = (items: PathologyChecklistItem[]) =>
  normalizeChecklistItemsForSave(items).map((item) => {
    const meta = getCanonicalGuideSectionMeta(item.section);
    return {
      ...item,
      section: meta.label,
    };
  });

const collectDerivedStructuredContent = (items: PathologyChecklistItem[]) => {
  const grouped = items.reduce((acc, item) => {
    const meta = getCanonicalGuideSectionMeta(item.section);
    const content = normalizeImportedParagraph([item.label, item.notes || ''].filter(Boolean).join('. '));
    if (!content) return acc;
    if (!acc[meta.key]) acc[meta.key] = [];
    acc[meta.key].push(content);
    return acc;
  }, {} as Record<string, string[]>);

  return {
    takeaways: normalizeStringListForSave(grouped.takeaways || []),
    redFlags: normalizeStringListForSave(grouped['red-flags'] || []),
    phrases: normalizeStringListForSave(grouped.phrases || []),
  };
};

const getParsedStringArrayOrFallback = (value: unknown, fallback: string[]) => {
  const parsed = Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
  return normalizeStringListForSave(parsed.length ? parsed : fallback);
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
  primary_topic: current.primary_topic || inferPrimaryTopic({
    specialty: payload.specialty || current.specialty,
    pathologyName: payload.pathology_name || current.pathology_name,
    sourceTitle: payload.source_title || current.source_title,
    keywords: payload.keywords || normalizeListInput(current.keywords),
  }),
  source_url: current.source_url,
  google_drive_url: '',
  google_drive_file_id: '',
});

const validateImportPayload = (raw: string): { payload: PathologyGuidelineImportPayload | null; errors: string[] } => {
  try {
    const parsed = JSON.parse(raw);
    const errors: string[] = [];
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { payload: null, errors: ['JSON must be an object.'] };
    const checklistItems = Array.isArray(parsed.checklist_items) ? createCanonicalChecklistItemsForImport(parsed.checklist_items as PathologyChecklistItem[]) : [];
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
    const derivedStructuredContent = collectDerivedStructuredContent(checklistItems);
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
        reporting_takeaways: getParsedStringArrayOrFallback(parsed.reporting_takeaways, derivedStructuredContent.takeaways),
        reporting_red_flags: getParsedStringArrayOrFallback(parsed.reporting_red_flags, derivedStructuredContent.redFlags),
        suggested_report_phrases: getParsedStringArrayOrFallback(parsed.suggested_report_phrases, derivedStructuredContent.phrases),
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
    <div className="w-full">
      <div className="grid grid-cols-3 auto-rows-auto gap-2">
        {hubs.map((hub) => {
          const active = hub.topic === activeTopic;
          const c = hub.colorClass || {
            base: 'cyan',
            text: 'text-cyan-400',
            activeBg: 'bg-cyan-950/[0.16]',
            activeBorder: 'border-cyan-400/18',
            hoverBg: 'hover:bg-cyan-500/[0.04]',
            iconActive: 'text-cyan-200',
            iconInactive: 'text-cyan-400/60',
          };
          return (
            <button
              key={hub.id}
              type="button"
              onClick={() => onSelectTopic(hub.topic === activeTopic ? '' : hub.topic)}
              className={`w-full rounded-2xl border px-2 sm:px-4 py-3 sm:py-5 text-left transition relative overflow-hidden group ${active ? `${c.activeBorder} ${c.activeBg}` : `border-white/[0.05] bg-white/[0.02] ${c.hoverBg}`}`}
              aria-label={`${hub.topic}, ${hub.count} ${hub.count === 1 ? 'guide' : 'guides'}`}
            >
              {/* subtle background glow on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br from-${c.base}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

              {hub.count > 0 && (
                <span className={`absolute top-2 right-2 text-[9px] sm:text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-transparent border border-white/5 ${active ? c.text : 'text-slate-500'}`}>{hub.count}</span>
              )}
              <div className="relative z-10 flex flex-col items-center justify-center text-center h-full min-h-[70px] sm:min-h-[90px] gap-1 sm:gap-2">
                <span className={`material-icons text-[24px] sm:text-[32px] ${active ? c.iconActive : c.iconInactive} group-hover:${c.iconActive} transition-colors`}>{hub.icon}</span>
                <p className={`text-[10px] sm:text-[13px] font-medium transition-colors leading-tight px-1 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{hub.topic}</p>
              </div>
            </button>
          );
        })}
      </div>
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
        className={`block h-auto min-h-0 w-full shrink-0 rounded-2xl border text-left align-top transition ${variant === 'browse'
          ? `${active ? 'border-cyan-400/18 bg-cyan-950/[0.08]' : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]'} px-3 py-3`
          : `${active ? 'border-cyan-400/22 bg-cyan-950/[0.08] shadow-[0_0_0_1px_rgba(8,145,178,0.05)]' : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.05]'} p-3`
          }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="line-clamp-2 text-sm font-semibold text-white">{item.pathology_name}</p>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${variant === 'browse' ? 'border border-cyan-400/14 bg-cyan-500/[0.06] tracking-[0.12em] text-cyan-100/80' : 'border border-cyan-400/20 bg-cyan-500/10 tracking-[0.18em] text-cyan-100'}`}>{topicLabel || item.primary_topic || 'General'}</span>
          </div>
          {item.tldr_md ? <p className={`mt-2 line-clamp-2 text-xs leading-5 ${variant === 'browse' ? 'text-slate-400' : 'text-slate-300'}`}>{normalizeImportedParagraph(item.tldr_md)}</p> : null}
          {variant === 'search' && matchReason ? <p className="mt-2 text-[11px] font-medium text-cyan-200">{matchReason.label}</p> : null}
        </div>
      </button>
    );
  };

const ReferenceSourceSection: React.FC<{ detail: PathologyGuidelineDetail }> = ({ detail }) => {
  const hasLink = Boolean(detail.source_url || detail.google_drive_url);
  return (
    <section className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-icons text-[18px] text-cyan-300">menu_book</span>
        <h3 className="text-sm font-semibold text-white">Reference source</h3>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <p className="font-medium text-white">{detail.source_title || 'Untitled source'}</p>
        <p>{[detail.issuing_body, detail.version_label, detail.effective_date ? formatDateLabel(detail.effective_date) : null].filter(Boolean).join(' ?') || 'Reference metadata pending'}</p>
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
        <section key={section.id} ref={bindSectionContainerRef(section.id)} className="scroll-mt-24 rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 backdrop-blur-md">
          <div id={section.id} ref={bindSectionRef(section.id)} className="mb-2 flex scroll-mt-24 items-center gap-2">
            <span className={`material-icons text-[18px] ${section.accent === 'amber' ? 'text-amber-300' : section.accent === 'emerald' ? 'text-emerald-300' : 'text-cyan-300'}`}>{section.icon}</span>
            <h3 className="text-sm font-semibold text-white">{section.label}</h3>
          </div>
          <p className="mb-3 text-xs leading-5 text-slate-400">{section.description}</p>
          <div className="space-y-2">
            {section.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border ${section.accent === 'amber' ? 'border-amber-400/35 bg-amber-500/10' : section.accent === 'emerald' ? 'border-emerald-400/35 bg-emerald-500/10' : 'border-cyan-400/40 bg-cyan-500/10'}`}>
                    <span className={`material-icons text-[14px] ${section.accent === 'amber' ? 'text-amber-200' : section.accent === 'emerald' ? 'text-emerald-200' : 'text-cyan-200'}`}>done</span>
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

const RadioGraphicsDetailPanel: React.FC<RadioGraphicsDetailPanelProps> = ({
  activeSectionId,
  articleControls,
  activeTopic,
  bindSectionContainerRef,
  bindSectionRef,
  canEdit,
  checklistSections,
  detail,
  detailSections,
  handleEditDraft,
  handleSelectItem,
  isLoadingDetail,
  isPreparingDraft,
  relatedGuidelines,
}) => {
  const summaryParagraphs = normalizeImportedSummary(detail?.rich_summary_md || '');
  const kicker = normalizeImportedParagraph(detail?.tldr_md || '');
  const heroSummaryParagraphs = summaryParagraphs.length ? summaryParagraphs.slice(0, 2) : kicker ? [kicker] : [];
  const overflowSummaryParagraphs = summaryParagraphs.length > 2 ? summaryParagraphs.slice(2) : [];
  const showBackgroundSection = overflowSummaryParagraphs.length > 0;

  return (
    <section className="glass-card-enhanced rounded-3xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {isLoadingDetail ? (
        <LoadingState compact title="Loading checklist detail..." />
      ) : detail ? (
        <div className="space-y-3">
          <div className="rounded-3xl border border-white/[0.05] bg-white/[0.025] p-5 backdrop-blur-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {heroSummaryParagraphs.length ? (
                  <div className="space-y-3">
                    {heroSummaryParagraphs.map((paragraph, index) => (
                      <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-sm leading-7 text-slate-300">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : null}
                {detail.clinical_tags.length || detail.problem_terms.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[...detail.clinical_tags, ...detail.problem_terms].slice(0, 8).map((tag, index) => (
                      <span key={`${tag}-${index}`} className="rounded-full border border-white/[0.04] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <ChecklistSection
              sections={checklistSections}
              bindSectionRef={bindSectionRef}
              bindSectionContainerRef={bindSectionContainerRef}
            />

            {showBackgroundSection ? (
              <section ref={bindSectionContainerRef('section-rich-summary')} className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 backdrop-blur-md">
                <div id="section-rich-summary" ref={bindSectionRef('section-rich-summary')} className="mb-2 flex scroll-mt-24 items-center gap-2">
                  <span className="material-icons text-[18px] text-cyan-300">article</span>
                  <h3 className="text-sm font-semibold text-white">Background and nuances</h3>
                </div>
                <div className="space-y-2">
                  {overflowSummaryParagraphs.map((paragraph, index) => (
                    <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-sm leading-6 text-slate-200">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            <div ref={bindSectionContainerRef('section-related-guidelines')}>
              <div id="section-related-guidelines" ref={bindSectionRef('section-related-guidelines')} className="scroll-mt-24" />
              <RelatedGuidelinesSection items={relatedGuidelines} onSelectItem={handleSelectItem} />
            </div>

            {detail.parse_notes ? (
              <section ref={bindSectionContainerRef('section-notes')} className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 backdrop-blur-md">
                <div id="section-notes" ref={bindSectionRef('section-notes')} className="mb-2 flex scroll-mt-24 items-center gap-2">
                  <span className="material-icons text-[18px] text-amber-300">info</span>
                  <h3 className="text-sm font-semibold text-amber-100">Notes / caveats</h3>
                </div>
                <p className="text-sm leading-6 text-amber-50/85">{detail.parse_notes}</p>
              </section>
            ) : null}

            {articleControls}
          </div>
        </div>
      ) : (
        <EmptyState
          compact
          icon="fact_check"
          title={activeTopic ? `Choose a ${activeTopic} guide` : 'Choose a pathology'}
          description={activeTopic ? 'Select a curated result to view the latest published checklist and summary.' : 'Choose a topic or guide to begin.'}
        />
      )}
    </section>
  );
};

const RadioGraphicsSearchBar: React.FC<RadioGraphicsSearchBarProps> = ({
  query,
  onQueryChange,
  onClear,
  isRequestDrawerOpen,
  onToggleRequestDrawer,
  onFocus,
  onBlur,
}) => (
  <div className="relative group flex w-full rounded-[1.25rem] border border-white/5 bg-black/40 p-1.5 shadow-inner backdrop-blur-md transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
    <span className="material-icons pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[19px] text-slate-500 transition-colors group-focus-within:text-primary">
      search
    </span>
    <input
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder="Search pathology, syndrome, or keyword..."
      className="h-10 w-full rounded-xl border-0 bg-transparent pl-[2.75rem] pr-[5.75rem] text-[13px] font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-0"
      aria-label="Search RadioGraphics"
    />
    {query ? (
      <button
        type="button"
        onClick={onClear}
        className="absolute right-[3rem] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white/10 hover:text-white"
        aria-label="Clear search"
      >
        <span className="material-icons text-sm">close</span>
      </button>
    ) : null}
    <button
      type="button"
      onClick={onToggleRequestDrawer}
      className={`absolute right-1.5 top-1.5 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${isRequestDrawerOpen
        ? 'bg-primary text-white shadow-[0_4px_12px_rgba(13,162,231,0.3)]'
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      aria-label={isRequestDrawerOpen ? 'Close request topic form' : 'Open request topic form'}
      aria-expanded={isRequestDrawerOpen}
    >
      <span className="material-icons text-[18px]">tune</span>
    </button>
  </div>
);

const RadioGraphicsQuickChips: React.FC<RadioGraphicsQuickChipsProps> = ({
  query,
  visible,
  chips,
  onSelectChip,
}) => {
  if (!visible) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelectChip(chip)}
          className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] transition ${query === chip
            ? 'border-cyan-400/24 bg-cyan-500/10 text-cyan-100'
            : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'
            }`}
        >
          {chip}
        </button>
      ))}
    </div>
  );
};

const RadioGraphicsRequestDrawer: React.FC<RadioGraphicsRequestDrawerProps> = ({
  open,
  requestForm,
  setRequestForm,
  onSubmit,
  isSubmitting,
}) => {
  if (!open) return null;

  return (
    <div className="mt-2 rounded-3xl border border-white/10 bg-[#08121d]/90 p-4 shadow-2xl backdrop-blur-md">
      <div className="space-y-1">
        <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Request a topic</h2>
        <p className="text-xs leading-5 text-slate-400">Suggest a topic, file, or update for the RadioGraphics library.</p>
      </div>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-300">Title</span>
          <input
            value={requestForm.title}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="What do you want added?"
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-300">Link</span>
          <input
            value={requestForm.source_url}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, source_url: event.target.value }))}
            placeholder="Optional source link"
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-300">Note</span>
          <textarea
            value={requestForm.description}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={3}
            placeholder="Optional context"
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Track request status in the Requests section below.</p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Sending...' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PathologyChecklistScreen: React.FC<PathologyChecklistScreenProps> = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [results, setResults] = useState<PathologyGuidelineListItem[]>([]);
  const [libraryItems, setLibraryItems] = useState<PathologyGuidelineListItem[]>([]);
  const [topicHubs, setTopicHubs] = useState<RadioGraphicsTopicHub[]>([]);
  const [featuredGuidelines, setFeaturedGuidelines] = useState<PathologyGuidelineListItem[]>([]);
  const [recentGuidelines, setRecentGuidelines] = useState<PathologyGuidelineListItem[]>([]);
  const [editorDrafts, setEditorDrafts] = useState<PathologyGuidelineDraftListItem[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeBrowseTag, setActiveBrowseTag] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PathologyGuidelineListItem | null>(null);
  const [isDesktopDetail, setIsDesktopDetail] = useState(getIsDesktopDetail);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isDetailDismissed, setIsDetailDismissed] = useState(false);
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
  const [isLibraryControlPanelOpen, setIsLibraryControlPanelOpen] = useState(false);
  const [isLibraryMetadataExpanded, setIsLibraryMetadataExpanded] = useState(false);
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
  const [isPublishingImportedJson, setIsPublishingImportedJson] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importCategoryOverride, setImportCategoryOverride] = useState<string>('');
  const [requestForm, setRequestForm] = useState<RequestFormState>(DEFAULT_REQUEST_FORM);
  const [requests, setRequests] = useState<PathologyGuidelineRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestStatusDrafts, setRequestStatusDrafts] = useState<Record<string, PathologyGuidelineRequestStatus>>({});
  const [requestNotesDrafts, setRequestNotesDrafts] = useState<Record<string, string>>({});
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [deletingDraftVersionId, setDeletingDraftVersionId] = useState<string | null>(null);
  const [isRequestDrawerOpen, setIsRequestDrawerOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const sectionContainerRefs = useRef<Record<string, HTMLElement | null>>({});
  const sectionNavRef = useRef<HTMLDivElement | null>(null);
  const scrollContainer = useContext(LayoutScrollContext);
  const [mobileDetailScrollNode, setMobileDetailScrollNode] = useState<HTMLDivElement | null>(null);
  const [desktopDetailScrollNode, setDesktopDetailScrollNode] = useState<HTMLDivElement | null>(null);

  const canEdit = canEditPathologyChecklists(currentUserRole);
  const canSyncFromDrive = form.source_kind === 'google_drive' && !!form.google_drive_file_id.trim();
  const detailScrollContainer = isDesktopDetail ? desktopDetailScrollNode : mobileDetailScrollNode;
  const showQuickChips = isSearchFocused || query.trim().length > 0;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(DESKTOP_DETAIL_MEDIA_QUERY);
    const updateLayoutMode = (event?: MediaQueryListEvent) => {
      setIsDesktopDetail(event ? event.matches : mediaQuery.matches);
    };
    updateLayoutMode();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateLayoutMode);
      return () => mediaQuery.removeEventListener('change', updateLayoutMode);
    }
    mediaQuery.addListener(updateLayoutMode);
    return () => mediaQuery.removeListener(updateLayoutMode);
  }, []);

  useEffect(() => {
    if (isDesktopDetail) {
      setIsMobileDetailOpen(false);
      setMobileDetailScrollNode(null);
    }
  }, [isDesktopDetail]);

  useEffect(() => {
    if (!selectedItem) setIsMobileDetailOpen(false);
  }, [selectedItem]);

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

  const loadEditorDrafts = async () => {
    if (!canEdit) {
      setEditorDrafts([]);
      return;
    }
    setIsLoadingDrafts(true);
    try {
      const drafts = await listPathologyGuidelineDrafts();
      setEditorDrafts(drafts);
    } catch (error) {
      console.error('Failed to load pathology guideline drafts:', error);
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  useEffect(() => {
    loadEditorDrafts().catch((error) => console.error(error));
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

  const landingGuidelines = useMemo(() => {
    const seen = new Set<string>();
    return [...featuredGuidelines, ...recentGuidelines].filter((item) => {
      if (seen.has(item.guideline_id)) return false;
      seen.add(item.guideline_id);
      return true;
    });
  }, [featuredGuidelines, recentGuidelines]);

  useEffect(() => {
    if (debouncedQuery.trim()) return;
    if (isDetailDismissed) return;
    if (!displayResults.length) {
      return;
    }
    if (!selectedItem || !displayResults.some((item) => item.guideline_id === selectedItem.guideline_id)) {
      setSelectedItem(displayResults[0]);
    }
  }, [activeTopic, debouncedQuery, displayResults, isDetailDismissed, selectedItem]);

  useEffect(() => {
    setIsDetailDismissed(false);
  }, [activeTopic, debouncedQuery]);

  useEffect(() => {
    if (!debouncedQuery.trim()) return;
    setSelectedItem(null);
    setIsMobileDetailOpen(false);
  }, [debouncedQuery]);

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
  const checklistSections = useMemo(() => {
    const authoredSections = groupChecklistItems(detail?.checklist_items || []);
    const structuredSections = [
      createChecklistSectionFromStrings('Takeaways', detail?.reporting_takeaways || []),
      createChecklistSectionFromStrings('Red flags', detail?.reporting_red_flags || []),
      createChecklistSectionFromStrings('Phrases', detail?.suggested_report_phrases || []),
    ];
    return mergeChecklistSections([...authoredSections, ...structuredSections]);
  }, [detail?.checklist_items, detail?.reporting_red_flags, detail?.reporting_takeaways, detail?.suggested_report_phrases]);
  const detailSummaryParagraphs = useMemo(
    () => normalizeImportedSummary(detail?.rich_summary_md || ''),
    [detail?.rich_summary_md],
  );
  const hasDistinctBackground = detailSummaryParagraphs.length > 2;
  const detailSections = useMemo<ChecklistDetailSection[]>(() => {
    if (!detail || isEditMode) return [];
    return [
      ...checklistSections.map((section) => ({ id: section.id, label: section.label })),
      hasDistinctBackground ? { id: 'section-rich-summary', label: 'Background' } : null,
      relatedGuidelines.length ? { id: 'section-related-guidelines', label: 'Related' } : null,
      detail.parse_notes ? { id: 'section-notes', label: 'Notes' } : null,
    ].filter(Boolean) as ChecklistDetailSection[];
  }, [checklistSections, detail, hasDistinctBackground, isEditMode, relatedGuidelines.length]);

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
    detailScrollContainer?.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      detailScrollContainer?.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [detailScrollContainer, detailSections, isEditMode]);

  const scrollToSection = (sectionId: string) => {
    const node = sectionRefs.current[sectionId];
    if (!node) return;
    setActiveSectionId(sectionId);
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTopOfDetail = () => {
    if (detailScrollContainer) {
      detailScrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => {
        if (detailScrollContainer.scrollTop > 0) detailScrollContainer.scrollTop = 0;
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
    setIsDetailDismissed(false);
    setSelectedItem(item);
    setIsEditMode(false);
    if (!isDesktopDetail) setIsMobileDetailOpen(true);
    if (isAdminPanelOpen && sourceRecord?.id !== item.guideline_id) setIsAdminPanelOpen(false);
  };
  const handleCloseDetail = () => {
    setIsDetailDismissed(true);
    setIsMobileDetailOpen(false);
    setSelectedItem(null);
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

  useEffect(() => {
    if (!isMobileDetailOpen && !(isDesktopDetail && selectedItem)) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseDetail();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseDetail, isDesktopDetail, isMobileDetailOpen, selectedItem]);

  useEffect(() => {
    if (!isMobileDetailOpen || isDesktopDetail || !mobileDetailScrollNode) return;
    mobileDetailScrollNode.scrollTop = 0;
  }, [detail?.guideline_id, isDesktopDetail, isMobileDetailOpen, mobileDetailScrollNode]);

  useEffect(() => {
    if (!isDesktopDetail || !selectedItem || !desktopDetailScrollNode) return;
    desktopDetailScrollNode.scrollTop = 0;
  }, [desktopDetailScrollNode, detail?.guideline_id, isDesktopDetail, selectedItem]);

  const buildSourceFormFromCurrentContext = (): SourceFormState => {
    if (sourceRecord) {
      return {
        slug: sourceRecord.slug,
        pathology_name: sourceRecord.pathology_name,
        specialty: sourceRecord.specialty || '',
        synonyms: formatListInput(sourceRecord.synonyms),
        keywords: formatListInput(sourceRecord.keywords),
        source_url: sourceRecord.source_url || sourceRecord.google_drive_url,
        source_kind: sourceRecord.source_kind || 'pdf',
        google_drive_url: sourceRecord.google_drive_url,
        google_drive_file_id: sourceRecord.google_drive_file_id,
        source_title: sourceRecord.source_title || '',
        issuing_body: sourceRecord.issuing_body || '',
        is_active: sourceRecord.is_active ?? true,
        primary_topic: sourceRecord.primary_topic || '',
        secondary_topics: formatListInput(sourceRecord.secondary_topics),
        clinical_tags: formatListInput(sourceRecord.clinical_tags),
        anatomy_terms: formatListInput(sourceRecord.anatomy_terms),
        problem_terms: formatListInput(sourceRecord.problem_terms),
        content_type: sourceRecord.content_type || 'checklist',
        is_featured: sourceRecord.is_featured ?? false,
        search_priority: String(sourceRecord.search_priority ?? 0),
        related_guideline_slugs: formatListInput(sourceRecord.related_guideline_slugs),
      };
    }

    const baseName = detail?.pathology_name || selectedItem?.pathology_name || query.trim();
    const baseSlug = detail?.slug || selectedItem?.slug || makeSlug(baseName);

    return {
      ...DEFAULT_FORM,
      pathology_name: baseName,
      slug: baseSlug,
      source_title: detail?.source_title || selectedItem?.source_title || '',
      source_url: detail?.source_url || detail?.google_drive_url || '',
      source_kind: detail?.source_kind || 'pdf',
      issuing_body: detail?.issuing_body || selectedItem?.issuing_body || '',
      primary_topic: detail?.primary_topic || selectedItem?.primary_topic || '',
      clinical_tags: formatListInput(detail?.clinical_tags || selectedItem?.clinical_tags || []),
      anatomy_terms: formatListInput(detail?.anatomy_terms || selectedItem?.anatomy_terms || []),
      problem_terms: formatListInput(detail?.problem_terms || selectedItem?.problem_terms || []),
      content_type: detail?.content_type || selectedItem?.content_type || 'checklist',
      related_guideline_slugs: formatListInput(detail?.related_guideline_slugs || selectedItem?.related_guideline_slugs || []),
    };
  };

  const resetAdminForm = () => {
    if (!sourceRecord) {
      setSourceRecord(null);
      setVersions([]);
    }
    setForm(buildSourceFormFromCurrentContext());
    setIsAdminPanelOpen(true);
    setIsEditMode(false);
  };

  const openLibraryNewArticlePanel = () => {
    setSourceRecord(null);
    setVersions([]);
    setForm(DEFAULT_FORM);
    setIsEditMode(false);
    setIsAdminPanelOpen(false);
    setIsLibraryMetadataExpanded(false);
    setIsLibraryControlPanelOpen(true);
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

  const handleOpenDraftEntry = async (draftEntry: PathologyGuidelineDraftListItem) => {
    try {
      const [source, draft] = await Promise.all([
        getPathologyGuidelineSource(draftEntry.guideline_id),
        getLatestEditableDraft(draftEntry.guideline_id),
      ]);
      if (!source || !draft) {
        throw new Error('Draft could not be loaded.');
      }
      setSourceRecord(source);
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
      loadDraftIntoForm(draft);
      setSelectedItem(null);
      setDetail(null);
      setRelatedGuidelines([]);
      setIsEditMode(true);
      setIsAdminPanelOpen(true);
      setIsLibraryControlPanelOpen(true);
    } catch (error: any) {
      console.error('Failed to open draft entry:', error);
      toastError('Unable to open draft', error?.message || 'Please try again.');
    }
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
    const primaryTopic = form.primary_topic.trim() || inferPrimaryTopic({
      specialty: form.specialty,
      pathologyName,
      sourceTitle: form.source_title,
      anatomyTerms: normalizeListInput(form.anatomy_terms),
      problemTerms: normalizeListInput(form.problem_terms),
      clinicalTags: normalizeListInput(form.clinical_tags),
      keywords: normalizeListInput(form.keywords),
    });
    const clinicalTags = normalizeListInput(form.clinical_tags);
    const anatomyTerms = normalizeListInput(form.anatomy_terms);
    const problemTerms = normalizeListInput(form.problem_terms);
    if (!pathologyName || !slug) throw new Error('Pathology name and slug are required.');
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
      content_type: 'checklist' as const,
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
    const existingSource = await getPathologyGuidelineSourceBySlug(slug);
    if (existingSource?.id) {
      await updatePathologyGuidelineSource(existingSource.id, payload);
      const updatedSource = await getPathologyGuidelineSource(existingSource.id);
      if (!updatedSource) throw new Error('Existing source could not be reloaded.');
      return updatedSource;
    }
    try {
      const created = await createPathologyGuidelineSource(payload);
      const createdSource = await getPathologyGuidelineSource(created.id);
      if (!createdSource) throw new Error('Created source could not be loaded.');
      return createdSource;
    } catch (error: any) {
      if (String(error?.message || '').includes('pathology_guidelines_slug_key')) {
        const duplicateSource = await getPathologyGuidelineSourceBySlug(slug);
        if (duplicateSource?.id) {
          await updatePathologyGuidelineSource(duplicateSource.id, payload);
          const updatedSource = await getPathologyGuidelineSource(duplicateSource.id);
          if (!updatedSource) throw new Error('Existing source could not be reloaded.');
          return updatedSource;
        }
      }
      throw error;
    }
  };

  const handleSaveSource = async () => {
    setIsSavingSource(true);
    try {
      const shouldCreateDraftFromValidatedJson = !sourceRecord?.id && Boolean(validatedImportPayload);
      const persistedSource = await persistSourceRecord();
      setSourceRecord(persistedSource);
      setIsLibraryControlPanelOpen(false);
      if (shouldCreateDraftFromValidatedJson && validatedImportPayload) {
        await importValidatedJsonToSource(persistedSource);
      } else {
        toastSuccess(
          sourceRecord?.id ? 'Guideline source updated' : 'Guideline source created',
          sourceRecord?.id ? undefined : 'Add JSON and save a draft to make it appear in unpublished drafts.',
        );
      }
      await refreshCurrentSelection();
      await loadEditorDrafts();
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
      await loadEditorDrafts();
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
      await loadEditorDrafts();
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
      await loadEditorDrafts();
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

  const importValidatedJsonToSource = async (
    persistedSource: PathologyGuidelineSource,
    options?: { publishImmediately?: boolean },
  ) => {
    if (!validatedImportPayload) throw new Error('Validate the JSON first before creating a draft.');

    const createdVersion = await importPathologyGuidelineVersion(persistedSource.id, validatedImportPayload);

    if (options?.publishImmediately) {
      await publishPathologyGuidelineVersion(createdVersion.id);
      setVersions(await getGuidelineDraftVersions(persistedSource.id));
      await refreshCurrentSelection();
      await loadEditorDrafts();
      setEditableDraft(null);
      setIsEditMode(false);
      setIsAdminPanelOpen(false);
      setIsLibraryControlPanelOpen(false);
      toastSuccess('Article published', 'Source metadata, JSON draft, and published version were saved together.');
      return createdVersion;
    }

    setVersions(await getGuidelineDraftVersions(persistedSource.id));
    await loadEditorDrafts();
    loadDraftIntoForm(createdVersion);
    setIsEditMode(true);
    setIsAdminPanelOpen(true);
    toastSuccess('Draft created', 'Source metadata and JSON draft were saved together.');
    return createdVersion;
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
      if (!sourceRecord?.id) setForm((prev) => {
        const next = mergeImportPayloadIntoForm(prev, payload);
        if (importCategoryOverride) next.primary_topic = importCategoryOverride;
        return next;
      });
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
      if (!sourceRecord?.id) setForm((prev) => {
        const next = mergeImportPayloadIntoForm(prev, payload);
        if (importCategoryOverride) next.primary_topic = importCategoryOverride;
        return next;
      });
    }
    setImportWarnings(warnings);
  };

  const handleImportJson = async () => {
    if (!validatedImportPayload) return toastInfo('Validate the JSON first', 'Fix any import errors before saving a draft.');
    setIsImportingJson(true);
    try {
      const persistedSource = sourceRecord?.id ? sourceRecord : await persistSourceRecord();
      if (!sourceRecord?.id) setSourceRecord(persistedSource);
      await importValidatedJsonToSource(persistedSource);
    } catch (error: any) {
      console.error('Failed to import JSON guideline draft:', error);
      toastError('Unable to import JSON draft', error?.message || 'Please review the metadata and try again.');
    } finally {
      setIsImportingJson(false);
    }
  };

  const handlePublishImportedJson = async () => {
    if (!validatedImportPayload) return toastInfo('Validate the JSON first', 'Fix any import errors before publishing.');
    setIsPublishingImportedJson(true);
    try {
      const persistedSource = sourceRecord?.id ? sourceRecord : await persistSourceRecord();
      if (!sourceRecord?.id) setSourceRecord(persistedSource);
      await importValidatedJsonToSource(persistedSource, { publishImmediately: true });
    } catch (error: any) {
      console.error('Failed to publish imported JSON guideline:', error);
      toastError('Unable to publish article', error?.message || 'Please review the metadata and try again.');
    } finally {
      setIsPublishingImportedJson(false);
    }
  };

  const handleSubmitRequest = async () => {
    const title = requestForm.title.trim();
    if (title.length < 3) return toastInfo('Add more detail', 'Please enter a request title with at least 3 characters.');
    setIsSubmittingRequest(true);
    try {
      await createPathologyGuidelineRequest({ request_type: requestForm.request_type, title, description: requestForm.description.trim() || null, source_url: requestForm.source_url.trim() || null });
      setRequestForm(DEFAULT_REQUEST_FORM);
      setIsRequestDrawerOpen(false);
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

  const handleDeleteDraft = async (versionId: string) => {
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Delete this draft? This cannot be undone.');
    if (!confirmed) return;
    setDeletingDraftVersionId(versionId);
    try {
      await deletePathologyGuidelineDraft(versionId);
      if (editableDraft?.id === versionId) {
        setEditableDraft(null);
        setIsEditMode(false);
      }
      if (versions.some((version) => version.id === versionId)) {
        setVersions((prev) => prev.filter((version) => version.id !== versionId));
      }
      setEditorDrafts((prev) => prev.filter((draft) => draft.version_id !== versionId));
      toastSuccess('Draft deleted');
      await loadEditorDrafts();
    } catch (error: any) {
      console.error('Failed to delete pathology guideline draft:', error);
      toastError('Unable to delete draft', error?.message || 'Please try again.');
    } finally {
      setDeletingDraftVersionId(null);
    }
  };

  const handleToggleArticleVisibility = async (nextActive: boolean) => {
    if (!sourceRecord?.id) {
      toastInfo('Source metadata required', 'Save or load source metadata to manage visibility.');
      return;
    }

    if (!nextActive) {
      const confirmed = typeof window === 'undefined' ? true : window.confirm('Hide this article from the library? You can restore it later.');
      if (!confirmed) return;
    }

    try {
      await updatePathologyGuidelineSource(sourceRecord.id, { is_active: nextActive });
      setSourceRecord((prev) => (prev ? { ...prev, is_active: nextActive } : prev));
      setForm((prev) => ({ ...prev, is_active: nextActive }));
      await refreshCurrentSelection();

      if (!nextActive && selectedItem?.guideline_id === sourceRecord.id) {
        setSelectedItem(null);
        setDetail(null);
        setRelatedGuidelines([]);
        setIsMobileDetailOpen(false);
      }

      toastSuccess(nextActive ? 'Article restored' : 'Article hidden');
    } catch (error: any) {
      console.error('Failed to update article visibility:', error);
      toastError('Unable to update article visibility', error?.message || 'Please try again.');
    }
  };

  const renderBrowseSection = (section: RadioGraphicsBrowseSection) => (
    <div key={section.id} className="space-y-1.5">
      {section.title || section.description ? (
        <div>
          {section.title ? <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{section.title}</h4> : null}
          {section.description ? <p className="mt-1 text-xs text-slate-500">{section.description}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
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

  const articleControls = (canEdit || isRoleLoading) ? (
    <section className="rounded-3xl border border-fuchsia-500/15 bg-fuchsia-950/10 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-fuchsia-200">Article controls</h2>
          <p className="mt-1 text-xs text-slate-400">Manage visibility, metadata, drafts, and publishing for this article.</p>
        </div>
        {!isRoleLoading && canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setIsAdminPanelOpen((value) => !value)} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15">
              {isAdminPanelOpen ? 'Hide panel' : 'Manage'}
            </button>
            <button onClick={handleEditDraft} disabled={isPreparingDraft || !selectedItem} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">
              {isPreparingDraft ? 'Preparing...' : 'Edit draft'}
            </button>
            <button onClick={resetAdminForm} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
              New source
            </button>
          </div>
        ) : null}
      </div>
      {isRoleLoading ? <LoadingState compact title="Checking permissions..." /> : canEdit ? (
        <div className="mt-4 space-y-4">
          <section className="rounded-2xl border border-rose-500/15 bg-rose-950/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-rose-100">Visibility</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">{form.is_active ? 'This article is visible in the library.' : 'This article is hidden from the library.'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleArticleVisibility(!form.is_active)}
                disabled={!sourceRecord?.id}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${form.is_active ? 'border border-rose-400/20 bg-rose-500/[0.10] text-rose-100 hover:bg-rose-500/[0.14]' : 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'}`}
              >
                {form.is_active ? 'Hide article' : 'Restore article'}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{sourceRecord?.id ? 'Removes this article from the library while keeping it recoverable for privileged users.' : 'Save or load source metadata to manage visibility.'}</p>
          </section>

          {isAdminPanelOpen ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Pathology name</span><input value={form.pathology_name} onChange={(event) => setForm((prev) => ({ ...prev, pathology_name: event.target.value, slug: prev.slug || makeSlug(event.target.value) }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Slug</span><input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Source title</span><input value={form.source_title} onChange={(event) => setForm((prev) => ({ ...prev, source_title: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Source URL</span><input value={form.source_url} onChange={(event) => setForm((prev) => ({ ...prev, source_url: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-300">Category (Topic)</span>
                  <select value={form.primary_topic || ''} onChange={(event) => setForm((prev) => ({ ...prev, primary_topic: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35">
                    <option value="">Auto-detect category</option>
                    {["Chest", "Abdomen", "GU / OB-Gyn", "Neuro / Head & Neck", "Musculoskeletal", "Breast", "Pediatrics", "Procedures / IR", "General & Other"].map(topic => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </select>
                </label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Subspecialty</span><input value={form.specialty || ''} onChange={(event) => setForm((prev) => ({ ...prev, specialty: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Source is active</label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_featured} onChange={(event) => setForm((prev) => ({ ...prev, is_featured: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Featured on landing</label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={handleSaveSource} disabled={isSavingSource} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSavingSource ? 'Saving...' : 'Save source'}</button>
                {form.source_kind === 'google_drive' ? <button onClick={handleSync} disabled={isSyncing || !canSyncFromDrive} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSyncing ? 'Syncing...' : 'Sync from Drive'}</button> : null}
              </div>

              {isEditMode ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">Edit checklist draft</h3>
                    <button onClick={() => setIsEditMode(false)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Close</button>
                  </div>
                  {!!draftFormErrors.length ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-3">{draftFormErrors.map((error) => <p key={error} className="text-xs text-rose-100/90">{error}</p>)}</div> : null}
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Quick Summary</span><textarea value={draftForm.tldr_md || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, tldr_md: event.target.value }))} rows={3} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Rich summary</span><textarea value={draftForm.rich_summary_md || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, rich_summary_md: event.target.value }))} rows={5} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Checklist items</h4>
                      <button onClick={addChecklistItem} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">Add item</button>
                    </div>
                    {(draftForm.checklist_items || []).map((item, index) => (
                      <div key={`${item.id}-${index}`} className="space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <input value={item.label} onChange={(event) => updateChecklistItem(index, { label: event.target.value })} placeholder="Checklist label" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <input value={item.id} onChange={(event) => updateChecklistItem(index, { id: event.target.value })} placeholder="item-id" className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" />
                          <input value={item.section || ''} onChange={(event) => updateChecklistItem(index, { section: event.target.value || null })} placeholder="Section" className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" />
                          <button onClick={() => deleteChecklistItem(index)} className="rounded-xl border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.12]">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSaveDraft} disabled={isSavingDraft} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSavingDraft ? 'Saving...' : 'Save draft'}</button>
                </div>
              ) : null}

              <div className="space-y-3 rounded-2xl border border-cyan-500/15 bg-cyan-950/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Import checklist JSON</h3>
                    <p className="mt-1 text-xs text-slate-400">Create draft content from structured PDF output.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setImportMode('paste')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === 'paste' ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>Paste</button>
                    <button onClick={() => setImportMode('upload')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === 'upload' ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>Upload</button>
                  </div>
                </div>
                {importMode === 'upload' ? <input type="file" accept=".json,application/json" onChange={handleImportFile} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-cyan-100" /> : null}
                <textarea value={rawImportJson} onChange={(event) => { setRawImportJson(event.target.value); setValidatedImportPayload(null); setImportValidationErrors([]); setImportWarnings([]); }} rows={8} placeholder='{"pathology_name":"Appendicitis","rich_summary_md":"...","checklist_items":[...]}' className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400/35" />
                {!!importValidationErrors.length ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3">{importValidationErrors.map((error) => <p key={error} className="text-xs text-rose-100/90">{error}</p>)}</div> : null}
                {!!importWarnings.length ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">{importWarnings.map((warning) => <p key={warning} className="text-xs text-amber-100/90">{warning}</p>)}</div> : null}
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleValidateImportJson} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">{importMode === 'upload' ? 'Recheck JSON' : 'Validate JSON'}</button>
                  <button onClick={handleImportJson} disabled={isImportingJson || !validatedImportPayload} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isImportingJson ? 'Saving...' : 'Save Draft'}</button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Version history</h3>
                {versions.length ? versions.map((version) => (
                  <div key={version.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${version.sync_status === 'published' ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : version.sync_status === 'failed' ? 'border border-rose-400/20 bg-rose-500/10 text-rose-100' : 'border border-amber-400/20 bg-amber-500/10 text-amber-100'}`}>{version.sync_status}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getOriginLabel(version.origin)}</span>
                          <span className="text-xs text-slate-500">{formatDateLabel(version.synced_at)}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">{version.source_title || 'Untitled version'}</p>
                      </div>
                      {version.sync_status !== 'published' ? (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handlePublish(version.id)} disabled={publishingVersionId === version.id} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">{publishingVersionId === version.id ? 'Publishing...' : 'Publish'}</button>
                          {version.sync_status === 'draft' ? <button onClick={() => handleDeleteDraft(version.id)} disabled={deletingDraftVersionId === version.id} className="rounded-xl border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.12] disabled:cursor-not-allowed disabled:opacity-60">{deletingDraftVersionId === version.id ? 'Deleting...' : 'Delete'}</button> : null}
                        </div>
                      ) : null}
                    </div>
                    {version.parse_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{version.parse_notes}</p> : null}
                  </div>
                )) : <EmptyState compact icon="cloud_sync" title="No synced versions yet" description="After you import, edit, or sync a guideline, versions will appear here." />}
              </div>
            </div>
          ) : <p className="mt-3 text-sm text-slate-500">Open the panel to manage this article.</p>}
        </div>
      ) : <p className="mt-3 text-sm text-slate-500">Privileged editor tools are hidden for your account.</p>}
    </section>
  ) : null;


  const detailPanel = (
    <RadioGraphicsDetailPanel
      activeSectionId={activeSectionId}
      articleControls={articleControls}
      activeTopic={activeTopic}
      bindSectionContainerRef={bindSectionContainerRef}
      bindSectionRef={bindSectionRef}
      canEdit={canEdit}
      checklistSections={checklistSections}
      detail={detail}
      detailSections={detailSections}
      handleEditDraft={handleEditDraft}
      handleSelectItem={handleSelectItem}
      isLoadingDetail={isLoadingDetail}
      isPreparingDraft={isPreparingDraft}
      relatedGuidelines={relatedGuidelines}
    />
  );

  const detailTitle = detail?.pathology_name || selectedItem?.pathology_name || '';
  const detailSourceHref = detail?.source_url || detail?.google_drive_url || sourceRecord?.source_url || sourceRecord?.google_drive_url || '';
  const detailSourceKind = detail?.source_kind || sourceRecord?.source_kind;
  const detailSourceLabel = getSourceActionLabel(detailSourceKind);
  const hasDetailSource = Boolean(detailSourceHref);
  const isDetailOverlayVisible = (isDesktopDetail && !!selectedItem) || (!isDesktopDetail && isMobileDetailOpen);
  const overlayRoot = typeof document !== 'undefined' ? document.body : null;

  return (
    <div className="min-h-full bg-app px-6 pb-40 pt-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-3 pt-2">
          <h1 className="text-3xl font-bold text-white">RadioGraphics</h1>
          {!isRoleLoading && canEdit && !isDetailOverlayVisible ? (
            <TopRightCreateAction
              label="New article"
              icon="add_circle"
              onClick={openLibraryNewArticlePanel}
              aria-label="New article"
              compact
              className="shrink-0"
            />
          ) : null}
        </header>

        <section className="space-y-3">
          <RadioGraphicsSearchBar
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              if (value.trim()) {
                setActiveTopic(null);
                setActiveBrowseTag(null);
              }
            }}
            onClear={() => setQuery('')}
            isRequestDrawerOpen={isRequestDrawerOpen}
            onToggleRequestDrawer={() => setIsRequestDrawerOpen((value) => !value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              if (!query.trim()) {
                setIsSearchFocused(false);
              }
            }}
          />
          <RadioGraphicsQuickChips
            query={query}
            visible={showQuickChips}
            chips={QUICK_SEARCH_CHIPS}
            onSelectChip={handleSelectQuickChip}
          />
          <RadioGraphicsRequestDrawer
            open={isRequestDrawerOpen}
            requestForm={requestForm}
            setRequestForm={setRequestForm}
            onSubmit={handleSubmitRequest}
            isSubmitting={isSubmittingRequest}
          />
        </section>

        <div className="space-y-6">
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
                  {isLoadingResults ? <LoadingState compact title="Searching RadioGraphics..." /> : displayResults.length ? <div className="flex flex-col gap-2">{displayResults.map((item) => <GuidelineResultCard key={item.guideline_id} item={item} active={item.guideline_id === selectedItem?.guideline_id} onClick={() => handleSelectItem(item)} topicLabel={getTrainingHubDefinition(getTrainingHubIdForItem(item)).topic} />)}</div> : <EmptyState compact icon="rule" title="No pathology matched that search term" description="Try a broader pathology name, synonym, or keyword." />}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 'All topics' button removed for mobile-first layout */}
                  {isLoadingLibrary ? <LoadingState compact title="Loading RadioGraphics library..." /> : <TopicHubGrid hubs={topicHubs} activeTopic={activeTopic} onSelectTopic={handleSelectTopic} />}
                  {activeTopic ? (
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{activeTopic}</h3>
                        <p className="mt-1 text-xs text-slate-400">{activeHub?.activeDescription || 'Curated training guides.'}</p>
                      </div>
                      {hubTags.length ? <div className="flex flex-wrap gap-2">{hubTags.map((tag) => <button key={tag} type="button" onClick={() => setActiveBrowseTag((prev) => (prev === tag ? null : tag))} className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${activeBrowseTag === tag ? 'border-cyan-400/24 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>{tag}</button>)}</div> : null}
                      <div className="space-y-3">
                        {browseSections.map((section) => renderBrowseSection({
                          ...section,
                          description: section.items.length <= 2 ? '' : section.description,
                        }))}
                      </div>
                    </div>
                  ) : (
                    landingGuidelines.length ? (
                      <div className="flex flex-col gap-2">
                        {landingGuidelines.map((item) => (
                          <GuidelineResultCard
                            key={item.guideline_id}
                            item={item}
                            active={item.guideline_id === selectedItem?.guideline_id}
                            onClick={() => handleSelectItem(item)}
                            variant="browse"
                            topicLabel={getTrainingHubDefinition(getTrainingHubIdForItem(item)).topic}
                          />
                        ))}
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </section>
          </div>
        </div>

        {!isRoleLoading && canEdit ? (
          <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Unpublished drafts</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">Editor-only drafts imported or edited but not yet published.</p>
              </div>
              {isLoadingDrafts ? <LoadingState compact title="Loading drafts..." /> : editorDrafts.length ? (
                <div className="space-y-3">
                  {editorDrafts.map((draft) => (
                    <div key={draft.version_id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100">Draft</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getOriginLabel(draft.origin)}</span>
                            <span className="text-xs text-slate-500">{formatDateLabel(draft.synced_at)}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-white">{draft.pathology_name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{draft.primary_topic || 'General reporting pearls'} ?{getSourceKindLabel(draft.source_kind)}</p>
                          {draft.source_title ? <p className="mt-2 text-xs leading-5 text-slate-400">{draft.source_title}</p> : null}
                          {draft.parse_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{draft.parse_notes}</p> : null}
                          {!draft.is_active ? <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-rose-200/80">Source is hidden</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleOpenDraftEntry(draft)} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">
                            Open draft
                          </button>
                          <button onClick={() => handleDeleteDraft(draft.version_id)} disabled={deletingDraftVersionId === draft.version_id} className="rounded-xl border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.12] disabled:cursor-not-allowed disabled:opacity-60">
                            {deletingDraftVersionId === draft.version_id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState compact icon="edit_note" title="No unpublished drafts" description="JSON imports and manual edits will appear here until published." />}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Requests</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">{canEdit ? 'Review and manage incoming library requests.' : 'Track what you asked to be added or updated.'}</p>
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{canEdit ? 'Incoming requests' : 'Your requests'}</h3>
              {isLoadingRequests ? <LoadingState compact title="Loading requests..." /> : requests.length ? requests.map((request) => <div key={request.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">{getRequestTypeLabel(request.request_type)}</span><span className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getRequestStatusLabel(request.status)}</span><span className="text-xs text-slate-500">{formatDateLabel(request.created_at)}</span></div><p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">Requested by {request.requester_name || request.requester_username || 'Unknown requester'}</p><p className="mt-2 text-sm font-semibold text-white">{request.title}</p>{request.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{request.description}</p> : null}{request.source_url ? <a href={request.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-cyan-200 hover:text-cyan-100">Open link</a> : null}{!canEdit && request.review_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{request.review_notes}</p> : null}</div>{(canEdit || request.created_by === currentUserId) ? <button onClick={() => handleDeleteRequest(request.id)} disabled={deletingRequestId === request.id} className="rounded-xl border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.12] disabled:cursor-not-allowed disabled:opacity-60">{deletingRequestId === request.id ? 'Deleting...' : 'Delete'}</button> : null}</div>{canEdit ? <div className="mt-3 space-y-3 border-t border-white/5 pt-3"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Status</span><select value={requestStatusDrafts[request.id] || request.status} onChange={(event) => setRequestStatusDrafts((prev) => ({ ...prev, [request.id]: event.target.value as PathologyGuidelineRequestStatus }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35"><option value="pending">Pending</option><option value="reviewed">Reviewed</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select></label></div><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Review note</span><textarea value={requestNotesDrafts[request.id] || ''} onChange={(event) => setRequestNotesDrafts((prev) => ({ ...prev, [request.id]: event.target.value }))} rows={3} placeholder="Optional note" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><button onClick={() => handleUpdateRequest(request.id)} disabled={updatingRequestId === request.id} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">{updatingRequestId === request.id ? 'Saving...' : 'Save'}</button></div> : null}</div>) : <EmptyState compact icon="forum" title="No requests yet" description={canEdit ? 'Requests will appear here.' : 'Your requests will appear here.'} />}
            </div>
          </div>
        </section>

        {!isRoleLoading && canEdit && !isDetailOverlayVisible && isLibraryControlPanelOpen ? (
          <div className="fixed inset-x-0 top-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[120] px-3 py-3 xl:inset-auto xl:bottom-6 xl:right-6 xl:px-0 xl:py-0">
            <section className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-fuchsia-500/15 bg-[#101922]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl xl:mx-0 xl:h-auto xl:w-[24rem] xl:max-w-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-fuchsia-200">New article</h2>
                  <p className="mt-1 text-xs text-slate-400">Paste or upload checklist JSON, then add the article title and source link.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsLibraryControlPanelOpen(false); setImportCategoryOverride(''); }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-100 transition hover:bg-white/[0.1]"
                  aria-label="Close article controls"
                >
                  <span className="material-icons text-[18px]">close</span>
                </button>
              </div>
              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="space-y-3 rounded-2xl border border-cyan-500/15 bg-cyan-950/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Import checklist JSON</h3>
                      <p className="mt-1 text-xs text-slate-400">Primary workflow for adding a new article. Metadata auto-fills when possible.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={importCategoryOverride}
                        onChange={(e) => setImportCategoryOverride(e.target.value)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-semibold text-slate-300 outline-none focus:border-cyan-400/35"
                      >
                        <option value="">Auto-detect category</option>
                        {["Chest", "Abdomen", "GU / OB-Gyn", "Neuro / Head & Neck", "Musculoskeletal", "Breast", "Pediatrics", "Procedures / IR", "General & Other"].map(topic => (
                          <option key={topic} value={topic}>{topic}</option>
                        ))}
                      </select>
                      <button onClick={() => setImportMode('paste')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === 'paste' ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>Paste</button>
                      <button onClick={() => setImportMode('upload')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === 'upload' ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>Upload</button>
                    </div>
                  </div>
                  {importMode === 'upload' ? <input type="file" accept=".json,application/json" onChange={handleImportFile} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-cyan-100" /> : null}
                  <textarea value={rawImportJson} onChange={(event) => { setRawImportJson(event.target.value); setValidatedImportPayload(null); setImportValidationErrors([]); setImportWarnings([]); }} rows={7} placeholder='{"pathology_name":"Appendicitis","rich_summary_md":"...","checklist_items":[...]}' className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400/35" />
                  {!!importValidationErrors.length ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3">{importValidationErrors.map((error) => <p key={error} className="text-xs text-rose-100/90">{error}</p>)}</div> : null}
                  {!!importWarnings.length ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">{importWarnings.map((warning) => <p key={warning} className="text-xs text-amber-100/90">{warning}</p>)}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleValidateImportJson} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">
                      {importMode === 'upload' ? 'Recheck JSON' : 'Validate JSON'}
                    </button>
                    <button onClick={handleImportJson} disabled={isImportingJson || !validatedImportPayload} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">
                      {isImportingJson ? 'Creating...' : 'Create draft from JSON'}
                    </button>
                    <button onClick={handlePublishImportedJson} disabled={isPublishingImportedJson || !validatedImportPayload} className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60">
                      {isPublishingImportedJson ? 'Publishing...' : 'Publish article'}
                    </button>
                  </div>
                  {importFileName ? <p className="text-xs text-slate-500">Loaded file: {importFileName}</p> : null}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Article text and link</h3>
                    <p className="mt-1 text-xs text-slate-500">Keep this minimal. JSON can fill most of the rest.</p>
                  </div>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-300">Pathology name</span>
                      <input value={form.pathology_name} onChange={(event) => setForm((prev) => ({ ...prev, pathology_name: event.target.value, slug: prev.slug || makeSlug(event.target.value) }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-300">Source title</span>
                      <input value={form.source_title} onChange={(event) => setForm((prev) => ({ ...prev, source_title: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-300">Source URL</span>
                      <input value={form.source_url} onChange={(event) => setForm((prev) => ({ ...prev, source_url: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
                    </label>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                  <button
                    type="button"
                    onClick={() => setIsLibraryMetadataExpanded((value) => !value)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">More settings</h3>
                      <p className="mt-1 text-xs text-slate-500">Slug and publish flags. Topic is inferred automatically.</p>
                    </div>
                    <span className="material-icons text-[18px] text-slate-500">{isLibraryMetadataExpanded ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {isLibraryMetadataExpanded ? (
                    <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-300">Slug</span>
                        <input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
                      </label>
                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Source is active</label>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_featured} onChange={(event) => setForm((prev) => ({ ...prev, is_featured: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Featured on landing</label>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={handleSaveSource} disabled={isSavingSource} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSavingSource ? 'Saving...' : 'Save article text/link'}
                  </button>
                  <button onClick={openLibraryNewArticlePanel} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                    Reset
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {overlayRoot && isDesktopDetail && selectedItem ? createPortal(
          <div
            className="fixed inset-0 z-[160] hidden items-center justify-center bg-[#020611]/88 px-6 py-6 backdrop-blur-md xl:flex"
            onClick={(event) => {
              if (event.target === event.currentTarget) handleCloseDetail();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Guide details"
              className="relative z-10 flex h-[min(92vh,1040px)] w-[min(1100px,calc(100vw-5rem))] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#06101a]/[0.985] shadow-[0_36px_110px_rgba(0,0,0,0.62)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative bg-[#091524]/96 px-6 py-5 shadow-[0_12px_28px_rgba(2,8,18,0.22)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="absolute right-6 top-5 inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/12 text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  aria-label="Close guide details"
                >
                  <span className="material-icons text-[20px]">close</span>
                </button>
                <div className="min-w-0 pr-16">
                  <h2 className="mx-auto max-w-none whitespace-nowrap text-center text-[1.8rem] font-black leading-[1.06] tracking-[-0.03em] text-white">
                    {detailTitle}
                  </h2>
                  {!isLoadingDetail && detail?.effective_date ? (
                    <p className="mt-2 text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{formatDateLabel(detail.effective_date)}</p>
                  ) : null}
                </div>
                {detailSections.length ? (
                  <div ref={sectionNavRef} className="mt-4 flex items-center justify-center gap-3">
                    {detailSections.length ? (
                      <label className="min-w-0 flex-[0_1_32%] rounded-xl border border-white/5 bg-black/40 p-[3px] shadow-inner backdrop-blur-md transition focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                        <span className="sr-only">Jump to section</span>
                        <select
                          value={activeSectionId || detailSections[0]?.id || ''}
                          onChange={(event) => scrollToSection(event.target.value)}
                          className="h-[40px] w-full appearance-none rounded-[0.85rem] border-0 bg-transparent px-4 text-[13px] font-bold text-white outline-none focus:ring-0"
                          aria-label="Jump to section"
                          style={{ colorScheme: 'dark' }}
                        >
                          {detailSections.map((section) => (
                            <option key={section.id} value={section.id} className="bg-slate-950 text-white">
                              {section.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {detailSections.length ? (
                      <button
                        onClick={scrollToTopOfDetail}
                        className="shrink-0 rounded-xl border border-cyan-300/25 bg-cyan-400/12 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      >
                        Top
                      </button>
                    ) : null}
                    {hasDetailSource ? (
                      <a
                        href={detailSourceHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/12 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      >
                        <span className="material-icons text-[18px]" aria-hidden="true">article</span>
                        <span>Read full</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/14 bg-cyan-400/[0.05] px-4 py-3 text-sm font-semibold text-cyan-50/45 opacity-70"
                        aria-label="Read full article"
                      >
                        <span className="material-icons text-[18px]" aria-hidden="true">article</span>
                        <span>Read full</span>
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              <div ref={setDesktopDetailScrollNode} className="flex-1 overflow-y-auto px-6 pb-6 pt-0">
                {detailPanel}
              </div>
            </div>
          </div>,
          overlayRoot,
        ) : null}

        {overlayRoot && !isDesktopDetail && isMobileDetailOpen && selectedItem ? createPortal(
          <div
            className="fixed inset-0 z-[160] h-[100dvh] bg-app/88 backdrop-blur-sm xl:hidden"
            onClick={(event) => {
              if (event.target === event.currentTarget) handleCloseDetail();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Guide details"
              className="absolute inset-0 flex h-[100dvh] flex-col bg-app"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-20 bg-app/92 px-4 py-3 shadow-[0_12px_28px_rgba(2,8,18,0.22)] backdrop-blur-xl">
                <div className="min-w-0">
                  <h2 className="mx-auto max-w-full text-center text-[1.4rem] font-black leading-[1.08] tracking-[-0.03em] text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden text-balance">
                    {detailTitle}
                  </h2>
                </div>
                {detailSections.length ? (
                  <div ref={sectionNavRef} className="mt-3 flex items-center gap-2">
                    {detailSections.length ? (
                      <>
                        <label className="min-w-0 flex-[0_1_56%] rounded-xl border border-white/5 bg-black/40 p-[3px] shadow-inner backdrop-blur-md transition focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                          <span className="sr-only">Jump to section</span>
                          <select
                            value={activeSectionId || detailSections[0]?.id || ''}
                            onChange={(event) => scrollToSection(event.target.value)}
                            className="h-[40px] w-full appearance-none rounded-[0.85rem] border-0 bg-transparent px-4 text-[13px] font-bold text-white outline-none focus:ring-0"
                            aria-label="Jump to section"
                            style={{ colorScheme: 'dark' }}
                          >
                            {detailSections.map((section) => (
                              <option key={section.id} value={section.id} className="bg-slate-950 text-white">
                                {section.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={scrollToTopOfDetail}
                          className="shrink-0 rounded-xl border border-cyan-300/25 bg-cyan-400/12 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                        >
                          Top
                        </button>
                      </>
                    ) : null}
                    {hasDetailSource ? (
                      <a
                        href={detailSourceHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/12 px-3 py-3 text-[11px] font-semibold text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                        aria-label="Read full article"
                      >
                        <span className="material-icons text-[16px]" aria-hidden="true">article</span>
                        <span>Read full</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/14 bg-cyan-400/[0.05] px-3 py-3 text-[11px] font-semibold text-cyan-50/45 opacity-70"
                        aria-label="Read full article"
                      >
                        <span className="material-icons text-[16px]" aria-hidden="true">article</span>
                        <span>Read full</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCloseDetail}
                      className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/12 text-cyan-50 transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      aria-label="Close guide details"
                    >
                      <span className="material-icons text-[20px]">close</span>
                    </button>
                  </div>
                ) : null}
              </div>
              <div ref={setMobileDetailScrollNode} className="flex-1 overflow-y-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
                <div className="space-y-6">
                  {detailPanel}
                </div>
              </div>
            </div>
          </div>,
          overlayRoot,
        ) : null}
      </div>
    </div>
  );
};

export default PathologyChecklistScreen;
