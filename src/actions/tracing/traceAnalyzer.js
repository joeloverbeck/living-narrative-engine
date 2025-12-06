/**
 * @file TraceAnalyzer class for analyzing structured traces
 * @see structuredTrace.js
 * @see analysisTypes.js
 */

import {
  validateDependency,
  assertPresent,
} from '../../utils/dependencyUtils.js';

/** @typedef {import('./analysisTypes.js').BottleneckInfo} BottleneckInfo */
/** @typedef {import('./analysisTypes.js').OperationStats} OperationStats */
/** @typedef {import('./analysisTypes.js').ErrorAnalysis} ErrorAnalysis */
/** @typedef {import('./analysisTypes.js').ConcurrencyProfile} ConcurrencyProfile */
/** @typedef {import('./analysisTypes.js').CriticalPathAnalysis} CriticalPathAnalysis */
/** @typedef {import('./tracingInterfaces.js').IStructuredTrace} IStructuredTrace */

/**
 * @class TraceAnalyzer
 * @description Provides advanced analysis capabilities for structured traces
 */
export class TraceAnalyzer {
  #structuredTrace;
  #cachedCriticalPath;
  #cachedOperationStats;
  #cachedErrorAnalysis;
  #cachedConcurrencyProfile;

  /**
   * Creates a new TraceAnalyzer instance
   *
   * @param {IStructuredTrace} structuredTrace - The structured trace to analyze
   * @throws {Error} If structuredTrace is not provided or invalid
   */
  constructor(structuredTrace) {
    validateDependency(structuredTrace, 'IStructuredTrace', null, {
      requiredMethods: ['getSpans', 'getHierarchicalView', 'getCriticalPath'],
    });

    this.#structuredTrace = structuredTrace;
    this.#clearCache();
  }

  /**
   * Clears all cached analysis results
   *
   * @private
   */
  #clearCache() {
    this.#cachedCriticalPath = null;
    this.#cachedOperationStats = null;
    this.#cachedErrorAnalysis = null;
    this.#cachedConcurrencyProfile = null;
  }

  /**
   * Gets the critical path analysis
   *
   * @returns {CriticalPathAnalysis} Detailed critical path information
   */
  getCriticalPath() {
    if (this.#cachedCriticalPath) {
      return this.#cachedCriticalPath;
    }

    const spans = this.#structuredTrace.getSpans();
    if (spans.length === 0) {
      return this.#createEmptyCriticalPath();
    }

    const rootSpan = spans.find((span) => span.parentId === null);
    if (!rootSpan) {
      return this.#createEmptyCriticalPath();
    }

    const criticalPathSpans = this.#findLongestPath(rootSpan, spans);
    const totalDuration = criticalPathSpans.reduce(
      (sum, span) => sum + (span.duration || 0),
      0
    );
    const traceTotalDuration = this.#getTotalTraceDuration(spans);
    const percentageOfTotal =
      traceTotalDuration > 0 ? (totalDuration / traceTotalDuration) * 100 : 0;

    const steps = criticalPathSpans.map((span, index) => {
      const cumulativeDuration = criticalPathSpans
        .slice(0, index + 1)
        .reduce((sum, s) => sum + (s.duration || 0), 0);

      return {
        operation: span.operation,
        duration: span.duration || 0,
        cumulativeDuration,
        percentageOfPath:
          totalDuration > 0 ? ((span.duration || 0) / totalDuration) * 100 : 0,
        attributes: span.attributes,
      };
    });

    // Identify bottleneck operations (top 3 longest operations on critical path)
    const bottleneckOperations = [...criticalPathSpans]
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 3)
      .map((span) => span.operation);

    this.#cachedCriticalPath = {
      operations: criticalPathSpans.map((span) => span.operation),
      totalDuration,
      percentageOfTotal,
      steps,
      bottleneckOperations,
    };

    return this.#cachedCriticalPath;
  }

  /**
   * Finds the longest execution path through the span tree
   *
   * @private
   * @param {import('./span.js').Span} span - Starting span
   * @param {import('./span.js').Span[]} allSpans - All spans in the trace
   * @returns {import('./span.js').Span[]} Spans on the longest path
   */
  #findLongestPath(span, allSpans) {
    const children = allSpans.filter((s) => s.parentId === span.id);

    if (children.length === 0) {
      return [span];
    }

    let longestChildPath = [];
    let longestChildDuration = 0;

    for (const child of children) {
      const childPath = this.#findLongestPath(child, allSpans);
      const childDuration = childPath.reduce(
        (sum, s) => sum + (s.duration || 0),
        0
      );

      if (childDuration > longestChildDuration) {
        longestChildDuration = childDuration;
        longestChildPath = childPath;
      }
    }

    return [span, ...longestChildPath];
  }

  /**
   * Creates an empty critical path analysis
   *
   * @private
   * @returns {CriticalPathAnalysis} Empty analysis
   */
  #createEmptyCriticalPath() {
    return {
      operations: [],
      totalDuration: 0,
      percentageOfTotal: 0,
      steps: [],
      bottleneckOperations: [],
    };
  }

  /**
   * Gets the total duration of the trace
   *
   * @private
   * @param {import('./span.js').Span[]} spans - All spans
   * @returns {number} Total trace duration
   */
  #getTotalTraceDuration(spans) {
    const rootSpan = spans.find((span) => span.parentId === null);
    return rootSpan ? rootSpan.duration || 0 : 0;
  }

  /**
   * Identifies performance bottlenecks
   *
   * @param {number} [thresholdMs] - Duration threshold in milliseconds
   * @returns {BottleneckInfo[]} Array of bottleneck information
   */
  getBottlenecks(thresholdMs = 100) {
    assertPresent(thresholdMs, 'Threshold is required');

    if (typeof thresholdMs !== 'number' || thresholdMs < 0) {
      throw new Error('Threshold must be a non-negative number');
    }

    const spans = this.#structuredTrace.getSpans();
    const criticalPathOps = this.getCriticalPath().operations;
    const bottlenecks = [];

    for (const span of spans) {
      if (span.duration !== null && span.duration >= thresholdMs) {
        bottlenecks.push({
          operation: span.operation,
          duration: span.duration,
          spanId: span.id,
          attributes: span.attributes,
          depth: this.#calculateSpanDepth(span, spans),
          criticalPath: criticalPathOps.includes(span.operation) ? 'yes' : 'no',
        });
      }
    }

    // Sort by duration descending
    bottlenecks.sort((a, b) => b.duration - a.duration);

    return bottlenecks;
  }

  /**
   * Calculates the depth of a span in the hierarchy
   *
   * @private
   * @param {import('./span.js').Span} span - The span to calculate depth for
   * @param {import('./span.js').Span[]} allSpans - All spans in the trace
   * @returns {number} Depth level (0 for root)
   */
  #calculateSpanDepth(span, allSpans) {
    let depth = 0;
    let currentSpan = span;

    while (currentSpan.parentId !== null) {
      depth++;
      currentSpan = allSpans.find((s) => s.id === currentSpan.parentId);
      if (!currentSpan) break; // Safety check
    }

    return depth;
  }

  /**
   * Gets operation statistics
   *
   * @returns {OperationStats[]} Array of operation statistics
   */
  getOperationStats() {
    if (this.#cachedOperationStats) {
      return this.#cachedOperationStats;
    }

    const spans = this.#structuredTrace.getSpans();
    const statsMap = new Map();

    // Group spans by operation
    for (const span of spans) {
      if (!statsMap.has(span.operation)) {
        statsMap.set(span.operation, {
          operation: span.operation,
          spans: [],
          errorCount: 0,
        });
      }

      const stats = statsMap.get(span.operation);
      stats.spans.push(span);

      if (span.status === 'error') {
        stats.errorCount++;
      }
    }

    // Calculate statistics for each operation
    const operationStats = [];
    for (const [operation, data] of statsMap) {
      const completedSpans = data.spans.filter(
        (span) => span.duration !== null
      );
      const durations = completedSpans.map((span) => span.duration);

      if (durations.length === 0) {
        continue; // Skip operations with no completed spans
      }

      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      // Use reduce to avoid stack overflow with large arrays
      const minDuration = durations.reduce(
        (min, d) => Math.min(min, d),
        Infinity
      );
      const maxDuration = durations.reduce(
        (max, d) => Math.max(max, d),
        -Infinity
      );
      const averageDuration = totalDuration / durations.length;
      const errorRate = (data.errorCount / data.spans.length) * 100;

      operationStats.push({
        operation,
        count: data.spans.length,
        totalDuration,
        averageDuration,
        minDuration,
        maxDuration,
        errorCount: data.errorCount,
        errorRate,
      });
    }

    // Sort by total duration descending
    operationStats.sort((a, b) => b.totalDuration - a.totalDuration);

    this.#cachedOperationStats = operationStats;
    return operationStats;
  }

  /**
   * Analyzes error patterns in the trace
   *
   * @returns {ErrorAnalysis} Error analysis information
   */
  getErrorAnalysis() {
    if (this.#cachedErrorAnalysis) {
      return this.#cachedErrorAnalysis;
    }

    const spans = this.#structuredTrace.getSpans();
    const errorSpans = spans.filter((span) => span.status === 'error');
    const criticalPathOps = this.getCriticalPath().operations;

    const totalErrors = errorSpans.length;
    const totalOperations = spans.length;
    const overallErrorRate =
      totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    // Group errors by operation
    const errorsByOpMap = new Map();
    const operationCounts = new Map();

    for (const span of spans) {
      operationCounts.set(
        span.operation,
        (operationCounts.get(span.operation) || 0) + 1
      );

      if (span.status === 'error') {
        if (!errorsByOpMap.has(span.operation)) {
          errorsByOpMap.set(span.operation, {
            operation: span.operation,
            errorCount: 0,
            errorMessages: new Set(),
          });
        }

        const errorData = errorsByOpMap.get(span.operation);
        errorData.errorCount++;

        if (span.error) {
          errorData.errorMessages.add(span.error.message);
        }
      }
    }

    const errorsByOperation = Array.from(errorsByOpMap.values()).map(
      (data) => ({
        operation: data.operation,
        errorCount: data.errorCount,
        totalCount: operationCounts.get(data.operation) || 0,
        errorRate:
          (data.errorCount / (operationCounts.get(data.operation) || 1)) * 100,
        errorMessages: Array.from(data.errorMessages),
      })
    );

    // Group errors by error type
    const errorsByTypeMap = new Map();

    for (const span of errorSpans) {
      if (span.error) {
        const errorType = span.error.constructor.name;

        if (!errorsByTypeMap.has(errorType)) {
          errorsByTypeMap.set(errorType, {
            errorType,
            count: 0,
            operations: new Set(),
            sampleMessage: span.error.message,
          });
        }

        const typeData = errorsByTypeMap.get(errorType);
        typeData.count++;
        typeData.operations.add(span.operation);
      }
    }

    const errorsByType = Array.from(errorsByTypeMap.values()).map((data) => ({
      errorType: data.errorType,
      count: data.count,
      operations: Array.from(data.operations),
      sampleMessage: data.sampleMessage,
    }));

    // Find critical path errors
    const criticalPathErrors = errorSpans
      .filter((span) => criticalPathOps.includes(span.operation))
      .map((span) => span.operation);

    this.#cachedErrorAnalysis = {
      totalErrors,
      totalOperations,
      overallErrorRate,
      errorsByOperation,
      errorsByType,
      criticalPathErrors,
    };

    return this.#cachedErrorAnalysis;
  }

  /**
   * Analyzes concurrency patterns in the trace
   *
   * @returns {ConcurrencyProfile} Concurrency analysis information
   */
  getConcurrencyProfile() {
    if (this.#cachedConcurrencyProfile) {
      return this.#cachedConcurrencyProfile;
    }

    const spans = this.#structuredTrace
      .getSpans()
      .filter((span) => span.startTime !== undefined && span.endTime !== null);

    if (spans.length === 0) {
      return this.#createEmptyConcurrencyProfile();
    }

    // Create timeline events
    const events = [];
    for (const span of spans) {
      events.push({ time: span.startTime, type: 'start', span });
      events.push({ time: span.endTime, type: 'end', span });
    }

    // Sort events by time
    events.sort((a, b) => a.time - b.time);

    // Track concurrency over time
    const activeSpans = new Set();
    const concurrencyLevels = [];
    const concurrentPeriods = [];
    let currentPeriodStart = null;
    let currentConcurrency = 0;

    for (const event of events) {
      if (event.type === 'start') {
        activeSpans.add(event.span);
        currentConcurrency++;

        if (currentConcurrency > 1 && currentPeriodStart === null) {
          currentPeriodStart = event.time;
        }
      } else {
        activeSpans.delete(event.span);
        currentConcurrency--;

        if (currentConcurrency <= 1 && currentPeriodStart !== null) {
          concurrentPeriods.push({
            startTime: currentPeriodStart,
            endTime: event.time,
            concurrency: currentConcurrency + 1, // +1 because we just decremented
            operations: Array.from(activeSpans)
              .concat([event.span])
              .map((s) => s.operation),
          });
          currentPeriodStart = null;
        }
      }

      concurrencyLevels.push(currentConcurrency);
    }

    // Use reduce to avoid stack overflow with large arrays
    const maxConcurrency =
      concurrencyLevels.length > 0
        ? concurrencyLevels.reduce((max, level) => Math.max(max, level), 0)
        : 0;
    const averageConcurrency =
      concurrencyLevels.length > 0
        ? concurrencyLevels.reduce((sum, level) => sum + level, 0) /
          concurrencyLevels.length
        : 0;

    // Identify commonly parallel operations
    const parallelOperationPairs = new Map();
    for (const period of concurrentPeriods) {
      const operations = period.operations;
      for (let i = 0; i < operations.length; i++) {
        for (let j = i + 1; j < operations.length; j++) {
          const pair = [operations[i], operations[j]].sort().join('|');
          parallelOperationPairs.set(
            pair,
            (parallelOperationPairs.get(pair) || 0) + 1
          );
        }
      }
    }

    const parallelOperations = Array.from(parallelOperationPairs.keys());
    const serialOperationCount = spans.length - parallelOperations.length;
    const parallelOperationCount = parallelOperations.length;

    this.#cachedConcurrencyProfile = {
      maxConcurrency,
      averageConcurrency,
      concurrentPeriods,
      parallelOperations,
      serialOperationCount,
      parallelOperationCount,
    };

    return this.#cachedConcurrencyProfile;
  }

  /**
   * Creates an empty concurrency profile
   *
   * @private
   * @returns {ConcurrencyProfile} Empty profile
   */
  #createEmptyConcurrencyProfile() {
    return {
      maxConcurrency: 0,
      averageConcurrency: 0,
      concurrentPeriods: [],
      parallelOperations: [],
      serialOperationCount: 0,
      parallelOperationCount: 0,
    };
  }

  /**
   * Invalidates cached analysis results
   * Call this if the underlying trace has been modified
   */
  invalidateCache() {
    this.#clearCache();
  }

  /**
   * Gets a comprehensive analysis summary
   *
   * @returns {object} Combined analysis results
   */
  getComprehensiveAnalysis() {
    return {
      criticalPath: this.getCriticalPath(),
      bottlenecks: this.getBottlenecks(),
      operationStats: this.getOperationStats(),
      errorAnalysis: this.getErrorAnalysis(),
      concurrencyProfile: this.getConcurrencyProfile(),
    };
  }
}

export default TraceAnalyzer;
