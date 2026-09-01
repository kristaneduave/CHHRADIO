import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { PatientRecord, SearchFilters } from '../types';
import { toastError } from '../utils/toast';
import LoadingState from './LoadingState';
import { Skeleton } from './Skeleton';
import EmptyState from './EmptyState';
import {
  fetchPublishedCasesBundle,
  getCachedPublishedCasesBundle,
  refreshPublishedCasesBundle,
} from '../services/publishedCasesService';
import {
  CASE_VIBER_SHARE_UPDATED_EVENT,
  CaseViberShareStatusRecord,
} from '../services/caseViberShareService';
import { useAppViewport } from './responsive/useViewport';
import PageHeader from './ui/PageHeader';
import PageShell from './ui/PageShell';
import { NETWORK_RESTORED_EVENT } from '../hooks/useOnlineStatus';

const DatabaseItemSkeleton = () => (
  <div className="w-full p-4 rounded-2xl backdrop-blur-md transition-all duration-300 relative bg-white/[0.03] border border-white/5 opacity-80 mb-3">
    <div className="flex items-center gap-3 w-full relative">
      <Skeleton variant="rectangular" className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-2.5 py-0.5">
        <Skeleton variant="text" className="w-1/2 h-4" />
        <div className="flex items-center justify-between">
          <Skeleton variant="text" className="w-1/3 h-3" />
          <Skeleton variant="text" className="w-16 h-3" />
        </div>
      </div>
    </div>
  </div>
);
interface SearchScreenProps {
  onCaseSelect: (caseItem: any) => void;
  currentUserId?: string | null;
}

const OPENED_CASES_STORAGE_KEY = 'chh_database_opened_case_ids_v1';
const VIBER_FILTER_STORAGE_PREFIX = 'chh_database_viber_filter_v1';
const VIBER_SORT_STORAGE_PREFIX = 'chh_database_viber_sort_v1';

const readStoredViberFilter = (userId?: string | null): SearchFilters['viberShareStatus'] => {
  if (typeof window === 'undefined' || !userId) return 'all';
  const value = window.sessionStorage.getItem(`${VIBER_FILTER_STORAGE_PREFIX}:${userId}`);
  return value === 'not_sent' || value === 'sent' ? value : 'all';
};

const storeViberFilter = (userId: string | null | undefined, value: SearchFilters['viberShareStatus']) => {
  if (typeof window === 'undefined' || !userId) return;
  window.sessionStorage.setItem(`${VIBER_FILTER_STORAGE_PREFIX}:${userId}`, value);
};

const readStoredViberSort = (userId: string | null | undefined, viberStatus: SearchFilters['viberShareStatus']) => {
  if (typeof window === 'undefined' || !userId) return viberStatus === 'not_sent' ? 'oldest' : 'newest';
  const value = window.sessionStorage.getItem(`${VIBER_SORT_STORAGE_PREFIX}:${userId}`);
  return value === 'oldest' || value === 'newest' ? value : viberStatus === 'not_sent' ? 'oldest' : 'newest';
};

const storeViberSort = (userId: string | null | undefined, value: 'newest' | 'oldest') => {
  if (typeof window === 'undefined' || !userId) return;
  window.sessionStorage.setItem(`${VIBER_SORT_STORAGE_PREFIX}:${userId}`, value);
};

const createSearchFilters = (
  viberShareStatus: SearchFilters['viberShareStatus'] = 'all',
  sortOrder: SearchFilters['sortOrder'] = viberShareStatus === 'not_sent' ? 'oldest' : 'newest',
): SearchFilters => ({
  startDate: '',
  endDate: '',
  specialty: '',
  modality: '',
  diagnosticCode: '',
  submissionType: '',
  viberShareStatus,
  datePreset: 'all',
  sortOrder,
});

const formatUploadedAt = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });

const formatViberSharedLabel = (value: string, staffName?: string | null) => {
  const sharedAt = new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Sent to Viber on ${sharedAt}${staffName ? ` by ${staffName}` : ''}`;
};

const formatViberMarkerInitials = (staffName?: string | null) => {
  const normalizedName = staffName?.trim();
  if (!normalizedName || normalizedName.toLowerCase() === 'hospital staff') return 'HS';

  const honorifics = new Set(['dr', 'dra', 'mr', 'mrs', 'ms']);
  const nameParts = normalizedName
    .split(/\s+/)
    .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((part) => part && !honorifics.has(part.toLowerCase()));

  const initialParts = nameParts.length > 3
    ? [nameParts[0], nameParts[1], nameParts[nameParts.length - 1]]
    : nameParts;
  const initials = initialParts.map((part) => Array.from(part)[0]).join('').toUpperCase();
  return initials || 'HS';
};

const ORGAN_SYSTEM_OPTIONS = [
  'Neuroradiology',
  'Head & Neck',
  'Chest / Thoracic',
  'Cardiovascular',
  'Gastrointestinal (GI)',
  'Genitourinary (GU)',
  'Musculoskeletal (MSK)',
  "Women's Imaging / Breast",
  'Pediatric',
  'Interventional',
  'Nuclear Medicine',
] as const;

const MODALITY_OPTIONS = [
  'X-Ray',
  'CT Scan',
  'MRI',
  'Ultrasound',
  'Mammography',
  'Fluoroscopy',
  'Nuclear Medicine',
  'Interventional',
  'PET/CT',
] as const;

const normalizeOrganSystem = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const resolveOrganSystem = (rawValue?: string | null) => {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  const lower = value.toLowerCase();
  if (lower === 'general' || lower === 'radiology') return '';

  const normalized = normalizeOrganSystem(value);
  const exact = ORGAN_SYSTEM_OPTIONS.find((opt) => normalizeOrganSystem(opt) === normalized);
  if (exact) return exact;

  // Friendly aliases for legacy/variant values
  if (normalized.includes('women') || normalized.includes('breast') || normalized.includes('mammo')) {
    return "Women's Imaging / Breast";
  }
  if (normalized.includes('msk') || normalized.includes('musculo')) {
    return 'Musculoskeletal (MSK)';
  }
  if (normalized.includes('gi') || normalized.includes('gastro')) {
    return 'Gastrointestinal (GI)';
  }
  if (normalized.includes('gu') || normalized.includes('genito')) {
    return 'Genitourinary (GU)';
  }
  if (normalized.includes('chest') || normalized.includes('thoracic')) {
    return 'Chest / Thoracic';
  }

  return value;
};

const getSubmissionTypeMeta = (submissionType?: string) => {
  switch (submissionType) {
    case 'rare_pathology':
      return {
        icon: 'biotech',
        tintClass: 'text-rose-400',
        boxClass: 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]',
        glowClass: 'bg-rose-500/20',
        unreadCardClass: 'bg-rose-500/[0.08] border border-rose-500/30 shadow-[0_4px_24px_-8px_rgba(225,29,72,0.25)] hover:bg-rose-500/[0.12]',
        unreadBadgeClass: 'bg-slate-900 text-rose-400 border border-rose-500/30 shadow-[0_2px_8px_rgba(225,29,72,0.2)]',
      };
    case 'aunt_minnie':
      return {
        icon: 'psychology',
        tintClass: 'text-amber-400',
        boxClass: 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
        glowClass: 'bg-amber-500/20',
        unreadCardClass: 'bg-amber-500/[0.08] border border-amber-500/30 shadow-[0_4px_24px_-8px_rgba(217,119,6,0.25)] hover:bg-amber-500/[0.12]',
        unreadBadgeClass: 'bg-slate-900 text-amber-400 border border-amber-500/30 shadow-[0_2px_8px_rgba(217,119,6,0.2)]',
      };
    default:
      return {
        icon: 'library_books',
        tintClass: 'text-sky-400',
        boxClass: 'bg-sky-500/20 border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.3)]',
        glowClass: 'bg-sky-500/20',
        unreadCardClass: 'bg-sky-500/[0.08] border border-sky-500/30 shadow-[0_4px_24px_-8px_rgba(14,165,233,0.25)] hover:bg-sky-500/[0.12]',
        unreadBadgeClass: 'bg-slate-900 text-sky-400 border border-sky-500/30 shadow-[0_2px_8px_rgba(14,165,233,0.2)]',
      };
  }
};

const getPrimaryMeta = (rawCase: any, fallbackType?: string) => {
  if (fallbackType === 'interesting_case') return 'Interesting Case';
  if (fallbackType === 'rare_pathology') return 'Rare Pathology';
  if (fallbackType === 'aunt_minnie') return 'Aunt Minnie';

  const organSystem = resolveOrganSystem(rawCase?.organ_system);
  if (organSystem) return organSystem;

  return 'Case';
};

const DATABASE_LOADING_WATCHDOG_MS = 15_000;

const SearchScreen: React.FC<SearchScreenProps> = ({ onCaseSelect, currentUserId = null }) => {
  const viewport = useAppViewport();
  const isRegisteredUser = Boolean(currentUserId);
  const cachedBundle = getCachedPublishedCasesBundle();
  const initialViberFilter = readStoredViberFilter(currentUserId);
  const initialSortOrder = readStoredViberSort(currentUserId, initialViberFilter);
  const initialFilters = createSearchFilters(initialViberFilter, initialSortOrder);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [suggestions, setSuggestions] = useState<PatientRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(initialFilters);
  const [results, setResults] = useState<PatientRecord[]>(cachedBundle?.records || []);
  const [allCases, setAllCases] = useState<PatientRecord[]>(cachedBundle?.records || []);
  const [rawCases, setRawCases] = useState<any[]>(cachedBundle?.rawCases || []);
  const [loading, setLoading] = useState(!cachedBundle);
  const [error, setError] = useState<string | null>(null);

  // Track opened cases so they lose their "New" styling, including across reloads
  const [openedCaseIds, setOpenedCaseIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      const raw = window.localStorage.getItem(OPENED_CASES_STORAGE_KEY);
      if (!raw) return new Set<string>();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set<string>(parsed.filter((id) => typeof id === 'string')) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const fetchCasesSeqRef = useRef(0);

  useEffect(() => {
    void fetchCases(Boolean(cachedBundle));
  }, []);

  useEffect(() => {
    const refreshAfterReconnect = () => void fetchCases(true);
    window.addEventListener(NETWORK_RESTORED_EVENT, refreshAfterReconnect);
    return () => window.removeEventListener(NETWORK_RESTORED_EVENT, refreshAfterReconnect);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return;
      setError((prev) => prev ?? 'Database load is taking too long. Please tap Retry.');
      setLoading(false);
    }, DATABASE_LOADING_WATCHDOG_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loading]);

  const sortCases = (input: PatientRecord[], order: SearchFilters['sortOrder'] = filters.sortOrder) => {
    return [...input].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return order === 'newest' ? bTime - aTime : aTime - bTime;
    });
  };

  const fetchCases = async (silent = false) => {
    const seq = ++fetchCasesSeqRef.current;
    let loadingWatchdogId: ReturnType<typeof setTimeout> | null = null;
    if (!silent) setLoading(true);
    if (!silent) {
      setError(null);
      loadingWatchdogId = setTimeout(() => {
        if (!isMountedRef.current || seq !== fetchCasesSeqRef.current) return;
        setError('Database load is taking too long. Please tap Retry.');
        setLoading(false);
      }, DATABASE_LOADING_WATCHDOG_MS);
    }
    try {
      const { rawCases: nextRawCases, records } = silent
        ? await refreshPublishedCasesBundle()
        : await fetchPublishedCasesBundle();
      if (!isMountedRef.current || seq !== fetchCasesSeqRef.current) return;
      setRawCases(nextRawCases);
      startTransition(() => {
        setAllCases(records);
        setResults(sortCases(records));
      });
    } catch (loadError) {
      console.error('Error fetching cases:', loadError);
      if (!isMountedRef.current || seq !== fetchCasesSeqRef.current) return;
      if (!silent) {
        setError('Unable to load Database. Please try again.');
        toastError('Failed to load Database');
      }
    } finally {
      if (loadingWatchdogId) {
        clearTimeout(loadingWatchdogId);
      }
      if (!isMountedRef.current || seq !== fetchCasesSeqRef.current) return;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (deferredQuery.trim().length > 0) {
      const matches = allCases
        .filter(
          (p) =>
            p.name.toLowerCase().includes(deferredQuery.toLowerCase()) ||
            p.initials.toLowerCase().includes(deferredQuery.toLowerCase()) ||
            p.diagnosticCode.toLowerCase().includes(deferredQuery.toLowerCase()),
        )
        .slice(0, 4);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [deferredQuery, allCases]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!showFilters || viewport !== 'mobile' || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDraftFilters({ ...filters });
      setShowFilters(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [filters, showFilters, viewport]);

  useEffect(() => {
    startTransition(() => {
      setResults((prev) => sortCases(prev));
    });
  }, [filters.sortOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCaseViberShareUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CaseViberShareStatusRecord>).detail;
      if (!detail?.case_id) return;

      setRawCases((prev) =>
        prev.map((item) =>
          String(item?.id || '') === detail.case_id
            ? {
                ...item,
                viber_shared_at: detail.viber_shared_at,
                viber_shared_by: detail.viber_shared_by,
                viber_shared_by_name: detail.viber_shared_by_name,
              }
            : item,
        ),
      );
      setAllCases((prev) =>
        prev.map((item) =>
          item.id === detail.case_id
            ? {
                ...item,
                viber_shared_at: detail.viber_shared_at,
                viber_shared_by: detail.viber_shared_by,
                viber_shared_by_name: detail.viber_shared_by_name,
              }
            : item,
        ),
      );
      setResults((prev) =>
        prev.map((item) =>
          item.id === detail.case_id
            ? {
                ...item,
                viber_shared_at: detail.viber_shared_at,
                viber_shared_by: detail.viber_shared_by,
                viber_shared_by_name: detail.viber_shared_by_name,
              }
            : item,
        ),
      );
    };

    window.addEventListener(CASE_VIBER_SHARE_UPDATED_EVENT, handleCaseViberShareUpdated as EventListener);
    return () => {
      window.removeEventListener(CASE_VIBER_SHARE_UPDATED_EVENT, handleCaseViberShareUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isRegisteredUser || filters.viberShareStatus === 'all') return;
    const nextResults = allCases.filter((item) => {
      const raw = rawCases.find((candidate) => String(candidate?.id || '') === item.id);
      if (!isViberShareEligible(raw)) return false;
      return filters.viberShareStatus === 'sent'
        ? Boolean(raw?.viber_shared_at)
        : !raw?.viber_shared_at;
    });
    startTransition(() => setResults(sortCases(nextResults)));
  }, [allCases, rawCases]);

  const markCaseAsOpened = (caseId: string) => {
    setOpenedCaseIds((prev) => {
      if (prev.has(caseId)) return prev;

      const next = new Set(prev);
      next.add(caseId);

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(OPENED_CASES_STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch {
          // Ignore localStorage failures so opening a case is never blocked.
        }
      }

      return next;
    });
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDraftFilters((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'viberShareStatus' && value === 'not_sent' ? { sortOrder: 'oldest' as const } : {}),
    }));
  };

  const openFilters = () => {
    setDraftFilters({ ...filters });
    setShowSuggestions(false);
    setShowFilters(true);
  };

  const closeFilters = () => {
    setDraftFilters({ ...filters });
    setShowFilters(false);
  };

  const clearDraftFilters = () => {
    setDraftFilters(createSearchFilters());
  };

  const isViberShareEligible = (rawCase: any) =>
    String(rawCase?.status || '').toLowerCase() === 'published'
    && String(rawCase?.submission_type || 'interesting_case') === 'interesting_case';

  const primaryMetaOptions = ORGAN_SYSTEM_OPTIONS;

  const getPresetStartDate = (preset: SearchFilters['datePreset']) => {
    if (preset === 'all' || preset === 'custom') return null;
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 365;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days);
    return start;
  };

  const filterCases = (nextFilters: SearchFilters, nextQuery: string) =>
    allCases.filter((p) => {
      const matchQuery = nextQuery
        ? p.name.toLowerCase().includes(nextQuery.toLowerCase()) ||
        p.initials.toLowerCase().includes(nextQuery.toLowerCase()) ||
        p.diagnosticCode.toLowerCase().includes(nextQuery.toLowerCase())
        : true;

      const raw = rawCases.find((c) => c.id === p.id);
      const rawOrganSystem = resolveOrganSystem(raw?.organ_system);
      const matchSpecialty = nextFilters.specialty ? rawOrganSystem === nextFilters.specialty : true;
      const rawModality = String(raw?.modality || p.modality || '').trim();
      const matchModality = nextFilters.modality ? rawModality === nextFilters.modality : true;
      const matchCode = nextFilters.diagnosticCode
        ? p.diagnosticCode.toLowerCase().includes(nextFilters.diagnosticCode.toLowerCase())
        : true;
      const matchSubmissionType = nextFilters.submissionType ? p.submission_type === nextFilters.submissionType : true;
      const matchViberShareStatus = isRegisteredUser && nextFilters.viberShareStatus !== 'all'
        ? isViberShareEligible(raw)
          && (nextFilters.viberShareStatus === 'sent' ? Boolean(raw?.viber_shared_at) : !raw?.viber_shared_at)
        : true;

      const date = new Date(p.date);
      const presetStart = getPresetStartDate(nextFilters.datePreset);
      const start = nextFilters.datePreset === 'custom' && nextFilters.startDate ? new Date(nextFilters.startDate) : presetStart;
      const end = nextFilters.endDate ? new Date(nextFilters.endDate) : null;
      const matchDate = (!start || date >= start) && (!end || date <= end);

      return matchQuery && matchSpecialty && matchModality && matchCode && matchSubmissionType && matchViberShareStatus && matchDate;
    });

  const applyFilters = () => {
    const nextFilters = draftFilters;
    const filtered = filterCases(nextFilters, query);

    setFilters({ ...nextFilters });
    startTransition(() => {
      setResults(sortCases(filtered, nextFilters.sortOrder));
    });
    storeViberFilter(currentUserId, nextFilters.viberShareStatus);
    storeViberSort(currentUserId, nextFilters.sortOrder);
    setShowFilters(false);
    setShowSuggestions(false);
  };

  const clearFilters = () => {
    const clearedFilters = createSearchFilters();
    setFilters(clearedFilters);
    setDraftFilters(clearedFilters);
    setQuery('');
    storeViberFilter(currentUserId, 'all');
    storeViberSort(currentUserId, 'newest');
    startTransition(() => {
      setResults(sortCases(allCases, 'newest'));
    });
    setShowFilters(false);
  };

  const selectSuggestion = (p: PatientRecord) => {
    setQuery(p.name);
    setShowSuggestions(false);
    startTransition(() => {
      setResults(sortCases([p]));
    });
    markCaseAsOpened(p.id);
  };

  const viberQueueCount = isRegisteredUser
    ? rawCases.filter((rawCase) => isViberShareEligible(rawCase) && !rawCase?.viber_shared_at).length
    : 0;

  const openViberQueue = () => {
    const queueFilters: SearchFilters = {
      startDate: '',
      endDate: '',
      specialty: '',
      modality: '',
      diagnosticCode: '',
      submissionType: '',
      viberShareStatus: 'not_sent',
      datePreset: 'all',
      sortOrder: 'oldest',
    };
    const queueResults = allCases.filter((item) => {
      const raw = rawCases.find((candidate) => String(candidate?.id || '') === item.id);
      return isViberShareEligible(raw) && !raw?.viber_shared_at;
    });

    setQuery('');
    setFilters(queueFilters);
    setDraftFilters(queueFilters);
    setShowFilters(false);
    setShowSuggestions(false);
    storeViberFilter(currentUserId, 'not_sent');
    storeViberSort(currentUserId, 'oldest');
    startTransition(() => setResults(sortCases(queueResults, 'oldest')));
  };

  type ActiveFilterKey = 'query' | 'submissionType' | 'specialty' | 'modality' | 'diagnosticCode' | 'viberShareStatus' | 'datePreset' | 'startDate' | 'endDate';
  const activeFilterChips = ([
    { key: 'query', label: query ? `Query: ${query}` : '' },
    filters.submissionType
      ? { key: 'submissionType', label: `Type: ${filters.submissionType === 'interesting_case'
        ? 'Interesting Case'
        : filters.submissionType === 'rare_pathology'
          ? 'Rare Pathology'
          : 'Aunt Minnie'
      }` }
      : { key: 'submissionType', label: '' },
    { key: 'specialty', label: filters.specialty ? `Organ system: ${filters.specialty}` : '' },
    { key: 'modality', label: filters.modality ? `Modality: ${filters.modality}` : '' },
    { key: 'diagnosticCode', label: filters.diagnosticCode ? `Patient ID: ${filters.diagnosticCode}` : '' },
    isRegisteredUser && filters.viberShareStatus !== 'all'
      ? { key: 'viberShareStatus', label: `Viber: ${filters.viberShareStatus === 'sent' ? 'Sent' : 'Not sent'}` }
      : { key: 'viberShareStatus', label: '' },
    filters.datePreset !== 'all'
      ? { key: 'datePreset', label: `Date: ${filters.datePreset === 'custom'
        ? 'Custom'
        : filters.datePreset === '7d'
          ? 'Last 7 days'
          : filters.datePreset === '30d'
            ? 'Last 30 days'
            : filters.datePreset === '90d'
            ? 'Last 90 days'
              : 'Last 12 months'
      }` }
      : { key: 'datePreset', label: '' },
    { key: 'startDate', label: filters.startDate ? `From: ${filters.startDate}` : '' },
    { key: 'endDate', label: filters.endDate ? `To: ${filters.endDate}` : '' },
  ] as Array<{ key: ActiveFilterKey; label: string }>).filter((chip) => Boolean(chip.label));
  const activeFilterCount = activeFilterChips.filter((chip) => chip.key !== 'query').length;

  const removeActiveFilter = (key: ActiveFilterKey) => {
    const nextFilters = { ...filters };
    let nextQuery = query;

    if (key === 'query') nextQuery = '';
    else if (key === 'submissionType') nextFilters.submissionType = '';
    else if (key === 'specialty') nextFilters.specialty = '';
    else if (key === 'modality') nextFilters.modality = '';
    else if (key === 'diagnosticCode') nextFilters.diagnosticCode = '';
    else if (key === 'viberShareStatus') nextFilters.viberShareStatus = 'all';
    else if (key === 'datePreset') {
      nextFilters.datePreset = 'all';
      nextFilters.startDate = '';
      nextFilters.endDate = '';
    } else if (key === 'startDate') nextFilters.startDate = '';
    else if (key === 'endDate') nextFilters.endDate = '';

    setQuery(nextQuery);
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
    storeViberFilter(currentUserId, nextFilters.viberShareStatus);
    startTransition(() => setResults(sortCases(filterCases(nextFilters, nextQuery), nextFilters.sortOrder)));
  };

  const emptyState = (() => {
    if (query.trim()) {
      return {
        icon: 'search_off',
        title: `No cases match “${query.trim()}”`,
        description: 'Check the spelling or try a broader search term.',
        actionLabel: 'Clear search',
        onAction: () => removeActiveFilter('query'),
      };
    }

    if (isRegisteredUser && filters.viberShareStatus === 'not_sent') {
      return {
        icon: 'task_alt',
        title: 'Viber queue is clear',
        description: 'All published Interesting Cases have been sent to Viber.',
        actionLabel: 'View all cases',
        onAction: clearFilters,
      };
    }

    if (isRegisteredUser && filters.viberShareStatus === 'sent') {
      return {
        icon: 'send',
        title: 'No cases have been marked sent',
        description: 'Cases will appear here after a registered staff member marks them as sent to Viber.',
        actionLabel: 'View pending cases',
        onAction: openViberQueue,
      };
    }

    if (activeFilterChips.length > 0) {
      return {
        icon: 'filter_alt_off',
        title: 'No cases match these filters',
        description: 'Remove a filter or clear them all to broaden the results.',
        actionLabel: 'Clear filters',
        onAction: clearFilters,
      };
    }

    return {
      icon: 'inventory_2',
      title: 'No published cases yet',
      description: 'Published cases will appear here when they become available.',
      actionLabel: null,
      onAction: null,
    };
  })();

  return (
    <PageShell layoutMode="split">
      <div className="flex min-h-full flex-col" data-search-viewport={viewport}>
        <div className="bg-app/80 pb-2 pt-1 backdrop-blur-md">
          <PageHeader
            title="Database"
            action={isRegisteredUser ? (
              <button
                type="button"
                onClick={openViberQueue}
                className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-violet-100 transition hover:border-violet-300/40 hover:bg-violet-500/15"
                aria-label={`Open Viber queue, ${viberQueueCount} ${viberQueueCount === 1 ? 'case' : 'cases'} pending`}
              >
                <span className="material-icons text-[14px] text-violet-300" aria-hidden="true">schedule_send</span>
                <span>Viber Queue</span>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-violet-300/15 px-1.5 py-0.5 text-[9px] text-violet-50" aria-live="polite">
                  {loading && rawCases.length === 0 ? '…' : viberQueueCount}
                </span>
              </button>
            ) : null}
          />
        </div>

        <div className="pt-2 pb-4">
        <div className="relative mb-4 z-40" ref={suggestionsRef}>
          <div className="relative group flex bg-black/40 p-1.5 rounded-[1.25rem] border border-white/5 backdrop-blur-md shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 -mx-1.5">
            <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[19px] text-slate-500 group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyFilters();
                }
              }}
              placeholder="Search by name, initials or code..."
              className="w-full h-10 bg-transparent border-0 rounded-xl pl-[2.75rem] pr-[3.5rem] text-[13px] font-bold text-white placeholder-slate-500 focus:ring-0 focus:outline-none transition-all"
              aria-label="Search Database"
            />
            {query ? (
              <button
                onClick={() => removeActiveFilter('query')}
                className="absolute right-[3rem] top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Clear search"
              >
                <span className="material-icons text-sm">close</span>
              </button>
            ) : null}
            <button
              onClick={() => showFilters ? closeFilters() : openFilters()}
              className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${showFilters ? 'bg-primary text-white shadow-[0_4px_12px_rgba(13,162,231,0.3)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              aria-label="Toggle advanced filters"
            >
              <span className="material-icons text-[19px]">tune</span>
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[8px] font-black text-slate-950">
                  {activeFilterCount > 9 ? '9+' : activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {showSuggestions ? (
            <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              {suggestions.map((p) => {
                const typeMeta = getSubmissionTypeMeta(p.submission_type);
                return (
                  <button
                    key={p.id}
                    onClick={() => selectSuggestion(p)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0 text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${typeMeta.boxClass}`}>
                      <span className={`material-icons text-sm ${typeMeta.tintClass}`}>{typeMeta.icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-tighter">
                        {getPrimaryMeta(rawCases.find((c) => c.id === p.id), p.submission_type)} - {formatUploadedAt(p.date)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {showFilters ? (
          <>
          {viewport === 'mobile' ? (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
              onClick={closeFilters}
              aria-label="Close filters"
            />
          ) : null}
          <div
            className={viewport === 'mobile'
              ? 'fixed inset-x-0 top-[10dvh] z-[45] flex flex-col overflow-hidden rounded-t-[2rem] border border-cyan-500/15 bg-[#06111b]/98 backdrop-blur-xl animate-in slide-in-from-bottom-6 duration-300'
              : 'mb-6 animate-in slide-in-from-top-4 duration-300 rounded-[2rem] border border-cyan-500/15 bg-[#06111b]/92 backdrop-blur-xl'}
            style={viewport === 'mobile' ? { bottom: 'var(--mobile-bottom-nav-clearance)' } : undefined}
            role={viewport === 'mobile' ? 'dialog' : undefined}
            aria-modal={viewport === 'mobile' ? 'true' : undefined}
            aria-labelledby="database-filter-heading"
          >
            <div className={viewport === 'mobile' ? 'flex-1 overflow-y-auto p-5 pb-4' : 'p-6 pb-4'}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 id="database-filter-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
                  <span className="material-icons text-[16px]" aria-hidden="true">filter_alt</span>
                  Advanced filters
                </h3>
                <p className="mt-1 text-xs text-slate-400">Refine the case library by type, date, modality, organ system, and PACS Patient ID.</p>
              </div>
              <button
                type="button"
                onClick={closeFilters}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Cancel filter changes"
              >
                <span className="material-icons text-[17px]" aria-hidden="true">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Case type</label>
                <select
                  name="submissionType"
                  value={draftFilters.submissionType}
                  onChange={handleFilterChange}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                >
                  <option value="">All Types</option>
                  <option value="interesting_case" className="bg-surface">Interesting Case</option>
                  <option value="rare_pathology" className="bg-surface">Rare Pathology</option>
                  <option value="aunt_minnie" className="bg-surface">Aunt Minnie</option>
                </select>
              </div>
              {isRegisteredUser ? (
                <div className="space-y-1.5">
                  <label htmlFor="viber-share-status-filter" className="block text-xs font-medium text-slate-300">Viber status</label>
                  <select
                    id="viber-share-status-filter"
                    name="viberShareStatus"
                    value={draftFilters.viberShareStatus}
                    onChange={handleFilterChange}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                  >
                    <option value="all">All</option>
                    <option value="not_sent" className="bg-surface">Not sent to Viber</option>
                    <option value="sent" className="bg-surface">Sent to Viber</option>
                  </select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Date</label>
                <select
                  name="datePreset"
                  value={draftFilters.datePreset}
                  onChange={handleFilterChange}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                >
                  <option value="all" className="bg-surface">All time</option>
                  <option value="7d" className="bg-surface">Last 7 days</option>
                  <option value="30d" className="bg-surface">Last 30 days</option>
                  <option value="90d" className="bg-surface">Last 90 days</option>
                  <option value="365d" className="bg-surface">Last 12 months</option>
                  <option value="custom" className="bg-surface">Custom range</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Sort</label>
                <select
                  value={draftFilters.sortOrder}
                  onChange={(e) => {
                    const nextSortOrder = e.target.value as 'newest' | 'oldest';
                    setDraftFilters((prev) => ({ ...prev, sortOrder: nextSortOrder }));
                  }}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                  aria-label="Sort search results"
                >
                  <option value="newest" className="bg-surface">Newest first</option>
                  <option value="oldest" className="bg-surface">Oldest first</option>
                </select>
              </div>
              {draftFilters.datePreset === 'custom' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">From date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={draftFilters.startDate}
                      onChange={handleFilterChange}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">To date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={draftFilters.endDate}
                      onChange={handleFilterChange}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Organ system</label>
                <select
                  name="specialty"
                  value={draftFilters.specialty}
                  onChange={handleFilterChange}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                >
                  <option value="">All Organ Systems</option>
                  {primaryMetaOptions.map((s) => (
                    <option key={s} value={s} className="bg-surface">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Modality</label>
                <select
                  name="modality"
                  value={draftFilters.modality}
                  onChange={handleFilterChange}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                >
                  <option value="">All Modalities</option>
                  {MODALITY_OPTIONS.map((modality) => (
                    <option key={modality} value={modality} className="bg-surface">
                      {modality}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  PACS Patient ID
                </label>
                <input
                  type="text"
                  name="diagnosticCode"
                  value={draftFilters.diagnosticCode}
                  onChange={handleFilterChange}
                  placeholder="e.g. 12345678"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35"
                />
              </div>
            </div>
            </div>

            <div className={`flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#07121d]/96 px-5 py-4 backdrop-blur ${viewport === 'mobile' ? 'mobile-sheet-footer-clearance' : ''}`}>
              <button
                type="button"
                onClick={clearDraftFilters}
                className="mr-auto rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={closeFilters}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-xl border border-cyan-400/25 bg-cyan-500/15 px-5 py-2.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                Apply filters
              </button>
            </div>
          </div>
          </>
        ) : null}

        {activeFilterChips.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
              {activeFilterChips.map((chip) => (
                <button
                  type="button"
                  key={chip.key}
                  onClick={() => removeActiveFilter(chip.key)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                  aria-label={`Remove filter: ${chip.label}`}
                >
                  <span>{chip.label}</span>
                  <span className="material-icons text-[11px]" aria-hidden="true">close</span>
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activeFilterChips.length > 1 ? (
                <button type="button" onClick={clearFilters} className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-200">
                  Clear all
                </button>
              ) : null}
              {isRegisteredUser && filters.viberShareStatus !== 'all' ? (
                <span className="text-[10px] font-semibold text-slate-500" aria-live="polite">
                  {results.length} {results.length === 1 ? 'case' : 'cases'}
                </span>
              ) : null}
            </div>
          </div>
        )}

        <div className="space-y-3 pr-1 pt-2 min-w-0">

          {loading && results.length === 0 ? (
            <div className="animate-in fade-in duration-500">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <DatabaseItemSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="glass-card-enhanced rounded-2xl border border-red-500/20 p-6 text-center">
              <p className="text-sm font-semibold text-red-300 mb-3">{error}</p>
              <button
                onClick={() => void fetchCases(false)}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-dark transition-colors"
              >
                Retry
              </button>
            </div>
          ) : results.length > 0 ? (
            results.map((p) => {
              const typeMeta = getSubmissionTypeMeta(p.submission_type);
              const raw = rawCases.find((c) => c.id === p.id);
              const isRecent = !openedCaseIds.has(p.id) && new Date(p.date) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
              const showViberBadge = isRegisteredUser
                && p.submission_type === 'interesting_case'
                && Boolean(p.viber_shared_at);
              const viberBadgeLabel = showViberBadge
                ? formatViberSharedLabel(p.viber_shared_at as string, p.viber_shared_by_name)
                : '';
              const viberMarkerInitials = showViberBadge
                ? formatViberMarkerInitials(p.viber_shared_by_name)
                : '';

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    markCaseAsOpened(p.id);
                    if (raw && onCaseSelect) onCaseSelect(raw);
                  }}
                  className={`w-full text-left p-3 rounded-2xl backdrop-blur-md transition-all duration-300 relative group ${isRecent
                    ? typeMeta.unreadCardClass
                    : 'bg-white/[0.03] border border-white/5 opacity-80 hover:bg-white/[0.05]'
                    }`}
                >
                  {/* Subtle glow effect for recent */}
                  {isRecent && (
                    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                      <div className={`absolute top-0 right-0 w-32 h-32 ${typeMeta.glowClass} blur-[50px] rounded-full transform -translate-y-1/2 translate-x-1/2`} />
                    </div>
                  )}



                  <div className="flex items-center gap-3.5 w-full z-10 relative">
                    <div className={`w-[38px] h-[38px] rounded-[14px] flex items-center justify-center shrink-0 shadow-inner border ${isRecent ? typeMeta.boxClass : 'bg-black/40 border-white/5'}`}>
                      <span className={`material-icons text-[18px] ${typeMeta.tintClass}`}>{typeMeta.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0 pr-1 gap-0.5">
                        <div className="flex items-center flex-wrap gap-2 min-w-0">
                          <h4 className={`truncate text-[12px] sm:text-[13px] tracking-widest font-extrabold uppercase ${typeMeta.tintClass}`}>
                            {String(p.name || '').toUpperCase()}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] truncate uppercase tracking-widest font-bold">
                          <span className="text-slate-300 truncate">{p.author || 'Hospital Staff'}</span>
                        </div>
                      </div>

                      <div className="flex items-center shrink-0 gap-2 relative z-50">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[9px] sm:text-[10px] whitespace-nowrap font-bold tracking-widest text-slate-500">
                            {formatUploadedAt(p.date)}
                          </span>
                          {showViberBadge ? (
                            <span
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-300/35 bg-violet-500/15 px-2 py-1 text-[9px] font-black uppercase leading-none tracking-[0.13em] text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                              aria-label={viberBadgeLabel}
                              title={viberBadgeLabel}
                            >
                              <span className="material-icons text-[12px] leading-none text-violet-300" aria-hidden="true">check_circle</span>
                              <span>Viber · {viberMarkerInitials}</span>
                            </span>
                          ) : null}
                        </div>
                        <span className="material-icons text-slate-500 group-hover:text-primary transition-colors hover:bg-white/10 hover:text-slate-300 rounded-full h-6 w-6 inline-flex items-center justify-center -mr-1">
                          chevron_right
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={emptyState.icon}
              title={emptyState.title}
              description={emptyState.description}
              action={emptyState.actionLabel && emptyState.onAction ? (
                <button
                  type="button"
                  onClick={emptyState.onAction}
                  className="rounded-xl px-5 py-2.5 font-bold tracking-wider uppercase text-[11px] bg-primary/20 text-primary-light border border-primary/30 hover:bg-primary/30 transition-all shadow-lg"
                >
                  {emptyState.actionLabel}
                </button>
              ) : undefined}
            />
          )}
        </div>

        {/* Bottom spacer so last cards remain accessible above fixed nav */}
        <div className="h-24 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </PageShell>
  );
};

export default SearchScreen;
