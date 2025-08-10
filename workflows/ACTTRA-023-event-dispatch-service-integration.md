# ACTTRA-023: Integrate Event Dispatch Tracing with EventDispatchService

## Summary

Enhance the existing EventDispatchService at `src/utils/eventDispatchService.js` to provide optional event dispatch tracing capabilities through the layered event system (SafeEventDispatcher → ValidatedEventDispatcher → EventBus). This integration will capture event dispatch timing, success/failure metrics, and payload information while maintaining backward compatibility and the existing architectural patterns.

## Status

- **Type**: Enhancement  
- **Priority**: Medium
- **Complexity**: Medium  
- **Estimated Time**: 2.5 hours
- **Dependencies**: ACTTRA-019 (ActionExecutionTrace), ACTTRA-020 (CommandProcessor integration), ACTTRA-021 (Timing)

## Technical Specification

### 1. Enhanced EventDispatchService

#### File: `src/utils/eventDispatchService.js` (Enhanced)

The existing EventDispatchService already has tracing-friendly methods like `dispatchWithErrorHandling`. We'll enhance it with optional tracing dependencies:

```javascript
/**
 * @file Enhanced EventDispatchService with optional event dispatch tracing
 */

import { createErrorDetails } from './errorDetails.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';
import { ensureValidLogger } from './loggerUtils.js';
import { assertPresent } from './dependencyUtils.js';

export class EventDispatchService {
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {ILogger} */
  #logger;
  /** @type {IActionTraceFilter|null} */
  #actionTraceFilter;
  /** @type {IEventDispatchTracer|null} */
  #eventDispatchTracer;

  constructor({ 
    safeEventDispatcher, 
    logger,
    actionTraceFilter = null,
    eventDispatchTracer = null 
  }) {
    assertPresent(safeEventDispatcher, 'EventDispatchService: safeEventDispatcher is required');
    assertPresent(logger, 'EventDispatchService: logger is required');
    
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#logger = logger;
    this.#actionTraceFilter = actionTraceFilter;
    this.#eventDispatchTracer = eventDispatchTracer;
  }

  /**
   * Enhanced dispatchWithErrorHandling with optional tracing
   */
  async dispatchWithErrorHandling(eventName, payload, context) {
    const shouldTrace = this.#shouldTrace(eventName, payload);
    let eventTrace = null;

    // Create trace if enabled
    if (shouldTrace && this.#eventDispatchTracer) {
      try {
        eventTrace = this.#eventDispatchTracer.createTrace({
          eventName,
          payload: this.#sanitizePayload(payload),
          context,
          timestamp: Date.now()
        });
        eventTrace.captureDispatchStart();
      } catch (traceError) {
        this.#logger.warn('Failed to create event dispatch trace', traceError);
      }
    }

    const startTime = performance.now();
    
    try {
      this.#logger.debug(
        `dispatchWithErrorHandling: Attempting dispatch: ${context} ('${eventName}')`
      );

      const success = await this.#safeEventDispatcher.dispatch(eventName, payload);
      const duration = performance.now() - startTime;

      if (eventTrace) {
        eventTrace.captureDispatchSuccess({ success, duration });
        this.#writeTraceAsync(eventTrace);
      }

      if (success) {
        this.#logger.debug(
          `dispatchWithErrorHandling: Dispatch successful for ${context}.`
        );
      } else {
        this.#logger.warn(
          `dispatchWithErrorHandling: SafeEventDispatcher reported failure for ${context}`
        );
      }
      
      return success;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      if (eventTrace) {
        eventTrace.captureDispatchError(error, { duration, context });
        this.#writeTraceAsync(eventTrace);
      }

      this.#logger.error(
        `dispatchWithErrorHandling: CRITICAL - Error during dispatch for ${context}`,
        error
      );
      
      this.dispatchSystemError(
        'System error during event dispatch.',
        createErrorDetails(`Exception in dispatch for ${eventName}`, error?.stack)
      );
      
      return false;
    }
  }

  #shouldTrace(eventName, payload) {
    if (!this.#actionTraceFilter || !this.#eventDispatchTracer) {
      return false;
    }
    
    if (!this.#actionTraceFilter.isEnabled()) {
      return false;
    }

    // For action events, check action ID
    if (eventName === 'ATTEMPT_ACTION_ID' && payload?.action?.definitionId) {
      return this.#actionTraceFilter.shouldTrace(payload.action.definitionId);
    }

    // For other events, check event name
    return this.#actionTraceFilter.shouldTrace(eventName);
  }

  #sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'credential'];
    
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  #writeTraceAsync(eventTrace) {
    if (!this.#eventDispatchTracer) return;

    this.#eventDispatchTracer.writeTrace(eventTrace).catch(error => {
      this.#logger.warn('Failed to write event dispatch trace', error);
    });
  }

  // ... existing methods remain unchanged
}
```

### 2. Event Dispatch Tracer Implementation

#### File: `src/events/tracing/eventDispatchTracer.js`

```javascript
/**
 * @file Event dispatch tracing implementation
 */

import { assertPresent } from '../../utils/dependencyUtils.js';

export class EventDispatchTracer {
  #logger;
  #outputService;

  constructor({ logger, outputService }) {
    assertPresent(logger, 'EventDispatchTracer: logger is required');
    assertPresent(outputService, 'EventDispatchTracer: outputService is required');

    this.#logger = logger;
    this.#outputService = outputService;
  }

  createTrace(context) {
    return new EventDispatchTrace(context);
  }

  async writeTrace(trace) {
    try {
      await this.#outputService.writeTrace(trace);
    } catch (error) {
      this.#logger.error('Failed to write event dispatch trace', error);
      throw error;
    }
  }
}

export class EventDispatchTrace {
  #eventName;
  #payload;
  #context;
  #timestamp;
  #traceData;

  constructor({ eventName, payload, context, timestamp }) {
    this.#eventName = eventName;
    this.#payload = payload;
    this.#context = context;
    this.#timestamp = timestamp;
    this.#traceData = {
      dispatchStart: null,
      dispatchEnd: null,
      duration: null,
      success: null,
      error: null
    };
  }

  captureDispatchStart() {
    this.#traceData.dispatchStart = performance.now();
  }

  captureDispatchSuccess({ success, duration }) {
    this.#traceData.dispatchEnd = performance.now();
    this.#traceData.duration = duration;
    this.#traceData.success = success;
  }

  captureDispatchError(error, { duration, context }) {
    this.#traceData.dispatchEnd = performance.now();
    this.#traceData.duration = duration;
    this.#traceData.success = false;
    this.#traceData.error = {
      message: error.message,
      type: error.constructor.name,
      context
    };
  }

  toJSON() {
    return {
      metadata: {
        traceType: 'event_dispatch',
        eventName: this.#eventName,
        context: this.#context,
        timestamp: this.#timestamp,
        createdAt: new Date().toISOString(),
        version: '1.0'
      },
      dispatch: {
        startTime: this.#traceData.dispatchStart,
        endTime: this.#traceData.dispatchEnd,
        duration: this.#traceData.duration,
        success: this.#traceData.success,
        error: this.#traceData.error
      },
      payload: this.#payload
    };
  }
}
```

### 3. Dependency Injection Integration

#### File: `src/dependencyInjection/tokens/actionTracingTokens.js` (Enhanced)

```javascript
export const actionTracingTokens = freeze({
  IActionTraceConfigLoader: 'IActionTraceConfigLoader',
  IActionTraceConfigValidator: 'IActionTraceConfigValidator',
  IActionTraceFilter: 'IActionTraceFilter',
  IActionExecutionTraceFactory: 'IActionExecutionTraceFactory',
  IActionTraceOutputService: 'IActionTraceOutputService',
  ITraceDirectoryManager: 'ITraceDirectoryManager',
  IActionAwareStructuredTrace: 'IActionAwareStructuredTrace',
  // New tokens for event dispatch tracing
  IEventDispatchTracer: 'IEventDispatchTracer',
});
```

#### File: `src/dependencyInjection/registrations/actionTracingRegistrations.js` (Enhanced)

Add registration for the new EventDispatchTracer:

```javascript
// Register EventDispatchTracer
registrar.singletonFactory(actionTracingTokens.IEventDispatchTracer, (c) => {
  return new EventDispatchTracer({
    logger: c.resolve(tokens.ILogger),
    outputService: c.resolve(actionTracingTokens.IActionTraceOutputService)
  });
});

// Update EventDispatchService registration to include tracing dependencies
registrar.singletonFactory(tokens.IEventDispatchService, (c) => {
  return new EventDispatchService({
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    logger: c.resolve(tokens.ILogger),
    actionTraceFilter: resolveOptional(c, actionTracingTokens.IActionTraceFilter),
    eventDispatchTracer: resolveOptional(c, actionTracingTokens.IEventDispatchTracer)
  });
});
```

### 4. Testing Implementation

#### File: `tests/unit/utils/eventDispatchService.tracing.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { TestBed } from '../../common/testBed.js';

describe('EventDispatchService - Tracing Integration', () => {
  let testBed;
  let eventDispatchService;

  beforeEach(() => {
    testBed = new TestBed();
    
    // Configure with tracing enabled
    testBed.enableEventDispatchTracing();
    eventDispatchService = testBed.getService('IEventDispatchService');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should create and write trace when event is traced', async () => {
    testBed.configureActionTracing(['ATTEMPT_ACTION_ID']);

    const result = await eventDispatchService.dispatchWithErrorHandling(
      'ATTEMPT_ACTION_ID',
      { action: { definitionId: 'core:go' } },
      'Action execution test'
    );

    expect(result).toBe(true);
    
    const traces = testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].metadata.eventName).toBe('ATTEMPT_ACTION_ID');
  });

  it('should not create trace when tracing disabled', async () => {
    testBed.disableActionTracing();

    await eventDispatchService.dispatchWithErrorHandling(
      'TEST_EVENT',
      { data: 'test' },
      'Test context'
    );

    const traces = testBed.getWrittenTraces();
    expect(traces).toHaveLength(0);
  });
});
```

## Key Changes from Original Workflow

1. **Respects Existing Architecture**: Works with the current EventDispatchService → SafeEventDispatcher → ValidatedEventDispatcher → EventBus layered approach
2. **No EventBus Modification**: Doesn't require adding `getHandlers()` method or modifying EventBus internals
3. **Correct File Locations**: Uses actual file locations (`src/utils/eventDispatchService.js`)
4. **Proper Dependency Injection**: Follows existing token and registration patterns
5. **Simplified Tracing**: Focuses on dispatch-level tracing rather than individual handler tracing
6. **Backward Compatibility**: All tracing dependencies are optional
7. **Testing Integration**: Uses project's TestBed pattern instead of custom mocks

## Implementation Phases

### Phase 1: EventDispatchService Enhancement (1 hour)
- Add optional tracing dependencies to constructor
- Enhance `dispatchWithErrorHandling` with trace creation/writing
- Add payload sanitization and trace filtering logic

### Phase 2: Event Dispatch Tracer Implementation (1 hour)  
- Create EventDispatchTracer and EventDispatchTrace classes
- Implement trace data structure and serialization
- Add integration with existing output services

### Phase 3: Dependency Injection Integration (30 minutes)
- Add new tokens to actionTracingTokens
- Register EventDispatchTracer in actionTracingRegistrations
- Update EventDispatchService registration with optional dependencies

This corrected workflow maintains the original goals while working within the existing architectural constraints and patterns of the Living Narrative Engine codebase.