# ACTTRA-018: Pipeline Stage Performance Metrics

## Executive Summary

Implement comprehensive performance metrics collection and analysis system for all action pipeline stages within the action tracing framework. This ticket provides detailed performance monitoring, bottleneck identification, optimization recommendations, and real-time performance analytics for the entire action processing pipeline while maintaining minimal overhead.

## Technical Requirements

### Core Objectives

- Capture detailed performance metrics for all pipeline stages
- Implement stage-by-stage execution timing and resource usage monitoring
- Provide bottleneck identification and performance analysis
- Enable real-time performance monitoring and alerting
- Support performance comparison and trend analysis
- Implement intelligent performance optimization recommendations
- Maintain minimal performance overhead for metrics collection (<1% impact)

### Performance Requirements

- Metrics collection overhead <1% of total execution time
- Real-time metrics processing with <50ms latency
- Efficient storage and aggregation of performance data
- Thread-safe metrics collection for concurrent pipeline execution
- Memory efficient data structures for performance history

### Compatibility Requirements

- Integration with all existing pipeline stages
- Support for both synchronous and asynchronous stage execution
- Backward compatibility with existing pipeline performance patterns
- Seamless integration with action tracing infrastructure

## Architecture Design

### Performance Metrics Framework

The system implements a comprehensive performance monitoring architecture:

```javascript
class PipelinePerformanceMetrics {
  constructor({ logger, eventBus, verbosityConfig }) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.verbosityConfig = verbosityConfig;

    this.stageMetrics = new Map();
    this.pipelineExecutions = new Map();
    this.performanceBaselines = new Map();
    this.alertThresholds = new Map();
  }

  captureStageExecution(stageName, executionData) {
    const metrics = {
      stageName: stageName,
      startTime: executionData.startTime,
      endTime: executionData.endTime,
      duration: executionData.duration,
      resourceUsage: executionData.resourceUsage,
      throughput: executionData.throughput,
      errorRate: executionData.errorRate,
    };

    this.recordStageMetrics(stageName, metrics);
    this.analyzePerformance(stageName, metrics);
  }
}
```

### Metrics Data Structure

Comprehensive performance data capture:

```javascript
const stagePerformanceData = {
  stage: 'component_filtering',
  execution: {
    startTime: timestampMs,
    endTime: timestampMs,
    duration: durationMs,
    cpuTime: cpuMs,
    memoryUsage: memoryBytes,
    ioOperations: ioCount,
  },
  throughput: {
    itemsProcessed: count,
    itemsPerSecond: rate,
    bytesProcessed: bytes,
    bytesPerSecond: bytesRate,
  },
  quality: {
    errorCount: errors,
    warningCount: warnings,
    successRate: percentage,
    retryCount: retries,
  },
  context: {
    inputSize: size,
    outputSize: size,
    configurationHash: hash,
    environmentInfo: envData,
  },
};
```

## Implementation Steps

### Step 1: Create Performance Metrics Collection System

**File**: `src/actions/tracing/performance/pipelinePerformanceMetrics.js`

```javascript
/**
 * @file Pipeline stage performance metrics collection and analysis
 */

import { validateDependency } from '../../../utils/validationUtils.js';
import { performance } from 'perf_hooks';

class PipelinePerformanceMetrics {
  constructor({ logger, eventBus, verbosityConfig = null }) {
    validateDependency(logger, 'ILogger');
    validateDependency(eventBus, 'IEventBus');

    this.logger = logger;
    this.eventBus = eventBus;
    this.verbosityConfig = verbosityConfig;

    // Core metrics storage
    this.stageMetrics = new Map(); // stage -> metrics array
    this.pipelineExecutions = new Map(); // executionId -> execution data
    this.activeExecutions = new Map(); // executionId -> start data

    // Performance baselines and thresholds
    this.performanceBaselines = new Map();
    this.alertThresholds = new Map();
    this.performanceHistory = new Map();

    // Aggregation and analysis
    this.metricsAggregator = new MetricsAggregator();
    this.performanceAnalyzer = new PerformanceAnalyzer(logger);

    // Configuration
    this.config = {
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      aggregationInterval: 5 * 60 * 1000, // 5 minutes
      alertThreshold: 2.0, // 2x baseline performance
      maxHistorySize: 10000, // Maximum metrics entries
    };

    this.initializeDefaultThresholds();
    this.startPerformanceMonitoring();
  }

  initializeDefaultThresholds() {
    // Default performance thresholds for pipeline stages
    this.setStageThreshold('component_filtering', {
      maxDuration: 100,
      maxMemory: 50 * 1024 * 1024,
    });
    this.setStageThreshold('prerequisite_evaluation', {
      maxDuration: 200,
      maxMemory: 25 * 1024 * 1024,
    });
    this.setStageThreshold('multi_target_resolution', {
      maxDuration: 500,
      maxMemory: 100 * 1024 * 1024,
    });
    this.setStageThreshold('action_formatting', {
      maxDuration: 150,
      maxMemory: 30 * 1024 * 1024,
    });

    // Overall pipeline thresholds
    this.setStageThreshold('pipeline_total', {
      maxDuration: 1000,
      maxMemory: 200 * 1024 * 1024,
    });
  }

  startPipelineExecution(executionId, context = {}) {
    const executionData = {
      executionId: executionId,
      startTime: performance.now(),
      startMemory: this.getCurrentMemoryUsage(),
      context: {
        actionCount: context.actionCount || 0,
        traceVerbosity: context.traceVerbosity || 'basic',
        environment: context.environment || 'unknown',
      },
      stages: new Map(),
      completed: false,
    };

    this.activeExecutions.set(executionId, executionData);

    this.logger.debug(`Pipeline execution started: ${executionId}`, {
      actionCount: executionData.context.actionCount,
      verbosity: executionData.context.traceVerbosity,
    });

    return executionData;
  }

  startStageExecution(executionId, stageName, stageContext = {}) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      this.logger.warn(
        `Stage execution started for unknown pipeline: ${executionId}`
      );
      return null;
    }

    const stageData = {
      stageName: stageName,
      startTime: performance.now(),
      startMemory: this.getCurrentMemoryUsage(),
      context: {
        inputSize: stageContext.inputSize || 0,
        expectedOutputSize: stageContext.expectedOutputSize || 0,
        complexity: stageContext.complexity || 'unknown',
      },
      completed: false,
    };

    execution.stages.set(stageName, stageData);

    return stageData;
  }

  completeStageExecution(executionId, stageName, stageResult = {}) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      this.logger.warn(`Stage completion for unknown pipeline: ${executionId}`);
      return;
    }

    const stageData = execution.stages.get(stageName);
    if (!stageData) {
      this.logger.warn(
        `Stage completion for unknown stage: ${stageName} in ${executionId}`
      );
      return;
    }

    // Complete stage execution metrics
    const endTime = performance.now();
    const endMemory = this.getCurrentMemoryUsage();

    stageData.endTime = endTime;
    stageData.endMemory = endMemory;
    stageData.duration = endTime - stageData.startTime;
    stageData.memoryDelta = endMemory - stageData.startMemory;
    stageData.completed = true;

    // Capture stage results
    stageData.result = {
      success: stageResult.success !== false,
      outputSize: stageResult.outputSize || 0,
      itemsProcessed: stageResult.itemsProcessed || 0,
      errorCount: stageResult.errorCount || 0,
      warningCount: stageResult.warningCount || 0,
    };

    // Calculate derived metrics
    stageData.throughput = this.calculateThroughput(stageData);
    stageData.efficiency = this.calculateEfficiency(stageData);
    stageData.resourceUtilization =
      this.calculateResourceUtilization(stageData);

    // Record stage metrics
    this.recordStageMetrics(stageName, stageData);

    // Analyze performance
    this.analyzeStagePerformance(stageName, stageData);

    this.logger.debug(`Stage completed: ${stageName}`, {
      duration: stageData.duration,
      memoryDelta: stageData.memoryDelta,
      throughput: stageData.throughput,
    });

    return stageData;
  }

  completePipelineExecution(executionId, pipelineResult = {}) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      this.logger.warn(
        `Pipeline completion for unknown execution: ${executionId}`
      );
      return;
    }

    // Complete pipeline execution metrics
    const endTime = performance.now();
    const endMemory = this.getCurrentMemoryUsage();

    execution.endTime = endTime;
    execution.endMemory = endMemory;
    execution.totalDuration = endTime - execution.startTime;
    execution.totalMemoryDelta = endMemory - execution.startMemory;
    execution.completed = true;

    // Capture pipeline results
    execution.result = {
      success: pipelineResult.success !== false,
      totalItemsProcessed: pipelineResult.totalItemsProcessed || 0,
      finalOutputSize: pipelineResult.finalOutputSize || 0,
      totalErrors: pipelineResult.totalErrors || 0,
    };

    // Calculate pipeline-level metrics
    execution.overallThroughput = this.calculatePipelineThroughput(execution);
    execution.stageBreakdown = this.calculateStageBreakdown(execution);
    execution.criticalPath = this.identifyCriticalPath(execution);

    // Move to completed executions
    this.pipelineExecutions.set(executionId, execution);
    this.activeExecutions.delete(executionId);

    // Record pipeline metrics
    this.recordPipelineMetrics(execution);

    // Analyze overall performance
    this.analyzePipelinePerformance(execution);

    this.logger.info(`Pipeline completed: ${executionId}`, {
      totalDuration: execution.totalDuration,
      stagesExecuted: execution.stages.size,
      overallThroughput: execution.overallThroughput,
    });

    // Cleanup old executions
    this.cleanupOldExecutions();

    return execution;
  }

  recordStageMetrics(stageName, stageData) {
    if (!this.stageMetrics.has(stageName)) {
      this.stageMetrics.set(stageName, []);
    }

    const stageMetrics = this.stageMetrics.get(stageName);

    const metricsEntry = {
      timestamp: new Date().toISOString(),
      executionId: stageData.executionId,
      duration: stageData.duration,
      memoryDelta: stageData.memoryDelta,
      throughput: stageData.throughput,
      efficiency: stageData.efficiency,
      resourceUtilization: stageData.resourceUtilization,
      success: stageData.result.success,
      errorCount: stageData.result.errorCount,
    };

    stageMetrics.push(metricsEntry);

    // Maintain history size limit
    if (stageMetrics.length > this.config.maxHistorySize) {
      stageMetrics.splice(0, stageMetrics.length - this.config.maxHistorySize);
    }
  }

  recordPipelineMetrics(execution) {
    const pipelineMetrics = {
      timestamp: new Date().toISOString(),
      executionId: execution.executionId,
      totalDuration: execution.totalDuration,
      totalMemoryDelta: execution.totalMemoryDelta,
      overallThroughput: execution.overallThroughput,
      stageBreakdown: execution.stageBreakdown,
      criticalPath: execution.criticalPath,
      success: execution.result.success,
      context: execution.context,
    };

    if (!this.performanceHistory.has('pipeline')) {
      this.performanceHistory.set('pipeline', []);
    }

    const history = this.performanceHistory.get('pipeline');
    history.push(pipelineMetrics);

    // Maintain history size
    if (history.length > this.config.maxHistorySize) {
      history.splice(0, history.length - this.config.maxHistorySize);
    }
  }

  analyzeStagePerformance(stageName, stageData) {
    const threshold = this.alertThresholds.get(stageName);
    if (!threshold) return;

    const alerts = [];

    // Check duration threshold
    if (stageData.duration > threshold.maxDuration) {
      alerts.push({
        type: 'duration_exceeded',
        stage: stageName,
        actual: stageData.duration,
        threshold: threshold.maxDuration,
        severity: 'warning',
      });
    }

    // Check memory threshold
    if (Math.abs(stageData.memoryDelta) > threshold.maxMemory) {
      alerts.push({
        type: 'memory_exceeded',
        stage: stageName,
        actual: stageData.memoryDelta,
        threshold: threshold.maxMemory,
        severity: 'warning',
      });
    }

    // Check error rate
    const errorRate =
      stageData.result.errorCount / (stageData.result.itemsProcessed || 1);
    if (errorRate > 0.05) {
      // 5% error rate threshold
      alerts.push({
        type: 'high_error_rate',
        stage: stageName,
        actual: errorRate,
        threshold: 0.05,
        severity: 'error',
      });
    }

    // Dispatch alerts
    alerts.forEach((alert) => {
      this.eventBus.dispatch({
        type: 'PIPELINE_PERFORMANCE_ALERT',
        payload: alert,
      });

      this.logger.warn(`Performance alert for stage ${stageName}:`, alert);
    });

    // Update performance baselines
    this.updatePerformanceBaseline(stageName, stageData);
  }

  analyzePipelinePerformance(execution) {
    const analysis = {
      executionId: execution.executionId,
      overallRating: this.calculatePerformanceRating(execution),
      bottlenecks: this.identifyBottlenecks(execution),
      recommendations: this.generateOptimizationRecommendations(execution),
      trends: this.analyzeTrends(execution),
    };

    // Dispatch analysis results
    this.eventBus.dispatch({
      type: 'PIPELINE_PERFORMANCE_ANALYSIS',
      payload: analysis,
    });

    return analysis;
  }

  calculateThroughput(stageData) {
    if (stageData.duration <= 0) return 0;

    const itemsPerSecond =
      (stageData.result.itemsProcessed / stageData.duration) * 1000;
    const bytesPerSecond =
      stageData.context.inputSize > 0
        ? (stageData.context.inputSize / stageData.duration) * 1000
        : 0;

    return {
      itemsPerSecond: itemsPerSecond,
      bytesPerSecond: bytesPerSecond,
      operationsPerSecond: itemsPerSecond, // Alias for compatibility
    };
  }

  calculateEfficiency(stageData) {
    // Efficiency based on throughput vs resource usage
    const throughputScore = Math.min(
      stageData.throughput.itemsPerSecond / 100,
      1.0
    ); // Normalize
    const memoryEfficiency =
      stageData.memoryDelta > 0
        ? Math.min(1000000 / stageData.memoryDelta, 1.0)
        : 1.0; // Better with less memory

    return {
      overall: (throughputScore + memoryEfficiency) / 2,
      throughputScore: throughputScore,
      memoryEfficiency: memoryEfficiency,
    };
  }

  calculateResourceUtilization(stageData) {
    return {
      memoryUtilization: Math.abs(stageData.memoryDelta),
      timeUtilization: stageData.duration,
      ioEfficiency:
        stageData.context.inputSize > 0
          ? stageData.result.outputSize / stageData.context.inputSize
          : 0,
    };
  }

  calculatePipelineThroughput(execution) {
    if (execution.totalDuration <= 0) return 0;

    const totalItems = execution.result.totalItemsProcessed;
    const itemsPerSecond = (totalItems / execution.totalDuration) * 1000;

    return {
      itemsPerSecond: itemsPerSecond,
      actionsPerSecond: itemsPerSecond, // Assuming items are actions
      pipelineExecutionsPerHour: 3600000 / execution.totalDuration,
    };
  }

  calculateStageBreakdown(execution) {
    const breakdown = [];
    let totalStageTime = 0;

    for (const [stageName, stageData] of execution.stages) {
      if (stageData.completed) {
        totalStageTime += stageData.duration;

        breakdown.push({
          stageName: stageName,
          duration: stageData.duration,
          percentage: 0, // Will be calculated after total is known
          throughput: stageData.throughput,
          efficiency: stageData.efficiency,
        });
      }
    }

    // Calculate percentages
    breakdown.forEach((stage) => {
      stage.percentage =
        totalStageTime > 0 ? (stage.duration / totalStageTime) * 100 : 0;
    });

    // Sort by duration (longest first)
    breakdown.sort((a, b) => b.duration - a.duration);

    return breakdown;
  }

  identifyCriticalPath(execution) {
    // Simple critical path: stages in execution order
    const criticalPath = [];

    for (const [stageName, stageData] of execution.stages) {
      if (stageData.completed) {
        criticalPath.push({
          stageName: stageName,
          startTime: stageData.startTime,
          duration: stageData.duration,
          impact: stageData.duration / execution.totalDuration,
        });
      }
    }

    // Sort by start time to get execution order
    criticalPath.sort((a, b) => a.startTime - b.startTime);

    return criticalPath;
  }

  identifyBottlenecks(execution) {
    const bottlenecks = [];
    const breakdown = execution.stageBreakdown;

    // Identify stages taking >30% of total time
    breakdown.forEach((stage) => {
      if (stage.percentage > 30) {
        bottlenecks.push({
          stageName: stage.stageName,
          type: 'time_bottleneck',
          severity: stage.percentage > 50 ? 'critical' : 'warning',
          impact: stage.percentage,
          recommendation: `Optimize ${stage.stageName} stage performance`,
        });
      }
    });

    // Identify stages with low efficiency
    breakdown.forEach((stage) => {
      if (stage.efficiency && stage.efficiency.overall < 0.3) {
        bottlenecks.push({
          stageName: stage.stageName,
          type: 'efficiency_bottleneck',
          severity: 'warning',
          impact: 1 - stage.efficiency.overall,
          recommendation: `Improve resource utilization in ${stage.stageName}`,
        });
      }
    });

    return bottlenecks;
  }

  generateOptimizationRecommendations(execution) {
    const recommendations = [];
    const bottlenecks = this.identifyBottlenecks(execution);

    // Add bottleneck-specific recommendations
    bottlenecks.forEach((bottleneck) => {
      recommendations.push({
        type: 'bottleneck_optimization',
        priority: bottleneck.severity === 'critical' ? 'high' : 'medium',
        stage: bottleneck.stageName,
        description: bottleneck.recommendation,
        estimatedImprovement: `${Math.round(bottleneck.impact * 20)}% performance gain`,
      });
    });

    // Add general recommendations based on patterns
    if (execution.totalDuration > 2000) {
      // >2 seconds
      recommendations.push({
        type: 'general_optimization',
        priority: 'medium',
        description: 'Consider pipeline parallelization for large action sets',
        estimatedImprovement: '20-40% performance gain',
      });
    }

    if (execution.totalMemoryDelta > 100 * 1024 * 1024) {
      // >100MB
      recommendations.push({
        type: 'memory_optimization',
        priority: 'medium',
        description: 'Implement streaming processing to reduce memory usage',
        estimatedImprovement: '50-70% memory reduction',
      });
    }

    return recommendations;
  }

  analyzeTrends(execution) {
    const history = this.performanceHistory.get('pipeline') || [];
    if (history.length < 5) {
      return {
        trend: 'insufficient_data',
        message: 'Need more executions for trend analysis',
      };
    }

    const recent = history.slice(-5);
    const avgDuration =
      recent.reduce((sum, exec) => sum + exec.totalDuration, 0) / recent.length;
    const currentDuration = execution.totalDuration;

    let trend = 'stable';
    let message = 'Performance is stable';

    if (currentDuration > avgDuration * 1.2) {
      trend = 'degrading';
      message = 'Performance is degrading compared to recent executions';
    } else if (currentDuration < avgDuration * 0.8) {
      trend = 'improving';
      message = 'Performance is improving compared to recent executions';
    }

    return {
      trend: trend,
      message: message,
      currentDuration: currentDuration,
      averageDuration: avgDuration,
      comparison: ((currentDuration - avgDuration) / avgDuration) * 100,
    };
  }

  calculatePerformanceRating(execution) {
    let score = 100; // Start with perfect score

    // Deduct points for duration
    const durationPenalty = Math.max(0, (execution.totalDuration - 1000) / 100); // Penalty after 1 second
    score -= Math.min(durationPenalty, 30);

    // Deduct points for memory usage
    const memoryPenalty = Math.max(
      0,
      (execution.totalMemoryDelta - 50 * 1024 * 1024) / (10 * 1024 * 1024)
    ); // Penalty after 50MB
    score -= Math.min(memoryPenalty, 20);

    // Deduct points for errors
    const errorPenalty = execution.result.totalErrors * 10;
    score -= Math.min(errorPenalty, 40);

    // Bonus for high throughput
    const throughputBonus = Math.min(
      execution.overallThroughput.itemsPerSecond / 100,
      10
    );
    score += throughputBonus;

    return Math.max(0, Math.min(100, score));
  }

  updatePerformanceBaseline(stageName, stageData) {
    if (!this.performanceBaselines.has(stageName)) {
      this.performanceBaselines.set(stageName, {
        count: 0,
        totalDuration: 0,
        totalMemory: 0,
        avgDuration: 0,
        avgMemory: 0,
      });
    }

    const baseline = this.performanceBaselines.get(stageName);
    baseline.count++;
    baseline.totalDuration += stageData.duration;
    baseline.totalMemory += Math.abs(stageData.memoryDelta);
    baseline.avgDuration = baseline.totalDuration / baseline.count;
    baseline.avgMemory = baseline.totalMemory / baseline.count;

    // Update thresholds based on baseline
    const threshold = this.alertThresholds.get(stageName) || {};
    threshold.baselineDuration = baseline.avgDuration;
    threshold.baselineMemory = baseline.avgMemory;
    this.alertThresholds.set(stageName, threshold);
  }

  setStageThreshold(stageName, thresholds) {
    this.alertThresholds.set(stageName, {
      ...thresholds,
      timestamp: new Date().toISOString(),
    });
  }

  getCurrentMemoryUsage() {
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage().heapUsed;
      }
    } catch (error) {
      // Fallback for environments without process.memoryUsage
    }
    return 0;
  }

  startPerformanceMonitoring() {
    // Periodic cleanup and analysis
    setInterval(() => {
      this.cleanupOldExecutions();
      this.aggregateMetrics();
    }, this.config.aggregationInterval);
  }

  cleanupOldExecutions() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    for (const [executionId, execution] of this.pipelineExecutions) {
      if (new Date(execution.timestamp || 0).getTime() < cutoffTime) {
        this.pipelineExecutions.delete(executionId);
      }
    }
  }

  aggregateMetrics() {
    // Aggregate and analyze metrics periodically
    const aggregatedData = this.metricsAggregator.aggregate(this.stageMetrics);

    // Dispatch aggregated metrics
    this.eventBus.dispatch({
      type: 'PIPELINE_METRICS_AGGREGATED',
      payload: aggregatedData,
    });
  }

  // Public API methods
  getStageMetrics(stageName, timeRange = null) {
    const metrics = this.stageMetrics.get(stageName) || [];

    if (!timeRange) {
      return metrics;
    }

    const startTime = new Date(Date.now() - timeRange);
    return metrics.filter((metric) => new Date(metric.timestamp) >= startTime);
  }

  getPipelineMetrics(timeRange = null) {
    const history = this.performanceHistory.get('pipeline') || [];

    if (!timeRange) {
      return history;
    }

    const startTime = new Date(Date.now() - timeRange);
    return history.filter((metric) => new Date(metric.timestamp) >= startTime);
  }

  getPerformanceSummary() {
    const summary = {
      stages: {},
      pipeline: {
        totalExecutions: this.pipelineExecutions.size,
        averageDuration: 0,
        successRate: 0,
      },
      alerts: this.getRecentAlerts(),
      recommendations: this.getActiveRecommendations(),
    };

    // Calculate stage summaries
    for (const [stageName, metrics] of this.stageMetrics) {
      const recentMetrics = metrics.slice(-100); // Last 100 executions
      if (recentMetrics.length > 0) {
        const avgDuration =
          recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
          recentMetrics.length;
        const successRate =
          recentMetrics.filter((m) => m.success).length / recentMetrics.length;

        summary.stages[stageName] = {
          executionCount: recentMetrics.length,
          averageDuration: avgDuration,
          successRate: successRate,
          baseline: this.performanceBaselines.get(stageName),
        };
      }
    }

    // Calculate pipeline summary
    const pipelineHistory = this.performanceHistory.get('pipeline') || [];
    if (pipelineHistory.length > 0) {
      const recentHistory = pipelineHistory.slice(-100);
      summary.pipeline.averageDuration =
        recentHistory.reduce((sum, h) => sum + h.totalDuration, 0) /
        recentHistory.length;
      summary.pipeline.successRate =
        recentHistory.filter((h) => h.success).length / recentHistory.length;
    }

    return summary;
  }

  getRecentAlerts(timeRange = 60 * 60 * 1000) {
    // Last hour
    // Implementation would fetch alerts from event history
    return [];
  }

  getActiveRecommendations() {
    // Implementation would return current optimization recommendations
    return [];
  }
}

// Helper classes for metrics aggregation and analysis
class MetricsAggregator {
  aggregate(stageMetrics) {
    const aggregated = {};

    for (const [stageName, metrics] of stageMetrics) {
      if (metrics.length > 0) {
        aggregated[stageName] = this.aggregateStageMetrics(metrics);
      }
    }

    return aggregated;
  }

  aggregateStageMetrics(metrics) {
    const recent = metrics.slice(-100); // Last 100 executions

    return {
      count: recent.length,
      averageDuration: this.calculateAverage(recent, 'duration'),
      medianDuration: this.calculateMedian(recent, 'duration'),
      p95Duration: this.calculatePercentile(recent, 'duration', 95),
      averageThroughput: this.calculateAverage(
        recent,
        'throughput.itemsPerSecond'
      ),
      successRate: recent.filter((m) => m.success).length / recent.length,
      timestamp: new Date().toISOString(),
    };
  }

  calculateAverage(metrics, field) {
    if (metrics.length === 0) return 0;
    const values = metrics
      .map((m) => this.getNestedValue(m, field))
      .filter((v) => v != null);
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  calculateMedian(metrics, field) {
    const values = metrics
      .map((m) => this.getNestedValue(m, field))
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    if (values.length === 0) return 0;

    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  }

  calculatePercentile(metrics, field, percentile) {
    const values = metrics
      .map((m) => this.getNestedValue(m, field))
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    if (values.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

class PerformanceAnalyzer {
  constructor(logger) {
    this.logger = logger;
  }

  analyzePerformancePattern(metrics) {
    // Analyze patterns in performance metrics
    return {
      trend: 'stable',
      anomalies: [],
      predictions: {},
    };
  }
}

export default PipelinePerformanceMetrics;
```

### Step 2: Integrate Performance Metrics into ActionAwareStructuredTrace

**File**: `src/actions/tracing/actionAwareStructuredTrace.js` (Enhancement)

```javascript
/**
 * Enhanced ActionAwareStructuredTrace with performance metrics integration
 */

import { StructuredTrace } from '../../tracing/structuredTrace.js';
import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/validationUtils.js';
import PipelinePerformanceMetrics from './performance/pipelinePerformanceMetrics.js';

class ActionAwareStructuredTrace extends StructuredTrace {
  constructor({
    traceId,
    verbosity = 'basic',
    logger,
    eventBus,
    enablePerformanceMetrics = true,
  }) {
    super({ traceId });

    assertNonBlankString(traceId, 'Trace ID');
    validateDependency(logger, 'ILogger');
    validateDependency(eventBus, 'IEventBus');

    this.verbosity = verbosity;
    this.actionData = {};
    this.logger = logger;

    // Initialize performance metrics if enabled
    if (enablePerformanceMetrics) {
      this.performanceMetrics = new PipelinePerformanceMetrics({
        logger: logger,
        eventBus: eventBus,
        verbosityConfig: this.verbosityConfig,
      });

      this.pipelineExecutionId = `${traceId}-${Date.now()}`;
    }
  }

  startPipelineExecution(context = {}) {
    if (!this.performanceMetrics) return null;

    const pipelineContext = {
      actionCount: context.actionCount || 0,
      traceVerbosity: this.verbosity,
      environment: context.environment || 'unknown',
    };

    return this.performanceMetrics.startPipelineExecution(
      this.pipelineExecutionId,
      pipelineContext
    );
  }

  startStageExecution(stageName, stageContext = {}) {
    if (!this.performanceMetrics) return null;

    return this.performanceMetrics.startStageExecution(
      this.pipelineExecutionId,
      stageName,
      stageContext
    );
  }

  completeStageExecution(stageName, stageResult = {}) {
    if (!this.performanceMetrics) return;

    return this.performanceMetrics.completeStageExecution(
      this.pipelineExecutionId,
      stageName,
      stageResult
    );
  }

  completePipelineExecution(pipelineResult = {}) {
    if (!this.performanceMetrics) return;

    const execution = this.performanceMetrics.completePipelineExecution(
      this.pipelineExecutionId,
      pipelineResult
    );

    // Capture performance summary in trace data
    if (execution) {
      this.captureActionData('performance', 'pipeline_execution', {
        executionId: execution.executionId,
        totalDuration: execution.totalDuration,
        overallThroughput: execution.overallThroughput,
        stageBreakdown: execution.stageBreakdown,
        performanceRating:
          this.performanceMetrics.calculatePerformanceRating(execution),
        timestamp: new Date().toISOString(),
      });
    }

    return execution;
  }

  getPerformanceMetrics() {
    if (!this.performanceMetrics) {
      return { message: 'Performance metrics not enabled for this trace' };
    }

    return this.performanceMetrics.getPerformanceSummary();
  }

  getStagePerformanceData(stageName, timeRange = null) {
    if (!this.performanceMetrics) return [];

    return this.performanceMetrics.getStageMetrics(stageName, timeRange);
  }

  getPipelinePerformanceData(timeRange = null) {
    if (!this.performanceMetrics) return [];

    return this.performanceMetrics.getPipelineMetrics(timeRange);
  }

  // Enhanced captureActionData to include performance context
  captureActionData(category, type, data, options = {}) {
    // Add performance context if available
    if (this.performanceMetrics && options.includePerformanceContext) {
      const performanceContext = {
        pipelineExecutionId: this.pipelineExecutionId,
        currentStage: options.currentStage,
        stageStartTime: options.stageStartTime,
        timestamp: new Date().toISOString(),
      };

      data = {
        ...data,
        _performanceContext: performanceContext,
      };
    }

    super.captureActionData(category, type, data);
  }
}

export { ActionAwareStructuredTrace };
```

### Step 3: Pipeline Stage Performance Integration

**File**: `src/actions/pipeline/basePipelineStage.js` (Enhancement)

```javascript
/**
 * Enhanced BasePipelineStage with performance metrics integration
 */

import { validateDependency } from '../../utils/validationUtils.js';
import { ActionAwareStructuredTrace } from '../tracing/actionAwareStructuredTrace.js';

class BasePipelineStage {
  constructor({ logger, eventBus }) {
    validateDependency(logger, 'ILogger');
    validateDependency(eventBus, 'IEventBus');

    this.logger = logger;
    this.eventBus = eventBus;
  }

  async execute(context) {
    const { trace } = context;
    const stageName = this.constructor.name.replace('Stage', '').toLowerCase();

    // Start stage execution timing if this is an action-aware trace
    let stageExecution = null;
    if (trace instanceof ActionAwareStructuredTrace) {
      const stageContext = {
        inputSize: this.calculateInputSize(context),
        expectedOutputSize: this.estimateOutputSize(context),
        complexity: this.assessComplexity(context),
      };

      stageExecution = trace.startStageExecution(stageName, stageContext);
    }

    try {
      // Execute the stage
      const result = await this.executeInternal(context);

      // Complete stage execution timing
      if (stageExecution && trace instanceof ActionAwareStructuredTrace) {
        const stageResult = {
          success: true,
          outputSize: this.calculateOutputSize(result),
          itemsProcessed: this.countProcessedItems(result),
          errorCount: 0,
          warningCount: 0,
        };

        trace.completeStageExecution(stageName, stageResult);
      }

      return result;
    } catch (error) {
      // Complete stage execution with error
      if (stageExecution && trace instanceof ActionAwareStructuredTrace) {
        const stageResult = {
          success: false,
          outputSize: 0,
          itemsProcessed: 0,
          errorCount: 1,
          warningCount: 0,
        };

        trace.completeStageExecution(stageName, stageResult);
      }

      throw error;
    }
  }

  async executeInternal(context) {
    throw new Error('Subclasses must implement executeInternal');
  }

  calculateInputSize(context) {
    // Default implementation - can be overridden by subclasses
    const { actions, entities, components } = context;
    let size = 0;

    if (actions) size += JSON.stringify(actions).length;
    if (entities) size += JSON.stringify(entities).length;
    if (components) size += JSON.stringify(components).length;

    return size;
  }

  estimateOutputSize(context) {
    // Default estimation - can be overridden by subclasses
    return this.calculateInputSize(context);
  }

  calculateOutputSize(result) {
    // Default implementation - can be overridden by subclasses
    return JSON.stringify(result).length;
  }

  countProcessedItems(result) {
    // Default implementation - can be overridden by subclasses
    if (result.actions) return result.actions.length;
    if (result.entities) return result.entities.length;
    if (result.components) return result.components.length;
    return 1;
  }

  assessComplexity(context) {
    // Default complexity assessment - can be overridden by subclasses
    const { actions = [], entities = [], components = [] } = context;
    const totalItems = actions.length + entities.length + components.length;

    if (totalItems > 100) return 'high';
    if (totalItems > 20) return 'medium';
    return 'low';
  }
}

export default BasePipelineStage;
```

### Step 4: Performance Metrics Tests

**File**: `tests/unit/actions/tracing/performance/pipelinePerformanceMetrics.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PipelinePerformanceMetrics from '../../../../../src/actions/tracing/performance/pipelinePerformanceMetrics.js';

describe('PipelinePerformanceMetrics', () => {
  let metrics;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    metrics = new PipelinePerformanceMetrics({
      logger: mockLogger,
      eventBus: mockEventBus,
    });
  });

  describe('Pipeline Execution Tracking', () => {
    it('should track complete pipeline execution', async () => {
      const executionId = 'test-execution-1';
      const context = { actionCount: 5, environment: 'test' };

      // Start pipeline
      const pipelineExecution = metrics.startPipelineExecution(
        executionId,
        context
      );
      expect(pipelineExecution.executionId).toBe(executionId);
      expect(pipelineExecution.context.actionCount).toBe(5);

      // Start and complete a stage
      metrics.startStageExecution(executionId, 'component_filtering', {
        inputSize: 1000,
      });

      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stageResult = {
        success: true,
        outputSize: 800,
        itemsProcessed: 3,
        errorCount: 0,
      };
      const completedStage = metrics.completeStageExecution(
        executionId,
        'component_filtering',
        stageResult
      );

      expect(completedStage.completed).toBe(true);
      expect(completedStage.duration).toBeGreaterThan(0);
      expect(completedStage.result.success).toBe(true);

      // Complete pipeline
      const pipelineResult = {
        success: true,
        totalItemsProcessed: 3,
        finalOutputSize: 800,
      };
      const completedPipeline = metrics.completePipelineExecution(
        executionId,
        pipelineResult
      );

      expect(completedPipeline.completed).toBe(true);
      expect(completedPipeline.totalDuration).toBeGreaterThan(0);
      expect(completedPipeline.stageBreakdown).toHaveLength(1);
    });

    it('should handle stage execution errors', async () => {
      const executionId = 'test-execution-error';

      metrics.startPipelineExecution(executionId);
      metrics.startStageExecution(executionId, 'test_stage');

      const stageResult = {
        success: false,
        errorCount: 2,
      };
      const completedStage = metrics.completeStageExecution(
        executionId,
        'test_stage',
        stageResult
      );

      expect(completedStage.result.success).toBe(false);
      expect(completedStage.result.errorCount).toBe(2);
    });
  });

  describe('Performance Analysis', () => {
    it('should identify bottlenecks', () => {
      const execution = {
        executionId: 'test',
        totalDuration: 1000,
        stageBreakdown: [
          {
            stageName: 'slow_stage',
            duration: 600,
            percentage: 60,
            efficiency: { overall: 0.2 },
          },
          {
            stageName: 'fast_stage',
            duration: 400,
            percentage: 40,
            efficiency: { overall: 0.8 },
          },
        ],
      };

      const bottlenecks = metrics.identifyBottlenecks(execution);

      expect(bottlenecks).toHaveLength(2);
      expect(bottlenecks[0].type).toBe('time_bottleneck');
      expect(bottlenecks[0].stageName).toBe('slow_stage');
      expect(bottlenecks[1].type).toBe('efficiency_bottleneck');
    });

    it('should generate optimization recommendations', () => {
      const execution = {
        executionId: 'test',
        totalDuration: 3000, // >2 seconds
        totalMemoryDelta: 150 * 1024 * 1024, // >100MB
        stageBreakdown: [
          { stageName: 'memory_heavy', duration: 1500, percentage: 50 },
        ],
      };

      const recommendations =
        metrics.generateOptimizationRecommendations(execution);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations.some((r) => r.type === 'general_optimization')
      ).toBe(true);
      expect(
        recommendations.some((r) => r.type === 'memory_optimization')
      ).toBe(true);
    });

    it('should calculate performance ratings', () => {
      const goodExecution = {
        totalDuration: 500,
        totalMemoryDelta: 10 * 1024 * 1024,
        result: { totalErrors: 0 },
        overallThroughput: { itemsPerSecond: 200 },
      };

      const poorExecution = {
        totalDuration: 5000,
        totalMemoryDelta: 200 * 1024 * 1024,
        result: { totalErrors: 5 },
        overallThroughput: { itemsPerSecond: 10 },
      };

      const goodRating = metrics.calculatePerformanceRating(goodExecution);
      const poorRating = metrics.calculatePerformanceRating(poorExecution);

      expect(goodRating).toBeGreaterThan(poorRating);
      expect(goodRating).toBeGreaterThan(80);
      expect(poorRating).toBeLessThan(50);
    });
  });

  describe('Metrics Aggregation', () => {
    it('should aggregate stage metrics', () => {
      // Add some test metrics
      const stageMetrics = [
        { duration: 100, success: true, throughput: { itemsPerSecond: 50 } },
        { duration: 120, success: true, throughput: { itemsPerSecond: 45 } },
        { duration: 150, success: false, throughput: { itemsPerSecond: 30 } },
      ];

      metrics.stageMetrics.set('test_stage', stageMetrics);

      const aggregated =
        metrics.metricsAggregator.aggregateStageMetrics(stageMetrics);

      expect(aggregated.count).toBe(3);
      expect(aggregated.averageDuration).toBeCloseTo(123.33, 1);
      expect(aggregated.successRate).toBeCloseTo(0.67, 2);
    });

    it('should provide performance summary', () => {
      // Setup test data
      metrics.stageMetrics.set('test_stage', [
        { duration: 100, success: true, timestamp: new Date().toISOString() },
      ]);

      metrics.performanceHistory.set('pipeline', [
        {
          totalDuration: 500,
          success: true,
          timestamp: new Date().toISOString(),
        },
      ]);

      const summary = metrics.getPerformanceSummary();

      expect(summary.stages.test_stage).toBeDefined();
      expect(summary.pipeline.totalExecutions).toBeDefined();
      expect(summary.alerts).toBeInstanceOf(Array);
      expect(summary.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Threshold Management', () => {
    it('should detect threshold violations', () => {
      const stageName = 'test_stage';
      metrics.setStageThreshold(stageName, {
        maxDuration: 100,
        maxMemory: 1000,
      });

      const slowStageData = {
        duration: 200, // Exceeds threshold
        memoryDelta: 500,
        result: { success: true, errorCount: 0, itemsProcessed: 1 },
      };

      // Mock event dispatching to capture alerts
      const alerts = [];
      mockEventBus.dispatch.mockImplementation((event) => {
        if (event.type === 'PIPELINE_PERFORMANCE_ALERT') {
          alerts.push(event.payload);
        }
      });

      metrics.analyzeStagePerformance(stageName, slowStageData);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('duration_exceeded');
      expect(alerts[0].stage).toBe(stageName);
    });

    it('should update performance baselines', () => {
      const stageName = 'baseline_test';
      const stageData = {
        duration: 150,
        memoryDelta: 2000,
        result: { success: true, errorCount: 0 },
      };

      metrics.updatePerformanceBaseline(stageName, stageData);

      const baseline = metrics.performanceBaselines.get(stageName);
      expect(baseline.count).toBe(1);
      expect(baseline.avgDuration).toBe(150);
      expect(baseline.avgMemory).toBe(2000);
    });
  });

  describe('Data Management', () => {
    it('should maintain history size limits', () => {
      const stageName = 'test_stage';
      metrics.config.maxHistorySize = 5; // Small limit for testing

      // Add more metrics than the limit
      for (let i = 0; i < 10; i++) {
        metrics.recordStageMetrics(stageName, {
          duration: i * 10,
          memoryDelta: i * 100,
          result: { success: true, errorCount: 0 },
        });
      }

      const stageMetrics = metrics.stageMetrics.get(stageName);
      expect(stageMetrics.length).toBe(5);
      expect(stageMetrics[0].duration).toBe(50); // Should keep the last 5
    });

    it('should cleanup old executions', () => {
      const oldExecutionId = 'old-execution';
      const oldExecution = {
        executionId: oldExecutionId,
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      };

      metrics.pipelineExecutions.set(oldExecutionId, oldExecution);
      metrics.cleanupOldExecutions();

      expect(metrics.pipelineExecutions.has(oldExecutionId)).toBe(false);
    });
  });
});
```

## Testing Requirements

### Unit Tests Required

- [ ] PipelinePerformanceMetrics core functionality
- [ ] Stage execution tracking and completion
- [ ] Performance analysis and bottleneck identification
- [ ] Optimization recommendation generation
- [ ] Threshold management and alerting
- [ ] Metrics aggregation and summarization
- [ ] Data cleanup and retention management
- [ ] BasePipelineStage performance integration

### Integration Tests Required

- [ ] End-to-end pipeline performance tracking
- [ ] Performance metrics integration with ActionAwareStructuredTrace
- [ ] Real-world performance scenario testing
- [ ] Concurrent pipeline execution monitoring

### Performance Tests Required

- [ ] Metrics collection overhead measurement (<1%)
- [ ] Memory efficiency with large datasets
- [ ] Real-time metrics processing latency
- [ ] Scalability testing with multiple concurrent pipelines

## Acceptance Criteria

### Functional Requirements

- [ ] All pipeline stages integrated with performance metrics
- [ ] Stage-by-stage execution timing captured accurately
- [ ] Bottleneck identification working correctly
- [ ] Optimization recommendations generated based on data
- [ ] Performance thresholds and alerting functional
- [ ] Metrics aggregation and historical analysis working
- [ ] Data retention and cleanup policies enforced

### Performance Requirements

- [ ] Metrics collection overhead <1% of execution time
- [ ] Real-time metrics processing <50ms latency
- [ ] Memory efficient storage for performance history
- [ ] Thread-safe operation under concurrent load

### Quality Requirements

- [ ] 85% test coverage for performance metrics system
- [ ] Comprehensive error handling and recovery
- [ ] Clear performance analysis reports and recommendations
- [ ] Performance benchmarks documented and validated

## Dependencies

### Prerequisite Tickets

- ACTTRA-009: ActionAwareStructuredTrace class (Foundation)
- ACTTRA-011: ComponentFilteringStage integration (Pipeline Integration)
- ACTTRA-012: PrerequisiteEvaluationStage integration (Pipeline Integration)
- ACTTRA-013: MultiTargetResolutionStage integration (Pipeline Integration)
- ACTTRA-014: ActionFormattingStage integration (Pipeline Integration)

### Related Systems

- All pipeline stages for performance integration
- Event bus for performance alerts and metrics
- Logger for performance diagnostics
- Memory management utilities for resource monitoring

### External Dependencies

- Node.js performance hooks for accurate timing
- System memory monitoring APIs
- Event system for alerts and notifications

## Effort Estimation

**Total Effort: 20 hours**

- Performance metrics system implementation: 10 hours
- Pipeline stage integration: 4 hours
- ActionAwareStructuredTrace integration: 2 hours
- Unit tests: 3 hours
- Integration and performance tests: 1 hour

## Implementation Notes

### Performance Optimization

- High-resolution timing using performance hooks
- Efficient memory usage tracking
- Optimized data structures for metrics storage
- Lazy evaluation for complex performance calculations
- Cached aggregations for frequently accessed metrics

### Alert and Notification System

- Event-driven performance alerts
- Configurable threshold management
- Intelligent baseline calculation and adjustment
- Performance trend analysis and prediction
- Integration with system monitoring and alerting

### Analysis and Reporting

- Comprehensive bottleneck identification algorithms
- Intelligent optimization recommendations
- Performance trend analysis
- Comparative performance reports
- Real-time performance dashboards support

This ticket completes the Phase 2 pipeline integration by providing comprehensive performance monitoring and analysis capabilities for all action pipeline stages, enabling proactive performance optimization and system health monitoring.
