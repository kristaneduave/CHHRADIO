import React, { useEffect, useRef, useState } from 'react';
import { PatientRecord, SearchFilters } from '../types';
import { supabase } from '../services/supabase';
import { toastError } from '../utils/toast';
import LoadingState from './LoadingState';

interface SearchScreenProps {
  onCaseSelect: (caseItem: any) => void;
}

const OPENED_CASES_STORAGE_KEY = 'chh_database_opened_case_ids_v1';

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

const SearchScreen: React.FC<SearchScreenProps> = ({ onCaseSelect }) => {
  const [query, setQuery] = useState('');
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
  const [results, setResults] = useState<PatientRecord[]>([]);
  const [allCases, setAllCases] = useState<PatientRecord[]>([]);
  const [rawCases, setRawCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchCases();
  }, []);

  const sortCases = (input: PatientRecord[]) => {
    return [...input].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });
  };

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('cases')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      if (data) {
        setRawCases(data);

        // Fetch authors
        const creatorIds = Array.from(new Set(data.map((item: any) => item.created_by).filter(Boolean)));
        let authorMap = new Map<string, string>();

        if (creatorIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, nickname')
            .in('id', creatorIds);

          if (profilesData) {
            authorMap = new Map(
              profilesData.map((p: any) => [
                p.id,
                p.nickname || p.full_name || 'Hospital Staff'
              ])
            );
          }
        }

        const mappedCases: PatientRecord[] = data.map((item: any) => {
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
                item.analysis_result?.impression ||
                item.diagnosis ||
                item.title ||
                (submissionType === 'aunt_minnie' ? 'Aunt Minnie' : 'Interesting Case')
              );
          const displayName = String(impressionTitle).toUpperCase();

          return {
            id: item.id,
            name: displayName,
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
        });
        setAllCases(mappedCases);
        setResults(sortCases(mappedCases));
      }
    } catch (loadError) {
      console.error('Error fetching cases:', loadError);
      setError('Unable to load Database. Please try again.');
      toastError('Failed to load Database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query.trim().length > 0) {
      const matches = allCases
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.initials.toLowerCase().includes(query.toLowerCase()) ||
            p.diagnosticCode.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 4);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [query, allCases]);

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
    setResults((prev) => sortCases(prev));
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

    setResults(sortCases(filtered));
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
    setResults(sortCases(allCases));
  };

  const selectSuggestion = (p: PatientRecord) => {
    setQuery(p.name);
    setShowSuggestions(false);
    setResults(sortCases([p]));
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
    <div className="flex flex-col min-h-full">
      <div className="px-6 pt-6 pb-2 bg-app/80 backdrop-blur-md">
        <header className="flex items-center justify-between min-h-[32px]">
          <h1 className="text-3xl font-bold text-white">Database</h1>
        </header>
      </div>

      <div className="px-6 pt-2 pb-4">
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
            <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                        {getPrimaryMeta(rawCases.find((c) => c.id === p.id), p.submission_type)} - {new Date(p.date).toLocaleDateString('en-US', {
                          month: 'numeric',
                          day: 'numeric',
                          year: '2-digit',
                        })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {showFilters ? (
          <div className="glass-card-enhanced rounded-2xl p-5 mb-6 border-primary/20 bg-primary/[0.02] animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                <span className="material-icons text-sm">filter_alt</span>
                Advanced Filters
              </h3>
              <button
                onClick={clearFilters}
                className="text-[10px] text-slate-500 hover:text-rose-400 font-bold uppercase transition-colors"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Case Type</label>
                <select
                  name="submissionType"
                  value={filters.submissionType}
                  onChange={handleFilterChange}
                  className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all appearance-none"
                >
                  <option value="">All Types</option>
                  <option value="interesting_case" className="bg-surface">Interesting Case</option>
                  <option value="rare_pathology" className="bg-surface">Rare Pathology</option>
                  <option value="aunt_minnie" className="bg-surface">Aunt Minnie</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Date</label>
                <select
                  name="datePreset"
                  value={filters.datePreset}
                  onChange={handleFilterChange}
                  className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all appearance-none"
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
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Sort</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all appearance-none"
                  aria-label="Sort search results"
                >
                  <option value="newest" className="bg-surface">Newest first</option>
                  <option value="oldest" className="bg-surface">Oldest first</option>
                </select>
              </div>
              {filters.datePreset === 'custom' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">From Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">To Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                      className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all"
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Organ System</label>
                <select
                  name="specialty"
                  value={filters.specialty}
                  onChange={handleFilterChange}
                  className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all appearance-none"
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
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                  Diagnostic Code (ICD-10)
                </label>
                <input
                  type="text"
                  name="diagnosticCode"
                  value={filters.diagnosticCode}
                  onChange={handleFilterChange}
                  placeholder="e.g. G30.9"
                  className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white placeholder-slate-600 focus:border-primary transition-all"
                />
              </div>
            </div>

            <button
              onClick={applyFilters}
              className="w-full mt-6 py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg"
            >
              Apply Filters
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

        <div className="space-y-3 pr-1 pt-2">

          {loading && results.length === 0 ? (
            <LoadingState title="Loading Database..." />
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
                  className={`w-full text-left p-4 rounded-2xl backdrop-blur-md transition-all duration-300 relative group ${isRecent
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

                  {isRecent && (
                    <span className={`absolute top-[-3px] -left-2 px-2 py-0.5 rounded-[4px] text-[9px] leading-none font-bold tracking-wider uppercase z-20 ${typeMeta.unreadBadgeClass}`}>
                      New
                    </span>
                  )}

                  <div className="flex items-center gap-3 w-full z-10 relative">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner border ${isRecent ? typeMeta.boxClass : 'bg-black/40 border-white/5'}`}>
                      <span className={`material-icons text-xl ${typeMeta.tintClass}`}>{typeMeta.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center flex-wrap gap-2 min-w-0">
                          <h4 className={`text-[14px] sm:text-[15px] truncate tracking-tight font-bold ${typeMeta.tintClass}`}>
                            {p.name}
                          </h4>
                        </div>
                        <span className="material-icons text-slate-500 group-hover:text-primary transition-colors hover:bg-white/10 hover:text-slate-300 rounded-full h-6 w-6 inline-flex items-center justify-center -mt-1 -mr-1">
                          chevron_right
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] truncate uppercase tracking-wider font-semibold">
                          <span className="text-white opacity-90">{primaryMeta}</span>
                          <span className="text-slate-600 font-bold px-0.5">|</span>
                          <span className="text-slate-300 truncate">{p.author || 'Hospital Staff'}</span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] whitespace-nowrap font-medium uppercase tracking-wider text-slate-500">
                          {new Date(p.date).toLocaleDateString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                <span className="material-icons text-slate-600 text-3xl">sentiment_dissatisfied</span>
              </div>
              <h3 className="text-white font-semibold mb-1">{query ? `No results for "${query}"` : 'No matches found'}</h3>
              <p className="text-xs text-slate-500 mb-3">Adjust your filters or try a different search term.</p>
              <button
                onClick={clearFilters}
                className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-white/15 transition-colors"
              >
                Reset Search
              </button>
            </div>
          )}
        </div>

        {/* Bottom spacer so last cards remain accessible above fixed nav */}
        <div className="h-24 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
};

export default SearchScreen;
