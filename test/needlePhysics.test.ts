import { FALLBACK_NEEDLE_SCENARIOS } from '../data/needleScenarios';
import {
  calculateNeedleTip,
  evaluateNeedleState,
  getDifficultyProfile,
  scoreNeedleSession,
} from '../utils/needlePhysics';

describe('needlePhysics', () => {
  it('detects target hit and risk collision correctly', () => {
    const scenario = FALLBACK_NEEDLE_SCENARIOS[0];
    const target = {
      x: scenario.target_config.x,
      y: scenario.target_config.baseY,
      radiusX: scenario.target_config.radiusX,
      radiusY: scenario.target_config.radiusY,
    };

    const tipInTarget = { x: target.x, y: target.y };
    const evalTarget = evaluateNeedleState(scenario, tipInTarget, target);
    expect(evalTarget.insideTarget).toBe(true);

    const risk = scenario.risk_config.zones[0];
    const evalRisk = evaluateNeedleState(scenario, { x: risk.x, y: risk.y }, target);
    expect(evalRisk.insideRisk).toBe(true);
  });

  it('scores deterministically for fixed metrics', () => {
    const scenario = FALLBACK_NEEDLE_SCENARIOS[1];
    const metrics = {
      elapsed_ms: 120000,
      puncture_attempts: 2,
      redirects: 1,
      risk_hits: 0,
      risk_exposure_ms: 0,
      near_miss_ms: 350,
      stable_ms_at_commit: 480,
      final_distance_px: 8.5,
      success: true,
    };

    const one = scoreNeedleSession(metrics, scenario);
    const two = scoreNeedleSession(metrics, scenario);
    expect(one.score).toBe(two.score);
    expect(one.breakdown.accuracy).toBe(two.breakdown.accuracy);
  });

  it('returns tighter control profile as difficulty increases', () => {
    const beginner = getDifficultyProfile('beginner');
    const advanced = getDifficultyProfile('advanced');
    expect(advanced.controlStep).toBeLessThan(beginner.controlStep);
    expect(advanced.angleStep).toBeLessThanOrEqual(beginner.angleStep);
  });

  it('calculates needle tip from polar controls', () => {
    const tip = calculateNeedleTip({ x: 0, y: 0 }, 0, 100);
    expect(Math.round(tip.x)).toBe(100);
    expect(Math.round(tip.y)).toBe(0);
  });
});
