# GOAPIMPL-025-05: Refinement Tracer Tool

**Parent Ticket**: GOAPIMPL-025 (GOAP Debugging Tools)
**Priority**: MEDIUM
**Estimated Effort**: 1.5 hours
**Dependencies**: GOAPIMPL-025-02 (Refinement Step Events)

## Description

Create a refinement tracer that captures and formats step-by-step execution during task refinement. The tool listens to refinement events from the event bus and provides detailed traces of method execution, state updates, and action generation.

**Reference**:
- Parent ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md` (Issue #7)
- Spec: `specs/goap-system-specs.md` lines 507-516

## Acceptance Criteria

- [ ] Captures refinement events for specific actors
- [ ] Shows step-by-step execution timeline
- [ ] Displays state updates during refinement
- [ ] Formats traces in readable text
- [ ] Supports start/stop capture for specific actors
- [ ] Returns JSON format for tooling
- [ ] Unit tests validate event capture
- [ ] Integration tests with RefinementEngine

## Current State Analysis

### Event System (from GOAPIMPL-025-02)

New step-level events:
```javascript
GOAP_EVENTS.REFINEMENT_STEP_STARTED
GOAP_EVENTS.REFINEMENT_STEP_COMPLETED
GOAP_EVENTS.REFINEMENT_STEP_FAILED
GOAP_EVENTS.REFINEMENT_STATE_UPDATED
```

Existing task-level events:
```javascript
GOAP_EVENTS.TASK_REFINED
GOAP_EVENTS.REFINEMENT_FAILED
```

### Event Flow

```
1. TASK_REFINED (method selected)
2. REFINEMENT_STEP_STARTED (step 0)
3. REFINEMENT_STATE_UPDATED (picked item)
4. REFINEMENT_STEP_COMPLETED (step 0, action generated)
5. REFINEMENT_STEP_STARTED (step 1)
6. REFINEMENT_STEP_COMPLETED (step 1, action generated)
```

### Refinement Context

From RefinementEngine:
```javascript
{
  actorId: 'actor-123',
  taskId: 'consume_nourishing_item',
  methodId: 'eating_nearby_food',
  params: { item: 'food-1' }
}
```

## Implementation Details

### File to Create

`src/goap/debug/refinementTracer.js`

```javascript
/**
 * @file Refinement tracer for step-by-step execution capture
 */

import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { GOAP_EVENTS } from '../events/goapEvents.js';

/**
 * Captures and formats refinement execution traces via events.
 */
class RefinementTracer {
  #eventBus;
  #dataRegistry;
  #logger;
  #activeTraces;  // Map<actorId, TraceData>

  /**
   * @param {object} deps
   * @param {object} deps.eventBus - Event bus for listening
   * @param {object} deps.dataRegistry - Access to task/method definitions
   * @param {object} deps.logger - Logger instance
   */
  constructor({ eventBus, dataRegistry, logger }) {
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['on', 'off', 'dispatch'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getTask', 'getRefinementMethod'],
    });
    
    this.#eventBus = eventBus;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#activeTraces = new Map();
  }

  /**
   * Start capturing refinement trace for an actor.
   * @param {string} actorId - Actor entity ID
   */
  startCapture(actorId) {
    assertNonBlankString(actorId, 'actorId', 'RefinementTracer.startCapture', this.#logger);
    
    if (this.#activeTraces.has(actorId)) {
      this.#logger.warn(`Trace already active for actor ${actorId}`);
      return;
    }
    
    const trace = {
      actorId,
      events: [],
      startTime: Date.now(),
      active: true,
    };
    
    this.#activeTraces.set(actorId, trace);
    
    // Register event listeners
    this.#registerListeners(actorId);
    
    this.#logger.info(`Started refinement trace capture for ${actorId}`);
  }

  /**
   * Stop capturing and return trace for an actor.
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Trace data or null if not active
   */
  stopCapture(actorId) {
    assertNonBlankString(actorId, 'actorId', 'RefinementTracer.stopCapture', this.#logger);
    
    const trace = this.#activeTraces.get(actorId);
    
    if (!trace) {
      this.#logger.warn(`No active trace for actor ${actorId}`);
      return null;
    }
    
    // Unregister event listeners
    this.#unregisterListeners(actorId);
    
    trace.active = false;
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    
    this.#activeTraces.delete(actorId);
    
    this.#logger.info(`Stopped refinement trace capture for ${actorId}`);
    
    return trace;
  }

  /**
   * Get current trace without stopping capture.
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Current trace or null
   */
  getTrace(actorId) {
    assertNonBlankString(actorId, 'actorId', 'RefinementTracer.getTrace', this.#logger);
    
    const trace = this.#activeTraces.get(actorId);
    return trace ? { ...trace } : null;
  }

  /**
   * Format trace as readable text.
   * @param {object} trace - Trace data from stopCapture()
   * @returns {string} Formatted trace text
   */
  format(trace) {
    if (!trace) {
      return '=== No Trace Data ===\n';
    }
    
    let output = '';
    output += `=== Refinement Trace: ${trace.actorId} ===\n`;
    output += `Capture Duration: ${trace.duration || 'ongoing'} ms\n`;
    output += `Events Captured: ${trace.events.length}\n`;
    output += `\n`;
    
    if (trace.events.length === 0) {
      output += `No refinement events captured.\n`;
    } else {
      output += `Events:\n`;
      for (const event of trace.events) {
        output += this.#formatEvent(event);
      }
      
      // Summary
      const taskRefined = trace.events.filter(e => e.type === GOAP_EVENTS.TASK_REFINED);
      const stepsStarted = trace.events.filter(e => e.type === GOAP_EVENTS.REFINEMENT_STEP_STARTED);
      const stepsCompleted = trace.events.filter(e => e.type === GOAP_EVENTS.REFINEMENT_STEP_COMPLETED);
      const stepsFailed = trace.events.filter(e => e.type === GOAP_EVENTS.REFINEMENT_STEP_FAILED);
      
      output += `\nSummary:\n`;
      output += `  Tasks Refined: ${taskRefined.length}\n`;
      output += `  Steps Executed: ${stepsStarted.length}\n`;
      output += `  Steps Succeeded: ${stepsCompleted.length}\n`;
      output += `  Steps Failed: ${stepsFailed.length}\n`;
    }
    
    output += `\n=== End Trace ===\n`;
    
    return output;
  }

  /**
   * Format a single event for display.
   * @param {object} event - Event from trace
   * @returns {string} Formatted event line
   * @private
   */
  #formatEvent(event) {
    const timestamp = new Date(event.payload.timestamp).toISOString();
    const type = event.type.replace('GOAP:', '');
    
    let line = `[${timestamp}] ${type}`;
    
    switch (event.type) {
      case GOAP_EVENTS.TASK_REFINED:
        line += `: taskId=${event.payload.taskId}, stepsGenerated=${event.payload.actionsGenerated?.length || 0}\n`;
        break;
        
      case GOAP_EVENTS.REFINEMENT_STEP_STARTED:
        line += `: step=${event.payload.stepIndex}, type=${event.payload.step?.type}\n`;
        break;
        
      case GOAP_EVENTS.REFINEMENT_STEP_COMPLETED:
        line += `: step=${event.payload.stepIndex}, success=${event.payload.result?.success}, duration=${event.payload.duration}ms\n`;
        break;
        
      case GOAP_EVENTS.REFINEMENT_STEP_FAILED:
        line += `: step=${event.payload.stepIndex}, error="${event.payload.error}"\n`;
        break;
        
      case GOAP_EVENTS.REFINEMENT_STATE_UPDATED:
        line += `: ${event.payload.key} = ${JSON.stringify(event.payload.newValue)}\n`;
        break;
        
      case GOAP_EVENTS.REFINEMENT_FAILED:
        line += `: taskId=${event.payload.taskId}, reason="${event.payload.reason}"\n`;
        break;
        
      default:
        line += `: ${JSON.stringify(event.payload)}\n`;
    }
    
    return line;
  }

  /**
   * Register event listeners for an actor.
   * @param {string} actorId - Actor entity ID
   * @private
   */
  #registerListeners(actorId) {
    const handler = (event) => {
      const trace = this.#activeTraces.get(actorId);
      
      if (!trace || !trace.active) {
        return;
      }
      
      // Only capture events for this actor
      if (event.payload.actorId === actorId) {
        trace.events.push({
          type: event.type,
          payload: { ...event.payload },
          timestamp: Date.now(),
        });
      }
    };
    
    // Store handler for cleanup
    if (!this.#activeTraces.has(actorId)) {
      return;
    }
    
    this.#activeTraces.get(actorId).handler = handler;
    
    // Listen to all refinement events
    this.#eventBus.on(GOAP_EVENTS.TASK_REFINED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_FAILED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_STEP_STARTED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_STEP_FAILED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_STATE_UPDATED, handler);
  }

  /**
   * Unregister event listeners for an actor.
   * @param {string} actorId - Actor entity ID
   * @private
   */
  #unregisterListeners(actorId) {
    const trace = this.#activeTraces.get(actorId);
    
    if (!trace || !trace.handler) {
      return;
    }
    
    const handler = trace.handler;
    
    // Remove all listeners
    this.#eventBus.off(GOAP_EVENTS.TASK_REFINED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_FAILED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_STEP_STARTED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_STEP_FAILED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_STATE_UPDATED, handler);
  }
}

export default RefinementTracer;
```

## Testing Requirements

### Unit Tests

Create: `tests/unit/goap/debug/refinementTracer.test.js`

**Test Cases**:

1. **Start/Stop Capture**:
   - Starts capturing for actor
   - Stops capturing and returns trace
   - Warns when starting duplicate capture
   - Returns null when stopping non-existent trace

2. **Event Capture**:
   - Captures events for correct actor only
   - Ignores events for other actors
   - Records events in order
   - Includes event payload and timestamp

3. **Event Filtering**:
   - Captures TASK_REFINED events
   - Captures REFINEMENT_STEP_* events
   - Captures REFINEMENT_STATE_UPDATED events
   - Ignores non-refinement events

4. **Formatting**:
   - Formats trace with summary
   - Shows event timeline
   - Displays step successes/failures
   - Handles empty trace

**Test Structure**:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import RefinementTracer from '../../../../src/goap/debug/refinementTracer.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

describe('RefinementTracer', () => {
  let testBed;
  let tracer;
  let mockEventBus;
  let mockDataRegistry;

  beforeEach(() => {
    testBed = createTestBed();
    
    mockEventBus = testBed.createEventBus();
    mockDataRegistry = testBed.createMock('IDataRegistry', [
      'getTask',
      'getRefinementMethod',
    ]);
    
    tracer = new RefinementTracer({
      eventBus: mockEventBus,
      dataRegistry: mockDataRegistry,
      logger: testBed.createMockLogger(),
    });
  });

  describe('startCapture', () => {
    it('should start capturing events for actor', () => {
      tracer.startCapture('actor-1');
      
      const trace = tracer.getTrace('actor-1');
      
      expect(trace).not.toBeNull();
      expect(trace.actorId).toBe('actor-1');
      expect(trace.active).toBe(true);
    });

    it('should warn when starting duplicate capture', () => {
      const logger = testBed.createMockLogger();
      tracer = new RefinementTracer({
        eventBus: mockEventBus,
        dataRegistry: mockDataRegistry,
        logger,
      });
      
      tracer.startCapture('actor-1');
      tracer.startCapture('actor-1');
      
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('event capture', () => {
    it('should capture events for correct actor only', () => {
      tracer.startCapture('actor-1');
      
      // Dispatch event for actor-1
      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-1',
          taskId: 'consume_food',
          actionsGenerated: [],
          timestamp: Date.now(),
        },
      });
      
      // Dispatch event for actor-2 (should be ignored)
      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-2',
          taskId: 'gather_resources',
          actionsGenerated: [],
          timestamp: Date.now(),
        },
      });
      
      const trace = tracer.stopCapture('actor-1');
      
      expect(trace.events).toHaveLength(1);
      expect(trace.events[0].payload.actorId).toBe('actor-1');
    });
  });

  describe('format', () => {
    it('should format trace with summary', () => {
      tracer.startCapture('actor-1');
      
      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_STARTED,
        payload: {
          actorId: 'actor-1',
          taskId: 'consume_food',
          stepIndex: 0,
          step: { type: 'primitive_action' },
          timestamp: Date.now(),
        },
      });
      
      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_COMPLETED,
        payload: {
          actorId: 'actor-1',
          taskId: 'consume_food',
          stepIndex: 0,
          result: { success: true },
          duration: 10,
          timestamp: Date.now(),
        },
      });
      
      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);
      
      expect(output).toContain('Refinement Trace');
      expect(output).toContain('REFINEMENT_STEP_STARTED');
      expect(output).toContain('REFINEMENT_STEP_COMPLETED');
      expect(output).toContain('Steps Executed: 1');
      expect(output).toContain('Steps Succeeded: 1');
    });
  });
});
```

### Integration Tests

Create: `tests/integration/goap/debug/refinementTracerIntegration.test.js`

Test with actual RefinementEngine:

```javascript
it('should capture full refinement trace', async () => {
  tracer.startCapture('actor-1');
  
  // Execute refinement (dispatches events)
  await goapController.decideTurn(actor, world);
  
  const trace = tracer.stopCapture('actor-1');
  
  expect(trace.events.length).toBeGreaterThan(0);
  
  const output = tracer.format(trace);
  console.log(output);
  
  expect(output).toContain('TASK_REFINED');
  expect(output).toContain('REFINEMENT_STEP');
});
```

## Manual Testing

1. **Console Usage**:
   ```javascript
   const debugger = container.resolve(tokens.IGOAPDebugger);
   
   debugger.startTrace('actor-123');
   
   // Execute turn
   await goapController.decideTurn(actor, world);
   
   const trace = debugger.getTrace('actor-123');
   console.log(trace);
   
   debugger.stopTrace('actor-123');
   ```

2. **Expected Output**:
   ```
   === Refinement Trace: actor-123 ===
   Capture Duration: 250 ms
   Events Captured: 8

   Events:
   [2025-11-16T12:34:56.100Z] TASK_REFINED: taskId=consume_nourishing_item, stepsGenerated=2
   [2025-11-16T12:34:56.102Z] REFINEMENT_STEP_STARTED: step=0, type=primitive_action
   [2025-11-16T12:34:56.105Z] REFINEMENT_STATE_UPDATED: pickedItem = "food-1"
   [2025-11-16T12:34:56.110Z] REFINEMENT_STEP_COMPLETED: step=0, success=true, duration=8ms
   [2025-11-16T12:34:56.112Z] REFINEMENT_STEP_STARTED: step=1, type=primitive_action
   [2025-11-16T12:34:56.120Z] REFINEMENT_STEP_COMPLETED: step=1, success=true, duration=8ms

   Summary:
     Tasks Refined: 1
     Steps Executed: 2
     Steps Succeeded: 2
     Steps Failed: 0

   === End Trace ===
   ```

## Success Validation

✅ **Done when**:
- RefinementTracer class implemented
- Event capture for specific actors working
- Start/stop capture functional
- Text formatting implemented
- Event filtering correct (actor-specific)
- Unit tests pass with coverage
- Integration tests with RefinementEngine pass
- No TypeScript errors
- No ESLint errors

## References

- Parent: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Events: `tickets/GOAPIMPL-025-02-refinement-step-events.md`
- Event definitions: `src/goap/events/goapEvents.js`
- Engine: `src/goap/refinement/refinementEngine.js`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md`
