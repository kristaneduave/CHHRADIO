import React, { useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import { supabase } from '../services/supabase';
import {
  createPathologyGuidelineDraftFromCurrent,
  createPathologyGuidelineSource,
  getGuidelineDraftVersions,
  getLatestEditableDraft,
  getPathologyGuidelineDetail,
  getPathologyGuidelineSource,
  publishPathologyGuidelineVersion,
  importPathologyGuidelineVersion,
  searchPathologyGuidelines,
  syncPathologyGuideline,
  updatePathologyGuidelineDraft,
  updatePathologyGuidelineSource,
} from '../services/pathologyChecklistService';
import {
  createPathologyGuidelineRequest,
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
  PathologyGuidelineRequestInput,
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

const makeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const isValidDateValue = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeStringListForSave = (items: string[] = []) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const parseTextareaList = (value: string) =>
  normalizeStringListForSave(value.split('\n'));

const formatTextareaList = (values?: string[] | null) => (values || []).join('\n');

const getSourceKindLabel = (sourceKind?: PathologyGuidelineSourceKind | null) => {
  if (sourceKind === 'pdf') return 'PDF source';
  if (sourceKind === 'external') return 'External source';
  return 'Google Drive source';
};

const getSourceActionLabel = (sourceKind?: PathologyGuidelineSourceKind | null) => {
  if (sourceKind === 'pdf') return 'Open PDF';
  return 'Open source';
};

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

const renderSummaryBlocks = (summary: string) => {
  const paragraphs = summary
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return <p className="text-sm text-slate-400">No summary available for this guideline version.</p>;
  }

  return paragraphs.map((paragraph, index) => (
    <p key={`${index}-${paragraph.slice(0, 16)}`} className="text-sm leading-6 text-slate-200">
      {paragraph}
    </p>
  ));
};

const renderQuickList = (items: string[], accent: 'cyan' | 'amber' | 'emerald' = 'cyan') => {
  if (!items.length) return null;

  const accentClasses =
    accent === 'amber'
      ? 'border-amber-500/20 bg-amber-500/[0.05] text-amber-50/90'
      : accent === 'emerald'
        ? 'border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-50/90'
        : 'border-cyan-500/20 bg-cyan-500/[0.05] text-slate-100';

  return (
    <div className={`rounded-2xl border p-4 ${accentClasses}`}>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="mt-0.5 text-sm leading-6 opacity-80">•</span>
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

const mergeImportPayloadIntoForm = (
  current: SourceFormState,
  payload: PathologyGuidelineImportPayload,
): SourceFormState => ({
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
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { payload: null, errors: ['JSON must be an object.'] };
    }

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

    if (errors.length) {
      return { payload: null, errors };
    }

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

const ChecklistSection: React.FC<{ items: PathologyChecklistItem[] }> = ({ items }) => {
  const grouped: Record<string, PathologyChecklistItem[]> = items.reduce((acc, item) => {
    const key = item.section?.trim() || 'Checklist';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, PathologyChecklistItem[]>);

  return (
    <div className="space-y-4">
      {(Object.entries(grouped) as Array<[string, PathologyChecklistItem[]]>).map(([section, sectionItems]) => (
        <section key={section} className="rounded-2xl border border-cyan-500/20 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-icons text-[18px] text-cyan-300">checklist</span>
            <h3 className="text-sm font-semibold text-white">{section}</h3>
          </div>
          <div className="space-y-3">
            {sectionItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
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
};

const PathologyChecklistScreen: React.FC<PathologyChecklistScreenProps> = ({ onBack }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<PathologyGuidelineListItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PathologyGuidelineListItem | null>(null);
  const [detail, setDetail] = useState<PathologyGuidelineDetail | null>(null);
  const [versions, setVersions] = useState<PathologyGuidelineVersion[]>([]);
  const [sourceRecord, setSourceRecord] = useState<PathologyGuidelineSource | null>(null);
  const [form, setForm] = useState<SourceFormState>(DEFAULT_FORM);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
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
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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
          if (active) setCurrentUserRole(null);
          return;
        }

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

  useEffect(() => {
    let active = true;

    const loadRequests = async () => {
      setIsLoadingRequests(true);
      try {
        const nextRequests = await listPathologyGuidelineRequests();
        if (!active) return;
        setRequests(nextRequests);
        setRequestStatusDrafts(
          nextRequests.reduce<Record<string, PathologyGuidelineRequestStatus>>((acc, request) => {
            acc[request.id] = request.status;
            return acc;
          }, {}),
        );
        setRequestNotesDrafts(
          nextRequests.reduce<Record<string, string>>((acc, request) => {
            acc[request.id] = request.review_notes || '';
            return acc;
          }, {}),
        );
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
      setIsLoadingResults(true);
      try {
        const next = await searchPathologyGuidelines(debouncedQuery);
        if (active) setResults(next);
      } catch (error) {
        console.error('Failed to load pathology guidelines:', error);
        toastError('Unable to load pathology checklists', 'Confirm the pathology guideline migrations have been applied.');
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

  useEffect(() => {
    if (!results.length) {
      setSelectedItem(null);
      setDetail(null);
      if (!(canEdit && isAdminPanelOpen && sourceRecord)) {
        setVersions([]);
        setSourceRecord(null);
        if (!query.trim()) setForm(DEFAULT_FORM);
      }
      return;
    }

    if (!selectedItem || !results.some((item) => item.slug === selectedItem.slug)) {
      setSelectedItem(results[0]);
    }
  }, [results, selectedItem, query, canEdit, isAdminPanelOpen, sourceRecord]);

  useEffect(() => {
    if (!selectedItem) return;
    let active = true;

    const loadDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const nextDetail = await getPathologyGuidelineDetail(selectedItem.slug);
        if (!active) return;
        setDetail(nextDetail);

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
  }, [selectedItem, canEdit]);

  const draftVersions = useMemo(
    () => versions.filter((version) => version.sync_status !== 'published'),
    [versions],
  );
  const detailSections = useMemo<ChecklistDetailSection[]>(() => {
    if (!detail || isEditMode) return [];

    return [
      detail.tldr_md ? { id: 'section-quick-summary', label: 'Quick Summary' } : null,
      detail.reporting_takeaways.length ? { id: 'section-reporting-takeaways', label: 'Takeaways' } : null,
      detail.reporting_red_flags.length ? { id: 'section-red-flags', label: 'Red flags' } : null,
      detail.suggested_report_phrases.length ? { id: 'section-report-phrases', label: 'Phrases' } : null,
      detail.rich_summary_md ? { id: 'section-rich-summary', label: 'Summary' } : null,
      detail.checklist_items.length ? { id: 'section-checklist', label: 'Checklist' } : null,
      detail.parse_notes ? { id: 'section-notes', label: 'Notes' } : null,
    ].filter(Boolean) as ChecklistDetailSection[];
  }, [detail, isEditMode]);

  useEffect(() => {
    if (!detailSections.length || isEditMode) {
      setActiveSectionId(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

        if (visibleEntries.length) {
          setActiveSectionId(visibleEntries[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: '-15% 0px -55% 0px',
        threshold: [0.2, 0.4, 0.6],
      },
    );

    detailSections.forEach((section) => {
      const node = sectionRefs.current[section.id];
      if (node) observer.observe(node);
    });

    setActiveSectionId((current) => current || detailSections[0]?.id || null);

    return () => observer.disconnect();
  }, [detailSections, isEditMode]);

  const scrollToSection = (sectionId: string) => {
    const node = sectionRefs.current[sectionId];
    if (!node) return;
    setActiveSectionId(sectionId);
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTopOfDetail = () => {
    const node = sectionRefs.current[detailSections[0]?.id || ''];
    if (node) {
      window.scrollTo({ top: Math.max(window.scrollY + node.getBoundingClientRect().top - 140, 0), behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bindSectionRef = (sectionId: string) => (node: HTMLElement | null) => {
    sectionRefs.current[sectionId] = node;
  };

  const handleSelectItem = (item: PathologyGuidelineListItem) => {
    setSelectedItem(item);
    setIsEditMode(false);
    if (isAdminPanelOpen && sourceRecord?.id !== item.guideline_id) {
      setIsAdminPanelOpen(false);
    }
  };

  const resetAdminForm = () => {
    setSourceRecord(null);
    setVersions([]);
    setForm({
      ...DEFAULT_FORM,
      pathology_name: query.trim(),
      slug: makeSlug(query.trim()),
    });
    setIsAdminPanelOpen(true);
    setIsEditMode(false);
  };

  const refreshCurrentSelection = async () => {
    const nextResults = await searchPathologyGuidelines(debouncedQuery);
    setResults(nextResults);
    if (!selectedItem) return;
    const nextSelection = nextResults.find((item) => item.guideline_id === selectedItem.guideline_id) || null;
    if (nextSelection) setSelectedItem(nextSelection);
  };

  const refreshRequests = async () => {
    const nextRequests = await listPathologyGuidelineRequests();
    setRequests(nextRequests);
    setRequestStatusDrafts(
      nextRequests.reduce<Record<string, PathologyGuidelineRequestStatus>>((acc, request) => {
        acc[request.id] = request.status;
        return acc;
      }, {}),
    );
    setRequestNotesDrafts(
      nextRequests.reduce<Record<string, string>>((acc, request) => {
        acc[request.id] = request.review_notes || '';
        return acc;
      }, {}),
    );
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
    if (!(draftForm.tldr_md || '').trim()) errors.push('TLDR / immediate take-home is required.');
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
    const sourceUrl = form.source_url.trim();
    const sourceKind = form.source_kind;
    const googleDriveUrl = sourceKind === 'google_drive' ? (form.google_drive_url.trim() || sourceUrl) : '';
    const googleDriveFileId = sourceKind === 'google_drive' ? form.google_drive_file_id.trim() : '';

    if (!pathologyName || !slug) {
      throw new Error('Pathology name and slug are required.');
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
    };

    if (sourceRecord?.id) {
      await updatePathologyGuidelineSource(sourceRecord.id, payload);
      const updatedSource = await getPathologyGuidelineSource(sourceRecord.id);
      if (!updatedSource) {
        throw new Error('Updated source could not be reloaded.');
      }
      return updatedSource;
    }

    const created = await createPathologyGuidelineSource(payload);
    const createdSource = await getPathologyGuidelineSource(created.id);
    if (!createdSource) {
      throw new Error('Created source could not be loaded.');
    }
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
    if (!sourceRecord?.id) {
      toastInfo('Save the source first', 'Create or update the source record before syncing from Drive.');
      return;
    }
    if (!canSyncFromDrive) {
      toastInfo('Drive sync unavailable', 'Only Google Drive sources with a file id can sync from Drive.');
      return;
    }

    setIsSyncing(true);
    try {
      const data = await syncPathologyGuideline(sourceRecord.id);
      toastSuccess('Draft synced from Google Drive', data.sourceTitle || 'Review the parsed checklist before publishing.');
      const nextVersions = await getGuidelineDraftVersions(sourceRecord.id);
      setVersions(nextVersions);
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
        const [nextDetail, nextVersions] = await Promise.all([
          getPathologyGuidelineDetail(selectedItem.slug),
          getGuidelineDraftVersions(selectedItem.guideline_id),
        ]);
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
      const draft = (await getLatestEditableDraft(selectedItem.guideline_id))
        || (await createPathologyGuidelineDraftFromCurrent(selectedItem.guideline_id));
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
    if (!editableDraft?.id) {
      toastError('No editable draft', 'Create or load a draft first.');
      return false;
    }

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
      toastSuccess('Draft saved');
      const nextDraft = await getLatestEditableDraft(editableDraft.guideline_id);
      if (nextDraft) loadDraftIntoForm(nextDraft);
      const nextVersions = await getGuidelineDraftVersions(editableDraft.guideline_id);
      setVersions(nextVersions);
      return true;
    } catch (error: any) {
      console.error('Failed to save checklist draft:', error);
      toastError('Unable to save draft', error?.message || 'Please review the checklist fields and try again.');
      return false;
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublishEditableDraft = async () => {
    if (!editableDraft?.id) return;
    const saved = await handleSaveDraft();
    if (!saved) return;
    await handlePublish(editableDraft.id);
    setIsEditMode(false);
  };

  const updateChecklistItem = (index: number, patch: Partial<PathologyChecklistItem>) => {
    setDraftForm((prev) => {
      const items = [...(prev.checklist_items || [])];
      items[index] = { ...items[index], ...patch };
      return { ...prev, checklist_items: items };
    });
  };

  const addChecklistItem = () => {
    setDraftForm((prev) => {
      const nextItems = [...(prev.checklist_items || [])];
      const nextOrder = nextItems.length + 1;
      nextItems.push({
        id: `item-${nextOrder}`,
        label: '',
        section: null,
        order: nextOrder,
        notes: null,
      });
      return { ...prev, checklist_items: nextItems };
    });
  };

  const deleteChecklistItem = (index: number) => {
    setDraftForm((prev) => {
      const nextItems = (prev.checklist_items || [])
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
      return { ...prev, checklist_items: nextItems };
    });
  };

  const handleValidateImportJson = () => {
    const { payload, errors } = validateImportPayload(rawImportJson);
    setImportValidationErrors(errors);
    setValidatedImportPayload(payload);
    if (errors.length || !payload) {
      setImportWarnings([]);
      return;
    }

    const warnings: string[] = [];
    if (sourceRecord?.pathology_name && sourceRecord.pathology_name.trim().toLowerCase() !== payload.pathology_name.trim().toLowerCase()) {
      warnings.push('Imported pathology name differs from the saved source. Review before importing.');
    }
    if ((sourceRecord?.source_title || '').trim() && (sourceRecord?.source_title || '').trim().toLowerCase() !== (payload.source_title || '').trim().toLowerCase()) {
      warnings.push('Imported source title differs from the saved source metadata.');
    }
    setImportWarnings(warnings);
    if (!sourceRecord?.id) {
      setForm((prev) => mergeImportPayloadIntoForm(prev, payload));
    }

    if (!errors.length && payload) {
      toastSuccess('JSON ready', `${payload.checklist_items.length} checklist items ready to save as draft.`);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportMode('upload');
    setImportFileName(file.name);
    setRawImportJson(text);
    const { payload, errors } = validateImportPayload(text);
    setImportValidationErrors(errors);
    setValidatedImportPayload(payload);
    if (errors.length || !payload) {
      setImportWarnings([]);
      return;
    }
    const warnings: string[] = [];
    if (sourceRecord?.pathology_name && sourceRecord.pathology_name.trim().toLowerCase() !== payload.pathology_name.trim().toLowerCase()) {
      warnings.push('Imported pathology name differs from the saved source. Review before importing.');
    }
    if ((sourceRecord?.source_title || '').trim() && (sourceRecord?.source_title || '').trim().toLowerCase() !== (payload.source_title || '').trim().toLowerCase()) {
      warnings.push('Imported source title differs from the saved source metadata.');
    }
    setImportWarnings(warnings);
    if (!sourceRecord?.id) {
      setForm((prev) => mergeImportPayloadIntoForm(prev, payload));
      setIsAdminPanelOpen(true);
    }
    toastSuccess('JSON ready', `${payload.checklist_items.length} checklist items loaded from ${file.name}.`);
  };

  const handleImportJson = async () => {
    let importPayload = validatedImportPayload;
    if (!importPayload && rawImportJson.trim()) {
      const { payload, errors } = validateImportPayload(rawImportJson);
      setImportValidationErrors(errors);
      setValidatedImportPayload(payload);
      if (errors.length || !payload) {
        toastInfo('Fix JSON first', 'Review the upload errors before saving this draft.');
        return;
      }
      importPayload = payload;
    }
    if (!importPayload) {
      toastInfo('Upload JSON first', 'Upload or paste a JSON file before saving the draft.');
      return;
    }

    setIsImportingJson(true);
    try {
      const persistedSource = sourceRecord?.id ? sourceRecord : await persistSourceRecord();
      if (!sourceRecord?.id) {
        setSourceRecord(persistedSource);
      }
      const importedDraft = await importPathologyGuidelineVersion(persistedSource.id, importPayload);
      toastSuccess('Draft saved from JSON');
      const nextVersions = await getGuidelineDraftVersions(persistedSource.id);
      setVersions(nextVersions);
      setEditableDraft(importedDraft);
      loadDraftIntoForm(importedDraft);
      setIsEditMode(true);
      setIsAdminPanelOpen(true);
      setRawImportJson('');
      setImportFileName(null);
      setImportValidationErrors([]);
      setValidatedImportPayload(null);
      setImportWarnings([]);
    } catch (error: any) {
      console.error('Failed to import JSON guideline draft:', error);
      toastError('Unable to import JSON', error?.message || 'Please review the payload and try again.');
    } finally {
      setIsImportingJson(false);
    }
  };

  const handleSubmitRequest = async () => {
    const title = requestForm.title.trim();
    if (title.length < 3) {
      toastInfo('Add more detail', 'Please enter a topic or file request title with at least 3 characters.');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const payload: PathologyGuidelineRequestInput = {
        request_type: requestForm.request_type,
        title,
        description: requestForm.description.trim() || null,
        source_url: requestForm.source_url.trim() || null,
      };
      await createPathologyGuidelineRequest(payload);
      toastSuccess('Request submitted', 'Editors will review your topic or file suggestion.');
      setRequestForm(DEFAULT_REQUEST_FORM);
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
      await updatePathologyGuidelineRequest(requestId, {
        status: requestStatusDrafts[requestId] || 'pending',
        review_notes: requestNotesDrafts[requestId] || null,
      });
      toastSuccess('Request updated');
      await refreshRequests();
    } catch (error: any) {
      console.error('Failed to update pathology checklist request:', error);
      toastError('Unable to update request', error?.message || 'Please try again.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  return (
    <div className="min-h-screen bg-app px-6 pt-6 pb-64">
      <div className="mx-auto max-w-md space-y-6">
        <section className="rounded-[28px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 p-5 shadow-[0_20px_60px_rgba(8,145,178,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">
                <span className="material-icons text-[14px]">fact_check</span>
                Resident Hub
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">Pathology Checklists</h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">Search pathology keywords and review the latest published checklist from the current source.</p>
            </div>
            <button onClick={onBack} className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Back</button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/8 bg-slate-950/50 p-4 backdrop-blur-sm">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Search pathology</label>
          <div className="relative">
            <span className="material-icons pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type pathology, syndrome, or keyword" className="w-full rounded-2xl border border-cyan-500/20 bg-slate-900/80 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40" />
          </div>
          <div className="mt-4">
            {isLoadingResults ? <LoadingState compact title="Loading pathology index..." /> : results.length ? (
              <div className="space-y-2">
                {results.map((item) => {
                  const active = item.guideline_id === selectedItem?.guideline_id;
                  return (
                    <button key={item.guideline_id} onClick={() => handleSelectItem(item)} className={`w-full rounded-2xl border p-3 text-left transition ${active ? 'border-cyan-400/40 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.14)]' : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{item.pathology_name}</p>
                          <p className="mt-1 truncate text-xs text-slate-400">{[item.specialty, item.issuing_body].filter(Boolean).join(' • ') || 'Published guideline'}</p>
                          {!!item.synonyms.length && <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">Synonyms: {item.synonyms.join(', ')}</p>}
                        </div>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">Latest</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : <EmptyState compact icon="rule" title={query.trim() ? 'No pathology matched that search term' : 'No published pathology checklists yet'} description={query.trim() ? 'Try a broader pathology name, synonym, or keyword.' : 'Once editors publish guideline versions, they will appear here for search.'} />}
          </div>
        </section>

        <section className="rounded-3xl border border-white/8 bg-slate-950/50 p-4 backdrop-blur-sm">
          {isLoadingDetail ? <LoadingState compact title="Loading checklist detail..." /> : detail ? (
            isEditMode ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-white">Edit checklist draft</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Draft edits stay hidden until published.</p>
                  </div>
                  <button onClick={() => setIsEditMode(false)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Close</button>
                </div>
                {!!draftFormErrors.length && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-200">Fix before saving</p><div className="mt-2 space-y-1 text-xs text-rose-100/90">{draftFormErrors.map((error) => <p key={error}>{error}</p>)}</div></div>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Version label</span><input value={draftForm.version_label || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, version_label: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Effective date</span><input value={draftForm.effective_date || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, effective_date: event.target.value }))} placeholder="YYYY-MM-DD" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Source title</span><input value={draftForm.source_title || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, source_title: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Issuing body</span><input value={draftForm.issuing_body || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, issuing_body: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                </div>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">TLDR / immediate take-home</span><textarea value={draftForm.tldr_md || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, tldr_md: event.target.value }))} rows={4} className="w-full rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/35" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Rich summary</span><textarea value={draftForm.rich_summary_md || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, rich_summary_md: event.target.value }))} rows={6} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                <div className="grid grid-cols-1 gap-3">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Reporting takeaways</span><textarea value={formatTextareaList(draftForm.reporting_takeaways)} onChange={(event) => setDraftForm((prev) => ({ ...prev, reporting_takeaways: parseTextareaList(event.target.value) }))} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Reporting red flags</span><textarea value={formatTextareaList(draftForm.reporting_red_flags)} onChange={(event) => setDraftForm((prev) => ({ ...prev, reporting_red_flags: parseTextareaList(event.target.value) }))} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-amber-400/20 bg-amber-500/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Suggested report phrases</span><textarea value={formatTextareaList(draftForm.suggested_report_phrases)} onChange={(event) => setDraftForm((prev) => ({ ...prev, suggested_report_phrases: parseTextareaList(event.target.value) }))} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">Checklist items</h3><button onClick={addChecklistItem} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">Add item</button></div>
                  {(draftForm.checklist_items || []).map((item, index) => (
                    <div key={`${item.id}-${index}`} className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Item id</span><input value={item.id} onChange={(event) => updateChecklistItem(index, { id: event.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Order</span><input type="number" value={item.order} onChange={(event) => updateChecklistItem(index, { order: Number(event.target.value) || index + 1 })} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                      </div>
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Label</span><input value={item.label} onChange={(event) => updateChecklistItem(index, { label: event.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Section</span><input value={item.section || ''} onChange={(event) => updateChecklistItem(index, { section: event.target.value || null })} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Notes</span><input value={item.notes || ''} onChange={(event) => updateChecklistItem(index, { notes: event.target.value || null })} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                      </div>
                      <button onClick={() => deleteChecklistItem(index)} className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15">Delete item</button>
                    </div>
                  ))}
                </div>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Notes / caveats</span><textarea value={draftForm.parse_notes || ''} onChange={(event) => setDraftForm((prev) => ({ ...prev, parse_notes: event.target.value }))} rows={4} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" /></label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleSaveDraft} disabled={isSavingDraft} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSavingDraft ? 'Saving...' : 'Save Draft'}</button>
                  <button onClick={handlePublishEditableDraft} disabled={isSavingDraft || publishingVersionId === editableDraft?.id} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">{publishingVersionId === editableDraft?.id ? 'Publishing...' : 'Publish Draft'}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200">Latest published version</span><span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">{getSourceKindLabel(detail.source_kind)}</span>{detail.specialty ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{detail.specialty}</span> : null}</div>
                    <h2 className="text-2xl font-black tracking-tight text-white">{detail.pathology_name}</h2>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{detail.source_title || 'Untitled guideline'}{detail.issuing_body ? ` • ${detail.issuing_body}` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    {canEdit && <button onClick={handleEditDraft} disabled={isPreparingDraft} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isPreparingDraft ? 'Preparing...' : 'Edit checklist draft'}</button>}
                    {detail.source_url ? <a href={detail.source_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">{getSourceActionLabel(detail.source_kind)}</a> : <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-400">Source link can be added later</span>}
                  </div>
                </div>
                {detailSections.length ? (
                  <div className="sticky top-3 z-10 space-y-2">
                    <div className="inline-flex rounded-full border border-cyan-400/20 bg-slate-950/85 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 shadow-[0_10px_30px_rgba(2,132,199,0.12)] backdrop-blur">
                      {detailSections.find((section) => section.id === activeSectionId)?.label || detailSections[0]?.label || 'Section'}
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/85 p-2 shadow-[0_10px_30px_rgba(15,23,42,0.22)] backdrop-blur">
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">Jump to section</span>
                        <select
                          value={activeSectionId || detailSections[0]?.id || ''}
                          onChange={(event) => scrollToSection(event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35"
                          aria-label="Jump to section"
                        >
                          {detailSections.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={scrollToTopOfDetail}
                        className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                      >
                        Top
                      </button>
                    </div>
                  </div>
                ) : null}
                {detail.tldr_md ? <section id="section-quick-summary" ref={bindSectionRef('section-quick-summary')} className="scroll-mt-24 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"><div className="mb-3 flex items-center gap-2"><span className="material-icons text-[18px] text-emerald-300">bolt</span><h3 className="text-sm font-semibold text-emerald-100">Quick Summary</h3></div><div className="space-y-3">{renderSummaryBlocks(detail.tldr_md)}</div></section> : null}
                {detail.reporting_takeaways.length ? <section id="section-reporting-takeaways" ref={bindSectionRef('section-reporting-takeaways')} className="scroll-mt-24 space-y-3"><div className="flex items-center gap-2"><span className="material-icons text-[18px] text-cyan-300">assignment</span><h3 className="text-sm font-semibold text-white">Reporting takeaways</h3></div>{renderQuickList(detail.reporting_takeaways, 'cyan')}</section> : null}
                {detail.reporting_red_flags.length ? <section id="section-red-flags" ref={bindSectionRef('section-red-flags')} className="scroll-mt-24 space-y-3"><div className="flex items-center gap-2"><span className="material-icons text-[18px] text-amber-300">warning</span><h3 className="text-sm font-semibold text-white">Red flags</h3></div>{renderQuickList(detail.reporting_red_flags, 'amber')}</section> : null}
                {detail.suggested_report_phrases.length ? <section id="section-report-phrases" ref={bindSectionRef('section-report-phrases')} className="scroll-mt-24 space-y-3"><div className="flex items-center gap-2"><span className="material-icons text-[18px] text-emerald-300">edit_note</span><h3 className="text-sm font-semibold text-white">Suggested report phrases</h3></div>{renderQuickList(detail.suggested_report_phrases, 'emerald')}</section> : null}
                <section id="section-rich-summary" ref={bindSectionRef('section-rich-summary')} className="scroll-mt-24 rounded-2xl border border-white/8 bg-white/[0.03] p-4"><div className="mb-3 flex items-center gap-2"><span className="material-icons text-[18px] text-cyan-300">article</span><h3 className="text-sm font-semibold text-white">Rich summary</h3></div><div className="space-y-3">{renderSummaryBlocks(detail.rich_summary_md)}</div></section>
                <div id="section-checklist" ref={bindSectionRef('section-checklist')} className="scroll-mt-24">
                  <ChecklistSection items={detail.checklist_items} />
                </div>
                {detail.parse_notes ? <section id="section-notes" ref={bindSectionRef('section-notes')} className="scroll-mt-24 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4"><div className="mb-2 flex items-center gap-2"><span className="material-icons text-[18px] text-amber-300">info</span><h3 className="text-sm font-semibold text-amber-100">Notes / caveats</h3></div><p className="text-sm leading-6 text-amber-50/85">{detail.parse_notes}</p></section> : null}
              </div>
            )
          ) : <EmptyState compact icon="fact_check" title="Select a pathology" description="Choose a search result to view the latest published checklist and summary." />}
        </section>

        <section className="rounded-3xl border border-white/8 bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Suggest a topic or file</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Request a pathology topic, PDF source, or guideline update you want added to the checklist library.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-300">Request type</span>
                <select value={requestForm.request_type} onChange={(event) => setRequestForm((prev) => ({ ...prev, request_type: event.target.value as PathologyGuidelineRequestType }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35">
                  <option value="topic">Topic suggestion</option>
                  <option value="pdf_source">PDF source suggestion</option>
                  <option value="guideline_update">Guideline update</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-300">Title</span>
                <input value={requestForm.title} onChange={(event) => setRequestForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Ex: Pediatric intussusception imaging checklist" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Source URL</span>
              <input value={requestForm.source_url} onChange={(event) => setRequestForm((prev) => ({ ...prev, source_url: event.target.value }))} placeholder="Optional PDF or source link" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Why should this be added?</span>
              <textarea value={requestForm.description} onChange={(event) => setRequestForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="Optional context, clinical use case, or why the file would help residents." className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSubmitRequest} disabled={isSubmittingRequest} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSubmittingRequest ? 'Submitting...' : 'Submit request'}</button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{canEdit ? 'Request queue' : 'Your requests'}</h3>
              {isLoadingRequests ? (
                <LoadingState compact title="Loading requests..." />
              ) : requests.length ? (
                requests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">{getRequestTypeLabel(request.request_type)}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getRequestStatusLabel(request.status)}</span>
                          <span className="text-xs text-slate-500">{formatDateLabel(request.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">{request.title}</p>
                        {request.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{request.description}</p> : null}
                        {request.source_url ? <a href={request.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-cyan-200 hover:text-cyan-100">Open suggested source</a> : null}
                        {!canEdit && request.review_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{request.review_notes}</p> : null}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="mt-3 space-y-3 border-t border-white/8 pt-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-slate-300">Status</span>
                            <select value={requestStatusDrafts[request.id] || request.status} onChange={(event) => setRequestStatusDrafts((prev) => ({ ...prev, [request.id]: event.target.value as PathologyGuidelineRequestStatus }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35">
                              <option value="pending">Pending</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                              <option value="completed">Completed</option>
                            </select>
                          </label>
                        </div>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-300">Review notes</span>
                          <textarea value={requestNotesDrafts[request.id] || ''} onChange={(event) => setRequestNotesDrafts((prev) => ({ ...prev, [request.id]: event.target.value }))} rows={3} placeholder="Optional editor notes for triage or feedback." className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
                        </label>
                        <button onClick={() => handleUpdateRequest(request.id)} disabled={updatingRequestId === request.id} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">{updatingRequestId === request.id ? 'Saving...' : 'Save review'}</button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState compact icon="forum" title="No requests yet" description={canEdit ? 'User suggestions and editor notes will appear here.' : 'Submit a topic or file request and it will appear here for tracking.'} />
              )}
            </div>
          </div>
        </section>

        {(canEdit || isRoleLoading) && (
          <section className="mb-24 rounded-3xl border border-fuchsia-500/15 bg-fuchsia-950/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-bold uppercase tracking-[0.22em] text-fuchsia-200">Editor controls</h2><p className="mt-1 text-xs text-slate-400">Upload a checklist JSON file to autofill the source and create a publish-ready draft. Source links can be added later.</p></div>
              {!isRoleLoading && canEdit ? <div className="flex gap-2"><button onClick={() => setIsAdminPanelOpen((value) => !value)} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15">{isAdminPanelOpen ? 'Hide' : 'Manage'}</button><button onClick={resetAdminForm} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10">New source</button></div> : null}
            </div>
            {isRoleLoading ? <LoadingState compact title="Checking permissions..." /> : canEdit && isAdminPanelOpen ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Pathology name</span><input value={form.pathology_name} onChange={(event) => setForm((prev) => ({ ...prev, pathology_name: event.target.value, slug: prev.slug || makeSlug(event.target.value) }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Slug</span><input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Specialty</span><input value={form.specialty} onChange={(event) => setForm((prev) => ({ ...prev, specialty: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Issuing body</span><input value={form.issuing_body} onChange={(event) => setForm((prev) => ({ ...prev, issuing_body: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                </div>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Source title</span><input value={form.source_title} onChange={(event) => setForm((prev) => ({ ...prev, source_title: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Source kind</span><select value={form.source_kind} onChange={(event) => setForm((prev) => ({ ...prev, source_kind: event.target.value as PathologyGuidelineSourceKind }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35"><option value="pdf">PDF</option><option value="external">External</option><option value="google_drive">Google Drive</option></select></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">PDF / Source URL</span><input value={form.source_url} onChange={(event) => setForm((prev) => ({ ...prev, source_url: event.target.value }))} placeholder="Optional for now - add https://example.com/guideline.pdf later" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label>
                </div>
                {form.source_kind === 'google_drive' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Google Drive URL</span><input value={form.google_drive_url} onChange={(event) => setForm((prev) => ({ ...prev, google_drive_url: event.target.value }))} placeholder="Optional for now - add https://docs.google.com/document/d/... later" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Google Drive file id</span><input value={form.google_drive_file_id} onChange={(event) => setForm((prev) => ({ ...prev, google_drive_file_id: event.target.value }))} placeholder="Optional unless you want Drive sync now" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label></div>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Synonyms</span><input value={form.synonyms} onChange={(event) => setForm((prev) => ({ ...prev, synonyms: event.target.value }))} placeholder="appendiceal abscess, perforated appendicitis" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-300">Keywords</span><input value={form.keywords} onChange={(event) => setForm((prev) => ({ ...prev, keywords: event.target.value }))} placeholder="abdomen, inflammatory, emergency" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" /></label></div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Source is active</label>
                <div className="flex flex-wrap gap-2"><button onClick={handleSaveSource} disabled={isSavingSource} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSavingSource ? 'Saving...' : 'Save source'}</button>{form.source_kind === 'google_drive' ? <button onClick={handleSync} disabled={isSyncing || !canSyncFromDrive} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60">{isSyncing ? 'Syncing...' : 'Sync from Drive'}</button> : null}</div>
                <div className="space-y-3 rounded-2xl border border-cyan-500/15 bg-cyan-950/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Import checklist JSON</h3>
                      <p className="mt-1 text-xs text-slate-400">Use JSON generated from a radiographic PDF. Upload autofills the source metadata and saves a draft. Add the PDF or Drive link later if needed.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setImportMode('paste')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${importMode === 'paste' ? 'bg-cyan-500/15 text-cyan-100 border border-cyan-400/20' : 'bg-white/5 text-slate-300 border border-white/10'}`}>Paste</button>
                      <button onClick={() => setImportMode('upload')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${importMode === 'upload' ? 'bg-cyan-500/15 text-cyan-100 border border-cyan-400/20' : 'bg-white/5 text-slate-300 border border-white/10'}`}>Upload</button>
                    </div>
                  </div>
                  {importMode === 'upload' && (
                    <div className="space-y-2">
                      <input type="file" accept=".json,application/json" onChange={handleImportFile} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-cyan-100" />
                      {importFileName ? <p className="text-xs text-slate-400">Loaded: {importFileName}</p> : null}
                    </div>
                  )}
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-300">Checklist JSON</span>
                    <textarea value={rawImportJson} onChange={(event) => { setRawImportJson(event.target.value); setValidatedImportPayload(null); setImportValidationErrors([]); setImportWarnings([]); }} rows={8} placeholder='{"pathology_name":"Appendicitis","rich_summary_md":"...","checklist_items":[...]}' className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400/35" />
                  </label>
                  {!!importValidationErrors.length && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-200">Import errors</p>
                      <div className="mt-2 space-y-1 text-xs text-rose-100/90">{importValidationErrors.map((error) => <p key={error}>{error}</p>)}</div>
                    </div>
                  )}
                  {!!importWarnings.length && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Review before importing</p>
                      <div className="mt-2 space-y-1 text-xs text-amber-100/90">{importWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
                    </div>
                  )}
                  {validatedImportPayload && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
                      <p className="font-semibold text-white">{validatedImportPayload.pathology_name}</p>
                      <p className="mt-1">{validatedImportPayload.source_title || 'Untitled source'}{validatedImportPayload.issuing_body ? ` • ${validatedImportPayload.issuing_body}` : ''}</p>
                      {validatedImportPayload.slug || validatedImportPayload.filename ? <p className="mt-1 text-slate-400">{validatedImportPayload.slug || 'No slug'}{validatedImportPayload.filename ? ` • ${validatedImportPayload.filename}` : ''}</p> : null}
                      {validatedImportPayload.tldr_md ? <p className="mt-2 line-clamp-3 text-slate-300">{validatedImportPayload.tldr_md}</p> : null}
                      <p className="mt-1">{validatedImportPayload.checklist_items.length} checklist items • {validatedImportPayload.reporting_takeaways?.length || 0} takeaways • {validatedImportPayload.suggested_report_phrases?.length || 0} report phrases</p>
                    </div>
                  )}
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
                          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${version.sync_status === 'published' ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : version.sync_status === 'failed' ? 'border border-rose-400/20 bg-rose-500/10 text-rose-100' : 'border border-amber-400/20 bg-amber-500/10 text-amber-100'}`}>{version.sync_status}</span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getOriginLabel(version.origin)}</span><span className="text-xs text-slate-500">{formatDateLabel(version.synced_at)}</span></div>
                          <p className="mt-2 text-sm font-semibold text-white">{version.source_title || 'Untitled version'}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{version.tldr_md || version.rich_summary_md || 'No summary parsed.'}</p>
                        </div>
                        {version.sync_status !== 'published' ? <button onClick={() => handlePublish(version.id)} disabled={publishingVersionId === version.id} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">{publishingVersionId === version.id ? 'Publishing...' : 'Publish'}</button> : null}
                      </div>
                      {version.parse_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{version.parse_notes}</p> : null}
                    </div>
                  )) : <EmptyState compact icon="cloud_sync" title={sourceRecord?.id && form.source_kind === 'pdf' ? 'No checklist drafts yet for this source' : 'No synced versions yet'} description={sourceRecord?.id && form.source_kind === 'pdf' ? 'Import JSON to create the first draft.' : 'After you import, edit, or sync a guideline, versions will appear here.'} />}
                  {!!draftVersions.length && <p className="text-xs leading-5 text-slate-500">Drafts stay hidden from readers until published. Failed syncs remain visible here for review.</p>}
                </div>
              </div>
            ) : <p className="mt-3 text-sm text-slate-500">Privileged editor tools are hidden for your account.</p>}
          </section>
        )}
      </div>
    </div>
  );
};

export default PathologyChecklistScreen;
