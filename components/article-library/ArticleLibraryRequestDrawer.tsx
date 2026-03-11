import React from 'react';

interface ArticleLibraryRequestFormState {
  title: string;
  source_url: string;
  description: string;
}

interface ArticleLibraryRequestDrawerProps {
  open: boolean;
  requestForm: ArticleLibraryRequestFormState;
  setRequestForm: React.Dispatch<React.SetStateAction<ArticleLibraryRequestFormState>>;
  onSubmit: () => void;
  isSubmitting: boolean;
}

const ArticleLibraryRequestDrawer: React.FC<ArticleLibraryRequestDrawerProps> = ({
  open,
  requestForm,
  setRequestForm,
  onSubmit,
  isSubmitting,
}) => {
  if (!open) return null;

  return (
    <div className="mt-2 rounded-3xl border border-white/10 bg-[#08121d]/90 p-4 shadow-2xl backdrop-blur-md">
      <div className="space-y-1">
        <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Request a topic</h2>
        <p className="text-xs leading-5 text-slate-400">Suggest a topic, file, or update for the Article Library.</p>
      </div>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-300">Title</span>
          <input
            value={requestForm.title}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="What do you want added?"
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-300">Link</span>
          <input
            value={requestForm.source_url}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, source_url: event.target.value }))}
            placeholder="Optional source link"
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-300">Note</span>
          <textarea
            value={requestForm.description}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={3}
            placeholder="Optional context"
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Track request status in the Requests section below.</p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Sending...' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArticleLibraryRequestDrawer;
