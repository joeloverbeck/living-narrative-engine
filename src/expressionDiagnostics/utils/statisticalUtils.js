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
 * Compute median, interquartile range (IQR), and quartiles from an array of counts.
 * Filters out non-finite values before computation.
 *
 * @param {number[]} counts - Array of numeric values.
 * @returns {{median: number, iqr: number, q1: number, q3: number}} Object with median, IQR, Q1 and Q3 values.
 */
export function computeMedianAndIQR(counts) {
  if (!Array.isArray(counts) || counts.length === 0) {
    return { median: 0, iqr: 0, q1: 0, q3: 0 };
  }

  const sorted = counts
    .filter((value) => Number.isFinite(value))
    .slice()
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return { median: 0, iqr: 0, q1: 0, q3: 0 };
  }

  const median = computeMedian(sorted);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, mid);
  const upper =
    sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);
  const q1 = computeMedian(lower);
  const q3 = computeMedian(upper);
  const iqr = Math.max(0, q3 - q1);

  return { median, iqr, q1, q3 };
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

/**
 * Compute the expected variance proportion for the k-th component under the broken-stick model.
 *
 * The broken-stick model provides a null hypothesis for eigenvalue significance in PCA.
 * It assumes random partitioning of total variance across components.
 *
 * Formula: Expected(k) = (1/p) * Σ(j=k to p) [1/j]
 *
 * @param {number} k - Component index (1-based, must be >= 1).
 * @param {number} p - Total number of components (must be >= 1).
 * @returns {number} Expected variance proportion for component k, or 0 if inputs invalid.
 */
export function computeBrokenStickExpected(k, p) {
  if (
    typeof k !== 'number' ||
    typeof p !== 'number' ||
    !Number.isFinite(k) ||
    !Number.isFinite(p) ||
    k < 1 ||
    p < 1 ||
    k > p
  ) {
    return 0;
  }

  let sum = 0;
  for (let j = k; j <= p; j += 1) {
    sum += 1 / j;
  }

  return sum / p;
}

/**
 * Compute the full broken-stick distribution for p components.
 *
 * Returns an array of expected variance proportions for each component.
 * The distribution is monotonically decreasing and sums to 1.0.
 *
 * @param {number} p - Total number of components (must be >= 1).
 * @returns {number[]} Array of expected variance proportions for components 1..p, or empty array if invalid.
 */
export function computeBrokenStickDistribution(p) {
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 1) {
    return [];
  }

  const componentCount = Math.floor(p);
  const distribution = new Array(componentCount);

  for (let k = 1; k <= componentCount; k += 1) {
    distribution[k - 1] = computeBrokenStickExpected(k, componentCount);
  }

  return distribution;
}

/**
 * Count the number of significant components using the broken-stick rule.
 *
 * A component is significant if its actual variance proportion exceeds
 * the expected proportion under the broken-stick null hypothesis.
 *
 * @param {number[]} eigenvalues - Array of eigenvalues sorted in descending order.
 * @param {number} totalVariance - Sum of all eigenvalues (total variance).
 * @returns {number} Number of significant components, or 0 if inputs invalid.
 */
export function countSignificantComponentsBrokenStick(
  eigenvalues,
  totalVariance
) {
  if (
    !Array.isArray(eigenvalues) ||
    eigenvalues.length === 0 ||
    typeof totalVariance !== 'number' ||
    !Number.isFinite(totalVariance) ||
    totalVariance <= 0
  ) {
    return 0;
  }

  const p = eigenvalues.length;
  const brokenStick = computeBrokenStickDistribution(p);

  let significantCount = 0;
  for (let i = 0; i < p; i += 1) {
    const actualProportion = eigenvalues[i] / totalVariance;
    const expectedProportion = brokenStick[i];

    if (actualProportion > expectedProportion) {
      significantCount += 1;
    } else {
      // Broken-stick rule: stop at first non-significant component
      // because components are ordered by variance
      break;
    }
  }

  return significantCount;
}
