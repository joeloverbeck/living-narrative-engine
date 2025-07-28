/**
 * @file Performance testing utilities for rules
 */

/**
 * Measures rule execution performance
 *
 * @param {Function} ruleExecutor - Function that executes the rule
 * @param {object} config - Performance test configuration
 * @returns {object} Performance metrics
 */
export async function measureRulePerformance(ruleExecutor, config = {}) {
  const {
    iterations = 100,
    warmupIterations = 10,
    timeout = 1000,
    measureMemory = true,
  } = config;

  const metrics = {
    iterations: {
      total: iterations,
      completed: 0,
      failed: 0,
      timeouts: 0,
    },
    timing: {
      total: 0,
      average: 0,
      min: Infinity,
      max: 0,
      percentiles: {},
    },
    memory: measureMemory
      ? {
          initialUsage: 0,
          peakUsage: 0,
          finalUsage: 0,
          leaked: 0,
        }
      : null,
    errors: [],
  };

  // Record initial memory
  if (measureMemory && performance.memory) {
    metrics.memory.initialUsage = performance.memory.usedJSHeapSize;
  }

  const executionTimes = [];

  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    try {
      await executeWithTimeout(ruleExecutor, timeout);
    } catch (error) {
      // Ignore warmup errors
    }
  }

  // Actual performance measurement
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      await executeWithTimeout(ruleExecutor, timeout);

      const duration = performance.now() - startTime;
      executionTimes.push(duration);

      metrics.iterations.completed++;
      metrics.timing.total += duration;
      metrics.timing.min = Math.min(metrics.timing.min, duration);
      metrics.timing.max = Math.max(metrics.timing.max, duration);

      // Track peak memory usage
      if (measureMemory && performance.memory) {
        metrics.memory.peakUsage = Math.max(
          metrics.memory.peakUsage,
          performance.memory.usedJSHeapSize
        );
      }
    } catch (error) {
      if (error.message === 'Timeout') {
        metrics.iterations.timeouts++;
      } else {
        metrics.iterations.failed++;
        metrics.errors.push({
          iteration: i,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    }
  }

  // Calculate final metrics
  if (metrics.iterations.completed > 0) {
    metrics.timing.average =
      metrics.timing.total / metrics.iterations.completed;
    metrics.timing.percentiles = calculatePercentiles(executionTimes);
  }

  // Record final memory
  if (measureMemory && performance.memory) {
    metrics.memory.finalUsage = performance.memory.usedJSHeapSize;
    metrics.memory.leaked =
      metrics.memory.finalUsage - metrics.memory.initialUsage;
  }

  return metrics;
}

/**
 * Executes a function with timeout
 *
 * @param {Function} fn - Function to execute
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Execution promise
 */
async function executeWithTimeout(fn, timeout) {
  const executionPromise = fn();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  );

  return Promise.race([executionPromise, timeoutPromise]);
}

/**
 * Calculates performance percentiles
 *
 * @param {Array} times - Array of execution times
 * @returns {object} Percentile values
 */
function calculatePercentiles(times) {
  if (times.length === 0) return {};

  const sorted = [...times].sort((a, b) => a - b);
  const percentiles = [50, 75, 90, 95, 99];
  const result = {};

  for (const p of percentiles) {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    result[`p${p}`] = sorted[Math.max(0, index)];
  }

  return result;
}

/**
 * Generates performance report
 *
 * @param {object} metrics - Performance metrics
 * @returns {string} Formatted performance report
 */
export function generatePerformanceReport(metrics) {
  const report = [];

  report.push('=== Performance Test Report ===');
  report.push(`Total iterations: ${metrics.iterations.total}`);
  report.push(`Completed: ${metrics.iterations.completed}`);
  report.push(`Failed: ${metrics.iterations.failed}`);
  report.push(`Timeouts: ${metrics.iterations.timeouts}`);
  report.push('');

  if (metrics.iterations.completed > 0) {
    report.push('=== Timing Metrics ===');
    report.push(`Average: ${metrics.timing.average.toFixed(2)}ms`);
    report.push(`Min: ${metrics.timing.min.toFixed(2)}ms`);
    report.push(`Max: ${metrics.timing.max.toFixed(2)}ms`);

    if (metrics.timing.percentiles) {
      report.push('');
      report.push('=== Percentiles ===');
      Object.entries(metrics.timing.percentiles).forEach(([p, value]) => {
        report.push(`${p}: ${value.toFixed(2)}ms`);
      });
    }
  }

  if (metrics.memory) {
    report.push('');
    report.push('=== Memory Usage ===');
    report.push(
      `Initial: ${(metrics.memory.initialUsage / 1024 / 1024).toFixed(2)}MB`
    );
    report.push(
      `Peak: ${(metrics.memory.peakUsage / 1024 / 1024).toFixed(2)}MB`
    );
    report.push(
      `Final: ${(metrics.memory.finalUsage / 1024 / 1024).toFixed(2)}MB`
    );
    report.push(
      `Leaked: ${(metrics.memory.leaked / 1024 / 1024).toFixed(2)}MB`
    );
  }

  return report.join('\n');
}

export default {
  measureRulePerformance,
  generatePerformanceReport,
};