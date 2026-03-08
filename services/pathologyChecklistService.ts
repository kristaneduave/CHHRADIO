import {
  EditableDraftPatch,
  PathologyGuidelineContentType,
  PathologyGuidelineImportPayload,
  PathologyChecklistItem,
  PathologyGuidelineDetail,
  PathologyGuidelineListItem,
  PathologyGuidelineSource,
  PathologyGuidelineSourceInput,
  PathologyGuidelineVersion,
} from '../types';
import { supabase } from './supabase';

const QUERY_SYNONYMS: Record<string, string[]> = {
  renal: ['kidney'],
  kidney: ['renal'],
  pulmonary: ['lung'],
  lung: ['pulmonary'],
  hepatic: ['liver'],
  liver: ['hepatic'],
  mass: ['lesion'],
  lesion: ['mass'],
};

const DEFAULT_TOPIC = 'General reporting pearls';

const normalizeTokens = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const uniqueStrings = (values?: string[] | null) =>
  Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean)));

const mapStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
};

const normalizeContentType = (value: unknown): PathologyGuidelineContentType => {
  if (value === 'guideline' || value === 'review') return value;
  return 'checklist';
};

const mapChecklistItems = (value: unknown): PathologyChecklistItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any, index) => ({
      id: String(item?.id || `item-${index + 1}`),
      label: String(item?.label || '').trim(),
      section: item?.section ? String(item.section) : null,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
      notes: item?.notes ? String(item.notes) : null,
    }))
    .filter((item) => item.label)
    .sort((left, right) => left.order - right.order);
};

const getPrimaryTopic = (row: any) => {
  const explicit = row.primary_topic ? String(row.primary_topic).trim() : '';
  const fallback = row.specialty ? String(row.specialty).trim() : '';
  return explicit || fallback || DEFAULT_TOPIC;
};

const mapListRow = (row: any): PathologyGuidelineListItem => ({
  guideline_id: String(row.guideline_id || row.id),
  slug: String(row.slug || ''),
  pathology_name: String(row.pathology_name || ''),
  specialty: row.specialty ? String(row.specialty) : null,
  synonyms: uniqueStrings(row.synonyms),
  keywords: uniqueStrings(row.keywords),
  source_title: row.source_title ? String(row.source_title) : null,
  issuing_body: row.issuing_body ? String(row.issuing_body) : null,
  version_label: row.version_label ? String(row.version_label) : null,
  effective_date: row.effective_date ? String(row.effective_date) : null,
  synced_at: row.synced_at ? String(row.synced_at) : null,
  published_at: row.published_at ? String(row.published_at) : null,
  source_kind: row.source_kind || 'google_drive',
  primary_topic: getPrimaryTopic(row),
  secondary_topics: uniqueStrings(row.secondary_topics),
  clinical_tags: uniqueStrings(row.clinical_tags),
  anatomy_terms: uniqueStrings(row.anatomy_terms),
  problem_terms: uniqueStrings(row.problem_terms),
  content_type: normalizeContentType(row.content_type),
  is_featured: Boolean(row.is_featured),
  search_priority: Math.max(0, Number(row.search_priority) || 0),
  related_guideline_slugs: uniqueStrings(row.related_guideline_slugs),
  match_reason: row.match_reason ? String(row.match_reason) : null,
  tldr_md: row.tldr_md ? String(row.tldr_md) : null,
});

const mapDetailRow = (row: any): PathologyGuidelineDetail => ({
  ...mapListRow(row),
  source_url: String(row.source_url || row.google_drive_url || ''),
  google_drive_url: String(row.google_drive_url || row.source_url || ''),
  tldr_md: String(row.tldr_md || ''),
  rich_summary_md: String(row.rich_summary_md || ''),
  reporting_takeaways: mapStringArray(row.reporting_takeaways),
  reporting_red_flags: mapStringArray(row.reporting_red_flags),
  suggested_report_phrases: mapStringArray(row.suggested_report_phrases),
  checklist_items: mapChecklistItems(row.checklist_items),
  parse_notes: row.parse_notes ? String(row.parse_notes) : null,
  raw_text_excerpt: row.raw_text_excerpt ? String(row.raw_text_excerpt) : null,
});

const mapVersionRow = (row: any): PathologyGuidelineVersion => ({
  id: String(row.id),
  guideline_id: String(row.guideline_id),
  version_label: row.version_label ? String(row.version_label) : null,
  effective_date: row.effective_date ? String(row.effective_date) : null,
  sync_status: row.sync_status,
  origin: row.origin || 'manual_edit',
  source_revision: row.source_revision ? String(row.source_revision) : null,
  source_title: row.source_title ? String(row.source_title) : null,
  issuing_body: row.issuing_body ? String(row.issuing_body) : null,
  source_url: String(row.source_url || ''),
  tldr_md: String(row.tldr_md || ''),
  rich_summary_md: String(row.rich_summary_md || ''),
  reporting_takeaways: mapStringArray(row.reporting_takeaways),
  reporting_red_flags: mapStringArray(row.reporting_red_flags),
  suggested_report_phrases: mapStringArray(row.suggested_report_phrases),
  checklist_items: mapChecklistItems(row.checklist_items),
  parse_notes: row.parse_notes ? String(row.parse_notes) : null,
  raw_text_excerpt: row.raw_text_excerpt ? String(row.raw_text_excerpt) : null,
  synced_at: String(row.synced_at),
  published_at: row.published_at ? String(row.published_at) : null,
});

const buildSourceDefaults = (input: PathologyGuidelineSourceInput) => {
  const sourceKind = input.source_kind || 'pdf';
  const sourceUrl = input.source_url?.trim() || (sourceKind === 'google_drive' ? input.google_drive_url.trim() : '');
  const googleDriveUrl = sourceKind === 'google_drive' ? (input.google_drive_url.trim() || sourceUrl) : '';
  const googleDriveFileId = sourceKind === 'google_drive' ? input.google_drive_file_id.trim() : '';

  return {
    source_kind: sourceKind,
    source_url: sourceUrl,
    google_drive_url: googleDriveUrl,
    google_drive_file_id: googleDriveFileId,
  };
};

const expandQueryTokens = (tokens: string[]) =>
  Array.from(
    new Set(
      tokens.flatMap((token) => [token, ...(QUERY_SYNONYMS[token] || [])]),
    ),
  );

const getSearchFields = (item: PathologyGuidelineListItem) => ({
  pathologyName: item.pathology_name.toLowerCase(),
  synonyms: item.synonyms.map((entry) => entry.toLowerCase()),
  anatomyTerms: item.anatomy_terms.map((entry) => entry.toLowerCase()),
  problemTerms: item.problem_terms.map((entry) => entry.toLowerCase()),
  clinicalTags: item.clinical_tags.map((entry) => entry.toLowerCase()),
  keywords: item.keywords.map((entry) => entry.toLowerCase()),
  secondaryTopics: item.secondary_topics.map((entry) => entry.toLowerCase()),
  sourceTitle: (item.source_title || '').toLowerCase(),
  issuingBody: (item.issuing_body || '').toLowerCase(),
  specialty: (item.specialty || '').toLowerCase(),
  primaryTopic: (item.primary_topic || '').toLowerCase(),
});

const formatMatchReason = (label: string, value?: string | null) =>
  value ? `${label}: ${value}` : label;

const scoreGuideline = (item: PathologyGuidelineListItem, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return {
      score: item.search_priority,
      matchReason: null,
    };
  }

  const fields = getSearchFields(item);
  const exactSynonym = fields.synonyms.find((entry) => entry === normalizedQuery);
  const exactClinicalTag = fields.clinicalTags.find((entry) => entry === normalizedQuery);
  const queryTokens = expandQueryTokens(normalizeTokens(normalizedQuery));
  const anatomyHit = queryTokens.find((token) => fields.anatomyTerms.includes(token));
  const problemHit = queryTokens.find((token) => fields.problemTerms.includes(token));
  const supportHaystacks = [
    ...fields.keywords,
    ...fields.secondaryTopics,
    fields.sourceTitle,
    fields.issuingBody,
    fields.specialty,
    fields.primaryTopic,
  ].filter(Boolean);

  let score = item.search_priority * 5;
  let matchReason: string | null = null;

  if (fields.pathologyName === normalizedQuery) {
    return { score: 1000 + score, matchReason: formatMatchReason('Matched pathology', item.pathology_name) };
  }

  if (fields.pathologyName.startsWith(normalizedQuery)) {
    score += 800;
    matchReason = matchReason || formatMatchReason('Starts with pathology', item.pathology_name);
  } else if (exactSynonym) {
    score += 750;
    matchReason = matchReason || formatMatchReason('Matched synonym', exactSynonym);
  }

  if (anatomyHit && problemHit) {
    score += 700;
    matchReason = matchReason || formatMatchReason('Matched anatomy and problem', `${anatomyHit} + ${problemHit}`);
  }

  if (exactClinicalTag) {
    score += 650;
    matchReason = matchReason || formatMatchReason('Matched tag', exactClinicalTag);
  }

  if (fields.pathologyName.includes(normalizedQuery)) {
    score += 500;
    matchReason = matchReason || formatMatchReason('Matched pathology', item.pathology_name);
  }

  const weightedArrays = [
    { values: fields.synonyms, exactWeight: 90, partialWeight: 40, label: 'Matched synonym' },
    { values: fields.anatomyTerms, exactWeight: 90, partialWeight: 40, label: 'Matched anatomy' },
    { values: fields.problemTerms, exactWeight: 90, partialWeight: 40, label: 'Matched problem' },
    { values: fields.clinicalTags, exactWeight: 75, partialWeight: 30, label: 'Matched tag' },
    { values: fields.keywords, exactWeight: 55, partialWeight: 25, label: 'Matched keyword' },
  ];

  queryTokens.forEach((token) => {
    weightedArrays.forEach(({ values, exactWeight, partialWeight, label }) => {
      if (values.includes(token)) {
        score += exactWeight;
        matchReason = matchReason || formatMatchReason(label, token);
      } else if (values.some((entry) => entry.includes(token))) {
        score += partialWeight;
        matchReason = matchReason || formatMatchReason(label, token);
      }
    });

    supportHaystacks.forEach((value) => {
      if (value === token) {
        score += 20;
        matchReason = matchReason || formatMatchReason('Matched source metadata', token);
      } else if (value.includes(token)) {
        score += 10;
        matchReason = matchReason || formatMatchReason('Matched source metadata', token);
      }
    });
  });

  return {
    score,
    matchReason,
  };
};

export const extractGoogleDriveFileId = (url: string) => {
  const trimmed = url.trim();
  const matchers = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/,
  ];

  for (const matcher of matchers) {
    const match = trimmed.match(matcher);
    if (match?.[1]) return match[1];
  }

  return '';
};

export const getCurrentPathologyGuidelines = async (): Promise<PathologyGuidelineListItem[]> => {
  const primaryQuery = await supabase
    .from('pathology_guideline_current')
    .select('guideline_id,slug,pathology_name,specialty,synonyms,keywords,primary_topic,secondary_topics,clinical_tags,anatomy_terms,problem_terms,content_type,is_featured,search_priority,related_guideline_slugs,source_title,issuing_body,version_label,effective_date,synced_at,published_at,source_kind,tldr_md')
    .order('pathology_name', { ascending: true });

  if (!primaryQuery.error) {
    return (primaryQuery.data || []).map(mapListRow);
  }

  const fallbackQuery = await supabase
    .from('pathology_guideline_current')
    .select('guideline_id,slug,pathology_name,specialty,synonyms,keywords,source_title,issuing_body,version_label,effective_date,synced_at,published_at,source_kind,tldr_md')
    .order('pathology_name', { ascending: true });

  if (fallbackQuery.error) throw fallbackQuery.error;
  return (fallbackQuery.data || []).map(mapListRow);
};

export const searchPathologyGuidelines = async (query: string): Promise<PathologyGuidelineListItem[]> => {
  const guidelines = await getCurrentPathologyGuidelines();
  const trimmed = query.trim();

  if (!trimmed) {
    return guidelines
      .sort((left, right) => {
        const featuredOrder = Number(right.is_featured) - Number(left.is_featured);
        if (featuredOrder !== 0) return featuredOrder;
        const priorityOrder = right.search_priority - left.search_priority;
        if (priorityOrder !== 0) return priorityOrder;
        return left.pathology_name.localeCompare(right.pathology_name);
      });
  }

  return guidelines
    .map((item) => {
      const { score, matchReason } = scoreGuideline(item, trimmed);
      return { ...item, score, match_reason: matchReason };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.pathology_name.localeCompare(right.pathology_name);
    })
    .map(({ score: _score, ...item }) => item);
};

export const getRadioGraphicsTopicHubs = async () => {
  const guidelines = await getCurrentPathologyGuidelines();
  const grouped = guidelines.reduce<Record<string, PathologyGuidelineListItem[]>>((acc, item) => {
    const key = item.primary_topic || DEFAULT_TOPIC;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([topic, items]) => {
      const sortedItems = [...items].sort((left, right) => {
        const featuredOrder = Number(right.is_featured) - Number(left.is_featured);
        if (featuredOrder !== 0) return featuredOrder;
        const priorityOrder = right.search_priority - left.search_priority;
        if (priorityOrder !== 0) return priorityOrder;
        return left.pathology_name.localeCompare(right.pathology_name);
      });

      const tags = Array.from(
        new Set(sortedItems.flatMap((item) => [...item.clinical_tags, ...item.problem_terms]).filter(Boolean)),
      ).slice(0, 4);

      return {
        id: topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        topic,
        count: sortedItems.length,
        tags,
        featuredItems: sortedItems.slice(0, 3),
      };
    })
    .sort((left, right) => left.topic.localeCompare(right.topic));
};

export const getFeaturedPathologyGuidelines = async (): Promise<PathologyGuidelineListItem[]> => {
  const guidelines = await getCurrentPathologyGuidelines();
  return guidelines
    .filter((item) => item.is_featured)
    .sort((left, right) => {
      const priorityOrder = right.search_priority - left.search_priority;
      if (priorityOrder !== 0) return priorityOrder;
      return left.pathology_name.localeCompare(right.pathology_name);
    });
};

export const getRelatedPathologyGuidelines = async (current: PathologyGuidelineDetail): Promise<PathologyGuidelineListItem[]> => {
  const guidelines = await getCurrentPathologyGuidelines();
  const candidates = guidelines.filter((item) => item.guideline_id !== current.guideline_id);

  const explicit = candidates.filter((item) => current.related_guideline_slugs.includes(item.slug));
  if (explicit.length) {
    return explicit.slice(0, 6);
  }

  const currentTerms = new Set([
    current.primary_topic,
    ...current.secondary_topics,
    ...current.clinical_tags,
    ...current.anatomy_terms,
    ...current.problem_terms,
  ].map((entry) => entry.toLowerCase()).filter(Boolean));

  return candidates
    .map((item) => {
      const comparableTerms = [
        item.primary_topic,
        ...item.secondary_topics,
        ...item.clinical_tags,
        ...item.anatomy_terms,
        ...item.problem_terms,
      ].map((entry) => entry.toLowerCase());
      const overlap = comparableTerms.filter((entry) => currentTerms.has(entry)).length;
      return { item, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((left, right) => {
      if (right.overlap !== left.overlap) return right.overlap - left.overlap;
      if (right.item.search_priority !== left.item.search_priority) {
        return right.item.search_priority - left.item.search_priority;
      }
      return left.item.pathology_name.localeCompare(right.item.pathology_name);
    })
    .slice(0, 6)
    .map((entry) => entry.item);
};

export const getPathologyGuidelineDetail = async (slug: string): Promise<PathologyGuidelineDetail | null> => {
  const { data, error } = await supabase
    .from('pathology_guideline_current')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDetailRow(data) : null;
};

export const createPathologyGuidelineSource = async (input: PathologyGuidelineSourceInput): Promise<{ id: string }> => {
  const sourceDefaults = buildSourceDefaults(input);
  const payload = {
    slug: input.slug.trim(),
    pathology_name: input.pathology_name.trim(),
    specialty: input.specialty?.trim() || null,
    synonyms: uniqueStrings(input.synonyms),
    keywords: uniqueStrings(input.keywords),
    primary_topic: input.primary_topic?.trim() || null,
    secondary_topics: uniqueStrings(input.secondary_topics),
    clinical_tags: uniqueStrings(input.clinical_tags),
    anatomy_terms: uniqueStrings(input.anatomy_terms),
    problem_terms: uniqueStrings(input.problem_terms),
    content_type: input.content_type || 'checklist',
    is_featured: Boolean(input.is_featured),
    search_priority: Math.max(0, Number(input.search_priority) || 0),
    related_guideline_slugs: uniqueStrings(input.related_guideline_slugs),
    ...sourceDefaults,
    source_title: input.source_title?.trim() || null,
    issuing_body: input.issuing_body?.trim() || null,
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('pathology_guidelines')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return { id: String(data.id) };
};

export const getPathologyGuidelineSource = async (id: string): Promise<PathologyGuidelineSource | null> => {
  const { data, error } = await supabase
    .from('pathology_guidelines')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    slug: String(data.slug || ''),
    pathology_name: String(data.pathology_name || ''),
    specialty: data.specialty ? String(data.specialty) : null,
    synonyms: uniqueStrings(data.synonyms),
    keywords: uniqueStrings(data.keywords),
    source_url: String(data.source_url || data.google_drive_url || ''),
    source_kind: data.source_kind || 'pdf',
    google_drive_url: String(data.google_drive_url || ''),
    google_drive_file_id: String(data.google_drive_file_id || ''),
    source_title: data.source_title ? String(data.source_title) : null,
    issuing_body: data.issuing_body ? String(data.issuing_body) : null,
    is_active: Boolean(data.is_active ?? true),
    primary_topic: data.primary_topic ? String(data.primary_topic) : null,
    secondary_topics: uniqueStrings(data.secondary_topics),
    clinical_tags: uniqueStrings(data.clinical_tags),
    anatomy_terms: uniqueStrings(data.anatomy_terms),
    problem_terms: uniqueStrings(data.problem_terms),
    content_type: normalizeContentType(data.content_type),
    is_featured: Boolean(data.is_featured),
    search_priority: Math.max(0, Number(data.search_priority) || 0),
    related_guideline_slugs: uniqueStrings(data.related_guideline_slugs),
    created_at: data.created_at ? String(data.created_at) : undefined,
    updated_at: data.updated_at ? String(data.updated_at) : undefined,
  };
};

export const updatePathologyGuidelineSource = async (
  id: string,
  patch: Partial<PathologyGuidelineSourceInput>,
): Promise<void> => {
  const payload: Record<string, unknown> = {};
  const mergedSourceDefaults = buildSourceDefaults({
    slug: '',
    pathology_name: '',
    source_url: patch.source_url || patch.google_drive_url || '',
    source_kind: patch.source_kind || 'pdf',
    google_drive_url: patch.google_drive_url || patch.source_url || '',
    google_drive_file_id: patch.google_drive_file_id || '',
  } as PathologyGuidelineSourceInput);
  if (typeof patch.slug === 'string') payload.slug = patch.slug.trim();
  if (typeof patch.pathology_name === 'string') payload.pathology_name = patch.pathology_name.trim();
  if (typeof patch.specialty === 'string' || patch.specialty === null) payload.specialty = patch.specialty?.trim() || null;
  if (Array.isArray(patch.synonyms)) payload.synonyms = uniqueStrings(patch.synonyms);
  if (Array.isArray(patch.keywords)) payload.keywords = uniqueStrings(patch.keywords);
  if (typeof patch.primary_topic === 'string' || patch.primary_topic === null) payload.primary_topic = patch.primary_topic?.trim() || null;
  if (Array.isArray(patch.secondary_topics)) payload.secondary_topics = uniqueStrings(patch.secondary_topics);
  if (Array.isArray(patch.clinical_tags)) payload.clinical_tags = uniqueStrings(patch.clinical_tags);
  if (Array.isArray(patch.anatomy_terms)) payload.anatomy_terms = uniqueStrings(patch.anatomy_terms);
  if (Array.isArray(patch.problem_terms)) payload.problem_terms = uniqueStrings(patch.problem_terms);
  if (typeof patch.content_type === 'string') payload.content_type = normalizeContentType(patch.content_type);
  if (typeof patch.is_featured === 'boolean') payload.is_featured = patch.is_featured;
  if (typeof patch.search_priority === 'number') payload.search_priority = Math.max(0, Math.trunc(patch.search_priority));
  if (Array.isArray(patch.related_guideline_slugs)) payload.related_guideline_slugs = uniqueStrings(patch.related_guideline_slugs);
  if (typeof patch.source_url === 'string' || typeof patch.google_drive_url === 'string') payload.source_url = mergedSourceDefaults.source_url;
  if (typeof patch.source_kind === 'string') payload.source_kind = mergedSourceDefaults.source_kind;
  if (typeof patch.google_drive_url === 'string' || typeof patch.source_kind === 'string') payload.google_drive_url = mergedSourceDefaults.google_drive_url;
  if (typeof patch.google_drive_file_id === 'string' || typeof patch.source_kind === 'string') payload.google_drive_file_id = mergedSourceDefaults.google_drive_file_id;
  if (typeof patch.source_title === 'string' || patch.source_title === null) payload.source_title = patch.source_title?.trim() || null;
  if (typeof patch.issuing_body === 'string' || patch.issuing_body === null) payload.issuing_body = patch.issuing_body?.trim() || null;
  if (typeof patch.is_active === 'boolean') payload.is_active = patch.is_active;

  const { error } = await supabase.from('pathology_guidelines').update(payload).eq('id', id);
  if (error) throw error;
};

export const syncPathologyGuideline = async (guidelineId: string) => {
  const { data, error } = await supabase.functions.invoke('sync-pathology-guideline', {
    body: { guidelineId, publishAfterSync: false },
  });

  if (error) throw error;
  return data as {
    versionId: string;
    status: 'draft' | 'failed' | 'published';
    pathologyName: string;
    sourceTitle: string | null;
    effectiveDate: string | null;
    richSummary: string;
    checklistItems: PathologyChecklistItem[];
    parseNotes?: string | null;
  };
};

export const getLatestEditableDraft = async (guidelineId: string): Promise<PathologyGuidelineVersion | null> => {
  const { data, error } = await supabase
    .from('pathology_guideline_versions')
    .select('*')
    .eq('guideline_id', guidelineId)
    .eq('sync_status', 'draft')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapVersionRow(data) : null;
};

export const createPathologyGuidelineDraftFromCurrent = async (guidelineId: string): Promise<PathologyGuidelineVersion> => {
  const existingDraft = await getLatestEditableDraft(guidelineId);
  if (existingDraft) return existingDraft;

  const source = await getPathologyGuidelineSource(guidelineId);
  if (!source) {
    throw new Error('Guideline source not found.');
  }

  const { data: latestVersion, error: latestError } = await supabase
    .from('pathology_guideline_versions')
    .select('*')
    .eq('guideline_id', guidelineId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;

  const insertPayload = latestVersion
    ? {
        guideline_id: guidelineId,
        version_label: latestVersion.version_label,
        effective_date: latestVersion.effective_date,
        sync_status: 'draft',
        origin: 'draft_clone',
        source_revision: latestVersion.source_revision,
        source_title: latestVersion.source_title,
        issuing_body: latestVersion.issuing_body,
        source_url: latestVersion.source_url || source.source_url,
        tldr_md: latestVersion.tldr_md || '',
        rich_summary_md: latestVersion.rich_summary_md || '',
        reporting_takeaways: latestVersion.reporting_takeaways || [],
        reporting_red_flags: latestVersion.reporting_red_flags || [],
        suggested_report_phrases: latestVersion.suggested_report_phrases || [],
        checklist_items: latestVersion.checklist_items || [],
        parse_notes: latestVersion.parse_notes,
        raw_text_excerpt: latestVersion.raw_text_excerpt,
      }
    : {
        guideline_id: guidelineId,
        sync_status: 'draft',
        origin: 'manual_edit',
        source_url: source.source_url,
        source_title: source.source_title,
        issuing_body: source.issuing_body,
        tldr_md: '',
        rich_summary_md: '',
        reporting_takeaways: [],
        reporting_red_flags: [],
        suggested_report_phrases: [],
        checklist_items: [],
        parse_notes: null,
      };

  const { data, error } = await supabase
    .from('pathology_guideline_versions')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;
  return mapVersionRow(data);
};

export const updatePathologyGuidelineDraft = async (versionId: string, patch: EditableDraftPatch): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (typeof patch.version_label === 'string' || patch.version_label === null) payload.version_label = patch.version_label?.trim() || null;
  if (typeof patch.effective_date === 'string' || patch.effective_date === null) payload.effective_date = patch.effective_date?.trim() || null;
  if (typeof patch.source_title === 'string' || patch.source_title === null) payload.source_title = patch.source_title?.trim() || null;
  if (typeof patch.issuing_body === 'string' || patch.issuing_body === null) payload.issuing_body = patch.issuing_body?.trim() || null;
  if (typeof patch.tldr_md === 'string') payload.tldr_md = patch.tldr_md.trim();
  if (typeof patch.rich_summary_md === 'string') payload.rich_summary_md = patch.rich_summary_md.trim();
  if (Array.isArray(patch.reporting_takeaways)) payload.reporting_takeaways = patch.reporting_takeaways;
  if (Array.isArray(patch.reporting_red_flags)) payload.reporting_red_flags = patch.reporting_red_flags;
  if (Array.isArray(patch.suggested_report_phrases)) payload.suggested_report_phrases = patch.suggested_report_phrases;
  if (Array.isArray(patch.checklist_items)) payload.checklist_items = patch.checklist_items;
  if (typeof patch.parse_notes === 'string' || patch.parse_notes === null) payload.parse_notes = patch.parse_notes?.trim() || null;

  const { error } = await supabase
    .from('pathology_guideline_versions')
    .update(payload)
    .eq('id', versionId)
    .eq('sync_status', 'draft');

  if (error) throw error;
};

export const importPathologyGuidelineVersion = async (
  guidelineId: string,
  payload: PathologyGuidelineImportPayload,
): Promise<PathologyGuidelineVersion> => {
  const source = await getPathologyGuidelineSource(guidelineId);
  if (!source) {
    throw new Error('Guideline source not found.');
  }

  const insertPayload = {
    guideline_id: guidelineId,
    sync_status: 'draft',
    origin: source.source_kind === 'google_drive' ? 'manual_edit' : 'pdf_json_import',
    source_url: source.source_url,
    version_label: payload.version_label?.trim() || null,
    effective_date: payload.effective_date?.trim() || null,
    source_title: payload.source_title?.trim() || null,
    issuing_body: payload.issuing_body?.trim() || null,
    tldr_md: payload.tldr_md?.trim() || payload.rich_summary_md.trim(),
    rich_summary_md: payload.rich_summary_md.trim(),
    reporting_takeaways: mapStringArray(payload.reporting_takeaways),
    reporting_red_flags: mapStringArray(payload.reporting_red_flags),
    suggested_report_phrases: mapStringArray(payload.suggested_report_phrases),
    checklist_items: payload.checklist_items,
    parse_notes: payload.parse_notes?.trim() || null,
    raw_text_excerpt: null,
  };

  const { data, error } = await supabase
    .from('pathology_guideline_versions')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;
  return mapVersionRow(data);
};

export const publishPathologyGuidelineVersion = async (versionId: string): Promise<void> => {
  const { error } = await supabase.rpc('publish_pathology_guideline_version', { p_version_id: versionId });
  if (error) throw error;
};

export const getGuidelineDraftVersions = async (guidelineId: string): Promise<PathologyGuidelineVersion[]> => {
  const { data, error } = await supabase
    .from('pathology_guideline_versions')
    .select('*')
    .eq('guideline_id', guidelineId)
    .in('sync_status', ['draft', 'failed', 'published'])
    .order('synced_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapVersionRow);
};
