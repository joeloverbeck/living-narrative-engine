# ANACACISO-004: Add Scalability Test for 10+ Concurrent Characters

**Status**: Complete
**Priority**: MEDIUM
**Estimated Effort**: 2-3 hours
**Dependencies**: ANACACISO-001 (Unique Part Ownership Test)

## Description

Add performance/integration test to validate anatomy cache isolation and performance when generating 10+ characters concurrently. This ensures the fix scales beyond the 4-character baseline.

## Problem Context

The original bug was discovered with 4 concurrent characters. This test validates that the fix works at larger scale (10+ characters) and maintains acceptable performance characteristics.

## Files Expected to Touch

### New Files
- `tests/integration/anatomy/anatomyCacheManager.scalability.test.js`

### Modified Files
- None (pure test addition)

## Explicit Out of Scope

**DO NOT MODIFY**:
- `src/anatomy/anatomyCacheManager.js` (no performance optimizations)
- Production code for anatomy system
- Cache implementation details
- Parallel processing logic

**DO NOT ADD**:
- Performance optimizations to cache manager
- Batch processing features
- Caching layers or strategies
- Concurrency control mechanisms

## Implementation Details

### Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('AnatomyCacheManager - Scalability', () => {
  let testBed;
  let bodyGraphService;
  let entityManager;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
    bodyGraphService = testBed.bodyGraphService;
    entityManager = testBed.entityManager;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should handle 10 concurrent character generations without performance degradation', async () => {
    // Arrange: Create 10 characters with varied anatomies
    // Use actual recipe IDs from data/mods/anatomy/recipes/
    const recipes = [
      'anatomy:human_male',      // 3x human male
      'anatomy:human_male',
      'anatomy:human_male',
      'anatomy:human_female',    // 3x human female
      'anatomy:human_female',
      'anatomy:human_female',
      'anatomy:cat_girl_standard', // 2x cat girl (CORRECTED: was anatomy:cat_girl)
      'anatomy:cat_girl_standard',
      'anatomy:tortoise_person', // 2x tortoise
      'anatomy:tortoise_person'
    ];

    // Act: Generate all concurrently using testBed API and measure time
    const startTime = performance.now();

    const actorIds = await Promise.all(
      recipes.map(recipeId => testBed.createCharacterFromRecipe(recipeId))
    );

    const duration = performance.now() - startTime;

    // Assert: Performance threshold
    expect(duration).toBeLessThan(5000); // < 5 seconds

    // Assert: All characters generated successfully
    for (const actorId of actorIds) {
      const anatomy = entityManager.getComponentData(actorId, 'anatomy:body');
      expect(anatomy).toBeDefined();
      expect(anatomy.body.root).toBeDefined();
    }

    // Assert: No part sharing between characters
    const allPartSets = [];

    for (const actorId of actorIds) {
      const anatomy = entityManager.getComponentData(actorId, 'anatomy:body');
      const parts = bodyGraphService.getAllParts(anatomy, actorId);
      allPartSets.push({ actorId, parts });
    }

    // Validate no overlap (45 comparisons for 10 actors)
    for (let i = 0; i < allPartSets.length; i++) {
      for (let j = i + 1; j < allPartSets.length; j++) {
        const overlap = allPartSets[i].parts.filter(id =>
          allPartSets[j].parts.includes(id)
        );

        expect(overlap).toEqual([]);

        if (overlap.length > 0) {
          console.error(
            `FAILURE: Actors ${allPartSets[i].actorId} and ${allPartSets[j].actorId} share parts:`,
            overlap
          );
        }
      }
    }

    // Assert: Each character has reasonable part count
    for (const { actorId, parts } of allPartSets) {
      expect(parts.length).toBeGreaterThan(1);
      expect(parts.length).toBeLessThan(100); // Sanity check
    }

    // Log performance metrics
    console.log(`10 concurrent characters generated in ${duration.toFixed(2)}ms`);
    console.log(`Average per character: ${(duration / 10).toFixed(2)}ms`);
  }, 10000); // 10 second timeout

  it('should maintain memory stability with 10+ characters', async () => {
    // Arrange: 12 characters for stress test
    const recipes = Array.from({ length: 12 }, (_, i) => 
      ['anatomy:human_male', 'anatomy:human_female', 'anatomy:cat_girl_standard'][i % 3]
    );

    // Measure initial memory
    const initialMemory = process.memoryUsage().heapUsed;

    // Act: Generate all characters
    await Promise.all(
      recipes.map(recipeId => testBed.createCharacterFromRecipe(recipeId))
    );

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Measure final memory
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Assert: Memory increase is reasonable
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

    // Expect <50MB increase for 12 characters (very generous threshold)
    expect(memoryIncreaseMB).toBeLessThan(50);

    console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for 12 characters`);
  }, 15000); // 15 second timeout

  it('should handle sequential batches of 5 concurrent characters', async () => {
    // Arrange: 3 batches of 5 characters
    const batches = [
      Array.from({ length: 5 }, () => 'anatomy:human_male'),
      Array.from({ length: 5 }, () => 'anatomy:human_female'),
      Array.from({ length: 5 }, () => 'anatomy:cat_girl_standard')
    ];

    // Act: Process each batch concurrently, batches sequentially
    const allActorIds = [];
    for (const batch of batches) {
      const batchActorIds = await Promise.all(
        batch.map(recipeId => testBed.createCharacterFromRecipe(recipeId))
      );
      allActorIds.push(...batchActorIds);
    }

    // Assert: All 15 characters have unique parts
    const allPartSets = [];

    for (const actorId of allActorIds) {
      const anatomy = entityManager.getComponentData(actorId, 'anatomy:body');
      const parts = bodyGraphService.getAllParts(anatomy, actorId);
      allPartSets.push({ actorId, parts });
    }

    // Validate no overlap across all 15 characters
    for (let i = 0; i < allPartSets.length; i++) {
      for (let j = i + 1; j < allPartSets.length; j++) {
        const overlap = allPartSets[i].parts.filter(id =>
          allPartSets[j].parts.includes(id)
        );
        expect(overlap).toEqual([]);
      }
    }
  }, 20000); // 20 second timeout
});
```

### Key Validation Points

1. **Performance Threshold**: 10 characters in <5 seconds
2. **Part Isolation**: Zero overlap in 45 pairwise comparisons
3. **Memory Stability**: <50MB increase for 12 characters
4. **Batch Processing**: Sequential batches maintain isolation

## Acceptance Criteria

### Specific Tests That Must Pass

1. **New Test Suite Passes**:
   ```bash
   NODE_ENV=test npx jest tests/integration/anatomy/anatomyCacheManager.scalability.test.js --no-coverage --silent
   ```
   - All 3 test cases pass
   - Performance thresholds met
   - No memory leaks detected

2. **Validates Scalability**:
   - 10 concurrent characters: <5 seconds
   - 12 characters: <50MB memory increase
   - 15 characters (batched): Zero part overlap

3. **Existing Tests Still Pass**:
   ```bash
   NODE_ENV=test npm run test:integration -- tests/integration/anatomy/ --silent
   ```

### Invariants That Must Remain True

1. **Linear Scaling**: Performance scales linearly (not exponentially) with character count
2. **Memory Stability**: No memory leaks with high character counts
3. **Part Isolation**: Unique parts maintained regardless of scale
4. **No Degradation**: Later characters perform same as earlier ones

## Definition of Done

- [ ] Test file created with 3 scalability test cases
- [ ] Tests validate 10+ concurrent character generation
- [ ] Tests include performance timing measurements
- [ ] Tests include memory usage validation
- [ ] Tests validate batch processing scenarios
- [ ] All tests pass consistently (3+ runs)
- [ ] No modifications to production code
- [ ] Code follows project conventions (eslint passes)
- [ ] Tests complete in <30 seconds total

## Verification Commands

```bash
# Run the new test suite
NODE_ENV=test npx jest tests/integration/anatomy/anatomyCacheManager.scalability.test.js --no-coverage --verbose

# Run 3 times to check consistency
for i in {1..3}; do
  echo "=== Run $i ==="
  NODE_ENV=test npx jest tests/integration/anatomy/anatomyCacheManager.scalability.test.js --no-coverage --silent
done

# Run with memory profiling (if gc available)
NODE_ENV=test node --expose-gc ./node_modules/.bin/jest tests/integration/anatomy/anatomyCacheManager.scalability.test.js --no-coverage --silent

# Verify all anatomy tests still pass
NODE_ENV=test npm run test:integration -- tests/integration/anatomy/ --silent

# Verify no production code changes
git status

# Verify eslint passes
npx eslint tests/integration/anatomy/anatomyCacheManager.scalability.test.js
```

## Outcome

**Status**: ✅ COMPLETED

**What Was Changed**:
1. Created `tests/integration/anatomy/anatomyCacheManager.scalability.test.js` with 3 test cases
2. Corrected recipe IDs from original ticket:
   - Changed `anatomy:cat_girl` to `anatomy:cat_girl_standard` (but recipe not loaded in testBed)
   - Final implementation uses only recipes loaded by `testBed.loadAnatomyModData()`:
     - `anatomy:human_male` (4 instances in 10-character test)
     - `anatomy:human_female` (4 instances in 10-character test)
     - `anatomy:tortoise_person` (2 instances in 10-character test)
3. All tests pass consistently (5+ runs verified)
4. ESLint passes with no errors

**Differences from Original Plan**:
- Used `AnatomyIntegrationTestBed` instead of generic `createTestBed()`
- Used `testBed.createCharacterFromRecipe()` API instead of direct `anatomyWorkflow.generate()`
- Recipe selection limited to what's loaded in test bed (cat_girl_standard not available)
- No production code modifications (as intended)

**Test Results**:
- ✅ 10 concurrent characters: <5 seconds (avg ~1.2s across 5 runs)
- ✅ 12 characters memory: <50MB increase
- ✅ 15 characters (batched): Zero part overlap
- ✅ Consistent across 5+ runs
- ✅ ESLint passes

## Related Context

- **Spec Reference**: Section "Tests That Should Be Added" > "New Test 1: Concurrent Generation with 10+ Characters"
- **Performance**: Current baseline is 4 characters, this extends to 10+
- **Dependency**: Builds on ANACACISO-001 (unique part ownership validation)

## Notes

- This test is RECOMMENDED but not CRITICAL
- Validates scalability beyond baseline 4-character scenario
- Performance thresholds are generous to avoid flaky tests
- Memory threshold is high to account for test environment overhead
- Provides confidence for production usage with many NPCs
- Useful for performance regression detection
