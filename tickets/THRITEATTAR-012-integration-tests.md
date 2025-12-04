# THRITEATTAR-012: Create Integration Tests for Throw Item Action

## Summary

Create comprehensive integration tests that verify the entire throw item action workflow, including action discovery, rule execution, and all four outcome scenarios.

## Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/mods/ranged/throw_item_at_target_action_discovery.test.js` | Action discovery tests |
| `tests/integration/mods/ranged/throw_item_at_target_rule_execution.test.js` | Rule execution tests |
| `tests/common/mods/ranged/throwItemFixtures.js` | Shared test fixtures |

## Test File 1: Action Discovery Tests

### throw_item_at_target_action_discovery.test.js

Test cases to implement:

```javascript
describe('ranged:throw_item_at_target action discovery', () => {
  describe('action configuration', () => {
    it('should have correct action ID (ranged:throw_item_at_target)');
    it('should have correct template (throw {throwable} at {target} ({chance}% chance))');
    it('should have no required actor components');
    it('should require items:portable on primary target');
    it('should have correct forbidden components list');
    it('should use ranged:throwable_items as primary scope');
    it('should use core:actors_in_location as secondary scope');
    it('should use skills:ranged_skill for actor skill');
    it('should use skills:defense_skill for target skill');
  });

  describe('action availability', () => {
    it('should be discoverable when actor has portable item in inventory');
    it('should be discoverable when actor has portable item wielded');
    it('should be discoverable with multiple throwable items (generates combinations)');
    it('should NOT be discoverable when actor has no portable items');
    it('should NOT be discoverable when actor has forbidden component (hugging)');
    it('should NOT be discoverable when actor has forbidden component (bending_over)');
    it('should NOT be discoverable when no other actors in location');
  });

  describe('visual properties', () => {
    it('should have correct background color (#2a4a3f)');
    it('should have correct text color (#e8f5f0)');
    it('should have correct hover background color (#3a5f52)');
    it('should have correct hover text color (#ffffff)');
  });
});
```

## Test File 2: Rule Execution Tests

### throw_item_at_target_rule_execution.test.js

Test cases to implement:

```javascript
describe('ranged:throw_item_at_target rule execution', () => {
  describe('CRITICAL_SUCCESS outcome', () => {
    it('should remove item from inventory when thrown from inventory');
    it('should unwield item when thrown from wielded slot');
    it('should place item at location');
    it('should apply damage with 1.5x multiplier');
    it('should dispatch perceptible event with correct message');
    it('should dispatch success action result event');
    it('should end turn');
  });

  describe('SUCCESS outcome', () => {
    it('should remove item from inventory');
    it('should place item at location');
    it('should apply damage with 1.0x multiplier');
    it('should dispatch perceptible event with hit message');
    it('should dispatch success action result event');
    it('should end turn');
  });

  describe('FAILURE outcome', () => {
    it('should remove item from inventory');
    it('should place item at location');
    it('should NOT apply any damage');
    it('should dispatch perceptible event with miss message');
    it('should log failure outcome');
    it('should end turn');
  });

  describe('FUMBLE outcome with collateral entity', () => {
    it('should remove item from inventory');
    it('should place item at location');
    it('should find random non-actor entity');
    it('should exclude actor and target from random selection');
    it('should dispatch perceptible event mentioning collateral entity');
    it('should NOT apply damage to collateral entity');
    it('should log failure outcome');
    it('should end turn');
  });

  describe('FUMBLE outcome without collateral entity', () => {
    it('should remove item from inventory');
    it('should place item at location');
    it('should dispatch "miss by a long shot" message when no collateral');
    it('should log failure outcome');
    it('should end turn');
  });

  describe('damage calculation', () => {
    it('should use damage_capabilities when item has them');
    it('should calculate blunt damage from weight when no damage_capabilities');
    it('should handle items with multiple damage types');
  });

  describe('skill resolution', () => {
    it('should use ranged_skill for actor (default 10 if missing)');
    it('should use defense_skill for target (default 0 if missing)');
    it('should calculate chance using ratio formula');
    it('should respect min/max bounds (5-95)');
  });
});
```

## Test File 3: Shared Fixtures

### throwItemFixtures.js

```javascript
/**
 * @file Test fixtures for throw item action tests
 */

export const createThrowingActorFixture = (overrides = {}) => ({
  id: 'throwing-actor',
  components: {
    'core:actor': {},
    'core:position': { locationId: 'test-location' },
    'items:inventory': { items: ['rock-001'] },
    'skills:ranged_skill': { value: 15 },
    ...overrides.components,
  },
  ...overrides,
});

export const createTargetActorFixture = (overrides = {}) => ({
  id: 'target-actor',
  components: {
    'core:actor': {},
    'core:position': { locationId: 'test-location' },
    'skills:defense_skill': { value: 5 },
    ...overrides.components,
  },
  ...overrides,
});

export const createPortableItemFixture = (overrides = {}) => ({
  id: 'rock-001',
  components: {
    'core:name': { value: 'Small Rock' },
    'items:portable': { weight: 1.0 },
    ...overrides.components,
  },
  ...overrides,
});

export const createWeaponFixture = (overrides = {}) => ({
  id: 'dagger-001',
  components: {
    'core:name': { value: 'Rusty Dagger' },
    'items:portable': { weight: 0.5 },
    'damage-types:damage_capabilities': {
      damages: [{ type: 'piercing', amount: 5 }],
    },
    ...overrides.components,
  },
  ...overrides,
});

export const createFurnitureFixture = (overrides = {}) => ({
  id: 'furniture-001',
  components: {
    'core:name': { value: 'Wooden Table' },
    'core:position': { locationId: 'test-location' },
    // Note: NO core:actor component
    ...overrides.components,
  },
  ...overrides,
});

export const createLocationFixture = (overrides = {}) => ({
  id: 'test-location',
  components: {
    'core:location': {},
    ...overrides.components,
  },
  ...overrides,
});
```

## Test Implementation Pattern

Use the established `ModTestFixture` pattern:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/modTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import {
  createThrowingActorFixture,
  createTargetActorFixture,
  createPortableItemFixture,
} from '../../../common/mods/ranged/throwItemFixtures.js';

describe('ranged:throw_item_at_target', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('ranged', 'ranged:throw_item_at_target');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  // Tests here...
});
```

## Out of Scope

- **DO NOT** create unit tests (THRITEATTAR-011)
- **DO NOT** modify the mod content
- **DO NOT** modify the handler implementation
- **DO NOT** test other mods' actions

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:integration tests/integration/mods/ranged/` passes all tests
2. All test cases cover the scenarios listed above
3. Tests follow the `ModTestFixture` pattern
4. Tests use domain matchers where appropriate

### Invariants That Must Remain True

1. All existing integration tests continue to pass
2. Tests follow project test patterns
3. Tests do not pollute global state
4. Tests clean up after themselves (afterEach)

## Validation Commands

```bash
# Run the specific test directory
npm run test:integration -- tests/integration/mods/ranged/

# Run action discovery tests only
npm run test:integration -- tests/integration/mods/ranged/throw_item_at_target_action_discovery.test.js

# Run rule execution tests only
npm run test:integration -- tests/integration/mods/ranged/throw_item_at_target_rule_execution.test.js

# Run all integration tests to ensure no regressions
npm run test:integration
```

## Reference Files

For understanding test patterns:
- `tests/integration/mods/weapons/swing_at_target_action_discovery.test.js` - Action discovery pattern
- `tests/integration/mods/weapons/swingAtTargetOutcomeResolution.test.js` - Outcome test pattern
- `tests/common/mods/modTestFixture.js` - ModTestFixture class
- `tests/common/mods/domainMatchers.js` - Custom Jest matchers
- `docs/testing/mod-testing-guide.md` - Complete testing guide

## Dependencies

- THRITEATTAR-001 through THRITEATTAR-010 (all mod content must exist)
- THRITEATTAR-011 (unit tests should pass first)

## Blocks

- None (this is a terminal ticket)

## Notes

- Some tests may need to mock the random outcome resolution to test specific scenarios
- Fumble tests require furniture or other non-actor entities at the location
- Damage tests should verify both weapon-based and weight-based damage calculation
