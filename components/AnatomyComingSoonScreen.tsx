import React from 'react';
import PageHeader from './ui/PageHeader';
import PageSection from './ui/PageSection';
import PageShell from './ui/PageShell';

const AnatomyComingSoonScreen: React.FC = () => {
  return (
    <PageShell layoutMode="content" className="relative" contentClassName="max-w-4xl">
      <div className="relative flex min-h-full flex-col">
        <PageHeader title="Anatomy" className="px-1 pb-6 pt-2" />

        <PageSection className="overflow-hidden rounded-[2rem] bg-white/[0.04] xl:mx-auto xl:w-full xl:max-w-3xl">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
                <span className="material-icons text-[22px] text-cyan-200">biotech</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Coming soon</p>
                <p className="text-xs text-text-tertiary">Page content not set yet.</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-8">
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-black/10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <span className="material-icons animate-pulse text-[28px] text-slate-400">hourglass_empty</span>
              </div>
              <p className="mt-5 text-base font-semibold text-white">Anatomy page coming soon</p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-text-secondary">
                This space is intentionally blank until the final content is ready.
              </p>
            </div>
          </div>
        </PageSection>
      </div>
    </PageShell>
  );
};

export default AnatomyComingSoonScreen;
