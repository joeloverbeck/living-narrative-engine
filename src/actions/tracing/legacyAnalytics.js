/**
 * @file Legacy action analytics and reporting utilities
 * @see actionAwareStructuredTrace.js
 * @see LegacyTargetCompatibilityLayer.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Utilities for analyzing and reporting on legacy action usage
 */
class LegacyAnalytics {
  #logger;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger, 'LegacyAnalytics');
  }

  /**
   * Analyze trace data to generate legacy usage report
   *
   * @param {ActionAwareStructuredTrace} trace - Trace containing legacy data
   * @returns {object} Comprehensive legacy usage analysis
   */
  generateLegacyReport(trace) {
    validateDependency(trace, 'ActionAwareStructuredTrace');

    const summary = trace.getLegacyProcessingSummary();
    const tracedActions = trace.getTracedActions();

    return {
      overview: summary,
      formatBreakdown: this.#analyzeFormatDistribution(tracedActions),
      performanceImpact: this.#analyzePerformanceImpact(tracedActions),
      migrationPriority: this.#assessMigrationPriority(tracedActions),
      recommendations: this.#generateRecommendations(summary, tracedActions),
    };
  }

  /**
   * Generate migration recommendations based on trace analysis
   *
   * @param summary
   * @param {Map} tracedActions - Action trace data
   * @returns {Array} Migration recommendations
   */
  #generateRecommendations(summary, tracedActions) {
    const recommendations = [];

    if (summary.totalLegacyActions > 0) {
      recommendations.push({
        type: 'migration_opportunity',
        priority: 'medium',
        description: `Found ${summary.totalLegacyActions} legacy actions that could be modernized`,
        actions: [
          'Review migration suggestions in trace data',
          'Plan gradual modernization',
        ],
      });
    }

    if (summary.averageConversionTime > 5) {
      recommendations.push({
        type: 'performance_concern',
        priority: 'high',
        description: `Legacy conversion taking ${summary.averageConversionTime}ms on average`,
        actions: [
          'Profile legacy conversion bottlenecks',
          'Consider caching conversion results',
        ],
      });
    }

    if (summary.failedConversions > 0) {
      recommendations.push({
        type: 'reliability_issue',
        priority: 'high',
        description: `${summary.failedConversions} legacy conversions failed`,
        actions: [
          'Review failed conversion logs',
          'Improve error handling in legacy layer',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Analyze format distribution in legacy actions
   *
   * @param tracedActions
   * @private
   */
  #analyzeFormatDistribution(tracedActions) {
    const distribution = {};

    for (const [, traceData] of tracedActions) {
      const legacyData = traceData.stages.legacy_processing;
      if (legacyData && legacyData.data.isLegacy) {
        const format = legacyData.data.originalFormat;
        distribution[format] = (distribution[format] || 0) + 1;
      }
    }

    return distribution;
  }

  /**
   * Analyze performance impact of legacy conversions
   *
   * @param tracedActions
   * @private
   */
  #analyzePerformanceImpact(tracedActions) {
    const metrics = {
      totalConversions: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: Infinity,
    };

    for (const [, traceData] of tracedActions) {
      const legacyData = traceData.stages.legacy_processing;
      if (
        legacyData &&
        legacyData.data.isLegacy &&
        legacyData.data.conversionTime
      ) {
        metrics.totalConversions++;
        metrics.totalTime += legacyData.data.conversionTime;
        metrics.maxTime = Math.max(
          metrics.maxTime,
          legacyData.data.conversionTime
        );
        metrics.minTime = Math.min(
          metrics.minTime,
          legacyData.data.conversionTime
        );
      }
    }

    return {
      ...metrics,
      averageTime:
        metrics.totalConversions > 0
          ? metrics.totalTime / metrics.totalConversions
          : 0,
      minTime: metrics.minTime === Infinity ? 0 : metrics.minTime,
    };
  }

  /**
   * Assess migration priority for legacy actions
   *
   * @param tracedActions
   * @private
   */
  #assessMigrationPriority(tracedActions) {
    const priorities = { high: [], medium: [], low: [] };

    for (const [actionId, traceData] of tracedActions) {
      const legacyData = traceData.stages.legacy_processing;
      if (legacyData && legacyData.data.isLegacy) {
        const conversionTime = legacyData.data.conversionTime || 0;
        const hasErrors = !legacyData.data.success;

        if (hasErrors || conversionTime > 7) {
          priorities.high.push({
            actionId,
            reason: hasErrors ? 'conversion_errors' : 'slow_conversion',
          });
        } else if (conversionTime > 3) {
          priorities.medium.push({
            actionId,
            reason: 'moderate_conversion_time',
          });
        } else {
          priorities.low.push({ actionId, reason: 'fast_conversion' });
        }
      }
    }

    return priorities;
  }
}

export default LegacyAnalytics;
