import React from 'react';
import { ANATOMY_GALLERY_ITEMS, ANATOMY_SECTIONS } from '../data/anatomyGallery';
import { buildAnatomyViewerSequence, filterAnatomyItems, groupAnatomyItemsBySection } from '../services/anatomyGalleryService';
import EmptyState from './EmptyState';
import AnatomyFilterBar from './anatomy/AnatomyFilterBar';
import AnatomyImageViewer from './anatomy/AnatomyImageViewer';
import AnatomySectionGroup from './anatomy/AnatomySectionGroup';
import PageHeader from './ui/PageHeader';
import PageSection from './ui/PageSection';
import PageShell from './ui/PageShell';

const AnatomyComingSoonScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedSectionId, setSelectedSectionId] = React.useState('all');
  const [activeImageId, setActiveImageId] = React.useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);

  const filteredItems = React.useMemo(
    () =>
      filterAnatomyItems(ANATOMY_GALLERY_ITEMS, {
        query: searchQuery,
        sectionId: selectedSectionId,
        sections: ANATOMY_SECTIONS,
      }),
    [searchQuery, selectedSectionId],
  );

  const groupedSections = React.useMemo(
    () => groupAnatomyItemsBySection(filteredItems, ANATOMY_SECTIONS),
    [filteredItems],
  );

  const viewerItems = React.useMemo(() => buildAnatomyViewerSequence(filteredItems), [filteredItems]);
  const activeViewerIndex = React.useMemo(
    () => viewerItems.findIndex((item) => item.id === activeImageId),
    [activeImageId, viewerItems],
  );
  const sectionsById = React.useMemo(() => new Map(ANATOMY_SECTIONS.map((section) => [section.id, section])), []);

  React.useEffect(() => {
    if (!viewerItems.length) {
      setIsViewerOpen(false);
      setActiveImageId(null);
      return;
    }

    if (activeImageId && !viewerItems.some((item) => item.id === activeImageId)) {
      setActiveImageId(viewerItems[0].id);
    }
  }, [activeImageId, viewerItems]);

  const handleOpenViewer = React.useCallback((itemId: string) => {
    setActiveImageId(itemId);
    setIsViewerOpen(true);
  }, []);

  const datasetIsEmpty = ANATOMY_GALLERY_ITEMS.length === 0;
  const hasVisibleItems = groupedSections.length > 0;

  return (
    <PageShell layoutMode="content" className="relative" contentClassName="max-w-6xl">
      <div className="relative flex min-h-full flex-col gap-6">
        <PageHeader
          title="Anatomy"
          description="A curated teaching atlas with native browsing, section filters, and fullscreen review."
          className="px-1 pb-1 pt-2"
        />

        <PageSection className="overflow-hidden rounded-[2rem] bg-white/[0.04]">
          <div className="flex flex-col gap-4 border-b border-white/8 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
                <span className="material-icons text-[22px] text-cyan-200">biotech</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Teaching atlas</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                  Browse curated reference images by section, narrow the feed with search, and open any image in a focused fullscreen viewer.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300">
                {ANATOMY_SECTIONS.length} sections
              </span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                {ANATOMY_GALLERY_ITEMS.length} images
              </span>
            </div>
          </div>

          <div className="px-5 py-5">
            <AnatomyFilterBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              selectedSectionId={selectedSectionId}
              onSectionChange={setSelectedSectionId}
              sections={ANATOMY_SECTIONS}
            />
          </div>
        </PageSection>

        {datasetIsEmpty ? (
          <PageSection>
            <EmptyState
              icon="collections"
              title="No anatomy images configured yet"
              description="Add curated anatomy image URLs to the local gallery dataset to populate this teaching atlas."
            />
          </PageSection>
        ) : hasVisibleItems ? (
          <div className="space-y-8">
            {groupedSections.map(({ section, items }) => (
              <PageSection key={section.id} className="space-y-5">
                <AnatomySectionGroup section={section} items={items} onOpen={handleOpenViewer} />
              </PageSection>
            ))}
          </div>
        ) : (
          <PageSection>
            <EmptyState
              icon="filter_alt_off"
              title="No matching anatomy images"
              description="Try another search term or switch back to All sections to broaden the gallery."
            />
          </PageSection>
        )}
      </div>

      <AnatomyImageViewer
        items={viewerItems}
        activeIndex={activeViewerIndex < 0 ? 0 : activeViewerIndex}
        isOpen={isViewerOpen && activeViewerIndex >= 0}
        onClose={() => setIsViewerOpen(false)}
        onNavigate={(nextIndex) => setActiveImageId(viewerItems[nextIndex]?.id || null)}
        sectionsById={sectionsById}
      />
    </PageShell>
  );
};

export default AnatomyComingSoonScreen;
