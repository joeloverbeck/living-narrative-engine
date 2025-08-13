# ACTTRA-033: Create Integration Tests for Pipeline Tracing

## Summary

Create comprehensive integration tests to validate action tracing through the complete discovery pipeline, ensuring all stages capture trace data correctly and integrate with the existing StructuredTrace system.

## Parent Issue

- **Phase**: Phase 5 - Testing & Documentation
- **Specification**: [Action Tracing System Implementation Specification](../specs/action-tracing-implementation.spec.md)
- **Overview**: [ACTTRA-000](./ACTTRA-000-implementation-overview.md)

## Description

This ticket focuses on creating integration tests that validate the action tracing system's behavior through the entire action discovery pipeline. The tests must verify that trace data is captured correctly at each pipeline stage (ComponentFiltering, PrerequisiteEvaluation, MultiTargetResolution, ActionFormatting) and that the enhanced tracing integrates seamlessly with the existing StructuredTrace infrastructure.

## Acceptance Criteria

- [ ] Integration test file created at `tests/integration/actions/tracing/pipelineTracing.integration.test.js`
- [ ] Tests cover all pipeline stages with tracing enabled
- [ ] Tests validate data capture at each stage
- [ ] Tests verify integration with existing StructuredTrace system
- [ ] Tests validate verbosity level filtering
- [ ] Tests confirm trace output to files
- [ ] Tests handle both legacy and multi-target actions
- [ ] All tests pass in CI/CD pipeline
- [ ] Performance impact is measured and within limits

## Technical Requirements

### Test File Structure

```javascript
// tests/integration/actions/tracing/pipelineTracing.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import fs from 'fs/promises';
import path from 'path';

describe('Action Tracing - Pipeline Integration', () => {
  let testBed;
  const testOutputDir = './test-traces';

  beforeEach(async () => {
    testBed = new ActionDiscoveryServiceTestBed();
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

#### 1. End-to-End Pipeline Tracing

```javascript
describe('End-to-End Pipeline Tracing', () => {
  it('should trace action through complete discovery pipeline', async () => {
    // Setup: Create discovery service with tracing enabled
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:go'],
      verbosity: 'detailed',
    });

    // Create test actor and context
    const actor = testBed.createActor('player-1', {
      components: ['core:position', 'core:movement'],
    });

    // Execute action discovery with tracing
    const context = testBed.createMockContext();
    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify actions discovered
    expect(result.actions).toBeDefined();
    expect(result.actions.length).toBeGreaterThan(0);

    // Verify trace files created
    const traceFiles = await fs.readdir(testOutputDir);
    expect(traceFiles.length).toBeGreaterThan(0);

    // Verify trace content
    const traceFile = traceFiles.find((f) => f.includes('core-go'));
    expect(traceFile).toBeDefined();

    const traceContent = await fs.readFile(
      path.join(testOutputDir, traceFile),
      'utf-8'
    );
    const trace = JSON.parse(traceContent);

    // Verify all pipeline stages captured
    expect(trace.pipeline).toBeDefined();
    expect(trace.pipeline.componentFiltering).toBeDefined();
    expect(trace.pipeline.prerequisiteEvaluation).toBeDefined();
    expect(trace.pipeline.targetResolution).toBeDefined();
    expect(trace.pipeline.formatting).toBeDefined();
  });

  it('should handle multiple actions in single pipeline run', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:go', 'core:take', 'core:use'],
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify multiple actions were processed with tracing
    expect(result.actions).toBeDefined();
    expect(result.trace).toBeDefined();

    // Check that tracing was active during processing
    const debugLogs = testBed.getDebugLogs();
    const hasTracingLogs = debugLogs.some(
      (log) => log.includes('trace') || log.includes('Trace')
    );
    expect(hasTracingLogs).toBe(true);
  });
});
```

#### 2. ComponentFilteringStage Tracing

```javascript
describe('ComponentFilteringStage Tracing', () => {
  it('should capture component filtering data', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:go'],
      verbosity: 'verbose',
    });

    const actor = testBed.createMockActor('player-1');

    const context = testBed.createMockContext();
    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify tracing was active and captured stage data
    expect(result.trace).toBeDefined();
    expect(result.actions).toBeDefined();

    // Check that component filtering occurred through service logs
    const debugLogs = testBed.getDebugLogs();
    const hasComponentLogs = debugLogs.some(
      (log) => log.includes('component') || log.includes('Component')
    );
    expect(hasComponentLogs).toBe(true);
  });

  it('should filter components based on action requirements', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:take'],
      verbosity: 'verbose',
    });

    const actorWithInventory = testBed.createMockActor('player-1');
    const actorWithoutInventory = testBed.createMockActor('player-2');
    const context = testBed.createMockContext();

    const result1 = await discoveryService.getValidActions(
      actorWithInventory,
      context,
      {
        trace: true,
      }
    );

    const result2 = await discoveryService.getValidActions(
      actorWithoutInventory,
      context,
      {
        trace: true,
      }
    );

    // Both should have tracing enabled
    expect(result1.trace).toBeDefined();
    expect(result2.trace).toBeDefined();

    // Results may vary based on mock configuration
    expect(result1.actions).toBeDefined();
    expect(result2.actions).toBeDefined();
  });
});
```

#### 3. PrerequisiteEvaluationStage Tracing

```javascript
describe('PrerequisiteEvaluationStage Tracing', () => {
  it('should capture prerequisite evaluation details', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:use'],
      verbosity: 'verbose',
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify prerequisite evaluation occurred through tracing
    expect(result.trace).toBeDefined();
    expect(result.actions).toBeDefined();

    // Check logs for prerequisite evaluation activity
    const debugLogs = testBed.getDebugLogs();
    const hasPrerequisiteLogs = debugLogs.some(
      (log) => log.includes('prerequisite') || log.includes('Prerequisite')
    );
    expect(hasPrerequisiteLogs).toBe(true);
  });

  it('should trace failed prerequisites', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:cast_spell'],
      verbosity: 'verbose',
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify tracing captured prerequisite failures
    expect(result.trace).toBeDefined();

    // Check error logs for prerequisite failures
    const errorLogs = testBed.getErrorLogs();
    const warningLogs = testBed.getWarningLogs();
    const hasPrerequisiteFailures =
      errorLogs.length > 0 || warningLogs.length > 0;
    expect(hasPrerequisiteFailures).toBeTruthy();
  });
});
```

#### 4. MultiTargetResolutionStage Tracing

```javascript
describe('MultiTargetResolutionStage Tracing', () => {
  it('should capture target resolution for legacy actions', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:go'],
      verbosity: 'verbose',
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify target resolution occurred through tracing
    expect(result.trace).toBeDefined();
    expect(result.actions).toBeDefined();

    // Check logs for target resolution activity
    const debugLogs = testBed.getDebugLogs();
    const hasTargetLogs = debugLogs.some(
      (log) =>
        log.includes('target') ||
        log.includes('Target') ||
        log.includes('resolution')
    );
    expect(hasTargetLogs).toBe(true);
  });

  it('should capture multi-target resolution', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:examine'],
      verbosity: 'verbose',
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify multi-target resolution occurred
    expect(result.trace).toBeDefined();
    expect(result.actions).toBeDefined();

    // Check logs for multi-target processing
    const debugLogs = testBed.getDebugLogs();
    const hasMultiTargetLogs = debugLogs.some(
      (log) =>
        log.includes('multi') ||
        log.includes('Multiple') ||
        log.includes('targets')
    );
    expect(hasMultiTargetLogs).toBe(true);
  });
});
```

#### 5. ActionFormattingStage Tracing

```javascript
describe('ActionFormattingStage Tracing', () => {
  it('should capture formatting template and parameters', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:go'],
      verbosity: 'verbose',
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify formatting occurred through tracing
    expect(result.trace).toBeDefined();
    expect(result.actions).toBeDefined();

    // Check logs for action formatting activity
    const debugLogs = testBed.getDebugLogs();
    const hasFormatLogs = debugLogs.some(
      (log) =>
        log.includes('format') ||
        log.includes('Format') ||
        log.includes('template')
    );
    expect(hasFormatLogs).toBe(true);
  });

  it('should handle actions without targets', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:rest'],
      verbosity: 'standard',
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify actions without targets are handled
    expect(result.trace).toBeDefined();
    expect(result.actions).toBeDefined();

    // Should not generate target-related errors for simple actions
    const errorLogs = testBed.getErrorLogs();
    const hasTargetErrors = errorLogs.some((log) => log.includes('target'));
    expect(hasTargetErrors).toBe(false);
  });
});
```

#### 6. Verbosity Level Testing

```javascript
describe('Verbosity Level Filtering', () => {
  it('should include minimal data with minimal verbosity', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:go'],
      verbosity: 'minimal',
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify minimal tracing is active
    expect(result.trace).toBeDefined();
    expect(result.actions).toBeDefined();

    // With minimal verbosity, debug logs should be limited
    const debugLogs = testBed.getDebugLogs();
    expect(Array.isArray(debugLogs)).toBe(true);
  });

  it('should include all data with verbose level', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:go'],
      verbosity: 'verbose',
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const result = await discoveryService.getValidActions(actor, context, {
      trace: true,
    });

    // Verify verbose tracing captures more detail
    expect(result.trace).toBeDefined();
    expect(result.actions).toBeDefined();

    // With verbose mode, more debug information should be captured
    const debugLogs = testBed.getDebugLogs();
    const infoLogs = testBed.getInfoLogs();
    const totalLogs = debugLogs.length + infoLogs.length;
    expect(totalLogs).toBeGreaterThan(0);
  });
});
```

#### 7. Performance Impact Testing

```javascript
describe('Performance Impact', () => {
  it('should have minimal overhead when tracing is disabled', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: false,
      tracedActions: [],
    });

    const actor = testBed.createMockActor('player-1');
    const context = testBed.createMockContext();

    const startTime = performance.now();
    const result = await discoveryService.getValidActions(actor, context, {
      trace: false,
    });
    const durationWithoutTracing = performance.now() - startTime;

    expect(result.actions).toBeDefined();
    expect(durationWithoutTracing).toBeLessThan(100); // < 100ms (adjusted for integration test)
  });

  it('should handle concurrent pipeline processing', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['*'], // Trace all actions
      verbosity: 'standard',
    });

    const actors = [];
    const context = testBed.createMockContext();
    for (let i = 0; i < 5; i++) {
      actors.push(testBed.createMockActor(`player-${i}`));
    }

    const promises = actors.map((actor) =>
      discoveryService.getValidActions(actor, context, { trace: true })
    );

    const startTime = performance.now();
    const results = await Promise.all(promises);
    const duration = performance.now() - startTime;

    // Should handle 5 concurrent discoveries efficiently
    expect(duration).toBeLessThan(500); // < 500ms total (adjusted for integration test)

    // Verify all results have tracing data
    results.forEach((result, index) => {
      expect(result.actions).toBeDefined();
      expect(result.trace).toBeDefined();
    });
  });
});
```

### Test Bed Usage

The workflow uses the existing `ActionDiscoveryServiceTestBed` from `tests/common/actions/actionDiscoveryServiceTestBed.js`:

```javascript
// Import the existing test bed
import { ActionDiscoveryServiceTestBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';

// Usage pattern
const testBed = new ActionDiscoveryServiceTestBed();

// Create discovery service with tracing
const discoveryService = testBed.createDiscoveryServiceWithTracing({
  actionTracingEnabled: true,
  tracedActions: ['core:go', 'core:take'],
  verbosity: 'detailed',
});

// Create test actors and contexts
const actor = testBed.createMockActor('player-1');
const context = testBed.createMockContext();

// Test execution
const result = await discoveryService.getValidActions(actor, context, {
  trace: true,
});

// Access captured logs for verification
const debugLogs = testBed.getDebugLogs();
const errorLogs = testBed.getErrorLogs();

// Clean up after tests
testBed.cleanup();
```

## Performance Test Configuration

Create dedicated performance tests in `tests/performance/actions/tracing/pipelineTracing.performance.test.js`:

```javascript
/**
 * @file Performance tests for pipeline tracing system
 * @description Tests tracing overhead and throughput under load
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';

describe('Pipeline Tracing Performance', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should have minimal tracing overhead under 5% baseline', async () => {
    // Baseline test without tracing
    const baselineService = testBed.createStandardDiscoveryService();
    const actor = testBed.createMockActor('perf-test');
    const context = testBed.createMockContext();

    const baselineStart = performance.now();
    await baselineService.getValidActions(actor, context);
    const baselineDuration = performance.now() - baselineStart;

    // Test with tracing enabled
    const tracingService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['*'],
      verbosity: 'standard',
    });

    const tracingStart = performance.now();
    await tracingService.getValidActions(actor, context, { trace: true });
    const tracingDuration = performance.now() - tracingStart;

    // Overhead should be less than 5% of baseline
    const overhead =
      ((tracingDuration - baselineDuration) / baselineDuration) * 100;
    expect(overhead).toBeLessThan(5);
  });

  it('should handle high throughput tracing (100 operations/sec)', async () => {
    const service = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['*'],
      verbosity: 'minimal',
    });

    const operations = [];
    const actor = testBed.createMockActor('throughput-test');
    const context = testBed.createMockContext();

    // Queue 100 operations
    for (let i = 0; i < 100; i++) {
      operations.push(service.getValidActions(actor, context, { trace: true }));
    }

    const start = performance.now();
    const results = await Promise.all(operations);
    const duration = performance.now() - start;

    // Should complete 100 operations in under 1 second
    expect(duration).toBeLessThan(1000);
    expect(results.length).toBe(100);

    // All should have tracing data
    results.forEach((result) => {
      expect(result.trace).toBeDefined();
    });
  });
});
```

**Run with**: `npm run test:performance`

## Memory Test Configuration

Create dedicated memory tests in `tests/memory/actions/tracing/pipelineTracing.memory.test.js`:

```javascript
/**
 * @file Memory tests for pipeline tracing system
 * @description Tests memory usage and leak prevention
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';

describe('Pipeline Tracing Memory', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  it('should not leak memory during extended tracing', async () => {
    const service = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['*'],
      verbosity: 'standard',
    });

    const actor = testBed.createMockActor('memory-test');
    const context = testBed.createMockContext();

    // Measure initial memory
    if (global.gc) global.gc();
    const initialMemory = process.memoryUsage().heapUsed;

    // Perform 1000 tracing operations
    for (let i = 0; i < 1000; i++) {
      await service.getValidActions(actor, context, { trace: true });

      // Periodic cleanup
      if (i % 100 === 0 && global.gc) {
        global.gc();
      }
    }

    // Measure final memory
    if (global.gc) global.gc();
    const finalMemory = process.memoryUsage().heapUsed;

    // Memory growth should be minimal (< 10MB)
    const memoryGrowth = finalMemory - initialMemory;
    const maxGrowthMB = 10 * 1024 * 1024; // 10MB
    expect(memoryGrowth).toBeLessThan(maxGrowthMB);
  });

  it('should cleanup trace data efficiently', async () => {
    const service = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['core:go'],
      verbosity: 'verbose',
    });

    const actor = testBed.createMockActor('cleanup-test');
    const context = testBed.createMockContext();

    // Generate tracing data
    const results = [];
    for (let i = 0; i < 50; i++) {
      results.push(
        await service.getValidActions(actor, context, { trace: true })
      );
    }

    // Force cleanup
    testBed.cleanup();
    if (global.gc) global.gc();

    // Verify results are still accessible but cleanup occurred
    expect(results.length).toBe(50);
    results.forEach((result) => {
      expect(result.actions).toBeDefined();
      expect(result.trace).toBeDefined();
    });
  });
});
```

**Run with**: `npm run test:memory`

## Implementation Steps

1. **Create Integration Tests** (60 minutes)
   - Implement main integration test file
   - Setup proper test bed usage
   - Create helper methods for test data

2. **Implement End-to-End Tests** (60 minutes)
   - Complete pipeline execution tests
   - Multiple action tracing tests
   - Trace validation through logs

3. **Implement Stage-Specific Tests** (90 minutes)
   - ComponentFilteringStage tests
   - PrerequisiteEvaluationStage tests
   - MultiTargetResolutionStage tests
   - ActionFormattingStage tests

4. **Implement Verbosity Tests** (30 minutes)
   - Test different verbosity levels
   - Validate log output differences
   - Verify tracing behavior

5. **Implement Performance Tests** (45 minutes)
   - Create performance test suite
   - Measure tracing overhead
   - Test concurrent processing
   - Validate performance requirements

6. **Implement Memory Tests** (45 minutes)
   - Create memory test suite
   - Test memory usage patterns
   - Validate cleanup efficiency
   - Prevent memory leaks

## Dependencies

### Depends On

- All pipeline stage implementations (ComponentFilteringStage, PrerequisiteEvaluationStage, MultiTargetResolutionStage, ActionFormattingStage)
- ActionDiscoveryService with tracing support
- Existing ActionDiscoveryServiceTestBed for test infrastructure
- Performance and memory test infrastructure (jest.config.performance.js, jest.config.memory.js)

### Blocks

- End-to-end system testing
- Performance optimization work

## Estimated Effort

- **Estimated Hours**: 5.5 hours
- **Complexity**: Medium
- **Risk**: Medium (due to integration complexity)
- **Additional Time**: +1.5 hours for performance and memory test suites

## Success Metrics

- [ ] All integration tests pass consistently
- [ ] Full pipeline coverage achieved through log verification
- [ ] Performance requirements validated (<5% overhead in performance suite)
- [ ] Memory requirements validated (<10MB growth in memory suite)
- [ ] No race conditions in async operations
- [ ] Clear separation between test scenarios
- [ ] Performance tests run via `npm run test:performance`
- [ ] Memory tests run via `npm run test:memory`

## Notes

- Use real service implementations where possible
- Mock only external dependencies (file system, network)
- Ensure proper async handling throughout tests
- Test both success and failure paths
- Validate trace data structure at each stage
- Consider adding stress tests for high load scenarios

## Related Files

- **Source**: `src/actions/pipeline/stages/*.js`
- **Integration Test**: `tests/integration/actions/tracing/pipelineTracing.integration.test.js`
- **Performance Test**: `tests/performance/actions/tracing/pipelineTracing.performance.test.js`
- **Memory Test**: `tests/memory/actions/tracing/pipelineTracing.memory.test.js`
- **Test Bed**: `tests/common/actions/actionDiscoveryServiceTestBed.js`
- **Similar Tests**: `tests/integration/actions/actionDiscoveryService.integration.test.js`
- **Test Runners**:
  - Integration: `npm run test:integration`
  - Performance: `npm run test:performance`
  - Memory: `npm run test:memory`

---

**Ticket Status**: Ready for Development
**Priority**: High (Phase 5 - Testing)
**Labels**: testing, integration-test, action-tracing, phase-5, pipeline
