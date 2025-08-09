# ACTTRA-019: Create ActionExecutionTrace Class

## Summary

Implement the core ActionExecutionTrace class that serves as the primary data structure for capturing action execution metadata, timing information, and results during the command processing pipeline. This class will be the foundation for execution tracing, providing methods to capture dispatch timing, event payloads, execution results, and error information in a structured format suitable for analysis and debugging.

**Note**: The codebase already contains an `ActionAwareStructuredTrace` class at `src/actions/tracing/actionAwareStructuredTrace.js` that provides action tracing capabilities. This new `ActionExecutionTrace` class will focus specifically on execution-level details and timing precision, complementing the existing structured trace system rather than replacing it.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: Low
- **Estimated Time**: 2 hours
- **Dependencies**: ACTTRA-003 (ActionTraceFilter), ACTTRA-024 (ActionTraceOutputService integration)

## Existing Infrastructure

### Current Tracing Components

- **ActionAwareStructuredTrace** (`src/actions/tracing/actionAwareStructuredTrace.js`) - Extends StructuredTrace with action-specific capabilities
- **EnhancedActionTraceFilter** (`src/actions/tracing/enhancedActionTraceFilter.js`) - Filtering logic for action traces
- **PerformanceMonitor** (`src/actions/tracing/performanceMonitor.js`) - Performance monitoring utilities

### Integration Strategy

The new `ActionExecutionTrace` will:

1. Focus on execution-specific metadata (timing, payloads, results)
2. Integrate with existing `EnhancedActionTraceFilter` for filtering decisions
3. Complement `ActionAwareStructuredTrace` for different use cases:
   - `ActionExecutionTrace`: Lightweight, execution-focused, timing-precise
   - `ActionAwareStructuredTrace`: Full structured tracing with nested operations

## Objectives

### Primary Goals

1. **Execution Metadata Capture** - Store essential action execution information (action ID, actor ID, turn action)
2. **Timing Precision** - Capture high-precision start/end timestamps and calculate durations
3. **Event Payload Storage** - Store event payloads sent through the dispatch system
4. **Result Documentation** - Capture dispatch results and success/failure status
5. **Error Handling** - Comprehensive error capture including stack traces and error types
6. **Serialization Support** - JSON output for file-based trace analysis

### Success Criteria

- [ ] ActionExecutionTrace class handles all execution phases (start, payload, result, error)
- [ ] Timing measurements use high-precision timestamps (performance.now() equivalent)
- [ ] Error capture includes message, stack trace, and error type information
- [ ] JSON serialization produces well-structured, readable output
- [ ] Class integrates seamlessly with CommandProcessor workflow
- [ ] Memory usage remains minimal (<1KB per trace instance)
- [ ] All captured data is immutable after initial capture

## Technical Specification

### 1. Core ActionExecutionTrace Class

#### File: `src/actions/tracing/actionExecutionTrace.js`

```javascript
/**
 * @file Action execution trace data structure
 * Captures timing, payloads, results, and errors for action execution
 */

/**
 * ActionExecutionTrace class for capturing action execution data
 * Used by CommandProcessor to track action dispatch and execution
 */
export class ActionExecutionTrace {
  #actionId;
  #actorId;
  #turnAction;
  #executionData;
  #startTime;
  #endTime;

  /**
   * Create new execution trace
   * @param {Object} options - Trace options
   * @param {string} options.actionId - Action definition ID being executed
   * @param {string} options.actorId - Actor performing the action
   * @param {Object} options.turnAction - Complete turn action object
   */
  constructor({ actionId, actorId, turnAction }) {
    // Validate required parameters
    if (!actionId || typeof actionId !== 'string') {
      throw new Error('ActionExecutionTrace requires valid actionId string');
    }
    if (!actorId || typeof actorId !== 'string') {
      throw new Error('ActionExecutionTrace requires valid actorId string');
    }
    if (!turnAction || typeof turnAction !== 'object') {
      throw new Error('ActionExecutionTrace requires valid turnAction object');
    }

    this.#actionId = actionId;
    this.#actorId = actorId;
    this.#turnAction = Object.freeze({ ...turnAction }); // Immutable copy

    // Initialize execution data structure
    this.#executionData = {
      startTime: null,
      endTime: null,
      duration: null,
      eventPayload: null,
      dispatchResult: null,
      error: null,
      phases: [], // Track execution phases
    };

    this.#startTime = null;
    this.#endTime = null;
  }

  /**
   * Mark the start of action dispatch
   * Captures high-precision start time
   */
  captureDispatchStart() {
    if (this.#startTime !== null) {
      throw new Error('Dispatch already started for this trace');
    }

    this.#startTime = this.#getHighPrecisionTime();
    this.#executionData.startTime = this.#startTime;

    this.#executionData.phases.push({
      phase: 'dispatch_start',
      timestamp: this.#startTime,
      description: 'Action dispatch initiated',
    });
  }

  /**
   * Capture the event payload sent to EventDispatchService
   * @param {Object} payload - Event payload object
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

    // Create immutable copy of payload, filtering sensitive data
    this.#executionData.eventPayload = this.#sanitizePayload(payload);

    this.#executionData.phases.push({
      phase: 'payload_captured',
      timestamp: this.#getHighPrecisionTime(),
      description: 'Event payload captured',
      payloadSize: this.#calculatePayloadSize(payload),
    });
  }

  /**
   * Capture the result of dispatch operation
   * @param {Object} result - Dispatch result
   * @param {boolean} result.success - Whether dispatch succeeded
   * @param {number} [result.timestamp] - Result timestamp
   * @param {Object} [result.metadata] - Additional result metadata
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

    // Store dispatch result
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
  }

  /**
   * Capture error information
   * @param {Error} error - Error that occurred during execution
   */
  captureError(error) {
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing error'
      );
    }

    const errorTime = this.#getHighPrecisionTime();

    // End timing if not already ended
    if (this.#endTime === null) {
      this.#endTime = errorTime;
      this.#executionData.endTime = this.#endTime;
      this.#executionData.duration = this.#endTime - this.#startTime;
    }

    // Capture comprehensive error information
    this.#executionData.error = {
      message: error.message || 'Unknown error',
      type: error.constructor.name || 'Error',
      stack: error.stack || null,
      timestamp: errorTime,
      // Additional error properties if available
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
   * Get the action ID being traced
   * @returns {string} Action definition ID
   */
  get actionId() {
    return this.#actionId;
  }

  /**
   * Get the actor ID performing the action
   * @returns {string} Actor ID
   */
  get actorId() {
    return this.#actorId;
  }

  /**
   * Check if execution is complete (either success or error)
   * @returns {boolean} True if execution is complete
   */
  get isComplete() {
    return this.#endTime !== null;
  }

  /**
   * Check if execution ended with error
   * @returns {boolean} True if error occurred
   */
  get hasError() {
    return this.#executionData.error !== null;
  }

  /**
   * Get execution duration in milliseconds
   * @returns {number|null} Duration or null if not complete
   */
  get duration() {
    return this.#executionData.duration;
  }

  /**
   * Get execution phases for detailed analysis
   * @returns {Array} Array of execution phases with timestamps
   */
  getExecutionPhases() {
    return [...this.#executionData.phases]; // Return copy
  }

  /**
   * Convert trace to JSON for serialization
   * @returns {Object} Serializable trace data
   */
  toJSON() {
    return {
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
        // Include other non-sensitive turn action properties
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
  }

  /**
   * Create human-readable summary
   * @returns {string} Human-readable trace summary
   */
  toSummary() {
    const status = this.#getExecutionStatus();
    const duration = this.#executionData.duration
      ? `${this.#executionData.duration.toFixed(2)}ms`
      : 'incomplete';

    return `Action: ${this.#actionId} | Actor: ${this.#actorId} | Status: ${status} | Duration: ${duration}`;
  }

  /**
   * Get high-precision timestamp
   * @private
   * @returns {number} High-precision timestamp
   */
  #getHighPrecisionTime() {
    // Use performance.now() if available, fallback to Date.now()
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  /**
   * Get execution status string
   * @private
   * @returns {string} Status description
   */
  #getExecutionStatus() {
    if (this.#executionData.error) {
      return 'error';
    } else if (this.#executionData.dispatchResult?.success === true) {
      return 'success';
    } else if (this.#executionData.dispatchResult?.success === false) {
      return 'failed';
    } else if (this.#startTime !== null && this.#endTime === null) {
      return 'in_progress';
    } else {
      return 'pending';
    }
  }

  /**
   * Sanitize payload to remove sensitive information
   * @private
   * @param {Object} payload - Original payload
   * @returns {Object} Sanitized payload
   */
  #sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };

    // Remove or redact sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'credential',
    ];
    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Deep sanitization for nested objects
    Object.keys(sanitized).forEach((key) => {
      if (sanitized[key] && typeof sanitized[key] === 'object') {
        sanitized[key] = this.#sanitizePayload(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Calculate approximate payload size
   * @private
   * @param {Object} payload - Payload to measure
   * @returns {number} Approximate size in bytes
   */
  #calculatePayloadSize(payload) {
    try {
      return new TextEncoder().encode(JSON.stringify(payload)).length;
    } catch {
      return 0; // Fallback if JSON.stringify fails
    }
  }
}

export default ActionExecutionTrace;
```

### 2. Type Definitions and Constants

#### File: `src/actions/tracing/actionTraceTypes.js`

```javascript
/**
 * @file Type definitions and constants for action tracing
 */

/**
 * @typedef {Object} ExecutionPhase
 * @property {string} phase - Phase name
 * @property {number} timestamp - Phase timestamp
 * @property {string} description - Phase description
 * @property {*} [metadata] - Additional phase metadata
 */

/**
 * @typedef {Object} DispatchResult
 * @property {boolean} success - Whether dispatch succeeded
 * @property {number} timestamp - Result timestamp
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} ErrorInfo
 * @property {string} message - Error message
 * @property {string} type - Error type/class name
 * @property {string} stack - Stack trace
 * @property {number} timestamp - Error timestamp
 * @property {string} [code] - Error code if available
 * @property {*} [cause] - Error cause if available
 */

/**
 * Execution phase constants
 */
export const EXECUTION_PHASES = {
  DISPATCH_START: 'dispatch_start',
  PAYLOAD_CAPTURED: 'payload_captured',
  DISPATCH_COMPLETED: 'dispatch_completed',
  ERROR_CAPTURED: 'error_captured',
};

/**
 * Execution status constants
 */
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SUCCESS: 'success',
  FAILED: 'failed',
  ERROR: 'error',
};

/**
 * Trace format version
 */
export const TRACE_FORMAT_VERSION = '1.0';

/**
 * Maximum payload size for capture (bytes)
 */
export const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

/**
 * Fields to redact from payloads
 */
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'credential',
  'auth',
  'authorization',
];
```

### 3. Factory and Utility Functions

#### File: `src/actions/tracing/actionExecutionTraceFactory.js`

```javascript
/**
 * @file Factory for creating ActionExecutionTrace instances
 */

import { ActionExecutionTrace } from './actionExecutionTrace.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * Factory for creating ActionExecutionTrace instances with validation
 */
export class ActionExecutionTraceFactory {
  #logger;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
  }

  /**
   * Create new ActionExecutionTrace instance
   * @param {Object} options - Trace creation options
   * @param {string} options.actionId - Action definition ID
   * @param {string} options.actorId - Actor ID
   * @param {Object} options.turnAction - Turn action object
   * @returns {ActionExecutionTrace} New trace instance
   */
  createTrace({ actionId, actorId, turnAction }) {
    try {
      // Validate inputs using actual validation patterns
      string.assertNonBlank(
        actionId,
        'actionId',
        'ActionExecutionTraceFactory'
      );
      string.assertNonBlank(actorId, 'actorId', 'ActionExecutionTraceFactory');

      if (!turnAction || typeof turnAction !== 'object') {
        throw new InvalidArgumentError(
          'Turn action is required and must be an object'
        );
      }

      // Validate turn action structure
      this.#validateTurnAction(turnAction);

      // Create and return trace instance
      const trace = new ActionExecutionTrace({
        actionId,
        actorId,
        turnAction,
      });

      this.#logger.debug(
        `Created execution trace for action '${actionId}' by actor '${actorId}'`
      );
      return trace;
    } catch (error) {
      this.#logger.error('Failed to create ActionExecutionTrace', error);
      throw new Error(`Failed to create execution trace: ${error.message}`);
    }
  }

  /**
   * Create trace from existing turn action
   * @param {Object} turnAction - Complete turn action
   * @param {string} actorId - Actor ID
   * @returns {ActionExecutionTrace} New trace instance
   */
  createFromTurnAction(turnAction, actorId) {
    if (!turnAction || typeof turnAction !== 'object') {
      throw new InvalidArgumentError(
        'Turn action is required and must be an object'
      );
    }

    string.assertNonBlank(actorId, 'actorId', 'ActionExecutionTraceFactory');

    const actionId = turnAction.actionDefinitionId;
    if (!actionId) {
      throw new InvalidArgumentError('Turn action missing actionDefinitionId');
    }

    return this.createTrace({ actionId, actorId, turnAction });
  }

  /**
   * Validate turn action structure
   * @private
   * @param {Object} turnAction - Turn action to validate
   */
  #validateTurnAction(turnAction) {
    if (!turnAction.actionDefinitionId) {
      throw new Error('Turn action missing required actionDefinitionId');
    }

    // Optional validation of other expected fields
    const expectedFields = ['commandString', 'parameters'];
    expectedFields.forEach((field) => {
      if (turnAction[field] !== undefined && turnAction[field] !== null) {
        // Field exists, perform type validation
        if (
          field === 'commandString' &&
          typeof turnAction[field] !== 'string'
        ) {
          this.#logger.warn(
            `Turn action ${field} should be string, got ${typeof turnAction[field]}`
          );
        }
        if (field === 'parameters' && typeof turnAction[field] !== 'object') {
          this.#logger.warn(
            `Turn action ${field} should be object, got ${typeof turnAction[field]}`
          );
        }
      }
    });
  }
}
```

## Implementation Tasks

**Note**: The following files need to be created as they don't currently exist:

- `src/actions/tracing/actionExecutionTrace.js` (TO BE CREATED)
- `src/actions/tracing/actionTraceTypes.js` (TO BE CREATED)
- `src/actions/tracing/actionExecutionTraceFactory.js` (TO BE CREATED)

### Phase 1: Core Class Implementation (1 hour)

1. **Create ActionExecutionTrace class structure** (NEW FILE)
   - [ ] Create `src/actions/tracing/actionExecutionTrace.js`
   - [ ] Implement constructor with parameter validation
   - [ ] Create private fields for data storage
   - [ ] Add parameter validation and error handling
   - [ ] Implement immutable data storage patterns

2. **Add timing capture methods**
   - [ ] Implement `captureDispatchStart()` with high-precision timing
   - [ ] Add execution phase tracking
   - [ ] Ensure timing precision and accuracy
   - [ ] Validate timing sequence integrity

3. **Implement data capture methods**
   - [ ] Create `captureEventPayload()` with sanitization
   - [ ] Add `captureDispatchResult()` for results
   - [ ] Implement `captureError()` for comprehensive error handling
   - [ ] Add payload size calculation

### Phase 2: Serialization and Utilities (45 minutes)

1. **Add serialization support**
   - [ ] Implement `toJSON()` method with proper structure
   - [ ] Create `toSummary()` for human-readable output
   - [ ] Add metadata and versioning
   - [ ] Ensure serializable output format

2. **Create utility methods and getters**
   - [ ] Add status and completion getters
   - [ ] Implement execution phase retrieval
   - [ ] Add duration calculations
   - [ ] Create validation helpers

3. **Implement security and sanitization**
   - [ ] Add payload sanitization for sensitive data
   - [ ] Implement field redaction
   - [ ] Add size limits and validation
   - [ ] Ensure no sensitive data leakage

### Phase 3: Factory and Integration (15 minutes)

1. **Create ActionExecutionTraceFactory** (NEW FILE)
   - [ ] Create `src/actions/tracing/actionExecutionTraceFactory.js`
   - [ ] Implement factory pattern with validation
   - [ ] Add turn action validation
   - [ ] Create convenience creation methods
   - [ ] Add proper error handling

2. **Add type definitions and constants** (NEW FILE)
   - [ ] Create `src/actions/tracing/actionTraceTypes.js`
   - [ ] Define TypeScript-style type definitions
   - [ ] Create execution phase constants
   - [ ] Add status constants
   - [ ] Document all types and interfaces

## Code Examples

### Example 1: Basic Usage in CommandProcessor

**Note**: CommandProcessor currently has no tracing infrastructure. The following shows how to integrate tracing:

```javascript
// In CommandProcessor constructor, add trace dependencies:
constructor({ eventDispatchService, logger, actionTraceFilter, traceFactory, traceOutputService, ...other }) {
  // ... existing dependencies ...

  // Add tracing dependencies (optional, can be null)
  this.#actionTraceFilter = actionTraceFilter || null;
  this.#traceFactory = traceFactory || null;
  this.#traceOutputService = traceOutputService || null;
}

// In CommandProcessor.dispatchAction()
async dispatchAction(actor, turnAction) {
  const actionId = turnAction.actionDefinitionId;
  let actionTrace = null;

  // Create trace if action should be traced and tracing is configured
  if (this.#actionTraceFilter?.shouldTrace(actionId) && this.#traceFactory) {
    actionTrace = this.#traceFactory.createTrace({
      actionId,
      actorId: actor.id,
      turnAction
    });
    actionTrace.captureDispatchStart();
  }

  try {
    // Create event payload
    const payload = this.#createAttemptActionPayload(actor, turnAction);

    if (actionTrace) {
      actionTrace.captureEventPayload(payload);
    }

    // Dispatch event
    const dispatchSuccess = await this.#eventDispatchService.dispatchWithErrorHandling(
      ATTEMPT_ACTION_ID,
      payload,
      `Action dispatch for ${actionId}`
    );

    if (actionTrace && this.#traceOutputService) {
      actionTrace.captureDispatchResult({ success: dispatchSuccess });
      await this.#traceOutputService.writeTrace(actionTrace);
    }

    return { success: dispatchSuccess, /* ... */ };

  } catch (error) {
    if (actionTrace && this.#traceOutputService) {
      actionTrace.captureError(error);
      await this.#traceOutputService.writeTrace(actionTrace);
    }
    throw error;
  }
}
```

### Example 2: Trace Analysis

```javascript
// Analyzing execution trace
const trace = new ActionExecutionTrace({
  actionId: 'core:go',
  actorId: 'player-1',
  turnAction: { actionDefinitionId: 'core:go', commandString: 'go north' },
});

trace.captureDispatchStart();
// ... execution phases ...
trace.captureDispatchResult({ success: true });

// Get timing information
console.log(`Execution took ${trace.duration}ms`);
console.log(`Status: ${trace.isComplete ? 'Complete' : 'In Progress'}`);

// Get detailed phases
trace.getExecutionPhases().forEach((phase) => {
  console.log(`${phase.phase}: ${phase.description} at ${phase.timestamp}ms`);
});

// Export for analysis
const traceData = trace.toJSON();
await fs.writeFile(
  `traces/trace-${Date.now()}.json`,
  JSON.stringify(traceData, null, 2)
);
```

### Example 3: Error Handling

```javascript
try {
  const trace = new ActionExecutionTrace({
    actionId: 'core:invalid_action',
    actorId: 'player-1',
    turnAction: {
      /* invalid structure */
    },
  });
} catch (error) {
  console.error('Failed to create trace:', error.message);
  // Handle trace creation failure gracefully
}

// During execution
if (actionTrace) {
  try {
    actionTrace.captureError(new Error('Action execution failed'));
    console.log('Error captured:', actionTrace.hasError); // true
  } catch (error) {
    logger.warn('Failed to capture error in trace:', error);
    // Continue execution - tracing failure shouldn't break game
  }
}
```

## Testing Requirements

### Unit Tests

#### File: `tests/unit/actions/tracing/actionExecutionTrace.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';

describe('ActionExecutionTrace', () => {
  let trace;

  const validParams = {
    actionId: 'core:go',
    actorId: 'player-1',
    turnAction: {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    },
  };

  beforeEach(() => {
    trace = new ActionExecutionTrace(validParams);
  });

  describe('Constructor', () => {
    it('should create trace with valid parameters', () => {
      expect(trace.actionId).toBe('core:go');
      expect(trace.actorId).toBe('player-1');
      expect(trace.isComplete).toBe(false);
      expect(trace.hasError).toBe(false);
    });

    it('should throw error for invalid actionId', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            actionId: null,
          })
      ).toThrow('ActionExecutionTrace requires valid actionId string');
    });

    it('should throw error for invalid actorId', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            actorId: '',
          })
      ).toThrow('ActionExecutionTrace requires valid actorId string');
    });

    it('should throw error for invalid turnAction', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            turnAction: null,
          })
      ).toThrow('ActionExecutionTrace requires valid turnAction object');
    });
  });

  describe('Execution Lifecycle', () => {
    it('should capture dispatch start correctly', () => {
      trace.captureDispatchStart();

      expect(trace.isComplete).toBe(false);
      const phases = trace.getExecutionPhases();
      expect(phases).toHaveLength(1);
      expect(phases[0].phase).toBe('dispatch_start');
      expect(typeof phases[0].timestamp).toBe('number');
    });

    it('should prevent multiple dispatch starts', () => {
      trace.captureDispatchStart();

      expect(() => trace.captureDispatchStart()).toThrow(
        'Dispatch already started for this trace'
      );
    });

    it('should capture event payload after start', () => {
      trace.captureDispatchStart();

      const payload = {
        actor: 'player-1',
        action: 'core:go',
        password: 'secret123', // Will be sanitized
      };

      trace.captureEventPayload(payload);

      const traceData = trace.toJSON();
      expect(traceData.eventPayload.password).toBe('[REDACTED]');
      expect(traceData.eventPayload.actor).toBe('player-1');
    });

    it('should require dispatch start before payload capture', () => {
      const payload = { actor: 'player-1' };

      expect(() => trace.captureEventPayload(payload)).toThrow(
        'Must call captureDispatchStart() before capturing payload'
      );
    });

    it('should capture dispatch result and complete execution', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({
        success: true,
        metadata: { duration: 100 },
      });

      expect(trace.isComplete).toBe(true);
      expect(trace.hasError).toBe(false);
      expect(typeof trace.duration).toBe('number');
      expect(trace.duration).toBeGreaterThan(0);
    });

    it('should capture error information', () => {
      trace.captureDispatchStart();

      const error = new Error('Test error');
      trace.captureError(error);

      expect(trace.isComplete).toBe(true);
      expect(trace.hasError).toBe(true);

      const traceData = trace.toJSON();
      expect(traceData.error.message).toBe('Test error');
      expect(traceData.error.type).toBe('Error');
      expect(traceData.error.stack).toBeTruthy();
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize to valid JSON structure', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const json = trace.toJSON();

      expect(json).toHaveProperty('metadata');
      expect(json).toHaveProperty('turnAction');
      expect(json).toHaveProperty('execution');
      expect(json.metadata.actionId).toBe('core:go');
      expect(json.metadata.traceType).toBe('execution');
      expect(json.execution.status).toBe('success');
    });

    it('should include execution phases in JSON', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const json = trace.toJSON();
      const phases = json.execution.phases;

      expect(Array.isArray(phases)).toBe(true);
      expect(phases.length).toBeGreaterThan(0);
      expect(phases[0]).toHaveProperty('phase');
      expect(phases[0]).toHaveProperty('timestamp');
      expect(phases[0]).toHaveProperty('description');
    });
  });

  describe('Summary Generation', () => {
    it('should generate human-readable summary', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const summary = trace.toSummary();

      expect(summary).toContain('core:go');
      expect(summary).toContain('player-1');
      expect(summary).toContain('success');
      expect(summary).toContain('ms');
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive fields in payloads', () => {
      trace.captureDispatchStart();

      const sensitivePayload = {
        username: 'player1',
        password: 'secret123',
        apiKey: 'key123',
        token: 'bearer-token',
        normalData: 'safe',
      };

      trace.captureEventPayload(sensitivePayload);
      const json = trace.toJSON();

      expect(json.eventPayload.password).toBe('[REDACTED]');
      expect(json.eventPayload.apiKey).toBe('[REDACTED]');
      expect(json.eventPayload.token).toBe('[REDACTED]');
      expect(json.eventPayload.normalData).toBe('safe');
      expect(json.eventPayload.username).toBe('player1');
    });

    it('should handle nested object sanitization', () => {
      trace.captureDispatchStart();

      const nestedPayload = {
        user: {
          name: 'player1',
          credentials: {
            password: 'secret',
            token: 'bearer',
          },
        },
        metadata: { safe: true },
      };

      trace.captureEventPayload(nestedPayload);
      const json = trace.toJSON();

      expect(json.eventPayload.user.credentials.password).toBe('[REDACTED]');
      expect(json.eventPayload.user.credentials.token).toBe('[REDACTED]');
      expect(json.eventPayload.user.name).toBe('player1');
      expect(json.eventPayload.metadata.safe).toBe(true);
    });
  });
});
```

### Integration Tests

#### File: `tests/integration/actions/tracing/actionExecutionTrace.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { createMockLogger } from '../../../common/mocks/mockLogger.js';

describe('ActionExecutionTrace Integration', () => {
  let traceFactory;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    traceFactory = new ActionExecutionTraceFactory({ logger: mockLogger });
  });

  it('should integrate with CommandProcessor workflow', async () => {
    // Simulate CommandProcessor workflow
    const turnAction = {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    };

    // Create trace
    const trace = traceFactory.createFromTurnAction(turnAction, 'player-1');

    // Simulate execution flow
    trace.captureDispatchStart();

    // Simulate event creation and dispatch
    const eventPayload = {
      eventType: 'ATTEMPT_ACTION_ID',
      actor: 'player-1',
      action: turnAction,
      timestamp: Date.now(),
    };

    trace.captureEventPayload(eventPayload);

    // Simulate successful dispatch
    await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate async work
    trace.captureDispatchResult({ success: true, timestamp: Date.now() });

    // Verify trace completeness
    expect(trace.isComplete).toBe(true);
    expect(trace.hasError).toBe(false);
    expect(trace.duration).toBeGreaterThan(0);

    // Verify JSON output is complete and valid
    const traceData = trace.toJSON();
    expect(traceData.metadata.actionId).toBe('core:go');
    expect(traceData.execution.status).toBe('success');
    expect(traceData.eventPayload.eventType).toBe('ATTEMPT_ACTION_ID');
    expect(traceData.execution.phases.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle error scenarios gracefully', async () => {
    const turnAction = {
      actionDefinitionId: 'core:invalid',
      commandString: 'invalid command',
    };

    const trace = traceFactory.createFromTurnAction(turnAction, 'player-1');
    trace.captureDispatchStart();

    // Simulate dispatch error
    const dispatchError = new Error('Dispatch failed');
    dispatchError.code = 'DISPATCH_ERROR';

    trace.captureError(dispatchError);

    // Verify error handling
    expect(trace.isComplete).toBe(true);
    expect(trace.hasError).toBe(true);

    const traceData = trace.toJSON();
    expect(traceData.error.message).toBe('Dispatch failed');
    expect(traceData.error.code).toBe('DISPATCH_ERROR');
    expect(traceData.execution.status).toBe('error');
  });
});
```

### Performance Tests

```javascript
describe('ActionExecutionTrace Performance', () => {
  it('should create traces quickly', () => {
    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      new ActionExecutionTrace({
        actionId: 'core:test',
        actorId: `actor-${i}`,
        turnAction: { actionDefinitionId: 'core:test' },
      });
    }

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100); // 1000 traces in <100ms
  });

  it('should serialize efficiently', () => {
    const trace = new ActionExecutionTrace({
      actionId: 'core:test',
      actorId: 'player-1',
      turnAction: { actionDefinitionId: 'core:test' },
    });

    trace.captureDispatchStart();
    trace.captureDispatchResult({ success: true });

    const startTime = performance.now();
    const json = trace.toJSON();
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(1); // Serialization in <1ms
    expect(JSON.stringify(json).length).toBeGreaterThan(0);
  });
});
```

## Integration Points

### 1. CommandProcessor Integration

The ActionExecutionTrace class will be primarily used within the CommandProcessor's `dispatchAction` method to capture the complete execution lifecycle. Since CommandProcessor currently has no tracing, this will be an opt-in enhancement.

### 2. ActionTraceOutputService Integration

Traces will be passed to the ActionTraceOutputService for file output and management.

### 3. EnhancedActionTraceFilter Integration

The CommandProcessor will use the existing `EnhancedActionTraceFilter` to determine whether a trace should be created for a specific action.

### 4. EventDispatchService Integration

Event payloads and dispatch results from EventDispatchService will be captured in the trace.

## Migration and Coexistence Strategy

### Relationship with Existing Tracing

The codebase currently has two tracing approaches that will coexist:

1. **ActionAwareStructuredTrace** (Existing)
   - **Purpose**: Full structured tracing with nested operations
   - **Use Cases**: Complex multi-step operations, nested action hierarchies
   - **Features**: Operation nesting, context preservation, structured logging
   - **When to Use**: When you need to trace complex operation trees or maintain context across nested calls

2. **ActionExecutionTrace** (New)
   - **Purpose**: Lightweight execution-focused tracing with timing precision
   - **Use Cases**: Single action execution, performance analysis, debugging
   - **Features**: High-precision timing, payload capture, error details
   - **When to Use**: When you need precise timing data or execution-level debugging

### Integration Approach

```javascript
// Example: Using both trace types together
class CommandProcessor {
  constructor({
    structuredTraceFactory, // For ActionAwareStructuredTrace
    executionTraceFactory, // For ActionExecutionTrace (new)
    traceFilter,
    ...other
  }) {
    this.#structuredTraceFactory = structuredTraceFactory;
    this.#executionTraceFactory = executionTraceFactory;
    this.#traceFilter = traceFilter;
  }

  async dispatchAction(actor, turnAction) {
    const actionId = turnAction.actionDefinitionId;

    // Use structured trace for complex operations
    const structuredTrace = this.#structuredTraceFactory?.createTrace(actionId);

    // Use execution trace for timing and debugging
    const executionTrace = this.#traceFilter?.shouldTrace(actionId)
      ? this.#executionTraceFactory?.createTrace({
          actionId,
          actorId: actor.id,
          turnAction,
        })
      : null;

    // Both traces can work in parallel
    structuredTrace?.startOperation('dispatch');
    executionTrace?.captureDispatchStart();

    // ... rest of implementation
  }
}
```

### No Breaking Changes

- Existing `ActionAwareStructuredTrace` usage remains unchanged
- New `ActionExecutionTrace` is opt-in via dependency injection
- Both trace types can be used independently or together
- No modifications required to existing trace consumers

## Error Handling

### Construction Errors

- Invalid parameters throw immediately with descriptive messages
- Missing required fields are validated and reported

### Runtime Errors

- Invalid method call sequences throw descriptive errors
- Tracing failures are logged but don't break action execution
- Sensitive data sanitization handles malformed objects gracefully

### Serialization Errors

- JSON serialization failures are handled with fallbacks
- Circular references are prevented through object copying
- Large payloads are truncated if necessary

## Security Considerations

1. **Data Sanitization** - Sensitive fields are automatically redacted
2. **Payload Size Limits** - Large payloads are truncated to prevent memory issues
3. **Immutable Storage** - Captured data cannot be modified after creation
4. **No User Input** - All data comes from internal system components

## Dependencies

### Internal Dependencies

- `src/utils/dependencyUtils.js` - `validateDependency` function
- `src/utils/validationCore.js` - `string` validation utilities
- `src/utils/loggerUtils.js` - `ensureValidLogger` function
- `src/errors/invalidArgumentError.js` - `InvalidArgumentError` class
- Logger interface for debugging and error reporting
- Turn action structure from game engine
- Existing `EnhancedActionTraceFilter` for filtering decisions

### External Dependencies

- None (pure JavaScript implementation)

## Risks and Mitigation

| Risk                                  | Probability | Impact | Mitigation                                        |
| ------------------------------------- | ----------- | ------ | ------------------------------------------------- |
| Memory usage from large payloads      | Medium      | Medium | Payload size limits and sanitization              |
| Performance impact from timing        | Low         | Low    | Conditional creation and efficient implementation |
| Sensitive data leakage                | Low         | High   | Comprehensive sanitization and field redaction    |
| Error in trace creation breaking game | Low         | High   | Comprehensive error handling and validation       |

## Acceptance Criteria

- [ ] ActionExecutionTrace class captures all execution phases
- [ ] Timing measurements are accurate and high-precision
- [ ] Error capture includes comprehensive error information
- [ ] JSON serialization produces well-structured output
- [ ] Payload sanitization removes all sensitive information
- [ ] Memory usage per trace instance remains under 1KB
- [ ] All unit tests pass with >95% coverage
- [ ] Integration tests verify CommandProcessor workflow
- [ ] Performance tests validate efficiency requirements
- [ ] No sensitive data appears in trace output
- [ ] Error handling prevents game execution failures

## Future Enhancements

1. **Compression Support** - Compress large trace data for storage efficiency
2. **Sampling** - Statistical sampling for high-frequency actions
3. **Real-time Streaming** - Stream trace data to external monitoring
4. **Custom Metadata** - Allow custom metadata injection
5. **Trace Correlation** - Link related action executions

## Documentation Requirements

1. **API Documentation** - Complete JSDoc for all methods
2. **Usage Guide** - How to create and analyze traces
3. **Integration Guide** - How to integrate with other components
4. **Security Guide** - Data handling and sanitization policies

## Definition of Done

- [ ] ActionExecutionTrace class implemented according to specification
- [ ] ActionExecutionTraceFactory created with validation
- [ ] Type definitions and constants defined
- [ ] Unit tests written and passing (>95% coverage)
- [ ] Integration tests verify CommandProcessor workflow
- [ ] Performance tests validate efficiency
- [ ] Security review passed (no sensitive data leakage)
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] No memory leaks in trace creation/disposal
