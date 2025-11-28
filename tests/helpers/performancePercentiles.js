/**
 * Collects timing samples and provides percentile statistics for performance tests.
 * This utility intentionally keeps configuration small to avoid long-running suites.
 *
 * @param {Function} fn - Function under test
 * @param {object} options
 * @param {number} [options.samples] - Number of timed samples to record
 * @param {number} [options.iterations] - Iterations per sample
 * @param {number} [options.warmupIterations] - Warmup iterations to smooth JIT effects
 * @param {Function} [options.now] - Optional time source for deterministic testing
 * @returns {{
 *   samples: number[],
 *   median: number,
 *   p95: number,
 *   p99: number,
 *   min: number,
 *   max: number,
 *   mean: number,
 *   stdDev: number,
 *   iterationsPerSample: number,
 * }}
 */
export function measureSamples(fn, options = {}) {
  const {
    samples = 5,
    iterations = 100,
    warmupIterations = 20,
    now = () => performance.now(),
  } = options;

  for (let i = 0; i < warmupIterations; i++) {
    fn();
  }

  const timings = [];

  for (let sample = 0; sample < samples; sample++) {
    const start = now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const duration = now() - start;
    timings.push(duration);
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const mean = timings.reduce((sum, value) => sum + value, 0) / timings.length;
  const variance =
    timings.reduce((sum, value) => sum + (value - mean) ** 2, 0) / timings.length;

  return {
    samples: timings,
    median: getPercentile(sorted, 50),
    p95: getPercentile(sorted, 95),
    p99: getPercentile(sorted, 99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean,
    stdDev: Math.sqrt(variance),
    iterationsPerSample: iterations,
  };
}

/**
 * Returns a percentile from a sorted array of timings.
 *
 * @param {number[]} sortedTimings
 * @param {number} percentile - Desired percentile (0-100)
 * @returns {number}
 */
export function getPercentile(sortedTimings, percentile) {
  if (!sortedTimings.length) return 0;

  const clamped = Math.min(100, Math.max(0, percentile));
  const index = Math.ceil((clamped / 100) * sortedTimings.length) - 1;
  return sortedTimings[Math.max(0, index)];
}

export default {
  measureSamples,
  getPercentile,
};
