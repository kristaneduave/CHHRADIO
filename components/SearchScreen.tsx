
import React, { useState, useEffect, useRef } from 'react';
import { SPECIALTIES } from '../constants';
import { PatientRecord, SearchFilters } from '../types';
import { supabase } from '../services/supabase';

interface SearchScreenProps {
  onCaseSelect: (caseItem: any) => void;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ onCaseSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PatientRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    startDate: '',
    endDate: '',
    specialty: '',
    diagnosticCode: ''
  });
  const [results, setResults] = useState<PatientRecord[]>([]);
  const [allCases, setAllCases] = useState<PatientRecord[]>([]);
  const [rawCases, setRawCases] = useState<any[]>([]); // Store raw DB data
  const [loading, setLoading] = useState(true);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setRawCases(data); // Save raw data for editing/viewing
        const mappedCases: PatientRecord[] = data.map((item: any) => ({
          id: item.id,
          name: item.patient_initials ? `Patient ${item.patient_initials}` : 'Unknown Patient',
          initials: item.patient_initials || '??',
          age: parseInt(item.patient_age) || 0,
          date: item.created_at,
          specialty: item.organ_system || 'General',
          diagnosticCode: item.diagnosis || 'Pending',
          status: 'Published' // Since we filtered by published
        }));
        setAllCases(mappedCases);
        setResults(mappedCases);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query.trim().length > 0) {
      const matches = allCases.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.initials.toLowerCase().includes(query.toLowerCase()) ||
        p.diagnosticCode.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 4);
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

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    let filtered = allCases.filter(p => {
      const matchQuery = query ? (
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.initials.toLowerCase().includes(query.toLowerCase()) ||
        p.diagnosticCode.toLowerCase().includes(query.toLowerCase())
      ) : true;

      const matchSpecialty = filters.specialty ? p.specialty === filters.specialty : true;
      const matchCode = filters.diagnosticCode ? p.diagnosticCode.toLowerCase().includes(filters.diagnosticCode.toLowerCase()) : true;

      const date = new Date(p.date);
      const start = filters.startDate ? new Date(filters.startDate) : null;
      const end = filters.endDate ? new Date(filters.endDate) : null;
      const matchDate = (!start || date >= start) && (!end || date <= end);

      return matchQuery && matchSpecialty && matchCode && matchDate;
    });
    setResults(filtered);
    setShowFilters(false);
    setShowSuggestions(false);
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', specialty: '', diagnosticCode: '' });
    setResults(allCases);
    setQuery('');
  };

  const selectSuggestion = (p: PatientRecord) => {
    setQuery(p.name);
    setShowSuggestions(false);
    setResults([p]);
  };

  return (
    <div className="px-6 pt-12 pb-12 flex flex-col min-h-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Database</h1>
        <p className="text-slate-400 text-xs">Access centralized patient case library</p>
      </header>

      <div className="relative mb-4 z-40" ref={suggestionsRef}>
        <div className="relative group">
          <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, initials or code..."
            className="w-full bg-white/5 border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-slate-600 focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all text-base md:text-sm"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg transition-all ${showFilters ? 'bg-primary text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-icons text-lg">tune</span>
          </button>
        </div>

        {/* Real-time Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {suggestions.map((p) => (
              <button
                key={p.id}
                onClick={() => selectSuggestion(p)}
                className="w-full px-5 py-3 flex items-center gap-3 hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0 text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-primary border border-white/5">
                  {p.initials}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{p.diagnosticCode} • {p.specialty}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="glass-card-enhanced rounded-2xl p-5 mb-6 border-primary/20 bg-primary/[0.02] animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <span className="material-icons text-sm">filter_alt</span>
              Advanced Filters
            </h3>
            <button onClick={clearFilters} className="text-[10px] text-slate-500 hover:text-rose-400 font-bold uppercase transition-colors">Clear All</button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">From Date</label>
              <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">To Date</label>
              <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Specialty</label>
              <select name="specialty" value={filters.specialty} onChange={handleFilterChange} className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white focus:border-primary transition-all appearance-none">
                <option value="">All Specialties</option>
                {SPECIALTIES.map(s => <option key={s} value={s} className="bg-[#0c1829]">{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Diagnostic Code (ICD-10)</label>
              <input type="text" name="diagnosticCode" value={filters.diagnosticCode} onChange={handleFilterChange} placeholder="e.g. G30.9" className="w-full bg-white/5 border-white/10 rounded-xl px-3 py-2 text-base md:text-xs text-white placeholder-slate-600 focus:border-primary transition-all" />
            </div>
          </div>

          <button
            onClick={applyFilters}
            className="w-full mt-6 py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg"
          >
            Apply Filters
          </button>
        </div>
      )}

      {/* Search Results */}
      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
        <div className="flex justify-between items-center mb-2 px-1">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {loading ? 'Loading...' : `${results.length} Result${results.length !== 1 ? 's' : ''} Found`}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : results.length > 0 ? (
          results.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                const raw = rawCases.find(c => c.id === p.id);
                if (raw && onCaseSelect) onCaseSelect(raw);
              }}
              className="glass-card-enhanced p-4 rounded-xl border border-white/5 hover:border-primary/30 hover:bg-white/[0.03] transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-white/5 font-bold text-sm shadow-[inset_0_0_15px_rgba(13,162,231,0.1)]">
                  {p.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                    <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${p.status === 'Completed' || p.status === 'Published' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.status === 'Pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'
                      }`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-tighter">
                    <span>{p.specialty}</span>
                    <span className="text-slate-700">|</span>
                    <span className="text-primary/70 font-semibold">{p.diagnosticCode}</span>
                    <span className="text-slate-700">|</span>
                    <span>{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <span className="material-icons text-slate-600 group-hover:text-primary transition-colors text-lg">chevron_right</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
              <span className="material-icons text-slate-600 text-3xl">sentiment_dissatisfied</span>
            </div>
            <h3 className="text-white font-semibold mb-1">No matches found</h3>
            <p className="text-xs text-slate-500">Adjust your filters or try a different search term.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchScreen;

