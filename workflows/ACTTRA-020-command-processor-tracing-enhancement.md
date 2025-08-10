# ACTTRA-020: Enhance CommandProcessor with Execution Tracing

## Summary

Integrate the ActionExecutionTrace system into the CommandProcessor's dispatchAction method to provide comprehensive tracing of action execution. This enhancement will capture the complete action lifecycle from initial dispatch through event creation, payload construction, EventDispatchService interaction, and final result handling, while maintaining backward compatibility and ensuring zero performance impact when tracing is disabled.

## Critical Updates from Original Workflow

This workflow has been corrected to align with the actual codebase structure:

1. **Constructor Pattern**: Uses options object pattern matching existing code, not individual parameters
2. **Logger Initialization**: Uses `initLogger` from `loggerUtils.js`, not direct logger injection
3. **Dependency Validation**: Uses existing `validateDependency` from `validationUtils.js`
4. **Required Dependencies**: Includes `safeEventDispatcher` which is required by actual CommandProcessor
5. **Import Paths**: All imports use correct relative paths based on actual file locations
6. **DI Registration**: Updates `commandAndActionRegistrations.js`, not a non-existent `commandContainer.js`
7. **Error Handling**: Uses simple inline try-catch with existing logger, not complex error handler classes
8. **Prerequisite Service**: ActionTraceOutputService must be created first (ACTTRA-024)

## Status

- **Type**: Enhancement
- **Priority**: High
- **Complexity**: Medium
- **Estimated Time**: 3 hours
- **Dependencies**: ACTTRA-019 (ActionExecutionTrace), ACTTRA-003 (ActionTraceFilter), ACTTRA-024 (ActionTraceOutputService - must be created first)

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

### Prerequisites

Before implementing this workflow, the following component must be created:

#### ActionTraceOutputService (ACTTRA-024)
- **Location**: `src/actions/tracing/actionTraceOutputService.js`
- **Interface**: Must implement `writeTrace(trace)` method
- **Token**: Add `IActionTraceOutputService` to `src/dependencyInjection/tokens/actionTracingTokens.js`

### 1. Enhanced CommandProcessor Integration

#### File: `src/commands/commandProcessor.js` (Modified)

```javascript
/**
 * @file CommandProcessor with integrated execution tracing
 * Enhanced to support ActionExecutionTrace for debugging and analysis
 */

import { initLogger } from '../utils/loggerUtils.js';
import { validateDependency } from '../utils/validationUtils.js';

/**
 * CommandProcessor handles action dispatching with optional execution tracing
 * Integrates with ActionTraceFilter to selectively trace action executions
 */
export class CommandProcessor {
  #logger;
  #safeEventDispatcher;
  #eventDispatchService;
  #actionTraceFilter;
  #actionExecutionTraceFactory;
  #actionTraceOutputService;

  constructor(options) {
    const { 
      logger, 
      safeEventDispatcher, 
      eventDispatchService,
      actionTraceFilter,
      actionExecutionTraceFactory,
      actionTraceOutputService
    } = options || {};

    // Use existing validation patterns from codebase
    this.#logger = initLogger('CommandProcessor', logger);
    
    validateDependency(safeEventDispatcher, 'safeEventDispatcher', this.#logger, {
      requiredMethods: ['dispatch'],
    });
    
    validateDependency(eventDispatchService, 'eventDispatchService', this.#logger, {
      requiredMethods: ['dispatchWithErrorHandling'],
    });

    this.#safeEventDispatcher = safeEventDispatcher;
    this.#eventDispatchService = eventDispatchService;

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

### 2. Token Definition Updates

#### File: `src/dependencyInjection/tokens/actionTracingTokens.js` (Modified)

```javascript
/**
 * @file Action tracing dependency injection tokens
 */

export const actionTracingTokens = {
  IActionTraceFilter: 'IActionTraceFilter',
  IActionExecutionTraceFactory: 'IActionExecutionTraceFactory', // Add this token
  IActionTraceOutputService: 'IActionTraceOutputService', // Add this token
};
```

### 3. Dependency Injection Integration

#### File: `src/dependencyInjection/registrations/commandAndActionRegistrations.js` (Modified)

```javascript
/**
 * @file Command and action registration with tracing support
 */

import { CommandProcessor } from '../../commands/commandProcessor.js';
import { tokens } from '../tokens/index.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';

/**
 * Register CommandProcessor with optional tracing support
 */
export function registerCommandProcessor(registrar) {
  registrar.singletonFactory(tokens.ICommandProcessor, (c) => {
    // Required dependencies
    const logger = c.resolve(tokens.ILogger);
    const safeEventDispatcher = c.resolve(tokens.ISafeEventDispatcher);
    const eventDispatchService = c.resolve(tokens.EventDispatchService);
    
    // Try to resolve optional tracing dependencies
    let actionTraceFilter, actionExecutionTraceFactory, actionTraceOutputService;
    
    try {
      actionTraceFilter = c.resolve(actionTracingTokens.IActionTraceFilter);
    } catch {
      // Optional dependency not registered
      actionTraceFilter = null;
    }
    
    try {
      actionExecutionTraceFactory = c.resolve(actionTracingTokens.IActionExecutionTraceFactory);
    } catch {
      // Optional dependency not registered
      actionExecutionTraceFactory = null;
    }
    
    try {
      actionTraceOutputService = c.resolve(actionTracingTokens.IActionTraceOutputService);
    } catch {
      // Optional dependency not registered
      actionTraceOutputService = null;
    }
    
    // Log tracing status
    const tracingEnabled = actionTraceFilter && actionExecutionTraceFactory && actionTraceOutputService;
    logger.info(
      `CommandProcessor: Action execution tracing ${tracingEnabled ? 'enabled' : 'disabled'}`
    );
    
    return new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
      actionTraceFilter,
      actionExecutionTraceFactory,
      actionTraceOutputService,
    });
  });
}
```

### 4. Simplified Error Handling (Using Existing Patterns)

Instead of creating complex error handling classes, the implementation will use inline try-catch blocks with the existing logger, following the patterns already established in the codebase. Error handling will be kept simple:

```javascript
// In CommandProcessor, handle errors inline:
try {
  if (this.#shouldCreateTrace(actionId)) {
    actionTrace = this.#createExecutionTrace(turnAction, actorId);
    actionTrace.captureDispatchStart();
  }
} catch (traceError) {
  // Log trace creation failure but continue execution
  this.#logger.warn('Failed to create execution trace', {
    error: traceError.message,
    actionId,
    actorId,
  });
  // Continue without trace - don't break action execution
}

// Similarly for other trace operations:
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

// Write trace asynchronously without blocking:
if (actionTrace && this.#actionTraceOutputService) {
  this.#actionTraceOutputService.writeTrace(trace).catch((writeError) => {
    this.#logger.warn('Failed to write execution trace', {
      error: writeError.message,
      actionId,
    });
  });
}

## Implementation Tasks

### Phase 0: Prerequisites (30 minutes)

1. **Create ActionTraceOutputService (ACTTRA-024)**
   - [ ] Create `src/actions/tracing/actionTraceOutputService.js`
   - [ ] Implement `writeTrace(trace)` method
   - [ ] Add unit tests for the service
   - [ ] Register with DI container

2. **Update Token Definitions**
   - [ ] Add `IActionExecutionTraceFactory` to `actionTracingTokens.js`
   - [ ] Add `IActionTraceOutputService` to `actionTracingTokens.js`

### Phase 1: Core Integration (1.5 hours)

1. **Modify CommandProcessor constructor**
   - [ ] Update to use options object pattern
   - [ ] Use `initLogger` from `loggerUtils.js`
   - [ ] Add validation for `safeEventDispatcher` and `eventDispatchService`
   - [ ] Add optional tracing dependencies
   - [ ] Ensure backward compatibility

2. **Enhance dispatchAction method**
   - [ ] Add trace creation logic with shouldTrace check
   - [ ] Use inline try-catch for error handling
   - [ ] Integrate payload capture after event payload creation
   - [ ] Add result capture after dispatch completion
   - [ ] Implement error capture in catch blocks

3. **Add trace lifecycle management**
   - [ ] Implement start/end trace tracking
   - [ ] Add async trace writing without blocking execution
   - [ ] Create helper methods for trace operations
   - [ ] Use existing logger for all warnings/errors

### Phase 2: Simplified Error Handling (30 minutes)

1. **Implement inline error handling**
   - [ ] Add try-catch around all trace operations
   - [ ] Use existing logger for warnings
   - [ ] Ensure tracing failures never break action execution
   - [ ] Continue execution on any trace failure

2. **Optimize for zero-impact when disabled**
   - [ ] Add fast-path exit for disabled tracing
   - [ ] Minimize object creation when tracing disabled
   - [ ] Ensure no performance overhead for non-traced actions

### Phase 3: Integration and Testing (30 minutes)

1. **Update dependency injection**
   - [ ] Modify `commandAndActionRegistrations.js`
   - [ ] Add optional dependency handling with try-catch
   - [ ] Log tracing status on initialization

2. **Create test infrastructure**
   - [ ] Create mock factories in test helpers
   - [ ] Add unit tests for tracing scenarios
   - [ ] Add integration tests for end-to-end flow

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
    this.#logger.warn('Failed to capture event payload in trace', {
      error: payloadError.message,
      actionId,
    });
    // Continue execution - payload capture failure shouldn't break action
  }
}
```

### Example 4: Async Trace Writing

```javascript
// Write trace without blocking action execution
#writeTraceAsync(trace, actionId) {
  this.#actionTraceOutputService.writeTrace(trace).catch(writeError => {
    this.#logger.warn('Failed to write execution trace', {
      error: writeError.message,
      actionId,
    });
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
// Note: Mock factories need to be created in test helpers first

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

## Implementation Order

To successfully implement this workflow, follow this order:

1. **First**: Create ActionTraceOutputService (ACTTRA-024)
   - Must be completed before starting this workflow
   - Implement the `writeTrace(trace)` method
   - Add corresponding token to `actionTracingTokens.js`

2. **Second**: Update token definitions
   - Add missing `IActionExecutionTraceFactory` token
   - Verify all tokens are properly exported

3. **Third**: Update CommandProcessor
   - Modify constructor to accept options object
   - Add optional tracing dependencies
   - Implement inline error handling

4. **Fourth**: Update DI registration
   - Modify `commandAndActionRegistrations.js`
   - Use try-catch for optional dependency resolution

5. **Fifth**: Create tests
   - Create necessary mock factories
   - Add unit and integration tests

## Definition of Done

- [ ] ActionTraceOutputService created and tested (prerequisite)
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
