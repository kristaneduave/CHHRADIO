import { PatientRecord } from '../types';
import { supabase } from './supabase';
import { fetchWithCache } from '../utils/requestCache';

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
    diagnosticCode: item.diagnosis || 'Pending',
    status: 'Published',
    submission_type: submissionType,
    radiologic_clinchers: item.radiologic_clinchers || '',
    author: item.created_by ? authorMap.get(item.created_by) || 'Hospital Staff' : 'Hospital Staff',
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
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    { ttlMs: 20_000, allowStaleWhileRevalidate: true },
  );

  const creatorIds = Array.from(new Set((rawCases || []).map((item: any) => item.created_by).filter(Boolean)));
  let authorMap = new Map<string, string>();

  if (creatorIds.length > 0) {
    const profiles = await fetchWithCache(
      `published-cases:authors:${creatorIds.sort().join(',')}`,
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, nickname')
          .in('id', creatorIds);

        if (error) throw error;
        return data || [];
      },
      { ttlMs: 60_000, allowStaleWhileRevalidate: true },
    );

    authorMap = new Map(
      profiles.map((profile: any) => [
        String(profile.id),
        String(profile.nickname || profile.full_name || 'Hospital Staff'),
      ]),
    );
  }

    const bundle = {
      rawCases,
      records: rawCases.map((item: any) => buildPublishedCaseRecord(item, authorMap)),
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
