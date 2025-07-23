/**
 * @file ActionProcessingTestModule - Test module for action discovery and processing
 * @description Provides fluent API for configuring action-related tests
 */

import { createMockFacades } from '../../../../src/testing/facades/testingFacadeRegistrations.js';
import { ITestModule } from '../interfaces/ITestModule.js';
import { TestModuleValidationError } from '../errors/testModuleValidationError.js';
import { TestModuleValidator } from '../validation/testModuleValidator.js';

/**
 * Test module for action discovery and processing.
 * Provides focused testing capabilities for action-related functionality
 * without the overhead of full turn execution.
 *
 * @augments ITestModule
 * @example
 * const testEnv = await new ActionProcessingTestModule()
 *   .forActor('test-actor')
 *   .withAvailableActions(['move', 'look', 'take'])
 *   .withMockDiscovery({ returnEmpty: false })
 *   .withValidationRules({ requireTarget: true })
 *   .build();
 */
export class ActionProcessingTestModule extends ITestModule {
  #config = {
    actorId: null,
    actions: [],
    mockDiscovery: null,
    mockValidation: null,
    mockExecution: null,
    facades: {},
  };

  #mockFn = null; // Jest mock function creator

  /**
   * Creates a new ActionProcessingTestModule instance
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   */
  constructor(mockFn = null) {
    super();
    this.#mockFn = mockFn;
    this.#applyDefaults();
  }

  /**
   * Apply default configuration values
   *
   * @private
   */
  #applyDefaults() {
    this.#config = {
      actorId: 'test-actor',
      actions: [],
      mockDiscovery: {
        returnEmpty: false,
        customLogic: null,
      },
      mockValidation: {
        alwaysValid: true,
        customRules: {},
      },
      mockExecution: {
        alwaysSucceed: true,
        customResults: {},
      },
      facades: {},
    };
  }

  /**
   * Set the actor ID for action processing
   *
   * @param {string} actorId - The actor ID
   * @returns {ActionProcessingTestModule} This instance for chaining
   */
  forActor(actorId) {
    this.#config.actorId = actorId;
    return this;
  }

  /**
   * Configure available actions
   *
   * @param {Array<string|object>} actions - Available actions
   * @returns {ActionProcessingTestModule} This instance for chaining
   * @example
   * // Simple action IDs
   * .withAvailableActions(['move', 'look', 'take'])
   * @example
   * // Detailed action configurations
   * .withAvailableActions([
   *   { id: 'move', requiresTarget: true },
   *   { id: 'look', alwaysAvailable: true }
   * ])
   */
  withAvailableActions(actions = []) {
    // Store actions directly if not an array (for validation testing)
    if (!Array.isArray(actions)) {
      this.#config.actions = actions;
    } else {
      this.#config.actions = actions.map((action) =>
        typeof action === 'string' ? { id: action } : action
      );
    }
    return this;
  }

  /**
   * Configure mock discovery behavior
   *
   * @param {object} mockConfig - Mock discovery configuration
   * @param {boolean} [mockConfig.returnEmpty] - Whether to return empty actions
   * @param {Function} [mockConfig.customLogic] - Custom discovery logic
   * @param {object} [mockConfig.byContext] - Context-specific returns
   * @returns {ActionProcessingTestModule} This instance for chaining
   */
  withMockDiscovery(mockConfig = {}) {
    this.#config.mockDiscovery = {
      ...this.#config.mockDiscovery,
      ...mockConfig,
    };
    return this;
  }

  /**
   * Configure mock validation behavior
   *
   * @param {object} validationConfig - Validation configuration
   * @param {boolean} [validationConfig.alwaysValid] - Whether all actions are valid
   * @param {object} [validationConfig.customRules] - Custom validation rules by action ID
   * @param {boolean} [validationConfig.requireTarget] - Whether to require targets
   * @returns {ActionProcessingTestModule} This instance for chaining
   */
  withValidationRules(validationConfig = {}) {
    this.#config.mockValidation = {
      ...this.#config.mockValidation,
      ...validationConfig,
    };
    return this;
  }

  /**
   * Configure mock execution behavior
   *
   * @param {object} executionConfig - Execution configuration
   * @param {boolean} [executionConfig.alwaysSucceed] - Whether execution always succeeds
   * @param {object} [executionConfig.customResults] - Custom results by action ID
   * @param {Array<string>} [executionConfig.defaultEffects] - Default effects for all actions
   * @returns {ActionProcessingTestModule} This instance for chaining
   */
  withExecutionBehavior(executionConfig = {}) {
    this.#config.mockExecution = {
      ...this.#config.mockExecution,
      ...executionConfig,
    };
    return this;
  }

  /**
   * Override specific facades with custom implementations
   *
   * @param {object} facades - Custom facade implementations
   * @returns {ActionProcessingTestModule} This instance for chaining
   */
  withCustomFacades(facades = {}) {
    this.#config.facades = facades;
    return this;
  }

  /**
   * Configure performance monitoring for action operations
   *
   * @param {object} [options] - Performance options
   * @param {number} [options.discoveryThreshold] - Discovery time threshold in ms
   * @param {number} [options.validationThreshold] - Validation time threshold in ms
   * @param {number} [options.executionThreshold] - Execution time threshold in ms
   * @returns {ActionProcessingTestModule} This instance for chaining
   */
  withPerformanceMonitoring(options = {}) {
    this.#config.performanceMonitoring = {
      enabled: true,
      thresholds: {
        discovery: options.discoveryThreshold || 50,
        validation: options.validationThreshold || 10,
        execution: options.executionThreshold || 100,
      },
    };
    return this;
  }

  /**
   * Validate configuration before building
   *
   * @returns {import('../validation/testModuleValidator.js').ValidationResult}
   */
  validate() {
    return TestModuleValidator.validateConfiguration(
      this.#config,
      'actionProcessing'
    );
  }

  /**
   * Build the test environment
   *
   * @returns {Promise<import('../interfaces/ITestModule.js').TestEnvironment>}
   * @throws {TestModuleValidationError} If configuration is invalid
   */
  async build() {
    // Validate configuration
    const validation = this.validate();
    if (!validation.valid) {
      throw new TestModuleValidationError(
        'Invalid action processing module configuration',
        validation.errors
      );
    }

    // Create facades with configuration
    const facades = createMockFacades(
      this.#config.facades,
      this.#mockFn || (() => () => {})
    );

    // Configure action service mocks
    this.#configureActionServiceMocks(facades.actionService);

    // Create performance tracker if enabled
    const performanceTracker = this.#config.performanceMonitoring?.enabled
      ? this.#createPerformanceTracker()
      : null;

    // Return test environment focused on action processing
    return {
      actorId: this.#config.actorId,
      facades,
      config: Object.freeze({ ...this.#config }),

      // Action-focused convenience methods
      async discoverActions(actorId = this.#config.actorId) {
        const startTime = performanceTracker ? Date.now() : null;

        const result = await facades.actionService.discoverActions(actorId);

        if (performanceTracker) {
          performanceTracker.recordDiscovery(Date.now() - startTime);
        }

        return result;
      },

      async validateAction(actionId, targets = {}) {
        const startTime = performanceTracker ? Date.now() : null;

        const result = await facades.actionService.validateAction({
          actionId,
          actorId: this.#config.actorId,
          targets,
        });

        if (performanceTracker) {
          performanceTracker.recordValidation(Date.now() - startTime);
        }

        return result;
      },

      async executeAction(actionId, targets = {}) {
        const startTime = performanceTracker ? Date.now() : null;

        const result = await facades.actionService.executeAction({
          actionId,
          actorId: this.#config.actorId,
          targets,
        });

        if (performanceTracker) {
          performanceTracker.recordExecution(Date.now() - startTime);
        }

        return result;
      },

      async processActionCandidate(candidate) {
        // Full action processing pipeline
        const validation = await this.validateAction(
          candidate.actionId,
          candidate.targets
        );
        if (!validation.success) {
          return { success: false, validation };
        }

        const execution = await this.executeAction(
          candidate.actionId,
          candidate.targets
        );
        return { success: execution.success, validation, execution };
      },

      // Mock configuration methods
      setAvailableActions(actions) {
        facades.actionService.setMockActions(this.#config.actorId, actions);
      },

      setValidationResult(actionId, result) {
        facades.actionService.setMockValidation(
          this.#config.actorId,
          actionId,
          result
        );
      },

      setExecutionResult(actionId, result) {
        facades.actionService.setMockExecution(
          this.#config.actorId,
          actionId,
          result
        );
      },

      async cleanup() {
        facades.actionService.clearMockData();
      },

      // Add performance methods if enabled
      ...(performanceTracker && {
        getPerformanceMetrics: () => performanceTracker.getMetrics(),
        checkPerformanceThresholds: () => performanceTracker.checkThresholds(),
      }),
    };
  }

  /**
   * Reset module to default configuration
   *
   * @returns {ActionProcessingTestModule} This instance for chaining
   */
  reset() {
    this.#applyDefaults();
    return this;
  }

  /**
   * Get a frozen copy of the current configuration
   *
   * @returns {object} Current configuration
   */
  getConfiguration() {
    return Object.freeze(JSON.parse(JSON.stringify(this.#config)));
  }

  /**
   * Clone this module with its current configuration
   *
   * @returns {ActionProcessingTestModule} New instance with same configuration
   */
  clone() {
    const cloned = new ActionProcessingTestModule(this.#mockFn);
    cloned.#config = JSON.parse(JSON.stringify(this.#config));
    return cloned;
  }

  /**
   * Configure action service mocks based on module configuration
   *
   * @private
   * @param {object} actionService - Action service facade
   */
  #configureActionServiceMocks(actionService) {
    // Set up discovery mocks
    if (this.#config.mockDiscovery) {
      if (this.#config.mockDiscovery.returnEmpty) {
        actionService.setMockActions(this.#config.actorId, []);
      } else if (this.#config.actions.length > 0) {
        actionService.setMockActions(
          this.#config.actorId,
          this.#config.actions
        );
      }

      if (this.#config.mockDiscovery.customLogic && this.#mockFn) {
        // Override discovery method with custom logic
        actionService.discoverActions = this.#mockFn().mockImplementation(
          this.#config.mockDiscovery.customLogic
        );
      }
    }

    // Set up validation mocks
    if (
      this.#config.mockValidation &&
      this.#config.mockValidation.customRules
    ) {
      Object.entries(this.#config.mockValidation.customRules).forEach(
        ([actionId, rule]) => {
          actionService.setMockValidation(this.#config.actorId, actionId, rule);
        }
      );
    }

    // Set up execution mocks
    if (
      this.#config.mockExecution &&
      this.#config.mockExecution.customResults
    ) {
      Object.entries(this.#config.mockExecution.customResults).forEach(
        ([actionId, result]) => {
          actionService.setMockExecution(
            this.#config.actorId,
            actionId,
            result
          );
        }
      );
    }
  }

  /**
   * Create performance tracking utilities
   *
   * @private
   * @returns {object} Performance tracking utilities
   */
  #createPerformanceTracker() {
    const metrics = {
      discovery: [],
      validation: [],
      execution: [],
    };

    const thresholds = this.#config.performanceMonitoring.thresholds;

    return {
      recordDiscovery: (duration) => metrics.discovery.push(duration),
      recordValidation: (duration) => metrics.validation.push(duration),
      recordExecution: (duration) => metrics.execution.push(duration),

      getMetrics: () => ({
        discovery: this.#calculateStats(metrics.discovery),
        validation: this.#calculateStats(metrics.validation),
        execution: this.#calculateStats(metrics.execution),
      }),

      checkThresholds: () => {
        const violations = [];

        const checks = [
          {
            name: 'discovery',
            data: metrics.discovery,
            threshold: thresholds.discovery,
          },
          {
            name: 'validation',
            data: metrics.validation,
            threshold: thresholds.validation,
          },
          {
            name: 'execution',
            data: metrics.execution,
            threshold: thresholds.execution,
          },
        ];

        checks.forEach(({ name, data, threshold }) => {
          const avg = this.#calculateAverage(data);
          if (avg > threshold) {
            violations.push({
              metric: name,
              threshold,
              actual: avg,
            });
          }
        });

        return violations;
      },
    };
  }

  /**
   * Calculate statistics for an array of numbers
   *
   * @private
   * @param {number[]} values - Array of numeric values
   * @returns {object} Statistics
   */
  #calculateStats(values) {
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0 };
    }

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: this.#calculateAverage(values),
    };
  }

  /**
   * Calculate average of an array of numbers
   *
   * @private
   * @param {number[]} values - Array of numeric values
   * @returns {number} Average value
   */
  #calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}
