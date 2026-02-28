import {
  NeedleDifficulty,
  NeedleScenario,
  NeedleScoreBreakdown,
  NeedleSessionMetrics,
} from '../types';

export interface NeedlePoint {
  x: number;
  y: number;
}

export interface NeedleTargetState extends NeedlePoint {
  radiusX: number;
  radiusY: number;
}

export interface NeedleEvaluation {
  insideTarget: boolean;
  insideRisk: boolean;
  nearRisk: boolean;
  minRiskDistance: number;
  tipDistanceToTargetCenter: number;
}

export interface NeedleScoreResult {
  score: number;
  competencyBand: 'Excellent' | 'Safe' | 'Needs Practice';
  breakdown: NeedleScoreBreakdown;
}

export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export const distance = (a: NeedlePoint, b: NeedlePoint): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

export const calculateNeedleTip = (
  entry: NeedlePoint,
  angleDeg: number,
  depthPx: number,
): NeedlePoint => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: entry.x + depthPx * Math.cos(rad),
    y: entry.y + depthPx * Math.sin(rad),
  };
};

const jitterWave = (elapsedSec: number, magnitude: number): number => {
  const fast = Math.sin(elapsedSec * 7.5) * 0.55;
  const medium = Math.sin(elapsedSec * 3.25 + 1.7) * 0.35;
  const slow = Math.sin(elapsedSec * 1.5 + 0.5) * 0.1;
  return (fast + medium + slow) * magnitude;
};

export const calculateTargetState = (
  scenario: NeedleScenario,
  elapsedMs: number,
): NeedleTargetState => {
  const elapsedSec = elapsedMs / 1000;
  const t = scenario.target_config;
  const resp = t.amplitude * Math.sin(2 * Math.PI * t.frequencyHz * elapsedSec);
  const jitter = jitterWave(elapsedSec, t.jitter);
  return {
    x: t.x,
    y: t.baseY + resp + jitter,
    radiusX: t.radiusX,
    radiusY: t.radiusY,
  };
};

export const isInsideEllipse = (
  point: NeedlePoint,
  center: NeedlePoint,
  radiusX: number,
  radiusY: number,
): boolean => {
  if (radiusX <= 0 || radiusY <= 0) return false;
  const nx = (point.x - center.x) / radiusX;
  const ny = (point.y - center.y) / radiusY;
  return nx * nx + ny * ny <= 1;
};

export const evaluateNeedleState = (
  scenario: NeedleScenario,
  tip: NeedlePoint,
  target: NeedleTargetState,
): NeedleEvaluation => {
  const insideTarget = isInsideEllipse(tip, target, target.radiusX, target.radiusY);
  let insideRisk = false;
  let nearRisk = false;
  let minRiskDistance = Number.POSITIVE_INFINITY;

  scenario.risk_config.zones.forEach((zone) => {
    const d = distance(tip, zone);
    const edgeDistance = d - zone.radius;
    minRiskDistance = Math.min(minRiskDistance, edgeDistance);
    if (d <= zone.radius) {
      insideRisk = true;
    } else if (edgeDistance <= scenario.risk_config.nearMissDistance) {
      nearRisk = true;
    }
  });

  return {
    insideTarget,
    insideRisk,
    nearRisk,
    minRiskDistance: Number.isFinite(minRiskDistance) ? minRiskDistance : 9999,
    tipDistanceToTargetCenter: distance(tip, target),
  };
};

export const getDifficultyProfile = (
  difficulty: NeedleDifficulty,
): { label: string; controlStep: number; angleStep: number; cadenceHint: string } => {
  if (difficulty === 'advanced') {
    return {
      label: 'Advanced',
      controlStep: 2,
      angleStep: 1,
      cadenceHint: 'Use small corrections and commit during stable respiratory windows.',
    };
  }
  if (difficulty === 'intermediate') {
    return {
      label: 'Intermediate',
      controlStep: 3,
      angleStep: 1.5,
      cadenceHint: 'Track respiratory drift and avoid repeated retract-advance cycles.',
    };
  }
  return {
    label: 'Beginner',
    controlStep: 4,
    angleStep: 2,
    cadenceHint: 'Prioritize smooth needle approach and avoid risk zones.',
  };
};

const round = (value: number): number => Math.round(value * 100) / 100;

export const scoreNeedleSession = (
  metrics: NeedleSessionMetrics,
  scenario: NeedleScenario,
): NeedleScoreResult => {
  const targetRadius = Math.max(1, (scenario.target_config.radiusX + scenario.target_config.radiusY) / 2);
  const normalizedDistance = clamp(metrics.final_distance_px / (targetRadius * 2), 0, 1);
  const accuracy = round(clamp(45 * (1 - normalizedDistance), 0, 45));

  const redirectPenalty = Math.min(12, metrics.redirects * 2.5);
  const attemptPenalty = Math.min(8, Math.max(0, metrics.puncture_attempts - 1) * 2);
  const trajectory = round(clamp(20 - redirectPenalty - attemptPenalty, 0, 20));

  const hitPenalty = Math.min(20, metrics.risk_hits * 8);
  const exposurePenalty = Math.min(5, metrics.risk_exposure_ms / 600);
  const nearMissPenalty = Math.min(4, metrics.near_miss_ms / 1000);
  const safety = round(clamp(25 - hitPenalty - exposurePenalty - nearMissPenalty, 0, 25));

  const elapsedRatio = clamp(
    metrics.elapsed_ms / Math.max(1000, scenario.time_limit_sec * 1000),
    0,
    1.2,
  );
  const efficiency = round(clamp(10 - elapsedRatio * 7 - Math.max(0, metrics.puncture_attempts - 1), 0, 10));

  const raw = clamp(accuracy + trajectory + safety + efficiency, 0, 100);
  const score = Math.round(raw);
  const competencyBand = score >= 85 ? 'Excellent' : score >= 70 ? 'Safe' : 'Needs Practice';

  return {
    score,
    competencyBand,
    breakdown: { accuracy, trajectory, safety, efficiency },
  };
};
