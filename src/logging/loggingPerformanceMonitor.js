/**
 * @file LoggingPerformanceMonitor class for monitoring debug logging system performance
 * @see ../actions/tracing/performanceMonitor.js
 */

import { PerformanceMonitor } from '../actions/tracing/performanceMonitor.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('../actions/tracing/analysisTypes.js').PerformanceThresholds} PerformanceThresholds */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Extended performance monitoring for the logging system
 * Tracks logging-specific metrics including throughput, latency, and resource usage
 * 
 * @extends PerformanceMonitor
 */
export class LoggingPerformanceMonitor extends PerformanceMonitor {
  #logger;
  #eventBus;
  #categoryDetector;
  #performanceMonitor;
  #metricsBuffer;
  #reportingInterval;
  #categoryMetrics;
  #batchMetrics;
  #lastReportTime;
  
  /**
   * Creates a new LoggingPerformanceMonitor instance
   * 
   * @param {object} dependencies - Required dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {object} dependencies.eventBus - Event bus for dispatching events
   * @param {object} dependencies.categoryDetector - Log category detector for category metrics
   * @param {object} [dependencies.performanceMonitor] - Optional base performance monitor to extend
   * @param {PerformanceThresholds} [dependencies.thresholds] - Performance thresholds
   * @param {object} [dependencies.config] - Additional configuration
   */
  constructor({ 
    logger,
    eventBus,
    categoryDetector,
    performanceMonitor,
    thresholds = {},
    config = {}
  }) {
    // If we have a base performance monitor, use its structured trace
    // Otherwise create a minimal structured trace
    const structuredTrace = performanceMonitor ? 
      performanceMonitor.structuredTrace : 
      { 
        recordMetric: () => {}, 
        createChild: () => ({}),
        getSpans: () => [],
        getActiveSpan: () => null
      };
    
    // Call parent constructor with structured trace and thresholds
    super(structuredTrace, {
      ...thresholds,
      // Add logging-specific thresholds
      maxLogProcessingTime: thresholds.maxLogProcessingTime || 1,
      maxBatchTransmissionTime: thresholds.maxBatchTransmissionTime || 100,
      maxBufferSize: thresholds.maxBufferSize || 1000,
      minSuccessRate: thresholds.minSuccessRate || 95,
    });
    
    // Validate dependencies
    validateDependency(logger, 'ILogger', undefined, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    
    validateDependency(eventBus, 'EventBus', undefined, {
      requiredMethods: ['dispatch'],
    });
    
    validateDependency(categoryDetector, 'LogCategoryDetector', undefined, {
      requiredMethods: ['detectCategory'],
    });
    
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#categoryDetector = categoryDetector;
    this.#performanceMonitor = performanceMonitor;
    
    // Initialize metrics structures
    this.#metricsBuffer = [];
    this.#reportingInterval = config.reportingInterval || 60000; // Default 1 minute
    this.#lastReportTime = performance.now();
    
    // Initialize category-specific metrics
    this.#categoryMetrics = new Map();
    
    // Initialize batch metrics
    this.#batchMetrics = {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalLogsInBatches: 0,
      averageBatchSize: 0,
      lastBatchTime: null,
    };
    
    // Record initialization
    this.recordMetric('logging.monitor.initialized', 1);
  }
  
  /**
   * Monitors a log operation with performance tracking
   * 
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Log message
   * @param {object} [metadata] - Additional metadata
   * @returns {object} Operation result with category and metrics
   */
  monitorLogOperation(level, message, metadata = {}) {
    const startTime = performance.now();
    
    try {
      // Detect category
      const category = this.#categoryDetector.detectCategory(message);
      
      // Track category metrics
      this.#updateCategoryMetrics(category, level);
      
      // Calculate message size
      const messageSize = JSON.stringify(message).length;
      
      // Record metrics using parent class methods
      this.recordMetric(`log.${level}.count`, 1);
      this.recordMetric(`log.${level}.bytes`, messageSize);
      this.recordMetric(`category.${category}.count`, 1);
      this.recordMetric(`category.${category}.bytes`, messageSize);
      
      // Track operation timing
      const duration = performance.now() - startTime;
      this.trackOperation(`log.${level}`, startTime);
      
      // Check threshold for log processing time
      this.checkThreshold(
        `log.${level}.processing`,
        duration,
        this.getThresholds().maxLogProcessingTime || 1
      );
      
      // Store in metrics buffer for reporting
      this.#metricsBuffer.push({
        timestamp: startTime,
        level,
        category,
        size: messageSize,
        duration,
        metadata,
      });
      
      // Trim buffer if needed
      this.#trimMetricsBuffer();
      
      return {
        category,
        size: messageSize,
        duration,
        success: true,
      };
    } catch (error) {
      // Record error metric
      this.recordMetric('log.operation.errors', 1);
      
      return {
        category: 'unknown',
        size: 0,
        duration: performance.now() - startTime,
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Monitors a batch flush operation
   * 
   * @param {number} batchSize - Number of logs in the batch
   * @param {number} flushTime - Duration of the flush operation in milliseconds
   * @param {boolean} [success=true] - Whether the flush was successful
   * @returns {Promise<object>} Batch operation metrics
   */
  async monitorBatchFlush(batchSize, flushTime, success = true) {
    const operationName = 'batch.flush';
    const startTime = performance.now() - flushTime; // Calculate start time from duration
    
    try {
      // Record batch metrics
      this.#batchMetrics.totalBatches++;
      this.#batchMetrics.totalLogsInBatches += batchSize;
      this.#batchMetrics.lastBatchTime = startTime;
      
      // Calculate average batch size
      this.#batchMetrics.averageBatchSize = 
        this.#batchMetrics.totalLogsInBatches / this.#batchMetrics.totalBatches;
      
      // Record metrics
      this.recordMetric('batch.size', batchSize);
      this.recordMetric('batch.count', 1);
      
      // Track the operation with actual duration
      this.trackOperation(operationName, startTime);
      
      // Check threshold for batch transmission time
      this.checkThreshold(
        'batch.transmission',
        flushTime,
        this.getThresholds().maxBatchTransmissionTime || 100
      );
      
      // Update success/failure metrics based on provided success parameter
      if (success) {
        this.#batchMetrics.successfulBatches++;
      } else {
        this.#batchMetrics.failedBatches++;
        this.recordMetric('batch.failures', 1);
      }
      
      return {
        batchSize,
        duration: flushTime,
        success,
        averageBatchSize: this.#batchMetrics.averageBatchSize,
      };
    } catch (error) {
      // Mark as failed
      this.#batchMetrics.failedBatches++;
      this.recordMetric('batch.failures', 1);
      
      return {
        batchSize,
        duration: flushTime,
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Monitors buffer size and generates alerts if needed
   * 
   * @param {number} currentBufferSize - Current buffer size
   * @param {number} [maxBufferSize] - Maximum buffer size (optional, uses threshold if not provided)
   * @returns {object} Buffer status
   */
  monitorBufferSize(currentBufferSize, maxBufferSize) {
    // Use provided maxBufferSize or fall back to threshold
    const effectiveMaxSize = maxBufferSize || this.getThresholds().maxBufferSize || 1000;
    
    // Record buffer size metric
    this.recordMetric('buffer.size', currentBufferSize);
    
    // Check threshold
    const exceeded = this.checkThreshold(
      'buffer.size',
      currentBufferSize,
      effectiveMaxSize
    );
    
    // Calculate buffer pressure
    const bufferPressure = (currentBufferSize / effectiveMaxSize) * 100;
    this.recordMetric('buffer.pressure', bufferPressure);
    
    return {
      size: currentBufferSize,
      maxSize: effectiveMaxSize,
      pressure: bufferPressure,
      exceeded,
      status: exceeded ? 'critical' : bufferPressure > 75 ? 'warning' : 'normal',
    };
  }
  
  /**
   * Gets comprehensive logging metrics
   * 
   * @returns {object} Logging performance metrics
   */
  getLoggingMetrics() {
    const now = performance.now();
    const timeSinceLastReport = now - this.#lastReportTime;
    
    // Get base metrics from parent class
    const baseMetrics = this.getRealtimeMetrics();
    const recordedMetrics = this.getRecordedMetrics();
    
    // Calculate throughput metrics
    const recentLogs = this.#metricsBuffer.filter(
      log => log.timestamp > now - 60000 // Last minute
    );
    
    const logsPerSecond = recentLogs.length / 60;
    const bytesPerSecond = recentLogs.reduce((sum, log) => sum + log.size, 0) / 60;
    
    // Calculate latency percentiles
    const latencies = recentLogs.map(log => log.duration).sort((a, b) => a - b);
    const p50 = this.#calculatePercentile(latencies, 50);
    const p95 = this.#calculatePercentile(latencies, 95);
    const p99 = this.#calculatePercentile(latencies, 99);
    
    // Calculate success rate
    const totalOps = recordedMetrics['log.operation.errors']?.value || 0;
    const totalLogs = recentLogs.length;
    const successRate = totalLogs > 0 ? ((totalLogs - totalOps) / totalLogs) * 100 : 100;
    
    // Compile comprehensive metrics
    return {
      // Base metrics from parent
      ...baseMetrics,
      
      // Throughput metrics
      throughput: {
        logsPerSecond,
        bytesPerSecond,
        batchesPerMinute: (this.#batchMetrics.totalBatches / (timeSinceLastReport / 60000)),
      },
      
      // Latency metrics
      latency: {
        logProcessing: { p50, p95, p99 },
        batchTransmission: {
          p50: recordedMetrics['batch.transmission.p50']?.value || 0,
          p95: recordedMetrics['batch.transmission.p95']?.value || 0,
          p99: recordedMetrics['batch.transmission.p99']?.value || 0,
        },
      },
      
      // Resource metrics
      resources: {
        memoryUsageMB: baseMetrics.memoryUsageMB,
        bufferSize: recordedMetrics['buffer.size']?.value || 0,
        bufferPressure: recordedMetrics['buffer.pressure']?.value || 0,
      },
      
      // Reliability metrics
      reliability: {
        successRate,
        failureCount: recordedMetrics['log.operation.errors']?.value || 0,
        retryCount: recordedMetrics['batch.retries']?.value || 0,
        circuitBreakerTrips: recordedMetrics['circuit.breaker.trips']?.value || 0,
      },
      
      // Volume metrics
      volume: {
        totalLogsProcessed: recordedMetrics['logs.total']?.value || totalLogs,
        totalBytesSent: recordedMetrics['logs.bytes']?.value || 0,
        categoryCounts: this.#getCategoryCounts(),
      },
      
      // Batch metrics
      batches: {
        ...this.#batchMetrics,
      },
    };
  }
  
  /**
   * Updates category-specific metrics
   * 
   * @private
   * @param {string} category - Log category
   * @param {string} level - Log level
   */
  #updateCategoryMetrics(category, level) {
    if (!this.#categoryMetrics.has(category)) {
      this.#categoryMetrics.set(category, {
        counts: { debug: 0, info: 0, warn: 0, error: 0, total: 0 },
        bytes: 0,
        lastSeen: null,
      });
    }
    
    const metrics = this.#categoryMetrics.get(category);
    metrics.counts[level] = (metrics.counts[level] || 0) + 1;
    metrics.counts.total++;
    metrics.lastSeen = performance.now();
  }
  
  /**
   * Gets category counts for reporting
   * 
   * @private
   * @returns {object} Category counts
   */
  #getCategoryCounts() {
    const counts = {};
    for (const [category, metrics] of this.#categoryMetrics) {
      counts[category] = metrics.counts.total;
    }
    return counts;
  }
  
  /**
   * Calculates percentile from sorted array
   * 
   * @private
   * @param {number[]} sortedArray - Sorted array of values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  #calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }
  
  /**
   * Trims metrics buffer to prevent excessive memory usage
   * 
   * @private
   */
  #trimMetricsBuffer() {
    const maxBufferSize = 10000; // Keep last 10k entries
    if (this.#metricsBuffer.length > maxBufferSize) {
      this.#metricsBuffer = this.#metricsBuffer.slice(-maxBufferSize);
    }
  }
  
  /**
   * Resets logging metrics for a new reporting period
   */
  resetMetrics() {
    this.#lastReportTime = performance.now();
    this.#metricsBuffer = [];
    this.#categoryMetrics.clear();
    this.#batchMetrics = {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalLogsInBatches: 0,
      averageBatchSize: 0,
      lastBatchTime: null,
    };
    
    // Clear recorded metrics from parent
    this.clearRecordedMetrics();
    this.clearAlerts();
  }
  
  /**
   * Gets current performance thresholds including logging-specific ones
   * 
   * @returns {PerformanceThresholds} Current thresholds
   */
  getThresholds() {
    return this.getMonitoringStatus().thresholds;
  }

  /**
   * Override checkThreshold to dispatch events when thresholds are exceeded
   * @param {string} operation - The operation name
   * @param {number} value - The metric value
   * @param {number} threshold - The threshold value
   * @returns {boolean} Whether the threshold was exceeded
   */
  checkThreshold(operation, value, threshold) {
    const exceeded = super.checkThreshold(operation, value, threshold);
    
    if (exceeded && this.#eventBus) {
      // Extract the metric type from the operation name
      let metric = operation;
      if (operation.includes('processing')) {
        metric = 'logProcessingTime';
      } else if (operation.includes('transmission')) {
        metric = 'batchTransmissionTime';
      } else if (operation.includes('buffer')) {
        metric = 'bufferSize';
      }
      
      this.#eventBus.dispatch({
        type: 'PERFORMANCE_THRESHOLD_EXCEEDED',
        payload: {
          metric,
          operation,
          value,
          threshold,
          exceeded: true
        }
      });
    }
    
    return exceeded;
  }

  /**
   * Gets performance metrics (compatibility method for LoggingPerformanceAdvisor)
   * Delegates to getLoggingMetrics for comprehensive logging metrics
   * 
   * @returns {object} Performance metrics
   */
  getMetrics() {
    return this.getLoggingMetrics();
  }
}

export default LoggingPerformanceMonitor;