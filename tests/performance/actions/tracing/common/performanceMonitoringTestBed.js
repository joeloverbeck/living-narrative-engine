/**
 * @file Performance Monitoring Test Bed
 * @description Specialized test environment for validating performance monitoring integration
 * during realistic gaming scenarios with comprehensive measurement and validation
 *
 * Supports Priority 2.2: Performance Monitoring Integration (MEDIUM) from
 * reports/actions-tracing-architecture-analysis.md
 */

import { createTestBed } from '../../../../common/testBed.js';
import { PerformanceMonitor } from '../../../../../src/actions/tracing/performanceMonitor.js';
import { StructuredTrace } from '../../../../../src/actions/tracing/structuredTrace.js';
import ActionTraceFilter from '../../../../../src/actions/tracing/actionTraceFilter.js';
import {
  PERFORMANCE_MONITORING_CONFIGS,
  GAMING_ACTION_PATTERNS,
  createTestActionData,
  generateActionSequence,
  MONITORING_VALIDATION,
} from '../performanceMonitoringIntegration.fixtures.js';

/**
 * Specialized test bed for performance monitoring integration testing
 * Provides comprehensive testing environment with realistic gaming scenarios
 */
export class PerformanceMonitoringTestBed {
  constructor() {
    this.baseTestBed = null;
    this.performanceMonitor = null;
    this.structuredTrace = null;
    this.actionFilter = null;

    // Performance tracking
    this.measurements = {
      monitoringOverhead: [],
      actionDurations: [],
      memorySnapshots: [],
      alertTimestamps: [],
    };

    // Gaming simulation
    this.activeActions = new Map();
    this.completedActions = [];
    this.simulatedErrors = [];

    // Test configuration
    this.config = {
      monitoring: PERFORMANCE_MONITORING_CONFIGS.STANDARD_GAMING,
      pattern: 'EXPLORATION',
      enableDetailedLogging: false,
    };

    this.initialized = false;
  }

  /**
   * Initialize the performance monitoring test bed
   *
   * @param options
   */
  async initialize(options = {}) {
    if (this.initialized) {
      throw new Error('Test bed is already initialized');
    }

    // Merge configuration options
    this.config = { ...this.config, ...options };

    // Initialize base test bed
    this.baseTestBed = createTestBed();

    // Create tracing infrastructure
    await this.#setupTracingInfrastructure();

    // Create performance monitor with configured thresholds
    this.performanceMonitor = new PerformanceMonitor(
      this.structuredTrace,
      this.config.monitoring.thresholds
    );

    // Configure sampling if specified
    if (this.config.monitoring.samplingConfig) {
      this.performanceMonitor.enableSampling(
        this.config.monitoring.samplingConfig
      );
    }

    this.initialized = true;

    if (this.config.enableDetailedLogging) {
      console.log(
        'Performance monitoring test bed initialized with config:',
        this.config
      );
    }
  }

  /**
   * Sets up the tracing infrastructure
   *
   * @private
   */
  async #setupTracingInfrastructure() {
    // Create action trace filter
    this.actionFilter = new ActionTraceFilter({
      tracedActions: ['*'], // Trace all actions
      verbosity: 'detailed',
      includeComponentData: true,
      includePrerequisites: true,
    });

    // Create structured trace - this is what PerformanceMonitor expects
    this.structuredTrace = new StructuredTrace();
  }

  /**
   * Configures performance monitoring thresholds
   *
   * @param config
   */
  setMonitoringConfig(config) {
    if (!this.initialized) {
      throw new Error('Test bed must be initialized first');
    }

    this.config.monitoring = { ...this.config.monitoring, ...config };

    if (config.thresholds) {
      this.performanceMonitor.setThresholds(config.thresholds);
    }

    if (config.samplingConfig) {
      this.performanceMonitor.enableSampling(config.samplingConfig);
    }
  }

  /**
   * Starts performance monitoring with measurement tracking
   *
   * @param options
   */
  startMonitoring(options = {}) {
    if (!this.initialized) {
      throw new Error('Test bed must be initialized first');
    }

    const monitoringOptions = {
      intervalMs: this.config.monitoring.intervalMs,
      ...options,
    };

    // Clear previous measurements
    this.clearMeasurements();

    // Start monitoring and capture the stop function
    const stopMonitoring =
      this.performanceMonitor.startMonitoring(monitoringOptions);

    return {
      stop: () => {
        stopMonitoring();
        return this.getMeasurementSummary();
      },
      getRealtimeMetrics: () => this.performanceMonitor.getRealtimeMetrics(),
      getAlerts: (filters) => this.performanceMonitor.getAlerts(filters),
    };
  }

  /**
   * Simulates realistic gaming action execution with performance monitoring
   *
   * @param actionData
   * @param options
   */
  async simulateActionExecution(actionData, options = {}) {
    if (!this.initialized) {
      throw new Error('Test bed must be initialized first');
    }

    const {
      simulateDelay = true,
      measureOverhead = true,
      trackMemory = true,
      errorRate = 0,
    } = options;

    // Create unique action identifier to avoid conflicts in parallel execution
    const uniqueActionId = `${actionData.actionId}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const startTime = performance.now();

    try {
      // Measure monitoring overhead if requested
      let monitoringOverhead = 0;
      if (measureOverhead) {
        const overheadStart = performance.now();

        // Start span for action execution
        const span = this.structuredTrace.startSpan(uniqueActionId, {
          actorId: actionData.actorId,
          pattern: actionData.context.pattern,
          originalActionId: actionData.actionId, // Keep reference to original
        });

        monitoringOverhead = performance.now() - overheadStart;
        this.measurements.monitoringOverhead.push(monitoringOverhead);

        // Track the active action
        this.activeActions.set(uniqueActionId, {
          span,
          startTime,
          actionData,
        });
      }

      // Simulate error based on error rate (after span is created so it gets tracked)
      if (errorRate > 0 && Math.random() < errorRate) {
        const simulatedError = new Error(
          `Simulated error in action ${actionData.actionId}`
        );

        // Record error in the span if we have one
        if (measureOverhead) {
          const activeAction = this.activeActions.get(uniqueActionId);
          if (activeAction) {
            activeAction.span.recordError(simulatedError);
          }
        }
        throw simulatedError;
      }

      // Simulate action execution time
      if (simulateDelay) {
        const executionTime = this.#calculateExecutionTime(actionData);
        await this.#simulateAsyncExecution(executionTime);
      }

      // Capture memory snapshot if requested
      if (trackMemory) {
        const memoryUsage = this.performanceMonitor.getMemoryUsage();
        this.measurements.memorySnapshots.push({
          timestamp: performance.now(),
          usage: memoryUsage,
          actionId: actionData.actionId, // Use the original action ID for tracking
        });
      }

      // Complete the action
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      if (measureOverhead) {
        const activeAction = this.activeActions.get(uniqueActionId);
        if (activeAction) {
          activeAction.span.end();
          this.activeActions.delete(uniqueActionId);
        }
      }

      // Record action completion
      const completedAction = {
        ...actionData,
        actualDuration: totalDuration,
        monitoringOverhead,
        timestamp: endTime,
        success: true,
      };

      this.completedActions.push(completedAction);
      this.measurements.actionDurations.push(totalDuration);

      // Record performance metrics
      this.performanceMonitor.recordMetric(
        `action.${actionData.actionId}.duration`,
        totalDuration
      );
      this.performanceMonitor.trackOperation(actionData.actionId, startTime);

      return completedAction;
    } catch (error) {
      // Handle simulated errors
      const errorAction = {
        ...actionData,
        actualDuration: performance.now() - startTime,
        error: error.message,
        timestamp: performance.now(),
        success: false,
      };

      this.simulatedErrors.push(errorAction);
      this.completedActions.push(errorAction);

      // Clean up active action
      if (this.activeActions.has(uniqueActionId)) {
        const activeAction = this.activeActions.get(uniqueActionId);
        activeAction.span.recordError(error);
        activeAction.span.end();
        this.activeActions.delete(uniqueActionId);
      }

      throw error;
    }
  }

  /**
   * Simulates a sequence of actions for load testing
   *
   * @param pattern
   * @param count
   * @param options
   */
  async simulateActionSequence(pattern, count, options = {}) {
    const {
      parallelism = 1,
      delayBetweenActionsMs = 0,
      errorRate = 0,
    } = options;

    const sequence = generateActionSequence(pattern, count);
    const results = [];

    if (parallelism === 1) {
      // Sequential execution
      for (let i = 0; i < sequence.length; i++) {
        const actionData = sequence[i];

        try {
          // Pass errorRate to simulateActionExecution for proper span tracking of errors
          const executionOptions = { ...options, errorRate };
          const result = await this.simulateActionExecution(
            actionData,
            executionOptions
          );
          results.push(result);

          // Optional debug log (disabled for performance)
          // if (i < 3) {
          //   console.log(`Action ${i + 1} result:`, { actionId: result.actionId, success: result.success });
          // }
        } catch (error) {
          // This catch block should only handle unexpected errors, not simulated ones
          const errorResult = {
            ...actionData,
            actualDuration: 0,
            monitoringOverhead: 0,
            timestamp: performance.now(),
            error: error.message,
            success: false,
          };
          results.push(errorResult);
          this.completedActions.push(errorResult);
          this.simulatedErrors.push(errorResult);

          // Optional debug log for failures (disabled for performance)
          // if (results.filter(r => !r.success).length <= 3) {
          //   console.error(`Action ${i + 1} failed:`, { actionId: errorResult.actionId, error: error.message });
          // }
        }

        // Add delay between actions if specified
        if (delayBetweenActionsMs > 0 && i < sequence.length - 1) {
          await this.#simulateAsyncExecution(delayBetweenActionsMs);
        }
      }
    } else {
      // Parallel execution in batches
      const batches = this.#createBatches(sequence, parallelism);

      for (const batch of batches) {
        const batchPromises = batch.map(async (actionData) => {
          try {
            // Pass errorRate to simulateActionExecution for proper span tracking of errors
            const executionOptions = { ...options, errorRate };
            return await this.simulateActionExecution(
              actionData,
              executionOptions
            );
          } catch (error) {
            // This catch block should only handle unexpected errors, not simulated ones
            const errorResult = {
              ...actionData,
              actualDuration: 0,
              monitoringOverhead: 0,
              timestamp: performance.now(),
              error: error.message,
              success: false,
            };

            this.completedActions.push(errorResult);
            this.simulatedErrors.push(errorResult);

            return errorResult;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches if specified
        if (delayBetweenActionsMs > 0) {
          await this.#simulateAsyncExecution(delayBetweenActionsMs);
        }
      }
    }

    return results;
  }

  /**
   * Validates performance monitoring accuracy
   *
   * @param options
   */
  validateMonitoringAccuracy(options = {}) {
    const {
      overheadThresholdMs = 1.0,
      memoryTolerancePercent = 10,
      alertToleranceMs = 100,
    } = options;

    const validation = {};

    // Validate monitoring overhead
    if (this.measurements.monitoringOverhead.length > 0) {
      validation.overhead = MONITORING_VALIDATION.validateMonitoringOverhead(
        this.measurements.monitoringOverhead,
        overheadThresholdMs
      );
    }

    // Validate memory usage accuracy
    if (this.measurements.memorySnapshots.length > 0) {
      const recentSnapshot =
        this.measurements.memorySnapshots[
          this.measurements.memorySnapshots.length - 1
        ];
      const reportedMemory = recentSnapshot.usage.estimatedSizeMB;
      const expectedMemory = this.#calculateExpectedMemory();

      validation.memory = MONITORING_VALIDATION.validateMemoryAccuracy(
        reportedMemory,
        expectedMemory,
        memoryTolerancePercent
      );
    }

    // Validate alert accuracy (if alerts were expected)
    const alerts = this.performanceMonitor.getAlerts();
    if (alerts.length > 0) {
      // This would need expected alerts to be provided for full validation
      validation.alerts = {
        totalAlerts: alerts.length,
        alertTypes: [...new Set(alerts.map((a) => a.type))],
        alertSeverities: [...new Set(alerts.map((a) => a.severity))],
      };
    }

    // Validate real-time metrics accuracy
    const metrics = this.performanceMonitor.getRealtimeMetrics();
    validation.realtimeMetrics = {
      completedSpans: metrics.completedSpans,
      expectedSpans: this.completedActions.filter((a) => a.success).length,
      errorCount: metrics.errorCount,
      expectedErrors: this.simulatedErrors.length,
      memoryUsage: metrics.memoryUsageMB,
    };

    return validation;
  }

  /**
   * Gets comprehensive measurement summary
   */
  getMeasurementSummary() {
    const summary = {
      totalActions: this.completedActions.length,
      successfulActions: this.completedActions.filter((a) => a.success).length,
      failedActions: this.completedActions.filter((a) => !a.success).length,
      totalErrors: this.simulatedErrors.length,

      performance: {
        averageActionDuration: this.#calculateAverage(
          this.measurements.actionDurations
        ),
        maxActionDuration: Math.max(
          ...(this.measurements.actionDurations || [0])
        ),
        minActionDuration: Math.min(
          ...(this.measurements.actionDurations || [0])
        ),

        averageMonitoringOverhead: this.#calculateAverage(
          this.measurements.monitoringOverhead
        ),
        maxMonitoringOverhead: Math.max(
          ...(this.measurements.monitoringOverhead || [0])
        ),

        memoryGrowth: this.#calculateMemoryGrowth(),
      },

      monitoring: {
        totalAlerts: this.performanceMonitor.getAlerts().length,
        monitoringStatus: this.performanceMonitor.getMonitoringStatus(),
        realtimeMetrics: this.performanceMonitor.getRealtimeMetrics(),
      },

      measurements: {
        overheadSamples: this.measurements.monitoringOverhead.length,
        durationSamples: this.measurements.actionDurations.length,
        memorySnapshots: this.measurements.memorySnapshots.length,
      },
    };

    return summary;
  }

  /**
   * Clears all measurements and resets counters
   */
  clearMeasurements() {
    this.measurements.monitoringOverhead = [];
    this.measurements.actionDurations = [];
    this.measurements.memorySnapshots = [];
    this.measurements.alertTimestamps = [];

    this.completedActions = [];
    this.simulatedErrors = [];
    this.activeActions.clear();

    this.performanceMonitor.clearAlerts();
    this.performanceMonitor.clearRecordedMetrics();
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (!this.initialized) {
      return;
    }

    // Clear any active monitoring
    try {
      const status = this.performanceMonitor.getMonitoringStatus();
      if (status.isMonitoring) {
        // Monitoring will be stopped when test completes
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clear measurements
    this.clearMeasurements();

    // Cleanup base test bed
    if (this.baseTestBed) {
      this.baseTestBed.cleanup();
    }

    this.initialized = false;
  }

  // Private helper methods

  #calculateExecutionTime(actionData) {
    // Add some realistic variation to execution times (reduced for faster testing)
    const baseTime = actionData.expectedDuration || 10; // Reduced default from 50ms
    const variation = baseTime * 0.2; // ±20% variation
    const calculatedTime = baseTime + (Math.random() - 0.5) * 2 * variation;
    return Math.max(1, calculatedTime); // Reduced minimum from 5ms to 1ms
  }

  async #simulateAsyncExecution(durationMs) {
    // Optimize for very short delays
    if (durationMs <= 0) {
      return Promise.resolve();
    }
    if (durationMs < 5) {
      // Use setImmediate for very short delays (faster than setTimeout)
      return new Promise((resolve) => setImmediate(resolve));
    }
    // Use setTimeout for longer delays
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  #createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  #calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  #calculateMemoryGrowth() {
    if (this.measurements.memorySnapshots.length < 2) return 0;

    const first = this.measurements.memorySnapshots[0];
    const last =
      this.measurements.memorySnapshots[
        this.measurements.memorySnapshots.length - 1
      ];

    return last.usage.estimatedSizeMB - first.usage.estimatedSizeMB;
  }

  #calculateExpectedMemory() {
    // Rough estimation based on completed actions and their expected memory usage
    const baseMemory = 5; // 5MB base
    const memoryPerAction = 0.1; // 0.1MB per action
    return baseMemory + this.completedActions.length * memoryPerAction;
  }
}

export default PerformanceMonitoringTestBed;
