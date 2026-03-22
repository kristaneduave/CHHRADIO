import React from 'react';

interface SourceFormStateLike {
  slug: string;
  pathology_name: string;
  source_url: string;
  source_title: string;
  is_active: boolean;
  is_featured: boolean;
}

interface ArticleLibraryEditorPanelProps {
  open: boolean;
  importCategoryOverride: string;
  setImportCategoryOverride: React.Dispatch<React.SetStateAction<string>>;
  importMode: 'paste' | 'upload';
  setImportMode: React.Dispatch<React.SetStateAction<'paste' | 'upload'>>;
  handleImportFile: React.ChangeEventHandler<HTMLInputElement>;
  rawImportJson: string;
  setRawImportJson: React.Dispatch<React.SetStateAction<string>>;
  setValidatedImportPayload: React.Dispatch<React.SetStateAction<unknown>>;
  setImportValidationErrors: React.Dispatch<React.SetStateAction<string[]>>;
  setImportWarnings: React.Dispatch<React.SetStateAction<string[]>>;
  importValidationErrors: string[];
  importWarnings: string[];
  handleValidateImportJson: () => void;
  handleImportJson: () => void;
  isImportingJson: boolean;
  validatedImportPayload: unknown;
  handlePublishImportedJson: () => void;
  isPublishingImportedJson: boolean;
  importFileName: string | null;
  form: SourceFormStateLike;
  setForm: React.Dispatch<React.SetStateAction<SourceFormStateLike>>;
  makeSlug: (value: string) => string;
  isLibraryMetadataExpanded: boolean;
  setIsLibraryMetadataExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveSource: () => void;
  isSavingSource: boolean;
  openLibraryNewArticlePanel: () => void;
  closePanel: () => void;
}

const ARTICLE_LIBRARY_TOPICS = ['Chest', 'Abdomen', 'GU / OB-Gyn', 'Neuro / Head & Neck', 'Musculoskeletal', 'Breast', 'Pediatrics', 'Procedures / IR', 'General & Other'];

const ArticleLibraryEditorPanel: React.FC<ArticleLibraryEditorPanelProps> = ({
  open,
  importCategoryOverride,
  setImportCategoryOverride,
  importMode,
  setImportMode,
  handleImportFile,
  rawImportJson,
  setRawImportJson,
  setValidatedImportPayload,
  setImportValidationErrors,
  setImportWarnings,
  importValidationErrors,
  importWarnings,
  handleValidateImportJson,
  handleImportJson,
  isImportingJson,
  validatedImportPayload,
  handlePublishImportedJson,
  isPublishingImportedJson,
  importFileName,
  form,
  setForm,
  makeSlug,
  isLibraryMetadataExpanded,
  setIsLibraryMetadataExpanded,
  handleSaveSource,
  isSavingSource,
  openLibraryNewArticlePanel,
  closePanel,
}) => {
  if (!open) return null;

  return (
    <div className="mobile-bottom-nav-frame fixed inset-x-0 top-0 z-[120] px-3 py-3 xl:inset-auto xl:bottom-6 xl:right-6 xl:px-0 xl:py-0">
      <section className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-fuchsia-500/15 bg-[#101922]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl xl:mx-0 xl:h-auto xl:w-[24rem] xl:max-w-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-fuchsia-200">New article</h2>
            <p className="mt-1 text-xs text-slate-400">Paste or upload checklist JSON, then add the article title and source link.</p>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-100 transition hover:bg-white/[0.1]"
            aria-label="Close article controls"
          >
            <span className="material-icons text-[18px]">close</span>
          </button>
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="space-y-3 rounded-2xl border border-cyan-500/15 bg-cyan-950/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Import checklist JSON</h3>
                <p className="mt-1 text-xs text-slate-400">Primary workflow for adding a new article. Metadata auto-fills when possible.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={importCategoryOverride}
                  onChange={(e) => setImportCategoryOverride(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-semibold text-slate-300 outline-none focus:border-cyan-400/35"
                >
                  <option value="">Auto-detect category</option>
                  {ARTICLE_LIBRARY_TOPICS.map((topic) => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
                <button onClick={() => setImportMode('paste')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === 'paste' ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>Paste</button>
                <button onClick={() => setImportMode('upload')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${importMode === 'upload' ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>Upload</button>
              </div>
            </div>
            {importMode === 'upload' ? <input type="file" accept=".json,application/json" onChange={handleImportFile} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-cyan-100" /> : null}
            <textarea value={rawImportJson} onChange={(event) => { setRawImportJson(event.target.value); setValidatedImportPayload(null); setImportValidationErrors([]); setImportWarnings([]); }} rows={7} placeholder='{"pathology_name":"Appendicitis","rich_summary_md":"...","checklist_items":[...]}' className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400/35" />
            {!!importValidationErrors.length ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3">{importValidationErrors.map((error) => <p key={error} className="text-xs text-rose-100/90">{error}</p>)}</div> : null}
            {!!importWarnings.length ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">{importWarnings.map((warning) => <p key={warning} className="text-xs text-amber-100/90">{warning}</p>)}</div> : null}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleValidateImportJson} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15">
                {importMode === 'upload' ? 'Recheck JSON' : 'Validate JSON'}
              </button>
              <button onClick={handleImportJson} disabled={isImportingJson || !validatedImportPayload} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">
                {isImportingJson ? 'Creating...' : 'Create draft from JSON'}
              </button>
              <button onClick={handlePublishImportedJson} disabled={isPublishingImportedJson || !validatedImportPayload} className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60">
                {isPublishingImportedJson ? 'Publishing...' : 'Publish article'}
              </button>
            </div>
            {importFileName ? <p className="text-xs text-slate-500">Loaded file: {importFileName}</p> : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Article text and link</h3>
              <p className="mt-1 text-xs text-slate-500">Keep this minimal. JSON can fill most of the rest.</p>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-300">Pathology name</span>
                <input value={form.pathology_name} onChange={(event) => setForm((prev) => ({ ...prev, pathology_name: event.target.value, slug: prev.slug || makeSlug(event.target.value) }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-300">Source title</span>
                <input value={form.source_title} onChange={(event) => setForm((prev) => ({ ...prev, source_title: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-300">Source URL</span>
                <input value={form.source_url} onChange={(event) => setForm((prev) => ({ ...prev, source_url: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
              </label>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <button type="button" onClick={() => setIsLibraryMetadataExpanded((value) => !value)} className="flex w-full items-center justify-between text-left">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">More settings</h3>
                <p className="mt-1 text-xs text-slate-500">Slug and publish flags. Topic is inferred automatically.</p>
              </div>
              <span className="material-icons text-[18px] text-slate-500">{isLibraryMetadataExpanded ? 'expand_less' : 'expand_more'}</span>
            </button>
            {isLibraryMetadataExpanded ? (
              <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-300">Slug</span>
                  <input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Source is active</label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_featured} onChange={(event) => setForm((prev) => ({ ...prev, is_featured: event.target.checked }))} className="rounded border-white/10 bg-slate-900/80" />Featured on landing</label>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={handleSaveSource} disabled={isSavingSource} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">
              {isSavingSource ? 'Saving...' : 'Save article text/link'}
            </button>
            <button onClick={openLibraryNewArticlePanel} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
              Reset
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ArticleLibraryEditorPanel;
