export const MONTHLY_CENSUS_ROTATIONS = [
  'General Radiology',
  'CT/MRI',
  'Pedia/MSK',
  'Ultrasound',
  'Interventional Radiology',
  'Mandaue CT/MRI',
  'Mandaue Oncology',
  "Breast/Women's",
] as const;

export const isValidMonthlyCensusRotation = (value: string) =>
  MONTHLY_CENSUS_ROTATIONS.includes(value as (typeof MONTHLY_CENSUS_ROTATIONS)[number]);

export const parseNonNegativeInt = (value: string) => {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

export const parseNonNegativeScore = (value: string) => {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
};

export const getMonthlyCensusErrorMessage = (error: any, fallback: string) => {
  if (error?.code === '42P01') {
    return 'Monthly census table is not deployed yet. Run the latest migration.';
  }
  return error?.message || fallback;
};
