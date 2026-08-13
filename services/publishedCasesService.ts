import { PatientRecord } from '../types';
import { supabase } from './supabase';
import { fetchWithCache } from '../utils/requestCache';
import type { CaseViberShareStatusRecord } from './caseViberShareService';

export interface PublishedCasesBundle {
  rawCases: any[];
  records: PatientRecord[];
}

let publishedCasesBundleCache: PublishedCasesBundle | null = null;
let publishedCasesBundlePromise: Promise<PublishedCasesBundle> | null = null;

const buildPublishedCaseRecord = (item: any, authorMap: Map<string, string>): PatientRecord => {
  const submissionType = item.submission_type || 'interesting_case';
  const impressionTitle = submissionType === 'aunt_minnie'
    ? (
      item.findings ||
      item.title ||
      item.analysis_result?.impression ||
      item.diagnosis ||
      'Aunt Minnie'
    )
    : submissionType === 'rare_pathology'
      ? (
        item.title ||
        item.analysis_result?.impression ||
        item.diagnosis ||
        'Rare Pathology'
      )
      : (
        item.title ||
        item.analysis_result?.impression ||
        item.diagnosis ||
        'Interesting Case'
      );

  return {
    id: item.id,
    name: String(impressionTitle).toUpperCase(),
    initials: item.patient_initials || '??',
    age: parseInt(item.patient_age, 10) || 0,
    date: item.created_at,
    specialty: item.organ_system || '',
    modality: item.modality || '',
    // Patient identifiers are intentionally excluded from public list/search metadata.
    // Authenticated users can still see the PACS Patient ID inside the case detail view.
    diagnosticCode: item.diagnosis || 'Pending',
    status: 'Published',
    submission_type: submissionType,
    radiologic_clinchers: item.radiologic_clinchers || '',
    author: item.created_by ? authorMap.get(item.created_by) || 'Hospital Staff' : 'Hospital Staff',
    viber_shared_at: item.viber_shared_at ? String(item.viber_shared_at) : null,
    viber_shared_by: item.viber_shared_by ? String(item.viber_shared_by) : null,
    viber_shared_by_name: item.viber_shared_by_name ? String(item.viber_shared_by_name) : null,
  };
};

export const fetchPublishedCasesBundle = async (): Promise<PublishedCasesBundle> => {
  if (publishedCasesBundleCache) {
    return publishedCasesBundleCache;
  }

  if (publishedCasesBundlePromise) {
    return publishedCasesBundlePromise;
  }

  publishedCasesBundlePromise = (async () => {
  const rawCases = await fetchWithCache(
    'published-cases:list',
    async () => {
      const { data, error } = await supabase.rpc('list_published_cases_for_viewer');

      if (error) throw error;
      return data || [];
    },
    { ttlMs: 20_000, allowStaleWhileRevalidate: true },
  );

  const profileIds = Array.from(
    new Set(
      (rawCases || [])
        .flatMap((item: any) => [item.created_by, item.viber_shared_by])
        .filter(Boolean),
    ),
  );
  let profileMap = new Map<string, string>();

  if (profileIds.length > 0) {
    const profiles = await fetchWithCache(
      `published-cases:profiles:${profileIds.sort().join(',')}`,
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, nickname')
          .in('id', profileIds);

        if (error) throw error;
        return data || [];
      },
      { ttlMs: 60_000, allowStaleWhileRevalidate: true },
    );

    profileMap = new Map(
      profiles.map((profile: any) => [
        String(profile.id),
        String(profile.nickname || profile.full_name || 'Hospital Staff'),
      ]),
    );
  }

    const enrichedRawCases = rawCases.map((item: any) => ({
      ...item,
      viber_shared_by_name: item.viber_shared_by ? profileMap.get(String(item.viber_shared_by)) || 'Hospital Staff' : null,
    }));

    const bundle = {
      rawCases: enrichedRawCases,
      records: enrichedRawCases.map((item: any) => buildPublishedCaseRecord(item, profileMap)),
    };

    publishedCasesBundleCache = bundle;
    return bundle;
  })().finally(() => {
    publishedCasesBundlePromise = null;
  });

  return publishedCasesBundlePromise;
};

export const preloadPublishedCases = async (): Promise<void> => {
  await fetchPublishedCasesBundle();
};

export const getCachedPublishedCasesBundle = (): PublishedCasesBundle | null => publishedCasesBundleCache;

export const updatePublishedCasesViberShareCache = (status: CaseViberShareStatusRecord): void => {
  if (!publishedCasesBundleCache) return;

  publishedCasesBundleCache = {
    rawCases: publishedCasesBundleCache.rawCases.map((item: any) =>
      String(item?.id || '') === status.case_id
        ? {
            ...item,
            viber_shared_at: status.viber_shared_at,
            viber_shared_by: status.viber_shared_by,
            viber_shared_by_name: status.viber_shared_by_name,
          }
        : item,
    ),
    records: publishedCasesBundleCache.records.map((item) =>
      item.id === status.case_id
        ? {
            ...item,
            viber_shared_at: status.viber_shared_at,
            viber_shared_by: status.viber_shared_by,
            viber_shared_by_name: status.viber_shared_by_name,
          }
        : item,
    ),
  };
};
