import { describe, expect, it } from 'vitest';
import {
  buildAnatomyViewerSequence,
  filterAnatomyItems,
  groupAnatomyItemsBySection,
  matchesAnatomyItem,
  normalizeAnatomySearchQuery,
} from './anatomyGalleryService';
import { AnatomyImageItem, AnatomySection } from '../types';

const sections: AnatomySection[] = [
  { id: 'head-neck', label: 'Head & Neck' },
  { id: 'thorax', label: 'Thorax' },
];

const items: AnatomyImageItem[] = [
  {
    id: 'b',
    section: 'thorax',
    title: 'Mediastinal CT',
    subtitle: 'Hilar vessels',
    caption: 'Thoracic cross-sectional reference',
    thumbnailUrl: 'thumb-b',
    imageUrl: 'full-b',
    tags: ['thorax', 'axial'],
    modality: 'CT',
    sortOrder: 2,
  },
  {
    id: 'a',
    section: 'head-neck',
    title: 'Orbital MRI',
    subtitle: 'Optic nerve anatomy',
    caption: 'Head and neck teaching image',
    thumbnailUrl: 'thumb-a',
    imageUrl: 'full-a',
    tags: ['orbit', 'mri'],
    modality: 'MRI',
    sortOrder: 1,
  },
  {
    id: 'c',
    section: 'thorax',
    title: 'Bronchial Tree',
    subtitle: 'Segmental airway anatomy',
    caption: 'Pulmonary branches',
    thumbnailUrl: 'thumb-c',
    imageUrl: 'full-c',
    tags: ['lung'],
    modality: 'CT',
    sortOrder: 1,
  },
];

describe('anatomyGalleryService', () => {
  it('normalizes the search query', () => {
    expect(normalizeAnatomySearchQuery('  Thorax  ')).toBe('thorax');
  });

  it('matches title, subtitle, caption, tags, and section label', () => {
    const lookup = new Map(sections.map((section) => [section.id, section]));
    expect(matchesAnatomyItem(items[0], 'mediastinal', lookup)).toBe(true);
    expect(matchesAnatomyItem(items[0], 'vessels', lookup)).toBe(true);
    expect(matchesAnatomyItem(items[0], 'cross-sectional', lookup)).toBe(true);
    expect(matchesAnatomyItem(items[0], 'axial', lookup)).toBe(true);
    expect(matchesAnatomyItem(items[0], 'thorax', lookup)).toBe(true);
  });

  it('returns all items when query is empty and section is all', () => {
    expect(filterAnatomyItems(items, { query: '', sectionId: 'all', sections }).map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('filters by section and preserves sorted order', () => {
    expect(filterAnatomyItems(items, { query: '', sectionId: 'thorax', sections }).map((item) => item.id)).toEqual(['c', 'b']);
  });

  it('groups items by canonical section order and omits empty sections', () => {
    const grouped = groupAnatomyItemsBySection(filterAnatomyItems(items, { query: 'ct', sectionId: 'all', sections }), sections);
    expect(grouped.map((entry) => entry.section.id)).toEqual(['thorax']);
    expect(grouped[0].items.map((item) => item.id)).toEqual(['c', 'b']);
  });

  it('builds the viewer sequence in stable sorted order', () => {
    expect(buildAnatomyViewerSequence(items).map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });
});
