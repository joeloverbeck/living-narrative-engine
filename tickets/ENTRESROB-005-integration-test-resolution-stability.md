# ENTRESROB-005: Integration Test for Entity Resolution Stability

**Priority:** P1
**Effort:** Small (2-3 hours)
**Status:** Not Started
**Dependencies:** ENTRESROB-003 (deterministic resolution must be in place first)

## Report Reference

See `specs/entity-resolution-robustness.md` for full context.

## Problem Statement

There are no integration tests that verify:
1. All entities of the same `subType` have consistent socket IDs
2. Entity resolution is stable across different registry load orders
3. Base entities are preferred over variants

These properties are critical for preventing future regressions.

## Objective

Create integration tests that verify entity resolution stability and data consistency using real mod data from `data/mods/anatomy/`.

## Files to Touch

- `tests/integration/anatomy/entityResolutionConsistency.integration.test.js` (CREATE)

## Out of Scope

- **DO NOT** modify production code in `src/`
- **DO NOT** modify existing test files
- **DO NOT** modify entity definition files in `data/mods/`
- **DO NOT** duplicate validation script functionality (ENTRESROB-002)

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
# Integration test runs
npm run test:integration -- --testPathPattern="entityResolutionConsistency"
```

### Test Cases to Implement

```
entityResolutionConsistency > data consistency > all entities with subType "head" have brain_socket
entityResolutionConsistency > data consistency > all entities with subType "torso" have heart_socket
entityResolutionConsistency > data consistency > all entities with subType "torso" have spine_socket
entityResolutionConsistency > resolution stability > resolveEntityId returns consistent ID across shuffled registry order
entityResolutionConsistency > resolution stability > resolveEntityId prefers base entity over variants
```

### Invariants That Must Remain True

1. Tests are read-only, do not modify any files
2. Tests use existing test infrastructure (e.g., `AnatomyIntegrationTestBed`)
3. Tests load real mod data from `data/mods/anatomy/`
4. Tests provide clear failure messages indicating which entity/socket is missing

## Implementation Notes

### Test File Structure

```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AnatomyIntegrationTestBed } from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('entityResolutionConsistency', () => {
  let testBed;
  let allEntities;

  beforeAll(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
    allEntities = testBed.getAllEntityDefinitions();
  });

  afterAll(async () => {
    await testBed.cleanup();
  });

  describe('data consistency', () => {
    it('all entities with subType "head" have brain_socket', () => {
      const headEntities = allEntities.filter(e =>
        e.components?.['anatomy:part']?.subType === 'head'
      );

      for (const entity of headEntities) {
        const sockets = entity.components?.['anatomy:sockets']?.sockets || [];
        const socketIds = sockets.map(s => s.id);

        expect(socketIds).toContain('brain_socket');
      }
    });

    it('all entities with subType "torso" have heart_socket', () => {
      // Similar pattern
    });

    it('all entities with subType "torso" have spine_socket', () => {
      // Similar pattern
    });
  });

  describe('resolution stability', () => {
    it('resolveEntityId returns consistent ID across shuffled registry order', async () => {
      // Get expected result
      const expected = await resolveEntityId('head', testBed.registry);

      // Shuffle entities and re-resolve multiple times
      for (let i = 0; i < 10; i++) {
        const shuffledRegistry = createShuffledRegistry(testBed.registry);
        const result = await resolveEntityId('head', shuffledRegistry);
        expect(result).toBe(expected);
      }
    });

    it('resolveEntityId prefers base entity over variants', async () => {
      const result = await resolveEntityId('head', testBed.registry);

      // Base entity should be selected (fewer underscores, shorter ID)
      expect(result).toBe('anatomy:humanoid_head');
    });
  });
});
```

### Helper Functions

```javascript
function createShuffledRegistry(originalRegistry) {
  const entities = [...originalRegistry.getAll('entityDefinitions')];
  // Fisher-Yates shuffle
  for (let i = entities.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entities[i], entities[j]] = [entities[j], entities[i]];
  }

  return {
    getAll: (type) => type === 'entityDefinitions' ? entities : []
  };
}
```

### Accessing resolveEntityId

Since `resolveEntityId` is a private function, the test may need to:
1. Test through `extractHierarchicalSockets` (which calls it)
2. Import it if exported for testing in ENTRESROB-001
3. Use a test helper that exposes it

## Verification Commands

```bash
# Run integration test
npm run test:integration -- --testPathPattern="entityResolutionConsistency"

# Run with verbose output
npm run test:integration -- --testPathPattern="entityResolutionConsistency" --verbose

# Run all anatomy integration tests
npm run test:integration -- --testPathPattern="anatomy"
```

## Success Metrics

- [ ] Test file created at `tests/integration/anatomy/entityResolutionConsistency.integration.test.js`
- [ ] All 5 test cases pass
- [ ] Tests use real mod data (not mocks)
- [ ] Tests verify determinism with shuffled registry
- [ ] Tests verify base entity preference
- [ ] Clear failure messages when assertions fail
