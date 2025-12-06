/**
 * @file Performance analysis utilities for action execution traces
 * @see actionExecutionTrace.js
 */

import { highPrecisionTimer } from './highPrecisionTimer.js';
import { validateDependency, assertPresent } from '../../../utils/index.js';

/**
 * Performance analyzer for action execution traces
 * Provides statistical analysis and performance insights
 */
export class ActionPerformanceAnalyzer {
  #traces;
  #stats;

  constructor() {
    this.#traces = [];
    this.#stats = {
      totalTraces: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      phaseStats: new Map(),
    };
  }

  /**
   * Add trace for analysis
   *
   * @param {ActionExecutionTrace} trace - Trace to analyze
   */
  addTrace(trace) {
    if (!trace.isComplete) {
      return; // Skip incomplete traces
    }

    const timingData = trace.getTimingSummary();
    if (!timingData) {
      return; // Skip traces without timing data
    }

    this.#traces.push({
      actionId: trace.actionId,
      actorId: trace.actorId,
      duration: timingData.totalDuration,
      phases: timingData.phases,
      timestamp: Date.now(),
    });

    this.#updateStats();
  }

  /**
   * Get performance statistics
   *
   * @returns {object} Performance statistics
   */
  getStats() {
    return {
      ...this.#stats,
      percentiles: this.#calculatePercentiles(),
      phaseBreakdown: this.#getPhaseBreakdown(),
    };
  }

  /**
   * Identify slow traces
   *
   * @param {number} threshold - Threshold in milliseconds
   * @returns {Array} Slow traces
   */
  getSlowTraces(threshold = 100) {
    return this.#traces
      .filter((trace) => trace.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Identify performance bottlenecks
   *
   * @returns {Array} Bottleneck analysis
   */
  identifyBottlenecks() {
    const phaseStats = this.#getPhaseBreakdown();

    return Object.entries(phaseStats)
      .map(([phase, stats]) => ({
        phase,
        averageDuration: stats.average,
        percentage: stats.percentage,
        bottleneckScore: stats.average * stats.count, // Simple scoring
      }))
      .sort((a, b) => b.bottleneckScore - a.bottleneckScore);
  }

  /**
   * Generate performance report
   *
   * @returns {string} Human-readable performance report
   */
  generateReport() {
    const stats = this.getStats();
    const percentiles = stats.percentiles;
    const bottlenecks = this.identifyBottlenecks();

    const lines = [
      'ACTION EXECUTION PERFORMANCE REPORT',
      '='.repeat(35),
      `Total Traces: ${stats.totalTraces}`,
      `Average Duration: ${highPrecisionTimer.formatDuration(stats.averageDuration)}`,
      `Min Duration: ${highPrecisionTimer.formatDuration(stats.minDuration)}`,
      `Max Duration: ${highPrecisionTimer.formatDuration(stats.maxDuration)}`,
      '',
      'Percentiles:',
      `-----------`,
      `P50: ${highPrecisionTimer.formatDuration(percentiles.p50)}`,
      `P90: ${highPrecisionTimer.formatDuration(percentiles.p90)}`,
      `P95: ${highPrecisionTimer.formatDuration(percentiles.p95)}`,
      `P99: ${highPrecisionTimer.formatDuration(percentiles.p99)}`,
      '',
      'Top Bottlenecks:',
      '---------------',
    ];

    bottlenecks.slice(0, 5).forEach((bottleneck, index) => {
      lines.push(
        `${index + 1}. ${bottleneck.phase}: ${highPrecisionTimer.formatDuration(bottleneck.averageDuration)} (${bottleneck.percentage}%)`
      );
    });

    return lines.join('\n');
  }

  /**
   * Clear all analysis data
   */
  clear() {
    this.#traces = [];
    this.#stats = {
      totalTraces: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      phaseStats: new Map(),
    };
  }

  /**
   * Update statistics
   *
   * @private
   */
  #updateStats() {
    this.#stats.totalTraces = this.#traces.length;
    this.#stats.totalDuration = this.#traces.reduce(
      (sum, trace) => sum + trace.duration,
      0
    );
    this.#stats.averageDuration =
      this.#stats.totalDuration / this.#stats.totalTraces;

    // Use reduce to avoid stack overflow with large arrays
    const durations = this.#traces.map((t) => t.duration);
    this.#stats.minDuration = durations.reduce(
      (min, d) => Math.min(min, d),
      Infinity
    );
    this.#stats.maxDuration = durations.reduce(
      (max, d) => Math.max(max, d),
      -Infinity
    );

    this.#updatePhaseStats();
  }

  /**
   * Update phase statistics
   *
   * @private
   */
  #updatePhaseStats() {
    this.#stats.phaseStats.clear();

    this.#traces.forEach((trace) => {
      trace.phases.forEach((phase) => {
        if (!this.#stats.phaseStats.has(phase.name)) {
          this.#stats.phaseStats.set(phase.name, {
            count: 0,
            totalDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
          });
        }

        const phaseStats = this.#stats.phaseStats.get(phase.name);
        phaseStats.count++;
        phaseStats.totalDuration += phase.duration || 0;
        phaseStats.minDuration = Math.min(
          phaseStats.minDuration,
          phase.duration || 0
        );
        phaseStats.maxDuration = Math.max(
          phaseStats.maxDuration,
          phase.duration || 0
        );
      });
    });
  }

  /**
   * Calculate percentiles
   *
   * @private
   * @returns {object} Percentile values
   */
  #calculatePercentiles() {
    if (this.#traces.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const durations = this.#traces.map((t) => t.duration).sort((a, b) => a - b);

    return {
      p50: this.#getPercentile(durations, 0.5),
      p90: this.#getPercentile(durations, 0.9),
      p95: this.#getPercentile(durations, 0.95),
      p99: this.#getPercentile(durations, 0.99),
    };
  }

  /**
   * Get percentile value
   *
   * @private
   * @param {Array<number>} sortedArray - Sorted array of values
   * @param {number} percentile - Percentile (0-1)
   * @returns {number} Percentile value
   */
  #getPercentile(sortedArray, percentile) {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Get phase breakdown
   *
   * @private
   * @returns {object} Phase breakdown statistics
   */
  #getPhaseBreakdown() {
    const breakdown = {};

    this.#stats.phaseStats.forEach((stats, phaseName) => {
      breakdown[phaseName] = {
        count: stats.count,
        total: stats.totalDuration,
        average: stats.totalDuration / stats.count,
        min: stats.minDuration,
        max: stats.maxDuration,
        percentage: (
          (stats.totalDuration / this.#stats.totalDuration) *
          100
        ).toFixed(1),
      };
    });

    return breakdown;
  }
}
