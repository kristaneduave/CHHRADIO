import React from 'react';
import EmptyState from '../EmptyState';
import LoadingState from '../LoadingState';
import type { PathologyGuidelineDraftListItem } from '../../services/articleLibraryService';

interface ArticleLibraryDraftsSectionProps {
  compact?: boolean;
  isLoadingDrafts: boolean;
  editorDrafts: PathologyGuidelineDraftListItem[];
  deletingDraftVersionId: string | null;
  onOpenDraft: (draft: PathologyGuidelineDraftListItem) => void;
  onDeleteDraft: (versionId: string) => void;
  getOriginLabel: (origin: PathologyGuidelineDraftListItem['origin']) => string;
  formatDateLabel: (value?: string | null) => string;
  getSourceKindLabel: (value: PathologyGuidelineDraftListItem['source_kind']) => string;
}

const ArticleLibraryDraftsSection: React.FC<ArticleLibraryDraftsSectionProps> = ({
  compact = false,
  isLoadingDrafts,
  editorDrafts,
  deletingDraftVersionId,
  onOpenDraft,
  onDeleteDraft,
  getOriginLabel,
  formatDateLabel,
  getSourceKindLabel,
}) => (
  <section className={`rounded-3xl border border-white/5 bg-white/[0.03] backdrop-blur-sm ${compact ? 'p-4' : 'p-4'}`}>
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Unpublished drafts</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">Editor-only drafts imported or edited but not yet published.</p>
      </div>
      {isLoadingDrafts ? <LoadingState compact title="Loading drafts..." /> : editorDrafts.length ? (
        <div className="space-y-3">
          {editorDrafts.map((draft) => (
            <div key={draft.version_id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100">Draft</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getOriginLabel(draft.origin)}</span>
                    <span className="text-xs text-slate-500">{formatDateLabel(draft.synced_at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{draft.pathology_name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{draft.primary_topic || 'General reporting pearls'} · {getSourceKindLabel(draft.source_kind)}</p>
                  {draft.source_title ? <p className="mt-2 text-xs leading-5 text-slate-400">{draft.source_title}</p> : null}
                  {draft.parse_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{draft.parse_notes}</p> : null}
                  {!draft.is_active ? <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-rose-200/80">Source is hidden</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onOpenDraft(draft)} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">
                    Open draft
                  </button>
                  <button onClick={() => onDeleteDraft(draft.version_id)} disabled={deletingDraftVersionId === draft.version_id} className="rounded-xl border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.12] disabled:cursor-not-allowed disabled:opacity-60">
                    {deletingDraftVersionId === draft.version_id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={compact ? 'py-2' : ''}>
          <EmptyState compact icon="edit_note" title="No unpublished drafts" description="JSON imports and manual edits will appear here until published." />
        </div>
      )}
    </div>
  </section>
);

export default ArticleLibraryDraftsSection;
