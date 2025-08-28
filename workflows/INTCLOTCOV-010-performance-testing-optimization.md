# INTCLOTCOV-010: Performance Testing and Optimization

**Phase**: 3 - Testing & Validation  
**Priority**: High  
**Effort**: 2 days  
**Dependencies**: INTCLOTCOV-008 (Unit tests), INTCLOTCOV-009 (Integration tests)

## Summary

Conduct comprehensive performance testing of the coverage resolution system to ensure it meets performance requirements, identify bottlenecks, and implement optimizations to maintain acceptable performance in production scenarios.

## Problem Statement

The coverage resolution system adds complexity to clothing resolution with candidate collection, priority calculation, and filtering operations. Performance testing is needed to ensure the system meets the specified requirements (<50% increase in resolution time) and performs well under realistic game conditions.

## Technical Requirements

### 1. Performance Test Suite Structure

**Primary Test File**: `tests/performance/scopeDsl/coverageResolutionPerformance.test.js`

**Test Categories**:

- Baseline Performance Measurement
- Coverage Resolution Performance
- Scaling Performance Tests
- Memory Usage Tests
- Cache Efficiency Tests
- Optimization Validation Tests

### 2. Baseline Performance Measurement

```javascript
describe('Coverage Resolution Performance', () => {
  let testBed, resolver, performanceTracker;

  beforeAll(() => {
    testBed = createTestBed();
    performanceTracker = new PerformanceTracker();
    resolver = testBed.createSlotAccessResolver();
  });

  describe('Baseline Measurements', () => {
    it('should establish legacy resolution baseline', async () => {
      const scenarios = [
        { name: 'simple', itemCount: 1 },
        { name: 'moderate', itemCount: 5 },
        { name: 'complex', itemCount: 15 },
      ];

      const baselines = {};

      for (const scenario of scenarios) {
        const equipment = generateEquipment(scenario.itemCount, {
          noCoverage: true,
        });
        const character = await testBed.createCharacter({ equipment });

        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          await resolver.resolve(
            { field: 'torso_lower' },
            { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
            {}
          );
        }

        const avgTime = (performance.now() - startTime) / 1000;
        baselines[scenario.name] = avgTime;

        console.log(
          `Legacy Baseline - ${scenario.name}: ${avgTime.toFixed(3)}ms avg`
        );
      }

      // Store baselines for comparison tests
      performanceTracker.setBaselines(baselines);

      // Validate baseline performance
      expect(baselines.simple).toBeLessThan(2); // 2ms for simple
      expect(baselines.moderate).toBeLessThan(5); // 5ms for moderate
      expect(baselines.complex).toBeLessThan(15); // 15ms for complex
    });

    it('should measure coverage resolution performance', async () => {
      const scenarios = [
        { name: 'simple', itemCount: 1, coverageItems: 1 },
        { name: 'moderate', itemCount: 5, coverageItems: 3 },
        { name: 'complex', itemCount: 15, coverageItems: 8 },
      ];

      const coverageResults = {};

      for (const scenario of scenarios) {
        const equipment = generateEquipment(scenario.itemCount, {
          coverageItems: scenario.coverageItems,
        });
        const character = await testBed.createCharacter({ equipment });

        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          await resolver.resolve(
            { field: 'torso_lower' },
            { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
            {}
          );
        }

        const avgTime = (performance.now() - startTime) / 1000;
        coverageResults[scenario.name] = avgTime;

        console.log(
          `Coverage Resolution - ${scenario.name}: ${avgTime.toFixed(3)}ms avg`
        );
      }

      performanceTracker.setCoverageResults(coverageResults);

      // Validate coverage performance vs baseline
      const baselines = performanceTracker.getBaselines();

      Object.keys(coverageResults).forEach((scenario) => {
        const increase =
          ((coverageResults[scenario] - baselines[scenario]) /
            baselines[scenario]) *
          100;
        console.log(
          `Performance increase for ${scenario}: ${increase.toFixed(1)}%`
        );

        // Should not exceed 50% increase
        expect(increase).toBeLessThan(50);
      });
    });
  });
});
```

### 3. Scaling Performance Tests

```javascript
describe('Scaling Performance', () => {
  it('should scale linearly with number of equipped items', async () => {
    const itemCounts = [1, 5, 10, 20, 30, 50];
    const results = [];

    for (const itemCount of itemCounts) {
      const equipment = generateEquipment(itemCount, {
        coverageItems: itemCount / 2,
      });
      const character = await testBed.createCharacter({ equipment });

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        await resolver.resolve(
          { field: 'torso_lower' },
          { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
          {}
        );
      }

      const avgTime = (performance.now() - startTime) / 100;
      results.push({ itemCount, avgTime });

      console.log(`${itemCount} items: ${avgTime.toFixed(3)}ms avg`);
    }

    // Check for roughly linear scaling (not exponential)
    const smallScale = results.find((r) => r.itemCount === 5).avgTime;
    const largeScale = results.find((r) => r.itemCount === 50).avgTime;
    const scalingFactor = largeScale / smallScale;

    // Should scale roughly linearly (factor of ~10 for 10x items)
    expect(scalingFactor).toBeLessThan(15); // Allow some non-linearity
    expect(largeScale).toBeLessThan(100); // Should still complete in reasonable time
  });

  it('should handle concurrent resolution requests efficiently', async () => {
    const characters = [];

    // Create 50 characters with different equipment
    for (let i = 0; i < 50; i++) {
      const equipment = generateEquipment(10, {
        coverageItems: 5,
        variety: true,
      });
      characters.push(await testBed.createCharacter({ equipment }));
    }

    const startTime = performance.now();

    // Resolve clothing for all characters concurrently
    const promises = characters.map((char) =>
      resolver.resolve(
        { field: 'torso_lower' },
        { getValue: () => ({ entityId: char.id, mode: 'topmost' }) },
        {}
      )
    );

    await Promise.all(promises);

    const totalTime = performance.now() - startTime;
    const avgTimePerCharacter = totalTime / characters.length;

    console.log(
      `Concurrent resolution: ${totalTime.toFixed(1)}ms total, ${avgTimePerCharacter.toFixed(3)}ms avg per character`
    );

    expect(totalTime).toBeLessThan(5000); // Complete in under 5 seconds
    expect(avgTimePerCharacter).toBeLessThan(20); // Reasonable per-character time
  });
});
```

### 4. Memory Usage Tests

```javascript
describe('Memory Usage', () => {
  it('should maintain stable memory usage', async () => {
    const equipment = generateEquipment(20, { coverageItems: 10 });
    const character = await testBed.createCharacter({ equipment });

    // Force garbage collection to get clean baseline
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;

    // Perform many resolutions
    for (let i = 0; i < 10000; i++) {
      await resolver.resolve(
        { field: 'torso_lower' },
        { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
        {}
      );

      // Periodic memory check
      if (i % 1000 === 0) {
        const currentMemory = process.memoryUsage().heapUsed;
        const increase = currentMemory - initialMemory;

        // Memory increase should be reasonable
        expect(increase).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      }
    }

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const totalIncrease = finalMemory - initialMemory;

    console.log(
      `Memory increase after 10k resolutions: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`
    );

    // Should not have significant memory leak
    expect(totalIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB
  });

  it('should handle cache size limits properly', async () => {
    // Fill priority calculation cache beyond limits
    const cacheTestData = [];

    for (let i = 0; i < 2000; i++) {
      // Exceed typical cache limit
      const priority = `priority_${i % 10}`;
      const layer = `layer_${i % 8}`;
      cacheTestData.push([priority, layer]);
    }

    const startTime = performance.now();

    cacheTestData.forEach(([priority, layer]) => {
      calculateCoveragePriority(priority, layer);
    });

    const cacheTime = performance.now() - startTime;

    // Should handle cache overflow gracefully
    expect(cacheTime).toBeLessThan(1000); // Complete in reasonable time

    // Check cache size is reasonable
    const cacheSize = PRIORITY_SCORE_CACHE.size;
    expect(cacheSize).toBeLessThan(1500); // Should have reasonable limit
  });
});
```

### 5. Cache Efficiency Tests

```javascript
describe('Cache Efficiency', () => {
  it('should achieve high cache hit rates in typical scenarios', async () => {
    const equipment = generateEquipment(10, { coverageItems: 5 });
    const characters = [];

    // Create multiple characters with similar equipment patterns
    for (let i = 0; i < 20; i++) {
      characters.push(await testBed.createCharacter({ equipment }));
    }

    // Clear cache to start fresh
    PRIORITY_SCORE_CACHE.clear();

    const cacheTracker = new CacheEfficiencyTracker();

    // Perform resolutions with cache tracking
    for (const character of characters) {
      const trace = {};
      await resolver.resolve(
        { field: 'torso_lower' },
        { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
        trace
      );

      if (trace.coverageResolution?.priorityCalculation) {
        cacheTracker.record(trace.coverageResolution.priorityCalculation);
      }
    }

    const efficiency = cacheTracker.getEfficiency();
    console.log(`Cache efficiency: ${(efficiency * 100).toFixed(1)}% hit rate`);

    // Should achieve good cache efficiency with similar equipment
    expect(efficiency).toBeGreaterThan(0.7); // >70% hit rate
  });

  it('should provide performance benefit from caching', async () => {
    const equipment = generateEquipment(15, { coverageItems: 8 });
    const character = await testBed.createCharacter({ equipment });

    // Test without caching (clear cache each time)
    let noCacheTime = 0;
    for (let i = 0; i < 100; i++) {
      PRIORITY_SCORE_CACHE.clear();
      const startTime = performance.now();

      await resolver.resolve(
        { field: 'torso_lower' },
        { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
        {}
      );

      noCacheTime += performance.now() - startTime;
    }
    noCacheTime /= 100;

    // Test with caching (warm cache)
    let cacheTime = 0;
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now();

      await resolver.resolve(
        { field: 'torso_lower' },
        { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
        {}
      );

      cacheTime += performance.now() - startTime;
    }
    cacheTime /= 100;

    const improvement = ((noCacheTime - cacheTime) / noCacheTime) * 100;
    console.log(`Cache performance improvement: ${improvement.toFixed(1)}%`);

    // Caching should provide measurable improvement
    expect(improvement).toBeGreaterThan(20); // >20% improvement
    expect(cacheTime).toBeLessThan(noCacheTime);
  });
});
```

### 6. Optimization Validation Tests

```javascript
describe('Optimization Validation', () => {
  it('should skip coverage resolution for simple cases', async () => {
    // Test optimization that uses legacy resolution for simple cases
    const simpleEquipment = {
      torso_lower: { underwear: 'clothing:panties' },
    };

    const character = await testBed.createCharacter({
      equipment: simpleEquipment,
    });

    const trace = {};
    await resolver.resolve(
      { field: 'torso_lower' },
      { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
      trace
    );

    // Should use optimized path for simple case
    expect(trace.coverageResolution?.strategy).toBe('legacy');
  });

  it('should use coverage resolution for complex cases', async () => {
    const complexEquipment = generateEquipment(10, { coverageItems: 5 });
    const character = await testBed.createCharacter({
      equipment: complexEquipment,
    });

    const trace = {};
    await resolver.resolve(
      { field: 'torso_lower' },
      { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
      trace
    );

    // Should use coverage resolution for complex case
    expect(trace.coverageResolution?.strategy).toBe('coverage');
  });

  it('should maintain performance with tracing disabled', async () => {
    const equipment = generateEquipment(15, { coverageItems: 8 });
    const character = await testBed.createCharacter({ equipment });

    // Test with tracing enabled
    let tracingTime = 0;
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now();
      const trace = {};

      await resolver.resolve(
        { field: 'torso_lower' },
        { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
        trace
      );

      tracingTime += performance.now() - startTime;
    }
    tracingTime /= 100;

    // Test with tracing disabled
    let noTracingTime = 0;
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now();

      await resolver.resolve(
        { field: 'torso_lower' },
        { getValue: () => ({ entityId: character.id, mode: 'topmost' }) },
        null // No trace object
      );

      noTracingTime += performance.now() - startTime;
    }
    noTracingTime /= 100;

    const overhead = ((tracingTime - noTracingTime) / noTracingTime) * 100;
    console.log(`Tracing overhead: ${overhead.toFixed(1)}%`);

    // Tracing overhead should be minimal
    expect(overhead).toBeLessThan(30); // <30% overhead acceptable
  });
});
```

### 7. Performance Utilities

```javascript
/**
 * Generate equipment configurations for performance testing
 */
function generateEquipment(totalItems, options = {}) {
  const { coverageItems = 0, noCoverage = false, variety = false } = options;
  const equipment = { equipped: {} };

  const slots = ['torso_upper', 'torso_lower', 'legs', 'feet', 'hands'];
  const layers = ['outer', 'base', 'underwear', 'accessories'];

  let itemCount = 0;
  let coverageCount = 0;

  for (const slot of slots) {
    if (itemCount >= totalItems) break;

    equipment.equipped[slot] = {};

    for (const layer of layers) {
      if (itemCount >= totalItems) break;

      const itemId = `test_item_${itemCount}`;
      equipment.equipped[slot][layer] = itemId;

      // Configure mock coverage mapping
      if (!noCoverage && coverageCount < coverageItems) {
        const coverageSlot = variety
          ? slots[Math.floor(Math.random() * slots.length)]
          : 'torso_lower';

        mockEntitiesGateway.getComponentData.mockReturnValueOnce({
          covers: [coverageSlot],
          coveragePriority: layer === 'outer' ? 'outer' : 'base',
        });

        coverageCount++;
      } else {
        mockEntitiesGateway.getComponentData.mockReturnValueOnce(null);
      }

      itemCount++;
    }
  }

  return equipment;
}

/**
 * Performance tracking utility
 */
class PerformanceTracker {
  constructor() {
    this.baselines = {};
    this.coverageResults = {};
  }

  setBaselines(baselines) {
    this.baselines = baselines;
  }

  setCoverageResults(results) {
    this.coverageResults = results;
  }

  getBaselines() {
    return this.baselines;
  }

  getPerformanceIncrease(scenario) {
    const baseline = this.baselines[scenario];
    const coverage = this.coverageResults[scenario];

    if (!baseline || !coverage) return null;

    return ((coverage - baseline) / baseline) * 100;
  }
}

/**
 * Cache efficiency tracking
 */
class CacheEfficiencyTracker {
  constructor() {
    this.hits = 0;
    this.misses = 0;
  }

  record(priorityCalculationTrace) {
    this.hits += priorityCalculationTrace.cacheHits || 0;
    this.misses += priorityCalculationTrace.cacheMisses || 0;
  }

  getEfficiency() {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
}
```

## Implementation Details

### Performance Test Configuration

```javascript
const PERFORMANCE_CONFIG = {
  warmupRuns: 10, // Runs before measurement
  measurementRuns: 1000, // Runs for measurement
  memoryCheckInterval: 100, // Check memory every N runs
  timeoutMs: 30000, // Test timeout
  gcBetweenTests: true, // Force GC between tests
};
```

### Performance Targets

- **Simple Cases**: <2ms average (1 item)
- **Moderate Cases**: <5ms average (5 items)
- **Complex Cases**: <15ms average (15 items)
- **Coverage Overhead**: <50% increase vs legacy
- **Memory Usage**: <20MB increase after 10k operations
- **Cache Hit Rate**: >70% in typical scenarios

## Acceptance Criteria

- [ ] Performance tests validate all specified timing requirements
- [ ] Coverage resolution overhead is <50% vs legacy resolution
- [ ] Memory usage remains stable with no significant leaks
- [ ] Cache efficiency achieves >70% hit rate in typical scenarios
- [ ] Scaling performance is roughly linear with equipment complexity
- [ ] Concurrent resolution performance is acceptable
- [ ] Optimization paths work correctly (simple vs complex cases)
- [ ] Tracing overhead is <30% when enabled
- [ ] All performance tests complete reliably
- [ ] Performance regression detection is in place

## Testing Requirements

### Performance Benchmarks

- Baseline measurements for comparison
- Coverage resolution performance measurements
- Memory usage monitoring
- Cache efficiency tracking
- Scaling behavior validation

### Test Environment

- Use performance test configuration
- Ensure consistent test environment
- Account for system performance variations
- Use statistical averaging for reliable measurements

## Files Created

- `tests/performance/scopeDsl/coverageResolutionPerformance.test.js`
- `tests/performance/scopeDsl/performanceTestUtilities.js`

## Files Modified

None (performance testing only)

## Notes

### Performance Testing Methodology

1. **Baseline First**: Establish legacy performance baseline
2. **Controlled Comparison**: Compare coverage vs legacy under same conditions
3. **Statistical Validity**: Use sufficient sample sizes for reliable measurements
4. **Environment Control**: Account for system performance variations
5. **Regression Detection**: Track performance changes over time

### Optimization Opportunities

If performance targets are not met:

1. **Candidate Collection**: Optimize item enumeration
2. **Priority Calculation**: Improve caching strategies
3. **Mode Filtering**: Optimize filtering algorithms
4. **Early Termination**: Skip expensive operations when possible
5. **Memory Management**: Reduce object allocation

### Monitoring Integration

- Performance metrics collection for production monitoring
- Alerts for performance regressions
- Periodic performance validation in CI/CD
- Performance dashboard for tracking trends

## Next Steps

After completion, this enables:

- INTCLOTCOV-011: Documentation with performance characteristics
- Production deployment with confidence in performance
- Ongoing performance monitoring and optimization

## Risk Assessment

**Medium Risk** - Performance requirements must be met for production viability.

**Potential Issues**:

- Performance targets not achievable with current implementation
- Memory leaks or excessive memory usage
- Unacceptable overhead for simple cases
- Cache efficiency lower than expected

**Mitigation**:

- Comprehensive testing across various scenarios
- Performance optimization strategies ready for implementation
- Feature flags to disable coverage resolution if needed
- Monitoring and alerting for production performance tracking
