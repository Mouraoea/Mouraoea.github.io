import type { SkillBonuses } from "./types.ts";

/** Wiki cap on total skilling speed from gear, tools, jewelry, and capes. */
export const MAX_SKILLING_SPEED_FRACTION = 0.8;

export function addSkillingSpeedFraction(
  bonuses: SkillBonuses,
  fraction: number,
): void {
  if (!Number.isFinite(fraction) || fraction <= 0) return;
  bonuses.skillingSpeedFraction += fraction;
}

export function addClanSpeedFraction(
  bonuses: SkillBonuses,
  fraction: number,
): void {
  if (!Number.isFinite(fraction) || fraction <= 0) return;
  bonuses.clanSpeedFraction += fraction;
}

/** Convert a speed multiplier factor (e.g. 1.05) to an additive fraction (0.05). */
export function speedMultiplierToFraction(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 1) return 0;
  return multiplier - 1;
}

/**
 * Wiki: Task Time = Base × (1 − clan%) × (1 − skilling%)
 * Derive speedMultiplier so effectiveTime = base / speedMultiplier.
 */
export function finalizeSpeedMultiplier(bonuses: SkillBonuses): void {
  const skilling = Math.min(
    MAX_SKILLING_SPEED_FRACTION,
    Math.max(0, bonuses.skillingSpeedFraction),
  );
  const clan = Math.min(0.99, Math.max(0, bonuses.clanSpeedFraction));
  const timeFactor = (1 - clan) * (1 - skilling);
  bonuses.speedMultiplier = timeFactor > 0 ? 1 / timeFactor : 1;
}
