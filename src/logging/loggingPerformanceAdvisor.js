/**
 * @file Advanced performance advisor for logging system optimization
 * Analyzes performance patterns and provides actionable recommendations
 * @see loggingPerformanceMonitor.js
 * @see loggingPerformanceReporter.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Provides intelligent performance optimization recommendations
 * based on performance metrics, resource usage, and system patterns
 */
export class LoggingPerformanceAdvisor {
  #performanceMonitor;
  #resourceMonitor;
  #logger;
  #optimizationHistory;
  #configRecommendations;

  constructor({ performanceMonitor, resourceMonitor, logger }) {
    validateDependency(performanceMonitor, 'IPerformanceMonitor', logger, {
      requiredMethods: ['getMetrics', 'getAlerts', 'checkThreshold'],
    });
    validateDependency(resourceMonitor, 'IResourceMonitor', logger, {
      requiredMethods: ['checkResourceUsage', 'getBufferInfo'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#performanceMonitor = performanceMonitor;
    this.#resourceMonitor = resourceMonitor;
    this.#logger = logger;
    this.#optimizationHistory = [];
    this.#configRecommendations = new Map();
  }

  /**
   * Analyze current performance and generate optimization recommendations
   * @returns {Object} Comprehensive optimization advice
   */
  analyzeAndAdvise() {
    const metrics = this.#performanceMonitor.getMetrics();
    const alerts = this.#performanceMonitor.getAlerts();
    const resources = this.#resourceMonitor.checkResourceUsage();

    const analysis = {
      timestamp: Date.now(),
      patterns: this.#detectPerformancePatterns(metrics),
      bottlenecks: this.#identifyBottlenecks(metrics, resources),
      recommendations: this.#generateRecommendations(metrics, resources, alerts),
      configChanges: this.#suggestConfigurationChanges(metrics, resources),
      priority: this.#prioritizeActions(metrics, resources, alerts),
    };

    this.#updateOptimizationHistory(analysis);
    return analysis;
  }

  /**
   * Detect performance patterns in metrics
   */
  #detectPerformancePatterns(metrics) {
    const patterns = [];

    // Detect high-volume logging patterns
    if (metrics.throughput?.logsPerSecond > 1000) {
      patterns.push({
        type: 'high_volume',
        severity: 'info',
        description: 'High logging volume detected',
        metrics: {
          logsPerSecond: metrics.throughput.logsPerSecond,
          avgBatchSize: metrics.batching?.avgBatchSize,
        },
      });
    }

    // Detect memory pressure patterns
    if (metrics.resources?.memoryUsageMB > 100) {
      patterns.push({
        type: 'memory_pressure',
        severity: 'warning',
        description: 'Elevated memory usage detected',
        metrics: {
          memoryUsageMB: metrics.resources.memoryUsageMB,
          heapUsedPercent: metrics.resources.heapUsedPercent,
        },
      });
    }

    // Detect batch inefficiency
    const batchEfficiency = metrics.batching?.avgBatchSize / metrics.batching?.maxBatchSize;
    if (batchEfficiency < 0.5) {
      patterns.push({
        type: 'batch_inefficiency',
        severity: 'info',
        description: 'Batching could be more efficient',
        metrics: {
          efficiency: batchEfficiency,
          avgBatchSize: metrics.batching.avgBatchSize,
          maxBatchSize: metrics.batching.maxBatchSize,
        },
      });
    }

    // Detect category imbalance
    const categoryDistribution = this.#analyzeCategoryDistribution(metrics);
    if (categoryDistribution.imbalanced) {
      patterns.push({
        type: 'category_imbalance',
        severity: 'info',
        description: 'Uneven distribution of log categories',
        metrics: categoryDistribution,
      });
    }

    return patterns;
  }

  /**
   * Identify performance bottlenecks
   */
  #identifyBottlenecks(metrics, resources) {
    const bottlenecks = [];

    // Check for network bottlenecks
    if (metrics.latency?.p99 > 500) {
      bottlenecks.push({
        type: 'network_latency',
        severity: 'high',
        impact: 'Log delivery delays',
        metrics: {
          p99Latency: metrics.latency.p99,
          p95Latency: metrics.latency.p95,
        },
        recommendation: 'Consider increasing batch size or implementing local buffering',
      });
    }

    // Check for buffer bottlenecks
    if (resources.bufferSize > resources.maxBufferSize * 0.8) {
      bottlenecks.push({
        type: 'buffer_pressure',
        severity: 'high',
        impact: 'Risk of log loss',
        metrics: {
          bufferSize: resources.bufferSize,
          maxBufferSize: resources.maxBufferSize,
          utilizationPercent: (resources.bufferSize / resources.maxBufferSize) * 100,
        },
        recommendation: 'Increase flush frequency or buffer size',
      });
    }

    // Check for GC bottlenecks
    if (resources.gcMetrics?.majorGCCount > 10) {
      bottlenecks.push({
        type: 'gc_pressure',
        severity: 'medium',
        impact: 'Performance degradation from garbage collection',
        metrics: {
          majorGCCount: resources.gcMetrics.majorGCCount,
          totalGCTime: resources.gcMetrics.totalGCTime,
        },
        recommendation: 'Optimize object allocation and consider memory pooling',
      });
    }

    // Check for processing bottlenecks
    const processingTime = metrics.latency?.mean || 0;
    if (processingTime > 50) {
      bottlenecks.push({
        type: 'processing_overhead',
        severity: 'medium',
        impact: 'High processing time per log',
        metrics: {
          meanProcessingTime: processingTime,
          throughput: metrics.throughput?.logsPerSecond,
        },
        recommendation: 'Simplify log processing or implement async processing',
      });
    }

    return bottlenecks;
  }

  /**
   * Generate actionable recommendations
   */
  #generateRecommendations(metrics, resources, alerts) {
    const recommendations = [];

    // High-level optimization recommendations
    if (alerts.length > 5) {
      recommendations.push({
        priority: 'high',
        action: 'review_logging_strategy',
        description: 'Multiple performance alerts detected',
        steps: [
          'Review logging levels and reduce verbose logging',
          'Implement sampling for high-frequency logs',
          'Consider log aggregation before transmission',
        ],
      });
    }

    // Batch optimization
    if (metrics.batching?.avgBatchSize < 10) {
      recommendations.push({
        priority: 'medium',
        action: 'optimize_batching',
        description: 'Batch size is suboptimal',
        steps: [
          'Increase batch timeout to accumulate more logs',
          'Adjust batch size threshold',
          'Consider adaptive batching based on load',
        ],
        expectedImprovement: '30-50% reduction in network calls',
      });
    }

    // Memory optimization
    if (resources.memoryUsageMB > 150) {
      recommendations.push({
        priority: 'high',
        action: 'reduce_memory_usage',
        description: 'High memory consumption detected',
        steps: [
          'Implement circular buffer for log storage',
          'Reduce metadata retention',
          'Enable compression for stored logs',
          'Clear processed logs more aggressively',
        ],
        expectedImprovement: '40-60% memory reduction',
      });
    }

    // Category-specific optimizations
    const categoryOptimizations = this.#generateCategoryOptimizations(metrics);
    recommendations.push(...categoryOptimizations);

    // Performance mode recommendations
    if (metrics.throughput?.logsPerSecond > 500 && !this.#isPerformanceModeEnabled()) {
      recommendations.push({
        priority: 'high',
        action: 'enable_performance_mode',
        description: 'High throughput detected - enable performance mode',
        steps: [
          'Enable async logging',
          'Increase buffer sizes',
          'Reduce synchronous operations',
          'Enable batch compression',
        ],
        expectedImprovement: '2-3x throughput increase',
      });
    }

    return recommendations;
  }

  /**
   * Suggest configuration changes
   */
  #suggestConfigurationChanges(metrics, resources) {
    const configChanges = {};

    // Buffer size recommendations
    if (resources.bufferSize > resources.maxBufferSize * 0.6) {
      configChanges.bufferSize = {
        current: resources.maxBufferSize,
        recommended: Math.ceil(resources.maxBufferSize * 1.5),
        reason: 'Buffer frequently approaching capacity',
      };
    }

    // Batch size recommendations
    const optimalBatchSize = this.#calculateOptimalBatchSize(metrics);
    if (Math.abs(optimalBatchSize - metrics.batching?.maxBatchSize) > 10) {
      configChanges.batchSize = {
        current: metrics.batching?.maxBatchSize,
        recommended: optimalBatchSize,
        reason: 'Optimize for current throughput patterns',
      };
    }

    // Flush interval recommendations
    const optimalFlushInterval = this.#calculateOptimalFlushInterval(metrics, resources);
    configChanges.flushInterval = {
      current: metrics.batching?.flushInterval || 5000,
      recommended: optimalFlushInterval,
      reason: 'Balance between latency and efficiency',
    };

    // Compression recommendations
    if (metrics.throughput?.bytesPerSecond > 10000) {
      configChanges.compression = {
        current: false,
        recommended: true,
        reason: 'High data volume would benefit from compression',
        expectedSavings: '60-70% bandwidth reduction',
      };
    }

    // Category filtering recommendations
    const categoryConfig = this.#suggestCategoryFiltering(metrics);
    if (categoryConfig) {
      configChanges.categoryFiltering = categoryConfig;
    }

    return configChanges;
  }

  /**
   * Prioritize optimization actions
   */
  #prioritizeActions(metrics, resources, alerts) {
    const actions = [];

    // Critical actions (immediate)
    if (resources.bufferSize > resources.maxBufferSize * 0.9) {
      actions.push({
        priority: 1,
        urgency: 'critical',
        action: 'increase_buffer_size',
        impact: 'Prevent log loss',
        effort: 'low',
      });
    }

    if (metrics.reliability?.errorRate > 0.05) {
      actions.push({
        priority: 1,
        urgency: 'critical',
        action: 'fix_error_handling',
        impact: 'Improve reliability',
        effort: 'medium',
      });
    }

    // High priority actions (within 24h)
    if (resources.memoryUsageMB > 200) {
      actions.push({
        priority: 2,
        urgency: 'high',
        action: 'optimize_memory_usage',
        impact: 'Reduce memory pressure',
        effort: 'medium',
      });
    }

    // Medium priority actions (within week)
    if (metrics.batching?.efficiency < 0.5) {
      actions.push({
        priority: 3,
        urgency: 'medium',
        action: 'improve_batching',
        impact: 'Reduce network overhead',
        effort: 'low',
      });
    }

    // Low priority actions (nice to have)
    if (!this.#isCompressionEnabled() && metrics.throughput?.bytesPerSecond > 5000) {
      actions.push({
        priority: 4,
        urgency: 'low',
        action: 'enable_compression',
        impact: 'Reduce bandwidth usage',
        effort: 'low',
      });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Analyze category distribution
   */
  #analyzeCategoryDistribution(metrics) {
    const categories = metrics.categories || {};
    const total = Object.values(categories).reduce((sum, count) => sum + count, 0);
    
    const distribution = {};
    let maxPercent = 0;
    
    for (const [category, count] of Object.entries(categories)) {
      const percent = (count / total) * 100;
      distribution[category] = percent;
      maxPercent = Math.max(maxPercent, percent);
    }

    return {
      distribution,
      imbalanced: maxPercent > 50,
      dominant: Object.entries(distribution).find(([, p]) => p === maxPercent)?.[0],
    };
  }

  /**
   * Generate category-specific optimizations
   */
  #generateCategoryOptimizations(metrics) {
    const recommendations = [];
    const categories = metrics.categories || {};

    for (const [category, count] of Object.entries(categories)) {
      if (count > 1000) {
        recommendations.push({
          priority: 'medium',
          action: `optimize_${category}_logging`,
          description: `High volume in ${category} category`,
          steps: [
            `Review ${category} log verbosity`,
            `Implement sampling for ${category} logs`,
            `Consider aggregation for ${category} metrics`,
          ],
        });
      }
    }

    return recommendations;
  }

  /**
   * Calculate optimal batch size based on metrics
   */
  #calculateOptimalBatchSize(metrics) {
    const throughput = metrics.throughput?.logsPerSecond || 100;
    const latencyTarget = 100; // ms
    
    // Balance between efficiency and latency
    let optimalSize = Math.min(
      Math.ceil(throughput * (latencyTarget / 1000)),
      100 // max batch size
    );

    return Math.max(optimalSize, 10); // min batch size
  }

  /**
   * Calculate optimal flush interval
   */
  #calculateOptimalFlushInterval(metrics, resources) {
    const throughput = metrics.throughput?.logsPerSecond || 100;
    const bufferPressure = resources.bufferSize / resources.maxBufferSize;
    
    // More frequent flushes under pressure
    let baseInterval = 5000; // 5 seconds
    
    if (bufferPressure > 0.7) {
      baseInterval = 1000; // 1 second
    } else if (bufferPressure > 0.5) {
      baseInterval = 2500; // 2.5 seconds
    }
    
    // Adjust for throughput
    if (throughput > 1000) {
      baseInterval = Math.min(baseInterval, 1000);
    }
    
    return baseInterval;
  }

  /**
   * Suggest category filtering configuration
   */
  #suggestCategoryFiltering(metrics) {
    const categories = metrics.categories || {};
    const noisyCategories = [];
    
    for (const [category, count] of Object.entries(categories)) {
      if (count > 5000) {
        noisyCategories.push(category);
      }
    }
    
    if (noisyCategories.length > 0) {
      return {
        current: 'all categories enabled',
        recommended: `sample or filter: ${noisyCategories.join(', ')}`,
        reason: 'Reduce noise from high-volume categories',
        expectedReduction: '50-70% log volume',
      };
    }
    
    return null;
  }

  /**
   * Check if performance mode is enabled
   */
  #isPerformanceModeEnabled() {
    // This would check actual configuration
    return false;
  }

  /**
   * Check if compression is enabled
   */
  #isCompressionEnabled() {
    // This would check actual configuration
    return false;
  }

  /**
   * Update optimization history
   */
  #updateOptimizationHistory(analysis) {
    this.#optimizationHistory.push(analysis);
    
    // Keep only last 100 analyses
    if (this.#optimizationHistory.length > 100) {
      this.#optimizationHistory.shift();
    }
    
    // Track which recommendations have been applied
    for (const recommendation of analysis.recommendations) {
      const key = recommendation.action;
      const count = this.#configRecommendations.get(key) || 0;
      this.#configRecommendations.set(key, count + 1);
    }
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory() {
    return this.#optimizationHistory.slice();
  }

  /**
   * Get trending recommendations
   */
  getTrendingRecommendations() {
    const trends = [];
    
    for (const [action, count] of this.#configRecommendations.entries()) {
      if (count > 3) {
        trends.push({
          action,
          frequency: count,
          status: 'recurring',
          message: `This optimization has been recommended ${count} times`,
        });
      }
    }
    
    return trends;
  }
}

export default LoggingPerformanceAdvisor;