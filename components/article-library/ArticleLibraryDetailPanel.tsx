import React from 'react';
import EmptyState from '../EmptyState';
import LoadingState from '../LoadingState';
import type { ArticleLibraryChecklistItem, PathologyGuidelineDetail, PathologyGuidelineListItem } from '../../types';

interface GroupedChecklistSection {
  id: string;
  label: string;
  icon: string;
  description: string;
  accent: 'cyan' | 'amber' | 'emerald';
  items: ArticleLibraryChecklistItem[];
}

interface ArticleLibraryDetailPanelProps {
  articleControls?: React.ReactNode;
  activeTopic: string | null;
  bindSectionContainerRef: (sectionId: string) => (node: HTMLElement | null) => void;
  bindSectionRef: (sectionId: string) => (node: HTMLElement | null) => void;
  checklistSections: GroupedChecklistSection[];
  detail: PathologyGuidelineDetail | null;
  heroSummaryParagraphs: string[];
  overflowSummaryParagraphs: string[];
  handleSelectItem: (item: PathologyGuidelineListItem) => void;
  isLoadingDetail: boolean;
  relatedGuidelines: PathologyGuidelineListItem[];
}

const GuidelineResultCard: React.FC<{
  item: PathologyGuidelineListItem;
  onClick: () => void;
}> = ({ item, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="block h-auto min-h-0 w-full shrink-0 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-3 py-3 text-left align-top transition hover:bg-white/[0.04]"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-white">{item.pathology_name}</p>
        <span className="rounded-full border border-cyan-400/14 bg-cyan-500/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/80">
          {item.primary_topic || 'General'}
        </span>
      </div>
      {item.tldr_md ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.tldr_md}</p> : null}
    </div>
  </button>
);

const RelatedGuidelinesSection: React.FC<{
  items: PathologyGuidelineListItem[];
  onSelectItem: (item: PathologyGuidelineListItem) => void;
}> = ({ items, onSelectItem }) => {
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-icons text-[18px] text-cyan-300">hub</span>
        <h3 className="text-sm font-semibold text-white">Related guidelines</h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => <GuidelineResultCard key={item.guideline_id} item={item} onClick={() => onSelectItem(item)} />)}
      </div>
    </section>
  );
};

const ChecklistSection: React.FC<{
  sections: GroupedChecklistSection[];
  bindSectionRef: (sectionId: string) => (node: HTMLElement | null) => void;
  bindSectionContainerRef: (sectionId: string) => (node: HTMLElement | null) => void;
}> = ({ sections, bindSectionRef, bindSectionContainerRef }) => (
  <div className="space-y-3">
    {sections.map((section) => (
      <section key={section.id} ref={bindSectionContainerRef(section.id)} className="scroll-mt-24 rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 backdrop-blur-md">
        <div id={section.id} ref={bindSectionRef(section.id)} className="mb-2 flex scroll-mt-24 items-center gap-2">
          <span className={`material-icons text-[18px] ${section.accent === 'amber' ? 'text-amber-300' : section.accent === 'emerald' ? 'text-emerald-300' : 'text-cyan-300'}`}>{section.icon}</span>
          <h3 className="text-sm font-semibold text-white">{section.label}</h3>
        </div>
        <p className="mb-3 text-xs leading-5 text-slate-400">{section.description}</p>
        <div className="space-y-2">
          {section.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border ${section.accent === 'amber' ? 'border-amber-400/35 bg-amber-500/10' : section.accent === 'emerald' ? 'border-emerald-400/35 bg-emerald-500/10' : 'border-cyan-400/40 bg-cyan-500/10'}`}>
                  <span className={`material-icons text-[14px] ${section.accent === 'amber' ? 'text-amber-200' : section.accent === 'emerald' ? 'text-emerald-200' : 'text-cyan-200'}`}>done</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">{item.label}</p>
                  {item.notes ? <p className="mt-1 text-xs leading-5 text-slate-400">{item.notes}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);

const ArticleLibraryDetailPanel: React.FC<ArticleLibraryDetailPanelProps> = ({
  articleControls,
  activeTopic,
  bindSectionContainerRef,
  bindSectionRef,
  checklistSections,
  detail,
  heroSummaryParagraphs,
  overflowSummaryParagraphs,
  handleSelectItem,
  isLoadingDetail,
  relatedGuidelines,
}) => {
  const showBackgroundSection = overflowSummaryParagraphs.length > 0;

  return (
    <section className="glass-card-enhanced rounded-3xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {isLoadingDetail ? (
        <LoadingState compact title="Loading checklist detail..." />
      ) : detail ? (
        <div className="space-y-3">
          <div className="rounded-3xl border border-white/[0.05] bg-white/[0.025] p-5 backdrop-blur-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {heroSummaryParagraphs.length ? (
                  <div className="space-y-3">
                    {heroSummaryParagraphs.map((paragraph, index) => (
                      <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-sm leading-7 text-slate-300">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : null}
                {detail.clinical_tags.length || detail.problem_terms.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[...detail.clinical_tags, ...detail.problem_terms].slice(0, 8).map((tag, index) => (
                      <span key={`${tag}-${index}`} className="rounded-full border border-white/[0.04] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <ChecklistSection
              sections={checklistSections}
              bindSectionRef={bindSectionRef}
              bindSectionContainerRef={bindSectionContainerRef}
            />

            {showBackgroundSection ? (
              <section ref={bindSectionContainerRef('section-rich-summary')} className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 backdrop-blur-md">
                <div id="section-rich-summary" ref={bindSectionRef('section-rich-summary')} className="mb-2 flex scroll-mt-24 items-center gap-2">
                  <span className="material-icons text-[18px] text-cyan-300">article</span>
                  <h3 className="text-sm font-semibold text-white">Background and nuances</h3>
                </div>
                <div className="space-y-2">
                  {overflowSummaryParagraphs.map((paragraph, index) => (
                    <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-sm leading-6 text-slate-200">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            <div ref={bindSectionContainerRef('section-related-guidelines')}>
              <div id="section-related-guidelines" ref={bindSectionRef('section-related-guidelines')} className="scroll-mt-24" />
              <RelatedGuidelinesSection items={relatedGuidelines} onSelectItem={handleSelectItem} />
            </div>

            {detail.parse_notes ? (
              <section ref={bindSectionContainerRef('section-notes')} className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 backdrop-blur-md">
                <div id="section-notes" ref={bindSectionRef('section-notes')} className="mb-2 flex scroll-mt-24 items-center gap-2">
                  <span className="material-icons text-[18px] text-amber-300">info</span>
                  <h3 className="text-sm font-semibold text-amber-100">Notes / caveats</h3>
                </div>
                <p className="text-sm leading-6 text-amber-50/85">{detail.parse_notes}</p>
              </section>
            ) : null}

            {articleControls}
          </div>
        </div>
      ) : (
        <EmptyState
          compact
          icon="fact_check"
          title={activeTopic ? `Choose a ${activeTopic} guide` : 'Choose a pathology'}
          description={activeTopic ? 'Select a curated result to view the latest published checklist and summary.' : 'Choose a topic or guide to begin.'}
        />
      )}
    </section>
  );
};

export default ArticleLibraryDetailPanel;
