import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { PatientRecord, SearchFilters } from '../types';
import { toastError } from '../utils/toast';
import LoadingState from './LoadingState';
import { Skeleton } from './Skeleton';
import EmptyState from './EmptyState';
import { fetchPublishedCasesBundle, getCachedPublishedCasesBundle } from '../services/publishedCasesService';
import { useAppViewport } from './responsive/useViewport';
import PageHeader from './ui/PageHeader';
import PageShell from './ui/PageShell';

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
}

const OPENED_CASES_STORAGE_KEY = 'chh_database_opened_case_ids_v1';

const formatUploadedAt = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });

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

const SearchScreen: React.FC<SearchScreenProps> = ({ onCaseSelect }) => {
  const viewport = useAppViewport();
  const cachedBundle = getCachedPublishedCasesBundle();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [suggestions, setSuggestions] = useState<PatientRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    startDate: '',
    endDate: '',
    specialty: '',
    diagnosticCode: '',
    submissionType: '',
    datePreset: 'all',
  });
  const [results, setResults] = useState<PatientRecord[]>(cachedBundle?.records || []);
  const [allCases, setAllCases] = useState<PatientRecord[]>(cachedBundle?.records || []);
  const [rawCases, setRawCases] = useState<any[]>(cachedBundle?.rawCases || []);
  const [loading, setLoading] = useState(!cachedBundle);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

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
    if (!cachedBundle) {
      fetchCases();
    }
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

  const sortCases = (input: PatientRecord[]) => {
    return [...input].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });
  };

  const fetchCases = async () => {
    const seq = ++fetchCasesSeqRef.current;
    let loadingWatchdogId: ReturnType<typeof setTimeout> | null = null;
    setLoading(true);
    setError(null);
    loadingWatchdogId = setTimeout(() => {
      if (!isMountedRef.current || seq !== fetchCasesSeqRef.current) return;
      setError('Database load is taking too long. Please tap Retry.');
      setLoading(false);
    }, DATABASE_LOADING_WATCHDOG_MS);
    try {
      const { rawCases: nextRawCases, records } = await fetchPublishedCasesBundle();
      if (!isMountedRef.current || seq !== fetchCasesSeqRef.current) return;
      setRawCases(nextRawCases);
      startTransition(() => {
        setAllCases(records);
        setResults(sortCases(records));
      });
    } catch (loadError) {
      console.error('Error fetching cases:', loadError);
      if (!isMountedRef.current || seq !== fetchCasesSeqRef.current) return;
      setError('Unable to load Database. Please try again.');
      toastError('Failed to load Database');
    } finally {
      if (loadingWatchdogId) {
        clearTimeout(loadingWatchdogId);
      }
      if (!isMountedRef.current || seq !== fetchCasesSeqRef.current) return;
      setLoading(false);
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
    startTransition(() => {
      setResults((prev) => sortCases(prev));
    });
  }, [sortOrder]);

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
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const primaryMetaOptions = ORGAN_SYSTEM_OPTIONS;

  const getPresetStartDate = (preset: SearchFilters['datePreset']) => {
    if (preset === 'all' || preset === 'custom') return null;
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 365;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days);
    return start;
  };

  const applyFilters = () => {
    const filtered = allCases.filter((p) => {
      const matchQuery = query
        ? p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.initials.toLowerCase().includes(query.toLowerCase()) ||
        p.diagnosticCode.toLowerCase().includes(query.toLowerCase())
        : true;

      const raw = rawCases.find((c) => c.id === p.id);
      const rawOrganSystem = resolveOrganSystem(raw?.organ_system);
      const matchSpecialty = filters.specialty ? rawOrganSystem === filters.specialty : true;
      const matchCode = filters.diagnosticCode
        ? p.diagnosticCode.toLowerCase().includes(filters.diagnosticCode.toLowerCase())
        : true;
      const matchSubmissionType = filters.submissionType ? p.submission_type === filters.submissionType : true;

      const date = new Date(p.date);
      const presetStart = getPresetStartDate(filters.datePreset);
      const start = filters.datePreset === 'custom' && filters.startDate ? new Date(filters.startDate) : presetStart;
      const end = filters.endDate ? new Date(filters.endDate) : null;
      const matchDate = (!start || date >= start) && (!end || date <= end);

      return matchQuery && matchSpecialty && matchCode && matchSubmissionType && matchDate;
    });

    startTransition(() => {
      setResults(sortCases(filtered));
    });
    setShowFilters(false);
    setShowSuggestions(false);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      specialty: '',
      diagnosticCode: '',
      submissionType: '',
      datePreset: 'all',
    });
    setQuery('');
    startTransition(() => {
      setResults(sortCases(allCases));
    });
  };

  const selectSuggestion = (p: PatientRecord) => {
    setQuery(p.name);
    setShowSuggestions(false);
    startTransition(() => {
      setResults(sortCases([p]));
    });
    markCaseAsOpened(p.id);
  };

  const activeFilterChips = [
    query ? `Query: ${query}` : '',
    filters.submissionType
      ? `Type: ${filters.submissionType === 'interesting_case'
        ? 'Interesting Case'
        : filters.submissionType === 'rare_pathology'
          ? 'Rare Pathology'
          : 'Aunt Minnie'
      }`
      : '',
    filters.specialty ? `Organ system: ${filters.specialty}` : '',
    filters.diagnosticCode ? `Code: ${filters.diagnosticCode}` : '',
    filters.datePreset !== 'all'
      ? `Date: ${filters.datePreset === 'custom'
        ? 'Custom'
        : filters.datePreset === '7d'
          ? 'Last 7 days'
          : filters.datePreset === '30d'
            ? 'Last 30 days'
            : filters.datePreset === '90d'
              ? 'Last 90 days'
              : 'Last 12 months'
      }`
      : '',
    filters.startDate ? `From: ${filters.startDate}` : '',
    filters.endDate ? `To: ${filters.endDate}` : '',
  ].filter(Boolean);

  return (
    <PageShell layoutMode="split">
      <div className="flex min-h-full flex-col" data-search-viewport={viewport}>
        <div className="bg-app/80 pb-2 pt-1 backdrop-blur-md">
          <PageHeader title="Database" />
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
                onClick={() => {
                  setQuery('');
                  applyFilters();
                }}
                className="absolute right-[3rem] top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Clear search"
              >
                <span className="material-icons text-sm">close</span>
              </button>
            ) : null}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${showFilters ? 'bg-primary text-white shadow-[0_4px_12px_rgba(13,162,231,0.3)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              aria-label="Toggle advanced filters"
            >
              <span className="material-icons text-[19px]">tune</span>
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
          <div className="mb-6 animate-in slide-in-from-top-4 duration-300 rounded-[2rem] border border-cyan-500/15 bg-[#06111b]/92 p-6 backdrop-blur-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
                  <span className="material-icons text-[16px]">filter_alt</span>
                  Advanced filters
                </h3>
                <p className="mt-1 text-xs text-slate-400">Refine the case library by type, date, organ system, and ICD-10 code.</p>
              </div>
              <button
                onClick={clearFilters}
                className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-slate-200"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Case type</label>
                <select
                  name="submissionType"
                  value={filters.submissionType}
                  onChange={handleFilterChange}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                >
                  <option value="">All Types</option>
                  <option value="interesting_case" className="bg-surface">Interesting Case</option>
                  <option value="rare_pathology" className="bg-surface">Rare Pathology</option>
                  <option value="aunt_minnie" className="bg-surface">Aunt Minnie</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Date</label>
                <select
                  name="datePreset"
                  value={filters.datePreset}
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
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                  aria-label="Sort search results"
                >
                  <option value="newest" className="bg-surface">Newest first</option>
                  <option value="oldest" className="bg-surface">Oldest first</option>
                </select>
              </div>
              {filters.datePreset === 'custom' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">From date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition focus:border-cyan-400/35"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">To date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={filters.endDate}
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
                  value={filters.specialty}
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
                <label className="block text-xs font-medium text-slate-300">
                  Diagnostic code (ICD-10)
                </label>
                <input
                  type="text"
                  name="diagnosticCode"
                  value={filters.diagnosticCode}
                  onChange={handleFilterChange}
                  placeholder="e.g. G30.9"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35"
                />
              </div>
            </div>

            <button
              onClick={applyFilters}
              className="mt-6 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-2.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
            >
              Apply filters
            </button>
          </div>
        ) : null}

        {activeFilterChips.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5 px-1">
            {activeFilterChips.map((chip) => (
              <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                {chip}
              </span>
            ))}
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
                onClick={fetchCases}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-dark transition-colors"
              >
                Retry
              </button>
            </div>
          ) : results.length > 0 ? (
            results.map((p) => {
              const typeMeta = getSubmissionTypeMeta(p.submission_type);
              const raw = rawCases.find((c) => c.id === p.id);
              const primaryMeta = getPrimaryMeta(raw, p.submission_type);
              const isRecent = !openedCaseIds.has(p.id) && new Date(p.date) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

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
                          <span className="text-white opacity-90">{primaryMeta}</span>
                          <span className="text-slate-600 font-bold px-0.5">|</span>
                          <span className="text-slate-300 truncate">{p.author || 'Hospital Staff'}</span>
                        </div>
                      </div>

                      <div className="flex items-center shrink-0 gap-2 relative z-50">
                        <span className="text-[9px] sm:text-[10px] whitespace-nowrap font-bold tracking-widest text-slate-500">
                          {formatUploadedAt(p.date)}
                        </span>
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
              icon="search_off"
              title={query ? `No results for "${query}"` : 'No matches found'}
              description="Adjust your filters or try a different search term to find what you need."
              action={
                <button
                  onClick={clearFilters}
                  className="rounded-xl px-5 py-2.5 font-bold tracking-wider uppercase text-[11px] bg-primary/20 text-primary-light border border-primary/30 hover:bg-primary/30 transition-all shadow-lg"
                >
                  Reset Search
                </button>
              }
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
