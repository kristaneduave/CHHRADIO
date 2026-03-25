import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { QuizAuthorFormValues, QuizListItem, QuizQuestion } from '../../types';
import CreateQuizModal from './CreateQuizModal';

interface ManageQuizzesPanelProps {
  quizzes: QuizListItem[];
  quizQuestions: Record<string, QuizQuestion[]>;
  onCreate: (values: QuizAuthorFormValues) => Promise<void>;
  onEdit: (quizId: string, values: QuizAuthorFormValues) => Promise<void>;
  onDuplicate: (quizId: string) => Promise<void>;
  onDelete: (quizId: string) => Promise<void>;
}

const ManageQuizzesPanel: React.FC<ManageQuizzesPanelProps> = ({
  quizzes,
  quizQuestions,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [editingQuiz, setEditingQuiz] = useState<QuizListItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filteredQuizzes = useMemo(
    () => quizzes.filter((quiz) => statusFilter === 'all' || quiz.status === statusFilter),
    [quizzes, statusFilter],
  );

  const runAction = async (quizId: string, action: () => Promise<void>) => {
    setLoadingId(quizId);
    try {
      await action();
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <div className="rounded-[2rem] border border-white/10 bg-[#08111a]/80 p-5 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Manage Quizzes</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Faculty Authoring Workspace</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">Create and manage quiz drafts, publishing windows, and timed assessments.</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="rounded-[1.4rem] border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 font-bold text-white">
            Create Quiz
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'draft', 'published', 'archived'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] border ${statusFilter === status
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-white/5 border-white/10 text-slate-400'
                }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredQuizzes.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-white/10 p-6 text-sm text-slate-400">No quizzes match this filter.</div>
          ) : (
            filteredQuizzes.map((quiz) => (
              <div key={quiz.id} className="rounded-[1.6rem] border border-white/5 bg-black/10 p-4">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-slate-300">{quiz.status}</span>
                      <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-slate-300">{quiz.specialty}</span>
                      {quiz.timer_enabled && <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] uppercase tracking-[0.2em] text-rose-300">{quiz.timer_minutes} min</span>}
                    </div>
                    <h4 className="text-lg font-semibold text-white">{quiz.title}</h4>
                    <p className="text-sm text-slate-400 mt-2">{quiz.question_count || 0} questions • Opens {format(new Date(quiz.opens_at), 'PPp')} • Closes {format(new Date(quiz.closes_at), 'PPp')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditingQuiz(quiz)} className="px-3 py-2 rounded-xl border border-white/10 text-slate-300">Edit</button>
                    <button type="button" onClick={() => runAction(quiz.id, () => onDuplicate(quiz.id))} className="px-3 py-2 rounded-xl border border-white/10 text-slate-300" disabled={loadingId === quiz.id}>Duplicate</button>
                    <button type="button" onClick={() => runAction(quiz.id, () => onDelete(quiz.id))} className="px-3 py-2 rounded-xl border border-rose-500/20 text-rose-300" disabled={loadingId === quiz.id}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreate && <CreateQuizModal onClose={() => setShowCreate(false)} onSave={onCreate} />}

      {editingQuiz && (
        <CreateQuizModal
          quiz={editingQuiz}
          questions={quizQuestions[editingQuiz.id] || []}
          onClose={() => setEditingQuiz(null)}
          onSave={async (values) => onEdit(editingQuiz.id, values)}
        />
      )}
    </>
  );
};

export default ManageQuizzesPanel;
