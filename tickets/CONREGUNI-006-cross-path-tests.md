# CONREGUNI-006: Add Comprehensive Cross-Path Tests

## Summary

Create comprehensive tests that verify conditions are findable across all resolution paths, in all registration orders, with complete cleanup verification. These tests serve as regression protection for the unification work.

## Priority: Medium | Effort: Medium

## Rationale

The original failure was a cross-path issue: conditions registered via one API weren't visible to another code path. Comprehensive tests ensure:
- All registration paths work
- Order of operations doesn't matter
- Cleanup is complete
- Invariants are maintained

## Dependencies

- **Requires**: CONREGUNI-004 and CONREGUNI-005 completed (unified storage)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/common/mods/ModTestFixture.conditionRegistrationCrossPaths.test.js` | **Create** - Cross-path tests |
| `tests/unit/common/mods/conditionOverrideChain.test.js` | **Create** - Override chain tests |
| `tests/unit/common/mods/conditionCleanupCompleteness.test.js` | **Create** - Cleanup tests |
| `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js` | **Update** - Add invariant tests |

## Out of Scope

- **DO NOT** modify production code - this is test-only
- **DO NOT** modify the infrastructure (already done in prior tickets)
- **DO NOT** add deprecation warnings - that's CONREGUNI-007

## Implementation Details

### New File: conditionRegistrationCrossPaths.test.js

```javascript
/**
 * @file Tests for cross-path condition registration availability
 *
 * These tests verify that conditions registered via any path are
 * findable via all lookup paths, regardless of registration order.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ModTestFixture from '../../../common/mods/ModTestFixture.js';
import ScopeResolverHelpers from '../../../common/mods/scopeResolverHelpers.js';

describe('registerCondition cross-path availability', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  describe('registration before scope setup', () => {
    it('should make condition available via dataRegistry', () => {
      fixture.registerCondition('test:before-scope', { logic: { '==': [1, 1] } });

      const found = fixture.testEnv.dataRegistry.getConditionDefinition('test:before-scope');
      expect(found).toBeDefined();
      expect(found.logic).toEqual({ '==': [1, 1] });
    });

    it('should make condition available via conditionStore', () => {
      fixture.registerCondition('test:via-store', { logic: { '==': [2, 2] } });

      expect(fixture.testEnv.conditionStore.has('test:via-store')).toBe(true);
      expect(fixture.testEnv.conditionStore.get('test:via-store').logic).toEqual({ '==': [2, 2] });
    });
  });

  describe('registration after scope setup', () => {
    beforeEach(async () => {
      ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
      await ScopeResolverHelpers.registerCustomScope(
        fixture.testEnv, 'positioning', 'close_actors'
      );
    });

    it('should make condition available via dataRegistry after ScopeResolverHelpers', async () => {
      fixture.registerCondition('test:after-scope', { logic: { '==': [3, 3] } });

      const found = fixture.testEnv.dataRegistry.getConditionDefinition('test:after-scope');
      expect(found).toBeDefined();
      expect(found.logic).toEqual({ '==': [3, 3] });
    });

    it('should make condition available via conditionStore after ScopeResolverHelpers', async () => {
      fixture.registerCondition('test:after-via-store', { logic: { '==': [4, 4] } });

      expect(fixture.testEnv.conditionStore.has('test:after-via-store')).toBe(true);
    });
  });

  describe('interleaved registrations', () => {
    it('should maintain all conditions across multiple registration/scope cycles', async () => {
      // Register first
      fixture.registerCondition('test:first', { logic: { '==': [1, 1] } });

      // Setup scopes
      ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);

      // Register second
      fixture.registerCondition('test:second', { logic: { '==': [2, 2] } });

      // Setup more scopes
      await ScopeResolverHelpers.registerCustomScope(
        fixture.testEnv, 'positioning', 'close_actors'
      );

      // Register third
      fixture.registerCondition('test:third', { logic: { '==': [3, 3] } });

      // ALL should be findable
      expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:first')).toBeDefined();
      expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:second')).toBeDefined();
      expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:third')).toBeDefined();
    });
  });

  describe('TESINFROB-006 regression scenario', () => {
    it('should find conditions registered after ScopeResolverHelpers.registerCustomScope()', async () => {
      // This exact scenario caused the original failure

      ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
      await ScopeResolverHelpers.registerCustomScope(
        fixture.testEnv, 'striking', 'actors_in_location_not_facing_away'
      );

      fixture.registerCondition('striking:actor-has-arm', {
        id: 'striking:actor-has-arm',
        logic: { '==': [true, true] }
      });

      // This was the failure case
      const condition = fixture.testEnv.dataRegistry.getConditionDefinition('striking:actor-has-arm');
      expect(condition).toBeDefined();
      expect(condition.logic).toEqual({ '==': [true, true] });
    });
  });
});
```

### New File: conditionOverrideChain.test.js

```javascript
/**
 * @file Tests for condition override chain integrity
 *
 * Verifies that the override chain properly delegates unknown conditions
 * to the original implementation.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ModTestFixture from '../../../common/mods/ModTestFixture.js';
import ScopeResolverHelpers from '../../../common/mods/scopeResolverHelpers.js';

describe('condition override chain integrity', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('should return undefined for unknown conditions (not throw)', () => {
    const result = fixture.testEnv.dataRegistry.getConditionDefinition('unknown:does-not-exist');
    expect(result).toBeUndefined();
  });

  it('should preserve access to conditions registered at any layer after multiple overrides', async () => {
    // Register at fixture level
    fixture.registerCondition('test:level1', { logic: { '==': [1, 1] } });

    // Trigger scope helper (which previously installed another override)
    await ScopeResolverHelpers.registerCustomScope(fixture.testEnv, 'positioning', 'close_actors');

    // Register after scope helper
    fixture.registerCondition('test:level2', { logic: { '==': [2, 2] } });

    // Both should be accessible
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:level1')).toBeDefined();
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:level2')).toBeDefined();
  });

  it('should not leak conditions between fixtures', async () => {
    fixture.registerCondition('test:fixture1', { logic: { '==': [1, 1] } });
    fixture.cleanup();

    const fixture2 = await ModTestFixture.forAction('positioning', 'positioning:sit_down');

    // Should NOT find fixture1's condition
    expect(fixture2.testEnv.dataRegistry.getConditionDefinition('test:fixture1')).toBeUndefined();

    fixture2.cleanup();
  });
});
```

### New File: conditionCleanupCompleteness.test.js

```javascript
/**
 * @file Tests for complete condition cleanup
 *
 * Verifies that cleanup removes conditions from ALL storage locations
 * and that no traces remain after cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ModTestFixture from '../../../common/mods/ModTestFixture.js';
import ScopeResolverHelpers from '../../../common/mods/scopeResolverHelpers.js';

describe('condition cleanup completeness', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
  });

  afterEach(() => {
    // Don't cleanup here - tests verify cleanup behavior
  });

  it('should remove conditions from conditionStore after cleanup', () => {
    fixture.registerCondition('test:cleanup-test', { logic: { '==': [1, 1] } });

    // Verify present
    expect(fixture.testEnv.conditionStore.has('test:cleanup-test')).toBe(true);

    // Cleanup
    fixture.cleanup();

    // Verify removed
    expect(fixture.testEnv.conditionStore.has('test:cleanup-test')).toBe(false);
  });

  it('should remove conditions from dataRegistry lookup after cleanup', () => {
    fixture.registerCondition('test:data-registry-cleanup', { logic: { '==': [1, 1] } });

    fixture.cleanup();

    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:data-registry-cleanup')).toBeUndefined();
  });

  it('should remove all conditions regardless of registration order', async () => {
    fixture.registerCondition('test:early', { logic: { '==': [1, 1] } });

    await ScopeResolverHelpers.registerCustomScope(
      fixture.testEnv, 'positioning', 'close_actors'
    );

    fixture.registerCondition('test:late', { logic: { '==': [2, 2] } });

    fixture.cleanup();

    // Both should be gone
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:early')).toBeUndefined();
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:late')).toBeUndefined();
  });

  it('should only remove conditions registered by this fixture', async () => {
    const fixture2 = await ModTestFixture.forAction('positioning', 'positioning:stand_up');

    fixture.registerCondition('test:fixture1-cond', { logic: { '==': [1, 1] } });
    fixture2.registerCondition('test:fixture2-cond', { logic: { '==': [2, 2] } });

    // Cleanup only fixture1
    fixture.cleanup();

    // fixture2's condition should still exist
    expect(fixture2.testEnv.dataRegistry.getConditionDefinition('test:fixture2-cond')).toBeDefined();

    fixture2.cleanup();
  });

  it('should clear tracked conditions list after cleanup', () => {
    fixture.registerCondition('test:tracked', { logic: { '==': [1, 1] } });

    expect(fixture.getRegisteredConditions()).toContain('test:tracked');

    fixture.cleanup();

    expect(fixture.getRegisteredConditions()).toHaveLength(0);
  });
});
```

### Update: ModTestFixture.conditionRegistration.test.js

Add invariant tests:

```javascript
describe('Condition Registration Invariants', () => {
  // Property: Registered conditions are always findable
  it.each([
    ['before scope registration'],
    ['after scope registration'],
    ['after multiple scope registrations'],
  ])('registered condition should be findable %s', async (scenario) => {
    const fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');

    if (scenario.includes('after')) {
      ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
    }
    if (scenario.includes('multiple')) {
      await ScopeResolverHelpers.registerCustomScope(
        fixture.testEnv, 'positioning', 'close_actors'
      );
    }

    fixture.registerCondition('test:invariant-test', { logic: { '==': [1, 1] } });

    // INVARIANT: Always findable via dataRegistry
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:invariant-test')).toBeDefined();

    // INVARIANT: Always findable via conditionStore
    expect(fixture.testEnv.conditionStore.has('test:invariant-test')).toBe(true);

    fixture.cleanup();
  });

  // Property: Cleanup removes all traces
  it('should leave no traces after cleanup regardless of registration order', async () => {
    const fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');

    fixture.registerCondition('test:early', { logic: { '==': [1, 1] } });
    ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
    fixture.registerCondition('test:late', { logic: { '==': [2, 2] } });

    fixture.cleanup();

    // INVARIANT: No traces remain
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:early')).toBeUndefined();
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:late')).toBeUndefined();
    expect(fixture.getRegisteredConditions()).toHaveLength(0);
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

All new test files:
```bash
npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistrationCrossPaths.test.js --verbose
npm run test:unit -- tests/unit/common/mods/conditionOverrideChain.test.js --verbose
npm run test:unit -- tests/unit/common/mods/conditionCleanupCompleteness.test.js --verbose
```

All existing tests:
```bash
npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js --verbose
npm run test:integration -- tests/integration/mods/striking/ --verbose
```

### Invariants That Must Remain True

1. **Registration Completeness**: Any registered condition is findable via all paths
2. **Lookup Consistency**: Same result regardless of lookup path
3. **Cleanup Totality**: No traces after cleanup()
4. **Chain Preservation**: Override chains work correctly
5. **Fixture Isolation**: One fixture's cleanup doesn't affect another's conditions

## Verification Commands

```bash
# Run all new test files
npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistration*.test.js tests/unit/common/mods/condition*.test.js --verbose

# Run striking regression tests
npm run test:integration -- tests/integration/mods/striking/ --verbose

# Full test suite
npm run test:unit
npm run test:integration
```

## Definition of Done

- [ ] `conditionRegistrationCrossPaths.test.js` created with all scenarios
- [ ] `conditionOverrideChain.test.js` created with chain tests
- [ ] `conditionCleanupCompleteness.test.js` created with cleanup tests
- [ ] Invariant tests added to existing file
- [ ] All new tests pass
- [ ] All existing tests pass
- [ ] TESINFROB-006 regression scenario explicitly tested
