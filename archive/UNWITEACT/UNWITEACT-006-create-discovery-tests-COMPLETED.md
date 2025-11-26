# UNWITEACT-006: Create Action Discovery Tests for `unwield_item`

**Status: ✅ COMPLETED**

## Summary

Create integration tests for the `unwield_item` action definition, validating the action structure, scope configuration, required components, and discoverability conditions.

## Dependencies

- **UNWITEACT-003** (action file) must be completed - tests import the action JSON

## File to Create

### `tests/integration/mods/weapons/unwield_item_action_discovery.test.js`

```javascript
/**
 * @file Integration tests for unwield_item action discovery
 * Tests action structure, scope configuration, and discoverability
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import actionJson from '../../../../data/mods/weapons/actions/unwield_item.action.json' assert { type: 'json' };

describe('unwield_item action definition', () => {
  describe('Action Structure', () => {
    it('should have correct action ID', () => {
      expect(actionJson.id).toBe('weapons:unwield_item');
    });

    it('should have correct name', () => {
      expect(actionJson.name).toBe('Unwield Item');
    });

    it('should have description', () => {
      expect(actionJson.description).toBeDefined();
      expect(typeof actionJson.description).toBe('string');
      expect(actionJson.description.length).toBeGreaterThan(0);
    });

    it('should enable combination generation', () => {
      expect(actionJson.generateCombinations).toBe(true);
    });

    it('should have correct template', () => {
      expect(actionJson.template).toBe('unwield {target}');
    });
  });

  describe('Required Components', () => {
    it('should require actor to have inventory component', () => {
      expect(actionJson.required_components).toBeDefined();
      expect(actionJson.required_components.actor).toContain('items:inventory');
    });

    it('should require actor to have wielding component', () => {
      expect(actionJson.required_components.actor).toContain('positioning:wielding');
    });

    it('should require exactly two actor components', () => {
      expect(actionJson.required_components.actor).toHaveLength(2);
    });
  });

  describe('Prerequisites', () => {
    it('should NOT have prerequisites (unlike wield_threateningly)', () => {
      // unwield_item does not need to check for free appendage
      // because we're releasing one, not acquiring one
      expect(actionJson.prerequisites).toBeUndefined();
    });
  });

  describe('Target Configuration', () => {
    it('should have primary target defined', () => {
      expect(actionJson.targets).toBeDefined();
      expect(actionJson.targets.primary).toBeDefined();
    });

    it('should use wielded_items scope for primary target', () => {
      expect(actionJson.targets.primary.scope).toBe('weapons:wielded_items');
    });

    it('should use "target" placeholder for primary target', () => {
      expect(actionJson.targets.primary.placeholder).toBe('target');
    });

    it('should have description for primary target', () => {
      expect(actionJson.targets.primary.description).toBeDefined();
      expect(typeof actionJson.targets.primary.description).toBe('string');
    });

    it('should not have secondary or tertiary targets', () => {
      expect(actionJson.targets.secondary).toBeUndefined();
      expect(actionJson.targets.tertiary).toBeUndefined();
    });
  });

  describe('Visual Configuration - Arctic Steel Color Scheme', () => {
    it('should have visual properties defined', () => {
      expect(actionJson.visual).toBeDefined();
      expect(typeof actionJson.visual).toBe('object');
    });

    it('should use Arctic Steel background color (#112a46)', () => {
      expect(actionJson.visual.backgroundColor).toBe('#112a46');
    });

    it('should use Arctic Steel text color (#e6f1ff)', () => {
      expect(actionJson.visual.textColor).toBe('#e6f1ff');
    });

    it('should use Arctic Steel hover background color (#0b3954)', () => {
      expect(actionJson.visual.hoverBackgroundColor).toBe('#0b3954');
    });

    it('should use Arctic Steel hover text color (#f0f4f8)', () => {
      expect(actionJson.visual.hoverTextColor).toBe('#f0f4f8');
    });
  });

  describe('Schema Compliance', () => {
    it('should reference correct schema', () => {
      expect(actionJson.$schema).toBe('schema://living-narrative-engine/action.schema.json');
    });

    it('should have all required action properties', () => {
      expect(actionJson).toHaveProperty('$schema');
      expect(actionJson).toHaveProperty('id');
      expect(actionJson).toHaveProperty('name');
      expect(actionJson).toHaveProperty('description');
      expect(actionJson).toHaveProperty('template');
      expect(actionJson).toHaveProperty('targets');
      expect(actionJson).toHaveProperty('visual');
      // Note: required_components is already tested in its own describe block
    });
  });
});
```

## Files to Modify

None

## Out of Scope

- **DO NOT** modify any existing test files
- **DO NOT** create tests for rule execution (that's UNWITEACT-007)
- **DO NOT** modify any production code
- **DO NOT** create fixture files or test helpers
- **DO NOT** test discoverability with full runtime (just JSON structure tests)

## Test Categories Explained

### Action Structure Tests
Verify the basic action definition matches the spec:
- Correct `id`, `name`, `template`
- Description exists and is non-empty
- `generateCombinations` is true

### Required Components Tests
Verify the action requires both:
- `items:inventory` - actor has inventory system
- `positioning:wielding` - actor is currently wielding something

This is the KEY difference from `wield_threateningly` which only requires `items:inventory`.

### Prerequisites Tests
Verify there are NO prerequisites. Unlike wield (which needs free appendage), unwield releases an appendage so no prerequisite check is needed.

### Target Configuration Tests
Verify the scope is `weapons:wielded_items` (created in UNWITEACT-001), not `weapons:grabbable_weapons_in_inventory` (used by wield).

### Visual Configuration Tests
Verify the Arctic Steel color scheme matches `wield_threateningly` for visual consistency.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- tests/integration/mods/weapons/unwield_item_action_discovery.test.js
npm run test:ci  # Full test suite including new tests
```

### Manual Verification

1. Test file exists at `tests/integration/mods/weapons/unwield_item_action_discovery.test.js`
2. All tests pass when run individually
3. Tests correctly import the action JSON
4. Test descriptions are clear and match the spec

### Invariants That Must Remain True

1. All existing weapons tests pass
2. No existing test files are modified
3. No production code is modified
4. Test follows project testing patterns (see existing `wield_threateningly_action_discovery.test.js`)

## Outcome

### What Was Changed
- Created `tests/integration/mods/weapons/unwield_item_action_discovery.test.js` with 21 tests covering:
  - Action Structure (5 tests)
  - Required Components (3 tests)
  - Prerequisites (1 test)
  - Target Configuration (5 tests)
  - Visual Configuration - Arctic Steel Color Scheme (5 tests)
  - Schema Compliance (2 tests)

### Discrepancies vs Original Plan
- **Minor correction**: Removed `required_components` from the "should have all required action properties" test assertion to match the pattern used in `wield_threateningly_action_discovery.test.js`. The required_components are already thoroughly tested in their own describe block.

### Test Results
- All 21 new tests pass
- All 126 weapons integration tests pass (12 test suites)
- No existing tests modified
- No production code modified
