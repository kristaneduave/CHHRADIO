import React, { useEffect, useRef, useState } from 'react';
import { PatientRecord, SearchFilters } from '../types';
import { supabase } from '../services/supabase';
import { toastError } from '../utils/toast';
import LoadingState from './LoadingState';

interface SearchScreenProps {
  onCaseSelect: (caseItem: any) => void;
}

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
        tintClass: 'text-rose-300',
        boxClass: 'bg-gradient-to-br from-rose-500/15 to-rose-900/20 border-rose-500/25',
      };
    case 'aunt_minnie':
      return {
        icon: 'psychology',
        tintClass: 'text-amber-300',
        boxClass: 'bg-gradient-to-br from-amber-500/15 to-amber-900/20 border-amber-500/25',
      };
    default:
      return {
        icon: 'library_books',
        tintClass: 'text-primary',
        boxClass: 'bg-gradient-to-br from-primary/20 to-blue-900/20 border-primary/30',
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
          };
        });
        setAllCases(mappedCases);
        setResults(sortCases(mappedCases));
      }
    } catch (loadError) {
      console.error('Error fetching cases:', loadError);
      setError('Unable to load case library. Please try again.');
      toastError('Failed to load case library');
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
  };

  const activeFilterChips = [
    query ? `Query: ${query}` : '',
    filters.submissionType
      ? `Type: ${
          filters.submissionType === 'interesting_case'
            ? 'Interesting Case'
            : filters.submissionType === 'rare_pathology'
              ? 'Rare Pathology'
              : 'Aunt Minnie'
        }`
      : '',
    filters.specialty ? `Organ system: ${filters.specialty}` : '',
    filters.diagnosticCode ? `Code: ${filters.diagnosticCode}` : '',
    filters.datePreset !== 'all'
      ? `Date: ${
          filters.datePreset === 'custom'
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
    <div className="px-6 pt-12 pb-24 flex flex-col min-h-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Case Library</h1>
        <p className="text-slate-400 text-xs">Access centralized patient case library</p>
      </header>

      <div className="relative mb-4 z-40" ref={suggestionsRef}>
        <div className="relative group">
          <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
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
            className="w-full bg-white/5 border-white/10 rounded-2xl py-4 pl-12 pr-20 text-white placeholder-slate-600 focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all text-base md:text-sm"
            aria-label="Search case library"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                applyFilters();
              }}
              className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Clear search"
            >
              <span className="material-icons text-sm">close</span>
            </button>
          ) : null}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
              showFilters ? 'bg-primary text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Toggle advanced filters"
          >
            <span className="material-icons text-lg">tune</span>
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

      <div className="mb-3 flex flex-wrap gap-1.5 px-1">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
          Sort: {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
        </span>
        {activeFilterChips.map((chip) => (
          <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
            {chip}
          </span>
        ))}
      </div>

      <div className="space-y-3 pr-1">
        <div className="flex justify-between items-center mb-2 px-1">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {loading ? 'Loading...' : `${results.length} Result${results.length !== 1 ? 's' : ''} Found`}
          </p>
        </div>

        {loading && results.length === 0 ? (
          <LoadingState title="Loading case library..." />
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
            return (
            <div
              key={p.id}
              onClick={() => {
                if (raw && onCaseSelect) onCaseSelect(raw);
              }}
              className="glass-card-enhanced p-4 rounded-xl border border-white/5 hover:border-primary/30 hover:bg-white/[0.03] transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-[inset_0_0_15px_rgba(13,162,231,0.1)] ${typeMeta.boxClass}`}>
                  <span className={`material-icons text-lg ${typeMeta.tintClass}`}>{typeMeta.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5 gap-2">
                    <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-tighter">
                    <span>{primaryMeta}</span>
                    <span className="text-slate-700">|</span>
                    <span>
                      {new Date(p.date).toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <span className="material-icons text-slate-600 group-hover:text-primary transition-colors text-lg">
                  chevron_right
                </span>
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
  );
};

export default SearchScreen;
