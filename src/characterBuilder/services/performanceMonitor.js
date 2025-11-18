/**
 * @file PerformanceMonitor service for BaseCharacterBuilderController.
 * @description Provides shared performance mark/measure helpers plus alert dispatching.
 */

import { CHARACTER_BUILDER_EVENTS } from './characterBuilderService.js';

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

const globalPerformance =
  typeof performance !== 'undefined' && performance ? performance : null;

/**
 * @typedef {object} PerformanceMonitorDependencies
 * @property {ILogger} logger - Logger instance for diagnostics
 * @property {ISafeEventDispatcher} eventBus - Event bus for alerts
 * @property {number} [threshold=100] - Warning threshold in ms
 * @property {string} [contextName='BaseCharacterBuilderController'] - Context label for alerts
 * @property {Performance} [performanceRef] - Optional performance implementation override
 */

/**
 * @typedef {object} PerformanceMeasurement
 * @property {number} duration - Duration between marks in ms
 * @property {string} startMark - Start mark label
 * @property {string} endMark - End mark label
 * @property {number} timestamp - Creation timestamp
 * @property {string[]} tags - Reserved for future aggregated stats
 */

/**
 * @class PerformanceMonitor
 * @description Tracks marks/measurements and emits alerts when thresholds are exceeded.
 */
export class PerformanceMonitor {
  #logger;
  #eventBus;
  #threshold;
  #contextName;
  #performanceRef;
  #marks;
  #measurements;
  #statsListeners;

  /**
   * @param {PerformanceMonitorDependencies} dependencies - Required dependencies
   */
  constructor({
    logger,
    eventBus,
    threshold = 100,
    contextName = 'BaseCharacterBuilderController',
    performanceRef,
  }) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#threshold = typeof threshold === 'number' && threshold >= 0 ? threshold : 100;
    this.#contextName = contextName;
    this.#performanceRef = performanceRef ?? globalPerformance;
    this.#marks = new Map();
    this.#measurements = new Map();
    this.#statsListeners = new Set();
  }

  /**
   * Update runtime configuration for the monitor.
   *
   * @param {Partial<PerformanceMonitorDependencies>} config - Updated configuration.
   * @returns {void}
   */
  configure(config = {}) {
    if (typeof config.contextName === 'string' && config.contextName.trim()) {
      this.#contextName = config.contextName.trim();
    }

    if (config.eventBus) {
      this.#eventBus = config.eventBus;
    }

    if (typeof config.threshold === 'number' && config.threshold >= 0) {
      this.#threshold = config.threshold;
    }
  }

  /**
   * Record a performance mark.
   *
   * @param {string} markName - Unique mark identifier
   * @returns {number|null} Timestamp for the mark
   */
  mark(markName) {
    if (!markName) {
      this.#logger?.warn?.('PerformanceMonitor: mark name is required');
      return null;
    }

    try {
      const timestamp = this.#now();
      this.#marks.set(markName, timestamp);
      this.#performanceRef?.mark?.(markName);
      this.#logger?.debug?.(`Performance mark: ${markName}`, { timestamp });
      return timestamp;
    } catch (error) {
      this.#logger?.warn?.(`Failed to create performance mark: ${markName}`, error);
      return null;
    }
  }

  /**
   * Measure duration between two marks.
   *
   * @param {string} measureName - Measurement identifier
   * @param {string} startMark - Starting mark name
   * @param {string} [endMark] - Ending mark name (created automatically if omitted)
   * @returns {PerformanceMeasurement|null} Measurement metadata or null on failure
   */
  measure(measureName, startMark, endMark = null) {
    try {
      if (!endMark) {
        endMark = `${measureName}-end`;
        this.mark(endMark);
      }

      const startTime = this.#marks.get(startMark);
      const endTime = this.#marks.get(endMark);

      const hasStartMark = startTime !== undefined;
      const hasEndMark = endTime !== undefined;

      if (!hasStartMark || !hasEndMark) {
        this.#logger?.warn?.(
          `Performance marks not found for measurement: ${measureName}`,
          {
            startMark,
            endMark,
            hasStartMark,
            hasEndMark,
          }
        );
        return null;
      }

      const duration = endTime - startTime;
      const measurement = {
        duration,
        startMark,
        endMark,
        timestamp: this.#now(),
        tags: [],
      };

      this.#measurements.set(measureName, measurement);

      try {
        this.#performanceRef?.measure?.(measureName, startMark, endMark);
      } catch (nativeError) {
        this.#logger?.debug?.('PerformanceMonitor: native measure fallback used', {
          measureName,
          error: nativeError,
        });
      }

      this.#logger?.debug?.(`Performance measurement: ${measureName}`, {
        duration: `${duration.toFixed(2)}ms`,
        startMark,
        endMark,
      });

      if (duration > this.#threshold) {
        this.#handleThresholdExceeded(measureName, duration);
      }

      this.#notifyStatsListeners(measureName, measurement);

      return measurement;
    } catch (error) {
      this.#logger?.warn?.(`Failed to measure performance: ${measureName}`, error);
      return null;
    }
  }

  /**
   * Get a copy of the stored measurements.
   *
   * @returns {Map<string, PerformanceMeasurement>} Copy of measurements map
   */
  getMeasurements() {
    return new Map(this.#measurements);
  }

  /**
   * Clear marks and measurements optionally filtered by prefix.
   *
   * @param {string|null} [prefix] - Optional prefix filter
   * @returns {void}
   */
  clearData(prefix = null) {
    const clearMarks = (markKey) => {
      this.#marks.delete(markKey);
      try {
        if (markKey) {
          this.#performanceRef?.clearMarks?.(markKey);
        }
      } catch (error) {
        this.#logger?.debug?.('PerformanceMonitor: clearMarks failed', { markKey, error });
      }
    };

    const clearMeasures = (measureKey) => {
      this.#measurements.delete(measureKey);
      try {
        if (measureKey) {
          this.#performanceRef?.clearMeasures?.(measureKey);
        }
      } catch (error) {
        this.#logger?.debug?.('PerformanceMonitor: clearMeasures failed', {
          measureKey,
          error,
        });
      }
    };

    if (prefix) {
      for (const markKey of Array.from(this.#marks.keys())) {
        if (markKey.startsWith(prefix)) {
          clearMarks(markKey);
        }
      }
      for (const measureKey of Array.from(this.#measurements.keys())) {
        if (measureKey.startsWith(prefix)) {
          clearMeasures(measureKey);
        }
      }
    } else {
      this.#marks.clear();
      this.#measurements.clear();
      try {
        this.#performanceRef?.clearMarks?.();
        this.#performanceRef?.clearMeasures?.();
      } catch (error) {
        this.#logger?.debug?.('PerformanceMonitor: clear all failed', { error });
      }
    }

    this.#logger?.debug?.('Cleared performance data', { prefix });
  }

  /**
   * Register an aggregated stats listener.
   * TODO: Emit aggregated summaries once BASCHACUICONREF-008 is implemented.
   *
   * @param {Function} listener - Listener callback
   */
  registerStatsListener(listener) {
    if (typeof listener === 'function') {
      this.#statsListeners.add(listener);
    }
  }

  /**
   * Remove an aggregated stats listener.
   *
   * @param {Function} listener - Listener to remove
   */
  unregisterStatsListener(listener) {
    if (listener && this.#statsListeners.has(listener)) {
      this.#statsListeners.delete(listener);
    }
  }

  /**
   * Handle threshold warnings.
   *
   * @private
   * @param {string} measurement - Measurement label
   * @param {number} duration - Duration in ms
   */
  #handleThresholdExceeded(measurement, duration) {
    const payload = {
      controller: this.#contextName,
      measurement,
      duration,
      threshold: this.#threshold,
    };

    this.#logger?.warn?.(
      `${this.#contextName}: Performance threshold exceeded for ${measurement}`,
      payload
    );

    try {
      this.#eventBus?.dispatch?.(
        CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING,
        payload
      );
    } catch (error) {
      this.#logger?.warn?.('PerformanceMonitor: Failed to dispatch warning event', error);
      throw error;
    }
  }

  /**
   * Notify registered stats listeners with the latest measurement.
   *
   * @private
   * @param {string} measurementName - Measurement identifier
   * @param {PerformanceMeasurement} measurement - Measurement details
   */
  #notifyStatsListeners(measurementName, measurement) {
    if (this.#statsListeners.size === 0) {
      return;
    }

    for (const listener of this.#statsListeners) {
      try {
        listener(measurementName, measurement);
      } catch (error) {
        this.#logger?.warn?.('PerformanceMonitor: stats listener threw error', error);
      }
    }
  }

  /**
   * Resolve current timestamp.
   *
   * @private
   * @returns {number}
   */
  #now() {
    if (this.#performanceRef && typeof this.#performanceRef.now === 'function') {
      return this.#performanceRef.now();
    }
    return Date.now();
  }
}

export default PerformanceMonitor;
