# ACTTRA-035: Create Performance Impact Tests

## Summary

Create comprehensive performance tests to measure and validate the action tracing system's impact on game performance, ensuring overhead requirements are met and no performance degradation occurs when tracing is disabled.

## Parent Issue

- **Phase**: Phase 5 - Testing & Documentation
- **Specification**: [Action Tracing System Implementation Specification](../specs/action-tracing-implementation.spec.md)
- **Overview**: [ACTTRA-000](./ACTTRA-000-implementation-overview.md)

## Description

This ticket focuses on creating performance tests that validate the action tracing system meets all performance requirements. Tests must measure overhead when tracing is disabled (<5ms), overhead per traced action (<5ms), throughput capacity (100+ actions/second), memory usage (<10MB for traces), and ensure the system doesn't block the game loop or event processing.

## Acceptance Criteria

- [ ] Performance test file created at `tests/performance/actions/tracing/actionTracingPerformance.test.js`
- [ ] Tests validate <5ms overhead when tracing disabled
- [ ] Tests validate <5ms overhead per traced action
- [ ] Tests validate 100+ actions/second throughput
- [ ] Tests validate <10MB memory usage for traces
- [ ] Tests confirm no blocking of game loop
- [ ] Tests measure file I/O performance (<10ms writes)
- [ ] Tests validate CPU and memory profiling
- [ ] Automated performance regression detection
- [ ] All performance benchmarks pass consistently

## Technical Requirements

### Test File Structure

```javascript
// tests/performance/actions/tracing/actionTracingPerformance.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingPerformanceTestBed } from '../../../common/performance/actionTracingPerformanceTestBed.js';

describe('Action Tracing - Performance Impact', () => {
  let testBed;
  const performanceThresholds = {
    disabledOverhead: 5,      // <5ms when disabled
    enabledOverhead: 5,       // <5ms per traced action
    throughput: 100,          // 100+ actions/second
    memoryUsage: 10 * 1024 * 1024, // <10MB
    fileWriteTime: 10,        // <10ms per file write
    queueProcessingTime: 1    // <1ms queue processing
  };

  beforeEach(async () => {
    testBed = new ActionTracingPerformanceTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  // Test suites...
});
```

### Test Scenarios

#### 1. Disabled Tracing Overhead

```javascript
describe('Disabled Tracing Overhead', () => {
  it('should have <5ms overhead when tracing is disabled', async () => {
    // Baseline: Execute action discovery without tracing infrastructure
    const baselineResults = await testBed.measureBaselinePerformance(1000);
    
    // Test: Execute with tracing infrastructure but disabled
    await testBed.configureTracing({ enabled: false });
    const disabledResults = await testBed.measureActionDiscoveryPerformance(1000);
    
    const overhead = disabledResults.averageTime - baselineResults.averageTime;
    
    expect(overhead).toBeLessThan(performanceThresholds.disabledOverhead);
    
    // Log performance metrics
    testBed.logPerformanceMetrics('disabled_overhead', {
      baseline: baselineResults.averageTime,
      disabled: disabledResults.averageTime,
      overhead,
      threshold: performanceThresholds.disabledOverhead
    });
  });

  it('should have minimal memory overhead when disabled', async () => {
    const baselineMemory = await testBed.measureMemoryUsage();
    
    await testBed.configureTracing({ enabled: false });
    await testBed.executeActionBatch(100);
    
    const disabledMemory = await testBed.measureMemoryUsage();
    const memoryOverhead = disabledMemory - baselineMemory;
    
    expect(memoryOverhead).toBeLessThan(1 * 1024 * 1024); // <1MB overhead
  });

  it('should not affect event processing when disabled', async () => {
    await testBed.configureTracing({ enabled: false });
    
    const startTime = performance.now();
    const eventsProcessed = await testBed.processEventBatch(1000);
    const duration = performance.now() - startTime;
    
    expect(eventsProcessed).toBe(1000);
    expect(duration).toBeLessThan(100); // <100ms for 1000 events
  });
});
```

#### 2. Enabled Tracing Overhead

```javascript
describe('Enabled Tracing Overhead', () => {
  it('should have <5ms overhead per traced action', async () => {
    const actionIds = ['core:go', 'core:take', 'core:use'];
    
    // Measure without tracing
    await testBed.configureTracing({ enabled: false });
    const withoutTracing = await testBed.measureActionExecutionPerformance(
      actionIds, 100
    );
    
    // Measure with tracing
    await testBed.configureTracing({
      enabled: true,
      tracedActions: actionIds
    });
    const withTracing = await testBed.measureActionExecutionPerformance(
      actionIds, 100
    );
    
    const overheadPerAction = withTracing.averageTime - withoutTracing.averageTime;
    
    expect(overheadPerAction).toBeLessThan(performanceThresholds.enabledOverhead);
    
    testBed.logPerformanceMetrics('enabled_overhead', {
      withoutTracing: withoutTracing.averageTime,
      withTracing: withTracing.averageTime,
      overhead: overheadPerAction,
      threshold: performanceThresholds.enabledOverhead
    });
  });

  it('should scale linearly with number of traced actions', async () => {
    const testSizes = [1, 10, 50, 100];
    const overheadResults = [];
    
    for (const size of testSizes) {
      const tracedActions = testBed.generateActionIds(size);
      
      await testBed.configureTracing({
        enabled: true,
        tracedActions
      });
      
      const result = await testBed.measureActionExecutionPerformance(
        tracedActions, 50
      );
      
      overheadResults.push({
        size,
        averageTime: result.averageTime,
        perActionOverhead: result.averageTime / size
      });
    }
    
    // Verify linear scaling (not exponential)
    for (let i = 1; i < overheadResults.length; i++) {
      const current = overheadResults[i];
      const previous = overheadResults[i - 1];
      
      const scalingFactor = current.averageTime / previous.averageTime;
      const expectedScaling = current.size / previous.size;
      
      // Should scale roughly linearly (within 50% tolerance)
      expect(scalingFactor).toBeLessThan(expectedScaling * 1.5);
    }
  });
});
```

#### 3. Throughput Testing

```javascript
describe('Throughput Testing', () => {
  it('should handle 100+ actions per second when tracing enabled', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go', 'core:take', 'core:use'],
      verbosity: 'standard'
    });
    
    const actionCount = 200;
    const startTime = performance.now();
    
    const results = await testBed.executeActionBatch(actionCount);
    
    const duration = performance.now() - startTime;
    const actionsPerSecond = actionCount / (duration / 1000);
    
    expect(actionsPerSecond).toBeGreaterThan(performanceThresholds.throughput);
    expect(results.successCount).toBe(actionCount);
    
    testBed.logPerformanceMetrics('throughput', {
      actionCount,
      duration,
      actionsPerSecond,
      threshold: performanceThresholds.throughput
    });
  });

  it('should maintain throughput with concurrent actors', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['*'], // Trace all actions
      verbosity: 'minimal'
    });
    
    const actorCount = 10;
    const actionsPerActor = 50;
    
    const actors = testBed.createActors(actorCount);
    
    const startTime = performance.now();
    
    const promises = actors.map(actor => 
      testBed.executeActionSequence(actor, actionsPerActor)
    );
    
    const results = await Promise.all(promises);
    
    const duration = performance.now() - startTime;
    const totalActions = actorCount * actionsPerActor;
    const actionsPerSecond = totalActions / (duration / 1000);
    
    expect(actionsPerSecond).toBeGreaterThan(performanceThresholds.throughput);
    
    // Verify all actions succeeded
    const totalSuccesses = results.reduce((sum, result) => sum + result.successCount, 0);
    expect(totalSuccesses).toBe(totalActions);
  });

  it('should handle burst loads without degradation', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      verbosity: 'detailed'
    });
    
    // Test burst: 500 actions in quick succession
    const burstSize = 500;
    const burstResults = [];
    
    // Execute in small bursts to simulate realistic load
    for (let i = 0; i < 5; i++) {
      const batchSize = burstSize / 5;
      const startTime = performance.now();
      
      await testBed.executeActionBatch(batchSize);
      
      const batchDuration = performance.now() - startTime;
      const batchThroughput = batchSize / (batchDuration / 1000);
      
      burstResults.push(batchThroughput);
    }
    
    // All batches should maintain minimum throughput
    burstResults.forEach(throughput => {
      expect(throughput).toBeGreaterThan(performanceThresholds.throughput);
    });
    
    // Performance should not degrade over time
    const firstBatch = burstResults[0];
    const lastBatch = burstResults[burstResults.length - 1];
    const degradation = (firstBatch - lastBatch) / firstBatch;
    
    expect(degradation).toBeLessThan(0.2); // <20% degradation
  });
});
```

#### 4. Memory Usage Testing

```javascript
describe('Memory Usage Testing', () => {
  it('should use <10MB memory for trace storage', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['*'],
      verbosity: 'verbose',
      maxTraceFiles: 1000 // Large number to test memory limits
    });
    
    const initialMemory = await testBed.measureMemoryUsage();
    
    // Execute large number of actions to generate traces
    await testBed.executeActionBatch(1000);
    
    // Wait for all traces to be processed
    await testBed.waitForTraceProcessing();
    
    const finalMemory = await testBed.measureMemoryUsage();
    const memoryUsage = finalMemory - initialMemory;
    
    expect(memoryUsage).toBeLessThan(performanceThresholds.memoryUsage);
    
    testBed.logPerformanceMetrics('memory_usage', {
      initialMemory,
      finalMemory,
      memoryUsage,
      threshold: performanceThresholds.memoryUsage
    });
  });

  it('should implement proper garbage collection', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      maxTraceFiles: 10, // Small limit to force rotation
      rotationPolicy: 'count'
    });
    
    const memoryReadings = [];
    
    // Execute actions in batches and measure memory
    for (let batch = 0; batch < 10; batch++) {
      await testBed.executeActionBatch(50);
      await testBed.waitForTraceProcessing();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memory = await testBed.measureMemoryUsage();
      memoryReadings.push(memory);
    }
    
    // Memory should not grow indefinitely
    const initialMemory = memoryReadings[0];
    const finalMemory = memoryReadings[memoryReadings.length - 1];
    const growth = (finalMemory - initialMemory) / initialMemory;
    
    expect(growth).toBeLessThan(2.0); // <200% growth over test period
  });

  it('should handle memory pressure gracefully', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:complex_action']
    });
    
    // Create large payload action
    const largePayloadAction = testBed.createActionWithLargePayload(1024 * 1024); // 1MB payload
    
    const startMemory = await testBed.measureMemoryUsage();
    
    // Execute actions with large payloads
    for (let i = 0; i < 20; i++) {
      await testBed.executeAction(largePayloadAction);
    }
    
    await testBed.waitForTraceProcessing();
    
    const endMemory = await testBed.measureMemoryUsage();
    const memoryIncrease = endMemory - startMemory;
    
    // Should not retain all large payloads in memory
    expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // <5MB increase
  });
});
```

#### 5. File I/O Performance

```javascript
describe('File I/O Performance', () => {
  it('should write trace files in <10ms each', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      verbosity: 'standard'
    });
    
    const writeTimings = [];
    
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now();
      
      await testBed.executeAction('core:go');
      await testBed.waitForSingleTraceWrite();
      
      const writeTime = performance.now() - startTime;
      writeTimings.push(writeTime);
    }
    
    const averageWriteTime = writeTimings.reduce((sum, time) => sum + time, 0) / writeTimings.length;
    const maxWriteTime = Math.max(...writeTimings);
    
    expect(averageWriteTime).toBeLessThan(performanceThresholds.fileWriteTime);
    expect(maxWriteTime).toBeLessThan(performanceThresholds.fileWriteTime * 2); // Allow some variance
  });

  it('should batch file writes efficiently', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go', 'core:take', 'core:use']
    });
    
    // Execute multiple actions rapidly
    const actionPromises = [];
    for (let i = 0; i < 50; i++) {
      actionPromises.push(testBed.executeAction('core:go'));
      actionPromises.push(testBed.executeAction('core:take'));
      actionPromises.push(testBed.executeAction('core:use'));
    }
    
    const startTime = performance.now();
    await Promise.all(actionPromises);
    await testBed.waitForAllTracesWritten();
    const totalTime = performance.now() - startTime;
    
    // Should handle 150 actions + file writes efficiently
    expect(totalTime).toBeLessThan(2000); // <2 seconds total
    
    // Verify all files were written
    const writtenFiles = await testBed.getWrittenTraceFiles();
    expect(writtenFiles.length).toBe(150);
  });

  it('should not block game loop during file writes', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['*']
    });
    
    // Start continuous game loop simulation
    const gameLoopMetrics = testBed.startGameLoopMonitoring();
    
    // Execute actions while monitoring game loop
    for (let i = 0; i < 100; i++) {
      await testBed.executeAction('core:go');
      
      // Check that game loop hasn't been blocked
      const currentFrameTime = gameLoopMetrics.getCurrentFrameTime();
      expect(currentFrameTime).toBeLessThan(16.67); // 60 FPS = 16.67ms per frame
    }
    
    const finalMetrics = gameLoopMetrics.stop();
    
    expect(finalMetrics.averageFrameTime).toBeLessThan(16.67);
    expect(finalMetrics.maxFrameTime).toBeLessThan(33.33); // Allow occasional slower frames
  });
});
```

#### 6. CPU Profiling and Analysis

```javascript
describe('CPU Profiling and Analysis', () => {
  it('should use minimal CPU when tracing is disabled', async () => {
    await testBed.configureTracing({ enabled: false });
    
    const cpuProfiler = testBed.startCPUProfiling();
    
    await testBed.executeActionBatch(1000);
    
    const profile = cpuProfiler.stop();
    
    // CPU usage should be minimal for tracing code paths
    const tracingCPUTime = profile.getTimeInModule('tracing');
    const totalCPUTime = profile.getTotalTime();
    
    expect(tracingCPUTime / totalCPUTime).toBeLessThan(0.01); // <1% CPU for tracing
  });

  it('should have efficient filtering performance', async () => {
    const actionIds = testBed.generateActionIds(1000);
    
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go', 'core:take'] // Only trace 2 out of 1000
    });
    
    const startTime = performance.now();
    
    // Test filtering performance
    for (const actionId of actionIds) {
      testBed.shouldTraceAction(actionId);
    }
    
    const filteringTime = performance.now() - startTime;
    
    // Should filter 1000 actions very quickly
    expect(filteringTime).toBeLessThan(1); // <1ms for 1000 filters
  });

  it('should optimize wildcard pattern matching', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:*', 'custom:*', 'specific:action']
    });
    
    const testActions = [
      ...testBed.generateActionIds(500, 'core:'),
      ...testBed.generateActionIds(500, 'custom:'),
      ...testBed.generateActionIds(100, 'other:')
    ];
    
    const startTime = performance.now();
    
    const matches = testActions.filter(actionId => 
      testBed.shouldTraceAction(actionId)
    );
    
    const matchingTime = performance.now() - startTime;
    
    expect(matches.length).toBe(1000); // core:* + custom:*
    expect(matchingTime).toBeLessThan(2); // <2ms for pattern matching
  });
});
```

#### 7. Regression Detection

```javascript
describe('Performance Regression Detection', () => {
  it('should maintain historical performance benchmarks', async () => {
    const benchmarks = await testBed.loadHistoricalBenchmarks();
    
    // Run current performance tests
    const currentResults = await testBed.runFullPerformanceSuite();
    
    // Compare against historical data
    for (const [testName, currentTime] of Object.entries(currentResults)) {
      const historicalTime = benchmarks[testName];
      
      if (historicalTime) {
        const regression = (currentTime - historicalTime) / historicalTime;
        
        // Fail if performance has regressed by >20%
        expect(regression).toBeLessThan(0.20);
        
        if (regression > 0.10) {
          console.warn(`Performance warning: ${testName} is ${(regression * 100).toFixed(1)}% slower`);
        }
      }
    }
    
    // Save current results as new benchmark
    await testBed.saveBenchmarks(currentResults);
  });

  it('should detect memory leaks over time', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go']
    });
    
    const memorySnapshots = [];
    
    // Execute actions in cycles and monitor memory
    for (let cycle = 0; cycle < 10; cycle++) {
      await testBed.executeActionBatch(100);
      await testBed.waitForTraceProcessing();
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const memoryUsage = await testBed.measureDetailedMemoryUsage();
      memorySnapshots.push(memoryUsage);
    }
    
    // Analyze memory trend
    const memoryTrend = testBed.analyzeTrend(memorySnapshots.map(s => s.heapUsed));
    
    // Should not have significant upward trend (memory leak)
    expect(memoryTrend.slope).toBeLessThan(100 * 1024); // <100KB growth per cycle
  });
});
```

### Test Bed Requirements

Create `tests/common/performance/actionTracingPerformanceTestBed.js`:

```javascript
export class ActionTracingPerformanceTestBed {
  constructor() {
    this.container = null;
    this.discoveryService = null;
    this.commandProcessor = null;
    this.performanceMetrics = new Map();
    this.benchmarkHistory = null;
  }

  async initialize() {
    // Setup optimized container for performance testing
    this.container = await this.createPerformanceTestContainer();
    
    this.discoveryService = this.container.resolve('IActionDiscoveryService');
    this.commandProcessor = this.container.resolve('ICommandProcessor');
    
    // Warm up JIT compilation
    await this.warmupServices();
  }

  async measureBaselinePerformance(actionCount) {
    const startTime = performance.now();
    
    for (let i = 0; i < actionCount; i++) {
      await this.executeActionWithoutTracing('core:go');
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      totalTime,
      averageTime: totalTime / actionCount,
      actionsPerSecond: actionCount / (totalTime / 1000)
    };
  }

  async measureActionDiscoveryPerformance(actionCount) {
    const actor = this.createTestActor();
    const startTime = performance.now();
    
    for (let i = 0; i < actionCount; i++) {
      await this.discoveryService.getValidActions(actor, {}, { trace: false });
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      totalTime,
      averageTime: totalTime / actionCount,
      actionsPerSecond: actionCount / (totalTime / 1000)
    };
  }

  async measureActionExecutionPerformance(actionIds, iterationsPerAction) {
    const results = [];
    
    for (const actionId of actionIds) {
      const actor = this.createTestActor();
      const startTime = performance.now();
      
      for (let i = 0; i < iterationsPerAction; i++) {
        const turnAction = this.createTurnAction(actionId);
        await this.commandProcessor.dispatchAction(actor, turnAction);
      }
      
      const actionTime = performance.now() - startTime;
      results.push({
        actionId,
        totalTime: actionTime,
        averageTime: actionTime / iterationsPerAction
      });
    }
    
    const totalTime = results.reduce((sum, r) => sum + r.totalTime, 0);
    const totalIterations = actionIds.length * iterationsPerAction;
    
    return {
      results,
      totalTime,
      averageTime: totalTime / totalIterations,
      actionsPerSecond: totalIterations / (totalTime / 1000)
    };
  }

  async measureMemoryUsage() {
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return process.memoryUsage().heapUsed;
  }

  async measureDetailedMemoryUsage() {
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return process.memoryUsage();
  }

  generateActionIds(count, prefix = 'test:action_') {
    return Array.from({ length: count }, (_, i) => `${prefix}${i}`);
  }

  createTestActor() {
    const actor = this.entityManager.createEntity('test-actor');
    actor.addComponent('core:position', { x: 0, y: 0 });
    actor.addComponent('core:movement', {});
    actor.addComponent('core:inventory', { items: [] });
    return actor;
  }

  createActors(count) {
    return Array.from({ length: count }, (_, i) => {
      const actor = this.entityManager.createEntity(`test-actor-${i}`);
      actor.addComponent('core:position', { x: i, y: i });
      return actor;
    });
  }

  async executeActionBatch(actionCount) {
    const results = { successCount: 0, failureCount: 0 };
    const promises = [];
    
    for (let i = 0; i < actionCount; i++) {
      const actionId = this.getRandomActionId();
      const promise = this.executeAction(actionId).then(
        () => results.successCount++,
        () => results.failureCount++
      );
      promises.push(promise);
    }
    
    await Promise.all(promises);
    return results;
  }

  async executeActionSequence(actor, actionCount) {
    const results = { successCount: 0, failureCount: 0 };
    
    for (let i = 0; i < actionCount; i++) {
      try {
        const actionId = this.getRandomActionId();
        const turnAction = this.createTurnAction(actionId);
        await this.commandProcessor.dispatchAction(actor, turnAction);
        results.successCount++;
      } catch (error) {
        results.failureCount++;
      }
    }
    
    return results;
  }

  startGameLoopMonitoring() {
    const metrics = {
      frameTimes: [],
      startTime: performance.now(),
      lastFrameTime: performance.now(),
      running: true
    };
    
    const monitor = setInterval(() => {
      if (!metrics.running) return;
      
      const currentTime = performance.now();
      const frameTime = currentTime - metrics.lastFrameTime;
      metrics.frameTimes.push(frameTime);
      metrics.lastFrameTime = currentTime;
    }, 16); // ~60 FPS monitoring
    
    return {
      getCurrentFrameTime: () => {
        const now = performance.now();
        return now - metrics.lastFrameTime;
      },
      stop: () => {
        metrics.running = false;
        clearInterval(monitor);
        
        return {
          averageFrameTime: metrics.frameTimes.reduce((sum, t) => sum + t, 0) / metrics.frameTimes.length,
          maxFrameTime: Math.max(...metrics.frameTimes),
          minFrameTime: Math.min(...metrics.frameTimes),
          totalFrames: metrics.frameTimes.length
        };
      }
    };
  }

  startCPUProfiling() {
    const profiler = {
      startTime: performance.now(),
      samples: []
    };
    
    return {
      stop: () => ({
        getTimeInModule: (moduleName) => 0, // Mock implementation
        getTotalTime: () => performance.now() - profiler.startTime
      })
    };
  }

  logPerformanceMetrics(testName, metrics) {
    this.performanceMetrics.set(testName, {
      timestamp: Date.now(),
      ...metrics
    });
    
    console.log(`Performance: ${testName}`, metrics);
  }

  async loadHistoricalBenchmarks() {
    try {
      const data = await fs.readFile('./performance-benchmarks.json', 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  async saveBenchmarks(results) {
    const timestamp = new Date().toISOString();
    const benchmarkData = {
      timestamp,
      results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    await fs.writeFile(
      './performance-benchmarks.json',
      JSON.stringify(benchmarkData, null, 2)
    );
  }

  analyzeTrend(dataPoints) {
    const n = dataPoints.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ...
    const sumY = dataPoints.reduce((sum, y) => sum + y, 0);
    const sumXY = dataPoints.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = dataPoints.reduce((sum, _, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  async waitForTraceProcessing(timeout = 500) {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }

  async cleanup() {
    // Save performance metrics
    if (this.performanceMetrics.size > 0) {
      const metricsData = Object.fromEntries(this.performanceMetrics);
      await this.saveBenchmarks(metricsData);
    }
    
    if (this.container) {
      await this.container.dispose();
    }
  }
}
```

## Implementation Steps

1. **Create Performance Test Bed** (60 minutes)
   - Setup optimized test container
   - Implement performance measurement utilities
   - Create test data generators

2. **Implement Overhead Tests** (45 minutes)
   - Disabled tracing overhead validation
   - Enabled tracing overhead measurement
   - Linear scaling verification

3. **Implement Throughput Tests** (45 minutes)
   - Single actor throughput testing
   - Concurrent actor throughput testing
   - Burst load handling

4. **Implement Memory Tests** (30 minutes)
   - Memory usage validation
   - Garbage collection testing
   - Memory leak detection

5. **Implement I/O Performance Tests** (30 minutes)
   - File write timing validation
   - Queue processing efficiency
   - Game loop blocking prevention

6. **Implement Analysis and Regression Tests** (30 minutes)
   - CPU profiling integration
   - Historical benchmark comparison
   - Automated regression detection

## Dependencies

### Depends On
- All action tracing components (ACTTRA-001 through ACTTRA-030)
- Unit and integration tests should be passing

### Blocks
- Production deployment
- Performance optimization work

## Estimated Effort

- **Estimated Hours**: 3 hours
- **Complexity**: Medium to High
- **Risk**: Medium (performance testing can be sensitive to environment)

## Success Metrics

- [ ] All performance thresholds met consistently
- [ ] Overhead <5ms when disabled
- [ ] Overhead <5ms per traced action
- [ ] Throughput >100 actions/second
- [ ] Memory usage <10MB
- [ ] File writes <10ms each
- [ ] No performance regression detection
- [ ] CPU profiling shows minimal impact

## Notes

- Run tests on consistent hardware for accurate results
- Consider environment variables (Node.js flags, system load)
- Use statistical analysis for variable results
- Include warm-up runs to account for JIT compilation
- Monitor both short-term and sustained performance
- Consider adding stress tests for extreme scenarios

## Related Files

- Source: All action tracing implementation files
- Test: `tests/performance/actions/tracing/actionTracingPerformance.test.js`
- Test Bed: `tests/common/performance/actionTracingPerformanceTestBed.js`
- Benchmarks: `./performance-benchmarks.json`

---

**Ticket Status**: Ready for Development
**Priority**: Critical (Phase 5 - Testing)
**Labels**: testing, performance-test, action-tracing, phase-5, benchmarking, regression