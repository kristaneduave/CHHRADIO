const TEXT_FIELDS = ['id', 'title', 'status', 'created_at', 'submission_type', 'modality', 'organ_system',
  'diagnosis', 'clinical_history', 'findings', 'educational_summary', 'radiologic_clinchers', 'image_url'] as const;
type TextField = typeof TEXT_FIELDS[number];
type PublicReference = { sourceType: string | null; title: string | null; page: string | null };
export type PublicCase = Record<TextField, string | null> & {
  image_urls: string[];
  analysis_result: {
    impression: string | null;
    educationalSummary: string | null;
    keyFindings: string[];
    imagesMetadata: { description: string | null }[];
    references: PublicReference[];
    reference: PublicReference | null;
  };
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const reference = (value: unknown): PublicReference => {
  const row = object(value);
  return { sourceType: text(row.sourceType), title: text(row.title), page: text(row.page) };
};
/** Defense in depth for older servers; authorization and projection also run in PostgreSQL. */
export const toPublicCase = (value: unknown): PublicCase => {
  const row = object(value);
  const analysis = object(row.analysis_result);
  return {
    ...Object.fromEntries(TEXT_FIELDS.map(key => [key, text(row[key])])) as Record<TextField, string | null>,
    image_urls: strings(row.image_urls).length ? strings(row.image_urls) : text(row.image_url) ? [text(row.image_url)!] : [],
    analysis_result: {
      impression: text(analysis.impression), educationalSummary: text(analysis.educationalSummary),
      keyFindings: strings(analysis.keyFindings),
      imagesMetadata: Array.isArray(analysis.imagesMetadata)
        ? analysis.imagesMetadata.map(item => ({ description: text(object(item).description) })) : [],
      references: Array.isArray(analysis.references) ? analysis.references.map(reference) : [],
      reference: analysis.reference ? reference(analysis.reference) : null,
    },
  };
};

export const publicCaseForViewer = (value: PublicCase) => ({
  ...value, patient_initials: null, patient_age: null, patient_sex: null,
  created_by: null, viber_shared_at: null, viber_shared_by: null, viber_shared_by_name: null,
});
