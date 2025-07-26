/**
 * @file StructuredTrace class that extends TraceContext with hierarchical span-based tracing
 * @see traceContext.js
 * @see span.js
 * @see types.js
 */

import { TraceContext } from './traceContext.js';
import Span from './span.js';

/** @typedef {import('./types.js').SpanAttributes} SpanAttributes */
/** @typedef {import('./types.js').HierarchicalSpan} HierarchicalSpan */
/** @typedef {import('./types.js').PerformanceSummary} PerformanceSummary */
/** @typedef {import('./types.js').SpanOptions} SpanOptions */
/** @typedef {import('../../configuration/traceConfigLoader.js').TraceConfigurationFile} TraceConfigurationFile */

/**
 * @class StructuredTrace
 * @description Extends TraceContext with hierarchical span-based tracing while maintaining backward compatibility
 */
export class StructuredTrace {
  #traceContext;
  #spans;
  #activeSpan;
  #spanIdCounter;
  #rootSpan;
  #traceConfig;
  #analyzer;
  #visualizer;
  #performanceMonitor;

  /**
   * Creates a new StructuredTrace instance
   *
   * @param {TraceContext} [traceContext] - Optional existing TraceContext to wrap
   * @param {TraceConfigurationFile} [traceConfig] - Optional trace configuration
   */
  constructor(traceContext = null, traceConfig = null) {
    this.#traceContext = traceContext || new TraceContext();
    this.#spans = new Map(); // Map of span ID to Span
    this.#activeSpan = null;
    this.#spanIdCounter = 0;
    this.#rootSpan = null;
    this.#traceConfig = traceConfig || { traceAnalysisEnabled: false };

    // Lazy-initialized analysis tools
    this.#analyzer = null;
    this.#visualizer = null;
    this.#performanceMonitor = null;
  }

  // ==========================================
  // Backward compatibility - delegate to TraceContext
  // ==========================================

  /**
   * Gets the logs array from the wrapped TraceContext
   *
   * @returns {import('./traceContext.js').TraceLogEntry[]} The trace logs
   */
  get logs() {
    return this.#traceContext.logs;
  }

  /**
   * Adds a log entry to the trace
   *
   * @param {import('./traceContext.js').LogEntryType} type - The type of log entry
   * @param {string} message - The log message
   * @param {string} source - The source of the log
   * @param {object} [data] - Optional data payload
   */
  addLog(type, message, source, data = null) {
    return this.#traceContext.addLog(type, message, source, data);
  }

  /**
   * Logs an informational message
   *
   * @param {string} msg - The log message
   * @param {string} src - The source of the log
   * @param {object} [data] - Optional data payload
   */
  info(msg, src, data) {
    return this.#traceContext.info(msg, src, data);
  }

  /**
   * Logs a success event
   *
   * @param {string} msg - The log message
   * @param {string} src - The source of the log
   * @param {object} [data] - Optional data payload
   */
  success(msg, src, data) {
    return this.#traceContext.success(msg, src, data);
  }

  /**
   * Logs a failure event
   *
   * @param {string} msg - The log message
   * @param {string} src - The source of the log
   * @param {object} [data] - Optional data payload
   */
  failure(msg, src, data) {
    return this.#traceContext.failure(msg, src, data);
  }

  /**
   * Logs a high-level step
   *
   * @param {string} msg - The log message
   * @param {string} src - The source of the log
   * @param {object} [data] - Optional data payload
   */
  step(msg, src, data) {
    return this.#traceContext.step(msg, src, data);
  }

  /**
   * Logs an error event
   *
   * @param {string} msg - The log message
   * @param {string} src - The source of the log
   * @param {object} [data] - Optional data payload
   */
  error(msg, src, data) {
    return this.#traceContext.error(msg, src, data);
  }

  /**
   * Logs a data payload
   *
   * @param {string} msg - The log message
   * @param {string} src - The source of the log
   * @param {object} [data] - Optional data payload
   */
  data(msg, src, data) {
    return this.#traceContext.data(msg, src, data);
  }

  // ==========================================
  // Span management
  // ==========================================

  /**
   * Starts a new span
   *
   * @param {string} operation - The operation name
   * @param {SpanAttributes} [attributes] - Optional initial attributes
   * @returns {Span} The created span
   */
  startSpan(operation, attributes = {}) {
    const spanId = ++this.#spanIdCounter;
    const parentId = this.#activeSpan ? this.#activeSpan.id : null;
    const span = new Span(spanId, operation, parentId);

    if (attributes && Object.keys(attributes).length > 0) {
      span.setAttributes(attributes);
    }

    this.#spans.set(spanId, span);

    // Track parent-child relationships
    if (this.#activeSpan) {
      this.#activeSpan.addChild(span);
    } else {
      // This is a root span
      this.#rootSpan = span;
    }

    this.#activeSpan = span;
    return span;
  }

  /**
   * Ends a span
   *
   * @param {Span} span - The span to end
   * @throws {Error} If the span is not the currently active span
   */
  endSpan(span) {
    if (!span || !(span instanceof Span)) {
      throw new Error('endSpan requires a valid Span instance');
    }

    if (this.#activeSpan !== span) {
      throw new Error(
        `Cannot end span ${span.id} - it is not the currently active span`
      );
    }

    span.end();

    // Move active span up to parent
    if (span.parentId !== null) {
      this.#activeSpan = this.#spans.get(span.parentId) || null;
    } else {
      this.#activeSpan = null;
    }
  }

  /**
   * Executes a function within a span (synchronous)
   *
   * @template T
   * @param {string} operation - The operation name
   * @param {() => T} fn - The function to execute
   * @param {SpanAttributes} [attributes] - Optional span attributes
   * @returns {T} The function result
   */
  withSpan(operation, fn, attributes = {}) {
    const span = this.startSpan(operation, attributes);

    try {
      const result = fn();
      span.setStatus('success');
      return result;
    } catch (error) {
      span.setError(error);
      throw error;
    } finally {
      this.endSpan(span);
    }
  }

  /**
   * Executes an async function within a span
   *
   * @template T
   * @param {string} operation - The operation name
   * @param {() => Promise<T>} asyncFn - The async function to execute
   * @param {SpanAttributes} [attributes] - Optional span attributes
   * @returns {Promise<T>} The function result
   */
  async withSpanAsync(operation, asyncFn, attributes = {}) {
    const span = this.startSpan(operation, attributes);

    try {
      const result = await asyncFn();
      // Only set success status if the span doesn't already have an error
      if (span.status !== 'error') {
        span.setStatus('success');
      }
      return result;
    } catch (error) {
      span.setError(error);
      throw error;
    } finally {
      this.endSpan(span);
    }
  }

  // ==========================================
  // Analysis methods
  // ==========================================

  /**
   * Gets a hierarchical view of all spans
   *
   * @returns {HierarchicalSpan|null} The root span with nested children, or null if no spans
   */
  getHierarchicalView() {
    if (!this.#rootSpan) {
      return null;
    }

    return this.#buildHierarchicalSpan(this.#rootSpan);
  }

  /**
   * Builds a hierarchical span object recursively
   *
   * @private
   * @param {Span} span - The span to convert
   * @returns {HierarchicalSpan} The hierarchical representation
   */
  #buildHierarchicalSpan(span) {
    const hierarchicalSpan = {
      operation: span.operation,
      duration: span.duration,
      status: span.status,
      attributes: span.attributes,
      children: span.children.map((child) =>
        this.#buildHierarchicalSpan(child)
      ),
    };

    if (span.error) {
      hierarchicalSpan.error = span.error.message;
    }

    return hierarchicalSpan;
  }

  /**
   * Gets a performance summary of the trace
   *
   * @returns {PerformanceSummary} Performance metrics and analysis
   */
  getPerformanceSummary() {
    if (!this.#rootSpan) {
      return {
        totalDuration: 0,
        operationCount: 0,
        criticalPath: [],
        slowestOperations: [],
        errorCount: 0,
        operationStats: {},
      };
    }

    const allSpans = Array.from(this.#spans.values());
    const completedSpans = allSpans.filter((span) => span.duration !== null);

    // Calculate total duration (root span duration)
    const totalDuration = this.#rootSpan.duration || 0;

    // Count errors
    const errorCount = allSpans.filter(
      (span) => span.status === 'error'
    ).length;

    // Get slowest operations
    const slowestOperations = completedSpans
      .map((span) => ({
        operation: span.operation,
        duration: span.duration,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10); // Top 10 slowest

    // Calculate operation statistics
    const operationStats = {};
    for (const span of completedSpans) {
      const op = span.operation;
      if (!operationStats[op]) {
        operationStats[op] = 0;
      }
      operationStats[op] += span.duration;
    }

    // Find critical path
    const criticalPath = this.#findCriticalPath(this.#rootSpan);

    return {
      totalDuration,
      operationCount: allSpans.length,
      criticalPath: criticalPath.map((span) => span.operation),
      slowestOperations,
      errorCount,
      operationStats,
    };
  }

  /**
   * Finds the critical (longest) path through the span tree
   *
   * @private
   * @param {Span} span - The span to start from
   * @returns {Span[]} The spans on the critical path
   */
  #findCriticalPath(span) {
    if (span.children.length === 0) {
      return [span];
    }

    // Find the child with the longest path
    let longestPath = [];
    let longestDuration = 0;

    for (const child of span.children) {
      const childPath = this.#findCriticalPath(child);
      const childDuration = childPath.reduce(
        (sum, s) => sum + (s.duration || 0),
        0
      );

      if (childDuration > longestDuration) {
        longestDuration = childDuration;
        longestPath = childPath;
      }
    }

    return [span, ...longestPath];
  }

  /**
   * Gets the critical path operations
   *
   * @returns {string[]} Array of operation names on the critical path
   */
  getCriticalPath() {
    const summary = this.getPerformanceSummary();
    return summary.criticalPath;
  }

  /**
   * Gets all spans as an array
   *
   * @returns {Span[]} All spans in the trace
   */
  getSpans() {
    return Array.from(this.#spans.values());
  }

  /**
   * Gets the currently active span
   *
   * @returns {Span|null} The active span or null
   */
  getActiveSpan() {
    return this.#activeSpan;
  }

  // ==========================================
  // Analysis tools - lazy initialization
  // ==========================================

  /**
   * Sets the trace configuration
   *
   * @param {TraceConfigurationFile} config - The trace configuration
   */
  setTraceConfiguration(config) {
    this.#traceConfig = config;
  }

  /**
   * Gets the trace analyzer instance (lazy initialization)
   *
   * @returns {Promise<import('./traceAnalyzer.js').default|null>} The analyzer or null if disabled
   */
  async getAnalyzer() {
    if (!this.#traceConfig.traceAnalysisEnabled) {
      return null;
    }

    if (!this.#traceConfig.analysis?.enabled) {
      return null;
    }

    if (!this.#analyzer) {
      // Lazy load the analyzer
      // Dynamic import to avoid loading unless needed
      return import('./traceAnalyzer.js').then(({ default: TraceAnalyzer }) => {
        this.#analyzer = new TraceAnalyzer(this);
        return this.#analyzer;
      });
    }

    return this.#analyzer;
  }

  /**
   * Gets the trace visualizer instance (lazy initialization)
   *
   * @returns {Promise<import('./traceVisualizer.js').default|null>} The visualizer or null if disabled
   */
  async getVisualizer() {
    if (!this.#traceConfig.traceAnalysisEnabled) {
      return null;
    }

    if (!this.#traceConfig.visualization?.enabled) {
      return null;
    }

    if (!this.#visualizer) {
      // Lazy load the visualizer
      // Dynamic import to avoid loading unless needed
      return import('./traceVisualizer.js').then(
        ({ default: TraceVisualizer }) => {
          this.#visualizer = new TraceVisualizer(this);
          return this.#visualizer;
        }
      );
    }

    return this.#visualizer;
  }

  /**
   * Gets the performance monitor instance (lazy initialization)
   *
   * @returns {Promise<import('./performanceMonitor.js').default|null>} The monitor or null if disabled
   */
  async getPerformanceMonitor() {
    if (!this.#traceConfig.traceAnalysisEnabled) {
      return null;
    }

    if (!this.#traceConfig.performanceMonitoring?.enabled) {
      return null;
    }

    if (!this.#performanceMonitor) {
      // Lazy load the performance monitor
      // Dynamic import to avoid loading unless needed
      return import('./performanceMonitor.js').then(
        ({ default: PerformanceMonitor }) => {
          const thresholds =
            this.#traceConfig.performanceMonitoring.thresholds || {};
          this.#performanceMonitor = new PerformanceMonitor(this, thresholds);

          // Apply sampling configuration if present
          if (this.#traceConfig.performanceMonitoring.sampling) {
            this.#performanceMonitor.enableSampling(
              this.#traceConfig.performanceMonitoring.sampling
            );
          }

          return this.#performanceMonitor;
        }
      );
    }

    return this.#performanceMonitor;
  }

  /**
   * Checks if trace analysis is enabled
   *
   * @returns {boolean} Whether trace analysis is enabled
   */
  isTraceAnalysisEnabled() {
    return this.#traceConfig.traceAnalysisEnabled === true;
  }
}

export default StructuredTrace;
