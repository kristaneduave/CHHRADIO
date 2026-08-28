export const STANDARD_REFERENCE_SOURCE_TYPE = 'Standard Reference Book';
export const OTHER_BOOK_VALUE = '__other_book__';

export const REFERENCE_SOURCE_TYPES = [
  STANDARD_REFERENCE_SOURCE_TYPE,
  'Journal / DOI',
  'Web Link',
  'Guideline / Consensus',
  'Lecture / Handout',
  'Other',
] as const;

export const REFERENCE_BOOK_GROUPS = [
  {
    specialty: 'General Radiology',
    books: ['Fundamentals of Diagnostic Radiology — 5th ed. (2019)'],
  },
  {
    specialty: 'Cardiovascular and Pulmonary Imaging',
    books: [
      'Cardiac Imaging: The Requisites — 4th ed. (2016)',
      'Thoracic Imaging: Pulmonary and Cardiovascular Radiology — 3rd ed. (2017)',
    ],
  },
  {
    specialty: 'Genitourinary Imaging',
    books: ['Genitourinary Radiology — 3rd ed. (2018)'],
  },
  {
    specialty: "Women's Imaging",
    books: [
      "Callen's Ultrasonography in Obstetrics and Gynecology — 6th ed. (2017)",
      'Breast Imaging: The Requisites — 3rd ed. (2017)',
    ],
  },
  {
    specialty: 'Abdominal and Gastrointestinal Imaging',
    books: ['Textbook of Gastrointestinal Radiology — 4th ed. (2015)'],
  },
  {
    specialty: 'Neuroradiology and Head and Neck Imaging',
    books: [
      "Osborn's Brain: Imaging, Pathology, and Anatomy — 2nd ed. (2018)",
      'Head and Neck Imaging — 5th ed. (2011)',
    ],
  },
  {
    specialty: 'Musculoskeletal Imaging',
    books: ['Bone and Joint Imaging — 3rd ed. (2005)'],
  },
  {
    specialty: 'Pediatric Imaging',
    books: ["Caffey's Pediatric Diagnostic Imaging — 13th ed. (2019)"],
  },
] as const;

export const REFERENCE_BOOK_TITLES = REFERENCE_BOOK_GROUPS.flatMap((group) => [...group.books]);

export const normalizeReferenceSourceType = (sourceType?: string | null): string => {
  const value = String(sourceType || '').trim();
  if (value === 'Book') return STANDARD_REFERENCE_SOURCE_TYPE;
  if (value === 'Journal Article') return 'Journal / DOI';
  if (value === 'Online Resource') return 'Web Link';
  if (value === 'Reviewer / Board Prep') return 'Other';
  return value;
};

export const isCatalogReferenceBook = (title?: string | null): boolean =>
  REFERENCE_BOOK_TITLES.includes(String(title || '').trim() as typeof REFERENCE_BOOK_TITLES[number]);

export const getReferenceEntryField = (sourceType?: string | null) => {
  switch (normalizeReferenceSourceType(sourceType)) {
    case 'Journal / DOI':
      return { label: 'Journal citation / DOI', placeholder: 'Article title, journal, year, or DOI', inputType: 'text' };
    case 'Web Link':
      return { label: 'Web link', placeholder: 'https://example.com/reference', inputType: 'url' };
    case 'Guideline / Consensus':
      return { label: 'Guideline / consensus title', placeholder: 'Enter guideline or consensus statement', inputType: 'text' };
    case 'Lecture / Handout':
      return { label: 'Lecture / handout title', placeholder: 'Enter lecture or handout title', inputType: 'text' };
    default:
      return { label: 'Reference details', placeholder: 'Enter the reference source', inputType: 'text' };
  }
};
