/**
 * @file MemoryMonitor - Real-time memory usage monitoring with threshold detection
 * @module MemoryMonitor
 */

import { BaseService } from '../../utils/serviceBase.js';
import { validateDependency, assertNonBlankString, assertPresent } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { getMemoryUsage } from '../../utils/environmentUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEventBus} IEventBus */

/**
 * @typedef {object} MemorySnapshot
 * @property {number} timestamp - Timestamp in milliseconds
 * @property {number} heapUsed - Heap memory used in bytes
 * @property {number} heapTotal - Total heap size in bytes
 * @property {number} heapLimit - Maximum heap size in bytes
 * @property {number} external - External memory in bytes
 * @property {number} [rss] - Resident set size (Node.js only)
 * @property {number} usagePercent - Heap usage percentage
 */

/**
 * @typedef {object} MemoryThresholds
 * @property {number} heapWarning - Warning threshold (0-1 percentage)
 * @property {number} heapCritical - Critical threshold (0-1 percentage)
 * @property {number} [rssWarning] - RSS warning threshold in bytes
 * @property {number} [rssCritical] - RSS critical threshold in bytes
 */

/**
 * @typedef {object} LeakDetectionResult
 * @property {boolean} detected - Whether a leak was detected
 * @property {number} growthRate - Memory growth rate per minute
 * @property {string} confidence - Detection confidence (low, medium, high)
 * @property {string} trend - Memory trend (stable, growing, fluctuating)
 * @property {number} [estimatedTimeToOOM] - Estimated time to out of memory in minutes
 */

/**
 * Browser-compatible memory monitoring with leak detection
 */
export default class MemoryMonitor extends BaseService {
  #logger;
  #eventBus;
  #enabled;
  #thresholds;
  #samplingInterval;
  #history;
  #maxHistorySize;
  #alertHandlers;
  #intervalHandle;
  #lastLeakCheck;
  #lastSnapshot;
  #pressureLevel;
  #leakDetectionConfig;
  #consecutiveWarnings;
  #consecutiveCriticals;

  /**
   * Creates a new MemoryMonitor instance
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {IEventBus} deps.eventBus - Event bus for dispatching alerts
   * @param {boolean} [deps.enabled] - Whether monitoring is enabled
   * @param {number} [deps.heapWarning] - Heap warning threshold (70%)
   * @param {number} [deps.heapCritical] - Heap critical threshold (85%)
   * @param {number} [deps.rssWarning] - RSS warning threshold in bytes
   * @param {number} [deps.rssCritical] - RSS critical threshold in bytes
   * @param {number} [deps.samplingInterval] - Sampling interval in ms
   * @param {number} [deps.maxHistorySize] - Maximum history entries
   * @param {object} [deps.leakDetectionConfig] - Leak detection configuration
   */
  constructor({
    logger,
    eventBus,
    enabled = true,
    heapWarning = 0.7,
    heapCritical = 0.85,
    rssWarning = 800 * 1024 * 1024, // 800MB
    rssCritical = 1024 * 1024 * 1024, // 1GB
    samplingInterval = 5000,
    maxHistorySize = 1000,
    leakDetectionConfig = {},
  }) {
    super();

    // Validate dependencies
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch'],
    });

    this.#logger = this._init('MemoryMonitor', logger);
    this.#eventBus = eventBus;
    this.#enabled = enabled;
    this.#samplingInterval = samplingInterval;
    this.#maxHistorySize = maxHistorySize;

    // Initialize thresholds
    this.#thresholds = {
      heapWarning,
      heapCritical,
      rssWarning,
      rssCritical,
    };

    // Validate thresholds
    this.#validateThresholds();

    // Initialize state
    this.#history = [];
    this.#alertHandlers = new Map();
    this.#intervalHandle = null;
    this.#lastSnapshot = null;
    this.#pressureLevel = 'normal';
    this.#consecutiveWarnings = 0;
    this.#consecutiveCriticals = 0;

    // Leak detection configuration
    this.#leakDetectionConfig = {
      enabled: leakDetectionConfig.enabled !== false,
      sensitivity: leakDetectionConfig.sensitivity || 'medium',
      windowSize: leakDetectionConfig.windowSize || 100,
      growthThreshold: leakDetectionConfig.growthThreshold || 0.1, // 10% growth
      checkInterval: leakDetectionConfig.checkInterval || 60000, // 1 minute
    };

    this.#logger.info('MemoryMonitor initialized', {
      enabled: this.#enabled,
      thresholds: this.#thresholds,
      samplingInterval: this.#samplingInterval,
      maxHistorySize: this.#maxHistorySize,
      leakDetection: this.#leakDetectionConfig,
    });
  }

  /**
   * Validate threshold configuration
   *
   * @private
   */
  #validateThresholds() {
    const { heapWarning, heapCritical } = this.#thresholds;

    if (heapWarning < 0 || heapWarning > 1) {
      throw new InvalidArgumentError('Heap warning threshold must be between 0 and 1');
    }

    if (heapCritical < 0 || heapCritical > 1) {
      throw new InvalidArgumentError('Heap critical threshold must be between 0 and 1');
    }

    if (heapCritical <= heapWarning) {
      throw new InvalidArgumentError('Critical threshold must be higher than warning threshold');
    }
  }

  /**
   * Start memory monitoring
   */
  start() {
    if (!this.#enabled) {
      this.#logger.info('Memory monitoring is disabled');
      return;
    }

    if (this.#intervalHandle) {
      this.#logger.warn('Memory monitoring already started');
      return;
    }

    // Take initial snapshot
    this.#takeSnapshot();

    // Start periodic sampling
    this.#intervalHandle = setInterval(() => {
      this.#takeSnapshot();
      this.#checkThresholds();

      // Check for memory leaks periodically
      if (this.#leakDetectionConfig.enabled &&
          this.#history.length >= this.#leakDetectionConfig.windowSize) {
        const timeSinceLastCheck = Date.now() - (this.#lastLeakCheck || 0);
        if (timeSinceLastCheck >= this.#leakDetectionConfig.checkInterval) {
          this.#checkForLeaks();
          this.#lastLeakCheck = Date.now();
        }
      }
    }, this.#samplingInterval);

    this.#logger.info('Memory monitoring started');

    // Dispatch start event
    this.#eventBus.dispatch({
      type: 'MEMORY_MONITORING_STARTED',
      payload: {
        samplingInterval: this.#samplingInterval,
        thresholds: this.#thresholds,
      },
    });
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (this.#intervalHandle) {
      clearInterval(this.#intervalHandle);
      this.#intervalHandle = null;
      this.#logger.info('Memory monitoring stopped');

      // Dispatch stop event
      this.#eventBus.dispatch({
        type: 'MEMORY_MONITORING_STOPPED',
        payload: {
          finalSnapshot: this.#lastSnapshot,
          historyLength: this.#history.length,
        },
      });
    }
  }

  /**
   * Take a memory snapshot
   *
   * @private
   */
  #takeSnapshot() {
    const snapshot = this.#getMemoryUsage();
    this.#lastSnapshot = snapshot;

    // Add to history with circular buffer
    if (this.#history.length >= this.#maxHistorySize) {
      this.#history.shift();
    }
    this.#history.push(snapshot);

    this.#logger.debug('Memory snapshot taken', {
      heapUsed: (snapshot.heapUsed / 1048576).toFixed(2) + 'MB',
      heapTotal: (snapshot.heapTotal / 1048576).toFixed(2) + 'MB',
      usagePercent: (snapshot.usagePercent * 100).toFixed(1) + '%',
    });
  }

  /**
   * Get current memory usage (browser-compatible)
   *
   * @private
   * @returns {MemorySnapshot}
   */
  #getMemoryUsage() {
    const timestamp = Date.now();

    // Try browser performance.memory API first
    if (typeof performance !== 'undefined' && performance.memory) {
      const mem = performance.memory;
      return {
        timestamp,
        heapUsed: mem.usedJSHeapSize || 0,
        heapTotal: mem.totalJSHeapSize || 0,
        heapLimit: mem.jsHeapSizeLimit || 0,
        external: 0, // Not available in browser
        usagePercent: mem.jsHeapSizeLimit > 0
          ? (mem.usedJSHeapSize / mem.jsHeapSizeLimit)
          : 0,
      };
    }

    // Fallback for Node.js environment
    const memUsage = getMemoryUsage();
    if (memUsage) {
      const heapTotal = memUsage.heapTotal || 0;
      const heapUsed = memUsage.heapUsed || 0;

      return {
        timestamp,
        heapUsed,
        heapTotal,
        heapLimit: heapTotal, // Approximate
        external: memUsage.external || 0,
        rss: memUsage.rss || 0,
        usagePercent: heapTotal > 0 ? (heapUsed / heapTotal) : 0,
      };
    }

    // Fallback when no memory API available
    return {
      timestamp,
      heapUsed: 0,
      heapTotal: 0,
      heapLimit: 0,
      external: 0,
      usagePercent: 0,
    };
  }

  /**
   * Check memory thresholds and trigger alerts
   *
   * @private
   */
  #checkThresholds() {
    if (!this.#lastSnapshot) return;

    const { usagePercent, rss } = this.#lastSnapshot;
    const { heapWarning, heapCritical, rssWarning, rssCritical } = this.#thresholds;

    let newPressureLevel = 'normal';

    // Check heap thresholds
    if (usagePercent >= heapCritical) {
      newPressureLevel = 'critical';
      this.#consecutiveCriticals++;
      this.#consecutiveWarnings = 0;

      if (this.#consecutiveCriticals === 1) {
        this.#triggerAlert('critical', 'heap', usagePercent);
      }
    } else if (usagePercent >= heapWarning) {
      newPressureLevel = 'warning';
      this.#consecutiveWarnings++;
      this.#consecutiveCriticals = 0;

      if (this.#consecutiveWarnings === 1) {
        this.#triggerAlert('warning', 'heap', usagePercent);
      }
    } else {
      this.#consecutiveWarnings = 0;
      this.#consecutiveCriticals = 0;
    }

    // Check RSS thresholds (Node.js only)
    if (rss) {
      if (rss >= rssCritical) {
        newPressureLevel = 'critical';
        this.#triggerAlert('critical', 'rss', rss);
      } else if (rss >= rssWarning && newPressureLevel === 'normal') {
        newPressureLevel = 'warning';
        this.#triggerAlert('warning', 'rss', rss);
      }
    }

    // Update pressure level if changed
    if (newPressureLevel !== this.#pressureLevel) {
      const oldLevel = this.#pressureLevel;
      this.#pressureLevel = newPressureLevel;

      this.#logger.info(`Memory pressure level changed: ${oldLevel} -> ${newPressureLevel}`);

      this.#eventBus.dispatch({
        type: 'MEMORY_PRESSURE_CHANGED',
        payload: {
          oldLevel,
          newLevel: newPressureLevel,
          snapshot: this.#lastSnapshot,
        },
      });
    }
  }

  /**
   * Trigger a memory alert
   *
   * @param level
   * @param type
   * @param value
   * @private
   */
  #triggerAlert(level, type, value) {
    const alert = {
      level,
      type,
      value,
      timestamp: Date.now(),
      snapshot: this.#lastSnapshot,
    };

    this.#logger.warn(`Memory ${level} alert`, {
      type,
      value: type === 'heap'
        ? (value * 100).toFixed(1) + '%'
        : (value / 1048576).toFixed(2) + 'MB',
    });

    // Dispatch event
    this.#eventBus.dispatch({
      type: `MEMORY_THRESHOLD_EXCEEDED`,
      payload: alert,
    });

    // Call registered handlers
    const handlers = this.#alertHandlers.get(level) || [];
    handlers.forEach(handler => {
      try {
        handler(alert);
      } catch (error) {
        this.#logger.error(`Alert handler error:`, error);
      }
    });
  }

  /**
   * Check for memory leaks
   *
   * @private
   */
  #checkForLeaks() {
    const result = this.detectMemoryLeak();

    if (result.detected) {
      this.#logger.warn('Memory leak detected', result);

      this.#eventBus.dispatch({
        type: 'MEMORY_LEAK_DETECTED',
        payload: result,
      });

      // Call leak handlers
      const handlers = this.#alertHandlers.get('leak') || [];
      handlers.forEach(handler => {
        try {
          handler(result);
        } catch (error) {
          this.#logger.error(`Leak handler error:`, error);
        }
      });
    }
  }

  /**
   * Get current memory usage
   *
   * @returns {MemorySnapshot|null}
   */
  getCurrentUsage() {
    return this.#lastSnapshot;
  }

  /**
   * Get memory history
   *
   * @param {number} [duration] - Duration in milliseconds to retrieve
   * @returns {MemorySnapshot[]}
   */
  getHistory(duration) {
    if (!duration) {
      return [...this.#history];
    }

    const cutoff = Date.now() - duration;
    return this.#history.filter(snapshot => snapshot.timestamp >= cutoff);
  }

  /**
   * Register a threshold alert handler
   *
   * @param {string} level - Alert level (warning, critical, leak)
   * @param {Function} handler - Handler function
   */
  onThresholdExceeded(level, handler) {
    assertNonBlankString(level, 'Alert level');
    assertPresent(handler, 'Alert handler');

    if (!this.#alertHandlers.has(level)) {
      this.#alertHandlers.set(level, []);
    }

    this.#alertHandlers.get(level).push(handler);

    this.#logger.debug(`Alert handler registered for level: ${level}`);
  }

  /**
   * Detect memory leak based on growth patterns
   *
   * @param {string} [sensitivity] - Detection sensitivity
   * @returns {LeakDetectionResult}
   */
  detectMemoryLeak(sensitivity) {
    sensitivity = sensitivity || this.#leakDetectionConfig.sensitivity;

    if (this.#history.length < this.#leakDetectionConfig.windowSize) {
      return {
        detected: false,
        growthRate: 0,
        confidence: 'low',
        trend: 'insufficient_data',
      };
    }

    // Get recent window
    const window = this.#history.slice(-this.#leakDetectionConfig.windowSize);
    const timeSpan = window[window.length - 1].timestamp - window[0].timestamp;
    const minuteSpan = timeSpan / 60000;

    if (minuteSpan === 0) {
      return {
        detected: false,
        growthRate: 0,
        confidence: 'low',
        trend: 'insufficient_time',
      };
    }

    // Calculate growth rate
    const startMemory = window[0].heapUsed;
    const endMemory = window[window.length - 1].heapUsed;
    const totalGrowth = endMemory - startMemory;
    const growthRate = totalGrowth / minuteSpan; // Bytes per minute
    const growthPercent = startMemory > 0 ? (totalGrowth / startMemory) : 0;

    // Sensitivity thresholds
    const thresholds = {
      low: { growth: 0.2, rate: 10 * 1024 * 1024 }, // 20% or 10MB/min
      medium: { growth: 0.1, rate: 5 * 1024 * 1024 }, // 10% or 5MB/min
      high: { growth: 0.05, rate: 1 * 1024 * 1024 }, // 5% or 1MB/min
    };

    const threshold = thresholds[sensitivity] || thresholds.medium;
    const detected = growthPercent >= threshold.growth || growthRate >= threshold.rate;

    // Analyze trend
    let trend = 'stable';
    let confidence = 'low';

    if (detected) {
      // Check consistency of growth
      const midpoint = Math.floor(window.length / 2);
      const firstHalf = window.slice(0, midpoint);
      const secondHalf = window.slice(midpoint);

      const firstHalfGrowth = firstHalf[firstHalf.length - 1].heapUsed - firstHalf[0].heapUsed;
      const secondHalfGrowth = secondHalf[secondHalf.length - 1].heapUsed - secondHalf[0].heapUsed;

      if (firstHalfGrowth > 0 && secondHalfGrowth > 0) {
        trend = 'growing';
        confidence = 'high';
      } else {
        trend = 'fluctuating';
        confidence = 'medium';
      }
    }

    // Estimate time to OOM if growing
    let estimatedTimeToOOM;
    if (trend === 'growing' && growthRate > 0) {
      const currentUsage = this.#lastSnapshot.heapUsed;
      const limit = this.#lastSnapshot.heapLimit;
      if (limit > currentUsage) {
        estimatedTimeToOOM = (limit - currentUsage) / growthRate;
      }
    }

    return {
      detected,
      growthRate,
      confidence,
      trend,
      estimatedTimeToOOM,
    };
  }

  /**
   * Analyze memory growth patterns
   *
   * @returns {object} Growth analysis
   */
  analyzeGrowthPattern() {
    if (this.#history.length < 2) {
      return {
        pattern: 'insufficient_data',
        averageGrowth: 0,
        peakUsage: 0,
        volatility: 0,
      };
    }

    const deltas = [];
    let peakUsage = 0;

    for (let i = 1; i < this.#history.length; i++) {
      const delta = this.#history[i].heapUsed - this.#history[i - 1].heapUsed;
      deltas.push(delta);
      peakUsage = Math.max(peakUsage, this.#history[i].heapUsed);
    }

    const averageGrowth = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;

    // Calculate volatility (standard deviation)
    const variance = deltas.reduce((sum, d) => sum + Math.pow(d - averageGrowth, 2), 0) / deltas.length;
    const volatility = Math.sqrt(variance);

    // Determine pattern
    let pattern = 'stable';
    if (averageGrowth > 1024 * 1024) { // Growing more than 1MB average
      pattern = 'growing';
    } else if (volatility > 5 * 1024 * 1024) { // High volatility (5MB)
      pattern = 'volatile';
    } else if (averageGrowth < -1024 * 1024) { // Shrinking
      pattern = 'shrinking';
    }

    return {
      pattern,
      averageGrowth,
      peakUsage,
      volatility,
      samples: this.#history.length,
    };
  }

  /**
   * Predict time until out of memory
   *
   * @returns {number|null} Minutes until OOM, or null if not applicable
   */
  predictOutOfMemory() {
    const analysis = this.analyzeGrowthPattern();

    if (analysis.pattern !== 'growing' || !this.#lastSnapshot) {
      return null;
    }

    const currentUsage = this.#lastSnapshot.heapUsed;
    const limit = this.#lastSnapshot.heapLimit;

    if (limit <= currentUsage || analysis.averageGrowth <= 0) {
      return null;
    }

    const bytesRemaining = limit - currentUsage;
    const minutesRemaining = bytesRemaining / (analysis.averageGrowth * 12); // 5-second samples

    return Math.max(0, minutesRemaining);
  }

  /**
   * Get current memory pressure level
   *
   * @returns {string} Pressure level (normal, warning, critical)
   */
  getPressureLevel() {
    return this.#pressureLevel;
  }

  /**
   * Get monitoring configuration
   *
   * @returns {object} Current configuration
   */
  getConfiguration() {
    return {
      enabled: this.#enabled,
      thresholds: { ...this.#thresholds },
      samplingInterval: this.#samplingInterval,
      maxHistorySize: this.#maxHistorySize,
      leakDetection: { ...this.#leakDetectionConfig },
    };
  }

  /**
   * Update thresholds dynamically
   *
   * @param {MemoryThresholds} thresholds - New thresholds
   */
  updateThresholds(thresholds) {
    this.#thresholds = {
      ...this.#thresholds,
      ...thresholds,
    };

    this.#validateThresholds();

    this.#logger.info('Memory thresholds updated', this.#thresholds);

    this.#eventBus.dispatch({
      type: 'MEMORY_THRESHOLDS_UPDATED',
      payload: this.#thresholds,
    });
  }

  /**
   * Clean up and stop monitoring
   */
  destroy() {
    this.stop();
    this.#history = [];
    this.#alertHandlers.clear();
    this.#logger.info('MemoryMonitor destroyed');
  }
}