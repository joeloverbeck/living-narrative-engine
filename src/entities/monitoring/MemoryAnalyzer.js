/**
 * @file MemoryAnalyzer - Advanced memory analysis and leak detection algorithms
 * @module MemoryAnalyzer
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  validateDependency,
  assertPresent,
} from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} TrendAnalysis
 * @property {string} trend - Overall trend (stable, growing, shrinking, volatile)
 * @property {number} slope - Linear regression slope
 * @property {number} rSquared - Coefficient of determination
 * @property {number} volatility - Standard deviation of changes
 * @property {number} confidence - Confidence level (0-1)
 */

/**
 * @typedef {object} LeakPattern
 * @property {string} type - Pattern type (linear, exponential, step, sawtooth)
 * @property {number} severity - Severity score (0-10)
 * @property {string} description - Human-readable description
 * @property {object} characteristics - Pattern-specific characteristics
 */

/**
 * @typedef {object} MemoryReport
 * @property {TrendAnalysis} trend - Trend analysis
 * @property {LeakPattern[]} patterns - Detected patterns
 * @property {object} statistics - Statistical summary
 * @property {string[]} recommendations - Action recommendations
 * @property {number} riskScore - Overall risk score (0-100)
 */

/**
 * Advanced memory analysis and pattern detection
 */
export default class MemoryAnalyzer extends BaseService {
  #logger;
  #config;
  #analysisCache;

  /**
   * Creates a new MemoryAnalyzer instance
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {object} [config] - Analysis configuration
   */
  constructor({ logger }, config = {}) {
    super();

    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });

    this.#logger = this._init('MemoryAnalyzer', logger);

    this.#config = {
      minSamplesForAnalysis: config.minSamplesForAnalysis || 30,
      outlierThreshold: config.outlierThreshold || 2.5, // Standard deviations
      patternConfidenceThreshold: config.patternConfidenceThreshold || 0.7,
      ...config,
    };

    this.#analysisCache = new Map();

    this.#logger.info('MemoryAnalyzer initialized', this.#config);
  }

  /**
   * Analyze memory trend using linear regression
   *
   * @param {Array<{timestamp: number, heapUsed: number}>} samples - Memory samples
   * @returns {TrendAnalysis}
   */
  analyzeTrend(samples) {
    assertPresent(samples, 'Memory samples');

    if (samples.length < this.#config.minSamplesForAnalysis) {
      return {
        trend: 'insufficient_data',
        slope: 0,
        rSquared: 0,
        volatility: 0,
        confidence: 0,
      };
    }

    // Prepare data for linear regression
    const n = samples.length;
    const timeOffset = samples[0].timestamp;
    const points = samples.map((s) => ({
      x: (s.timestamp - timeOffset) / 1000, // Convert to seconds
      y: s.heapUsed / 1048576, // Convert to MB
    }));

    // Calculate linear regression
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumY2 = points.reduce((sum, p) => sum + p.y * p.y, 0);

    const meanX = sumX / n;
    const meanY = sumY / n;

    // Calculate slope and intercept
    const numerator = n * sumXY - sumX * sumY;
    const denominator = n * sumX2 - sumX * sumX;

    if (denominator === 0) {
      return {
        trend: 'stable',
        slope: 0,
        rSquared: 0,
        volatility: 0,
        confidence: 0.5,
      };
    }

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;

    // Calculate R-squared
    const yPredicted = points.map((p) => slope * p.x + intercept);
    const ssRes = points.reduce(
      (sum, p, i) => sum + Math.pow(p.y - yPredicted[i], 2),
      0
    );
    const ssTot = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    // Calculate volatility (standard deviation of residuals)
    const residuals = points.map((p, i) => p.y - yPredicted[i]);
    const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / n;
    const volatility = Math.sqrt(
      residuals.reduce((sum, r) => sum + Math.pow(r - meanResidual, 2), 0) / n
    );

    // Determine trend based on slope
    let trend = 'stable';
    const slopeThreshold = 0.1; // MB per second

    if (slope > slopeThreshold) {
      trend = 'growing';
    } else if (slope < -slopeThreshold) {
      trend = 'shrinking';
    } else if (volatility > meanY * 0.2) {
      // Volatility > 20% of mean
      trend = 'volatile';
    }

    // Calculate confidence based on R-squared and sample size
    const sampleFactor = Math.min(1, samples.length / 100);
    const confidence = rSquared * sampleFactor;

    return {
      trend,
      slope: slope * 60, // Convert to MB per minute
      rSquared,
      volatility,
      confidence,
    };
  }

  /**
   * Detect specific memory leak patterns
   *
   * @param {Array<{timestamp: number, heapUsed: number}>} samples - Memory samples
   * @returns {LeakPattern[]}
   */
  detectPatterns(samples) {
    if (samples.length < this.#config.minSamplesForAnalysis) {
      return [];
    }

    const patterns = [];

    // Detect linear growth pattern
    const linearPattern = this.#detectLinearPattern(samples);
    if (linearPattern) patterns.push(linearPattern);

    // Detect exponential growth pattern
    const exponentialPattern = this.#detectExponentialPattern(samples);
    if (exponentialPattern) patterns.push(exponentialPattern);

    // Detect step pattern (sudden jumps)
    const stepPattern = this.#detectStepPattern(samples);
    if (stepPattern) patterns.push(stepPattern);

    // Detect sawtooth pattern (grow and release cycles)
    const sawtoothPattern = this.#detectSawtoothPattern(samples);
    if (sawtoothPattern) patterns.push(sawtoothPattern);

    return patterns;
  }

  /**
   * Detect linear growth pattern
   *
   * @param samples
   * @private
   */
  #detectLinearPattern(samples) {
    const trend = this.analyzeTrend(samples);

    if (
      trend.trend === 'growing' &&
      trend.rSquared > this.#config.patternConfidenceThreshold
    ) {
      return {
        type: 'linear',
        severity: Math.min(10, trend.slope / 10), // 10MB/min = severity 1
        description: `Linear memory growth at ${trend.slope.toFixed(2)} MB/min`,
        characteristics: {
          growthRate: trend.slope,
          consistency: trend.rSquared,
        },
      };
    }

    return null;
  }

  /**
   * Detect exponential growth pattern
   *
   * @param samples
   * @private
   */
  #detectExponentialPattern(samples) {
    // Convert to log scale and check for linear pattern
    const logSamples = samples.map((s) => ({
      timestamp: s.timestamp,
      heapUsed: Math.log(Math.max(1, s.heapUsed)),
    }));

    const logTrend = this.analyzeTrend(logSamples);

    if (
      logTrend.trend === 'growing' &&
      logTrend.rSquared > this.#config.patternConfidenceThreshold
    ) {
      const doublingTime = Math.log(2) / logTrend.slope;
      return {
        type: 'exponential',
        severity: Math.min(10, 100 / doublingTime), // Faster doubling = higher severity
        description: `Exponential growth, doubling every ${doublingTime.toFixed(1)} minutes`,
        characteristics: {
          doublingTime,
          growthFactor: Math.exp(logTrend.slope),
        },
      };
    }

    return null;
  }

  /**
   * Detect step pattern (sudden jumps)
   *
   * @param samples
   * @private
   */
  #detectStepPattern(samples) {
    const jumps = [];
    const threshold = this.#calculateJumpThreshold(samples);

    for (let i = 1; i < samples.length; i++) {
      const delta = samples[i].heapUsed - samples[i - 1].heapUsed;
      if (Math.abs(delta) > threshold) {
        jumps.push({
          index: i,
          size: delta,
          timestamp: samples[i].timestamp,
        });
      }
    }

    if (jumps.length > 2) {
      const totalJumpSize = jumps.reduce((sum, j) => sum + Math.abs(j.size), 0);
      const avgJumpSize = totalJumpSize / jumps.length;

      return {
        type: 'step',
        severity: Math.min(10, jumps.length / 10), // More jumps = higher severity
        description: `Step pattern with ${jumps.length} jumps, avg ${(avgJumpSize / 1048576).toFixed(2)} MB`,
        characteristics: {
          jumpCount: jumps.length,
          averageJumpSize: avgJumpSize,
          jumps: jumps.slice(0, 5), // Keep first 5 jumps for reference
        },
      };
    }

    return null;
  }

  /**
   * Detect sawtooth pattern (grow and release cycles)
   *
   * @param samples
   * @private
   */
  #detectSawtoothPattern(samples) {
    const peaks = [];
    const valleys = [];

    // Find local maxima and minima
    for (let i = 1; i < samples.length - 1; i++) {
      const prev = samples[i - 1].heapUsed;
      const curr = samples[i].heapUsed;
      const next = samples[i + 1].heapUsed;

      if (curr > prev && curr > next) {
        peaks.push({ index: i, value: curr });
      } else if (curr < prev && curr < next) {
        valleys.push({ index: i, value: curr });
      }
    }

    // Check for regular pattern
    if (peaks.length >= 3 && valleys.length >= 3) {
      // Calculate average cycle period
      const peakIntervals = [];
      for (let i = 1; i < peaks.length; i++) {
        peakIntervals.push(peaks[i].index - peaks[i - 1].index);
      }

      const avgInterval =
        peakIntervals.reduce((sum, i) => sum + i, 0) / peakIntervals.length;
      const intervalVariance =
        peakIntervals.reduce(
          (sum, i) => sum + Math.pow(i - avgInterval, 2),
          0
        ) / peakIntervals.length;

      // Low variance indicates regular pattern
      if (Math.sqrt(intervalVariance) / avgInterval < 0.3) {
        const avgPeak =
          peaks.reduce((sum, p) => sum + p.value, 0) / peaks.length;
        const avgValley =
          valleys.reduce((sum, v) => sum + v.value, 0) / valleys.length;
        const amplitude = avgPeak - avgValley;

        return {
          type: 'sawtooth',
          severity: Math.min(10, amplitude / (50 * 1048576)), // 50MB amplitude = severity 1
          description: `Sawtooth pattern with ${(amplitude / 1048576).toFixed(2)} MB amplitude`,
          characteristics: {
            cycleCount: peaks.length,
            averagePeriod: avgInterval,
            amplitude,
            regularity: 1 - Math.sqrt(intervalVariance) / avgInterval,
          },
        };
      }
    }

    return null;
  }

  /**
   * Calculate jump threshold for step detection
   *
   * @param samples
   * @private
   */
  #calculateJumpThreshold(samples) {
    const deltas = [];
    for (let i = 1; i < samples.length; i++) {
      deltas.push(Math.abs(samples[i].heapUsed - samples[i - 1].heapUsed));
    }

    const mean = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
    const stdDev = Math.sqrt(
      deltas.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / deltas.length
    );

    return mean + this.#config.outlierThreshold * stdDev;
  }

  /**
   * Generate comprehensive memory analysis report
   *
   * @param {Array<{timestamp: number, heapUsed: number}>} samples - Memory samples
   * @param {object} [context] - Additional context
   * @returns {MemoryReport}
   */
  generateReport(samples, context = {}) {
    if (samples.length < this.#config.minSamplesForAnalysis) {
      return {
        trend: {
          trend: 'insufficient_data',
          slope: 0,
          rSquared: 0,
          volatility: 0,
          confidence: 0,
        },
        patterns: [],
        statistics: {
          sampleCount: samples.length,
          minRequired: this.#config.minSamplesForAnalysis,
        },
        recommendations: ['Collect more data samples for accurate analysis'],
        riskScore: 0,
      };
    }

    // Perform analyses
    const trend = this.analyzeTrend(samples);
    const patterns = this.detectPatterns(samples);

    // Calculate statistics
    const heapValues = samples.map((s) => s.heapUsed);
    const statistics = {
      sampleCount: samples.length,
      timeSpan:
        (samples[samples.length - 1].timestamp - samples[0].timestamp) / 60000, // Minutes
      // Use reduce to avoid stack overflow with large arrays
      minHeap: heapValues.reduce((min, v) => Math.min(min, v), Infinity),
      maxHeap: heapValues.reduce((max, v) => Math.max(max, v), -Infinity),
      avgHeap: heapValues.reduce((sum, v) => sum + v, 0) / heapValues.length,
      currentHeap: heapValues[heapValues.length - 1],
    };

    // Generate recommendations
    const recommendations = this.#generateRecommendations(
      trend,
      patterns,
      statistics
    );

    // Calculate risk score
    const riskScore = this.#calculateRiskScore(trend, patterns, statistics);

    return {
      trend,
      patterns,
      statistics,
      recommendations,
      riskScore,
    };
  }

  /**
   * Generate action recommendations
   *
   * @param trend
   * @param patterns
   * @param statistics
   * @private
   */
  #generateRecommendations(trend, patterns, statistics) {
    const recommendations = [];

    // Trend-based recommendations
    if (trend.trend === 'growing') {
      if (trend.slope > 10) {
        recommendations.push(
          'URGENT: Rapid memory growth detected. Investigate immediately.'
        );
      } else if (trend.slope > 5) {
        recommendations.push('Monitor closely: Steady memory growth detected.');
      } else {
        recommendations.push(
          'Minor memory growth detected. Schedule investigation.'
        );
      }
    }

    // Pattern-based recommendations
    patterns.forEach((pattern) => {
      switch (pattern.type) {
        case 'linear':
          recommendations.push(
            'Implement periodic memory cleanup or resource pooling.'
          );
          break;
        case 'exponential':
          recommendations.push(
            'Critical: Exponential growth indicates severe leak. Immediate action required.'
          );
          break;
        case 'step':
          recommendations.push(
            'Investigate operations causing memory jumps. Consider caching strategy.'
          );
          break;
        case 'sawtooth':
          recommendations.push(
            'GC cycles detected. Consider tuning garbage collection parameters.'
          );
          break;
      }
    });

    // Statistics-based recommendations
    const heapGrowth = statistics.currentHeap - statistics.minHeap;
    const growthPercent =
      statistics.minHeap > 0 ? heapGrowth / statistics.minHeap : 0;

    if (growthPercent > 1) {
      recommendations.push(
        'Memory has more than doubled. Review resource management.'
      );
    }

    if (statistics.timeSpan < 5) {
      recommendations.push(
        'Extend monitoring period for more accurate analysis.'
      );
    }

    return recommendations.length > 0
      ? recommendations
      : ['Memory usage appears stable.'];
  }

  /**
   * Calculate overall risk score
   *
   * @param trend
   * @param patterns
   * @param statistics
   * @private
   */
  #calculateRiskScore(trend, patterns, statistics) {
    let score = 0;

    // Trend contribution (0-40 points)
    if (trend.trend === 'growing') {
      score += Math.min(40, trend.slope * trend.confidence * 4);
    } else if (trend.trend === 'volatile') {
      score += 20;
    }

    // Pattern contribution (0-40 points)
    patterns.forEach((pattern) => {
      score += Math.min(40, pattern.severity * 4);
    });

    // Statistics contribution (0-20 points)
    const heapGrowth = statistics.currentHeap - statistics.minHeap;
    const growthPercent =
      statistics.minHeap > 0 ? heapGrowth / statistics.minHeap : 0;
    score += Math.min(20, growthPercent * 20);

    return Math.min(100, Math.round(score));
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.#analysisCache.clear();
    this.#logger.debug('Analysis cache cleared');
  }

  /**
   * Destroy analyzer
   */
  destroy() {
    this.clearCache();
    this.#logger.info('MemoryAnalyzer destroyed');
  }
}
