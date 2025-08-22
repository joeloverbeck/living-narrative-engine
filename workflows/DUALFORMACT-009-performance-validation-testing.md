# DUALFORMACT-009: Performance Validation Testing

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 3 - Testing & Validation  
**Component**: Performance Testing  
**Estimated**: 6 hours

## Description

Create comprehensive performance validation tests to ensure dual-format action tracing meets the specification requirements of <10ms additional overhead per trace. This includes benchmarking, load testing, memory profiling, and performance regression testing.

## Technical Requirements

### 1. Performance Benchmark Suite

Create comprehensive benchmarking tests for format generation performance:

```javascript
// tests/performance/actions/tracing/dualFormatPerformance.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { TestBedClass } from '../../common/testbed.js';

describe('Dual-Format Action Tracing Performance', () => {
  let testBed;
  let actionTraceOutputService;
  let performanceResults = [];

  beforeEach(async () => {
    testBed = new TestBedClass();

    // Configure for dual-format output
    const config = {
      outputFormats: ['json', 'text'],
      outputToFile: false, // Focus on generation performance
      outputToConsole: false,
      textFormatOptions: {
        lineWidth: 120,
        indentSize: 2,
        includeTimestamps: true,
        performanceSummary: true,
      },
    };

    actionTraceOutputService = testBed.createActionTraceOutputService({
      config,
    });
  });

  afterEach(() => {
    // Collect results for analysis
    if (performanceResults.length > 0) {
      const avg =
        performanceResults.reduce((a, b) => a + b, 0) /
        performanceResults.length;
      const min = Math.min(...performanceResults);
      const max = Math.max(...performanceResults);

      console.log(
        `Performance metrics: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`
      );
    }
    performanceResults = [];
  });

  describe('Format Generation Performance', () => {
    it('should generate JSON format within 2ms per trace', async () => {
      const trace = testBed.createLargeTrace(); // Complex trace with many components
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const outputs =
          actionTraceOutputService.generateFormattedOutputs(trace);
        const endTime = performance.now();

        const jsonOutput = outputs.find((o) => o.fileName.endsWith('.json'));
        expect(jsonOutput).toBeDefined();
        expect(jsonOutput.content).toBeTruthy();

        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[
        Math.floor(times.length * 0.95)
      ];

      expect(avgTime).toBeLessThan(2); // JSON generation <2ms average
      expect(p95Time).toBeLessThan(5); // P95 <5ms

      performanceResults.push(avgTime);
    });

    it('should generate text format within 3ms per trace', async () => {
      const trace = testBed.createLargeTrace();
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const outputs =
          actionTraceOutputService.generateFormattedOutputs(trace);
        const endTime = performance.now();

        const textOutput = outputs.find((o) => o.fileName.endsWith('.txt'));
        expect(textOutput).toBeDefined();
        expect(textOutput.content).toBeTruthy();
        expect(textOutput.content).toContain('=== Action Trace Report ===');

        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[
        Math.floor(times.length * 0.95)
      ];

      expect(avgTime).toBeLessThan(3); // Text generation <3ms average
      expect(p95Time).toBeLessThan(8); // P95 <8ms

      performanceResults.push(avgTime);
    });

    it('should generate dual formats within 10ms total overhead', async () => {
      const trace = testBed.createLargeTrace();
      const iterations = 100;
      const dualTimes = [];
      const jsonOnlyTimes = [];

      // Benchmark dual-format generation
      const dualConfig = {
        outputFormats: ['json', 'text'],
        outputToFile: false,
      };
      const dualService = testBed.createActionTraceOutputService({
        config: dualConfig,
      });

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const outputs = dualService.generateFormattedOutputs(trace);
        const endTime = performance.now();

        expect(outputs).toHaveLength(2);
        dualTimes.push(endTime - startTime);
      }

      // Benchmark JSON-only generation for comparison
      const jsonConfig = { outputFormats: ['json'], outputToFile: false };
      const jsonService = testBed.createActionTraceOutputService({
        config: jsonConfig,
      });

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const outputs = jsonService.generateFormattedOutputs(trace);
        const endTime = performance.now();

        expect(outputs).toHaveLength(1);
        jsonOnlyTimes.push(endTime - startTime);
      }

      const avgDualTime =
        dualTimes.reduce((a, b) => a + b, 0) / dualTimes.length;
      const avgJsonTime =
        jsonOnlyTimes.reduce((a, b) => a + b, 0) / jsonOnlyTimes.length;
      const overhead = avgDualTime - avgJsonTime;

      console.log(
        `Dual format: ${avgDualTime.toFixed(2)}ms, JSON-only: ${avgJsonTime.toFixed(2)}ms, Overhead: ${overhead.toFixed(2)}ms`
      );

      expect(overhead).toBeLessThan(10); // <10ms additional overhead per spec
      expect(avgDualTime).toBeLessThan(15); // Total time should be reasonable

      performanceResults.push(overhead);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should have minimal memory overhead for dual-format generation', async () => {
      const trace = testBed.createLargeTrace();
      const iterations = 50;

      // Measure memory before
      if (global.gc) global.gc(); // Force garbage collection if available
      const memBefore = process.memoryUsage();

      // Generate many dual-format outputs
      for (let i = 0; i < iterations; i++) {
        const outputs =
          actionTraceOutputService.generateFormattedOutputs(trace);
        expect(outputs).toHaveLength(2);

        // Don't hold references to outputs to allow GC
      }

      // Measure memory after
      if (global.gc) global.gc();
      const memAfter = process.memoryUsage();

      const heapIncrease = memAfter.heapUsed - memBefore.heapUsed;
      const heapIncreasePerTrace = heapIncrease / iterations;

      console.log(
        `Heap increase: ${heapIncrease} bytes total, ${heapIncreasePerTrace} bytes per trace`
      );

      // Should not have significant memory leaks
      expect(heapIncreasePerTrace).toBeLessThan(10000); // <10KB per trace
    });
  });
});
```

### 2. Load Testing Suite

Create tests for high-frequency action execution scenarios:

```javascript
// tests/performance/actions/tracing/loadTesting.test.js
describe('High-Frequency Action Tracing Load Tests', () => {
  let testBed;
  let mockServer;
  let outputService;

  beforeEach(async () => {
    testBed = new TestBedClass();
    mockServer = await testBed.startHighPerformanceMockServer();

    const config = {
      outputFormats: ['json', 'text'],
      outputToFile: true,
      outputDirectory: testBed.tempDirectory,
      useBatchEndpoint: true,
    };

    outputService = testBed.createActionTraceOutputService({
      config,
      serverUrl: mockServer.url,
    });
  });

  afterEach(async () => {
    await mockServer.stop();
    testBed.cleanup();
  });

  it('should handle 100 rapid dual-format traces without blocking', async () => {
    const traces = Array.from({ length: 100 }, (_, i) =>
      testBed.createMockTrace({ actionId: `rapid_action_${i}` })
    );

    const startTime = performance.now();

    // Execute all traces as fast as possible
    const promises = traces.map((trace) => outputService.outputTrace(trace));
    const results = await Promise.allSettled(promises);

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const timePerTrace = totalTime / traces.length;

    // Verify all traces completed
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(
      `Load test: ${successful}/${traces.length} successful, ${timePerTrace.toFixed(2)}ms per trace`
    );

    expect(successful).toBeGreaterThanOrEqual(95); // ≥95% success rate
    expect(timePerTrace).toBeLessThan(50); // <50ms per trace including I/O
    expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
  });

  it('should maintain performance under sustained load', async () => {
    const batchSize = 20;
    const batches = 5;
    const batchTimes = [];

    for (let batch = 0; batch < batches; batch++) {
      const traces = Array.from({ length: batchSize }, (_, i) =>
        testBed.createMockTrace({ actionId: `sustained_${batch}_${i}` })
      );

      const batchStartTime = performance.now();

      const promises = traces.map((trace) => outputService.outputTrace(trace));
      await Promise.all(promises);

      const batchEndTime = performance.now();
      const batchTime = batchEndTime - batchStartTime;
      batchTimes.push(batchTime);

      console.log(`Batch ${batch + 1}/${batches}: ${batchTime.toFixed(2)}ms`);

      // Brief pause between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Performance should not degrade significantly across batches
    const firstBatchTime = batchTimes[0];
    const lastBatchTime = batchTimes[batchTimes.length - 1];
    const degradation = (lastBatchTime - firstBatchTime) / firstBatchTime;

    expect(degradation).toBeLessThan(0.5); // <50% performance degradation
  });
});
```

### 3. File I/O Performance Tests

Test file writing performance under various conditions:

```javascript
// tests/performance/actions/tracing/fileIOPerformance.test.js
describe('File I/O Performance Tests', () => {
  let testBed;
  let realServer;
  let tempDirectory;

  beforeEach(async () => {
    testBed = new TestBedClass();
    tempDirectory = await testBed.createTempDirectory();
    realServer = await testBed.startRealLlmProxyServer({
      traceDirectory: tempDirectory,
    });
  });

  afterEach(async () => {
    await realServer.stop();
    await testBed.cleanupTempDirectory(tempDirectory);
  });

  it('should write dual-format traces to disk within 20ms per trace', async () => {
    const fileHandler = new FileTraceOutputHandler({
      config: { outputDirectory: './traces' },
      serverUrl: realServer.url,
      logger: testBed.createMockLogger(),
    });

    const trace = testBed.createLargeTrace();
    const formattedTraces = [
      { content: JSON.stringify(trace, null, 2), fileName: 'perf_test.json' },
      { content: testBed.generateTextTrace(trace), fileName: 'perf_test.txt' },
    ];

    const iterations = 50;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const uniqueTraces = formattedTraces.map((ft) => ({
        ...ft,
        fileName: `${i}_${ft.fileName}`,
      }));

      const startTime = performance.now();
      const result = await fileHandler.writeFormattedTraces(uniqueTraces);
      const endTime = performance.now();

      expect(result).toBe(true);
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const p95Time = times.sort((a, b) => a - b)[
      Math.floor(times.length * 0.95)
    ];

    console.log(
      `File I/O performance: avg=${avgTime.toFixed(2)}ms, p95=${p95Time.toFixed(2)}ms`
    );

    expect(avgTime).toBeLessThan(20); // <20ms average for dual-format write
    expect(p95Time).toBeLessThan(50); // P95 <50ms
  });

  it('should benefit from batch endpoint optimization', async () => {
    const batchHandler = new FileTraceOutputHandler({
      config: {
        outputDirectory: './traces',
        useBatchEndpoint: true,
      },
      serverUrl: realServer.url,
      logger: testBed.createMockLogger(),
    });

    const individualHandler = new FileTraceOutputHandler({
      config: {
        outputDirectory: './traces',
        useBatchEndpoint: false,
      },
      serverUrl: realServer.url,
      logger: testBed.createMockLogger(),
    });

    const trace = testBed.createMockTrace();
    const formattedTraces = [
      { content: JSON.stringify(trace, null, 2), fileName: 'batch_test.json' },
      { content: testBed.generateTextTrace(trace), fileName: 'batch_test.txt' },
    ];

    const iterations = 20;

    // Test batch endpoint
    const batchTimes = [];
    for (let i = 0; i < iterations; i++) {
      const uniqueTraces = formattedTraces.map((ft) => ({
        ...ft,
        fileName: `batch_${i}_${ft.fileName}`,
      }));

      const startTime = performance.now();
      await batchHandler.writeFormattedTraces(uniqueTraces);
      const endTime = performance.now();

      batchTimes.push(endTime - startTime);
    }

    // Test individual endpoint
    const individualTimes = [];
    for (let i = 0; i < iterations; i++) {
      const uniqueTraces = formattedTraces.map((ft) => ({
        ...ft,
        fileName: `individual_${i}_${ft.fileName}`,
      }));

      const startTime = performance.now();
      await individualHandler.writeFormattedTraces(uniqueTraces);
      const endTime = performance.now();

      individualTimes.push(endTime - startTime);
    }

    const avgBatchTime =
      batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
    const avgIndividualTime =
      individualTimes.reduce((a, b) => a + b, 0) / individualTimes.length;
    const improvement =
      ((avgIndividualTime - avgBatchTime) / avgIndividualTime) * 100;

    console.log(
      `Batch: ${avgBatchTime.toFixed(2)}ms, Individual: ${avgIndividualTime.toFixed(2)}ms, Improvement: ${improvement.toFixed(1)}%`
    );

    expect(improvement).toBeGreaterThan(20); // >20% improvement with batch endpoint
  });
});
```

### 4. Memory Profiling Tests

Add memory usage and leak detection:

```javascript
// tests/performance/actions/tracing/memoryProfiling.test.js
describe('Memory Profiling Tests', () => {
  beforeEach(() => {
    if (global.gc) {
      global.gc(); // Force garbage collection before each test
    }
  });

  it('should not leak memory during continuous dual-format generation', async () => {
    const testBed = new TestBedClass();
    const service = testBed.createActionTraceOutputService({
      config: { outputFormats: ['json', 'text'], outputToFile: false },
    });

    const initialMemory = process.memoryUsage();
    const samples = [];
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const trace = testBed.createLargeTrace();
      const outputs = service.generateFormattedOutputs(trace);

      // Don't hold references to allow GC
      expect(outputs).toHaveLength(2);

      // Sample memory usage every 100 iterations
      if (i % 100 === 0) {
        if (global.gc) global.gc();
        samples.push(process.memoryUsage().heapUsed);
      }
    }

    // Check for memory growth trend
    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    const growth = lastSample - firstSample;
    const growthMB = growth / (1024 * 1024);

    console.log(
      `Memory samples: ${samples.map((s) => (s / 1024 / 1024).toFixed(1)).join(', ')}MB`
    );
    console.log(
      `Total growth: ${growthMB.toFixed(1)}MB over ${iterations} iterations`
    );

    // Should not grow significantly (allow for some normal variance)
    expect(growthMB).toBeLessThan(10); // <10MB growth over 1000 iterations
  });

  it('should clean up formatter instances properly', async () => {
    const createAndDestroyService = () => {
      const testBed = new TestBedClass();
      return testBed.createActionTraceOutputService({
        config: { outputFormats: ['json', 'text'] },
      });
    };

    if (global.gc) global.gc();
    const initialMemory = process.memoryUsage().heapUsed;

    // Create and destroy many service instances
    for (let i = 0; i < 100; i++) {
      const service = createAndDestroyService();
      const trace = { actionId: 'test', components: { test: i } };
      service.generateFormattedOutputs(trace);

      // Service goes out of scope
    }

    if (global.gc) global.gc();
    const finalMemory = process.memoryUsage().heapUsed;
    const growth = (finalMemory - initialMemory) / (1024 * 1024);

    console.log(
      `Service creation/destruction memory growth: ${growth.toFixed(1)}MB`
    );

    expect(growth).toBeLessThan(5); // <5MB growth from service churn
  });
});
```

## Implementation Steps

1. **Set Up Performance Testing Infrastructure**
   - [ ] Create performance test directory structure
   - [ ] Set up high-precision timing utilities
   - [ ] Create realistic trace data generators
   - [ ] Add memory profiling helpers
   - [ ] Configure test runner for performance tests

2. **Implement Format Generation Benchmarks**
   - [ ] Test JSON format generation performance
   - [ ] Test text format generation performance
   - [ ] Test dual-format overhead measurement
   - [ ] Add statistical analysis of timing data
   - [ ] Create performance regression detection

3. **Implement Load Testing Suite**
   - [ ] Test high-frequency action execution
   - [ ] Test sustained load scenarios
   - [ ] Test concurrent trace generation
   - [ ] Add performance degradation detection
   - [ ] Test memory stability under load

4. **Implement File I/O Performance Tests**
   - [ ] Test file writing performance with real server
   - [ ] Test batch endpoint performance benefits
   - [ ] Test network timeout and retry scenarios
   - [ ] Add disk I/O performance measurement
   - [ ] Test large trace file handling

5. **Implement Memory Profiling Tests**
   - [ ] Test for memory leaks in continuous operation
   - [ ] Test formatter instance lifecycle
   - [ ] Test memory usage patterns
   - [ ] Add heap growth analysis
   - [ ] Test garbage collection efficiency

6. **Add Performance Reporting and Analysis**
   - [ ] Create performance dashboard/summary
   - [ ] Add percentile analysis (P50, P95, P99)
   - [ ] Generate performance regression reports
   - [ ] Add comparison with baseline metrics
   - [ ] Create performance CI/CD integration

## Acceptance Criteria

- [ ] Dual-format generation adds <10ms overhead per specification
- [ ] JSON format generation completes in <2ms average
- [ ] Text format generation completes in <3ms average
- [ ] Memory usage remains stable during continuous operation
- [ ] No memory leaks detected in long-running tests
- [ ] Load tests handle 100+ rapid traces without failure
- [ ] File I/O performance meets <20ms per dual-format write
- [ ] Batch endpoint provides >20% performance improvement
- [ ] Performance degrades <50% under sustained load
- [ ] Statistical analysis provides confidence in measurements
- [ ] Performance tests are repeatable and reliable

## Dependencies

- **Depends On**: DUALFORMACT-006 (Integration Test Suite)
- **Validates**: All core implementation tickets (001-004)
- **Informs**: DUALFORMACT-010 (Migration and Backward Compatibility)

## Testing Requirements

1. **Test Environment**
   - [ ] Node.js performance hooks for precise timing
   - [ ] Memory profiling tools and utilities
   - [ ] Real server instances for I/O testing
   - [ ] Statistical analysis libraries
   - [ ] CI/CD integration for regression detection

2. **Test Data**
   - [ ] Small, medium, and large trace objects
   - [ ] Realistic component data structures
   - [ ] Various action types and complexity levels
   - [ ] Edge cases and boundary conditions

3. **Measurement Accuracy**
   - [ ] Multiple iterations for statistical significance
   - [ ] Warm-up periods to account for JIT optimization
   - [ ] Garbage collection control for memory tests
   - [ ] Baseline measurements for comparison

## Files to Create

- **New**: `tests/performance/actions/tracing/dualFormatPerformance.test.js`
- **New**: `tests/performance/actions/tracing/loadTesting.test.js`
- **New**: `tests/performance/actions/tracing/fileIOPerformance.test.js`
- **New**: `tests/performance/actions/tracing/memoryProfiling.test.js`
- **New**: `tests/performance/common/performanceUtils.js`
- **New**: `tests/performance/common/memoryUtils.js`

## Performance Test Utilities

```javascript
// tests/performance/common/performanceUtils.js
export class PerformanceAnalyzer {
  static analyzeTimings(timings) {
    const sorted = timings.sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: timings.reduce((a, b) => a + b, 0) / timings.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: this.calculateStdDev(timings),
    };
  }

  static calculateStdDev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }

  static benchmark(fn, iterations = 100) {
    const times = [];

    // Warm up
    for (let i = 0; i < 10; i++) {
      fn();
    }

    // Actual measurement
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    return this.analyzeTimings(times);
  }
}
```

## CI/CD Integration

```yaml
# .github/workflows/performance-tests.yml
name: Performance Tests
on:
  pull_request:
    paths:
      - 'src/actions/tracing/**'
      - 'tests/performance/**'

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - run: npm run test:performance

      - name: Performance Regression Check
        run: |
          # Compare with baseline metrics
          node scripts/check-performance-regression.js
```

## Baseline Performance Targets

| Metric               | Target            | Measurement Method  |
| -------------------- | ----------------- | ------------------- |
| JSON Generation      | <2ms avg          | 100 iterations      |
| Text Generation      | <3ms avg          | 100 iterations      |
| Dual-Format Overhead | <10ms             | Comparison test     |
| File I/O (Dual)      | <20ms avg         | Real server test    |
| Memory Growth        | <10MB/1000 traces | Continuous test     |
| Load Test Success    | >95%              | 100 rapid traces    |
| Batch Improvement    | >20%              | Endpoint comparison |

## Risk Mitigation

1. **Test Reliability**
   - Multiple iterations for statistical significance
   - Warm-up periods for JIT optimization
   - Controlled test environments

2. **Measurement Accuracy**
   - High-precision timing APIs
   - Garbage collection control
   - Baseline comparison metrics

3. **Performance Regression**
   - Automated performance CI/CD checks
   - Clear performance budgets
   - Regression alerting system

## Notes

- Critical for validating specification compliance
- Must use realistic trace data and scenarios
- Performance tests should run in CI/CD pipeline
- Results inform optimization priorities
- Foundation for capacity planning and scaling

## Related Tickets

- **Depends On**: DUALFORMACT-006 (Integration Test Suite)
- **Validates**: DUALFORMACT-003, DUALFORMACT-004 (Core Implementation)
- **Informs**: DUALFORMACT-010 (Migration and Backward Compatibility)
- **Supports**: All DUALFORMACT tickets with performance validation
