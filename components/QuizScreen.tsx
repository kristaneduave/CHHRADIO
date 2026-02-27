import React, { useEffect, useMemo, useState } from 'react';
import { SPECIALTIES } from '../constants';
import { createSystemNotification, fetchAllRecipientUserIds } from '../services/newsfeedService';
import {
  fetchQuizAnalytics,
  getQuizBootstrapContext,
  listExamQuestions,
  listManageExams,
  listPublishedExamsWithCounts,
  QuizExamWithCounts,
  saveExamWithQuestions,
  submitQuizAttempt,
  updateExamStatus,
} from '../services/quizService';
import {
  QuizAnswerMap,
  QuizAttemptSummary,
  QuizClientEvent,
  QuizExam,
  QuizExamAnalyticsRow,
  QuizGroupAnalyticsRow,
  QuizQuestion,
  QuizQuestionAnalyticsRow,
  QuizUserAnalyticsRow,
  UserRole,
} from '../types';
import { getRoleLabel } from '../utils/roles';
import { toastError, toastInfo, toastSuccess } from '../utils/toast';
import LoadingState from './LoadingState';

type Tab = 'take' | 'manage' | 'analytics';
type ExamRow = QuizExamWithCounts;

type DraftQuestion = {
  id?: string;
  tempId: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
  points: number;
};

const PROGRESS_KEY = 'chh_quiz_progress_v2';
const n = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const e = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const QuizScreen: React.FC = () => {
  const [role, setRole] = useState<UserRole>('resident');
  const [uid, setUid] = useState('');
  const [tab, setTab] = useState<Tab>('take');
  const [boot, setBoot] = useState(true);

  const [examsLoading, setExamsLoading] = useState(true);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('All');
  const [activeExam, setActiveExam] = useState<ExamRow | null>(null);
  const [allQs, setAllQs] = useState<QuizQuestion[]>([]);
  const [sessionQs, setSessionQs] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswerMap>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [seenAt, setSeenAt] = useState(0);
  const [events, setEvents] = useState<QuizClientEvent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<QuizAttemptSummary | null>(null);
  const [practice, setPractice] = useState(false);

  const [manageLoading, setManageLoading] = useState(false);
  const [manageExams, setManageExams] = useState<ExamRow[]>([]);
  const [editExam, setEditExam] = useState({
    id: null as string | null,
    title: '',
    specialty: SPECIALTIES[0] || 'Neuroradiology',
    description: '',
    duration_minutes: 30,
    pass_mark_percent: 70,
    status: 'draft' as 'draft' | 'published' | 'archived',
  });
  const [editQs, setEditQs] = useState<DraftQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  const [anLoading, setAnLoading] = useState(false);
  const [examAn, setExamAn] = useState<QuizExamAnalyticsRow[]>([]);
  const [questionAn, setQuestionAn] = useState<QuizQuestionAnalyticsRow[]>([]);
  const [userAn, setUserAn] = useState<QuizUserAnalyticsRow[]>([]);
  const [groupAn, setGroupAn] = useState<QuizGroupAnalyticsRow[]>([]);

  const canManage = role === 'training_officer' || role === 'admin' || role === 'moderator';
  const canAnalytics = canManage;
  const q = sessionQs[idx];
  const unanswered = sessionQs.filter((x) => answers[x.id]?.selected_answer_index == null).length;
  const key = activeExam && uid ? `${PROGRESS_KEY}:${uid}:${activeExam.id}` : '';

  const filteredExams = useMemo(() => {
    const s = search.trim().toLowerCase();
    return exams.filter((x) => (spec === 'All' || x.specialty === spec) && (!s || x.title.toLowerCase().includes(s) || (x.description || '').toLowerCase().includes(s)));
  }, [exams, search, spec]);

  const review = useMemo(() => {
    if (!summary) return [] as Array<{ q: QuizQuestion; sel: number | null; ok: boolean }>;
    return allQs.map((x) => {
      const sel = answers[x.id]?.selected_answer_index ?? null;
      return { q: x, sel, ok: sel === x.correct_answer_index };
    });
  }, [allQs, answers, summary]);

  useEffect(() => { void bootstrap(); }, []);
  useEffect(() => {
    if (!boot) {
      void loadExams();
      if (canManage) void loadManage();
      if (canAnalytics) void loadAnalytics();
    }
  }, [boot, canManage, canAnalytics]);

  useEffect(() => {
    if (activeExam && q) {
      setSeenAt(Date.now());
      setEvents((p) => [...p, { event_type: 'question_view', question_id: q.id, event_at: new Date().toISOString(), meta: {} }]);
    }
  }, [activeExam?.id, idx]);

  useEffect(() => {
    if (key && activeExam) {
      localStorage.setItem(key, JSON.stringify({ answers, idx, startedAt, questionIds: sessionQs.map((x) => x.id), practice }));
    }
  }, [key, activeExam, answers, idx, startedAt, sessionQs, practice]);

  const bootstrap = async () => {
    try {
      const context = await getQuizBootstrapContext();
      setUid(context.uid);
      setRole(context.role);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toastError('Quiz init failed', message);
    } finally {
      setBoot(false);
    }
  };

  const loadExams = async () => {
    try {
      setExamsLoading(true);
      setExams(await listPublishedExamsWithCounts());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toastError('Failed to load exams', message);
      setExams([]);
    } finally {
      setExamsLoading(false);
    }
  };

  const loadQuestions = async (examId: string): Promise<QuizQuestion[]> => {
    return listExamQuestions(examId);
  };

  const startExam = async (exam: ExamRow) => {
    try {
      const qs = await loadQuestions(exam.id);
      if (!qs.length) return toastInfo('No questions yet');
      setActiveExam(exam);
      setAllQs(qs);
      setSessionQs(qs);
      setIdx(0);
      setSummary(null);
      setPractice(false);
      setStartedAt(new Date().toISOString());
      setAnswers({});
      setEvents([{ event_type: 'start', question_id: null, event_at: new Date().toISOString(), meta: {} }]);
      const restoreKey = `${PROGRESS_KEY}:${uid}:${exam.id}`;
      const raw = localStorage.getItem(restoreKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.answers) setAnswers(saved.answers);
        if (saved?.idx != null) setIdx(Math.max(0, Math.min(Number(saved.idx), qs.length - 1)));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toastError('Failed to start exam', message);
    }
  };

  const stamp = () => {
    if (!q) return;
    const elapsed = Math.max(0, Date.now() - seenAt);
    setAnswers((p) => ({
      ...p,
      [q.id]: {
        selected_answer_index: p[q.id]?.selected_answer_index as number,
        response_time_ms: n(p[q.id]?.response_time_ms) + elapsed,
      },
    }));
  };

  const selectOpt = (i: number) => {
    if (!q) return;
    setAnswers((p) => ({ ...p, [q.id]: { selected_answer_index: i, response_time_ms: n(p[q.id]?.response_time_ms) } }));
    setEvents((p) => [...p, { event_type: 'question_answer', question_id: q.id, event_at: new Date().toISOString(), meta: { selected_answer_index: i } }]);
  };

  const submit = async () => {
    if (!activeExam) return;
    stamp();
    if (unanswered > 0 && !window.confirm(`Submit with ${unanswered} unanswered question(s)?`)) return;

    if (practice) {
      const total = sessionQs.reduce((a, x) => a + n(x.points, 1), 0);
      const score = sessionQs.reduce((a, x) => a + (answers[x.id]?.selected_answer_index === x.correct_answer_index ? n(x.points, 1) : 0), 0);
      const correct = sessionQs.filter((x) => answers[x.id]?.selected_answer_index === x.correct_answer_index).length;
      setSummary({ attempt_id: `practice-${Date.now()}`, score, total_points: total, correct_count: correct, is_pass: total > 0 ? (score / total) * 100 >= activeExam.pass_mark_percent : false, duration_seconds: 0, completed_at: new Date().toISOString() });
      return;
    }

    try {
      setSubmitting(true);
      setSummary(
        await submitQuizAttempt(activeExam.id, answers, startedAt || new Date().toISOString(), [
          ...events,
          { event_type: 'submit', question_id: null, event_at: new Date().toISOString(), meta: {} },
        ]),
      );
      if (key) localStorage.removeItem(key);
      toastSuccess('Exam submitted');
      void loadExams();
      if (canAnalytics) void loadAnalytics();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toastError('Submit failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const retryWrong = () => {
    const wrong = allQs.filter((x) => answers[x.id]?.selected_answer_index !== x.correct_answer_index);
    if (!wrong.length) return toastInfo('No incorrect questions');
    setSessionQs(wrong);
    setIdx(0);
    setSummary(null);
    setPractice(true);
    setStartedAt(new Date().toISOString());
    setAnswers((p) => {
      const next: QuizAnswerMap = { ...p };
      wrong.forEach((x) => (next[x.id] = { response_time_ms: 0 }));
      return next;
    });
  };

  const backToList = () => {
    if (key) localStorage.removeItem(key);
    setActiveExam(null);
    setAllQs([]);
    setSessionQs([]);
    setIdx(0);
    setAnswers({});
    setSummary(null);
    setPractice(false);
  };

  const loadManage = async () => {
    if (!canManage) return;
    try {
      setManageLoading(true);
      setManageExams(await listManageExams(role, uid));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toastError('Manage load failed', message);
    } finally {
      setManageLoading(false);
    }
  };

  const newExam = () => {
    setEditExam({ id: null, title: '', specialty: SPECIALTIES[0] || 'Neuroradiology', description: '', duration_minutes: 30, pass_mark_percent: 70, status: 'draft' });
    setEditQs([{ tempId: `${Date.now()}`, question_text: '', options: ['', '', '', ''], correct_answer_index: 0, explanation: '', points: 1 }]);
  };

  const openExam = async (id: string) => {
    const ex = manageExams.find((x) => x.id === id);
    if (!ex) return;
    setEditExam({ id: ex.id, title: ex.title, specialty: ex.specialty, description: ex.description || '', duration_minutes: ex.duration_minutes, pass_mark_percent: ex.pass_mark_percent, status: ex.status });
    const qs = await loadQuestions(id);
    setEditQs(qs.map((x, i) => ({ id: x.id, tempId: `${x.id}-${i}`, question_text: x.question_text, options: x.options.length ? x.options : ['', '', '', ''], correct_answer_index: x.correct_answer_index, explanation: x.explanation || '', points: x.points })));
  };

  const save = async () => {
    if (!editExam.title.trim()) return toastError('Exam title required');
    const valid = editQs.filter((x) => x.question_text.trim());
    if (!valid.length) return toastError('At least one question required');
    if (valid.some((x) => x.options.filter((o) => o.trim()).length < 2 || !x.explanation.trim())) return toastError('Each question needs at least two options and explanation');
    try {
      setSaving(true);
      const { examId: id, isNewExam } = await saveExamWithQuestions(
        editExam,
        uid,
        valid.map((item) => ({
          question_text: item.question_text,
          options: item.options,
          correct_answer_index: item.correct_answer_index,
          explanation: item.explanation,
          points: item.points,
          question_type: 'mcq',
        })),
      );

      try {
        const recipients = await fetchAllRecipientUserIds();
        const isPublished = editExam.status === 'published';
        await createSystemNotification({
          actorUserId: uid,
          type: 'quiz',
          severity: isPublished ? 'warning' : 'info',
          title: isNewExam ? 'New Quiz Created' : 'Quiz Updated',
          message: `${editExam.title}${isPublished ? ' (Published)' : ''}`,
          linkScreen: 'quiz',
          linkEntityId: id,
          recipientUserIds: recipients.length > 0 ? recipients : [uid],
        });
      } catch (notifError) {
        console.error('Failed to emit quiz notification:', notifError);
      }

      toastSuccess('Exam saved');
      await Promise.all([loadManage(), loadExams()]);
      if (canAnalytics) await loadAnalytics();
      setEditExam((p) => ({ ...p, id }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toastError('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: QuizExam['status']) => {
    try {
      await updateExamStatus(id, status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      return toastError('Status update failed', message);
    }

    if (status === 'published') {
      try {
        const exam = manageExams.find((x) => x.id === id);
        const recipients = await fetchAllRecipientUserIds();
        await createSystemNotification({
          actorUserId: uid,
          type: 'quiz',
          severity: 'warning',
          title: 'Quiz Published',
          message: exam?.title || 'A quiz was published',
          linkScreen: 'quiz',
          linkEntityId: id,
          recipientUserIds: recipients.length > 0 ? recipients : [uid],
        });
      } catch (notifError) {
        console.error('Failed to emit quiz publish notification:', notifError);
      }
    }

    toastSuccess(`Exam marked ${status}`);
    await Promise.all([loadManage(), loadExams()]);
  };

  const loadAnalytics = async () => {
    if (!canAnalytics) return;
    try {
      setAnLoading(true);
      const analytics = await fetchQuizAnalytics();
      setExamAn(analytics.exams);
      setQuestionAn(analytics.questions);
      setUserAn(analytics.users);
      setGroupAn(analytics.groups);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toastError('Analytics load failed', message);
    } finally {
      setAnLoading(false);
    }
  };

  const exportCsv = () => {
    const rows = [['Exam', 'Specialty', 'Attempts', 'Avg Score %', 'Pass Rate %'], ...examAn.map((x) => [x.exam_title, x.specialty, x.attempts_count, x.avg_score_percent, x.pass_rate_percent])];
    const csv = rows.map((r) => r.map(e).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (boot) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <LoadingState title="Loading quiz..." />
      </div>
    );
  }

  return (
    <div className="px-6 pt-6 pb-6 h-full flex flex-col">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-white">Medical Quiz</h1>
      </header>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('take')} className={`px-3 py-2 rounded-xl text-xs border ${tab === 'take' ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}>Take Exams</button>
        {canManage ? <button onClick={() => setTab('manage')} className={`px-3 py-2 rounded-xl text-xs border ${tab === 'manage' ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}>Manage Exams</button> : null}
        {canAnalytics ? <button onClick={() => setTab('analytics')} className={`px-3 py-2 rounded-xl text-xs border ${tab === 'analytics' ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}>Analytics</button> : null}
      </div>

      {tab === 'take' ? (
        <div className="flex-1 min-h-0">
          {!activeExam ? (
            <>
              <div className="glass-card-enhanced border border-white/10 rounded-2xl p-3 mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="relative group flex bg-black/40 p-1.5 rounded-[1.25rem] border border-white/5 backdrop-blur-md shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                  <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[19px] text-slate-500 group-focus-within:text-primary transition-colors">search</span>
                  <input value={search} onChange={(x) => setSearch(x.target.value)} placeholder="Search exams..." className="w-full h-10 bg-transparent border-0 rounded-xl pl-[2.75rem] pr-3 text-[13px] font-bold text-white placeholder-slate-500 focus:ring-0 focus:outline-none transition-all" />
                </div>
                <div className="relative group flex bg-black/40 p-1.5 rounded-[1.25rem] border border-white/5 backdrop-blur-md shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                  <select value={spec} onChange={(x) => setSpec(x.target.value)} className="w-full h-10 appearance-none bg-transparent border-0 rounded-xl px-4 text-[13px] font-bold text-slate-300 focus:outline-none cursor-pointer hover:bg-white/5 transition-colors">
                    <option value="All">All specialties</option>
                    {[...new Set([...SPECIALTIES, ...exams.map((x) => x.specialty)])].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <span className="material-icons pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[19px] text-slate-500 transition-colors">expand_more</span>
                </div>
              </div>

              {examsLoading ? <div className="text-sm text-slate-400">Loading exams...</div> : filteredExams.length === 0 ? <div className="text-sm text-slate-400">No published exams yet.</div> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredExams.map((x) => (
                    <div key={x.id} className="glass-card-enhanced border border-white/10 rounded-2xl p-4">
                      <h3 className="text-white font-semibold">{x.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{x.specialty}</p>
                      <p className="text-xs text-slate-400 mt-2">{x.question_count} questions - {x.duration_minutes}m - pass {x.pass_mark_percent}%</p>
                      <button onClick={() => void startExam(x)} className="mt-3 text-xs px-3 py-2 rounded-xl bg-primary text-white">Start Exam</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : summary ? (
            <div className="space-y-3">
              <div className="glass-card-enhanced border border-white/10 rounded-2xl p-4">
                <h3 className="text-white font-semibold">{practice ? 'Practice Retry Complete' : 'Exam Complete'}</h3>
                <p className="text-sm text-slate-300 mt-1">Score {summary.score}/{summary.total_points} ({summary.total_points ? Math.round((summary.score / summary.total_points) * 100) : 0}%)</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={retryWrong} className="text-xs px-3 py-2 rounded-xl bg-primary text-white">Retry Incorrect Only</button>
                  <button onClick={backToList} className="text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300">Back to Exams</button>
                </div>
              </div>

              <div className="glass-card-enhanced border border-white/10 rounded-2xl p-4 max-h-[50vh] overflow-y-auto">
                <h4 className="text-white text-sm font-semibold mb-3">Review</h4>
                <div className="space-y-2">
                  {review.map((r, i) => (
                    <div key={r.q.id} className={`rounded-xl border px-3 py-2 text-xs ${r.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
                      <p className="text-slate-200">Q{i + 1}. {r.q.question_text}</p>
                      <p className="text-slate-400 mt-1">Your answer: {r.sel == null ? 'Unanswered' : `${String.fromCharCode(65 + r.sel)}. ${r.q.options[r.sel] || '-'}`}</p>
                      <p className="text-slate-300">Correct: {String.fromCharCode(65 + r.q.correct_answer_index)}. {r.q.options[r.q.correct_answer_index] || '-'}</p>
                      <p className="text-slate-400">Explanation: {r.q.explanation || 'No explanation provided.'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card-enhanced border border-white/10 rounded-2xl p-4">
              <button onClick={backToList} className="text-xs text-slate-400 mb-2">← Back to Exams</button>
              <p className="text-xs text-slate-400 mb-1">Question {idx + 1}/{sessionQs.length} - {unanswered} unanswered</p>
              <h3 className="text-white font-semibold mb-3">{q?.question_text}</h3>
              <div className="space-y-2">
                {q?.options.map((o, i) => (
                  <button key={i} onClick={() => selectOpt(i)} className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${answers[q.id]?.selected_answer_index === i ? 'border-primary/50 bg-primary/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                    {String.fromCharCode(65 + i)}. {o}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-between">
                <button disabled={idx === 0} onClick={() => { stamp(); setIdx((x) => Math.max(0, x - 1)); }} className="text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 disabled:opacity-40">Previous</button>
                {idx < sessionQs.length - 1 ? <button onClick={() => { stamp(); setIdx((x) => Math.min(sessionQs.length - 1, x + 1)); }} className="text-xs px-3 py-2 rounded-xl bg-primary text-white">Next</button> : <button disabled={submitting} onClick={submit} className="text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-40">{submitting ? 'Submitting...' : practice ? 'Finish Retry' : 'Submit Exam'}</button>}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'manage' && canManage ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="glass-card-enhanced border border-white/10 rounded-2xl p-4 overflow-y-auto">
            <div className="flex justify-between mb-3"><h3 className="text-white text-sm font-semibold">Exam Library</h3><button onClick={newExam} className="text-xs px-2 py-1 rounded-lg bg-primary text-white">New</button></div>
            {manageLoading ? <p className="text-xs text-slate-400">Loading...</p> : manageExams.map((x) => (
              <div key={x.id} className="border border-white/10 rounded-xl p-3 mb-2">
                <p className="text-sm text-white">{x.title}</p>
                <p className="text-[11px] text-slate-500">{x.specialty} - {x.status}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => void openExam(x.id)} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-300">Edit</button>
                  {x.status === 'published' ? <button onClick={() => void setStatus(x.id, 'draft')} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-300">Unpublish</button> : <button onClick={() => void setStatus(x.id, 'published')} className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white">Publish</button>}
                  <button onClick={() => void setStatus(x.id, 'archived')} className="text-[10px] px-2 py-1 rounded bg-amber-600 text-white">Archive</button>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card-enhanced border border-white/10 rounded-2xl p-4 overflow-y-auto">
            <h3 className="text-white text-sm font-semibold mb-3">Exam Editor</h3>
            <input value={editExam.title} onChange={(x) => setEditExam((p) => ({ ...p, title: x.target.value }))} placeholder="Exam title" className="w-full mb-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200" />
            <div className="grid grid-cols-3 gap-2 mb-2">
              <select value={editExam.specialty} onChange={(x) => setEditExam((p) => ({ ...p, specialty: x.target.value }))} className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-slate-200">{SPECIALTIES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              <input type="number" value={editExam.duration_minutes} onChange={(x) => setEditExam((p) => ({ ...p, duration_minutes: n(x.target.value, 30) }))} className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-slate-200" placeholder="Minutes" />
              <input type="number" value={editExam.pass_mark_percent} onChange={(x) => setEditExam((p) => ({ ...p, pass_mark_percent: n(x.target.value, 70) }))} className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-slate-200" placeholder="Pass %" />
            </div>
            <textarea value={editExam.description} onChange={(x) => setEditExam((p) => ({ ...p, description: x.target.value }))} rows={2} placeholder="Description" className="w-full mb-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200" />
            <div className="flex justify-between mb-2"><p className="text-xs text-slate-400 uppercase">Questions</p><button onClick={() => setEditQs((p) => [...p, { tempId: `${Date.now()}-${Math.random()}`, question_text: '', options: ['', '', '', ''], correct_answer_index: 0, explanation: '', points: 1 }])} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-300">Add</button></div>
            <div className="space-y-2">
              {editQs.map((x) => (
                <div key={x.tempId} className="border border-white/10 rounded-xl p-2">
                  <textarea value={x.question_text} onChange={(ev) => setEditQs((p) => p.map((z) => z.tempId === x.tempId ? { ...z, question_text: ev.target.value } : z))} rows={2} placeholder="Question text" className="w-full mb-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200" />
                  {x.options.map((o, i) => (
                    <div key={i} className="flex gap-1 mb-1">
                      <input value={o} onChange={(ev) => setEditQs((p) => p.map((z) => z.tempId === x.tempId ? { ...z, options: z.options.map((k, j) => j === i ? ev.target.value : k) } : z))} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200" placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                      <input type="radio" name={`correct-${x.tempId}`} checked={x.correct_answer_index === i} onChange={() => setEditQs((p) => p.map((z) => z.tempId === x.tempId ? { ...z, correct_answer_index: i } : z))} />
                    </div>
                  ))}
                  <textarea value={x.explanation} onChange={(ev) => setEditQs((p) => p.map((z) => z.tempId === x.tempId ? { ...z, explanation: ev.target.value } : z))} rows={2} placeholder="Explanation (required)" className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditExam((p) => ({ ...p, status: 'draft' }))} className="text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300">Draft</button>
              <button onClick={() => setEditExam((p) => ({ ...p, status: 'published' }))} className="text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white">Published</button>
              <button disabled={saving} onClick={() => void save()} className="text-xs px-3 py-2 rounded-xl bg-primary text-white disabled:opacity-40">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'analytics' && canAnalytics ? (
        <div className="flex-1 min-h-0 space-y-3">
          <div className="flex justify-between items-center"><h3 className="text-sm text-white font-semibold">Comprehensive Quiz Analytics</h3><button onClick={exportCsv} className="text-xs px-3 py-2 rounded-xl bg-primary text-white">Export CSV</button></div>
          {anLoading ? <p className="text-sm text-slate-400">Loading analytics...</p> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="glass-card-enhanced border border-white/10 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Exam Rows</p><p className="text-lg text-white font-bold">{examAn.length}</p></div>
                <div className="glass-card-enhanced border border-white/10 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Question Rows</p><p className="text-lg text-white font-bold">{questionAn.length}</p></div>
                <div className="glass-card-enhanced border border-white/10 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">User Rows</p><p className="text-lg text-white font-bold">{userAn.length}</p></div>
                <div className="glass-card-enhanced border border-white/10 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Group Rows</p><p className="text-lg text-white font-bold">{groupAn.length}</p></div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-h-0">
                <div className="glass-card-enhanced border border-white/10 rounded-2xl p-3 overflow-y-auto"><h4 className="text-sm text-white font-semibold mb-2">Exam Analytics</h4><div className="space-y-2">{examAn.slice(0, 30).map((x, i: number) => <div key={`${x.exam_id}-${i}`} className="border border-white/10 rounded-xl p-2 text-xs"><p className="text-slate-100">{x.exam_title}</p><p className="text-slate-400">{x.specialty}</p><p className="text-slate-400 mt-1">Attempts {x.attempts_count} - Avg {n(x.avg_score_percent).toFixed(1)}% - Pass {n(x.pass_rate_percent).toFixed(1)}%</p></div>)}</div></div>
                <div className="glass-card-enhanced border border-white/10 rounded-2xl p-3 overflow-y-auto"><h4 className="text-sm text-white font-semibold mb-2">Question Diagnostics</h4><div className="space-y-2">{questionAn.slice(0, 30).map((x, i: number) => <div key={`${x.question_id}-${i}`} className="border border-white/10 rounded-xl p-2 text-xs"><p className="text-slate-100">Q{n(x.sort_order) + 1} - {x.exam_title}</p><p className="text-slate-400">{x.question_text}</p><p className="text-slate-400 mt-1">Correct {n(x.correct_rate_percent).toFixed(1)}% - Resp {Math.round(n(x.avg_response_time_ms))}ms - Disc {n(x.discrimination_proxy).toFixed(3)}</p></div>)}</div></div>
                <div className="glass-card-enhanced border border-white/10 rounded-2xl p-3 overflow-y-auto"><h4 className="text-sm text-white font-semibold mb-2">User Performance</h4><div className="space-y-2">{userAn.slice(0, 30).map((x, i: number) => <div key={`${x.user_id}-${i}`} className="border border-white/10 rounded-xl p-2 text-xs"><p className="text-slate-100">{x.full_name || x.username || 'Unknown'}</p><p className="text-slate-400">{getRoleLabel(x.role)}</p><p className="text-slate-400 mt-1">Attempts {x.attempts_count} - Avg {n(x.avg_score_percent).toFixed(1)}% - Pass {n(x.pass_rate_percent).toFixed(1)}%</p></div>)}</div></div>
                <div className="glass-card-enhanced border border-white/10 rounded-2xl p-3 overflow-y-auto"><h4 className="text-sm text-white font-semibold mb-2">Group Performance</h4><div className="space-y-2">{groupAn.slice(0, 30).map((x, i: number) => <div key={`${x.role}-${x.year_level}-${i}`} className="border border-white/10 rounded-xl p-2 text-xs"><p className="text-slate-100">{getRoleLabel(x.role)} - {x.year_level || '-'}</p><p className="text-slate-400 mt-1">Attempts {x.attempts_count} - Learners {x.learners_count} - Avg {n(x.avg_score_percent).toFixed(1)}%</p></div>)}</div></div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default QuizScreen;
