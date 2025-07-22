/**
 * @file Type definitions for trace analysis tools
 * @see traceAnalyzer.js
 * @see traceVisualizer.js
 * @see performanceMonitor.js
 */

/**
 * @typedef {object} BottleneckInfo
 * @description Information about a performance bottleneck
 * @property {string} operation - The operation name
 * @property {number} duration - Duration in milliseconds
 * @property {number} spanId - The span ID
 * @property {object} attributes - Span attributes at time of bottleneck
 * @property {number} depth - Depth in the span hierarchy
 * @property {string} criticalPath - Whether this span is on the critical path
 */

/**
 * @typedef {object} OperationStats
 * @description Statistical information about an operation type
 * @property {string} operation - The operation name
 * @property {number} count - Number of times this operation occurred
 * @property {number} totalDuration - Total time spent in this operation
 * @property {number} averageDuration - Average duration per occurrence
 * @property {number} minDuration - Minimum duration observed
 * @property {number} maxDuration - Maximum duration observed
 * @property {number} errorCount - Number of errors in this operation
 * @property {number} errorRate - Error rate as percentage (0-100)
 */

/**
 * @typedef {object} ErrorAnalysis
 * @description Analysis of error patterns in the trace
 * @property {number} totalErrors - Total number of errors
 * @property {number} totalOperations - Total number of operations
 * @property {number} overallErrorRate - Overall error rate as percentage
 * @property {ErrorsByOperation[]} errorsByOperation - Errors grouped by operation
 * @property {ErrorsByType[]} errorsByType - Errors grouped by error type
 * @property {string[]} criticalPathErrors - Operations on critical path that failed
 */

/**
 * @typedef {object} ErrorsByOperation
 * @description Error information grouped by operation type
 * @property {string} operation - The operation name
 * @property {number} errorCount - Number of errors for this operation
 * @property {number} totalCount - Total occurrences of this operation
 * @property {number} errorRate - Error rate for this operation (0-100)
 * @property {string[]} errorMessages - Unique error messages
 */

/**
 * @typedef {object} ErrorsByType
 * @description Error information grouped by error type
 * @property {string} errorType - The error class/type name
 * @property {number} count - Number of occurrences
 * @property {string[]} operations - Operations where this error occurred
 * @property {string} sampleMessage - Example error message
 */

/**
 * @typedef {object} ConcurrencyProfile
 * @description Analysis of concurrent operations in the trace
 * @property {number} maxConcurrency - Maximum number of concurrent operations
 * @property {number} averageConcurrency - Average number of concurrent operations
 * @property {ConcurrentPeriod[]} concurrentPeriods - Time periods with concurrent operations
 * @property {string[]} parallelOperations - Operations that commonly run in parallel
 * @property {number} serialOperationCount - Number of operations that run sequentially
 * @property {number} parallelOperationCount - Number of operations that run in parallel
 */

/**
 * @typedef {object} ConcurrentPeriod
 * @description A time period where multiple operations were running concurrently
 * @property {number} startTime - Start time of the concurrent period
 * @property {number} endTime - End time of the concurrent period
 * @property {number} concurrency - Number of concurrent operations in this period
 * @property {string[]} operations - Names of operations running concurrently
 */

/**
 * @typedef {object} CriticalPathAnalysis
 * @description Detailed analysis of the critical (longest) execution path
 * @property {string[]} operations - Operations on the critical path
 * @property {number} totalDuration - Total duration of the critical path
 * @property {number} percentageOfTotal - Percentage of total trace time
 * @property {CriticalPathStep[]} steps - Detailed information about each step
 * @property {string[]} bottleneckOperations - Operations causing the most delay
 */

/**
 * @typedef {object} CriticalPathStep
 * @description A single step in the critical path
 * @property {string} operation - The operation name
 * @property {number} duration - Duration of this step
 * @property {number} cumulativeDuration - Cumulative duration up to this step
 * @property {number} percentageOfPath - Percentage of critical path time
 * @property {object} attributes - Span attributes for this step
 */

/**
 * @typedef {object} VisualizationOptions
 * @description Options for trace visualization
 * @property {boolean} showAttributes - Whether to display span attributes
 * @property {boolean} showTimings - Whether to display timing information
 * @property {boolean} showErrors - Whether to highlight errors
 * @property {boolean} showCriticalPath - Whether to highlight the critical path
 * @property {number} maxDepth - Maximum depth to display (0 = no limit)
 * @property {number} minDuration - Minimum duration to display (ms)
 * @property {boolean} colorsEnabled - Whether to use ANSI colors in console output
 */

/**
 * @typedef {object} WaterfallEntry
 * @description An entry in the waterfall visualization
 * @property {string} operation - The operation name
 * @property {number} startTime - Start time relative to trace start
 * @property {number} endTime - End time relative to trace start
 * @property {number} duration - Duration in milliseconds
 * @property {number} depth - Depth in the hierarchy
 * @property {string} status - Span status
 * @property {boolean} onCriticalPath - Whether this span is on the critical path
 */

/**
 * @typedef {object} PerformanceThresholds
 * @description Thresholds for performance monitoring
 * @property {number} slowOperationMs - Threshold for slow operation warning (default: 100)
 * @property {number} criticalOperationMs - Threshold for critical operation alert (default: 500)
 * @property {number} maxConcurrency - Maximum acceptable concurrent operations (default: 10)
 * @property {number} maxTotalDurationMs - Maximum total trace duration (default: 5000)
 * @property {number} maxErrorRate - Maximum acceptable error rate percentage (default: 5)
 * @property {number} maxMemoryUsageMB - Maximum memory usage for span storage (default: 50)
 */

/**
 * @typedef {object} PerformanceAlert
 * @description A performance alert generated during monitoring
 * @property {string} type - Alert type ('slow_operation', 'critical_operation', 'high_error_rate', etc.)
 * @property {string} severity - Alert severity ('warning', 'critical', 'error')
 * @property {string} message - Human-readable alert message
 * @property {string} operation - Operation name that triggered the alert
 * @property {number} value - The measured value that triggered the alert
 * @property {number} threshold - The threshold that was exceeded
 * @property {number} timestamp - When the alert was generated
 * @property {object} context - Additional context for the alert
 */

/**
 * @typedef {object} SamplingConfig
 * @description Configuration for trace sampling
 * @property {number} rate - Sampling rate (0.0 to 1.0)
 * @property {string} strategy - Sampling strategy ('random', 'adaptive', 'error_biased')
 * @property {boolean} alwaysSampleErrors - Whether to always sample traces with errors
 * @property {boolean} alwaysSampleSlow - Whether to always sample slow traces
 * @property {number} slowThresholdMs - Threshold for considering a trace slow
 */

/**
 * @typedef {object} MemoryUsage
 * @description Memory usage information for trace storage
 * @property {number} totalSpans - Total number of spans stored
 * @property {number} estimatedSizeBytes - Estimated memory usage in bytes
 * @property {number} estimatedSizeMB - Estimated memory usage in megabytes
 * @property {number} averageSpanSize - Average span size in bytes
 * @property {number} largestSpanSize - Largest span size in bytes
 */

/**
 * @typedef {object} RealtimeMetrics
 * @description Real-time performance metrics
 * @property {number} activeSpans - Number of currently active spans
 * @property {number} completedSpans - Number of completed spans
 * @property {number} totalOperations - Total number of operations
 * @property {number} currentConcurrency - Current number of concurrent operations
 * @property {number} errorCount - Current error count
 * @property {number} currentDuration - Current total duration
 * @property {PerformanceAlert[]} recentAlerts - Recent performance alerts
 * @property {number} memoryUsageMB - Current memory usage in megabytes
 */
