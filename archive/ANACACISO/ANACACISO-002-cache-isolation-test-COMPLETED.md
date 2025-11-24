# ANACACISO-002: Add Cache Isolation During Concurrent Operations Test

**Status**: ✅ COMPLETED (2025-11-23)
**Priority**: CRITICAL
**Estimated Effort**: 3-5 hours
**Dependencies**: None

## ⚠️ Assumptions Corrected (2025-11-23)

The following assumptions were corrected to match the actual codebase:

1. **Test Bed**: Use `AnatomyIntegrationTestBed` (not `createTestBed()`)
   - Services accessed as properties (not via `get()` method)
   - Requires `await testBed.loadAnatomyModData()` in setup

2. **Service Names**:
   - `anatomyGenerationService` (not `anatomyWorkflow`)
   - Method: `generateAnatomyIfNeeded()` (not `generate()`)
   - Use `createCharacterFromRecipe()` for test setup

3. **Entity Access Pattern**:
   - Must use `entityManager.getEntityInstance(id)` first
   - Then call `entity.getComponentData('anatomy:body')` on the instance

4. **Promise.all Pattern**: Use IIFE syntax `(async () => { ... })()`
   - Fixed: Missing invocation parentheses on async functions

## Description

Add integration test to validate Invariant 5: Cache operations on actor A cannot modify cache entries for actor B, even during concurrent processing and invalidation.

## Problem Context

The original bug showed that concurrent cache building could interfere across actors. This test ensures that cache operations remain properly isolated per actor, even when multiple actors are being processed, invalidated, and rebuilt simultaneously.

## Files Expected to Touch

### New Files
- `tests/integration/anatomy/anatomyCacheManager.concurrentIsolation.integration.test.js`

### Modified Files
- None (uses existing infrastructure)

## Explicit Out of Scope

**DO NOT MODIFY**:
- `src/anatomy/anatomyCacheManager.js` (implementation already correct)
- `src/anatomy/bodyGraphService.js` (no changes needed)
- Any production code in anatomy system
- Other test files
- Cache invalidation logic (already implemented)

**DO NOT ADD**:
- New cache management features
- Performance metrics or monitoring
- Alternative cache strategies
- Multi-threading or async optimizations

## Implementation Details

### Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('AnatomyCacheManager - Concurrent Cache Isolation', () => {
  let testBed;
  let cacheManager;
  let bodyGraphService;
  let entityManager;
  let anatomyGenerationService;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    cacheManager = testBed.anatomyCacheManager;
    bodyGraphService = testBed.bodyGraphService;
    entityManager = testBed.entityManager;
    anatomyGenerationService = testBed.anatomyGenerationService;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should isolate cache operations per actor during concurrent processing', async () => {
    // Arrange: Create 2 characters using test recipes
    const actorAId = await testBed.createCharacterFromRecipe('anatomy:human_male');
    const actorBId = await testBed.createCharacterFromRecipe('anatomy:human_female');

    // Get initial parts for both
    const entityA = entityManager.getEntityInstance(actorAId);
    const entityB = entityManager.getEntityInstance(actorBId);
    const anatomyA = entityA.getComponentData('anatomy:body');
    const anatomyB = entityB.getComponentData('anatomy:body');

    const initialPartsA = bodyGraphService.getAllParts(anatomyA, actorAId);
    const initialPartsB = bodyGraphService.getAllParts(anatomyB, actorBId);

    // Assert initial state is valid
    expect(initialPartsA.length).toBeGreaterThan(1);
    expect(initialPartsB.length).toBeGreaterThan(1);

    // Act: Concurrently invalidate A, rebuild A, and read B
    await Promise.all([
      (async () => {
        // Invalidate and rebuild A
        cacheManager.invalidateCacheForRoot(actorAId);
        await cacheManager.buildCache(actorAId, entityManager);
      })(),
      (async () => {
        // Read B while A is being rebuilt
        const partsB = bodyGraphService.getAllParts(anatomyB, actorBId);
        expect(partsB.length).toBeGreaterThan(1);
      })()
    ]);

    // Assert: B's parts unchanged by A's operations
    const finalPartsB = bodyGraphService.getAllParts(anatomyB, actorBId);

    expect(finalPartsB).toEqual(initialPartsB);
    expect(finalPartsB.length).toBe(initialPartsB.length);

    // Verify no shared parts after rebuild
    const finalPartsA = bodyGraphService.getAllParts(anatomyA, actorAId);
    const overlap = finalPartsA.filter(id => finalPartsB.includes(id));

    expect(overlap).toEqual([]);
  });

  it('should handle multiple concurrent invalidations without interference', async () => {
    // Arrange: Create 4 actors
    const recipes = [
      'anatomy:human_male',
      'anatomy:human_female',
      'anatomy:human_male',
      'anatomy:human_female'
    ];

    // Generate all actors
    const actorIds = await Promise.all(
      recipes.map(recipe => testBed.createCharacterFromRecipe(recipe))
    );

    // Get initial part sets
    const initialPartSets = actorIds.map(actorId => {
      const entity = entityManager.getEntityInstance(actorId);
      const anatomy = entity.getComponentData('anatomy:body');
      return {
        actorId,
        parts: bodyGraphService.getAllParts(anatomy, actorId)
      };
    });

    // Act: Concurrently invalidate/rebuild actors 0 and 1, read actors 2 and 3
    await Promise.all([
      (async () => {
        cacheManager.invalidateCacheForRoot(actorIds[0]);
        await cacheManager.buildCache(actorIds[0], entityManager);
      })(),
      (async () => {
        cacheManager.invalidateCacheForRoot(actorIds[1]);
        await cacheManager.buildCache(actorIds[1], entityManager);
      })(),
      (async () => {
        const entity2 = entityManager.getEntityInstance(actorIds[2]);
        const anatomy2 = entity2.getComponentData('anatomy:body');
        bodyGraphService.getAllParts(anatomy2, actorIds[2]);
      })(),
      (async () => {
        const entity3 = entityManager.getEntityInstance(actorIds[3]);
        const anatomy3 = entity3.getComponentData('anatomy:body');
        bodyGraphService.getAllParts(anatomy3, actorIds[3]);
      })()
    ]);

    // Assert: Actors 2 and 3 unchanged
    const finalPartSet2 = initialPartSets.find(s => s.actorId === actorIds[2]);
    const finalPartSet3 = initialPartSets.find(s => s.actorId === actorIds[3]);

    const entity2 = entityManager.getEntityInstance(actorIds[2]);
    const entity3 = entityManager.getEntityInstance(actorIds[3]);
    const anatomy2 = entity2.getComponentData('anatomy:body');
    const anatomy3 = entity3.getComponentData('anatomy:body');

    const currentParts2 = bodyGraphService.getAllParts(anatomy2, actorIds[2]);
    const currentParts3 = bodyGraphService.getAllParts(anatomy3, actorIds[3]);

    expect(currentParts2).toEqual(finalPartSet2.parts);
    expect(currentParts3).toEqual(finalPartSet3.parts);

    // Assert: All 4 actors still have unique parts
    const allPartSets = actorIds.map(actorId => {
      const entity = entityManager.getEntityInstance(actorId);
      const anatomy = entity.getComponentData('anatomy:body');
      return bodyGraphService.getAllParts(anatomy, actorId);
    });

    for (let i = 0; i < allPartSets.length; i++) {
      for (let j = i + 1; j < allPartSets.length; j++) {
        const overlap = allPartSets[i].filter(id => allPartSets[j].includes(id));
        expect(overlap).toEqual([]);
      }
    }
  });
});
```

### Key Validation Points

1. **Isolation During Rebuild**: Rebuilding actor A doesn't affect actor B's cache
2. **Concurrent Read Safety**: Reading cache while another is being rebuilt is safe
3. **Multiple Concurrent Invalidations**: Multiple actors can be invalidated/rebuilt simultaneously
4. **Part Uniqueness Preserved**: After all operations, parts remain unique per actor

## Acceptance Criteria

### Specific Tests That Must Pass

1. **New Test Suite Passes**:
   ```bash
   NODE_ENV=test npx jest tests/integration/anatomy/anatomyCacheManager.concurrentIsolation.integration.test.js --no-coverage --silent
   ```
   - Both test cases pass
   - No race condition warnings
   - No cache corruption detected

2. **Validates Cache Isolation**:
   - Actor B's cache unchanged when Actor A is invalidated/rebuilt
   - Multiple concurrent invalidations don't interfere
   - All actors maintain unique part sets after operations

3. **Existing Tests Still Pass**:
   ```bash
   NODE_ENV=test npm run test:integration -- tests/integration/anatomy/ --silent
   ```

### Invariants That Must Remain True

1. **Per-Actor Cache Isolation**: `buildCache(A)` does NOT modify `cacheEntries(B)`
2. **Invalidation Isolation**: `invalidateCacheForRoot(A)` does NOT affect `cacheEntries(B)`
3. **Unique Parts Maintained**: After all operations, part sets remain disjoint
4. **Cache Consistency**: Cache entries match actual component data

## Definition of Done

- [x] Test file created with 2+ test cases
- [x] Tests validate isolation during concurrent operations
- [x] Tests validate isolation during concurrent invalidations
- [x] Tests check part uniqueness is preserved
- [x] Tests pass consistently (5+ runs without failure)
- [x] No modifications to production code
- [x] Code follows project conventions (eslint passes)
- [x] Tests complete in <10 seconds (averaged ~0.66s)

## Verification Commands

```bash
# Run the new test suite
NODE_ENV=test npx jest tests/integration/anatomy/anatomyCacheManager.concurrentIsolation.integration.test.js --no-coverage --verbose

# Run 5 times to check for race conditions
for i in {1..5}; do
  echo "=== Run $i ==="
  NODE_ENV=test npx jest tests/integration/anatomy/anatomyCacheManager.concurrentIsolation.integration.test.js --no-coverage --silent
done

# Verify all anatomy tests still pass
NODE_ENV=test npm run test:integration -- tests/integration/anatomy/ --silent

# Verify no production code changes
git status

# Verify eslint passes
npx eslint tests/integration/anatomy/anatomyCacheManager.concurrentIsolation.integration.test.js
```

## Related Context

- **Spec Reference**: Section "Tests That Should Be Added" > "New Test 4: Concurrent Cache Invalidation"
- **Invariant**: Invariant 5 in spec (lines 1110-1138)
- **Related Test**: `multiCharacterClothingGeneration.test.js` validates similar scenario

## Notes

- This test is CRITICAL for ensuring cache operations don't interfere
- Validates per-root isolation design
- Should be run on every CI build
- Failure indicates cache isolation bug
- Complements unique part ownership test by focusing on concurrent operations

---

## ✅ COMPLETION OUTCOME (2025-11-23)

### What Was Changed vs Originally Planned

**Ticket Corrections Made:**
1. Updated test infrastructure assumptions to use `AnatomyIntegrationTestBed` instead of generic `createTestBed()`
2. Corrected service access patterns (properties instead of `get()` method)
3. Fixed entity access pattern to use `getEntityInstance()` → `getComponentData()`
4. Fixed Promise.all pattern to use IIFE syntax for async functions
5. Updated recipe IDs to use actual test recipes

**Code Changes:**
- ✅ Created: `tests/integration/anatomy/anatomyCacheManager.concurrentIsolation.integration.test.js`
- ❌ No production code modified (as required)

**Tests Created:**
1. `should isolate cache operations per actor during concurrent processing` - validates 2-actor concurrent cache rebuild isolation
2. `should handle multiple concurrent invalidations without interference` - validates 4-actor concurrent invalidation isolation

**Test Results:**
- ✅ All tests pass consistently (5/5 runs)
- ✅ Test execution time: ~0.66s (well under 10s requirement)
- ✅ ESLint passes with no errors
- ✅ All invariants validated successfully

**Key Deviations from Original Plan:**
- None in scope, only corrections to match actual codebase structure
- Original test logic and validation approach preserved
- All acceptance criteria met as specified

**Next Steps:**
- Test file ready for use in CI pipeline (per ANACACISO-005)
- Complements ANACACISO-001 (unique part ownership test)
