/**
 * @file Helper to merge totals summaries from different loaders.
 */

/** @typedef {import('../LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */

/**
 * @description Merges updated totals from an aggregator back into the main totals object.
 * @param {TotalResultsSummary} mainTotals - The existing totals object.
 * @param {TotalResultsSummary} updatedTotals - Totals returned from a processor.
 * @returns {TotalResultsSummary} New totals object combining the two inputs.
 */
export function mergeTotals(mainTotals, updatedTotals) {
  const merged = { ...mainTotals };
  for (const [registryKey, counts] of Object.entries(updatedTotals)) {
    merged[registryKey] = {
      count: counts.count ?? 0,
      overrides: counts.overrides ?? 0,
      errors: counts.errors ?? 0,
      failures: counts.failures ?? [],
    };
  }
  return merged;
}

export default mergeTotals;
