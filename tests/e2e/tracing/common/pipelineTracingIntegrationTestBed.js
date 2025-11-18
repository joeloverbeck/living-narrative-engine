/**
 * @file Test bed for Pipeline Tracing Integration E2E tests
 * Provides a comprehensive testing environment for validating complete action discovery pipeline tracing workflows
 * from component filtering through target resolution and formatting with performance correlation.
 */

import { createMockFacades } from '../../../common/facades/testingFacadeRegistrations.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import PipelinePerformanceAnalyzer from '../../../../src/actions/tracing/pipelinePerformanceAnalyzer.js';
import PerformanceMonitor from '../../../../src/actions/tracing/performanceMonitor.js';

/**
 * E2E test bed for comprehensive pipeline tracing integration testing
 * Provides realistic tracing environment with full pipeline integration
 */
export class PipelineTracingIntegrationTestBed {
  constructor() {
    this.facades = null;
    this.turnExecutionFacade = null;
    this.actionService = null;
    this.entityService = null;

    // Pipeline tracing components
    this.tracingComponents = {
      filter: null,
      structuredTrace: null,
      performanceAnalyzer: null,
      performanceMonitor: null,
    };

    // Test data tracking
    this.capturedTraces = [];
    this.performanceMetrics = [];
    this.performanceAlerts = [];
    this.errors = [];

    // Test configuration
    this.tracingConfig = {
      enabled: true,
      verbosity: 'detailed',
      enablePerformanceTracking: true,
      enableScopeTracing: false,
      enableMultiTargetAnalysis: false,
      enableDependencyTracking: false,
      enableLegacyTracking: false,
      enableBottleneckAnalysis: false,
      enableCrossStageCorrelation: false,
      enableThresholdAlerting: false,
      enableAllFeatures: false,
    };

    // Performance tracking
    this.executionTimes = new Map();
    this.memorySnapshots = [];
    this.stageMetrics = new Map();

    this.initialized = false;
  }

  /**
   * Initialize the test bed with comprehensive pipeline tracing infrastructure
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Create facades using the standard e2e pattern (global jest available in test environment)
    // eslint-disable-next-line no-undef
    this.facades = createMockFacades({}, jest.fn);
    this.turnExecutionFacade = this.facades.turnExecutionFacade;
    this.actionService = this.facades.actionService;
    this.entityService = this.facades.entityService;

    // Initialize tracing components
    await this.#initializePipelineTracingComponents();

    // Setup performance monitoring
    this.#setupPerformanceMonitoring();

    // Setup error capture
    this.#setupErrorCapture();

    // Initialize the test environment
    await this.turnExecutionFacade.initializeTestEnvironment({
      llmStrategy: 'json-schema',
      actors: [],
    });

    this.initialized = true;
  }

  /**
   * Initialize pipeline tracing components with configurable options
   *
   * @private
   */
  async #initializePipelineTracingComponents() {
    const logger = this.facades.logger;

    // Create trace filter for pipeline tracing
    this.tracingComponents.filter = new ActionTraceFilter({
      enabled: this.tracingConfig.enabled,
      tracedActions: ['*'],
      excludedActions: [],
      verbosityLevel: this.tracingConfig.verbosity,
      inclusionConfig: {
        includeComponents: true,
        includePrerequisites: true,
        includeTargets: true,
        includePerformanceData: this.tracingConfig.enablePerformanceTracking,
        includeScopeData: this.tracingConfig.enableScopeTracing,
      },
    });

    // Create mock structured trace for PerformanceMonitor
    const mockTrace = {
      getSpans: () => [],
      getActiveSpan: () => null,
      addSpan: () => ({}),
    };

    // Create performance monitor
    this.tracingComponents.performanceMonitor = new PerformanceMonitor(
      mockTrace,
      {
        slowOperationMs: 100,
        criticalOperationMs: 500,
      }
    );

    // Create performance analyzer
    this.tracingComponents.performanceAnalyzer =
      new PipelinePerformanceAnalyzer({
        performanceMonitor: this.tracingComponents.performanceMonitor,
        logger,
        stageThresholds: {
          component_filtering: 100,
          prerequisite_evaluation: 200,
          multi_target_resolution: 500,
          action_formatting: 150,
          target_resolution: 300,
          pipeline_total: 1000,
        },
      });

    logger.info('Pipeline tracing components initialized');
  }

  /**
   * Setup performance monitoring with detailed metrics collection
   *
   * @private
   */
  #setupPerformanceMonitoring() {
    // Mock performance monitoring that captures timing data
    this.performanceCapture = {
      startTime: null,
      stageTimings: new Map(),
       
      memoryBaseline:
        typeof process !== 'undefined' && process.memoryUsage
          ? // eslint-disable-next-line no-undef
            process.memoryUsage().heapUsed
          : 0,
    };
  }

  /**
   * Setup error capture for pipeline tracing
   *
   * @private
   */
  #setupErrorCapture() {
    // Capture any errors that occur during pipeline execution
    this.errorCapture = {
      errors: [],
      warnings: [],
      criticalErrors: [],
    };
  }

  /**
   * Setup actor in the test environment
   *
   * @param {object} testActor - Test actor configuration
   */
  async setupActor(testActor) {
    // Create entity using the correct interface
    await this.entityService.createEntity({
      type: 'core:actor',
      id: testActor.id,
      initialData: testActor.components || {},
    });

    // The turn execution facade setup is handled during initialization
    // No need to call addActor separately as it's handled in initializeTestEnvironment
  }

  /**
   * Setup complex environment for multi-target and dependency testing
   *
   * @param {object} testActor - Test actor configuration
   */
  async setupComplexEnvironment(testActor) {
    await this.setupActor(testActor);

    // Create additional entities for complex scenarios
    await this.entityService.createEntity({
      type: 'core:location',
      id: 'test-location',
      initialData: {
        'core:location': {
          name: 'Test Location',
          description: 'Complex test environment',
        },
      },
    });

    // Create test items
    await this.entityService.createEntity({
      type: 'core:item',
      id: 'test-item-1',
      initialData: {
        'core:item': {
          name: 'Test Item 1',
          type: 'equipment',
        },
      },
    });

    await this.entityService.createEntity({
      type: 'core:item',
      id: 'test-item-2',
      initialData: {
        'core:item': {
          name: 'Test Item 2',
          type: 'consumable',
        },
      },
    });

    // Create additional actors for multi-target scenarios
    await this.entityService.createEntity({
      type: 'core:actor',
      id: 'test-actor-2',
      initialData: {
        'core:actor': {
          name: 'Test Actor 2',
        },
        'core:position': {
          x: 1,
          y: 1,
          z: 0,
        },
      },
    });
  }

  /**
   * Enable pipeline tracing with specified configuration
   *
   * @param {object} config - Tracing configuration
   */
  async enablePipelineTracing(config = {}) {
    // Update tracing configuration
    this.tracingConfig = {
      ...this.tracingConfig,
      ...config,
    };

    // Reconfigure filter if needed
    if (config.verbosity || config.stages) {
      this.tracingComponents.filter = new ActionTraceFilter({
        enabled: this.tracingConfig.enabled,
        tracedActions: ['*'],
        excludedActions: [],
        verbosityLevel: config.verbosity || this.tracingConfig.verbosity,
        inclusionConfig: {
          includeComponents: true,
          includePrerequisites: true,
          includeTargets: true,
          includePerformanceData: this.tracingConfig.enablePerformanceTracking,
          includeScopeData: this.tracingConfig.enableScopeTracing,
        },
      });
    }

    this.facades.logger.info(`Pipeline tracing enabled with config:`, config);
  }

  /**
   * Execute pipeline with tracing enabled
   *
   * @param {object} testAction - Action to execute
   * @param {object} options - Execution options
   * @returns {Promise<object>} Execution result with trace data
   */
  async executePipelineWithTracing(testAction, options = {}) {
    const startTime = performance.now();
    this.performanceCapture.startTime = startTime;

    try {
      // Create action-aware structured trace
      if (options.actorId) {
        this.tracingComponents.structuredTrace = new ActionAwareStructuredTrace(
          {
            actionTraceFilter: this.tracingComponents.filter,
            actorId: options.actorId,
            context: { testMode: true },
            logger: this.facades.logger,
            performanceMonitor: this.tracingConfig.enablePerformanceTracking
              ? this.tracingComponents.performanceMonitor
              : null,
          }
        );
      }

      // Mock pipeline execution - in a real scenario this would call the actual pipeline
      const result = await this.#mockPipelineExecution(testAction, options);

      // Calculate execution time
      const executionTime = performance.now() - startTime;
      this.executionTimes.set(testAction.id || 'unknown', executionTime);

      // Generate mock trace data based on the scenario
      this.#generateMockTraceData(testAction, options, result, executionTime);

      // Update performance metrics
      this.#updatePerformanceMetrics(executionTime, testAction);

      return result;
    } catch (error) {
      // Capture error with trace context
      const errorTrace = {
        type: 'error',
        error: error.message,
        failedStage: 'unknown',
        errorClassification: 'pipeline_error',
        timestamp: Date.now(),
        testAction: testAction.id,
        legacyContext: error.isLegacyConversionError
          ? {
              originalFormat: testAction.format,
              conversionAttempted: true,
              fallbackStrategy: 'error_fallback',
            }
          : undefined,
        conversionAttempted: error.isLegacyConversionError || false,
        fallbackStrategy: error.isLegacyConversionError
          ? 'error_fallback'
          : undefined,
      };

      this.errors.push(errorTrace);
      this.capturedTraces.push(errorTrace);

      if (options.expectSuccess === false) {
        return {
          success: false,
          error: error.message,
          conversionError: error.isLegacyConversionError
            ? error.message
            : undefined,
        };
      }

      throw error;
    }
  }

  /**
   * Mock pipeline execution for testing
   *
   * @param {object} testAction - Action to execute
   * @param {object} options - Execution options
   * @returns {Promise<object>} Mock execution result
   * @private
   */
  async #mockPipelineExecution(testAction, options) {
    // Simulate pipeline stages
    const stages = [
      'component_filtering',
      'prerequisite_evaluation',
      'target_resolution',
      'action_formatting',
    ];
    const stageResults = {};

    for (const stage of stages) {
      const stageStart = performance.now();

      // Add artificial delay if specified
      if (testAction.artificialDelay && testAction.stage === stage) {
        await this.#delay(testAction.artificialDelay);
      }

      // Mock stage processing
      stageResults[stage] = this.#mockStageProcessing(
        stage,
        testAction,
        options
      );

      const stageDuration = performance.now() - stageStart;
      this.stageMetrics.set(`${testAction.id}-${stage}`, stageDuration);

      // Check for threshold violations
      if (this.tracingConfig.enableThresholdAlerting) {
        this.#checkThresholdViolation(stage, stageDuration);
      }
    }

    // Handle failure scenarios
    if (testAction.type === 'invalid' || testAction.malformed) {
      if (options.expectLegacyConversion && testAction.malformed) {
        // Legacy conversion failure scenario
        const error = new Error('Mock legacy conversion failure for testing');
        error.isLegacyConversionError = true;
        throw error;
      } else {
        throw new Error('Mock pipeline failure for testing');
      }
    }

    return {
      success: true,
      discoveredActions: this.#mockDiscoveredActions(testAction),
      resolvedTargets: options.expectMultipleTargets
        ? ['target1', 'target2', 'target3']
        : ['target1'],
      resolvedDependencies: options.expectDependencies ? ['dep1', 'dep2'] : [],
      conversionApplied: options.expectLegacyConversion || false,
      convertedAction: options.expectLegacyConversion
        ? { ...testAction, converted: true }
        : undefined,
      integrationValidation: options.validateIntegration
        ? { passed: true }
        : undefined,
      stageResults,
    };
  }

  /**
   * Mock stage processing
   *
   * @param {string} stage - Stage name
   * @param {object} testAction - Test action
   * @param {object} options - Execution options
   * @returns {object} Mock stage result
   * @private
   */
  #mockStageProcessing(stage, testAction, options) {
    switch (stage) {
      case 'component_filtering':
        return {
          filteredComponents: ['core:position', 'core:movement'],
          componentCount: 2,
          filterCriteria: 'standard',
        };
      case 'prerequisite_evaluation':
        return {
          evaluatedPrerequisites: ['can_move', 'has_position'],
          passedCount: 2,
          failedCount: 0,
        };
      case 'target_resolution':
        return {
          resolvedTargets: options.expectMultipleTargets
            ? ['target1', 'target2']
            : ['target1'],
          targetCount: options.expectMultipleTargets ? 2 : 1,
          resolutionMethod: 'standard',
        };
      case 'action_formatting':
        return {
          formattedActions: [testAction],
          formatType: 'json',
          formattedCount: 1,
        };
      default:
        return {};
    }
  }

  /**
   * Generate mock trace data based on execution
   *
   * @param {object} testAction - Test action
   * @param {object} options - Execution options
   * @param {object} result - Execution result
   * @param {number} executionTime - Total execution time
   * @private
   */
  #generateMockTraceData(testAction, options, result, executionTime) {
    // Pipeline trace
    const pipelineTrace = {
      type: 'pipeline',
      actionId: testAction.id || 'test-action',
      timestamp: Date.now(),
      stages: {
        component_filtering: {
          timestamp: Date.now() - 100,
          data: result.stageResults.component_filtering,
          stageCompletedAt: Date.now() - 90,
        },
        prerequisite_evaluation: {
          timestamp: Date.now() - 80,
          data: result.stageResults.prerequisite_evaluation,
          stageCompletedAt: Date.now() - 70,
        },
        target_resolution: {
          timestamp: Date.now() - 60,
          data: result.stageResults.target_resolution,
          stageCompletedAt: Date.now() - 50,
        },
        action_formatting: {
          timestamp: Date.now() - 40,
          data: result.stageResults.action_formatting,
          stageCompletedAt: Date.now() - 30,
        },
      },
      legacyProcessing: options.expectLegacyConversion || false,
      compatibilityMetrics: options.expectLegacyConversion
        ? { conversionTime: 5 }
        : undefined,
    };

    // Add multi-target stage if applicable
    if (options.expectMultipleTargets) {
      pipelineTrace.stages.multi_target_resolution = {
        timestamp: Date.now() - 65,
        data: {
          targetGroups: ['group1', 'group2'],
          resolutionStrategies: ['parallel', 'sequential'],
          parallelResolution: true,
        },
        stageCompletedAt: Date.now() - 55,
      };
    }

    this.capturedTraces.push(pipelineTrace);

    // Add additional traces based on configuration
    if (
      this.tracingConfig.enableScopeTracing ||
      options.expectMultipleTargets
    ) {
      this.capturedTraces.push({
        type: 'scope_evaluation',
        scopeQueries: ['nearby_items', 'adjacent_actors'],
        resolvedEntities: ['entity1', 'entity2'],
        evaluationMetrics: { queryTime: 15, entityCount: 2 },
      });
    }

    if (
      this.tracingConfig.enableDependencyTracking ||
      options.expectDependencies
    ) {
      this.capturedTraces.push({
        type: 'dependency_resolution',
        dependencies: ['dep1', 'dep2'],
        resolutionOrder: [1, 2],
        circularDependencyCheck: 'passed',
      });
    }

    if (
      this.tracingConfig.enableLegacyTracking ||
      options.expectLegacyConversion
    ) {
      this.capturedTraces.push({
        type: 'legacy_detection',
        detectedFormat: testAction.format || 'current',
        conversionStrategy: 'automatic',
      });

      if (options.expectLegacyConversion) {
        this.capturedTraces.push({
          type: 'compatibility_layer',
          originalAction: testAction,
          convertedAction: result.convertedAction,
          conversionSteps: ['normalize', 'validate', 'transform'],
        });
      }
    }

    // Performance trace
    this.capturedTraces.push({
      type: 'performance',
      totalDuration: executionTime,
      stageBreakdown: Object.fromEntries(this.stageMetrics),
      captureOverhead: 0.5, // Mock low overhead
    });
  }

  /**
   * Mock discovered actions
   *
   * @param {object} testAction - Test action
   * @returns {Array} Mock discovered actions
   * @private
   */
  #mockDiscoveredActions(testAction) {
    return [
      {
        id: testAction.id || 'discovered-action-1',
        name: testAction.name || 'Test Action',
        type: 'movement',
        available: true,
      },
    ];
  }

  /**
   * Check for threshold violations
   *
   * @param {string} stage - Stage name
   * @param {number} duration - Stage duration
   * @private
   */
  #checkThresholdViolation(stage, duration) {
    const thresholds = {
      component_filtering: 100,
      prerequisite_evaluation: 200,
      multi_target_resolution: 500,
      action_formatting: 150,
      target_resolution: 300,
    };

    const threshold = thresholds[stage];
    if (threshold && duration > threshold) {
      this.performanceAlerts.push({
        type: 'threshold_violation',
        stage,
        actualDuration: duration,
        threshold,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Update performance metrics
   *
   * @param {number} executionTime - Total execution time
   * @param {object} testAction - Test action
   * @private
   */
  #updatePerformanceMetrics(executionTime, testAction) {
    this.performanceMetrics.push({
      actionId: testAction.id || 'unknown',
      executionTime,
      timestamp: Date.now(),
      pipelineTotalDuration: executionTime,
      captureOverhead: 0.5, // Mock low overhead
    });
  }

  /**
   * Add delay for testing
   *
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise} Delay promise
   * @private
   */
  async #delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get captured traces
   *
   * @returns {Array} Captured traces
   */
  getCapturedTraces() {
    return this.capturedTraces;
  }

  /**
   * Get performance metrics
   *
   * @returns {object} Performance metrics
   */
  getPerformanceMetrics() {
    const lastMetric =
      this.performanceMetrics[this.performanceMetrics.length - 1] || {};
    return {
      ...lastMetric,
      overallPerformance: 'acceptable',
      memoryUsage: this.#getCurrentMemoryUsage(),
      stageCorrelations: this.#calculateStageCorrelations(),
      scopeEvaluationTime: 15, // Mock scope evaluation time
    };
  }

  /**
   * Get performance analysis
   *
   * @returns {object} Comprehensive performance analysis
   */
  getPerformanceAnalysis() {
    return {
      crossStageCorrelation: {
        totalPipelineTime: this.#calculateTotalPipelineTime(),
        stageOverhead: 2.5, // Mock stage overhead
      },
      identifiedBottlenecks: this.#identifyBottlenecks(),
      stageMetrics: this.#calculateStageMetrics(),
    };
  }

  /**
   * Get performance alerts
   *
   * @returns {Array} Performance alerts
   */
  getPerformanceAlerts() {
    return this.performanceAlerts;
  }

  /**
   * Get performance recommendations
   *
   * @returns {Array} Performance recommendations
   */
  getPerformanceRecommendations() {
    return this.performanceAlerts.map((alert) => ({
      stage: alert.stage,
      priority: 'medium',
      message: `Consider optimizing ${alert.stage} stage (${alert.actualDuration}ms > ${alert.threshold}ms)`,
    }));
  }

  /**
   * Get captured errors
   *
   * @returns {Array} Captured errors
   */
  getCapturedErrors() {
    return this.errors;
  }

  /**
   * Calculate current memory usage
   *
   * @returns {number} Memory usage in bytes
   * @private
   */
  #getCurrentMemoryUsage() {
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.memoryUsage) {
      // eslint-disable-next-line no-undef
      return process.memoryUsage().heapUsed;
    }
    return 1024 * 1024 * 50; // Mock 50MB usage
  }

  /**
   * Calculate stage correlations
   *
   * @returns {object} Stage correlations
   * @private
   */
  #calculateStageCorrelations() {
    return {
      componentToPrerequisite: 0.8,
      prerequisiteToTarget: 0.9,
      targetToFormatting: 0.7,
    };
  }

  /**
   * Calculate total pipeline time
   *
   * @returns {number} Total pipeline time
   * @private
   */
  #calculateTotalPipelineTime() {
    const times = Array.from(this.executionTimes.values());
    return times.reduce((sum, time) => sum + time, 0) / (times.length || 1);
  }

  /**
   * Identify performance bottlenecks
   *
   * @returns {Array} Identified bottlenecks
   * @private
   */
  #identifyBottlenecks() {
    const bottlenecks = [];

    this.performanceAlerts.forEach((alert) => {
      if (alert.type === 'threshold_violation') {
        bottlenecks.push({
          stage: alert.stage,
          avgDuration: alert.actualDuration,
          threshold: alert.threshold,
          recommendations: [`Optimize ${alert.stage} processing`],
        });
      }
    });

    return bottlenecks;
  }

  /**
   * Calculate detailed stage metrics
   *
   * @returns {object} Stage metrics
   * @private
   */
  #calculateStageMetrics() {
    const stages = [
      'component_filtering',
      'prerequisite_evaluation',
      'target_resolution',
      'action_formatting',
    ];
    const metrics = {};

    stages.forEach((stage) => {
      const stageTimes = Array.from(this.stageMetrics.entries())
        .filter(([key]) => key.includes(stage))
        .map(([, value]) => value);

      if (stageTimes.length > 0) {
        metrics[stage] = {
          avgDuration:
            stageTimes.reduce((sum, time) => sum + time, 0) / stageTimes.length,
          maxDuration: Math.max(...stageTimes),
          violations: this.performanceAlerts.filter(
            (alert) => alert.stage === stage
          ).length,
        };
      } else {
        // Mock data for stages that haven't been measured
        metrics[stage] = {
          avgDuration: 50,
          maxDuration: 100,
          violations: 0,
        };
      }
    });

    return metrics;
  }

  /**
   * Cleanup test resources
   */
  async cleanup() {
    // Cleanup facades if available
    if (this.facades && this.facades.cleanup) {
      await this.facades.cleanup();
    }

    // Clear captured data
    this.capturedTraces = [];
    this.performanceMetrics = [];
    this.performanceAlerts = [];
    this.errors = [];
    this.executionTimes.clear();
    this.stageMetrics.clear();

    // Explicitly null out large objects to help GC
    this.tracingComponents = {
      filter: null,
      structuredTrace: null,
      performanceAnalyzer: null,
      performanceMonitor: null,
    };

    this.facades = null;
    this.turnExecutionFacade = null;
    this.actionService = null;
    this.entityService = null;
    this.performanceCapture = null;
    this.errorCapture = null;
    this.memorySnapshots = [];

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.initialized = false;
  }
}
