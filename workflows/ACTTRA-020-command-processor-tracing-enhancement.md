# ACTTRA-020: Enhance CommandProcessor with Execution Tracing

## Summary

Integrate the ActionExecutionTrace system into the CommandProcessor's dispatchAction method to provide comprehensive tracing of action execution. This enhancement will capture the complete action lifecycle from initial dispatch through event creation, payload construction, EventDispatchService interaction, and final result handling, while maintaining backward compatibility and ensuring zero performance impact when tracing is disabled.

## Status

- **Type**: Enhancement
- **Priority**: High
- **Complexity**: Medium
- **Estimated Time**: 3 hours
- **Dependencies**: ACTTRA-019 (ActionExecutionTrace), ACTTRA-003 (ActionTraceFilter), ACTTRA-024 (ActionTraceOutputService)

## Objectives

### Primary Goals

1. **Seamless Integration** - Add tracing to CommandProcessor without breaking existing functionality
2. **Selective Tracing** - Only trace actions identified by ActionTraceFilter
3. **Complete Lifecycle Coverage** - Capture all phases of action execution
4. **Error Resilience** - Ensure tracing failures don't impact game execution
5. **Performance Optimization** - Zero overhead when tracing is disabled
6. **Event Payload Capture** - Store complete event data for analysis

### Success Criteria

- [ ] ActionExecutionTrace creation only occurs for actions marked for tracing
- [ ] All execution phases are captured (dispatch start, payload, result, error)
- [ ] Tracing failures are logged but don't break action execution
- [ ] Performance impact <1ms for traced actions, 0ms for non-traced actions
- [ ] Complete integration with existing error handling patterns
- [ ] Event payloads are captured and sanitized before storage
- [ ] Trace output is written asynchronously without blocking execution

## Technical Specification

### 1. Enhanced CommandProcessor Integration

#### File: `src/commands/commandProcessor.js` (Modified)

```javascript
/**
 * @file CommandProcessor with integrated execution tracing
 * Enhanced to support ActionExecutionTrace for debugging and analysis
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ActionExecutionTrace } from '../actions/tracing/actionExecutionTrace.js';

/**
 * CommandProcessor handles action dispatching with optional execution tracing
 * Integrates with ActionTraceFilter to selectively trace action executions
 */
export class CommandProcessor {
  #eventDispatchService;
  #logger;
  #actionTraceFilter;
  #actionExecutionTraceFactory;
  #actionTraceOutputService;

  constructor({
    eventDispatchService,
    logger,
    actionTraceFilter = null,
    actionExecutionTraceFactory = null,
    actionTraceOutputService = null,
  }) {
    validateDependency(eventDispatchService, 'IEventDispatchService');
    validateDependency(logger, 'ILogger');

    this.#eventDispatchService = eventDispatchService;
    this.#logger = logger;

    // Optional tracing dependencies - can be null if tracing is disabled
    this.#actionTraceFilter = actionTraceFilter;
    this.#actionExecutionTraceFactory = actionExecutionTraceFactory;
    this.#actionTraceOutputService = actionTraceOutputService;

    if (actionTraceFilter) {
      validateDependency(actionTraceFilter, 'IActionTraceFilter', null, {
        requiredMethods: ['isEnabled', 'shouldTrace'],
      });
    }

    if (actionExecutionTraceFactory) {
      validateDependency(
        actionExecutionTraceFactory,
        'IActionExecutionTraceFactory',
        null,
        {
          requiredMethods: ['createFromTurnAction'],
        }
      );
    }

    if (actionTraceOutputService) {
      validateDependency(
        actionTraceOutputService,
        'IActionTraceOutputService',
        null,
        {
          requiredMethods: ['writeTrace'],
        }
      );
    }
  }

  /**
   * Dispatch pre-resolved action with optional execution tracing
   * @param {Object} actor - Actor performing the action
   * @param {Object} turnAction - Pre-resolved turn action
   * @returns {Promise<Object>} Dispatch result
   */
  async dispatchAction(actor, turnAction) {
    let actionTrace = null;
    const actionId = turnAction?.actionDefinitionId;
    const actorId = actor?.id;

    // Early validation to prevent trace creation with invalid data
    try {
      this.#validateActionInputs(actor, turnAction);
    } catch (err) {
      this.#logger.error(
        'CommandProcessor.dispatchAction: Input validation failed',
        {
          error: err.message,
          actionId,
          actorId,
        }
      );
      return this.#handleDispatchFailure(
        'Internal error: Malformed action prevented execution.',
        err.message,
        turnAction?.commandString,
        actionId
      );
    }

    // Create execution trace if action should be traced
    try {
      if (this.#shouldCreateTrace(actionId)) {
        actionTrace = this.#createExecutionTrace(turnAction, actorId);
        actionTrace.captureDispatchStart();

        this.#logger.debug(
          `Created execution trace for action '${actionId}' by actor '${actorId}'`
        );
      }
    } catch (traceError) {
      // Log trace creation failure but continue execution
      this.#logger.warn('Failed to create execution trace', {
        error: traceError.message,
        actionId,
        actorId,
      });
    }

    this.#logger.debug(
      `CommandProcessor.dispatchAction: Dispatching pre-resolved action '${actionId}' for actor ${actorId}.`,
      { turnAction }
    );

    try {
      // --- Phase 1: Payload Construction ---
      const payload = this.#createAttemptActionPayload(actor, turnAction);

      // Capture payload in trace
      if (actionTrace) {
        try {
          actionTrace.captureEventPayload(payload);
        } catch (payloadError) {
          this.#logger.warn('Failed to capture event payload in trace', {
            error: payloadError.message,
            actionId,
          });
        }
      }

      // --- Phase 2: Event Dispatch ---
      const dispatchSuccess =
        await this.#eventDispatchService.dispatchWithErrorHandling(
          ATTEMPT_ACTION_ID,
          payload,
          `ATTEMPT_ACTION_ID dispatch for pre-resolved action ${actionId}`
        );

      // --- Phase 3: Result Processing ---
      const dispatchResult = {
        success: dispatchSuccess,
        timestamp: Date.now(),
        metadata: {
          actionId,
          actorId,
          eventType: ATTEMPT_ACTION_ID,
        },
      };

      // Capture result in trace
      if (actionTrace) {
        try {
          actionTrace.captureDispatchResult(dispatchResult);
        } catch (resultError) {
          this.#logger.warn('Failed to capture dispatch result in trace', {
            error: resultError.message,
            actionId,
          });
        }
      }

      // --- Phase 4: Output and Return ---
      if (dispatchSuccess) {
        // Write trace asynchronously (success case)
        if (actionTrace && this.#actionTraceOutputService) {
          this.#writeTraceAsync(actionTrace, actionId);
        }

        this.#logger.debug(
          `CommandProcessor.dispatchAction: Successfully dispatched '${actionId}' for actor ${actorId}.`
        );

        return {
          success: true,
          turnEnded: false,
          originalInput: turnAction.commandString || actionId,
          actionResult: { actionId },
        };
      }

      // Handle dispatch failure
      const internalMsg = `CRITICAL: Failed to dispatch pre-resolved ATTEMPT_ACTION_ID for ${actorId}, action "${actionId}". Dispatcher reported failure.`;

      // Write trace asynchronously (failure case)
      if (actionTrace && this.#actionTraceOutputService) {
        this.#writeTraceAsync(actionTrace, actionId);
      }

      return this.#handleDispatchFailure(
        'Internal error: Failed to initiate action.',
        internalMsg,
        turnAction.commandString,
        actionId,
        { payload }
      );
    } catch (error) {
      // --- Phase 5: Error Handling ---
      this.#logger.error(
        `CommandProcessor.dispatchAction: Error dispatching action '${actionId}':`,
        error
      );

      // Capture error in trace
      if (actionTrace) {
        try {
          actionTrace.captureError(error);
        } catch (errorCaptureError) {
          this.#logger.warn('Failed to capture error in trace', {
            originalError: error.message,
            traceError: errorCaptureError.message,
            actionId,
          });
        }
      }

      // Write trace asynchronously (error case)
      if (actionTrace && this.#actionTraceOutputService) {
        this.#writeTraceAsync(actionTrace, actionId);
      }

      return this.#handleDispatchFailure(
        'Internal error: Action dispatch failed.',
        error.message,
        turnAction.commandString,
        actionId
      );
    }
  }

  /**
   * Determine if execution trace should be created
   * @private
   * @param {string} actionId - Action ID to check
   * @returns {boolean} True if trace should be created
   */
  #shouldCreateTrace(actionId) {
    // Fast path: no tracing infrastructure
    if (!this.#actionTraceFilter || !this.#actionExecutionTraceFactory) {
      return false;
    }

    // Check if tracing is globally enabled
    if (!this.#actionTraceFilter.isEnabled()) {
      return false;
    }

    // Check if this specific action should be traced
    if (!actionId || !this.#actionTraceFilter.shouldTrace(actionId)) {
      return false;
    }

    return true;
  }

  /**
   * Create execution trace instance
   * @private
   * @param {Object} turnAction - Turn action to trace
   * @param {string} actorId - Actor performing action
   * @returns {ActionExecutionTrace} New trace instance
   */
  #createExecutionTrace(turnAction, actorId) {
    if (!this.#actionExecutionTraceFactory) {
      throw new Error('ActionExecutionTraceFactory not available');
    }

    return this.#actionExecutionTraceFactory.createFromTurnAction(
      turnAction,
      actorId
    );
  }

  /**
   * Write trace to output asynchronously
   * @private
   * @param {ActionExecutionTrace} trace - Trace to write
   * @param {string} actionId - Action ID for logging
   */
  #writeTraceAsync(trace, actionId) {
    // Fire and forget - don't wait for trace writing
    this.#actionTraceOutputService.writeTrace(trace).catch((writeError) => {
      this.#logger.warn('Failed to write execution trace', {
        error: writeError.message,
        actionId,
        traceComplete: trace.isComplete,
        hasError: trace.hasError,
      });
    });
  }

  /**
   * Create ATTEMPT_ACTION_ID event payload
   * @private
   * @param {Object} actor - Actor performing action
   * @param {Object} turnAction - Turn action details
   * @returns {Object} Event payload
   */
  #createAttemptActionPayload(actor, turnAction) {
    // Existing implementation - no changes needed
    return {
      eventType: ATTEMPT_ACTION_ID,
      actor: {
        id: actor.id,
        // Include relevant actor properties for action execution
      },
      action: {
        definitionId: turnAction.actionDefinitionId,
        commandString: turnAction.commandString,
        parameters: turnAction.parameters || {},
      },
      timestamp: Date.now(),
      turnId: this.#generateTurnId?.() || null,
    };
  }

  /**
   * Validate action inputs
   * @private
   * @param {Object} actor - Actor to validate
   * @param {Object} turnAction - Turn action to validate
   */
  #validateActionInputs(actor, turnAction) {
    if (!actor || !actor.id) {
      throw new Error('Invalid actor: missing ID');
    }

    if (!turnAction || !turnAction.actionDefinitionId) {
      throw new Error('Invalid turn action: missing actionDefinitionId');
    }

    // Additional validation as needed
    if (typeof turnAction.actionDefinitionId !== 'string') {
      throw new Error('Invalid turn action: actionDefinitionId must be string');
    }
  }

  /**
   * Handle dispatch failures with consistent error response
   * @private
   * @param {string} userMessage - User-facing error message
   * @param {string} internalMessage - Internal error details
   * @param {string} commandString - Original command string
   * @param {string} actionId - Action ID if available
   * @param {Object} context - Additional error context
   * @returns {Object} Error response
   */
  #handleDispatchFailure(
    userMessage,
    internalMessage,
    commandString,
    actionId,
    context = {}
  ) {
    // Log internal details
    this.#logger.error('Action dispatch failure', {
      userMessage,
      internalMessage,
      commandString,
      actionId,
      context,
    });

    // Return user-safe response
    return {
      success: false,
      turnEnded: false,
      originalInput: commandString || actionId || 'unknown',
      error: {
        message: userMessage,
        type: 'DispatchError',
        actionId: actionId || null,
      },
    };
  }
}
```

### 2. Dependency Injection Integration

#### File: `src/dependencyInjection/containers/commandContainer.js` (Modified)

```javascript
/**
 * @file Command container with tracing support
 * Registers CommandProcessor with optional tracing dependencies
 */

import { validateDependency } from '../../utils/validationUtils.js';
import { CommandProcessor } from '../../commands/commandProcessor.js';
import { tokens } from '../tokens.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';

/**
 * Register CommandProcessor with tracing support
 * @param {Container} container - DI container
 */
export function registerCommandProcessor(container) {
  container.register(
    tokens.ICommandProcessor,
    (deps) => {
      // Required dependencies
      validateDependency(deps.eventDispatchService, 'IEventDispatchService');
      validateDependency(deps.logger, 'ILogger');

      // Optional tracing dependencies
      const actionTraceFilter = deps.actionTraceFilter || null;
      const actionExecutionTraceFactory =
        deps.actionExecutionTraceFactory || null;
      const actionTraceOutputService = deps.actionTraceOutputService || null;

      // Log tracing status
      const tracingEnabled =
        actionTraceFilter &&
        actionExecutionTraceFactory &&
        actionTraceOutputService;
      deps.logger.info(
        `CommandProcessor: Action execution tracing ${tracingEnabled ? 'enabled' : 'disabled'}`
      );

      return new CommandProcessor({
        eventDispatchService: deps.eventDispatchService,
        logger: deps.logger,
        actionTraceFilter,
        actionExecutionTraceFactory,
        actionTraceOutputService,
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        eventDispatchService: tokens.IEventDispatchService,
        logger: tokens.ILogger,
        // Optional tracing dependencies
        actionTraceFilter: {
          token: actionTracingTokens.IActionTraceFilter,
          optional: true,
        },
        actionExecutionTraceFactory: {
          token: actionTracingTokens.IActionExecutionTraceFactory,
          optional: true,
        },
        actionTraceOutputService: {
          token: actionTracingTokens.IActionTraceOutputService,
          optional: true,
        },
      },
    }
  );
}
```

### 3. Tracing Configuration Integration

#### File: `src/commands/tracingConfig.js` (New)

```javascript
/**
 * @file Tracing configuration utilities for CommandProcessor
 */

/**
 * Configuration for CommandProcessor tracing
 */
export const COMMAND_PROCESSOR_TRACING_CONFIG = {
  // Performance thresholds
  maxTraceCreationTime: 5, // ms
  maxPayloadSize: 1024 * 1024, // 1MB

  // Async write settings
  traceWriteTimeout: 10000, // 10s
  maxConcurrentWrites: 5,

  // Error handling
  maxTraceFailuresBeforeDisable: 10,
  traceFailureWindow: 60000, // 1 minute

  // Debug settings
  logTraceCreation: false,
  logTraceWriting: false,
  includeStackTrace: false,
};

/**
 * Performance monitor for tracing operations
 */
export class TracingPerformanceMonitor {
  #traceCreationTimes = [];
  #traceWriteTimes = [];
  #failureCount = 0;
  #lastFailureReset = Date.now();
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Record trace creation performance
   * @param {number} duration - Creation time in ms
   */
  recordTraceCreation(duration) {
    this.#traceCreationTimes.push(duration);

    // Keep only last 100 measurements
    if (this.#traceCreationTimes.length > 100) {
      this.#traceCreationTimes.shift();
    }

    // Warn on slow creation
    if (duration > COMMAND_PROCESSOR_TRACING_CONFIG.maxTraceCreationTime) {
      this.#logger.warn(`Slow trace creation: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Record trace write performance
   * @param {number} duration - Write time in ms
   */
  recordTraceWrite(duration) {
    this.#traceWriteTimes.push(duration);

    if (this.#traceWriteTimes.length > 100) {
      this.#traceWriteTimes.shift();
    }
  }

  /**
   * Record trace failure
   */
  recordFailure() {
    const now = Date.now();

    // Reset failure count if window expired
    if (
      now - this.#lastFailureReset >
      COMMAND_PROCESSOR_TRACING_CONFIG.traceFailureWindow
    ) {
      this.#failureCount = 0;
      this.#lastFailureReset = now;
    }

    this.#failureCount++;

    // Check if we should disable tracing
    if (
      this.#failureCount >=
      COMMAND_PROCESSOR_TRACING_CONFIG.maxTraceFailuresBeforeDisable
    ) {
      this.#logger.error(
        `Too many trace failures (${this.#failureCount}), consider disabling tracing`
      );
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    const avgCreationTime =
      this.#traceCreationTimes.length > 0
        ? this.#traceCreationTimes.reduce((a, b) => a + b) /
          this.#traceCreationTimes.length
        : 0;

    const avgWriteTime =
      this.#traceWriteTimes.length > 0
        ? this.#traceWriteTimes.reduce((a, b) => a + b) /
          this.#traceWriteTimes.length
        : 0;

    return {
      averageCreationTime: avgCreationTime,
      averageWriteTime: avgWriteTime,
      totalFailures: this.#failureCount,
      measurementWindow: Math.min(
        this.#traceCreationTimes.length,
        this.#traceWriteTimes.length
      ),
    };
  }
}
```

### 4. Error Recovery and Resilience

#### File: `src/commands/tracingErrorHandler.js` (New)

```javascript
/**
 * @file Error handling utilities for CommandProcessor tracing
 */

/**
 * Error handler for tracing operations
 * Provides graceful degradation and recovery
 */
export class TracingErrorHandler {
  #logger;
  #performanceMonitor;
  #consecutiveFailures = 0;
  #lastFailureTime = null;
  #tracingEnabled = true;

  constructor({ logger, performanceMonitor }) {
    this.#logger = logger;
    this.#performanceMonitor = performanceMonitor;
  }

  /**
   * Handle trace creation error
   * @param {Error} error - Creation error
   * @param {string} actionId - Action ID
   * @param {string} actorId - Actor ID
   * @returns {boolean} True if should retry, false if should skip tracing
   */
  handleTraceCreationError(error, actionId, actorId) {
    this.#recordFailure('trace_creation', error, { actionId, actorId });

    // Always continue execution - trace creation failure should never break action
    return false; // Don't retry, skip tracing for this action
  }

  /**
   * Handle payload capture error
   * @param {Error} error - Capture error
   * @param {string} actionId - Action ID
   * @returns {boolean} True if execution should continue
   */
  handlePayloadCaptureError(error, actionId) {
    this.#recordFailure('payload_capture', error, { actionId });

    // Log but continue - payload capture failure shouldn't break execution
    this.#logger.debug(
      'Payload capture failed, continuing without trace data',
      {
        error: error.message,
        actionId,
      }
    );

    return true; // Continue execution
  }

  /**
   * Handle result capture error
   * @param {Error} error - Capture error
   * @param {string} actionId - Action ID
   * @returns {boolean} True if execution should continue
   */
  handleResultCaptureError(error, actionId) {
    this.#recordFailure('result_capture', error, { actionId });

    this.#logger.debug(
      'Result capture failed, continuing without trace completion',
      {
        error: error.message,
        actionId,
      }
    );

    return true; // Continue execution
  }

  /**
   * Handle trace write error
   * @param {Error} error - Write error
   * @param {string} actionId - Action ID
   */
  handleTraceWriteError(error, actionId) {
    this.#recordFailure('trace_write', error, { actionId });

    // Consider implementing retry logic or queuing here
    this.#logger.warn('Failed to write execution trace', {
      error: error.message,
      actionId,
      consecutiveFailures: this.#consecutiveFailures,
    });
  }

  /**
   * Check if tracing should be temporarily disabled
   * @returns {boolean} True if tracing should be disabled
   */
  shouldDisableTracing() {
    return !this.#tracingEnabled || this.#consecutiveFailures >= 5;
  }

  /**
   * Reset failure counters (for testing or recovery)
   */
  reset() {
    this.#consecutiveFailures = 0;
    this.#lastFailureTime = null;
    this.#tracingEnabled = true;
  }

  /**
   * Record failure and update counters
   * @private
   * @param {string} operation - Operation that failed
   * @param {Error} error - Error that occurred
   * @param {Object} context - Additional context
   */
  #recordFailure(operation, error, context) {
    this.#consecutiveFailures++;
    this.#lastFailureTime = Date.now();

    if (this.#performanceMonitor) {
      this.#performanceMonitor.recordFailure();
    }

    // Log detailed error information
    this.#logger.warn(`Tracing ${operation} failed`, {
      error: error.message,
      stack: error.stack,
      context,
      consecutiveFailures: this.#consecutiveFailures,
    });

    // Disable tracing if too many failures
    if (this.#consecutiveFailures >= 10) {
      this.#tracingEnabled = false;
      this.#logger.error(
        'Disabling action execution tracing due to repeated failures'
      );
    }
  }
}
```

## Implementation Tasks

### Phase 1: Core Integration (1.5 hours)

1. **Modify CommandProcessor constructor**
   - [ ] Add optional tracing dependencies
   - [ ] Implement dependency validation with optional parameters
   - [ ] Add initialization logging for tracing status
   - [ ] Ensure backward compatibility

2. **Enhance dispatchAction method**
   - [ ] Add trace creation logic with shouldTrace check
   - [ ] Integrate payload capture after event payload creation
   - [ ] Add result capture after dispatch completion
   - [ ] Implement error capture in catch blocks

3. **Add trace lifecycle management**
   - [ ] Implement start/end trace tracking
   - [ ] Add async trace writing without blocking execution
   - [ ] Create helper methods for trace operations
   - [ ] Add performance monitoring hooks

### Phase 2: Error Handling and Performance (1 hour)

1. **Implement robust error handling**
   - [ ] Create TracingErrorHandler for graceful degradation
   - [ ] Add try-catch around all trace operations
   - [ ] Ensure tracing failures never break action execution
   - [ ] Implement failure counting and temporary disabling

2. **Add performance monitoring**
   - [ ] Create TracingPerformanceMonitor
   - [ ] Track trace creation and write times
   - [ ] Add performance threshold warnings
   - [ ] Implement statistics collection

3. **Optimize for zero-impact when disabled**
   - [ ] Add fast-path exit for disabled tracing
   - [ ] Minimize object creation when tracing disabled
   - [ ] Ensure no performance overhead for non-traced actions
   - [ ] Add configuration-based feature flags

### Phase 3: Integration and Testing (30 minutes)

1. **Update dependency injection**
   - [ ] Modify command container registration
   - [ ] Add optional dependency handling
   - [ ] Create tracing configuration
   - [ ] Update service initialization

2. **Add configuration support**
   - [ ] Create tracing configuration file
   - [ ] Add performance thresholds
   - [ ] Implement feature flags
   - [ ] Add environment-specific settings

## Code Examples

### Example 1: Basic Integration Usage

```javascript
// CommandProcessor with tracing enabled
const commandProcessor = new CommandProcessor({
  eventDispatchService: container.resolve(tokens.IEventDispatchService),
  logger: container.resolve(tokens.ILogger),
  actionTraceFilter: container.resolve(actionTracingTokens.IActionTraceFilter),
  actionExecutionTraceFactory: container.resolve(
    actionTracingTokens.IActionExecutionTraceFactory
  ),
  actionTraceOutputService: container.resolve(
    actionTracingTokens.IActionTraceOutputService
  ),
});

// Dispatch action (tracing happens automatically if configured)
const result = await commandProcessor.dispatchAction(actor, turnAction);
```

### Example 2: Trace Creation Decision Logic

```javascript
// In CommandProcessor.#shouldCreateTrace()
if (!this.#actionTraceFilter || !this.#actionExecutionTraceFactory) {
  return false; // No tracing infrastructure
}

if (!this.#actionTraceFilter.isEnabled()) {
  return false; // Tracing globally disabled
}

if (!actionId || !this.#actionTraceFilter.shouldTrace(actionId)) {
  return false; // Action not configured for tracing
}

return true; // Create trace
```

### Example 3: Error-Resilient Trace Operations

```javascript
// Error-resilient payload capture
if (actionTrace) {
  try {
    actionTrace.captureEventPayload(payload);
  } catch (payloadError) {
    this.#tracingErrorHandler.handlePayloadCaptureError(payloadError, actionId);
    // Continue execution - payload capture failure shouldn't break action
  }
}
```

### Example 4: Async Trace Writing

```javascript
// Write trace without blocking action execution
#writeTraceAsync(trace, actionId) {
  this.#actionTraceOutputService.writeTrace(trace).catch(writeError => {
    this.#tracingErrorHandler.handleTraceWriteError(writeError, actionId);
  });
}
```

## Testing Requirements

### Unit Tests

#### File: `tests/unit/commands/commandProcessor.tracing.test.js`

```javascript
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CommandProcessor } from '../../../src/commands/commandProcessor.js';
import { createMockEventDispatchService } from '../../common/mocks/mockEventDispatchService.js';
import { createMockLogger } from '../../common/mocks/mockLogger.js';
import { createMockActionTraceFilter } from '../../common/mocks/mockActionTraceFilter.js';
import { createMockActionExecutionTraceFactory } from '../../common/mocks/mockActionExecutionTraceFactory.js';
import { createMockActionTraceOutputService } from '../../common/mocks/mockActionTraceOutputService.js';

describe('CommandProcessor - Execution Tracing', () => {
  let commandProcessor;
  let mockEventDispatchService;
  let mockLogger;
  let mockActionTraceFilter;
  let mockActionExecutionTraceFactory;
  let mockActionTraceOutputService;
  let mockTrace;

  beforeEach(() => {
    mockEventDispatchService = createMockEventDispatchService();
    mockLogger = createMockLogger();
    mockActionTraceFilter = createMockActionTraceFilter();
    mockActionExecutionTraceFactory = createMockActionExecutionTraceFactory();
    mockActionTraceOutputService = createMockActionTraceOutputService();
    mockTrace = createMockActionExecutionTrace();

    // Set up default mocks
    mockActionTraceFilter.isEnabled.mockReturnValue(true);
    mockActionTraceFilter.shouldTrace.mockReturnValue(false); // Default to no tracing
    mockActionExecutionTraceFactory.createFromTurnAction.mockReturnValue(
      mockTrace
    );
    mockEventDispatchService.dispatchWithErrorHandling.mockResolvedValue(true);

    commandProcessor = new CommandProcessor({
      eventDispatchService: mockEventDispatchService,
      logger: mockLogger,
      actionTraceFilter: mockActionTraceFilter,
      actionExecutionTraceFactory: mockActionExecutionTraceFactory,
      actionTraceOutputService: mockActionTraceOutputService,
    });
  });

  describe('Trace Creation Logic', () => {
    it('should not create trace when tracing is disabled globally', async () => {
      mockActionTraceFilter.isEnabled.mockReturnValue(false);

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).not.toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).not.toHaveBeenCalled();
    });

    it('should not create trace when action is not marked for tracing', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(false);

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).not.toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).not.toHaveBeenCalled();
    });

    it('should create and capture trace when action is marked for tracing', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'core:go',
        commandString: 'go north',
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).toHaveBeenCalledWith(turnAction, 'player-1');
      expect(mockTrace.captureDispatchStart).toHaveBeenCalled();
      expect(mockTrace.captureEventPayload).toHaveBeenCalled();
      expect(mockTrace.captureDispatchResult).toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).toHaveBeenCalledWith(
        mockTrace
      );
    });
  });

  describe('Trace Lifecycle', () => {
    beforeEach(() => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
    });

    it('should capture all execution phases in correct order', async () => {
      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      await commandProcessor.dispatchAction(actor, turnAction);

      // Verify call order
      const calls = [
        mockTrace.captureDispatchStart,
        mockTrace.captureEventPayload,
        mockTrace.captureDispatchResult,
      ];

      calls.forEach((call, index) => {
        expect(call).toHaveBeenCalled();
        if (index > 0) {
          expect(call).toHaveBeenCalledAfter(calls[index - 1]);
        }
      });
    });

    it('should capture event payload with correct data', async () => {
      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'core:go',
        commandString: 'go north',
        parameters: { direction: 'north' },
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(mockTrace.captureEventPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ATTEMPT_ACTION_ID',
          actor: expect.objectContaining({ id: 'player-1' }),
          action: expect.objectContaining({
            definitionId: 'core:go',
            commandString: 'go north',
            parameters: { direction: 'north' },
          }),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should capture dispatch result with success status', async () => {
      mockEventDispatchService.dispatchWithErrorHandling.mockResolvedValue(
        true
      );

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(mockTrace.captureDispatchResult).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          timestamp: expect.any(Number),
          metadata: expect.objectContaining({
            actionId: 'core:go',
            actorId: 'player-1',
            eventType: 'ATTEMPT_ACTION_ID',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
    });

    it('should continue execution when trace creation fails', async () => {
      mockActionExecutionTraceFactory.createFromTurnAction.mockImplementation(
        () => {
          throw new Error('Trace creation failed');
        }
      );

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true); // Execution should continue
      expect(
        mockEventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to create execution trace',
        expect.any(Object)
      );
    });

    it('should continue execution when payload capture fails', async () => {
      mockTrace.captureEventPayload.mockImplementation(() => {
        throw new Error('Payload capture failed');
      });

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to capture event payload in trace',
        expect.any(Object)
      );
    });

    it('should capture execution error in trace', async () => {
      const executionError = new Error('Dispatch failed');
      mockEventDispatchService.dispatchWithErrorHandling.mockRejectedValue(
        executionError
      );

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(false);
      expect(mockTrace.captureError).toHaveBeenCalledWith(executionError);
      expect(mockActionTraceOutputService.writeTrace).toHaveBeenCalledWith(
        mockTrace
      );
    });

    it('should handle trace write failures gracefully', async () => {
      mockActionTraceOutputService.writeTrace.mockRejectedValue(
        new Error('Write failed')
      );

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true); // Action execution should succeed

      // Wait for async trace write to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to write execution trace',
        expect.any(Object)
      );
    });
  });

  describe('Performance Optimization', () => {
    it('should have zero overhead when tracing is disabled', async () => {
      mockActionTraceFilter.isEnabled.mockReturnValue(false);

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      const start = performance.now();
      await commandProcessor.dispatchAction(actor, turnAction);
      const duration = performance.now() - start;

      // No tracing-related method calls
      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).not.toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).not.toHaveBeenCalled();

      // Duration should be minimal (just action execution)
      expect(duration).toBeLessThan(50); // Very liberal threshold for CI
    });

    it('should have minimal overhead when action not traced', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(false);

      const actor = { id: 'player-1' };
      const turnAction = { actionDefinitionId: 'core:go' };

      const start = performance.now();
      await commandProcessor.dispatchAction(actor, turnAction);
      const duration = performance.now() - start;

      // Should only check if tracing enabled/should trace
      expect(mockActionTraceFilter.isEnabled).toHaveBeenCalled();
      expect(mockActionTraceFilter.shouldTrace).toHaveBeenCalled();
      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).not.toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

#### File: `tests/integration/commands/commandProcessorTracing.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CommandProcessorTracingTestBed } from '../../common/testbeds/commandProcessorTracingTestBed.js';

describe('CommandProcessor Tracing Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new CommandProcessorTracingTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should create complete trace for traced action execution', async () => {
    // Configure to trace 'core:go' actions
    testBed.configureTracing(['core:go']);

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    };

    // Execute action
    const result = await testBed.commandProcessor.dispatchAction(
      actor,
      turnAction
    );

    // Verify execution succeeded
    expect(result.success).toBe(true);

    // Verify trace was created and written
    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    const trace = traces[0];
    expect(trace.metadata.actionId).toBe('core:go');
    expect(trace.metadata.actorId).toBe('player-1');
    expect(trace.execution.status).toBe('success');
    expect(trace.execution.phases.length).toBeGreaterThanOrEqual(2);
    expect(trace.eventPayload).toBeDefined();
    expect(trace.result.success).toBe(true);
  });

  it('should handle multiple concurrent traced actions', async () => {
    testBed.configureTracing(['core:*']);

    const actor = testBed.createActor('player-1');
    const actions = [
      { actionDefinitionId: 'core:go', commandString: 'go north' },
      { actionDefinitionId: 'core:look', commandString: 'look around' },
      { actionDefinitionId: 'core:inventory', commandString: 'inventory' },
    ];

    // Execute actions concurrently
    const results = await Promise.all(
      actions.map((action) =>
        testBed.commandProcessor.dispatchAction(actor, action)
      )
    );

    // Verify all succeeded
    results.forEach((result) => {
      expect(result.success).toBe(true);
    });

    // Verify all traces were written
    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(3);

    // Verify each trace has correct action ID
    const actionIds = traces.map((trace) => trace.metadata.actionId);
    expect(actionIds).toContain('core:go');
    expect(actionIds).toContain('core:look');
    expect(actionIds).toContain('core:inventory');
  });

  it('should integrate with real EventDispatchService', async () => {
    testBed.configureTracing(['core:test']);
    testBed.setupRealEventDispatchService();

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:test',
      commandString: 'test action',
    };

    const result = await testBed.commandProcessor.dispatchAction(
      actor,
      turnAction
    );

    expect(result.success).toBe(true);

    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    // Verify event payload contains real event data
    const trace = traces[0];
    expect(trace.eventPayload.eventType).toBe('ATTEMPT_ACTION_ID');
    expect(trace.eventPayload.actor.id).toBe('player-1');
    expect(trace.eventPayload.action.definitionId).toBe('core:test');
  });
});
```

### Performance Tests

```javascript
describe('CommandProcessor Tracing Performance', () => {
  it('should have minimal impact on action execution', async () => {
    const testBed = new CommandProcessorTracingTestBed();
    testBed.configureTracing(['core:performance_test']);

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:performance_test',
      commandString: 'performance test',
    };

    // Measure with tracing
    const startWithTracing = performance.now();
    await testBed.commandProcessor.dispatchAction(actor, turnAction);
    const withTracingDuration = performance.now() - startWithTracing;

    // Measure without tracing
    testBed.disableTracing();
    const startWithoutTracing = performance.now();
    await testBed.commandProcessor.dispatchAction(actor, turnAction);
    const withoutTracingDuration = performance.now() - startWithoutTracing;

    // Tracing overhead should be minimal
    const overhead = withTracingDuration - withoutTracingDuration;
    expect(overhead).toBeLessThan(5); // <5ms overhead

    testBed.cleanup();
  });
});
```

## Integration Points

### 1. ActionTraceFilter Integration

- Uses `isEnabled()` to check global tracing status
- Uses `shouldTrace(actionId)` to check action-specific tracing
- Fast-path optimization when tracing is disabled

### 2. ActionExecutionTrace Integration

- Creates trace instances via ActionExecutionTraceFactory
- Captures all execution phases: start, payload, result, error
- Handles trace lifecycle management

### 3. ActionTraceOutputService Integration

- Writes traces asynchronously to avoid blocking execution
- Handles write failures gracefully with logging
- Supports batch writing and performance optimization

### 4. EventDispatchService Integration

- Captures event payloads before dispatch
- Records dispatch success/failure status
- Maintains existing error handling patterns

## Error Handling

### Trace Creation Errors

- Log warning and continue execution without tracing
- Never break action execution due to trace creation failure
- Track failure rates for monitoring

### Payload Capture Errors

- Log debug message and continue with partial trace
- Handle malformed payloads gracefully
- Sanitize sensitive data automatically

### Result Capture Errors

- Log debug message and continue execution
- Allow incomplete traces to be written
- Preserve as much trace data as possible

### Trace Write Errors

- Log warning asynchronously
- Don't block action execution
- Consider implementing retry logic

## Security Considerations

1. **Payload Sanitization** - Sensitive data is removed before tracing
2. **Async Operations** - Trace writing doesn't block critical paths
3. **Error Isolation** - Tracing failures don't impact game functionality
4. **Resource Limits** - Trace data size is limited to prevent memory issues
5. **Optional Dependencies** - System works without tracing infrastructure

## Dependencies

### Internal Dependencies

- ActionTraceFilter from ACTTRA-003
- ActionExecutionTrace from ACTTRA-019
- ActionTraceOutputService from ACTTRA-024
- EventDispatchService (existing)
- Validation utilities

### External Dependencies

- None (optional tracing dependencies can be null)

## Risks and Mitigation

| Risk                            | Probability | Impact | Mitigation                                    |
| ------------------------------- | ----------- | ------ | --------------------------------------------- |
| Tracing breaks action execution | Low         | High   | Comprehensive error handling and testing      |
| Performance degradation         | Medium      | Medium | Zero-overhead when disabled, async operations |
| Memory leaks from trace objects | Low         | Medium | Proper cleanup and resource limits            |
| Sensitive data exposure         | Low         | High   | Automatic sanitization and security review    |
| Integration complexity          | Medium      | Low    | Phased implementation and thorough testing    |

## Acceptance Criteria

- [ ] CommandProcessor supports optional tracing dependencies
- [ ] Zero performance impact when tracing is disabled
- [ ] Minimal performance impact (<1ms) for traced actions
- [ ] All execution phases captured in traces
- [ ] Tracing failures never break action execution
- [ ] Event payloads sanitized before storage
- [ ] Traces written asynchronously without blocking
- [ ] Comprehensive error handling for all trace operations
- [ ] Integration tests verify end-to-end functionality
- [ ] Performance tests validate overhead requirements
- [ ] Backward compatibility maintained

## Future Enhancements

1. **Trace Correlation** - Link related action executions
2. **Real-time Monitoring** - Stream traces to monitoring systems
3. **Adaptive Sampling** - Dynamic trace sampling based on load
4. **Compression** - Compress trace data for storage efficiency
5. **Distributed Tracing** - Support for multiplayer scenarios

## Documentation Requirements

1. **Integration Guide** - How to enable tracing in CommandProcessor
2. **Configuration Reference** - All tracing options and settings
3. **Performance Guide** - Understanding and optimizing trace overhead
4. **Troubleshooting Guide** - Debugging tracing issues

## Definition of Done

- [ ] CommandProcessor enhanced according to specification
- [ ] Tracing dependencies integrated with DI container
- [ ] Error handling implemented for all trace operations
- [ ] Unit tests written and passing (>95% coverage)
- [ ] Integration tests verify end-to-end tracing
- [ ] Performance tests validate overhead requirements
- [ ] Security review passed
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Backward compatibility verified
