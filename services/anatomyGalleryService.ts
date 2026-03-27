import { ANATOMY_SECTIONS } from '../data/anatomyGallery';
import { AnatomyImageItem, AnatomySection } from '../types';

export interface AnatomyFilterOptions {
  query: string;
  sectionId: string;
  sections?: AnatomySection[];
}

export interface GroupedAnatomySection {
  section: AnatomySection;
  items: AnatomyImageItem[];
}

const DEFAULT_SECTION_LOOKUP = new Map(ANATOMY_SECTIONS.map((section) => [section.id, section]));

const sortAnatomyItems = (items: AnatomyImageItem[]) =>
  [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    const titleCompare = left.title.localeCompare(right.title);
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return left.id.localeCompare(right.id);
  });

export const normalizeAnatomySearchQuery = (query: string) => query.trim().toLowerCase();

export const matchesAnatomyItem = (
  item: AnatomyImageItem,
  normalizedQuery: string,
  sectionLookup: Map<string, AnatomySection> = DEFAULT_SECTION_LOOKUP,
) => {
  if (!normalizedQuery) {
    return true;
  }

  const section = sectionLookup.get(item.section);
  const searchFields = [
    item.title,
    item.subtitle,
    item.caption,
    item.modality,
    item.section,
    section?.label,
    section?.description,
    ...(item.tags || []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return searchFields.some((field) => field.includes(normalizedQuery));
};

export const filterAnatomyItems = (
  items: AnatomyImageItem[],
  { query, sectionId, sections = ANATOMY_SECTIONS }: AnatomyFilterOptions,
) => {
  const normalizedQuery = normalizeAnatomySearchQuery(query);
  const sectionLookup = new Map(sections.map((section) => [section.id, section]));

  return sortAnatomyItems(
    items.filter((item) => {
      if (sectionId !== 'all' && item.section !== sectionId) {
        return false;
      }

      return matchesAnatomyItem(item, normalizedQuery, sectionLookup);
    }),
  );
};

export const groupAnatomyItemsBySection = (
  items: AnatomyImageItem[],
  sections: AnatomySection[],
): GroupedAnatomySection[] => {
  const itemsBySection = new Map<string, AnatomyImageItem[]>();

  for (const item of sortAnatomyItems(items)) {
    const current = itemsBySection.get(item.section) || [];
    current.push(item);
    itemsBySection.set(item.section, current);
  }

  return sections
    .map((section) => ({
      section,
      items: itemsBySection.get(section.id) || [],
    }))
    .filter((entry) => entry.items.length > 0);
};

export const buildAnatomyViewerSequence = (items: AnatomyImageItem[]) => sortAnatomyItems(items);
