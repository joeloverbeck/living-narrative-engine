# ACTTRA-034: Create Integration Tests for Execution Tracing

## Summary

Create comprehensive integration tests to validate action tracing through the CommandProcessor execution path, ensuring correct timing capture, event dispatch tracking, and integration with the EventDispatchService.

## Parent Issue

- **Phase**: Phase 5 - Testing & Documentation
- **Specification**: [Action Tracing System Implementation Specification](../specs/action-tracing-implementation.spec.md)
- **Overview**: [ACTTRA-000](./ACTTRA-000-implementation-overview.md)

## Description

This ticket focuses on creating integration tests that validate the action tracing system's behavior during action execution through the CommandProcessor. The tests must verify that execution timing is captured accurately, event payloads are traced, dispatch results are recorded, and error scenarios are handled gracefully with proper trace output.

## Acceptance Criteria

- [ ] Integration test file created at `tests/integration/actions/tracing/actionExecutionTrace.integration.test.js`
- [ ] Tests cover complete execution path through CommandProcessor
- [ ] Tests validate ActionExecutionTrace data capture
- [ ] Tests verify integration with EventDispatchService
- [ ] Tests confirm timing accuracy and performance metrics
- [ ] Tests validate error capture with stack traces
- [ ] Tests confirm trace output to files
- [ ] All tests pass in CI/CD pipeline
- [ ] Concurrent execution scenarios tested

## Technical Requirements

### Test File Structure

```javascript
// tests/integration/actions/tracing/actionExecutionTrace.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CommandProcessorTracingTestBed from '../../../common/commands/commandProcessorTracingTestBed.js';
import fs from 'fs/promises';
import path from 'path';

describe('Action Tracing - Execution Integration', () => {
  let testBed;
  const testOutputDir = './test-execution-traces';

  beforeEach(async () => {
    testBed = new CommandProcessorTracingTestBed();
    await testBed.initialize();

    // Ensure test output directory exists
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    await testBed.cleanup();

    // Clean up test traces
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (err) {
      // Directory might not exist
    }
  });

  // Test suites...
});
```

### Test Scenarios

#### 1. End-to-End Execution Tracing

```javascript
describe('End-to-End Execution Tracing', () => {
  it('should trace action execution through CommandProcessor', async () => {
    // Configure tracing for specific action
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      outputDirectory: testOutputDir,
      verbosity: 'detailed',
    });

    // Create test actor
    const actor = testBed.createActor('player-1', {
      components: ['core:position', 'core:movement'],
    });

    // Create turn action
    const turnAction = testBed.createTurnAction('core:go', {
      commandString: 'go north',
      parameters: { direction: 'north' },
    });

    // Execute action with tracing
    const startTime = performance.now();
    const result = await testBed.dispatchAction(actor, turnAction);
    const executionTime = performance.now() - startTime;

    // Verify execution succeeded
    expect(result.success).toBe(true);
    expect(result.actionResult.actionId).toBe('core:go');

    // Wait for async trace writing
    await testBed.waitForTraceOutput();

    // Verify trace file was created
    const traceFiles = await fs.readdir(testOutputDir);
    const traceFile = traceFiles.find((f) => f.includes('core-go'));
    expect(traceFile).toBeDefined();

    // Verify trace content
    const traceContent = await fs.readFile(
      path.join(testOutputDir, traceFile),
      'utf-8'
    );
    const trace = JSON.parse(traceContent);

    expect(trace.actionId).toBe('core:go');
    expect(trace.actorId).toBe('player-1');
    expect(trace.turnAction).toEqual(turnAction);
    expect(trace.execution).toBeDefined();
    expect(trace.execution.startTime).toBeGreaterThan(0);
    expect(trace.execution.endTime).toBeGreaterThan(trace.execution.startTime);
    expect(trace.execution.duration).toBeGreaterThan(0);
    expect(trace.execution.duration).toBeLessThan(executionTime + 10); // Allow some margin
  });

  it('should handle multiple concurrent executions', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go', 'core:take', 'core:use'],
      outputDirectory: testOutputDir,
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:position', 'core:movement', 'core:inventory'],
    });

    // Create multiple turn actions
    const actions = [
      testBed.createTurnAction('core:go', { commandString: 'go north' }),
      testBed.createTurnAction('core:take', { commandString: 'take sword' }),
      testBed.createTurnAction('core:use', { commandString: 'use potion' }),
    ];

    // Execute actions concurrently
    const promises = actions.map((action) =>
      testBed.dispatchAction(actor, action)
    );

    const results = await Promise.all(promises);

    // Verify all executions succeeded
    results.forEach((result, index) => {
      expect(result.success).toBe(true);
      expect(result.actionResult.actionId).toBe(
        actions[index].actionDefinitionId
      );
    });

    // Wait for all traces to be written
    await testBed.waitForTraceOutput(500);

    // Verify trace files were created
    const traceFiles = await fs.readdir(testOutputDir);
    expect(traceFiles.length).toBeGreaterThanOrEqual(3);

    // Verify each action has a trace
    expect(traceFiles.some((f) => f.includes('core-go'))).toBe(true);
    expect(traceFiles.some((f) => f.includes('core-take'))).toBe(true);
    expect(traceFiles.some((f) => f.includes('core-use'))).toBe(true);
  });
});
```

#### 2. Timing and Performance Tracking

```javascript
describe('Timing and Performance Tracking', () => {
  it('should capture accurate execution timing', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:go', {
      commandString: 'go north',
    });

    // Add artificial delay to test timing accuracy
    testBed.addExecutionDelay(50); // 50ms delay

    const startTime = Date.now();
    const result = await testBed.dispatchAction(actor, turnAction);
    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    await testBed.waitForTraceOutput();

    const trace = await testBed.getLatestTrace('core:go');

    expect(trace.execution.startTime).toBeGreaterThanOrEqual(startTime);
    expect(trace.execution.endTime).toBeLessThanOrEqual(endTime);
    expect(trace.execution.duration).toBeCloseTo(actualDuration, -1); // Within 10ms
    expect(trace.execution.duration).toBeGreaterThan(45); // At least the delay
  });

  it('should measure dispatch overhead', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:go', {
      commandString: 'go north',
    });

    // Measure execution without tracing
    await testBed.configureTracing({ enabled: false });
    const startWithoutTracing = performance.now();
    await testBed.dispatchAction(actor, turnAction);
    const durationWithoutTracing = performance.now() - startWithoutTracing;

    // Measure execution with tracing
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
    });

    const startWithTracing = performance.now();
    await testBed.dispatchAction(actor, turnAction);
    const durationWithTracing = performance.now() - startWithTracing;

    // Tracing overhead should be minimal
    const overhead = durationWithTracing - durationWithoutTracing;
    expect(overhead).toBeLessThan(5); // < 5ms overhead
  });
});
```

#### 3. Event Payload Capture

```javascript
describe('Event Payload Capture', () => {
  it('should capture complete event payload', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:take'],
      verbosity: 'verbose',
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:inventory'],
    });

    const turnAction = testBed.createTurnAction('core:take', {
      commandString: 'take sword',
      parameters: { target: 'sword' },
      actionDefinitionId: 'core:take',
    });

    const result = await testBed.dispatchAction(actor, turnAction);
    await testBed.waitForTraceOutput();

    const trace = await testBed.getLatestTrace('core:take');

    expect(trace.execution.eventPayload).toBeDefined();
    expect(trace.execution.eventPayload.actor).toBe('player-1');
    expect(trace.execution.eventPayload.action).toBeDefined();
    expect(trace.execution.eventPayload.action.commandString).toBe(
      'take sword'
    );
    expect(trace.execution.eventPayload.timestamp).toBeGreaterThan(0);
  });

  it('should handle large payloads efficiently', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:complex_action'],
      verbosity: 'detailed',
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:inventory', 'core:stats'],
      data: {
        inventory: testBed.createLargeInventory(100), // 100 items
        stats: testBed.createComplexStats(),
      },
    });

    const turnAction = testBed.createTurnAction('core:complex_action', {
      commandString: 'perform complex action',
      parameters: testBed.createComplexParameters(),
    });

    const startTime = performance.now();
    const result = await testBed.dispatchAction(actor, turnAction);
    const duration = performance.now() - startTime;

    await testBed.waitForTraceOutput();

    const trace = await testBed.getLatestTrace('core:complex_action');

    expect(trace.execution.eventPayload).toBeDefined();
    expect(duration).toBeLessThan(100); // Should handle large payloads quickly

    // Verify payload contains expected data
    expect(trace.execution.eventPayload.actor).toBe('player-1');
    expect(trace.execution.eventPayload.action.parameters).toBeDefined();
  });
});
```

#### 4. Error Handling and Recovery

```javascript
describe('Error Handling and Recovery', () => {
  it('should capture execution errors with stack traces', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:failing_action'],
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:failing_action', {
      commandString: 'trigger error',
    });

    // Configure action to throw error
    testBed.configureActionToFail(
      'core:failing_action',
      new Error('Test error')
    );

    const result = await testBed.dispatchAction(actor, turnAction);

    // Execution should fail gracefully
    expect(result.success).toBe(false);

    await testBed.waitForTraceOutput();

    const trace = await testBed.getLatestTrace('core:failing_action');

    expect(trace.execution.error).toBeDefined();
    expect(trace.execution.error.message).toBe('Test error');
    expect(trace.execution.error.type).toBe('Error');
    expect(trace.execution.error.stack).toBeDefined();
    expect(trace.execution.endTime).toBeGreaterThan(trace.execution.startTime);
  });

  it('should handle EventDispatchService failures', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:go', {
      commandString: 'go north',
    });

    // Configure EventDispatchService to fail
    testBed.configureEventDispatchToFail(new Error('Event dispatch failed'));

    const result = await testBed.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);

    await testBed.waitForTraceOutput();

    const trace = await testBed.getLatestTrace('core:go');

    expect(trace.execution.result).toBeDefined();
    expect(trace.execution.result.success).toBe(false);
    expect(trace.execution.error).toBeDefined();
  });

  it('should handle trace output failures gracefully', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      outputDirectory: '/invalid/path', // Cause output failure
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:go', {
      commandString: 'go north',
    });

    // Should not throw error even if trace output fails
    const result = await testBed.dispatchAction(actor, turnAction);

    expect(result.success).toBe(true); // Action should still succeed

    // Verify error was logged
    expect(testBed.getLoggedErrors()).toContain(
      expect.stringContaining('Failed to write trace')
    );
  });
});
```

#### 5. EventDispatchService Integration

```javascript
describe('EventDispatchService Integration', () => {
  it('should trace event dispatch success', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:go', {
      commandString: 'go north',
    });

    const result = await testBed.dispatchAction(actor, turnAction);
    await testBed.waitForTraceOutput();

    const trace = await testBed.getLatestTrace('core:go');

    expect(trace.execution.result).toBeDefined();
    expect(trace.execution.result.success).toBe(true);
    expect(trace.execution.result.timestamp).toBeGreaterThan(0);
  });

  it('should capture dispatch timing separately', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      verbosity: 'detailed',
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:go', {
      commandString: 'go north',
    });

    const result = await testBed.dispatchAction(actor, turnAction);
    await testBed.waitForTraceOutput();

    const trace = await testBed.getLatestTrace('core:go');

    expect(trace.execution.duration).toBeGreaterThan(0);
    expect(trace.execution.result.timestamp).toBeBetween(
      trace.execution.startTime,
      trace.execution.endTime
    );
  });

  it('should handle event dispatch timeout', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:slow_action'],
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:slow_action', {
      commandString: 'perform slow action',
    });

    // Configure action to timeout
    testBed.configureActionTimeout('core:slow_action', 5000); // 5 second timeout
    testBed.configureEventDispatchDelay(6000); // 6 second delay

    const result = await testBed.dispatchAction(actor, turnAction);
    await testBed.waitForTraceOutput();

    const trace = await testBed.getLatestTrace('core:slow_action');

    expect(trace.execution.duration).toBeGreaterThan(5000);
    expect(trace.execution.error).toBeDefined();
    expect(trace.execution.error.message).toContain('timeout');
  });
});
```

#### 6. Output Format Validation

```javascript
describe('Output Format Validation', () => {
  it('should write both JSON and text formats', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      verbosity: 'standard',
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:go', {
      commandString: 'go north',
    });

    await testBed.dispatchAction(actor, turnAction);
    await testBed.waitForTraceOutput();

    const traceFiles = await fs.readdir(testOutputDir);
    const jsonFile = traceFiles.find(
      (f) => f.includes('core-go') && f.endsWith('.json')
    );
    const textFile = traceFiles.find(
      (f) => f.includes('core-go') && f.endsWith('.txt')
    );

    expect(jsonFile).toBeDefined();
    expect(textFile).toBeDefined();

    // Validate JSON format
    const jsonContent = await fs.readFile(
      path.join(testOutputDir, jsonFile),
      'utf-8'
    );
    const trace = JSON.parse(jsonContent);
    expect(trace.actionId).toBe('core:go');

    // Validate text format
    const textContent = await fs.readFile(
      path.join(testOutputDir, textFile),
      'utf-8'
    );
    expect(textContent).toContain('ACTION TRACE REPORT');
    expect(textContent).toContain('Action: core:go');
  });

  it('should respect verbosity settings in output', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      verbosity: 'minimal',
    });

    const actor = testBed.createActor('player-1');
    const turnAction = testBed.createTurnAction('core:go');

    await testBed.dispatchAction(actor, turnAction);
    await testBed.waitForTraceOutput();

    const traceFiles = await fs.readdir(testOutputDir);
    const jsonFile = traceFiles.find(
      (f) => f.includes('core-go') && f.endsWith('.json')
    );

    expect(jsonFile).toBeDefined();
    // Should not create text file for minimal verbosity
    const textFile = traceFiles.find(
      (f) => f.includes('core-go') && f.endsWith('.txt')
    );
    expect(textFile).toBeUndefined();
  });
});
```

### Test Bed Requirements

The `tests/common/commands/commandProcessorTracingTestBed.js` file has been created as a reusable test bed extracted from the existing integration test:

```javascript
// tests/common/commands/commandProcessorTracingTestBed.js
// Note: This test bed has been extracted and created as a reusable component

import CommandProcessor from '../../../src/commands/commandProcessor.js';
import ActionTraceFilter from '../../../src/actions/tracing/actionTraceFilter.js';
import { ActionExecutionTraceFactory } from '../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { ActionTraceOutputService } from '../../../src/actions/tracing/actionTraceOutputService.js';
import {
  createMockEventDispatchService,
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../mockFactories/index.js';

class CommandProcessorTracingTestBed {
  constructor() {
    this.logger = createMockLogger();
    this.safeEventDispatcher = createMockSafeEventDispatcher();
    this.eventDispatchService = createMockEventDispatchService();
    
    // Real tracing components
    this.actionTraceFilter = null;
    this.actionExecutionTraceFactory = null;
    this.actionTraceOutputService = null;
    
    // Track written traces
    this.writtenTraces = [];
    
    this.commandProcessor = null;
  }

  // Key methods provided by the test bed:
  configureTracing(tracedActions = ['*']) {
    // Configures action tracing filter and components
  }

  disableTracing() {
    // Disables tracing for performance comparisons
  }

  createActor(id) {
    // Creates a test actor with basic structure
  }

  createTurnAction(actionId, commandString, parameters = {}) {
    // Creates a turn action for testing
  }

  async getWrittenTraces() {
    // Returns traces written during test execution
  }

  getRawTraces() {
    // Returns raw trace objects for detailed validation
  }

  clearTraces() {
    // Clears accumulated traces between tests
  }

  cleanup() {
    // Cleans up test bed resources
  }
}

export default CommandProcessorTracingTestBed;
```

## Implementation Steps

1. **Create Test Bed** (60 minutes)
   - Setup CommandProcessor integration test container
   - Implement service mocking and configuration
   - Create helper methods for test scenarios

2. **Implement Basic Execution Tests** (45 minutes)
   - End-to-end execution tracing
   - Concurrent execution handling
   - Basic timing validation

3. **Implement Timing and Performance Tests** (30 minutes)
   - Accurate timing capture tests
   - Overhead measurement tests
   - Performance validation

4. **Implement Payload and Event Tests** (45 minutes)
   - Event payload capture validation
   - EventDispatchService integration
   - Large payload handling

5. **Implement Error Handling Tests** (45 minutes)
   - Error capture and stack trace tests
   - EventDispatchService failure handling
   - Trace output failure recovery

6. **Implement Format Validation Tests** (15 minutes)
   - JSON and text output validation
   - Verbosity level compliance

## Dependencies

### Depends On

- ACTTRA-019: Create ActionExecutionTrace class
- ACTTRA-020: Enhance CommandProcessor with tracing
- ACTTRA-023: Integrate with EventDispatchService

### Blocks

- End-to-end system testing
- Performance optimization work

## Estimated Effort

- **Estimated Hours**: 3 hours
- **Complexity**: Medium
- **Risk**: Medium (due to timing sensitivity and async complexity)

## Success Metrics

- [ ] All integration tests pass consistently
- [ ] Timing accuracy within 10ms tolerance
- [ ] Error scenarios handled gracefully
- [ ] Concurrent execution support validated
- [ ] Performance overhead < 5ms per traced action
- [ ] No race conditions in async operations

## Notes

- Pay special attention to timing accuracy in tests
- Use real-world delays to test timing capture
- Mock external dependencies but use real internal services
- Test both success and failure paths thoroughly
- Validate memory management with large payloads
- Consider adding stress tests for high-frequency execution

### Test Runner Commands

- **Unit Tests**: `npm run test:unit` - Tests in `tests/unit/` with `.test.js` extension
- **Integration Tests**: `npm run test:integration` - Tests in `tests/integration/` with `.integration.test.js` extension
- **Performance Tests**: `npm run test:performance` - Tests in `tests/performance/` with `.performance.test.js` extension
- **Memory Tests**: `npm run test:memory` - Tests in `tests/memory/` with `.memory.test.js` extension

If performance-specific tests are needed, create them at:
- `tests/performance/actions/tracing/actionExecutionTrace.performance.test.js`
- `tests/memory/actions/tracing/actionExecutionTrace.memory.test.js`

## Related Files

- Source: `src/commands/commandProcessor.js`
- Test: `tests/integration/actions/tracing/actionExecutionTrace.integration.test.js`
- Test Bed: `tests/common/commands/commandProcessorTracingTestBed.js` (created and ready for use)
- Similar Tests: `tests/integration/commands/commandProcessorTracing.integration.test.js`

---

**Ticket Status**: Ready for Development
**Priority**: High (Phase 5 - Testing)
**Labels**: testing, integration-test, action-tracing, phase-5, execution, command-processor
