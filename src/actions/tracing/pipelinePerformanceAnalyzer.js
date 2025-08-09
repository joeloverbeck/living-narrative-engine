/**
 * @file Lightweight performance analyzer for pipeline traces (ACTTRA-018)
 * Analyzes timing data captured by ActionAwareStructuredTrace
 * @see actionAwareStructuredTrace.js
 * @see performanceMonitor.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * @typedef {object} StageThresholds
 * @property {number} component_filtering - Threshold for component filtering stage (ms)
 * @property {number} prerequisite_evaluation - Threshold for prerequisite evaluation stage (ms)
 * @property {number} multi_target_resolution - Threshold for multi-target resolution stage (ms)
 * @property {number} action_formatting - Threshold for action formatting stage (ms)
 * @property {number} target_resolution - Threshold for target resolution stage (ms)
 * @property {number} pipeline_total - Threshold for total pipeline duration (ms)
 */

/**
 * @typedef {object} StageStatistics
 * @property {number} count - Number of times this stage was executed
 * @property {number} totalDuration - Total duration for all executions (ms)
 * @property {number} avgDuration - Average duration per execution (ms)
 * @property {number} maxDuration - Maximum duration seen (ms)
 * @property {number} violations - Number of threshold violations
 */

/**
 * @typedef {object} BottleneckInfo
 * @property {string} stage - Name of the bottleneck stage
 * @property {number} avgDuration - Average duration for this stage (ms)
 * @property {number} violations - Number of threshold violations
 * @property {number} threshold - Configured threshold for this stage (ms)
 */

/**
 * @typedef {object} PerformanceRecommendation
 * @property {string} priority - Priority level (high, medium, low)
 * @property {string} stage - Affected stage (optional)
 * @property {string} message - Recommendation message
 */

/**
 * @typedef {object} PerformanceAnalysis
 * @property {Object<string, object>} actions - Performance data for each action
 * @property {Object<string, StageStatistics>} stages - Aggregated statistics per stage
 * @property {number} totalDuration - Total duration across all stages (ms)
 * @property {BottleneckInfo[]} bottlenecks - Identified performance bottlenecks
 * @property {PerformanceRecommendation[]} recommendations - Performance improvement recommendations
 */

/**
 * @typedef {object} PerformanceReport
 * @property {object} summary - High-level summary statistics
 * @property {Object<string, StageStatistics>} stages - Detailed stage statistics
 * @property {BottleneckInfo[]} bottlenecks - Performance bottlenecks
 * @property {PerformanceRecommendation[]} recommendations - Improvement recommendations
 * @property {string} timestamp - Report generation timestamp
 */

/**
 * Lightweight performance analyzer for pipeline traces
 * Leverages existing ActionAwareStructuredTrace and PerformanceMonitor infrastructure
 */
class PipelinePerformanceAnalyzer {
  #performanceMonitor;
  #logger;
  #stageThresholds;

  /**
   * Creates a PipelinePerformanceAnalyzer instance
   *
   * @param {object} dependencies
   * @param {import('./performanceMonitor.js').PerformanceMonitor} dependencies.performanceMonitor - Performance monitor for threshold checking
   * @param {object} dependencies.logger - Logger instance
   * @param {StageThresholds} [dependencies.stageThresholds] - Custom stage thresholds
   */
  constructor({ performanceMonitor, logger, stageThresholds = {} }) {
    validateDependency(performanceMonitor, 'performanceMonitor', null, {
      requiredMethods: ['getRealtimeMetrics'],
    });
    validateDependency(logger, 'logger', null, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#performanceMonitor = performanceMonitor;
    this.#logger = logger;

    // Performance thresholds per stage (in milliseconds)
    this.#stageThresholds = {
      component_filtering: 100,
      prerequisite_evaluation: 200,
      multi_target_resolution: 500,
      action_formatting: 150,
      target_resolution: 300,
      pipeline_total: 1000,
      ...stageThresholds,
    };

    this.#logger.debug('PipelinePerformanceAnalyzer initialized', {
      thresholds: this.#stageThresholds,
    });
  }

  /**
   * Analyze performance data from an ActionAwareStructuredTrace
   *
   * @param {import('./actionAwareStructuredTrace.js').default} trace - The trace to analyze
   * @returns {PerformanceAnalysis} Performance analysis results
   * @throws {Error} If trace is invalid or missing required methods
   */
  analyzeTracePerformance(trace) {
    if (!trace || !trace.getTracedActions) {
      throw new Error(
        'Invalid trace provided - must have getTracedActions method'
      );
    }

    if (!trace.calculateStagePerformance) {
      this.#logger.warn(
        'Trace does not support stage performance calculation - using basic analysis'
      );
      return this.#basicAnalysis(trace);
    }

    const tracedActions = trace.getTracedActions();
    const analysis = {
      actions: {},
      stages: {},
      totalDuration: 0,
      bottlenecks: [],
      recommendations: [],
    };

    this.#logger.debug('Analyzing performance for trace', {
      actionCount: tracedActions.size,
    });

    // Analyze each action's performance
    for (const [actionId, actionData] of tracedActions) {
      try {
        const stagePerformance = trace.calculateStagePerformance(actionId);

        if (stagePerformance) {
          analysis.actions[actionId] = stagePerformance;

          // Aggregate stage statistics
          this.#aggregateStageStats(analysis.stages, stagePerformance);

          // Track total duration
          const actionDuration =
            this.#calculateActionDuration(stagePerformance);
          analysis.totalDuration += actionDuration;
        }
      } catch (error) {
        this.#logger.warn(
          `Failed to analyze performance for action ${actionId}`,
          error
        );
      }
    }

    // Identify bottlenecks and generate recommendations
    this.#identifyBottlenecks(analysis);
    this.#generateRecommendations(analysis);

    this.#logger.debug('Performance analysis completed', {
      totalActions: Object.keys(analysis.actions).length,
      totalStages: Object.keys(analysis.stages).length,
      bottleneckCount: analysis.bottlenecks.length,
      totalDuration: analysis.totalDuration,
    });

    return analysis;
  }

  /**
   * Generate a comprehensive performance report
   *
   * @param {import('./actionAwareStructuredTrace.js').default} trace - The trace to analyze
   * @returns {PerformanceReport} Comprehensive performance report
   */
  generatePerformanceReport(trace) {
    const analysis = this.analyzeTracePerformance(trace);

    const report = {
      summary: {
        totalActions: Object.keys(analysis.actions).length,
        totalDuration: analysis.totalDuration,
        stageCount: Object.keys(analysis.stages).length,
        bottleneckCount: analysis.bottlenecks.length,
        averageDurationPerAction:
          analysis.totalDuration /
          Math.max(Object.keys(analysis.actions).length, 1),
      },
      stages: analysis.stages,
      bottlenecks: analysis.bottlenecks,
      recommendations: analysis.recommendations,
      timestamp: new Date().toISOString(),
    };

    // Log performance summary
    this.#logger.debug('Generated performance report', {
      summary: report.summary,
      bottleneckCount: report.bottlenecks.length,
      recommendationCount: report.recommendations.length,
    });

    // Record metrics using existing performance monitor
    this.#recordMetricsInMonitor(analysis);

    return report;
  }

  /**
   * Get the configured stage thresholds
   *
   * @returns {StageThresholds} Current stage thresholds
   */
  getStageThresholds() {
    return { ...this.#stageThresholds };
  }

  /**
   * Update stage thresholds
   *
   * @param {Partial<StageThresholds>} newThresholds - New threshold values
   */
  updateStageThresholds(newThresholds) {
    if (!newThresholds || typeof newThresholds !== 'object') {
      throw new Error('Invalid thresholds provided');
    }

    // Validate threshold values
    for (const [stage, threshold] of Object.entries(newThresholds)) {
      if (typeof threshold !== 'number' || threshold < 0) {
        throw new Error(
          `Invalid threshold for stage ${stage}: must be a non-negative number`
        );
      }
    }

    this.#stageThresholds = { ...this.#stageThresholds, ...newThresholds };

    this.#logger.debug('Updated stage thresholds', {
      updated: newThresholds,
      current: this.#stageThresholds,
    });
  }

  /**
   * Aggregate stage statistics from individual action performance data
   *
   * @private
   * @param {Object<string, StageStatistics>} stageStats - Stage statistics object to update
   * @param {object} stagePerformance - Performance data for a single action
   */
  #aggregateStageStats(stageStats, stagePerformance) {
    for (const [stageName, stageData] of Object.entries(stagePerformance)) {
      if (!stageStats[stageName]) {
        stageStats[stageName] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          maxDuration: 0,
          violations: 0,
        };
      }

      const stageStat = stageStats[stageName];
      const duration = stageData.duration || 0;

      stageStat.count++;
      stageStat.totalDuration += duration;
      stageStat.avgDuration = stageStat.totalDuration / stageStat.count;
      stageStat.maxDuration = Math.max(stageStat.maxDuration, duration);

      // Check threshold violations
      const threshold = this.#stageThresholds[stageName];
      if (threshold && duration > threshold) {
        stageStat.violations++;

        // Use existing performance monitor for alerts if available
        try {
          if (this.#performanceMonitor.checkThreshold) {
            this.#performanceMonitor.checkThreshold(
              `stage_${stageName}`,
              duration,
              threshold
            );
          }
        } catch (error) {
          this.#logger.debug(
            `Performance monitor threshold check failed: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Calculate total duration for an action across all its stages
   *
   * @private
   * @param {object} stagePerformance - Performance data for an action
   * @returns {number} Total duration in milliseconds
   */
  #calculateActionDuration(stagePerformance) {
    let totalDuration = 0;
    for (const stageData of Object.values(stagePerformance)) {
      totalDuration += stageData.duration || 0;
    }
    return totalDuration;
  }

  /**
   * Identify performance bottlenecks from analysis data
   *
   * @private
   * @param {PerformanceAnalysis} analysis - Analysis data to update
   */
  #identifyBottlenecks(analysis) {
    for (const [stageName, stageStat] of Object.entries(analysis.stages)) {
      if (stageStat.violations > 0) {
        analysis.bottlenecks.push({
          stage: stageName,
          avgDuration: stageStat.avgDuration,
          violations: stageStat.violations,
          threshold: this.#stageThresholds[stageName] || 0,
        });
      }
    }

    // Sort bottlenecks by impact (average duration descending)
    analysis.bottlenecks.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Generate performance improvement recommendations
   *
   * @private
   * @param {PerformanceAnalysis} analysis - Analysis data to update
   */
  #generateRecommendations(analysis) {
    // Recommend optimization for top bottleneck
    if (analysis.bottlenecks.length > 0) {
      const topBottleneck = analysis.bottlenecks[0];
      analysis.recommendations.push({
        priority: 'high',
        stage: topBottleneck.stage,
        message: `Optimize ${topBottleneck.stage} - averaging ${topBottleneck.avgDuration.toFixed(2)}ms (threshold: ${topBottleneck.threshold}ms)`,
      });
    }

    // Check total pipeline duration
    if (analysis.totalDuration > this.#stageThresholds.pipeline_total) {
      analysis.recommendations.push({
        priority: 'medium',
        message: `Total pipeline duration (${analysis.totalDuration.toFixed(2)}ms) exceeds threshold (${this.#stageThresholds.pipeline_total}ms)`,
      });
    }

    // Recommend profiling if many stages are slow
    const slowStages = Object.values(analysis.stages).filter(
      (stage) => stage.avgDuration > 100
    ).length;

    if (slowStages > 2) {
      analysis.recommendations.push({
        priority: 'medium',
        message: `${slowStages} stages show elevated durations - consider detailed profiling`,
      });
    }
  }

  /**
   * Basic analysis for traces without full performance support
   *
   * @private
   * @param {object} trace - Basic trace object
   * @returns {PerformanceAnalysis} Basic analysis results
   */
  #basicAnalysis(trace) {
    return {
      actions: {},
      stages: {},
      totalDuration: 0,
      bottlenecks: [],
      recommendations: [
        {
          priority: 'low',
          message:
            'Upgrade to ActionAwareStructuredTrace for detailed performance analysis',
        },
      ],
    };
  }

  /**
   * Record performance metrics in the performance monitor
   *
   * @private
   * @param {PerformanceAnalysis} analysis - Analysis results
   */
  #recordMetricsInMonitor(analysis) {
    try {
      if (!this.#performanceMonitor.recordMetric) {
        return; // Monitor doesn't support metric recording
      }

      for (const [stageName, stageStat] of Object.entries(analysis.stages)) {
        this.#performanceMonitor.recordMetric(
          `pipeline.stage.${stageName}.avg_duration`,
          stageStat.avgDuration
        );

        this.#performanceMonitor.recordMetric(
          `pipeline.stage.${stageName}.max_duration`,
          stageStat.maxDuration
        );

        if (stageStat.violations > 0) {
          this.#performanceMonitor.recordMetric(
            `pipeline.stage.${stageName}.violations`,
            stageStat.violations
          );
        }
      }

      this.#performanceMonitor.recordMetric(
        'pipeline.total_duration',
        analysis.totalDuration
      );
    } catch (error) {
      this.#logger.debug(
        `Failed to record metrics in performance monitor: ${error.message}`
      );
    }
  }
}

export default PipelinePerformanceAnalyzer;
