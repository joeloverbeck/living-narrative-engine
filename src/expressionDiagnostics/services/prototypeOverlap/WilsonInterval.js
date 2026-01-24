/**
 * @file WilsonInterval - Wilson score confidence interval for binomial proportions.
 */

/**
 * Wilson score interval for binomial proportion.
 *
 * @param {number} successes - Number of successes
 * @param {number} trials - Number of trials
 * @param {number} z - Z-score (default: 1.96 for 95% CI)
 * @returns {{lower: number, upper: number}} Confidence interval bounds
 */
export function wilsonInterval(successes, trials, z = 1.96) {
  if (trials === 0) return { lower: 0, upper: 1 };

  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denom;
  const margin =
    (z / denom) *
    Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}
