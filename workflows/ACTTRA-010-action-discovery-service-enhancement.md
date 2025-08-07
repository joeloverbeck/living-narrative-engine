# ACTTRA-010: ActionDiscoveryService Enhancement for Action Tracing

## Executive Summary

### Problem Statement

The ActionDiscoveryService currently manages action discovery pipeline execution but lacks integration with the action tracing system. We need to enhance the service to create action-aware trace contexts when tracing is enabled while maintaining full backward compatibility with existing code that uses the service.

### Solution Approach

Enhance the existing `getValidActions` method to detect when action tracing should be enabled and dynamically create ActionAwareStructuredTrace instances. The enhancement will be completely transparent to existing consumers and will only activate when action tracing is configured and enabled.

### Business Value

- Enables comprehensive action pipeline debugging without code changes to consumers
- Provides entry point for action-specific tracing throughout the discovery pipeline
- Maintains zero performance impact when tracing is disabled
- Creates foundation for detailed action flow analysis and optimization

## Technical Requirements

### Functional Requirements

#### FR-010-01: Transparent Tracing Integration

- Must detect when action tracing should be enabled based on configuration
- Must create ActionAwareStructuredTrace when appropriate without breaking existing API
- Must maintain full backward compatibility with all existing consumers
- Must pass enhanced trace through entire pipeline seamlessly

#### FR-010-02: Dynamic Trace Context Creation

- Must create ActionAwareStructuredTrace instances when tracing is enabled
- Must inject ActionTraceFilter dependency into trace contexts
- Must provide actor context to action-aware traces
- Must handle trace creation failures gracefully with fallback to standard traces

#### FR-010-03: Pipeline Context Enhancement

- Must pass action-aware trace context through all pipeline stages
- Must enable stages to capture action-specific data when tracing is active
- Must maintain existing trace functionality for non-action-specific operations
- Must support both traced and non-traced actions in the same pipeline run

#### FR-010-04: Configuration-Driven Activation

- Must activate action tracing based on ActionTraceFilter configuration
- Must respect global enable/disable settings for action tracing
- Must handle configuration changes without service restart
- Must provide debugging information for trace activation decisions

### Non-Functional Requirements

#### NFR-010-01: Performance

- <2ms overhead when action tracing is disabled
- <5ms additional overhead per traced action when enabled
- No impact on pipeline processing speed for non-traced actions
- Memory overhead <1MB per discovery session when tracing enabled

#### NFR-010-02: Reliability

- Must never cause pipeline failures due to tracing issues
- Must handle ActionTraceFilter failures gracefully
- Must provide clear error messages for tracing setup issues
- Must fall back to standard traces when action-aware traces fail

#### NFR-010-03: Maintainability

- Must follow existing service patterns and conventions
- Must use dependency injection for all tracing components
- Must include comprehensive logging for debugging trace activation
- Must maintain clear separation between discovery logic and tracing logic

## Architecture Design

### Current Architecture

```
ActionDiscoveryService
  ↓
getValidActions(actor, baseContext, options)
  ↓
TraceContextFactory.create() → StructuredTrace
  ↓
Pipeline stages process with standard trace
```

### Enhanced Architecture

```
ActionDiscoveryService
  ↓
getValidActions(actor, baseContext, options)
  ↓
TraceActivationDecision → ActionTraceFilter.isEnabled()
  ↓
[If tracing enabled]
ActionAwareTraceFactory.create() → ActionAwareStructuredTrace
[Else]
TraceContextFactory.create() → StructuredTrace
  ↓
Pipeline stages process with appropriate trace type
```

### Key Components

#### Enhanced ActionDiscoveryService

- Detects when action tracing should be active
- Creates appropriate trace instances based on configuration
- Manages fallback scenarios for trace creation failures
- Maintains existing API compatibility

#### Trace Activation Logic

- Evaluates ActionTraceFilter.isEnabled()
- Checks for actor ID availability for trace context
- Handles trace creation exceptions gracefully
- Logs trace activation decisions for debugging

## Implementation Steps

### Step 1: Enhance ActionDiscoveryService

Modify `src/actions/actionDiscoveryService.js`:

```javascript
/**
 * @file ActionDiscoveryService - Enhanced with action tracing capabilities
 */

import { validateDependency, assertPresent } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import PipelineResult from './pipeline/pipelineResult.js';

class ActionDiscoveryService {
  #actionIndex;
  #discoveryPipeline;
  #traceContextFactory;
  #actionAwareTraceFactory; // New dependency
  #actionTraceFilter; // New dependency
  #logger;

  constructor({
    actionIndex,
    discoveryPipeline,
    traceContextFactory,
    actionAwareTraceFactory = null, // Optional for backward compatibility
    actionTraceFilter = null, // Optional for backward compatibility
    logger,
  }) {
    validateDependency(actionIndex, 'IActionIndex');
    validateDependency(discoveryPipeline, 'IDiscoveryPipeline');
    validateDependency(traceContextFactory, 'ITraceContextFactory');
    this.#logger = ensureValidLogger(logger, 'ActionDiscoveryService');

    this.#actionIndex = actionIndex;
    this.#discoveryPipeline = discoveryPipeline;
    this.#traceContextFactory = traceContextFactory;

    // New optional dependencies for action tracing
    if (actionAwareTraceFactory) {
      validateDependency(
        actionAwareTraceFactory,
        'IActionAwareTraceFactory',
        null,
        {
          requiredMethods: ['create'],
        }
      );
      this.#actionAwareTraceFactory = actionAwareTraceFactory;
    }

    if (actionTraceFilter) {
      validateDependency(actionTraceFilter, 'IActionTraceFilter', null, {
        requiredMethods: ['isEnabled', 'shouldTrace'],
      });
      this.#actionTraceFilter = actionTraceFilter;
    }
  }

  /**
   * Get valid actions for actor using discovery pipeline
   * Enhanced with action tracing capabilities
   *
   * @param {Object} actorEntity - Actor entity with components
   * @param {Object} baseContext - Base context for action resolution
   * @param {Object} options - Discovery options
   * @param {boolean} options.trace - Enable tracing for this discovery
   * @returns {Promise<PipelineResult>}
   */
  async getValidActions(actorEntity, baseContext, options = {}) {
    const { trace: shouldTrace = false } = options;
    const source = 'ActionDiscoveryService.getValidActions';

    assertPresent(actorEntity, 'Actor entity is required');
    assertPresent(actorEntity.id, 'Actor entity must have an ID');

    try {
      // Create appropriate trace based on tracing configuration
      const trace = shouldTrace
        ? await this.#createTraceContext(actorEntity.id, baseContext, options)
        : null;

      this.#logger.debug(
        `Starting action discovery for actor ${actorEntity.id}`,
        {
          actorId: actorEntity.id,
          traceEnabled: !!trace,
          actionTracingEnabled: this.#isActionTracingEnabled(),
          options,
        }
      );

      // Log trace type for debugging
      if (trace) {
        const traceType = this.#getTraceTypeName(trace);
        this.#logger.debug(`Created ${traceType} for actor ${actorEntity.id}`, {
          actorId: actorEntity.id,
          traceType,
        });
      }

      // Execute pipeline with enhanced trace
      if (trace?.withSpanAsync) {
        return await trace.withSpanAsync(
          'action-discovery',
          { actorId: actorEntity.id },
          async (span) => {
            span.info(
              `Discovering actions for actor: ${actorEntity.id}`,
              source
            );
            return await this.#executePipeline(
              actorEntity,
              baseContext,
              trace,
              options
            );
          }
        );
      }

      // Fallback for traces without span support
      if (trace) {
        trace.info(`Discovering actions for actor: ${actorEntity.id}`, source);
      }

      return await this.#executePipeline(
        actorEntity,
        baseContext,
        trace,
        options
      );
    } catch (error) {
      this.#logger.error(
        `ActionDiscoveryService: Error during action discovery for actor ${actorEntity.id}`,
        error
      );

      return PipelineResult.failure(
        `Failed to discover actions for actor ${actorEntity.id}`,
        { originalError: error.message }
      );
    }
  }

  /**
   * Create appropriate trace context based on action tracing configuration
   *
   * @private
   * @param {string} actorId - Actor ID for trace context
   * @param {Object} baseContext - Base context for tracing
   * @param {Object} options - Discovery options
   * @returns {Promise<StructuredTrace|ActionAwareStructuredTrace|null>}
   */
  async #createTraceContext(actorId, baseContext, options) {
    try {
      // Check if action tracing should be enabled
      const actionTracingEnabled = this.#isActionTracingEnabled();

      if (actionTracingEnabled && this.#actionAwareTraceFactory) {
        this.#logger.debug(
          `Creating ActionAwareStructuredTrace for actor ${actorId}`,
          { actorId, actionTracingEnabled }
        );

        // Create action-aware trace
        const actionAwareTrace = await this.#actionAwareTraceFactory.create({
          actorId,
          enableActionTracing: true,
          context: {
            ...baseContext,
            discoveryOptions: options,
            createdAt: Date.now(),
          },
        });

        return actionAwareTrace;
      }

      // Fall back to standard trace
      this.#logger.debug(
        `Creating standard StructuredTrace for actor ${actorId}`,
        {
          actorId,
          actionTracingEnabled,
          hasActionAwareFactory: !!this.#actionAwareTraceFactory,
        }
      );

      return this.#traceContextFactory.create({
        actorId,
        context: {
          ...baseContext,
          discoveryOptions: options,
          createdAt: Date.now(),
        },
      });
    } catch (error) {
      this.#logger.error(
        `Failed to create trace context for actor ${actorId}, falling back to standard trace`,
        error
      );

      // Always fall back to standard trace on error
      try {
        return this.#traceContextFactory.create({
          actorId,
          context: baseContext,
        });
      } catch (fallbackError) {
        this.#logger.error(
          `Failed to create fallback trace context for actor ${actorId}`,
          fallbackError
        );
        return null;
      }
    }
  }

  /**
   * Check if action tracing is enabled
   *
   * @private
   * @returns {boolean}
   */
  #isActionTracingEnabled() {
    try {
      return this.#actionTraceFilter?.isEnabled() || false;
    } catch (error) {
      this.#logger.warn(
        'Error checking action tracing status, assuming disabled',
        error
      );
      return false;
    }
  }

  /**
   * Get trace type name for debugging
   *
   * @private
   * @param {Object} trace - Trace instance
   * @returns {string}
   */
  #getTraceTypeName(trace) {
    if (trace?.captureActionData) {
      return 'ActionAwareStructuredTrace';
    }
    if (trace?.step) {
      return 'StructuredTrace';
    }
    return 'UnknownTrace';
  }

  /**
   * Execute discovery pipeline with provided trace
   *
   * @private
   */
  async #executePipeline(actorEntity, baseContext, trace, options) {
    const pipelineContext = {
      actor: actorEntity,
      actionContext: baseContext,
      trace,
      options,
      data: {},
    };

    // Execute the pipeline
    const result = await this.#discoveryPipeline.execute(pipelineContext);

    // Log pipeline completion with action tracing statistics
    if (
      trace?.getTracedActions &&
      typeof trace.getTracedActions === 'function'
    ) {
      const tracedActions = trace.getTracedActions();
      const tracingSummary = trace.getTracingSummary?.() || {};

      this.#logger.info(
        `Action discovery completed for actor ${actorEntity.id} with action tracing`,
        {
          actorId: actorEntity.id,
          success: result.success,
          tracedActionCount: tracedActions.size,
          totalStagesTracked: tracingSummary.totalStagesTracked || 0,
          sessionDuration: tracingSummary.sessionDuration || 0,
        }
      );
    } else {
      this.#logger.info(
        `Action discovery completed for actor ${actorEntity.id}`,
        {
          actorId: actorEntity.id,
          success: result.success,
          traceType: this.#getTraceTypeName(trace),
        }
      );
    }

    return result;
  }

  /**
   * Get action index for external access (existing method)
   *
   * @returns {Object} Action index instance
   */
  getActionIndex() {
    return this.#actionIndex;
  }

  /**
   * Get discovery pipeline for external access (existing method)
   *
   * @returns {Object} Discovery pipeline instance
   */
  getDiscoveryPipeline() {
    return this.#discoveryPipeline;
  }

  /**
   * Check if action tracing is available (new method)
   *
   * @returns {boolean} True if action tracing is configured and available
   */
  isActionTracingAvailable() {
    return !!(this.#actionAwareTraceFactory && this.#actionTraceFilter);
  }

  /**
   * Get action tracing status for debugging (new method)
   *
   * @returns {Object} Action tracing status information
   */
  getActionTracingStatus() {
    return {
      available: this.isActionTracingAvailable(),
      enabled: this.#isActionTracingEnabled(),
      hasFilter: !!this.#actionTraceFilter,
      hasFactory: !!this.#actionAwareTraceFactory,
    };
  }
}

export default ActionDiscoveryService;
```

### Step 2: Update Dependency Injection Registration

Modify `src/dependencyInjection/containers/actionsContainer.js`:

```javascript
/**
 * Enhanced actions container registration with action tracing support
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ServiceSetup } from '../../utils/serviceInitializerUtils.js';
import { tokens } from '../tokens.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';
import ActionDiscoveryService from '../../actions/actionDiscoveryService.js';

export function registerActionsServices(container) {
  const setup = new ServiceSetup();

  // Enhanced ActionDiscoveryService registration with action tracing support
  container.register(
    tokens.IActionDiscoveryService,
    (deps) => {
      const logger = setup.setupService('ActionDiscoveryService', deps.logger, {
        actionIndex: {
          value: deps.actionIndex,
          requiredMethods: ['getCandidateActions', 'getActionById'],
        },
        discoveryPipeline: {
          value: deps.discoveryPipeline,
          requiredMethods: ['execute'],
        },
        traceContextFactory: {
          value: deps.traceContextFactory,
          requiredMethods: ['create'],
        },
      });

      // Get optional action tracing dependencies
      const actionAwareTraceFactory = deps.actionAwareTraceFactory || null;
      const actionTraceFilter = deps.actionTraceFilter || null;

      // Log action tracing availability
      const actionTracingAvailable = !!(
        actionAwareTraceFactory && actionTraceFilter
      );
      logger.info(
        `ActionDiscoveryService: Action tracing ${actionTracingAvailable ? 'available' : 'not available'}`,
        {
          hasActionAwareTraceFactory: !!actionAwareTraceFactory,
          hasActionTraceFilter: !!actionTraceFilter,
        }
      );

      return new ActionDiscoveryService({
        actionIndex: deps.actionIndex,
        discoveryPipeline: deps.discoveryPipeline,
        traceContextFactory: deps.traceContextFactory,
        actionAwareTraceFactory,
        actionTraceFilter,
        logger,
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        actionIndex: tokens.IActionIndex,
        discoveryPipeline: tokens.IDiscoveryPipeline,
        traceContextFactory: tokens.ITraceContextFactory,
        // Optional dependencies for action tracing
        actionAwareTraceFactory: {
          token: actionTracingTokens.IActionAwareTraceContextFactory,
          optional: true,
        },
        actionTraceFilter: {
          token: actionTracingTokens.IActionTraceFilter,
          optional: true,
        },
        logger: tokens.ILogger,
      },
    }
  );
}
```

### Step 3: Create Migration Helper

Create `src/actions/tracing/discoveryServiceMigration.js`:

```javascript
/**
 * @file Migration helper for ActionDiscoveryService tracing enhancement
 */

import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Helper to validate ActionDiscoveryService action tracing setup
 */
class ActionDiscoveryServiceTracingValidator {
  #logger;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(
      logger,
      'ActionDiscoveryServiceTracingValidator'
    );
  }

  /**
   * Validate that action tracing is properly configured
   *
   * @param {ActionDiscoveryService} discoveryService - Service to validate
   * @returns {Object} Validation results
   */
  validateConfiguration(discoveryService) {
    const status = discoveryService.getActionTracingStatus();
    const issues = [];
    const warnings = [];

    // Check availability
    if (!status.available) {
      if (!status.hasFilter) {
        issues.push('ActionTraceFilter is not registered or available');
      }
      if (!status.hasFactory) {
        issues.push(
          'ActionAwareTraceContextFactory is not registered or available'
        );
      }

      warnings.push(
        'Action tracing will not be available for ActionDiscoveryService'
      );
    }

    // Check enabled state
    if (status.available && !status.enabled) {
      warnings.push(
        'Action tracing is available but disabled in configuration'
      );
    }

    const result = {
      valid: issues.length === 0,
      available: status.available,
      enabled: status.enabled,
      issues,
      warnings,
    };

    this.#logValidationResults(result);
    return result;
  }

  #logValidationResults(result) {
    if (result.valid) {
      this.#logger.info(
        'ActionDiscoveryService action tracing validation passed',
        {
          available: result.available,
          enabled: result.enabled,
          warningCount: result.warnings.length,
        }
      );
    } else {
      this.#logger.error(
        'ActionDiscoveryService action tracing validation failed',
        {
          issues: result.issues,
          warnings: result.warnings,
        }
      );
    }

    // Log warnings
    result.warnings.forEach((warning) => {
      this.#logger.warn(`ActionDiscoveryService tracing: ${warning}`);
    });
  }
}

export default ActionDiscoveryServiceTracingValidator;
```

### Step 4: Create Integration Tests Helper

Create `src/actions/tracing/discoveryServiceTestingUtils.js`:

```javascript
/**
 * @file Testing utilities for ActionDiscoveryService action tracing
 */

/**
 * Test helper for ActionDiscoveryService action tracing functionality
 */
export class ActionDiscoveryServiceTracingTestHelper {
  #discoveryService;
  #originalGetValidActions;

  constructor(discoveryService) {
    this.#discoveryService = discoveryService;
    this.#originalGetValidActions =
      discoveryService.getValidActions.bind(discoveryService);
  }

  /**
   * Enable tracing for specific test and capture results
   *
   * @param {Object} testConfig - Test configuration
   * @returns {Object} Test helper with trace capture
   */
  enableTracingForTest(testConfig = {}) {
    const {
      tracedActions = ['*'],
      verbosity = 'standard',
      captureTraceData = true,
    } = testConfig;

    let capturedTraceData = null;

    // Override getValidActions to capture trace data
    this.#discoveryService.getValidActions = async (
      actorEntity,
      baseContext,
      options = {}
    ) => {
      const enhancedOptions = {
        ...options,
        trace: true, // Force tracing for test
      };

      const result = await this.#originalGetValidActions(
        actorEntity,
        baseContext,
        enhancedOptions
      );

      // Capture trace data if requested
      if (captureTraceData && result.context?.trace?.getTracedActions) {
        capturedTraceData = result.context.trace.getTracedActions();
      }

      return result;
    };

    return {
      getCapturedTraceData: () => capturedTraceData,
      resetTracingCapture: () => {
        capturedTraceData = null;
      },
      restoreOriginalMethod: () => {
        this.#discoveryService.getValidActions = this.#originalGetValidActions;
      },
    };
  }
}
```

## Testing Requirements

### Unit Tests

#### Test File: `tests/unit/actions/actionDiscoveryService.enhanced.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';

describe('ActionDiscoveryService - Action Tracing Enhancement', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Trace Context Creation', () => {
    it('should create standard trace when action tracing is disabled', async () => {
      const discoveryService = testBed.createDiscoveryService({
        actionTracingEnabled: false,
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.success).toBe(true);
      expect(testBed.getCreatedTraceType()).toBe('StructuredTrace');
    });

    it('should create ActionAwareStructuredTrace when action tracing is enabled', async () => {
      const discoveryService = testBed.createDiscoveryService({
        actionTracingEnabled: true,
        tracedActions: ['core:go'],
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.success).toBe(true);
      expect(testBed.getCreatedTraceType()).toBe('ActionAwareStructuredTrace');
    });

    it('should fall back to standard trace when ActionAwareTrace creation fails', async () => {
      const discoveryService = testBed.createDiscoveryService({
        actionTracingEnabled: true,
        actionAwareTraceFactoryFailure: true,
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.success).toBe(true);
      expect(testBed.getCreatedTraceType()).toBe('StructuredTrace');
      expect(testBed.getWarningLogs()).toContain(
        'Failed to create trace context'
      );
    });

    it('should handle missing action tracing dependencies gracefully', async () => {
      const discoveryService = testBed.createDiscoveryService({
        actionTracingEnabled: true,
        hasActionAwareTraceFactory: false,
        hasActionTraceFilter: false,
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.success).toBe(true);
      expect(testBed.getCreatedTraceType()).toBe('StructuredTrace');
    });
  });

  describe('Action Tracing Status', () => {
    it('should report correct action tracing availability', () => {
      const discoveryService = testBed.createDiscoveryService({
        hasActionAwareTraceFactory: true,
        hasActionTraceFilter: true,
      });

      expect(discoveryService.isActionTracingAvailable()).toBe(true);

      const status = discoveryService.getActionTracingStatus();
      expect(status.available).toBe(true);
      expect(status.hasFilter).toBe(true);
      expect(status.hasFactory).toBe(true);
    });

    it('should report unavailable when dependencies are missing', () => {
      const discoveryService = testBed.createDiscoveryService({
        hasActionAwareTraceFactory: false,
        hasActionTraceFilter: true,
      });

      expect(discoveryService.isActionTracingAvailable()).toBe(false);

      const status = discoveryService.getActionTracingStatus();
      expect(status.available).toBe(false);
      expect(status.hasFilter).toBe(true);
      expect(status.hasFactory).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work identically to original service when tracing is disabled', async () => {
      const standardService = testBed.createStandardDiscoveryService();
      const enhancedService = testBed.createDiscoveryService({
        actionTracingEnabled: false,
      });

      const actor = testBed.createMockActor('test-actor');
      const baseContext = testBed.createMockContext();

      const standardResult = await standardService.getValidActions(
        actor,
        baseContext
      );
      const enhancedResult = await enhancedService.getValidActions(
        actor,
        baseContext
      );

      expect(enhancedResult.success).toBe(standardResult.success);
      expect(enhancedResult.data).toEqual(standardResult.data);
    });

    it('should maintain existing API without breaking changes', () => {
      const discoveryService = testBed.createDiscoveryService();

      // All existing methods should still exist
      expect(typeof discoveryService.getValidActions).toBe('function');
      expect(typeof discoveryService.getActionIndex).toBe('function');
      expect(typeof discoveryService.getDiscoveryPipeline).toBe('function');

      // New methods should also exist
      expect(typeof discoveryService.isActionTracingAvailable).toBe('function');
      expect(typeof discoveryService.getActionTracingStatus).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle ActionTraceFilter.isEnabled() failures gracefully', async () => {
      const discoveryService = testBed.createDiscoveryService({
        actionTraceFilterFailure: 'isEnabled',
      });

      const actor = testBed.createMockActor('test-actor');

      expect(async () => {
        await discoveryService.getValidActions(actor, {}, { trace: true });
      }).not.toThrow();
    });

    it('should continue pipeline execution when trace creation fails completely', async () => {
      const discoveryService = testBed.createDiscoveryService({
        traceContextFactoryFailure: true,
        actionAwareTraceFactoryFailure: true,
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.success).toBe(true);
    });
  });
});
```

#### Extended Test Bed: `tests/common/actions/actionDiscoveryServiceTestBed.js`

Add to existing test bed:

```javascript
export class ActionDiscoveryServiceTestBed {
  // ... existing methods ...

  createDiscoveryService(options = {}) {
    const {
      actionTracingEnabled = false,
      tracedActions = ['*'],
      verbosity = 'standard',
      hasActionAwareTraceFactory = true,
      hasActionTraceFilter = true,
      actionAwareTraceFactoryFailure = false,
      actionTraceFilterFailure = null,
      traceContextFactoryFailure = false,
    } = options;

    // Create mocks
    const mockActionIndex = this.createMockActionIndex();
    const mockDiscoveryPipeline = this.createMockDiscoveryPipeline();
    const mockTraceContextFactory = this.createMockTraceContextFactory(
      traceContextFactoryFailure
    );
    const mockLogger = this.createMockLogger();

    // Create optional action tracing mocks
    const mockActionAwareTraceFactory = hasActionAwareTraceFactory
      ? this.createMockActionAwareTraceFactory(actionAwareTraceFactoryFailure)
      : null;

    const mockActionTraceFilter = hasActionTraceFilter
      ? this.createMockActionTraceFilter({
          enabled: actionTracingEnabled,
          tracedActions,
          verbosity,
          failure: actionTraceFilterFailure,
        })
      : null;

    // Create service
    const discoveryService = new ActionDiscoveryService({
      actionIndex: mockActionIndex,
      discoveryPipeline: mockDiscoveryPipeline,
      traceContextFactory: mockTraceContextFactory,
      actionAwareTraceFactory: mockActionAwareTraceFactory,
      actionTraceFilter: mockActionTraceFilter,
      logger: mockLogger,
    });

    // Store references for testing
    this.#instances.set('discoveryService', discoveryService);
    this.#mocks.set('actionAwareTraceFactory', mockActionAwareTraceFactory);
    this.#mocks.set('actionTraceFilter', mockActionTraceFilter);

    return discoveryService;
  }

  createMockActionAwareTraceFactory(shouldFail = false) {
    return {
      create: jest.fn().mockImplementation(async (options) => {
        if (shouldFail) {
          throw new Error('ActionAwareTraceFactory creation failed');
        }

        const mockTrace = {
          captureActionData: jest.fn(),
          getTracedActions: jest.fn().mockReturnValue(new Map()),
          getTracingSummary: jest.fn().mockReturnValue({
            tracedActionCount: 0,
            totalStagesTracked: 0,
            sessionDuration: 0,
          }),
          step: jest.fn(),
          info: jest.fn(),
          withSpanAsync: jest
            .fn()
            .mockImplementation(async (name, context, callback) => {
              return await callback({ info: jest.fn() });
            }),
        };

        this.#lastCreatedTraceType = 'ActionAwareStructuredTrace';
        return mockTrace;
      }),
    };
  }

  createMockActionTraceFilter(config = {}) {
    const {
      enabled = false,
      tracedActions = [],
      verbosity = 'standard',
      failure = null,
    } = config;

    return {
      isEnabled: jest.fn().mockImplementation(() => {
        if (failure === 'isEnabled') {
          throw new Error('ActionTraceFilter.isEnabled() failed');
        }
        return enabled;
      }),
      shouldTrace: jest.fn().mockImplementation((actionId) => {
        if (tracedActions.includes('*')) return true;
        return tracedActions.includes(actionId);
      }),
      getVerbosityLevel: jest.fn().mockReturnValue(verbosity),
      getInclusionConfig: jest.fn().mockReturnValue({
        componentData: true,
        prerequisites: true,
        targets: true,
      }),
    };
  }

  getCreatedTraceType() {
    return this.#lastCreatedTraceType || 'Unknown';
  }

  getWarningLogs() {
    const logger = this.#mocks.get('logger');
    return logger ? logger.warn.mock.calls.map((call) => call[0]) : [];
  }

  getErrorLogs() {
    const logger = this.#mocks.get('logger');
    return logger ? logger.error.mock.calls.map((call) => call[0]) : [];
  }
}
```

### Integration Tests

#### Test File: `tests/integration/actions/actionDiscoveryServiceTracing.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingIntegrationTestBed } from '../../common/actions/actionTracingIntegrationTestBed.js';

describe('ActionDiscoveryService - Action Tracing Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTracingIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should integrate action tracing with full pipeline execution', async () => {
    await testBed.setupActionTracing({
      tracedActions: ['core:go', 'core:look'],
      verbosity: 'detailed',
    });

    const actor = testBed.createTestActor();
    const result = await testBed.runActionDiscovery(actor);

    expect(result.success).toBe(true);

    const traceData = testBed.getActionTraceData();
    expect(traceData.size).toBeGreaterThan(0);

    // Verify trace data structure
    for (const [actionId, actionTrace] of traceData) {
      expect(actionTrace.actionId).toBe(actionId);
      expect(actionTrace.actorId).toBe(actor.id);
      expect(typeof actionTrace.startTime).toBe('number');
      expect(typeof actionTrace.stages).toBe('object');
    }
  });

  it('should capture action data across all pipeline stages', async () => {
    await testBed.setupActionTracing({
      tracedActions: ['core:go'],
      verbosity: 'verbose',
    });

    const actor = testBed.createTestActor();
    await testBed.runActionDiscovery(actor);

    const traceData = testBed.getActionTraceData();
    const goActionTrace = traceData.get('core:go');

    expect(goActionTrace).toBeDefined();

    // Should have data from multiple pipeline stages
    const stageNames = Object.keys(goActionTrace.stages);
    expect(stageNames.length).toBeGreaterThan(1);
    expect(stageNames).toContain('component_filtering');
  });

  it('should maintain performance when action tracing is disabled', async () => {
    await testBed.setupActionTracing({
      enabled: false,
    });

    const actor = testBed.createTestActor();

    const startTime = Date.now();
    const result = await testBed.runActionDiscovery(actor);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(100); // Should complete quickly

    const traceData = testBed.getActionTraceData();
    expect(traceData.size).toBe(0); // No action data should be captured
  });
});
```

## Acceptance Criteria

### Functional Acceptance Criteria

#### AC-010-01: Transparent Integration

- [ ] ActionDiscoveryService creates ActionAwareStructuredTrace when tracing is enabled
- [ ] Service falls back to standard StructuredTrace when action tracing is disabled or unavailable
- [ ] All existing API methods continue to work without modification
- [ ] Pipeline stages receive appropriate trace instances for action data capture

#### AC-010-02: Configuration-Driven Behavior

- [ ] Action tracing activation respects ActionTraceFilter.isEnabled() configuration
- [ ] Service handles missing action tracing dependencies gracefully
- [ ] Configuration changes are reflected without service restart
- [ ] Service provides debugging methods for tracing status

#### AC-010-03: Error Handling

- [ ] Trace creation failures fall back to standard traces without breaking pipeline
- [ ] ActionTraceFilter errors are handled gracefully with appropriate logging
- [ ] Pipeline continues execution even when tracing setup fails completely
- [ ] All error scenarios are logged with sufficient detail for debugging

#### AC-010-04: Performance Requirements

- [ ] <2ms overhead when action tracing is disabled
- [ ] <5ms additional overhead per traced action when enabled
- [ ] No memory leaks in trace creation or management
- [ ] Service startup time not significantly impacted by tracing setup

### Technical Acceptance Criteria

#### AC-010-05: Code Quality

- [ ] All new methods have comprehensive JSDoc documentation
- [ ] Error handling follows project logging and exception patterns
- [ ] Code follows project naming and structure conventions
- [ ] Dependencies are properly validated using existing utilities

#### AC-010-06: Testing Coverage

- [ ] Unit tests cover all tracing activation scenarios
- [ ] Integration tests verify end-to-end tracing functionality
- [ ] Backward compatibility tests ensure no regressions
- [ ] Error handling tests cover all failure scenarios

## Dependencies

### Technical Dependencies

- `src/actions/tracing/actionAwareStructuredTrace.js` - ACTTRA-009 (ActionAwareStructuredTrace class)
- `src/actions/tracing/actionTraceFilter.js` - ACTTRA-003 (ActionTraceFilter implementation)
- `src/tracing/structuredTrace.js` - Existing trace system to integrate with
- `src/actions/pipeline/` - Existing pipeline infrastructure

### Workflow Dependencies

- **ACTTRA-009**: ActionAwareStructuredTrace must be implemented first
- **ACTTRA-003**: ActionTraceFilter must be available for configuration checks
- **ACTTRA-039**: Dependency injection setup needed for optional dependencies

### External Dependencies

- Existing ActionDiscoveryService consumers must continue working without changes
- Pipeline stages will be enhanced in subsequent tickets to utilize action tracing

## Definition of Done

### Code Complete

- [ ] ActionDiscoveryService enhanced with action tracing capabilities
- [ ] Trace creation logic implemented with proper fallback handling
- [ ] Dependency injection registration updated for optional tracing dependencies
- [ ] Migration helper and testing utilities created

### Testing Complete

- [ ] Unit tests written with >90% coverage for enhanced functionality
- [ ] Integration tests verify tracing works with actual pipeline execution
- [ ] Backward compatibility tests ensure no regressions for existing consumers
- [ ] Performance tests validate overhead requirements

### Documentation Complete

- [ ] All new methods have comprehensive JSDoc documentation
- [ ] Migration guide created for understanding the enhancement
- [ ] Debugging guide created for troubleshooting tracing activation issues
- [ ] Architecture decision documented for trace creation strategy

### Quality Assurance

- [ ] Code review completed by senior developer
- [ ] No performance regressions detected in testing
- [ ] All error scenarios handled gracefully with appropriate logging
- [ ] Integration with existing codebase validated

## Effort Estimation

### Development Tasks

- Service enhancement implementation: **3 hours**
- Trace creation and fallback logic: **2 hours**
- Dependency injection updates: **1 hour**
- Error handling and logging: **1 hour**

### Testing Tasks

- Unit test implementation: **3 hours**
- Integration test development: **2 hours**
- Backward compatibility testing: **1 hour**
- Performance validation: **1 hour**

### Documentation Tasks

- JSDoc documentation: **1 hour**
- Migration and debugging guides: **1 hour**

### Total Estimated Effort: **16 hours**

### Risk Factors

- **Medium Risk**: Optional dependency handling in DI container may require careful implementation
- **Low Risk**: Backward compatibility should be straightforward with proper fallback logic
- **Low Risk**: Performance impact should be minimal with efficient activation checks

## Success Metrics

### Quantitative Metrics

- Unit test coverage ≥90% for enhanced functionality
- <2ms overhead when tracing disabled
- <5ms additional overhead when tracing enabled
- Zero backward compatibility issues

### Qualitative Metrics

- Transparent integration with existing ActionDiscoveryService usage
- Clear debugging information for tracing activation issues
- Robust error handling for all failure scenarios
- Clean separation of tracing logic from discovery logic

---

**Ticket Created**: 2025-01-06  
**Estimated Effort**: 16 hours  
**Complexity**: Medium  
**Priority**: High  
**Assignee**: TBD  
**Reviewer**: Senior Developer
