import { NeedleScenario } from '../types';

const BASE_FIELD_WIDTH = 1000;
const BASE_FIELD_HEIGHT = 560;
const BASE_ENTRY_X = 120;
const BASE_ENTRY_Y = 300;

export const FALLBACK_NEEDLE_SCENARIOS: NeedleScenario[] = [
  {
    id: '9a0a1cde-5036-4ac0-a6f2-0f524d5c0011',
    title: 'Liver Lesion Targeting',
    anatomy: 'Liver',
    difficulty: 'beginner',
    time_limit_sec: 180,
    field_width: BASE_FIELD_WIDTH,
    field_height: BASE_FIELD_HEIGHT,
    needle_entry_x: BASE_ENTRY_X,
    needle_entry_y: BASE_ENTRY_Y,
    max_depth: 760,
    target_config: {
      x: 700,
      baseY: 290,
      radiusX: 52,
      radiusY: 36,
      amplitude: 18,
      frequencyHz: 0.16,
      jitter: 2,
    },
    risk_config: {
      nearMissDistance: 14,
      zones: [
        { id: 'hepatic-artery', label: 'Hepatic artery', x: 620, y: 250, radius: 26 },
        { id: 'portal-vein', label: 'Portal vein', x: 645, y: 338, radius: 30 },
      ],
    },
    is_active: true,
  },
  {
    id: '9a0a1cde-5036-4ac0-a6f2-0f524d5c0012',
    title: 'Renal Cyst Aspiration',
    anatomy: 'Kidney',
    difficulty: 'intermediate',
    time_limit_sec: 210,
    field_width: BASE_FIELD_WIDTH,
    field_height: BASE_FIELD_HEIGHT,
    needle_entry_x: BASE_ENTRY_X,
    needle_entry_y: BASE_ENTRY_Y,
    max_depth: 780,
    target_config: {
      x: 730,
      baseY: 308,
      radiusX: 42,
      radiusY: 30,
      amplitude: 24,
      frequencyHz: 0.22,
      jitter: 4,
    },
    risk_config: {
      nearMissDistance: 12,
      zones: [
        { id: 'renal-artery', label: 'Renal artery', x: 660, y: 286, radius: 23 },
        { id: 'colon', label: 'Adjacent bowel', x: 775, y: 346, radius: 28 },
      ],
    },
    is_active: true,
  },
  {
    id: '9a0a1cde-5036-4ac0-a6f2-0f524d5c0013',
    title: 'Lung Nodule Biopsy',
    anatomy: 'Lung',
    difficulty: 'advanced',
    time_limit_sec: 240,
    field_width: BASE_FIELD_WIDTH,
    field_height: BASE_FIELD_HEIGHT,
    needle_entry_x: BASE_ENTRY_X,
    needle_entry_y: BASE_ENTRY_Y,
    max_depth: 820,
    target_config: {
      x: 770,
      baseY: 270,
      radiusX: 32,
      radiusY: 24,
      amplitude: 30,
      frequencyHz: 0.28,
      jitter: 6,
    },
    risk_config: {
      nearMissDistance: 10,
      zones: [
        { id: 'intercostal-vessel', label: 'Intercostal vessel', x: 696, y: 236, radius: 20 },
        { id: 'major-vessel', label: 'Major vessel', x: 736, y: 334, radius: 24 },
        { id: 'pleural-margin', label: 'Pleural risk', x: 816, y: 272, radius: 22 },
      ],
    },
    is_active: true,
  },
];
