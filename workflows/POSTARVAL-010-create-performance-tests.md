# POSTARVAL-010: Create Performance Tests

## Overview
Create performance benchmarks and tests to ensure the target validation system meets performance requirements, particularly the <15ms target for multi-target validation and linear scaling characteristics.

## Prerequisites
- POSTARVAL-001 through POSTARVAL-005: Core system complete
- POSTARVAL-008: Unit tests created
- POSTARVAL-009: Integration tests created

## Objectives
1. Benchmark validation performance for various scenarios
2. Verify linear scaling with target count
3. Test cache effectiveness
4. Measure pipeline overhead
5. Create performance regression guards

## Implementation Steps

### 1. Core Validation Performance Tests
Create `tests/performance/actions/targetValidationPerformance.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TargetComponentValidator } from '../../../src/actions/validation/TargetComponentValidator.js';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

describe('Target Validation Performance', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
    validator = new TargetComponentValidator({
      logger: testBed.getNullLogger(), // No logging overhead
      entityManager: testBed.getEntityManager()
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('single-target performance', () => {
    it('should validate single target in under 5ms', async () => {
      const actionDef = {
        forbidden_components: {
          target: ['comp:a', 'comp:b', 'comp:c', 'comp:d', 'comp:e']
        }
      };

      const targetEntity = testBed.createLargeEntity(100); // 100 components

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        validator.validateTargetComponents(actionDef, {
          target: targetEntity
        });
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(5);
      console.log(`Single target validation: ${avgTime.toFixed(3)}ms avg`);
    });

    it('should handle many forbidden components efficiently', async () => {
      // Create action with 50 forbidden components
      const forbiddenComponents = Array.from(
        { length: 50 },
        (_, i) => `comp:forbidden_${i}`
      );

      const actionDef = {
        forbidden_components: { target: forbiddenComponents }
      };

      const targetEntity = testBed.createLargeEntity(200);

      const start = performance.now();
      validator.validateTargetComponents(actionDef, { target: targetEntity });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('multi-target performance', () => {
    it('should validate 3 targets in under 15ms', async () => {
      const actionDef = {
        forbidden_components: {
          primary: ['comp:a', 'comp:b'],
          secondary: ['comp:c', 'comp:d'],
          tertiary: ['comp:e', 'comp:f']
        }
      };

      const targets = {
        primary: testBed.createLargeEntity(50),
        secondary: testBed.createLargeEntity(50),
        tertiary: testBed.createLargeEntity(50)
      };

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        validator.validateTargetComponents(actionDef, targets);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(15);
      console.log(`Three target validation: ${avgTime.toFixed(3)}ms avg`);
    });

    it('should scale linearly with target count', async () => {
      const actionDef = {
        forbidden_components: {
          primary: ['comp:forbidden'],
          secondary: ['comp:forbidden'],
          tertiary: ['comp:forbidden']
        }
      };

      // Measure 1 target
      const time1 = testBed.measureValidationTime(() => {
        validator.validateTargetComponents(actionDef, {
          primary: testBed.createLargeEntity(50)
        });
      }, 100);

      // Measure 2 targets
      const time2 = testBed.measureValidationTime(() => {
        validator.validateTargetComponents(actionDef, {
          primary: testBed.createLargeEntity(50),
          secondary: testBed.createLargeEntity(50)
        });
      }, 100);

      // Measure 3 targets
      const time3 = testBed.measureValidationTime(() => {
        validator.validateTargetComponents(actionDef, {
          primary: testBed.createLargeEntity(50),
          secondary: testBed.createLargeEntity(50),
          tertiary: testBed.createLargeEntity(50)
        });
      }, 100);

      // Check linear scaling (with some tolerance)
      const scalingFactor2 = time2 / time1;
      const scalingFactor3 = time3 / time1;

      expect(scalingFactor2).toBeGreaterThan(1.5);
      expect(scalingFactor2).toBeLessThan(2.5);
      expect(scalingFactor3).toBeGreaterThan(2.5);
      expect(scalingFactor3).toBeLessThan(3.5);

      console.log(`Scaling: 1 target=${time1.toFixed(3)}ms, 2 targets=${time2.toFixed(3)}ms, 3 targets=${time3.toFixed(3)}ms`);
    });
  });

  describe('component lookup performance', () => {
    it('should use O(1) lookups for component checking', async () => {
      const smallEntity = testBed.createLargeEntity(10);
      const largeEntity = testBed.createLargeEntity(1000);

      const actionDef = {
        forbidden_components: {
          target: ['comp:specific_forbidden']
        }
      };

      // Time with small entity
      const smallTime = testBed.measureValidationTime(() => {
        validator.validateTargetComponents(actionDef, { target: smallEntity });
      }, 1000);

      // Time with large entity (should be similar due to O(1) lookup)
      const largeTime = testBed.measureValidationTime(() => {
        validator.validateTargetComponents(actionDef, { target: largeEntity });
      }, 1000);

      // Times should be similar (within 2x) if using hash lookups
      const ratio = largeTime / smallTime;
      expect(ratio).toBeLessThan(2);

      console.log(`O(1) verification: 10 components=${smallTime.toFixed(3)}ms, 1000 components=${largeTime.toFixed(3)}ms, ratio=${ratio.toFixed(2)}`);
    });
  });
});
```

### 2. Pipeline Performance Tests
Create `tests/performance/actions/pipelineValidationPerformance.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

describe('Pipeline Validation Performance', () => {
  let testBed;
  let pipeline;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
    pipeline = testBed.getService('IActionPipeline');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('pipeline overhead', () => {
    it('should process 100 actions in under 50ms', async () => {
      const actions = testBed.generateManyActions(100);

      const start = performance.now();
      await pipeline.process(actions, {});
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      console.log(`Pipeline processed 100 actions in ${duration.toFixed(2)}ms`);
    });

    it('should add minimal overhead for target validation', async () => {
      const actions = testBed.generateManyActions(100);

      // Measure without target validation
      testBed.disableTargetValidation();
      const baseTime = testBed.measurePipelineTime(actions, 10);

      // Measure with target validation
      testBed.enableTargetValidation();
      const validationTime = testBed.measurePipelineTime(actions, 10);

      const overhead = ((validationTime - baseTime) / baseTime) * 100;

      expect(overhead).toBeLessThan(5); // Less than 5% overhead
      console.log(`Target validation overhead: ${overhead.toFixed(2)}%`);
    });
  });

  describe('action discovery performance', () => {
    it('should discover actions with validation in reasonable time', async () => {
      const scenario = testBed.createLargeScenario(50); // 50 entities

      const start = performance.now();
      const actions = await testBed.discoverActionsForAll(scenario.entities);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500); // 500ms for 50 entities
      console.log(`Discovered actions for 50 entities in ${duration.toFixed(2)}ms`);
    });
  });
});
```

### 3. Cache Effectiveness Tests
Create `tests/performance/actions/validationCachePerformance.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

describe('Validation Cache Performance', () => {
  let testBed;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('cache effectiveness', () => {
    it('should cache validation results effectively', async () => {
      const validator = testBed.getCachingValidator();

      const actionDef = {
        forbidden_components: {
          target: ['comp:forbidden']
        }
      };

      const target = testBed.createLargeEntity(100);

      // First validation (cache miss)
      const firstTime = testBed.measureValidationTime(() => {
        validator.validateTargetComponents(actionDef, { target });
      }, 1);

      // Subsequent validations (cache hits)
      const cachedTime = testBed.measureValidationTime(() => {
        validator.validateTargetComponents(actionDef, { target });
      }, 100);

      // Cached should be significantly faster
      expect(cachedTime).toBeLessThan(firstTime * 0.1);
      console.log(`Cache speedup: ${(firstTime / cachedTime).toFixed(2)}x`);
    });

    it('should handle cache invalidation properly', async () => {
      const validator = testBed.getCachingValidator();

      const actionDef = {
        forbidden_components: {
          target: ['comp:forbidden']
        }
      };

      const target = testBed.createEntity('target1');

      // Initial validation
      validator.validateTargetComponents(actionDef, { target });

      // Modify entity (should invalidate cache)
      testBed.addComponent(target.id, 'comp:forbidden', {});

      // Re-validate (should detect change)
      const result = validator.validateTargetComponents(actionDef, { target });

      expect(result.valid).toBe(false);
    });
  });
});
```

### 4. Memory Usage Tests
Create `tests/performance/actions/validationMemoryUsage.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

describe('Validation Memory Usage', () => {
  let testBed;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
    if (global.gc) global.gc(); // Force garbage collection if available
  });

  afterEach(() => {
    testBed.cleanup();
    if (global.gc) global.gc();
  });

  it('should not leak memory during repeated validations', async () => {
    const validator = testBed.getValidator();

    const initialMemory = process.memoryUsage().heapUsed;

    // Perform many validations
    for (let i = 0; i < 10000; i++) {
      const actionDef = {
        forbidden_components: {
          target: [`comp:${i}`]
        }
      };

      const target = testBed.createEntity(`target_${i}`);
      validator.validateTargetComponents(actionDef, { target });
    }

    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

    expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
  });
});
```

### 5. Performance Regression Guards
Create `tests/performance/actions/performanceRegression.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { loadPerformanceBaseline, savePerformanceResults } from '../../common/performanceBaseline.js';

describe('Performance Regression Guards', () => {
  const baseline = loadPerformanceBaseline();

  it('should not regress single target validation', async () => {
    const currentPerformance = await measureCurrentPerformance('singleTarget');

    if (baseline.singleTarget) {
      const regression = ((currentPerformance - baseline.singleTarget) / baseline.singleTarget) * 100;

      expect(regression).toBeLessThan(10); // Allow 10% variance

      if (regression > 5) {
        console.warn(`Performance regression detected: ${regression.toFixed(2)}%`);
      }
    }

    savePerformanceResults('singleTarget', currentPerformance);
  });

  it('should not regress multi-target validation', async () => {
    const currentPerformance = await measureCurrentPerformance('multiTarget');

    if (baseline.multiTarget) {
      const regression = ((currentPerformance - baseline.multiTarget) / baseline.multiTarget) * 100;

      expect(regression).toBeLessThan(10);
    }

    savePerformanceResults('multiTarget', currentPerformance);
  });

  it('should not regress pipeline throughput', async () => {
    const currentPerformance = await measureCurrentPerformance('pipelineThroughput');

    if (baseline.pipelineThroughput) {
      expect(currentPerformance).toBeGreaterThan(baseline.pipelineThroughput * 0.9);
    }

    savePerformanceResults('pipelineThroughput', currentPerformance);
  });
});
```

## Success Criteria
- [ ] Single target validation <5ms
- [ ] Three target validation <15ms
- [ ] Linear scaling verified
- [ ] Pipeline overhead <5%
- [ ] O(1) component lookups confirmed
- [ ] No memory leaks detected
- [ ] Performance regression guards in place

## Files to Create
- `tests/performance/actions/targetValidationPerformance.test.js`
- `tests/performance/actions/pipelineValidationPerformance.test.js`
- `tests/performance/actions/validationCachePerformance.test.js`
- `tests/performance/actions/validationMemoryUsage.test.js`
- `tests/performance/actions/performanceRegression.test.js`

## Dependencies
- Core system implemented (POSTARVAL-001 through 005)
- Test infrastructure available

## Estimated Time
4-5 hours

## Notes
- Run with `--expose-gc` flag for memory tests
- Consider using performance profiling tools
- Establish baseline metrics for regression testing
- Monitor performance in CI/CD pipeline