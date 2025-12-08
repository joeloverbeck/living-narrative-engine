export const NEGLIGIBLE_DAMAGE_PERCENT_THRESHOLD = 0.02;
export const NEGLIGIBLE_DAMAGE_ABSOLUTE_THRESHOLD = 2;

/**
 * Classify damage severity based on absolute and percentage thresholds.
 *
 * @param {number} amount - Applied damage amount
 * @param {number} [maxHealth] - Part max health (optional)
 * @returns {'negligible'|'standard'|'none'} Severity bucket
 */
export function classifyDamageSeverity(amount, maxHealth) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'none';
  }

  const percentThreshold =
    Number.isFinite(maxHealth) && maxHealth > 0
      ? maxHealth * NEGLIGIBLE_DAMAGE_PERCENT_THRESHOLD
      : 0;
  const threshold = Math.max(
    NEGLIGIBLE_DAMAGE_ABSOLUTE_THRESHOLD,
    percentThreshold
  );

  return amount < threshold ? 'negligible' : 'standard';
}
