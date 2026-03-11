import React from 'react';
import EmptyState from '../EmptyState';
import LoadingState from '../LoadingState';
import type { PathologyGuidelineRequest, PathologyGuidelineRequestStatus, PathologyGuidelineRequestType } from '../../types';

interface ArticleLibraryRequestsSectionProps {
  canEdit: boolean;
  currentUserId: string | null;
  requests: PathologyGuidelineRequest[];
  isLoadingRequests: boolean;
  hasLoadedRequests: boolean;
  requestStatusDrafts: Record<string, PathologyGuidelineRequestStatus>;
  requestNotesDrafts: Record<string, string>;
  deletingRequestId: string | null;
  updatingRequestId: string | null;
  setRequestStatusDrafts: React.Dispatch<React.SetStateAction<Record<string, PathologyGuidelineRequestStatus>>>;
  setRequestNotesDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleDeleteRequest: (requestId: string) => void;
  handleUpdateRequest: (requestId: string) => void;
  getRequestTypeLabel: (requestType: PathologyGuidelineRequestType) => string;
  getRequestStatusLabel: (status: PathologyGuidelineRequestStatus) => string;
  formatDateLabel: (value?: string | null) => string;
}

const ArticleLibraryRequestsSection: React.FC<ArticleLibraryRequestsSectionProps> = ({
  canEdit,
  currentUserId,
  requests,
  isLoadingRequests,
  hasLoadedRequests,
  requestStatusDrafts,
  requestNotesDrafts,
  deletingRequestId,
  updatingRequestId,
  setRequestStatusDrafts,
  setRequestNotesDrafts,
  handleDeleteRequest,
  handleUpdateRequest,
  getRequestTypeLabel,
  getRequestStatusLabel,
  formatDateLabel,
}) => (
  <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm">
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Requests</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">{canEdit ? 'Review and manage incoming library requests.' : 'Track what you asked to be added or updated.'}</p>
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{canEdit ? 'Incoming requests' : 'Your requests'}</h3>
        {isLoadingRequests ? <LoadingState compact title="Loading requests..." /> : !hasLoadedRequests && !canEdit ? <EmptyState compact icon="forum" title="Requests load on demand" description="Open the request form to load your request history." /> : requests.length ? requests.map((request) => (
          <div key={request.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">{getRequestTypeLabel(request.request_type)}</span>
                  <span className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{getRequestStatusLabel(request.status)}</span>
                  <span className="text-xs text-slate-500">{formatDateLabel(request.created_at)}</span>
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">Requested by {request.requester_name || request.requester_username || 'Unknown requester'}</p>
                <p className="mt-2 text-sm font-semibold text-white">{request.title}</p>
                {request.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{request.description}</p> : null}
                {request.source_url ? <a href={request.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-cyan-200 hover:text-cyan-100">Open link</a> : null}
                {!canEdit && request.review_notes ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{request.review_notes}</p> : null}
              </div>
              {(canEdit || request.created_by === currentUserId) ? (
                <button onClick={() => handleDeleteRequest(request.id)} disabled={deletingRequestId === request.id} className="rounded-xl border border-rose-400/16 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.12] disabled:cursor-not-allowed disabled:opacity-60">
                  {deletingRequestId === request.id ? 'Deleting...' : 'Delete'}
                </button>
              ) : null}
            </div>
            {canEdit ? (
              <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-300">Status</span>
                    <select value={requestStatusDrafts[request.id] || request.status} onChange={(event) => setRequestStatusDrafts((prev) => ({ ...prev, [request.id]: event.target.value as PathologyGuidelineRequestStatus }))} className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35">
                      <option value="pending">Pending</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-300">Review note</span>
                  <textarea value={requestNotesDrafts[request.id] || ''} onChange={(event) => setRequestNotesDrafts((prev) => ({ ...prev, [request.id]: event.target.value }))} rows={3} placeholder="Optional note" className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/35" />
                </label>
                <button onClick={() => handleUpdateRequest(request.id)} disabled={updatingRequestId === request.id} className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60">
                  {updatingRequestId === request.id ? 'Saving...' : 'Save'}
                </button>
              </div>
            ) : null}
          </div>
        )) : <EmptyState compact icon="forum" title="No requests yet" description={canEdit ? 'Requests will appear here.' : 'Your requests will appear here.'} />}
      </div>
    </div>
  </section>
);

export default ArticleLibraryRequestsSection;
