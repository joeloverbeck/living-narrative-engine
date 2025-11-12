# ARMSYSANA-010: Performance Testing

**Phase**: Phase 4 - Testing with Real Scenarios
**Priority**: Medium
**Risk Level**: Low (Testing only)
**Estimated Effort**: 60 minutes

## Context

Adding a fifth clothing layer (armor) introduces additional complexity to the coverage resolution system. It's essential to verify that:
1. Coverage resolution performance remains acceptable
2. No performance degradation with multiple armored characters
3. Large equipment sets (5 layers) don't cause slowdowns
4. Action text generation with armor is performant

## Objective

Run performance tests to ensure the armor layer addition doesn't introduce unacceptable performance degradation. Identify any performance bottlenecks and verify they are within acceptable limits.

## Performance Baselines

Before testing, establish baselines:

### Baseline 1: Coverage Resolution (4 Layers)

**Scenario**: Character with 4-layer equipment (underwear, base, outer, accessories)

**Metric**: Time to resolve coverage for all body slots

**Expected**: < 5ms per character

### Baseline 2: Action Text Generation (4 Layers)

**Scenario**: Generate action text for character with 4-layer equipment

**Metric**: Time to generate action description

**Expected**: < 10ms per action

### Baseline 3: Multi-Character Scene (4 Layers)

**Scenario**: Scene with 10 characters, each with 4-layer equipment

**Metric**: Time to resolve all character coverage

**Expected**: < 50ms total

## Performance Tests to Run

### Test 1: Coverage Resolution with Armor (5 Layers)

**Test File**: `tests/performance/clothing/armor-coverage-resolution.performance.test.js`

```javascript
describe('Coverage Resolution Performance with Armor', () => {
  const ITERATIONS = 1000;
  const MAX_TIME_PER_RESOLUTION = 5; // ms

  it('should resolve coverage with armor in < 5ms', () => {
    const character = createFullyEquippedCharacter({
      underwear: true,
      base: true,
      armor: true,
      outer: true,
      accessories: true,
    });

    const startTime = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      resolveCoverage(character.id);
    }

    const endTime = performance.now();
    const averageTime = (endTime - startTime) / ITERATIONS;

    expect(averageTime).toBeLessThan(MAX_TIME_PER_RESOLUTION);

    console.log(`Average coverage resolution time: ${averageTime.toFixed(3)}ms`);
  });

  it('should not degrade significantly vs 4-layer system', () => {
    const fourLayerChar = createFullyEquippedCharacter({
      underwear: true,
      base: true,
      outer: true,
      accessories: true,
    });

    const fiveLayerChar = createFullyEquippedCharacter({
      underwear: true,
      base: true,
      armor: true,
      outer: true,
      accessories: true,
    });

    const fourLayerTime = measureCoverageResolution(fourLayerChar.id, ITERATIONS);
    const fiveLayerTime = measureCoverageResolution(fiveLayerChar.id, ITERATIONS);

    const degradation = ((fiveLayerTime - fourLayerTime) / fourLayerTime) * 100;

    expect(degradation).toBeLessThan(5); // < 5% degradation

    console.log(`4-layer avg: ${fourLayerTime.toFixed(3)}ms`);
    console.log(`5-layer avg: ${fiveLayerTime.toFixed(3)}ms`);
    console.log(`Degradation: ${degradation.toFixed(2)}%`);
  });
});
```

### Test 2: Priority Calculation Performance

**Test File**: `tests/performance/clothing/armor-priority-calculation.performance.test.js`

```javascript
describe('Priority Calculation Performance with Armor', () => {
  const ITERATIONS = 10000;
  const MAX_TIME_PER_CALCULATION = 0.1; // ms

  it('should calculate armor priority quickly', () => {
    const layers = ['underwear', 'base', 'armor', 'outer', 'accessories'];

    const startTime = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      for (const layer of layers) {
        calculateLayerPriority(layer);
      }
    }

    const endTime = performance.now();
    const averageTime = (endTime - startTime) / (ITERATIONS * layers.length);

    expect(averageTime).toBeLessThan(MAX_TIME_PER_CALCULATION);

    console.log(`Average priority calculation time: ${averageTime.toFixed(4)}ms`);
  });

  it('should use constant-time lookup for priorities', () => {
    // Priority lookup should be O(1), not O(n)
    const layers = ['underwear', 'base', 'armor', 'outer', 'accessories'];

    const times = layers.map(layer => {
      const start = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        calculateLayerPriority(layer);
      }
      const end = performance.now();
      return (end - start) / ITERATIONS;
    });

    // All times should be similar (within 20% of each other)
    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const maxDeviation = Math.max(...times.map(t => Math.abs(t - avgTime) / avgTime));

    expect(maxDeviation).toBeLessThan(0.2); // < 20% deviation
  });
});
```

### Test 3: Action Text Generation with Armor

**Test File**: `tests/performance/clothing/armor-action-text.performance.test.js`

```javascript
describe('Action Text Generation Performance with Armor', () => {
  const ITERATIONS = 500;
  const MAX_TIME_PER_ACTION = 10; // ms

  it('should generate action text with armor in < 10ms', () => {
    const armoredCharacter = createFullyArmoredKnight();

    const startTime = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      generateActionText(armoredCharacter.id, 'walk', { direction: 'north' });
    }

    const endTime = performance.now();
    const averageTime = (endTime - startTime) / ITERATIONS;

    expect(averageTime).toBeLessThan(MAX_TIME_PER_ACTION);

    console.log(`Average action text generation time: ${averageTime.toFixed(3)}ms`);
  });

  it('should not significantly impact text generation vs non-armored', () => {
    const armoredChar = createFullyArmoredKnight();
    const unArmoredChar = createCivilian();

    const armoredTime = measureActionGeneration(armoredChar.id, ITERATIONS);
    const unArmoredTime = measureActionGeneration(unArmoredChar.id, ITERATIONS);

    const overhead = ((armoredTime - unArmoredTime) / unArmoredTime) * 100;

    expect(overhead).toBeLessThan(10); // < 10% overhead

    console.log(`Unarmored avg: ${unArmoredTime.toFixed(3)}ms`);
    console.log(`Armored avg: ${armoredTime.toFixed(3)}ms`);
    console.log(`Overhead: ${overhead.toFixed(2)}%`);
  });
});
```

### Test 4: Multi-Character Performance

**Test File**: `tests/performance/clothing/armor-multi-character.performance.test.js`

```javascript
describe('Multi-Character Performance with Armor', () => {
  const CHARACTER_COUNTS = [5, 10, 20, 50];
  const MAX_TIME_PER_CHARACTER = 10; // ms

  CHARACTER_COUNTS.forEach(count => {
    it(`should handle ${count} armored characters efficiently`, () => {
      const characters = [];
      for (let i = 0; i < count; i++) {
        characters.push(createFullyArmoredKnight(`Knight${i}`));
      }

      const startTime = performance.now();

      for (const character of characters) {
        resolveCoverage(character.id);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / count;

      expect(averageTime).toBeLessThan(MAX_TIME_PER_CHARACTER);

      console.log(`${count} characters: ${totalTime.toFixed(2)}ms total, ${averageTime.toFixed(2)}ms avg`);
    });
  });

  it('should scale linearly with character count', () => {
    const measurements = CHARACTER_COUNTS.map(count => {
      const characters = [];
      for (let i = 0; i < count; i++) {
        characters.push(createFullyArmoredKnight(`Knight${i}`));
      }

      const startTime = performance.now();
      for (const character of characters) {
        resolveCoverage(character.id);
      }
      const endTime = performance.now();

      return {
        count,
        time: endTime - startTime,
        avgPerChar: (endTime - startTime) / count,
      };
    });

    // Calculate if scaling is linear (O(n) not O(n^2))
    const avgPerCharValues = measurements.map(m => m.avgPerChar);
    const avgValue = avgPerCharValues.reduce((a, b) => a + b) / avgPerCharValues.length;
    const maxDeviation = Math.max(...avgPerCharValues.map(v => Math.abs(v - avgValue) / avgValue));

    expect(maxDeviation).toBeLessThan(0.5); // < 50% deviation (linear scaling)

    console.log('Scaling measurements:', measurements);
    console.log(`Max deviation from linear: ${(maxDeviation * 100).toFixed(2)}%`);
  });
});
```

### Test 5: Equipment Change Performance

**Test File**: `tests/performance/clothing/armor-equipment-changes.performance.test.js`

```javascript
describe('Equipment Change Performance with Armor', () => {
  const ITERATIONS = 1000;
  const MAX_TIME_PER_EQUIP = 2; // ms

  it('should equip armor quickly', () => {
    const character = createCharacter({ name: 'Test' });

    const startTime = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      equipItem(character.id, 'armor:steel_cuirass');
      unequipItem(character.id, 'armor:steel_cuirass');
    }

    const endTime = performance.now();
    const averageTime = (endTime - startTime) / (ITERATIONS * 2); // equip + unequip

    expect(averageTime).toBeLessThan(MAX_TIME_PER_EQUIP);

    console.log(`Average equip/unequip time: ${averageTime.toFixed(3)}ms`);
  });

  it('should handle rapid equipment changes', () => {
    const character = createCharacter({ name: 'Test' });
    const armorPieces = [
      'armor:steel_cuirass',
      'armor:leather_bracers',
      'armor:iron_helmet',
      'armor:leather_boots',
      'armor:steel_gauntlets',
    ];

    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      // Equip all
      for (const armor of armorPieces) {
        equipItem(character.id, armor);
      }
      // Unequip all
      for (const armor of armorPieces) {
        unequipItem(character.id, armor);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(2000); // < 2 seconds for 100 full cycles

    console.log(`Rapid equipment changes: ${totalTime.toFixed(2)}ms for 100 cycles`);
  });
});
```

### Test 6: Memory Usage

**Test File**: `tests/performance/clothing/armor-memory-usage.performance.test.js`

```javascript
describe('Memory Usage with Armor', () => {
  it('should not leak memory with repeated coverage resolution', () => {
    const character = createFullyArmoredKnight();

    const initialMemory = getMemoryUsage();

    // Resolve coverage many times
    for (let i = 0; i < 10000; i++) {
      resolveCoverage(character.id);
    }

    // Force garbage collection if available
    if (global.gc) global.gc();

    const finalMemory = getMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;

    // Should not increase by more than 1MB
    expect(memoryIncrease).toBeLessThan(1024 * 1024);

    console.log(`Memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
  });

  it('should not accumulate memory with character creation/destruction', () => {
    const initialMemory = getMemoryUsage();

    // Create and destroy many characters
    for (let i = 0; i < 100; i++) {
      const char = createFullyArmoredKnight(`Knight${i}`);
      destroyCharacter(char.id);
    }

    if (global.gc) global.gc();

    const finalMemory = getMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // < 5MB

    console.log(`Memory increase after 100 create/destroy cycles: ${(memoryIncrease / 1024).toFixed(2)} KB`);
  });
});
```

## Running Performance Tests

Execute performance tests:

```bash
# Run all armor performance tests
npm run test:performance -- tests/performance/clothing/armor-*.performance.test.js

# Run with memory profiling
node --expose-gc npm run test:performance -- tests/performance/clothing/armor-memory-usage.performance.test.js

# Generate performance report
npm run test:performance -- --coverage --json --outputFile=performance-report.json
```

## Performance Benchmarking

### Benchmark 1: Baseline Comparison

Compare performance before and after armor implementation:

```bash
# Checkout pre-armor commit
git checkout [pre-armor-commit]

# Run baseline performance tests
npm run test:performance -- tests/performance/clothing/ > baseline-results.txt

# Checkout armor implementation
git checkout [armor-commit]

# Run performance tests with armor
npm run test:performance -- tests/performance/clothing/ > armor-results.txt

# Compare results
diff baseline-results.txt armor-results.txt
```

### Benchmark 2: Profiling

Profile coverage resolution with armor:

```bash
# Run with profiler
node --prof npm run test:performance -- tests/performance/clothing/armor-coverage-resolution.performance.test.js

# Process profile
node --prof-process isolate-*.log > profile.txt

# Analyze profile
cat profile.txt | grep -A 20 "Statistical profiling"
```

### Benchmark 3: Load Testing

Test with large numbers of armored characters:

```javascript
// Create load test scenario
function loadTest() {
  const characters = [];

  // Create 100 fully armored characters
  for (let i = 0; i < 100; i++) {
    characters.push(createFullyArmoredKnight(`Knight${i}`));
  }

  console.time('Resolve all coverage');
  for (const char of characters) {
    resolveCoverage(char.id);
  }
  console.timeEnd('Resolve all coverage');

  console.time('Generate all action text');
  for (const char of characters) {
    generateActionText(char.id, 'walk', { direction: 'north' });
  }
  console.timeEnd('Generate all action text');
}

loadTest();
```

## Performance Targets

### Target 1: Coverage Resolution

- **Single character**: < 5ms
- **10 characters**: < 50ms
- **100 characters**: < 500ms
- **Degradation vs 4-layer**: < 5%

### Target 2: Action Text Generation

- **Single action**: < 10ms
- **With armor**: < 15ms
- **Overhead**: < 10%

### Target 3: Equipment Changes

- **Equip/Unequip**: < 2ms
- **Full armor set**: < 10ms
- **Rapid changes**: No accumulating delay

### Target 4: Memory Usage

- **Memory leak**: None (< 1MB increase over 10k operations)
- **Character creation/destruction**: < 5MB over 100 cycles
- **Stable memory**: Memory returns to baseline after GC

## Success Criteria

- [ ] All performance tests pass
- [ ] Coverage resolution with armor < 5ms per character
- [ ] Performance degradation vs 4-layer system < 5%
- [ ] Action text generation with armor < 15ms
- [ ] Multi-character scenarios scale linearly
- [ ] Equipment changes < 2ms each
- [ ] No memory leaks detected
- [ ] Load testing shows acceptable performance (100 characters)
- [ ] Profiling shows no obvious bottlenecks
- [ ] Performance targets met or exceeded

## Performance Optimization

If performance targets are not met, consider these optimizations:

### Optimization 1: Priority Lookup Caching

```javascript
// Cache priority lookups
const PRIORITY_CACHE = new Map();

function getCachedPriority(layer) {
  if (!PRIORITY_CACHE.has(layer)) {
    PRIORITY_CACHE.set(layer, calculateLayerPriority(layer));
  }
  return PRIORITY_CACHE.get(layer);
}
```

### Optimization 2: Coverage Memoization

```javascript
// Memoize coverage resolution results
const coverageCache = new WeakMap();

function getCoverageWithMemo(characterId) {
  const character = getCharacter(characterId);

  if (coverageCache.has(character)) {
    return coverageCache.get(character);
  }

  const coverage = resolveCoverage(characterId);
  coverageCache.set(character, coverage);
  return coverage;
}
```

### Optimization 3: Lazy Coverage Resolution

```javascript
// Only resolve coverage when needed
class CoverageResolver {
  #cache = new Map();
  #dirty = new Set();

  markDirty(characterId) {
    this.#dirty.add(characterId);
    this.#cache.delete(characterId);
  }

  resolve(characterId) {
    if (!this.#cache.has(characterId)) {
      this.#cache.set(characterId, this.#resolveCoverage(characterId));
      this.#dirty.delete(characterId);
    }
    return this.#cache.get(characterId);
  }
}
```

### Optimization 4: Reduce Object Allocations

```javascript
// Reuse objects instead of creating new ones
const coverageResult = {
  layer: null,
  priority: null,
  item: null,
};

function resolveCoverageOptimized(characterId, slot) {
  // Reuse coverageResult object instead of creating new one
  coverageResult.layer = null;
  coverageResult.priority = null;
  coverageResult.item = null;

  // ... resolution logic ...

  return coverageResult;
}
```

## Documentation

Document the following:

1. **Performance Test Results**
   - All test timings
   - Degradation measurements
   - Memory usage results
   - Load test results

2. **Bottlenecks Identified**
   - Any performance issues found
   - Root causes
   - Severity assessment

3. **Optimizations Applied**
   - What optimizations were needed
   - Performance improvements achieved
   - Trade-offs made

4. **Recommendations**
   - Further optimization opportunities
   - Monitoring recommendations
   - Performance budgets for future changes

## Related Tickets

- **Previous**: ARMSYSANA-009 (Test Armor Scenarios)
- **Next**: None (Final ticket)
- **Depends On**: ARMSYSANA-001 through ARMSYSANA-009

## Notes

Performance testing is the **final validation** of the armor system implementation. It ensures that adding armor doesn't negatively impact the game experience.

Key focus areas:
1. **Coverage Resolution**: Most frequent operation
2. **Action Text Generation**: Player-visible operation
3. **Scalability**: Must handle many characters
4. **Memory**: Must not leak over time

If performance targets are not met, optimization may be needed before shipping the armor system.

**Acceptable Degradation**: Up to 5% performance degradation is acceptable given the added functionality. Beyond 5%, optimization is required.

## Reference

Performance testing patterns from CLAUDE.md:
- Use Jest performance tests
- Measure in milliseconds
- Compare before/after
- Test scaling behavior
- Check for memory leaks
- Profile hot paths

Performance targets are based on maintaining 60 FPS in browser (16.67ms frame budget) with headroom for other operations.
