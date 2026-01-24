/**
 * @file Statistical utility functions for axis gap analysis.
 * @description Pure functions for statistical computations used in prototype analysis.
 */

/**
 * Compute the median of a sorted array of values.
 *
 * @param {number[]} sortedValues - Array of values already sorted in ascending order.
 * @returns {number} The median value, or 0 if array is empty.
 */
export function computeMedian(sortedValues) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    return 0;
  }

  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}

/**
 * Compute median and interquartile range (IQR) from an array of counts.
 * Filters out non-finite values before computation.
 *
 * @param {number[]} counts - Array of numeric values.
 * @returns {{median: number, iqr: number}} Object with median and IQR values.
 */
export function computeMedianAndIQR(counts) {
  if (!Array.isArray(counts) || counts.length === 0) {
    return { median: 0, iqr: 0 };
  }

  const sorted = counts
    .filter((value) => Number.isFinite(value))
    .slice()
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return { median: 0, iqr: 0 };
  }

  const median = computeMedian(sorted);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, mid);
  const upper =
    sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);
  const q1 = computeMedian(lower);
  const q3 = computeMedian(upper);
  const iqr = Math.max(0, q3 - q1);

  return { median, iqr };
}

/**
 * Compute the percentile value from a sorted array.
 *
 * @param {number[]} sortedValues - Array of values already sorted in ascending order.
 * @param {number} percentile - Percentile to compute (0-100).
 * @returns {number} The value at the given percentile, or 0 if array is empty.
 */
export function computePercentile(sortedValues, percentile) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    return 0;
  }

  const clampedPercentile = Math.max(0, Math.min(100, percentile));
  const index = Math.floor((clampedPercentile / 100) * sortedValues.length);
  const clampedIndex = Math.min(index, sortedValues.length - 1);

  return sortedValues[clampedIndex];
}
