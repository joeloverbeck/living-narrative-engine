# MONCARACTIMP-017: Performance Tests - COMPLETED

## Summary

Create performance tests to verify that actionability analysis completes within acceptable time bounds and to establish baseline metrics for future optimization.

## Priority

LOW

## Effort

Small (~250 LOC)

## Dependencies

- MONCARACTIMP-016 (Integration Tests)
- All service implementations

## Rationale

Performance testing ensures the actionability pipeline doesn't introduce unacceptable latency to Monte Carlo report generation. Establishing baselines now enables performance regression detection in the future.

## Files to Create

| File | Change Type | Description |
|------|-------------|-------------|
| `tests/performance/expressionDiagnostics/actionabilityPerformance.performance.test.js` | CREATE | Performance tests |

## Files to Modify

None - test file only.

## Out of Scope

- Performance optimization implementation
- Profiling infrastructure
- CI/CD performance gate setup
- Memory usage analysis (separate concern)
- Production monitoring

## Implementation Details

### Performance Requirements

| Operation | Target | Maximum |
|-----------|--------|---------|
| Witness search (5000 samples) | <1000ms | <5000ms |
| Edit validation (100 samples) | <100ms | <500ms |
| Full report generation | <2000ms | <10000ms |
| Single OR block analysis | <50ms | <200ms |

### Test Structure

```javascript
// tests/performance/expressionDiagnostics/actionabilityPerformance.performance.test.js

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Container } from '../../../src/dependencyInjection/container.js';
import { registerAllServices } from '../../../src/dependencyInjection/registrations/index.js';
import { tokens } from '../../../src/dependencyInjection/tokens/tokens-core.js';
import { diagnosticsTokens } from '../../../src/dependencyInjection/tokens/tokens-diagnostics.js';

describe('Actionability Performance Tests', () => {
  let container;
  let logger;
  let witnessSearcher;
  let orBlockAnalyzer;
  let editSetGenerator;
  let reportGenerator;
  let validator;

  // Performance thresholds (in milliseconds)
  const THRESHOLDS = {
    WITNESS_SEARCH_TARGET: 1000,
    WITNESS_SEARCH_MAX: 5000,
    EDIT_VALIDATION_TARGET: 100,
    EDIT_VALIDATION_MAX: 500,
    FULL_REPORT_TARGET: 2000,
    FULL_REPORT_MAX: 10000,
    OR_BLOCK_TARGET: 50,
    OR_BLOCK_MAX: 200,
  };

  beforeAll(() => {
    container = new Container();
    registerAllServices(container);

    logger = container.resolve(tokens.ILogger);
    witnessSearcher = container.resolve(diagnosticsTokens.IConstructiveWitnessSearcher);
    orBlockAnalyzer = container.resolve(diagnosticsTokens.IOrBlockAnalyzer);
    editSetGenerator = container.resolve(diagnosticsTokens.IEditSetGenerator);
    reportGenerator = container.resolve(diagnosticsTokens.IMonteCarloReportGenerator);
    validator = container.resolve(diagnosticsTokens.IImportanceSamplingValidator);
  });

  afterAll(() => {
    container.dispose();
  });

  describe('ConstructiveWitnessSearcher performance', () => {
    it('should complete within target time for standard simulation', () => {
      const simulationResult = generateLargeSimulationResult(5000);

      const start = performance.now();
      witnessSearcher.search(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Witness search completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.WITNESS_SEARCH_MAX);
    });

    it('should complete within target time for complex expression', () => {
      const simulationResult = generateComplexExpressionResult(20, 5000);

      const start = performance.now();
      witnessSearcher.search(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Complex witness search completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.WITNESS_SEARCH_MAX);
    });

    it('should respect timeout configuration', () => {
      const simulationResult = generateVeryLargeSimulationResult(50000);

      // With default 5000ms timeout, should not run forever
      const start = performance.now();
      const result = witnessSearcher.search(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Timeout test completed in ${elapsed.toFixed(2)}ms`);

      // Should complete within 2x timeout to account for overhead
      expect(elapsed).toBeLessThan(10000);
      expect(result.searchStats.timeMs).toBeDefined();
    });

    it('should scale linearly with sample count', () => {
      const smallResult = generateLargeSimulationResult(1000);
      const largeResult = generateLargeSimulationResult(5000);

      const startSmall = performance.now();
      witnessSearcher.search(smallResult);
      const elapsedSmall = performance.now() - startSmall;

      const startLarge = performance.now();
      witnessSearcher.search(largeResult);
      const elapsedLarge = performance.now() - startLarge;

      console.log(`Small (1000): ${elapsedSmall.toFixed(2)}ms, Large (5000): ${elapsedLarge.toFixed(2)}ms`);

      // Large should not be more than 10x slower (allowing for some non-linearity)
      const ratio = elapsedLarge / Math.max(elapsedSmall, 1);
      expect(ratio).toBeLessThan(10);
    });
  });

  describe('ImportanceSamplingValidator performance', () => {
    it('should validate proposals quickly', () => {
      const proposal = generateEditProposal();
      const samples = generateSamples(100);
      const context = generateExpressionContext();

      const start = performance.now();
      validator.validate(proposal, samples, context);
      const elapsed = performance.now() - start;

      console.log(`Single validation completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.EDIT_VALIDATION_MAX);
    });

    it('should handle batch validation efficiently', () => {
      const proposals = Array(10).fill(null).map(() => generateEditProposal());
      const samples = generateSamples(200);
      const context = generateExpressionContext();

      const start = performance.now();
      validator.validateBatch(proposals, samples, context);
      const elapsed = performance.now() - start;

      console.log(`Batch validation (10 proposals) completed in ${elapsed.toFixed(2)}ms`);

      // Batch should be less than 10x single (some overhead expected)
      expect(elapsed).toBeLessThan(THRESHOLDS.EDIT_VALIDATION_MAX * 10);
    });

    it('should scale with sample count', () => {
      const proposal = generateEditProposal();
      const context = generateExpressionContext();

      const smallSamples = generateSamples(50);
      const largeSamples = generateSamples(500);

      const startSmall = performance.now();
      validator.validate(proposal, smallSamples, context);
      const elapsedSmall = performance.now() - startSmall;

      const startLarge = performance.now();
      validator.validate(proposal, largeSamples, context);
      const elapsedLarge = performance.now() - startLarge;

      console.log(`Small (50): ${elapsedSmall.toFixed(2)}ms, Large (500): ${elapsedLarge.toFixed(2)}ms`);

      // Should scale roughly linearly
      const ratio = elapsedLarge / Math.max(elapsedSmall, 1);
      expect(ratio).toBeLessThan(20);
    });
  });

  describe('OrBlockAnalyzer performance', () => {
    it('should analyze single OR block quickly', () => {
      const orBlock = generateOrBlock(5);
      const simulationResult = { samples: [] };

      const start = performance.now();
      orBlockAnalyzer.analyze(orBlock, simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Single OR block analysis completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.OR_BLOCK_MAX);
    });

    it('should handle large OR blocks', () => {
      const orBlock = generateOrBlock(20);
      const simulationResult = { samples: [] };

      const start = performance.now();
      orBlockAnalyzer.analyze(orBlock, simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Large OR block (20 alts) analysis completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.OR_BLOCK_MAX * 4);
    });

    it('should analyze multiple OR blocks efficiently', () => {
      const orBlocks = Array(10).fill(null).map(() => generateOrBlock(5));
      const simulationResult = { samples: [] };

      const start = performance.now();
      orBlockAnalyzer.analyzeAll(orBlocks, simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Multiple OR blocks (10) analysis completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.OR_BLOCK_MAX * 10);
    });
  });

  describe('EditSetGenerator performance', () => {
    it('should generate edit set within target time', () => {
      const simulationResult = generateLargeSimulationResult(1000);

      const start = performance.now();
      editSetGenerator.generate(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Edit set generation completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.FULL_REPORT_TARGET);
    });

    it('should handle complex expressions', () => {
      const simulationResult = generateComplexExpressionResult(15, 2000);

      const start = performance.now();
      editSetGenerator.generate(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Complex edit set generation completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.FULL_REPORT_MAX);
    });
  });

  describe('Full report generation performance', () => {
    it('should generate complete report within target time', () => {
      const simulationResult = generateFullSimulationResult(3000);

      const start = performance.now();
      reportGenerator.generate(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Full report generation completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.FULL_REPORT_MAX);
    });

    it('should handle worst-case scenario', () => {
      // Zero trigger, many clauses, OR blocks, large sample size
      const simulationResult = generateWorstCaseSimulationResult();

      const start = performance.now();
      reportGenerator.generate(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Worst-case report generation completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(THRESHOLDS.FULL_REPORT_MAX);
    });

    it('should track performance metrics', () => {
      const simulationResult = generateFullSimulationResult(1000);
      const runs = [];

      // Run multiple times to get average
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        reportGenerator.generate(simulationResult);
        runs.push(performance.now() - start);
      }

      const avg = runs.reduce((a, b) => a + b) / runs.length;
      const min = Math.min(...runs);
      const max = Math.max(...runs);

      console.log(`Report generation: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);

      // Average should be within target
      expect(avg).toBeLessThan(THRESHOLDS.FULL_REPORT_TARGET);
    });
  });

  describe('memory efficiency', () => {
    it('should not accumulate memory across multiple runs', () => {
      const simulationResult = generateLargeSimulationResult(5000);

      // Run garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Run multiple times
      for (let i = 0; i < 10; i++) {
        reportGenerator.generate(simulationResult);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`Memory growth after 10 runs: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

      // Memory should not grow more than 50MB
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

// Helper functions

function generateLargeSimulationResult(sampleCount) {
  return {
    triggerRate: 0,
    sampleCount,
    expression: {
      clauses: [
        { id: 'clause1', threshold: 0.9, valuePath: 'mood' },
        { id: 'clause2', threshold: 0.8, valuePath: 'trust' },
        { id: 'clause3', threshold: 0.85, valuePath: 'energy' },
      ],
    },
    clauseStats: {
      clause1: { passCount: 100, lastMileFailures: 80 },
      clause2: { passCount: 200, lastMileFailures: 60 },
      clause3: { passCount: 150, lastMileFailures: 70 },
    },
    samples: generateSamples(sampleCount),
    orBlocks: [],
  };
}

function generateComplexExpressionResult(clauseCount, sampleCount) {
  const clauses = [];
  const clauseStats = {};

  for (let i = 0; i < clauseCount; i++) {
    const id = `clause_${i}`;
    clauses.push({
      id,
      threshold: 0.5 + Math.random() * 0.4,
      valuePath: `field_${i}`,
    });
    clauseStats[id] = {
      passCount: Math.floor(Math.random() * sampleCount * 0.3),
      lastMileFailures: Math.floor(Math.random() * 100),
    };
  }

  return {
    triggerRate: 0.001,
    sampleCount,
    expression: { clauses },
    clauseStats,
    samples: generateSamples(sampleCount),
    orBlocks: [generateOrBlock(5)],
  };
}

function generateVeryLargeSimulationResult(sampleCount) {
  return {
    triggerRate: 0,
    sampleCount,
    expression: {
      clauses: Array(30).fill(null).map((_, i) => ({
        id: `clause_${i}`,
        threshold: 0.9,
        valuePath: `field_${i}`,
      })),
    },
    clauseStats: {},
    samples: generateSamples(sampleCount),
    orBlocks: [],
  };
}

function generateFullSimulationResult(sampleCount) {
  return {
    triggerRate: 0.005,
    sampleCount,
    expression: {
      clauses: [
        { id: 'c1', threshold: 0.8, quantiles: { p90: 0.6, p95: 0.7 } },
        { id: 'c2', threshold: 0.75, quantiles: { p90: 0.55, p95: 0.65 } },
        { id: 'c3', threshold: 0.7, quantiles: { p90: 0.5, p95: 0.6 } },
      ],
    },
    clauseStats: {
      c1: { passCount: 200, lastMileFailures: 100 },
      c2: { passCount: 300, lastMileFailures: 80 },
      c3: { passCount: 400, lastMileFailures: 60 },
    },
    samples: generateSamples(sampleCount),
    orBlocks: [generateOrBlock(4), generateOrBlock(3)],
  };
}

function generateWorstCaseSimulationResult() {
  return {
    triggerRate: 0,
    sampleCount: 10000,
    expression: {
      clauses: Array(20).fill(null).map((_, i) => ({
        id: `clause_${i}`,
        threshold: 0.95,
        valuePath: `field_${i}`,
        quantiles: { p90: 0.5, p95: 0.6, p99: 0.7 },
      })),
    },
    clauseStats: Object.fromEntries(
      Array(20).fill(null).map((_, i) => [
        `clause_${i}`,
        { passCount: 10, lastMileFailures: 9 },
      ])
    ),
    samples: generateSamples(10000),
    orBlocks: Array(5).fill(null).map(() => generateOrBlock(10)),
  };
}

function generateSamples(count) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    const sample = {};
    for (let j = 0; j < 20; j++) {
      sample[`field_${j}`] = Math.random();
    }
    samples.push(sample);
  }
  return samples;
}

function generateOrBlock(alternativeCount) {
  const passCount = 100 + Math.floor(Math.random() * 200);
  return {
    id: `or_block_${Math.random().toString(36).slice(2)}`,
    description: 'Generated OR block',
    passCount,
    alternatives: Array(alternativeCount).fill(null).map((_, i) => ({
      id: `alt_${i}`,
      passCount: Math.floor(passCount * (0.8 - i * 0.1)),
      exclusivePasses: Math.floor(Math.random() * 50),
      threshold: 0.3 + i * 0.15,
    })),
  };
}

function generateEditProposal() {
  return {
    edits: [
      {
        clauseId: 'clause_0',
        editType: 'threshold',
        before: 0.8,
        after: 0.6,
        delta: -0.2,
      },
    ],
  };
}

function generateExpressionContext() {
  return {
    clauses: [
      { id: 'clause_0', threshold: 0.8, valuePath: 'field_0' },
      { id: 'clause_1', threshold: 0.7, valuePath: 'field_1' },
    ],
  };
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run performance tests
npm run test:performance -- --testPathPattern="actionabilityPerformance"

# Run with verbose output
npm run test:performance -- --testPathPattern="actionabilityPerformance" --verbose
```

### Performance Requirements

| Operation | Maximum Time |
|-----------|--------------|
| Witness search (5000 samples) | 5000ms |
| Edit validation (100 samples) | 500ms |
| Full report generation | 10000ms |
| Single OR block analysis | 200ms |

### Invariants That Must Remain True

1. All operations must complete within maximum time bounds
2. Memory usage must not grow unboundedly
3. Performance must scale reasonably with input size
4. Tests must be repeatable with consistent results

## Verification Commands

```bash
# Run performance tests
npm run test:performance -- --testPathPattern="actionabilityPerformance"

# Run with garbage collection exposed (optional)
node --expose-gc node_modules/.bin/jest tests/performance/expressionDiagnostics/actionabilityPerformance.performance.test.js

# Lint test file
npx eslint tests/performance/expressionDiagnostics/actionabilityPerformance.performance.test.js
```

## Estimated Diff Size

- `actionabilityPerformance.performance.test.js`: ~250 lines (new file)

**Total**: ~250 lines

## Definition of Done

- [x] Performance test file created
- [x] All performance tests pass within thresholds
- [x] Witness search performance verified
- [x] Validation performance verified
- [x] OR block analysis performance verified
- [x] EditSetGenerator performance verified
- [x] Memory efficiency verified
- [x] Baseline metrics established and documented
- [x] ESLint passes

## Outcome

### Implementation Summary

Created `tests/performance/expressionDiagnostics/actionabilityPerformance.performance.test.js` with 19 performance tests covering:

1. **ConstructiveWitnessSearcher** (5 tests)
   - Standard expression search: ~8ms
   - Complex expression search: ~8ms
   - Timeout configuration: ~107ms
   - Scaling with prerequisite count
   - Empty prerequisites handling

2. **ImportanceSamplingValidator** (4 tests)
   - Single proposal validation: ~4ms
   - Batch validation: ~8ms
   - Sample count scaling
   - Invalid input handling

3. **OrBlockAnalyzer** (4 tests)
   - Single OR block: ~1ms
   - Large OR blocks: ~1ms
   - Multiple blocks: ~1ms
   - Null input handling

4. **EditSetGenerator** (3 tests)
   - Standard generation: ~2ms
   - Complex simulation: ~5ms
   - Null simulation handling

5. **Combined Operations** (2 tests)
   - Full pipeline: ~6ms
   - Repeated analysis without degradation

6. **Memory Efficiency** (1 test)
   - No unbounded memory growth

### All Performance Thresholds Met

| Operation | Actual | Threshold |
|-----------|--------|-----------|
| Witness search | <10ms | <5000ms |
| Edit validation | <10ms | <500ms |
| OR block analysis | <5ms | <200ms |
| Edit set generation | <10ms | <5000ms |

### API Corrections Made

The original ticket template assumed incorrect API signatures. The actual APIs are:
- `ConstructiveWitnessSearcher.search(expression, moodConstraints, options)`
- `EditSetGenerator.generate(simulationResult, targetBand)`
- `ImportanceSamplingValidator.validate(proposal, samples, context)`
- `OrBlockAnalyzer.analyze(orBlock, simulationResult)`

### Test File Statistics

- Lines of code: ~460
- Test count: 19
- All tests passing
- ESLint clean
