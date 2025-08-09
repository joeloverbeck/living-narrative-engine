# ACTTRA-021: Implement Execution Timing Capture

## Summary

Implement high-precision timing measurement capabilities for action execution tracing, providing accurate performance metrics and duration calculations for each phase of action processing. This system will capture timing data at critical points during action execution, calculate durations between phases, and provide performance analysis capabilities to identify bottlenecks and optimize system performance.

## Status

- **Type**: Implementation
- **Priority**: Medium
- **Complexity**: Low
- **Estimated Time**: 1 hour
- **Dependencies**: ACTTRA-019 (ActionExecutionTrace), ACTTRA-020 (CommandProcessor integration)

## Objectives

### Primary Goals

1. **High-Precision Timing** - Use the most accurate timing mechanism available (performance.now() or equivalent)
2. **Phase-Based Measurements** - Capture timing for each distinct execution phase
3. **Duration Calculations** - Provide accurate duration metrics between timing points
4. **Performance Analysis** - Enable performance profiling and bottleneck identification
5. **Cross-Platform Compatibility** - Work consistently across different JavaScript environments
6. **Minimal Overhead** - Timing capture should add <0.1ms to execution time

### Success Criteria

- [ ] Timing precision better than 1ms accuracy using performance.now() where available
- [ ] All execution phases have start/end timing markers
- [ ] Duration calculations are accurate and account for async operations
- [ ] Performance data is included in trace output with human-readable format
- [ ] System handles timing edge cases (clock adjustments, leap seconds, etc.)
- [ ] Cross-browser and Node.js compatibility maintained
- [ ] Timing overhead is measurable and minimal (<0.1ms per trace)

## Technical Specification

### 1. High-Precision Timer Service

#### File: `src/actions/tracing/highPrecisionTimer.js`

```javascript
/**
 * @file High-precision timing service for action execution tracing
 * Provides consistent, accurate timing across different JavaScript environments
 */

/**
 * High-precision timer service
 * Abstracts timing implementation details and provides consistent API
 */
export class HighPrecisionTimer {
  #performanceAPIAvailable;
  #baseTimestamp;
  #hrTimeAvailable;

  constructor() {
    // Detect available timing APIs
    this.#performanceAPIAvailable =
      typeof performance !== 'undefined' && performance.now;
    this.#hrTimeAvailable = typeof process !== 'undefined' && process.hrtime;

    // Initialize base timestamp for relative measurements
    this.#baseTimestamp = this.#performanceAPIAvailable
      ? performance.now()
      : Date.now();

    // Log timing capabilities
    this.#logTimingCapabilities();
  }

  /**
   * Get current high-precision timestamp
   * @returns {number} Timestamp in milliseconds with sub-millisecond precision
   */
  now() {
    if (this.#performanceAPIAvailable) {
      // Browser or Node.js with performance API
      return performance.now();
    } else if (this.#hrTimeAvailable) {
      // Node.js with process.hrtime
      const [seconds, nanoseconds] = process.hrtime();
      return seconds * 1000 + nanoseconds / 1000000;
    } else {
      // Fallback to Date.now() (lower precision)
      return Date.now() - this.#baseTimestamp;
    }
  }

  /**
   * Measure duration of a synchronous function
   * @param {Function} fn - Function to measure
   * @returns {Object} Result and timing information
   */
  measure(fn) {
    const startTime = this.now();

    try {
      const result = fn();
      const endTime = this.now();

      return {
        result,
        duration: endTime - startTime,
        startTime,
        endTime,
        success: true,
      };
    } catch (error) {
      const endTime = this.now();

      return {
        result: null,
        duration: endTime - startTime,
        startTime,
        endTime,
        success: false,
        error,
      };
    }
  }

  /**
   * Measure duration of an async function
   * @param {Function} asyncFn - Async function to measure
   * @returns {Promise<Object>} Result and timing information
   */
  async measureAsync(asyncFn) {
    const startTime = this.now();

    try {
      const result = await asyncFn();
      const endTime = this.now();

      return {
        result,
        duration: endTime - startTime,
        startTime,
        endTime,
        success: true,
      };
    } catch (error) {
      const endTime = this.now();

      return {
        result: null,
        duration: endTime - startTime,
        startTime,
        endTime,
        success: false,
        error,
      };
    }
  }

  /**
   * Create a timing marker for later duration calculation
   * @param {string} label - Label for the timing marker
   * @returns {Object} Timing marker object
   */
  createMarker(label) {
    return {
      label,
      timestamp: this.now(),
      id: `${label}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Calculate duration between two timing markers
   * @param {Object} startMarker - Start timing marker
   * @param {Object} endMarker - End timing marker
   * @returns {Object} Duration information
   */
  calculateDuration(startMarker, endMarker) {
    if (!startMarker || !endMarker) {
      throw new Error('Both start and end markers are required');
    }

    const duration = endMarker.timestamp - startMarker.timestamp;

    return {
      duration,
      startMarker,
      endMarker,
      label: `${startMarker.label} → ${endMarker.label}`,
      humanReadable: this.formatDuration(duration),
    };
  }

  /**
   * Format duration in human-readable format
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted duration string
   */
  formatDuration(durationMs) {
    if (durationMs < 1) {
      return `${(durationMs * 1000).toFixed(1)}μs`;
    } else if (durationMs < 1000) {
      return `${durationMs.toFixed(2)}ms`;
    } else if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Get timing precision information
   * @returns {Object} Timing precision details
   */
  getPrecisionInfo() {
    return {
      api: this.#getTimingAPI(),
      resolution: this.#getTimingResolution(),
      baseline: this.#measureBaseline(),
    };
  }

  /**
   * Check if high-precision timing is available
   * @returns {boolean} True if high-precision timing is available
   */
  isHighPrecisionAvailable() {
    return this.#performanceAPIAvailable || this.#hrTimeAvailable;
  }

  /**
   * Get timing API being used
   * @private
   * @returns {string} Name of timing API
   */
  #getTimingAPI() {
    if (this.#performanceAPIAvailable) {
      return 'performance.now()';
    } else if (this.#hrTimeAvailable) {
      return 'process.hrtime()';
    } else {
      return 'Date.now()';
    }
  }

  /**
   * Estimate timing resolution
   * @private
   * @returns {number} Estimated resolution in milliseconds
   */
  #getTimingResolution() {
    if (this.#performanceAPIAvailable) {
      return 0.001; // 1 microsecond
    } else if (this.#hrTimeAvailable) {
      return 0.000001; // 1 nanosecond
    } else {
      return 1; // 1 millisecond
    }
  }

  /**
   * Measure baseline timing overhead
   * @private
   * @returns {number} Baseline overhead in milliseconds
   */
  #measureBaseline() {
    const iterations = 1000;
    const startTime = this.now();

    for (let i = 0; i < iterations; i++) {
      this.now();
    }

    const totalTime = this.now() - startTime;
    return totalTime / iterations;
  }

  /**
   * Log timing capabilities at initialization
   * @private
   */
  #logTimingCapabilities() {
    const api = this.#getTimingAPI();
    const resolution = this.#getTimingResolution();

    if (typeof console !== 'undefined' && console.debug) {
      console.debug(
        `HighPrecisionTimer: Using ${api} with ${resolution * 1000}μs resolution`
      );
    }
  }
}

// Create singleton instance
export const highPrecisionTimer = new HighPrecisionTimer();
```

### 2. Execution Phase Timer

#### File: `src/actions/tracing/executionPhaseTimer.js`

```javascript
/**
 * @file Execution phase timing for action tracing
 * Tracks timing information for different phases of action execution
 */

import { highPrecisionTimer } from './highPrecisionTimer.js';

/**
 * Execution phase timer for tracking action execution performance
 * Integrates with ActionExecutionTrace to provide timing data
 */
export class ExecutionPhaseTimer {
  #phases;
  #markers;
  #startTime;
  #endTime;
  #activePhase;

  constructor() {
    this.#phases = new Map();
    this.#markers = new Map();
    this.#startTime = null;
    this.#endTime = null;
    this.#activePhase = null;
  }

  /**
   * Start timing the overall execution
   * @param {string} label - Execution label
   */
  startExecution(label = 'execution') {
    if (this.#startTime !== null) {
      throw new Error('Execution timing already started');
    }

    this.#startTime = highPrecisionTimer.now();
    this.#markers.set('execution_start', {
      label: 'execution_start',
      timestamp: this.#startTime,
      phase: label,
    });
  }

  /**
   * Start timing a specific phase
   * @param {string} phaseName - Name of the phase
   * @param {Object} [metadata] - Additional phase metadata
   */
  startPhase(phaseName, metadata = {}) {
    if (this.#startTime === null) {
      throw new Error('Must start execution before starting phases');
    }

    // End previous phase if active
    if (this.#activePhase) {
      this.endPhase(this.#activePhase);
    }

    const timestamp = highPrecisionTimer.now();
    const marker = {
      label: `${phaseName}_start`,
      timestamp,
      phase: phaseName,
      metadata,
    };

    this.#markers.set(`${phaseName}_start`, marker);
    this.#activePhase = phaseName;

    // Initialize phase data
    if (!this.#phases.has(phaseName)) {
      this.#phases.set(phaseName, {
        name: phaseName,
        startTime: timestamp,
        endTime: null,
        duration: null,
        metadata,
        markers: [],
      });
    }

    this.#phases.get(phaseName).markers.push(marker);
  }

  /**
   * End timing for a specific phase
   * @param {string} phaseName - Name of the phase to end
   */
  endPhase(phaseName) {
    const phaseData = this.#phases.get(phaseName);
    if (!phaseData) {
      throw new Error(`Phase '${phaseName}' was not started`);
    }

    if (phaseData.endTime !== null) {
      throw new Error(`Phase '${phaseName}' already ended`);
    }

    const timestamp = highPrecisionTimer.now();
    const endMarker = {
      label: `${phaseName}_end`,
      timestamp,
      phase: phaseName,
    };

    this.#markers.set(`${phaseName}_end`, endMarker);

    // Update phase data
    phaseData.endTime = timestamp;
    phaseData.duration = timestamp - phaseData.startTime;
    phaseData.markers.push(endMarker);

    // Clear active phase if this was it
    if (this.#activePhase === phaseName) {
      this.#activePhase = null;
    }
  }

  /**
   * Add a timing marker within a phase
   * @param {string} markerName - Name of the marker
   * @param {string} [phaseName] - Phase to associate with (current active phase if not specified)
   * @param {Object} [metadata] - Additional marker metadata
   */
  addMarker(markerName, phaseName = null, metadata = {}) {
    const targetPhase = phaseName || this.#activePhase;

    if (!targetPhase) {
      throw new Error('No active phase and no phase specified for marker');
    }

    const timestamp = highPrecisionTimer.now();
    const marker = {
      label: markerName,
      timestamp,
      phase: targetPhase,
      metadata,
    };

    this.#markers.set(markerName, marker);

    // Add marker to phase data
    const phaseData = this.#phases.get(targetPhase);
    if (phaseData) {
      phaseData.markers.push(marker);
    }
  }

  /**
   * End overall execution timing
   * @param {Object} [metadata] - Additional execution metadata
   */
  endExecution(metadata = {}) {
    if (this.#startTime === null) {
      throw new Error('Execution timing was not started');
    }

    if (this.#endTime !== null) {
      throw new Error('Execution timing already ended');
    }

    // End any active phase
    if (this.#activePhase) {
      this.endPhase(this.#activePhase);
    }

    this.#endTime = highPrecisionTimer.now();
    this.#markers.set('execution_end', {
      label: 'execution_end',
      timestamp: this.#endTime,
      phase: 'execution',
      metadata,
    });
  }

  /**
   * Get timing data for a specific phase
   * @param {string} phaseName - Name of the phase
   * @returns {Object|null} Phase timing data or null if not found
   */
  getPhaseData(phaseName) {
    const phaseData = this.#phases.get(phaseName);
    if (!phaseData) {
      return null;
    }

    return {
      ...phaseData,
      humanReadable: phaseData.duration
        ? highPrecisionTimer.formatDuration(phaseData.duration)
        : null,
    };
  }

  /**
   * Get timing data for all phases
   * @returns {Array<Object>} Array of phase timing data
   */
  getAllPhases() {
    return Array.from(this.#phases.values()).map((phase) => ({
      ...phase,
      humanReadable: phase.duration
        ? highPrecisionTimer.formatDuration(phase.duration)
        : null,
    }));
  }

  /**
   * Get total execution duration
   * @returns {number|null} Total duration in milliseconds or null if not complete
   */
  getTotalDuration() {
    if (this.#startTime === null || this.#endTime === null) {
      return null;
    }

    return this.#endTime - this.#startTime;
  }

  /**
   * Get execution timing summary
   * @returns {Object} Summary of execution timing
   */
  getSummary() {
    const totalDuration = this.getTotalDuration();
    const phases = this.getAllPhases();

    return {
      totalDuration,
      totalHumanReadable: totalDuration
        ? highPrecisionTimer.formatDuration(totalDuration)
        : null,
      startTime: this.#startTime,
      endTime: this.#endTime,
      phaseCount: phases.length,
      phases: phases.map((phase) => ({
        name: phase.name,
        duration: phase.duration,
        humanReadable: phase.humanReadable,
        percentage: totalDuration
          ? (((phase.duration || 0) / totalDuration) * 100).toFixed(1) + '%'
          : null,
      })),
      markerCount: this.#markers.size,
      isComplete: this.#endTime !== null,
    };
  }

  /**
   * Export timing data for trace serialization
   * @returns {Object} Serializable timing data
   */
  exportTimingData() {
    return {
      summary: this.getSummary(),
      phases: Object.fromEntries(
        Array.from(this.#phases.entries()).map(([name, data]) => [
          name,
          {
            name: data.name,
            startTime: data.startTime,
            endTime: data.endTime,
            duration: data.duration,
            metadata: data.metadata,
            markerCount: data.markers.length,
          },
        ])
      ),
      markers: Object.fromEntries(
        Array.from(this.#markers.entries()).map(([name, marker]) => [
          name,
          {
            label: marker.label,
            timestamp: marker.timestamp,
            phase: marker.phase,
            metadata: marker.metadata || {},
          },
        ])
      ),
      precision: highPrecisionTimer.getPrecisionInfo(),
    };
  }

  /**
   * Reset all timing data
   */
  reset() {
    this.#phases.clear();
    this.#markers.clear();
    this.#startTime = null;
    this.#endTime = null;
    this.#activePhase = null;
  }

  /**
   * Check if execution timing is in progress
   * @returns {boolean} True if timing is active
   */
  isActive() {
    return this.#startTime !== null && this.#endTime === null;
  }

  /**
   * Create performance report
   * @returns {string} Human-readable performance report
   */
  createReport() {
    const summary = this.getSummary();

    if (!summary.isComplete) {
      return 'Execution timing not complete';
    }

    const lines = [
      'EXECUTION TIMING REPORT',
      '='.repeat(25),
      `Total Duration: ${summary.totalHumanReadable}`,
      `Phases: ${summary.phaseCount}`,
      `Markers: ${summary.markerCount}`,
      '',
      'Phase Breakdown:',
      '-'.repeat(15),
    ];

    summary.phases.forEach((phase) => {
      lines.push(
        `${phase.name.padEnd(20)} ${phase.humanReadable.padStart(8)} (${phase.percentage})`
      );
    });

    return lines.join('\n');
  }
}
```

### 3. ActionExecutionTrace Timing Integration

#### File: `src/actions/tracing/actionExecutionTrace.js` (Enhanced)

```javascript
// Add to existing ActionExecutionTrace class

import { ExecutionPhaseTimer } from './executionPhaseTimer.js';

/**
 * Enhanced ActionExecutionTrace with precise timing capabilities
 */
export class ActionExecutionTrace {
  // ... existing fields ...
  #phaseTimer;
  #timingEnabled;

  constructor({ actionId, actorId, turnAction, enableTiming = true }) {
    // ... existing constructor code ...

    this.#timingEnabled = enableTiming;
    if (this.#timingEnabled) {
      this.#phaseTimer = new ExecutionPhaseTimer();
    }
  }

  /**
   * Enhanced dispatch start with timing
   */
  captureDispatchStart() {
    if (this.#startTime !== null) {
      throw new Error('Dispatch already started for this trace');
    }

    this.#startTime = this.#getHighPrecisionTime();
    this.#executionData.startTime = this.#startTime;

    // Start execution timing
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.startExecution('action_dispatch');
      this.#phaseTimer.startPhase('initialization', {
        actionId: this.#actionId,
        actorId: this.#actorId,
      });
    }

    this.#executionData.phases.push({
      phase: 'dispatch_start',
      timestamp: this.#startTime,
      description: 'Action dispatch initiated',
    });
  }

  /**
   * Enhanced payload capture with phase timing
   */
  captureEventPayload(payload) {
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing payload'
      );
    }
    if (this.#endTime !== null) {
      throw new Error('Cannot capture payload after dispatch has ended');
    }

    // End initialization phase, start payload phase
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.endPhase('initialization');
      this.#phaseTimer.startPhase('payload_creation', {
        payloadSize: this.#calculatePayloadSize(payload),
      });
    }

    this.#executionData.eventPayload = this.#sanitizePayload(payload);

    const timestamp = this.#getHighPrecisionTime();
    this.#executionData.phases.push({
      phase: 'payload_captured',
      timestamp,
      description: 'Event payload captured',
      payloadSize: this.#calculatePayloadSize(payload),
    });

    // Add timing marker
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.addMarker('payload_sanitized');
    }
  }

  /**
   * Enhanced dispatch result with timing
   */
  captureDispatchResult(result) {
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing result'
      );
    }
    if (this.#endTime !== null) {
      throw new Error('Dispatch result already captured');
    }

    this.#endTime = this.#getHighPrecisionTime();
    this.#executionData.endTime = this.#endTime;
    this.#executionData.duration = this.#endTime - this.#startTime;

    // End payload phase, start completion phase
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.endPhase('payload_creation');
      this.#phaseTimer.startPhase('completion', {
        success: Boolean(result.success),
      });
    }

    this.#executionData.dispatchResult = {
      success: Boolean(result.success),
      timestamp: result.timestamp || this.#endTime,
      metadata: result.metadata || null,
    };

    this.#executionData.phases.push({
      phase: 'dispatch_completed',
      timestamp: this.#endTime,
      description: result.success ? 'Dispatch succeeded' : 'Dispatch failed',
      success: result.success,
    });

    // Complete timing
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.endPhase('completion');
      this.#phaseTimer.endExecution({
        success: result.success,
        actionId: this.#actionId,
      });
    }
  }

  /**
   * Enhanced error capture with timing
   */
  captureError(error) {
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing error'
      );
    }

    const errorTime = this.#getHighPrecisionTime();

    if (this.#endTime === null) {
      this.#endTime = errorTime;
      this.#executionData.endTime = this.#endTime;
      this.#executionData.duration = this.#endTime - this.#startTime;
    }

    // Handle timing for error case
    if (this.#timingEnabled && this.#phaseTimer) {
      // End any active phase
      if (this.#phaseTimer.isActive()) {
        this.#phaseTimer.addMarker('error_occurred', null, {
          errorType: error.constructor.name,
          errorMessage: error.message,
        });
      }

      // End execution with error
      if (this.#endTime === errorTime) {
        this.#phaseTimer.endExecution({
          success: false,
          error: error.constructor.name,
        });
      }
    }

    this.#executionData.error = {
      message: error.message || 'Unknown error',
      type: error.constructor.name || 'Error',
      stack: error.stack || null,
      timestamp: errorTime,
      code: error.code || null,
      cause: error.cause || null,
    };

    this.#executionData.phases.push({
      phase: 'error_captured',
      timestamp: errorTime,
      description: `Error occurred: ${error.message}`,
      errorType: error.constructor.name,
    });
  }

  /**
   * Enhanced JSON export with timing data
   */
  toJSON() {
    const baseData = {
      metadata: {
        actionId: this.#actionId,
        actorId: this.#actorId,
        traceType: 'execution',
        createdAt: new Date().toISOString(),
        version: '1.0',
      },
      turnAction: {
        actionDefinitionId: this.#turnAction.actionDefinitionId,
        commandString: this.#turnAction.commandString,
        parameters: this.#turnAction.parameters || {},
      },
      execution: {
        startTime: this.#executionData.startTime,
        endTime: this.#executionData.endTime,
        duration: this.#executionData.duration,
        status: this.#getExecutionStatus(),
        phases: this.#executionData.phases,
      },
      eventPayload: this.#executionData.eventPayload,
      result: this.#executionData.dispatchResult,
      error: this.#executionData.error,
    };

    // Add timing data if available
    if (this.#timingEnabled && this.#phaseTimer) {
      baseData.timing = this.#phaseTimer.exportTimingData();
    }

    return baseData;
  }

  /**
   * Get detailed performance report
   * @returns {string} Human-readable performance report
   */
  getPerformanceReport() {
    if (!this.#timingEnabled || !this.#phaseTimer) {
      return 'Timing not enabled for this trace';
    }

    return this.#phaseTimer.createReport();
  }

  /**
   * Get timing summary
   * @returns {Object|null} Timing summary or null if timing disabled
   */
  getTimingSummary() {
    if (!this.#timingEnabled || !this.#phaseTimer) {
      return null;
    }

    return this.#phaseTimer.getSummary();
  }

  // ... rest of existing methods remain the same ...
}
```

### 4. Performance Analysis Utilities

#### File: `src/actions/tracing/performanceAnalyzer.js`

```javascript
/**
 * @file Performance analysis utilities for action execution traces
 */

import { highPrecisionTimer } from './highPrecisionTimer.js';

/**
 * Performance analyzer for action execution traces
 * Provides statistical analysis and performance insights
 */
export class PerformanceAnalyzer {
  #traces;
  #stats;

  constructor() {
    this.#traces = [];
    this.#stats = {
      totalTraces: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      phaseStats: new Map(),
    };
  }

  /**
   * Add trace for analysis
   * @param {ActionExecutionTrace} trace - Trace to analyze
   */
  addTrace(trace) {
    if (!trace.isComplete) {
      return; // Skip incomplete traces
    }

    const timingData = trace.getTimingSummary();
    if (!timingData) {
      return; // Skip traces without timing data
    }

    this.#traces.push({
      actionId: trace.actionId,
      actorId: trace.actorId,
      duration: timingData.totalDuration,
      phases: timingData.phases,
      timestamp: Date.now(),
    });

    this.#updateStats();
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getStats() {
    return {
      ...this.#stats,
      percentiles: this.#calculatePercentiles(),
      phaseBreakdown: this.#getPhaseBreakdown(),
    };
  }

  /**
   * Identify slow traces
   * @param {number} threshold - Threshold in milliseconds
   * @returns {Array} Slow traces
   */
  getSlowTraces(threshold = 100) {
    return this.#traces
      .filter((trace) => trace.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Identify performance bottlenecks
   * @returns {Array} Bottleneck analysis
   */
  identifyBottlenecks() {
    const phaseStats = this.#getPhaseBreakdown();

    return Object.entries(phaseStats)
      .map(([phase, stats]) => ({
        phase,
        averageDuration: stats.average,
        percentage: stats.percentage,
        bottleneckScore: stats.average * stats.count, // Simple scoring
      }))
      .sort((a, b) => b.bottleneckScore - a.bottleneckScore);
  }

  /**
   * Generate performance report
   * @returns {string} Human-readable performance report
   */
  generateReport() {
    const stats = this.getStats();
    const percentiles = stats.percentiles;
    const bottlenecks = this.identifyBottlenecks();

    const lines = [
      'ACTION EXECUTION PERFORMANCE REPORT',
      '='.repeat(35),
      `Total Traces: ${stats.totalTraces}`,
      `Average Duration: ${highPrecisionTimer.formatDuration(stats.averageDuration)}`,
      `Min Duration: ${highPrecisionTimer.formatDuration(stats.minDuration)}`,
      `Max Duration: ${highPrecisionTimer.formatDuration(stats.maxDuration)}`,
      '',
      'Percentiles:',
      `-----------`,
      `P50: ${highPrecisionTimer.formatDuration(percentiles.p50)}`,
      `P90: ${highPrecisionTimer.formatDuration(percentiles.p90)}`,
      `P95: ${highPrecisionTimer.formatDuration(percentiles.p95)}`,
      `P99: ${highPrecisionTimer.formatDuration(percentiles.p99)}`,
      '',
      'Top Bottlenecks:',
      '---------------',
    ];

    bottlenecks.slice(0, 5).forEach((bottleneck, index) => {
      lines.push(
        `${index + 1}. ${bottleneck.phase}: ${highPrecisionTimer.formatDuration(bottleneck.averageDuration)} (${bottleneck.percentage}%)`
      );
    });

    return lines.join('\n');
  }

  /**
   * Clear all analysis data
   */
  clear() {
    this.#traces = [];
    this.#stats = {
      totalTraces: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      phaseStats: new Map(),
    };
  }

  /**
   * Update statistics
   * @private
   */
  #updateStats() {
    this.#stats.totalTraces = this.#traces.length;
    this.#stats.totalDuration = this.#traces.reduce(
      (sum, trace) => sum + trace.duration,
      0
    );
    this.#stats.averageDuration =
      this.#stats.totalDuration / this.#stats.totalTraces;

    this.#stats.minDuration = Math.min(...this.#traces.map((t) => t.duration));
    this.#stats.maxDuration = Math.max(...this.#traces.map((t) => t.duration));

    this.#updatePhaseStats();
  }

  /**
   * Update phase statistics
   * @private
   */
  #updatePhaseStats() {
    this.#stats.phaseStats.clear();

    this.#traces.forEach((trace) => {
      trace.phases.forEach((phase) => {
        if (!this.#stats.phaseStats.has(phase.name)) {
          this.#stats.phaseStats.set(phase.name, {
            count: 0,
            totalDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
          });
        }

        const phaseStats = this.#stats.phaseStats.get(phase.name);
        phaseStats.count++;
        phaseStats.totalDuration += phase.duration || 0;
        phaseStats.minDuration = Math.min(
          phaseStats.minDuration,
          phase.duration || 0
        );
        phaseStats.maxDuration = Math.max(
          phaseStats.maxDuration,
          phase.duration || 0
        );
      });
    });
  }

  /**
   * Calculate percentiles
   * @private
   * @returns {Object} Percentile values
   */
  #calculatePercentiles() {
    if (this.#traces.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const durations = this.#traces.map((t) => t.duration).sort((a, b) => a - b);

    return {
      p50: this.#getPercentile(durations, 0.5),
      p90: this.#getPercentile(durations, 0.9),
      p95: this.#getPercentile(durations, 0.95),
      p99: this.#getPercentile(durations, 0.99),
    };
  }

  /**
   * Get percentile value
   * @private
   * @param {Array<number>} sortedArray - Sorted array of values
   * @param {number} percentile - Percentile (0-1)
   * @returns {number} Percentile value
   */
  #getPercentile(sortedArray, percentile) {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Get phase breakdown
   * @private
   * @returns {Object} Phase breakdown statistics
   */
  #getPhaseBreakdown() {
    const breakdown = {};

    this.#stats.phaseStats.forEach((stats, phaseName) => {
      breakdown[phaseName] = {
        count: stats.count,
        total: stats.totalDuration,
        average: stats.totalDuration / stats.count,
        min: stats.minDuration,
        max: stats.maxDuration,
        percentage: (
          (stats.totalDuration / this.#stats.totalDuration) *
          100
        ).toFixed(1),
      };
    });

    return breakdown;
  }
}
```

## Implementation Tasks

### Phase 1: Core Timing Infrastructure (30 minutes)

1. **Implement HighPrecisionTimer**
   - [ ] Create timing abstraction with performance.now() and process.hrtime support
   - [ ] Add fallback to Date.now() for compatibility
   - [ ] Implement duration formatting and precision detection
   - [ ] Add baseline measurement and capability detection

2. **Create ExecutionPhaseTimer**
   - [ ] Implement phase-based timing with start/end markers
   - [ ] Add marker support for detailed timing points
   - [ ] Create timing data export and summary generation
   - [ ] Add human-readable report generation

### Phase 2: Integration with ActionExecutionTrace (20 minutes)

1. **Enhance ActionExecutionTrace class**
   - [ ] Integrate ExecutionPhaseTimer into existing trace lifecycle
   - [ ] Add timing data to JSON export
   - [ ] Create performance report methods
   - [ ] Ensure backward compatibility with existing traces

2. **Add timing configuration**
   - [ ] Support for enabling/disabling timing per trace
   - [ ] Configuration options for timing precision
   - [ ] Performance optimization for disabled timing
   - [ ] Memory management for timing data

### Phase 3: Analysis and Reporting (10 minutes)

1. **Create PerformanceAnalyzer**
   - [ ] Implement statistical analysis for multiple traces
   - [ ] Add bottleneck identification
   - [ ] Create percentile calculations
   - [ ] Generate comprehensive performance reports

2. **Add timing utilities**
   - [ ] Cross-platform compatibility testing
   - [ ] Performance benchmark utilities
   - [ ] Timing overhead measurement
   - [ ] Edge case handling

## Code Examples

### Example 1: Basic Timing Usage

```javascript
// In ActionExecutionTrace
const trace = new ActionExecutionTrace({
  actionId: 'core:go',
  actorId: 'player-1',
  turnAction: { actionDefinitionId: 'core:go' },
  enableTiming: true, // Enable high-precision timing
});

trace.captureDispatchStart(); // Starts execution timing
// ... execution phases ...
trace.captureDispatchResult({ success: true }); // Ends execution timing

// Get timing information
const summary = trace.getTimingSummary();
console.log(`Total duration: ${summary.totalHumanReadable}`);
console.log(`Phases: ${summary.phases.length}`);
```

### Example 2: Performance Analysis

```javascript
// Analyze multiple traces
const analyzer = new PerformanceAnalyzer();

// Add traces as they complete
traces.forEach((trace) => analyzer.addTrace(trace));

// Get performance insights
const stats = analyzer.getStats();
console.log(`Average execution time: ${stats.averageDuration}ms`);

// Identify bottlenecks
const bottlenecks = analyzer.identifyBottlenecks();
bottlenecks.forEach((bottleneck) => {
  console.log(`${bottleneck.phase}: ${bottleneck.averageDuration}ms`);
});

// Generate report
console.log(analyzer.generateReport());
```

### Example 3: Custom Phase Timing

```javascript
// Manual phase timing
const phaseTimer = new ExecutionPhaseTimer();

phaseTimer.startExecution('custom_operation');
phaseTimer.startPhase('validation');
// ... validation logic ...
phaseTimer.endPhase('validation');

phaseTimer.startPhase('processing');
phaseTimer.addMarker('data_loaded');
// ... processing logic ...
phaseTimer.addMarker('data_processed');
phaseTimer.endPhase('processing');

phaseTimer.endExecution();

// Get results
console.log(phaseTimer.createReport());
```

## Testing Requirements

### Unit Tests

#### File: `tests/unit/actions/tracing/highPrecisionTimer.unit.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { HighPrecisionTimer } from '../../../../src/actions/tracing/highPrecisionTimer.js';

describe('HighPrecisionTimer', () => {
  let timer;

  beforeEach(() => {
    timer = new HighPrecisionTimer();
  });

  describe('Timing Accuracy', () => {
    it('should provide timestamps with sub-millisecond precision when available', () => {
      const time1 = timer.now();
      const time2 = timer.now();

      expect(time2).toBeGreaterThan(time1);
      expect(time2 - time1).toBeLessThan(1); // Should be very fast
    });

    it('should measure synchronous function duration', () => {
      const result = timer.measure(() => {
        // Small workload
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.result).toBe(499500); // Sum of 0-999
    });

    it('should measure async function duration', async () => {
      const result = await timer.measureAsync(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'completed';
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(10);
      expect(result.result).toBe('completed');
    });
  });

  describe('Markers and Duration Calculation', () => {
    it('should create timing markers', () => {
      const marker1 = timer.createMarker('start');
      const marker2 = timer.createMarker('end');

      expect(marker1.label).toBe('start');
      expect(marker2.label).toBe('end');
      expect(marker2.timestamp).toBeGreaterThan(marker1.timestamp);
      expect(marker1.id).toBeTruthy();
      expect(marker2.id).toBeTruthy();
      expect(marker1.id).not.toBe(marker2.id);
    });

    it('should calculate duration between markers', () => {
      const start = timer.createMarker('operation_start');

      // Small delay
      let sum = 0;
      for (let i = 0; i < 10000; i++) {
        sum += i;
      }

      const end = timer.createMarker('operation_end');
      const duration = timer.calculateDuration(start, end);

      expect(duration.duration).toBeGreaterThan(0);
      expect(duration.startMarker).toBe(start);
      expect(duration.endMarker).toBe(end);
      expect(duration.label).toBe('operation_start → operation_end');
      expect(duration.humanReadable).toBeTruthy();
    });
  });

  describe('Duration Formatting', () => {
    it('should format microseconds', () => {
      expect(timer.formatDuration(0.5)).toBe('500.0μs');
    });

    it('should format milliseconds', () => {
      expect(timer.formatDuration(5.123)).toBe('5.12ms');
    });

    it('should format seconds', () => {
      expect(timer.formatDuration(1500)).toBe('1.50s');
    });

    it('should format minutes', () => {
      expect(timer.formatDuration(125000)).toBe('2m 5.00s');
    });
  });

  describe('Precision Information', () => {
    it('should provide timing precision info', () => {
      const info = timer.getPrecisionInfo();

      expect(info).toHaveProperty('api');
      expect(info).toHaveProperty('resolution');
      expect(info).toHaveProperty('baseline');
      expect(info.resolution).toBeGreaterThan(0);
      expect(info.baseline).toBeGreaterThan(0);
    });

    it('should detect high-precision availability', () => {
      const isAvailable = timer.isHighPrecisionAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });
  });
});
```

#### File: `tests/unit/actions/tracing/executionPhaseTimer.unit.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ExecutionPhaseTimer } from '../../../../src/actions/tracing/executionPhaseTimer.js';

describe('ExecutionPhaseTimer', () => {
  let timer;

  beforeEach(() => {
    timer = new ExecutionPhaseTimer();
  });

  describe('Execution Lifecycle', () => {
    it('should track complete execution lifecycle', () => {
      timer.startExecution('test_execution');
      expect(timer.isActive()).toBe(true);

      timer.startPhase('phase1');
      timer.endPhase('phase1');

      timer.startPhase('phase2');
      timer.addMarker('checkpoint1');
      timer.endPhase('phase2');

      timer.endExecution();
      expect(timer.isActive()).toBe(false);

      const summary = timer.getSummary();
      expect(summary.isComplete).toBe(true);
      expect(summary.phaseCount).toBe(2);
      expect(summary.totalDuration).toBeGreaterThan(0);
    });

    it('should handle phase transitions correctly', () => {
      timer.startExecution();

      timer.startPhase('phase1');
      timer.startPhase('phase2'); // Should auto-end phase1

      const phase1Data = timer.getPhaseData('phase1');
      const phase2Data = timer.getPhaseData('phase2');

      expect(phase1Data.endTime).toBeTruthy();
      expect(phase1Data.duration).toBeGreaterThan(0);
      expect(phase2Data.startTime).toBeTruthy();
      expect(phase2Data.endTime).toBeNull();
    });
  });

  describe('Phase Data Management', () => {
    it('should track phase metadata', () => {
      timer.startExecution();
      timer.startPhase('test_phase', {
        operation: 'database_query',
        complexity: 'high',
      });

      const phaseData = timer.getPhaseData('test_phase');
      expect(phaseData.metadata.operation).toBe('database_query');
      expect(phaseData.metadata.complexity).toBe('high');
    });

    it('should track markers within phases', () => {
      timer.startExecution();
      timer.startPhase('test_phase');
      timer.addMarker('checkpoint1', 'test_phase', { step: 'validation' });
      timer.addMarker('checkpoint2', 'test_phase', { step: 'processing' });
      timer.endPhase('test_phase');

      const phaseData = timer.getPhaseData('test_phase');
      expect(phaseData.markers.length).toBeGreaterThanOrEqual(3); // start, checkpoint1, checkpoint2, end

      const checkpointMarkers = phaseData.markers.filter(
        (m) => m.label === 'checkpoint1' || m.label === 'checkpoint2'
      );
      expect(checkpointMarkers.length).toBe(2);
    });
  });

  describe('Performance Analysis', () => {
    it('should generate performance summary', () => {
      timer.startExecution();
      timer.startPhase('fast_phase');
      timer.endPhase('fast_phase');

      timer.startPhase('slow_phase');
      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 100000; i++) {
        sum += i;
      }
      timer.endPhase('slow_phase');

      timer.endExecution();

      const summary = timer.getSummary();
      expect(summary.phases.length).toBe(2);

      const slowPhase = summary.phases.find((p) => p.name === 'slow_phase');
      const fastPhase = summary.phases.find((p) => p.name === 'fast_phase');

      expect(slowPhase.duration).toBeGreaterThan(fastPhase.duration);
      expect(slowPhase.percentage).toBeTruthy();
      expect(parseFloat(slowPhase.percentage)).toBeGreaterThan(0);
    });

    it('should create human-readable reports', () => {
      timer.startExecution();
      timer.startPhase('test_phase');
      timer.endPhase('test_phase');
      timer.endExecution();

      const report = timer.createReport();
      expect(report).toContain('EXECUTION TIMING REPORT');
      expect(report).toContain('Total Duration:');
      expect(report).toContain('test_phase');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when starting phase before execution', () => {
      expect(() => {
        timer.startPhase('invalid_phase');
      }).toThrow('Must start execution before starting phases');
    });

    it('should throw error when ending non-existent phase', () => {
      timer.startExecution();
      expect(() => {
        timer.endPhase('non_existent_phase');
      }).toThrow("Phase 'non_existent_phase' was not started");
    });

    it('should throw error when starting execution twice', () => {
      timer.startExecution();
      expect(() => {
        timer.startExecution();
      }).toThrow('Execution timing already started');
    });
  });
});
```

### Integration Tests

#### File: `tests/integration/actions/tracing/timingIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { PerformanceAnalyzer } from '../../../../src/actions/tracing/performanceAnalyzer.js';

describe('Timing Integration', () => {
  it('should capture complete timing data in ActionExecutionTrace', async () => {
    const trace = new ActionExecutionTrace({
      actionId: 'core:timing_test',
      actorId: 'player-1',
      turnAction: { actionDefinitionId: 'core:timing_test' },
      enableTiming: true,
    });

    // Simulate execution with realistic delays
    trace.captureDispatchStart();

    await new Promise((resolve) => setTimeout(resolve, 10));
    trace.captureEventPayload({ test: 'data' });

    await new Promise((resolve) => setTimeout(resolve, 20));
    trace.captureDispatchResult({ success: true });

    // Verify timing data
    expect(trace.duration).toBeGreaterThanOrEqual(30);

    const timingSummary = trace.getTimingSummary();
    expect(timingSummary).toBeTruthy();
    expect(timingSummary.totalDuration).toBeGreaterThanOrEqual(30);
    expect(timingSummary.phases.length).toBeGreaterThan(0);

    // Verify JSON export includes timing
    const jsonData = trace.toJSON();
    expect(jsonData.timing).toBeTruthy();
    expect(jsonData.timing.summary.totalDuration).toBeGreaterThanOrEqual(30);
  });

  it('should analyze performance across multiple traces', () => {
    const analyzer = new PerformanceAnalyzer();
    const traces = [];

    // Create multiple traces with different performance characteristics
    for (let i = 0; i < 10; i++) {
      const trace = new ActionExecutionTrace({
        actionId: `core:test_${i}`,
        actorId: 'player-1',
        turnAction: { actionDefinitionId: `core:test_${i}` },
        enableTiming: true,
      });

      trace.captureDispatchStart();

      // Simulate variable execution times
      const delay = 10 + i * 5; // 10ms to 55ms
      for (let j = 0; j < delay * 1000; j++) {
        // Busy wait to simulate work
      }

      trace.captureDispatchResult({ success: true });

      traces.push(trace);
      analyzer.addTrace(trace);
    }

    // Analyze performance
    const stats = analyzer.getStats();
    expect(stats.totalTraces).toBe(10);
    expect(stats.averageDuration).toBeGreaterThan(0);
    expect(stats.minDuration).toBeLessThan(stats.maxDuration);

    // Check percentiles
    const percentiles = stats.percentiles;
    expect(percentiles.p50).toBeLessThan(percentiles.p90);
    expect(percentiles.p90).toBeLessThan(percentiles.p95);
    expect(percentiles.p95).toBeLessThan(percentiles.p99);

    // Generate report
    const report = analyzer.generateReport();
    expect(report).toContain('ACTION EXECUTION PERFORMANCE REPORT');
    expect(report).toContain('Total Traces: 10');
  });
});
```

### Performance Tests

```javascript
describe('Timing Performance', () => {
  it('should have minimal overhead for timing operations', () => {
    const iterations = 1000;

    // Measure overhead of timing operations
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const timer = new ExecutionPhaseTimer();
      timer.startExecution();
      timer.startPhase('test');
      timer.addMarker('checkpoint');
      timer.endPhase('test');
      timer.endExecution();
    }

    const end = performance.now();
    const avgOverhead = (end - start) / iterations;

    // Overhead should be minimal
    expect(avgOverhead).toBeLessThan(0.1); // <0.1ms per timing operation
  });

  it('should scale with number of phases', () => {
    const phaseNumbers = [1, 5, 10, 20];
    const results = [];

    phaseNumbers.forEach((phaseCount) => {
      const start = performance.now();

      const timer = new ExecutionPhaseTimer();
      timer.startExecution();

      for (let i = 0; i < phaseCount; i++) {
        timer.startPhase(`phase_${i}`);
        timer.addMarker(`marker_${i}`);
        timer.endPhase(`phase_${i}`);
      }

      timer.endExecution();
      const end = performance.now();

      results.push({
        phases: phaseCount,
        duration: end - start,
      });
    });

    // Verify linear scaling (approximately)
    expect(results[3].duration).toBeLessThan(results[0].duration * 25); // Allow for some overhead
  });
});
```

## Integration Points

### 1. ActionExecutionTrace Integration

- Seamless integration with existing trace lifecycle
- Optional timing that doesn't break existing functionality
- Enhanced JSON export with timing data

### 2. CommandProcessor Integration

- Timing data captured automatically during action execution
- Zero overhead when timing is disabled
- Integration with existing performance monitoring

### 3. Performance Monitoring

- Real-time performance analysis capabilities
- Statistical analysis of execution patterns
- Bottleneck identification and reporting

## Error Handling

### Timer Initialization Errors

- Graceful fallback to lower-precision timing APIs
- Detection and reporting of timing capabilities
- Compatibility with different JavaScript environments

### Phase Management Errors

- Clear error messages for invalid phase operations
- State validation to prevent timing inconsistencies
- Recovery mechanisms for partial timing data

### Performance Analysis Errors

- Handling of incomplete or corrupted timing data
- Statistical calculations with missing data points
- Error reporting for analysis failures

## Security Considerations

1. **Timing Attacks** - Timing data could potentially be used for side-channel attacks
2. **Performance Impact** - Timing overhead must be minimal to prevent DOS
3. **Memory Usage** - Timing data storage must be bounded
4. **Data Sanitization** - Timing metadata may contain sensitive information

## Dependencies

### Internal Dependencies

- HighPrecisionTimer for consistent timing API
- ActionExecutionTrace for integration
- Existing validation and error handling utilities

### External Dependencies

- None (uses native JavaScript timing APIs)

## Risks and Mitigation

| Risk                                  | Probability | Impact | Mitigation                                   |
| ------------------------------------- | ----------- | ------ | -------------------------------------------- |
| Performance overhead from timing      | Medium      | Low    | Minimal implementation, optional enablement  |
| Cross-platform timing inconsistencies | Low         | Medium | Multiple API fallbacks, capability detection |
| Memory usage from timing data         | Low         | Low    | Data size limits, cleanup mechanisms         |
| Timing precision limitations          | Low         | Low    | Best-effort timing with graceful degradation |

## Acceptance Criteria

- [ ] High-precision timing using performance.now() or equivalent
- [ ] Phase-based timing with accurate duration calculations
- [ ] Cross-platform compatibility (browser and Node.js)
- [ ] Minimal overhead (<0.1ms per timing operation)
- [ ] Integration with ActionExecutionTrace maintains backward compatibility
- [ ] Performance analysis capabilities for multiple traces
- [ ] Human-readable timing reports and summaries
- [ ] Comprehensive error handling for edge cases
- [ ] Unit tests achieve >95% coverage
- [ ] Performance tests validate overhead requirements

## Future Enhancements

1. **Real-time Performance Monitoring** - Live performance dashboards
2. **Automated Performance Alerts** - Alert on performance regressions
3. **Historical Performance Trends** - Long-term performance tracking
4. **Performance Profiling Integration** - Integration with browser dev tools
5. **Distributed Timing** - Support for distributed system timing

## Documentation Requirements

1. **Timing API Reference** - Complete documentation of timing classes
2. **Performance Analysis Guide** - How to analyze and interpret timing data
3. **Integration Guide** - How to add timing to existing systems
4. **Best Practices** - Performance optimization recommendations

## Definition of Done

- [ ] HighPrecisionTimer implemented with cross-platform support
- [ ] ExecutionPhaseTimer created with phase management
- [ ] ActionExecutionTrace enhanced with timing integration
- [ ] PerformanceAnalyzer created for statistical analysis
- [ ] Unit tests written and passing (>95% coverage)
- [ ] Integration tests verify end-to-end timing capture
- [ ] Performance tests validate minimal overhead
- [ ] Cross-platform compatibility verified
- [ ] Code reviewed and approved
- [ ] Documentation updated
