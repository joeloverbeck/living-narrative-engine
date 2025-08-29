/**
 * @file LoggingPerformanceReporter for generating performance reports
 * @see loggingPerformanceMonitor.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Generates performance reports for the logging system
 * Provides dashboard-ready data and health assessments
 */
export class LoggingPerformanceReporter {
  #monitor;
  #logger;
  #reportHistory;
  #aggregationPeriods;
  
  /**
   * Creates a new LoggingPerformanceReporter instance
   * 
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.monitor - LoggingPerformanceMonitor instance
   * @param {ILogger} dependencies.logger - Logger for internal use
   * @param {object} [config] - Optional configuration
   */
  constructor({ monitor, logger }, config = {}) {
    validateDependency(monitor, 'LoggingPerformanceMonitor', undefined, {
      requiredMethods: ['getLoggingMetrics', 'getAlerts', 'getRecordedMetrics'],
    });
    
    validateDependency(logger, 'ILogger', undefined, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    
    this.#monitor = monitor;
    this.#logger = logger;
    
    // Initialize report history for trend analysis
    this.#reportHistory = [];
    
    // Define aggregation periods
    this.#aggregationPeriods = {
      realtime: 0, // Current snapshot
      lastMinute: 60 * 1000,
      last5Minutes: 5 * 60 * 1000,
      lastHour: 60 * 60 * 1000,
      last24Hours: 24 * 60 * 60 * 1000,
    };
    
    // Configuration
    this.maxHistorySize = config.maxHistorySize || 1000;
    this.healthThresholds = config.healthThresholds || {
      successRate: { critical: 90, warning: 95 },
      latencyP95: { critical: 10, warning: 5 },
      bufferPressure: { critical: 90, warning: 75 },
      errorRate: { critical: 5, warning: 2 },
      memoryUsageMB: { critical: 100, warning: 50 },
    };
  }
  
  /**
   * Generates a comprehensive performance report
   * 
   * @returns {object} Performance report with all metrics
   */
  generateReport() {
    const timestamp = new Date().toISOString();
    const metrics = this.#monitor.getLoggingMetrics();
    const alerts = this.#monitor.getAlerts();
    const recordedMetrics = this.#monitor.getRecordedMetrics();
    
    // Calculate derived metrics
    const errorRate = this.#calculateErrorRate(metrics);
    const throughputTrend = this.#calculateThroughputTrend();
    
    // Assess health
    const health = this.#assessHealth(metrics, alerts);
    
    // Build report
    const report = {
      timestamp,
      
      // Executive summary
      summary: {
        status: health.status,
        score: health.score,
        logsProcessed: metrics.volume.totalLogsProcessed,
        successRate: metrics.reliability.successRate,
        avgLatency: metrics.latency.logProcessing.p50,
        activeAlerts: alerts.filter(a => a.severity === 'critical').length,
        recommendations: health.recommendations.slice(0, 3), // Top 3
      },
      
      // Real-time metrics
      current: {
        logsPerSecond: metrics.throughput.logsPerSecond,
        bytesPerSecond: metrics.throughput.bytesPerSecond,
        bufferSize: metrics.resources.bufferSize,
        bufferPressure: metrics.resources.bufferPressure,
        memoryUsageMB: metrics.resources.memoryUsageMB,
        activeSpans: metrics.activeSpans,
        currentConcurrency: metrics.currentConcurrency,
      },
      
      // Throughput metrics
      throughput: {
        ...metrics.throughput,
        trend: throughputTrend,
        peak: this.#findPeakThroughput(),
      },
      
      // Latency metrics with percentiles
      latency: {
        logProcessing: metrics.latency.logProcessing,
        batchTransmission: metrics.latency.batchTransmission,
        endToEnd: {
          p50: (metrics.latency.logProcessing.p50 || 0) + (metrics.latency.batchTransmission.p50 || 0),
          p95: (metrics.latency.logProcessing.p95 || 0) + (metrics.latency.batchTransmission.p95 || 0),
          p99: (metrics.latency.logProcessing.p99 || 0) + (metrics.latency.batchTransmission.p99 || 0),
        },
      },
      
      // Resource utilization
      resources: {
        ...metrics.resources,
        trend: this.#calculateResourceTrend(),
      },
      
      // Reliability metrics
      reliability: {
        ...metrics.reliability,
        errorRate,
        batchSuccessRate: this.#calculateBatchSuccessRate(metrics),
        uptime: this.#calculateUptime(metrics),
      },
      
      // Volume breakdown
      volume: {
        ...metrics.volume,
        topCategories: this.#getTopCategories(metrics.volume.categoryCounts),
        growthRate: this.#calculateVolumeGrowthRate(),
      },
      
      // Batch processing metrics
      batches: {
        ...metrics.batches,
        efficiency: this.#calculateBatchEfficiency(metrics.batches),
      },
      
      // Health assessment
      health,
      
      // Recent alerts
      alerts: {
        critical: alerts.filter(a => a.severity === 'critical').slice(0, 10),
        warning: alerts.filter(a => a.severity === 'warning').slice(0, 10),
        total: alerts.length,
        byType: this.#groupAlertsByType(alerts),
      },
      
      // Aggregated metrics for different time periods
      aggregated: this.#generateAggregatedMetrics(recordedMetrics),
      
      // Optimization opportunities
      optimizations: this.#identifyOptimizations(metrics, alerts),
    };
    
    // Store in history
    this.#addToHistory(report);
    
    return report;
  }
  
  /**
   * Generates a dashboard-specific data format
   * 
   * @returns {object} Dashboard data
   */
  generateDashboardData() {
    const report = this.generateReport();
    
    return {
      // Key metrics for dashboard display
      kpis: {
        logsPerSecond: {
          value: report.current.logsPerSecond,
          trend: report.throughput.trend,
          status: this.#getMetricStatus(report.current.logsPerSecond, 'throughput'),
        },
        successRate: {
          value: report.summary.successRate,
          trend: this.#calculateSuccessRateTrend(),
          status: this.#getMetricStatus(report.summary.successRate, 'successRate'),
        },
        avgLatency: {
          value: report.summary.avgLatency,
          trend: this.#calculateLatencyTrend(),
          status: this.#getMetricStatus(report.summary.avgLatency, 'latency'),
        },
        bufferPressure: {
          value: report.current.bufferPressure,
          trend: this.#calculateBufferTrend(),
          status: this.#getMetricStatus(report.current.bufferPressure, 'bufferPressure'),
        },
      },
      
      // Time series data for charts
      timeSeries: {
        throughput: this.#getTimeSeriesData('throughput'),
        latency: this.#getTimeSeriesData('latency'),
        errors: this.#getTimeSeriesData('errors'),
        memory: this.#getTimeSeriesData('memory'),
      },
      
      // Category distribution for pie chart
      categoryDistribution: report.volume.topCategories,
      
      // Alert summary for status indicators
      alertSummary: {
        critical: report.alerts.critical.length,
        warning: report.alerts.warning.length,
        types: report.alerts.byType,
      },
      
      // Health score for gauge
      health: {
        score: report.health.score,
        status: report.health.status,
        components: report.health.components,
      },
      
      // Quick actions based on current state
      actions: report.optimizations.slice(0, 5).map(opt => ({
        title: opt.issue,
        description: opt.suggestion,
        priority: opt.priority,
        category: opt.category,
      })),
    };
  }
  
  /**
   * Calculates error rate from metrics
   * 
   * @private
   * @param {object} metrics - Current metrics
   * @returns {number} Error rate percentage
   */
  #calculateErrorRate(metrics) {
    const total = metrics.volume.totalLogsProcessed;
    const errors = metrics.reliability.failureCount;
    return total > 0 ? (errors / total) * 100 : 0;
  }
  
  /**
   * Calculates batch success rate
   * 
   * @private
   * @param {object} metrics - Current metrics
   * @returns {number} Batch success rate percentage
   */
  #calculateBatchSuccessRate(metrics) {
    const { totalBatches, successfulBatches } = metrics.batches;
    return totalBatches > 0 ? (successfulBatches / totalBatches) * 100 : 100;
  }
  
  /**
   * Calculates batch processing efficiency
   * 
   * @private
   * @param {object} batchMetrics - Batch metrics
   * @returns {number} Efficiency score (0-100)
   */
  #calculateBatchEfficiency(batchMetrics) {
    const { averageBatchSize, totalBatches, successfulBatches } = batchMetrics;
    const successRate = totalBatches > 0 ? successfulBatches / totalBatches : 1;
    const sizeEfficiency = Math.min(averageBatchSize / 100, 1); // Optimal batch size ~100
    
    return (successRate * 0.7 + sizeEfficiency * 0.3) * 100;
  }
  
  /**
   * Assesses overall health based on metrics and alerts
   * 
   * @private
   * @param {object} metrics - Current metrics
   * @param {Array} alerts - Current alerts
   * @returns {object} Health assessment
   */
  #assessHealth(metrics, alerts) {
    const components = {
      throughput: this.#assessComponent(metrics.throughput.logsPerSecond, 'throughput'),
      latency: this.#assessComponent(metrics.latency.logProcessing.p95, 'latency'),
      reliability: this.#assessComponent(metrics.reliability.successRate, 'successRate'),
      resources: this.#assessComponent(metrics.resources.bufferPressure, 'bufferPressure'),
      memory: this.#assessComponent(metrics.resources.memoryUsageMB, 'memory'),
    };
    
    // Calculate overall score
    const scores = Object.values(components).map(c => c.score);
    const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Determine status
    let status = 'healthy';
    if (overallScore < 50) status = 'critical';
    else if (overallScore < 75) status = 'degraded';
    else if (overallScore < 90) status = 'warning';
    
    // Generate recommendations
    const recommendations = this.#generateRecommendations(components, metrics, alerts);
    
    return {
      status,
      score: Math.round(overallScore),
      components,
      recommendations,
      lastAssessed: new Date().toISOString(),
    };
  }
  
  /**
   * Assesses a single health component
   * 
   * @private
   * @param {number} value - Metric value
   * @param {string} type - Metric type
   * @returns {object} Component assessment
   */
  #assessComponent(value, type) {
    const thresholds = this.healthThresholds[type] || { critical: 100, warning: 75 };
    
    let score = 100;
    let status = 'healthy';
    
    if (type === 'successRate') {
      // Higher is better
      if (value < thresholds.critical) {
        score = 0;
        status = 'critical';
      } else if (value < thresholds.warning) {
        score = 50;
        status = 'warning';
      }
    } else {
      // Lower is better (latency, buffer pressure, etc.)
      if (value > thresholds.critical) {
        score = 0;
        status = 'critical';
      } else if (value > thresholds.warning) {
        score = 50;
        status = 'warning';
      }
    }
    
    return { value, score, status };
  }
  
  /**
   * Generates health recommendations
   * 
   * @private
   * @param {object} components - Health components
   * @param {object} metrics - Current metrics
   * @param {Array} alerts - Current alerts
   * @returns {Array} Recommendations
   */
  #generateRecommendations(components, metrics, alerts) {
    const recommendations = [];
    
    // Check each component
    if (components.latency.status !== 'healthy') {
      recommendations.push({
        category: 'performance',
        priority: components.latency.status === 'critical' ? 'high' : 'medium',
        issue: 'High logging latency detected',
        suggestion: 'Consider reducing log verbosity or increasing batch size',
      });
    }
    
    if (components.resources.status !== 'healthy') {
      recommendations.push({
        category: 'resources',
        priority: 'high',
        issue: 'Buffer pressure is high',
        suggestion: 'Increase flush frequency or reduce log volume',
      });
    }
    
    if (components.reliability.status !== 'healthy') {
      recommendations.push({
        category: 'reliability',
        priority: 'critical',
        issue: 'Low success rate',
        suggestion: 'Check remote logger connectivity and error logs',
      });
    }
    
    if (components.memory.status !== 'healthy') {
      recommendations.push({
        category: 'resources',
        priority: 'high',
        issue: 'High memory usage',
        suggestion: 'Reduce buffer size or implement more aggressive cleanup',
      });
    }
    
    // Check for frequent alerts
    const frequentAlerts = this.#findFrequentAlerts(alerts);
    if (frequentAlerts.length > 0) {
      recommendations.push({
        category: 'stability',
        priority: 'medium',
        issue: `Frequent ${frequentAlerts[0].type} alerts`,
        suggestion: 'Review and adjust threshold configurations',
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * Identifies optimization opportunities
   * 
   * @private
   * @param {object} metrics - Current metrics
   * @param {Array} alerts - Current alerts
   * @returns {Array} Optimization suggestions
   */
  #identifyOptimizations(metrics, alerts) {
    const optimizations = [];
    
    // Batch size optimization
    if (metrics.batches.averageBatchSize < 50) {
      optimizations.push({
        category: 'performance',
        priority: 'medium',
        issue: 'Small batch sizes',
        impact: 'Increased overhead',
        suggestion: 'Increase batch size threshold to reduce transmission overhead',
        expectedImprovement: '20-30% reduction in network calls',
      });
    }
    
    // Category filtering
    const topCategories = this.#getTopCategories(metrics.volume.categoryCounts);
    if (topCategories.length > 0 && topCategories[0].percentage > 50) {
      optimizations.push({
        category: 'efficiency',
        priority: 'low',
        issue: `High volume from ${topCategories[0].name} category`,
        impact: 'Increased processing load',
        suggestion: `Consider filtering or sampling ${topCategories[0].name} logs`,
        expectedImprovement: '30-40% reduction in log volume',
      });
    }
    
    // Memory optimization
    if (metrics.resources.memoryUsageMB > 30) {
      optimizations.push({
        category: 'resources',
        priority: 'high',
        issue: 'High memory consumption',
        impact: 'Potential memory pressure',
        suggestion: 'Implement more aggressive buffer cleanup',
        expectedImprovement: '40-50% memory reduction',
      });
    }
    
    // Alert storm detection
    const alertRate = alerts.length / (metrics.batches.totalBatches || 1);
    if (alertRate > 5) {
      optimizations.push({
        category: 'stability',
        priority: 'medium',
        issue: 'Alert storm detected',
        impact: 'Alert fatigue',
        suggestion: 'Adjust alert thresholds or implement alert suppression',
        expectedImprovement: '70% reduction in alert noise',
      });
    }
    
    return optimizations;
  }
  
  /**
   * Groups alerts by type
   * 
   * @private
   * @param {Array} alerts - Alerts to group
   * @returns {object} Grouped alerts
   */
  #groupAlertsByType(alerts) {
    const grouped = {};
    for (const alert of alerts) {
      grouped[alert.type] = (grouped[alert.type] || 0) + 1;
    }
    return grouped;
  }
  
  /**
   * Finds frequently occurring alerts
   * 
   * @private
   * @param {Array} alerts - Alerts to analyze
   * @returns {Array} Frequent alert types
   */
  #findFrequentAlerts(alerts) {
    const grouped = this.#groupAlertsByType(alerts);
    return Object.entries(grouped)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }
  
  /**
   * Gets top categories by volume
   * 
   * @private
   * @param {object} categoryCounts - Category counts
   * @returns {Array} Top categories with percentages
   */
  #getTopCategories(categoryCounts) {
    const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(categoryCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
  
  /**
   * Generates aggregated metrics for different time periods
   * 
   * @private
   * @param {object} recordedMetrics - Recorded metrics
   * @returns {object} Aggregated metrics
   */
  #generateAggregatedMetrics(recordedMetrics) {
    const aggregated = {};
    
    for (const [period, duration] of Object.entries(this.#aggregationPeriods)) {
      if (period === 'realtime') continue;
      
      aggregated[period] = {
        totalLogs: recordedMetrics[`logs.total.${period}`]?.value || 0,
        totalBytes: recordedMetrics[`logs.bytes.${period}`]?.value || 0,
        errors: recordedMetrics[`errors.${period}`]?.value || 0,
        avgLatency: recordedMetrics[`latency.avg.${period}`]?.value || 0,
      };
    }
    
    return aggregated;
  }
  
  /**
   * Calculates throughput trend
   * 
   * @private
   * @returns {string} Trend direction (up, down, stable)
   */
  #calculateThroughputTrend() {
    if (this.#reportHistory.length < 2) return 'stable';
    
    const recent = this.#reportHistory.slice(-5);
    const values = recent.map(r => r.current.logsPerSecond);
    
    return this.#calculateTrend(values);
  }
  
  /**
   * Calculates generic trend from values
   * 
   * @private
   * @param {number[]} values - Values to analyze
   * @returns {string} Trend direction
   */
  #calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 10) return 'up';
    if (change < -10) return 'down';
    return 'stable';
  }
  
  /**
   * Gets time series data for charts
   * 
   * @private
   * @param {string} metric - Metric type
   * @returns {Array} Time series data points
   */
  #getTimeSeriesData(metric) {
    return this.#reportHistory.slice(-100).map(report => {
      let value;
      
      switch (metric) {
        case 'throughput':
          value = report.current.logsPerSecond;
          break;
        case 'latency':
          value = report.latency.logProcessing.p50;
          break;
        case 'errors':
          value = report.reliability.errorRate;
          break;
        case 'memory':
          value = report.current.memoryUsageMB;
          break;
        default:
          value = 0;
      }
      
      return {
        timestamp: report.timestamp,
        value,
      };
    });
  }
  
  /**
   * Adds report to history and manages size
   * 
   * @private
   * @param {object} report - Report to add
   */
  #addToHistory(report) {
    this.#reportHistory.push(report);
    
    if (this.#reportHistory.length > this.maxHistorySize) {
      this.#reportHistory = this.#reportHistory.slice(-this.maxHistorySize);
    }
  }
  
  /**
   * Finds peak throughput from history
   * 
   * @private
   * @returns {number} Peak logs per second
   */
  #findPeakThroughput() {
    if (this.#reportHistory.length === 0) return 0;
    
    return Math.max(...this.#reportHistory.map(r => r.current.logsPerSecond));
  }
  
  /**
   * Calculates uptime percentage
   * 
   * @private
   * @param {object} metrics - Current metrics
   * @returns {number} Uptime percentage
   */
  #calculateUptime(metrics) {
    // Simple uptime based on success rate
    return metrics.reliability.successRate;
  }
  
  /**
   * Calculates volume growth rate
   * 
   * @private
   * @returns {number} Growth rate percentage
   */
  #calculateVolumeGrowthRate() {
    if (this.#reportHistory.length < 10) return 0;
    
    const oldVolume = this.#reportHistory[this.#reportHistory.length - 10].volume.totalLogsProcessed;
    const newVolume = this.#reportHistory[this.#reportHistory.length - 1].volume.totalLogsProcessed;
    
    return ((newVolume - oldVolume) / oldVolume) * 100;
  }
  
  /**
   * Calculates resource usage trend
   * 
   * @private
   * @returns {string} Trend direction
   */
  #calculateResourceTrend() {
    if (this.#reportHistory.length < 2) return 'stable';
    
    const recent = this.#reportHistory.slice(-5);
    const values = recent.map(r => r.current.memoryUsageMB);
    
    return this.#calculateTrend(values);
  }
  
  /**
   * Calculates success rate trend
   * 
   * @private
   * @returns {string} Trend direction
   */
  #calculateSuccessRateTrend() {
    if (this.#reportHistory.length < 2) return 'stable';
    
    const recent = this.#reportHistory.slice(-5);
    const values = recent.map(r => r.summary.successRate);
    
    return this.#calculateTrend(values);
  }
  
  /**
   * Calculates latency trend
   * 
   * @private
   * @returns {string} Trend direction
   */
  #calculateLatencyTrend() {
    if (this.#reportHistory.length < 2) return 'stable';
    
    const recent = this.#reportHistory.slice(-5);
    const values = recent.map(r => r.summary.avgLatency);
    
    // For latency, reverse the trend (up is bad)
    const trend = this.#calculateTrend(values);
    if (trend === 'up') return 'degrading';
    if (trend === 'down') return 'improving';
    return 'stable';
  }
  
  /**
   * Calculates buffer pressure trend
   * 
   * @private
   * @returns {string} Trend direction
   */
  #calculateBufferTrend() {
    if (this.#reportHistory.length < 2) return 'stable';
    
    const recent = this.#reportHistory.slice(-5);
    const values = recent.map(r => r.current.bufferPressure);
    
    return this.#calculateTrend(values);
  }
  
  /**
   * Gets metric status for dashboard
   * 
   * @private
   * @param {number} value - Metric value
   * @param {string} type - Metric type
   * @returns {string} Status (good, warning, critical)
   */
  #getMetricStatus(value, type) {
    const assessment = this.#assessComponent(value, type);
    
    switch (assessment.status) {
      case 'healthy':
        return 'good';
      case 'warning':
        return 'warning';
      case 'critical':
      case 'degraded':
        return 'critical';
      default:
        return 'unknown';
    }
  }
}

export default LoggingPerformanceReporter;