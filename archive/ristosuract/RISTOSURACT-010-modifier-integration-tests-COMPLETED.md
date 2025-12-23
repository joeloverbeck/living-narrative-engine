# RISTOSURACT-010: Modifier integration tests for rise_to_surface

**Status**: ✅ COMPLETED

## Summary

Create integration tests for the visibility-based modifiers in the `rise_to_surface` action, verifying that different water visibility levels correctly affect success chances.

## Files to Touch

- `tests/integration/mods/liquids/rise_to_surface_modifiers.test.js` (NEW FILE)

## Out of Scope

- **DO NOT** modify any mod data files (action, rule, condition, component)
- **DO NOT** modify any existing test files
- **DO NOT** create tests for action discovery (handled in RISTOSURACT-007)
- **DO NOT** create tests for rule execution (handled in RISTOSURACT-008)
- **DO NOT** create tests for component schema (handled in RISTOSURACT-009)
- **DO NOT** test actual random outcome resolution (only modifier application)

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Integration tests for rise_to_surface visibility-based modifiers.
 * @description Validates modifier structure and application based on liquid body visibility.
 */

import { describe, it, expect } from '@jest/globals';
import riseToSurfaceAction from '../../../../data/mods/liquids/actions/rise_to_surface.action.json' assert { type: 'json' };

describe('rise_to_surface visibility modifiers', () => {
  // Test implementation...
});
```

### Required Test Sections

#### 1. Modifier Structure Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Modifiers array exists | Action has modifiers | `riseToSurfaceAction.chanceBased.modifiers` is array |
| Four visibility modifiers | One per visibility level | `modifiers.length >= 4` |
| Pristine modifier exists | Modifier for pristine | Find modifier with `pristine` in condition |
| Clear modifier exists | Modifier for clear | Find modifier with `clear` in condition |
| Murky modifier exists | Modifier for murky | Find modifier with `murky` in condition |
| Opaque modifier exists | Modifier for opaque | Find modifier with `opaque` in condition |

#### 2. Modifier Value Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Pristine bonus | +10 flat bonus | `value === 10`, `type === 'flat'` |
| Clear bonus | +5 flat bonus | `value === 5`, `type === 'flat'` |
| Murky penalty | -5 flat penalty | `value === -5`, `type === 'flat'` |
| Opaque penalty | -10 flat penalty | `value === -10`, `type === 'flat'` |

#### 3. Modifier Condition Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Condition structure | Uses get_component_value | Modifier conditions use correct operator |
| Component path | Accesses liquid_body visibility | Path accesses `liquids:liquid_body` and `visibility` |
| Entity reference | Uses actor's in_liquid_body component | References `liquids-states:in_liquid_body.liquid_body_id` |

#### 4. Modifier Tag/Description Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Pristine tag | Human-readable tag | `tag` contains 'pristine' |
| Clear tag | Human-readable tag | `tag` contains 'clear' |
| Murky tag | Human-readable tag | `tag` contains 'murky' |
| Opaque tag | Human-readable tag | `tag` contains 'opaque' |
| Pristine description | Has description | `description` is non-empty string |
| Clear description | Has description | `description` is non-empty string |
| Murky description | Has description | `description` is non-empty string |
| Opaque description | Has description | `description` is non-empty string |

**Note**: The actual implementation uses `tag` and `description` properties instead of a single `label` property.

### Test Pattern Example

```javascript
describe('Modifier structure', () => {
  const modifiers = riseToSurfaceAction.chanceBased?.modifiers || [];

  const findModifierByVisibility = (visibility) => {
    return modifiers.find((mod) => {
      // Note: condition is wrapped in { condition: { logic: { ... } } }
      const condition = JSON.stringify(mod.condition);
      return condition.includes(visibility);
    });
  };

  it('has four visibility-based modifiers', () => {
    const visibilities = ['pristine', 'clear', 'murky', 'opaque'];
    const foundModifiers = visibilities.map(findModifierByVisibility);

    expect(foundModifiers.every(Boolean)).toBe(true);
  });

  describe('Pristine visibility modifier', () => {
    const pristineMod = findModifierByVisibility('pristine');

    it('applies +10 flat bonus', () => {
      expect(pristineMod.value).toBe(10);
      expect(pristineMod.type).toBe('flat');
    });

    it('has descriptive tag and description', () => {
      expect(pristineMod.tag).toBeDefined();
      expect(pristineMod.tag.length).toBeGreaterThan(0);
      expect(pristineMod.description).toBeDefined();
      expect(pristineMod.description.length).toBeGreaterThan(0);
    });
  });

  describe('Clear visibility modifier', () => {
    const clearMod = findModifierByVisibility('clear');

    it('applies +5 flat bonus', () => {
      expect(clearMod.value).toBe(5);
      expect(clearMod.type).toBe('flat');
    });
  });

  describe('Murky visibility modifier', () => {
    const murkyMod = findModifierByVisibility('murky');

    it('applies -5 flat penalty', () => {
      expect(murkyMod.value).toBe(-5);
      expect(murkyMod.type).toBe('flat');
    });
  });

  describe('Opaque visibility modifier', () => {
    const opaqueMod = findModifierByVisibility('opaque');

    it('applies -10 flat penalty', () => {
      expect(opaqueMod.value).toBe(-10);
      expect(opaqueMod.type).toBe('flat');
    });
  });
});
```

### Modifier Condition Pattern

Each modifier condition should follow this structure (note the `logic` wrapper):

```json
{
  "condition": {
    "logic": {
      "==": [
        {
          "get_component_value": [
            { "var": "entity.actor.components.liquids-states:in_liquid_body.liquid_body_id" },
            "liquids:liquid_body",
            "visibility"
          ]
        },
        "pristine"
      ]
    }
  }
}
```

**Important**: The actual implementation wraps the JSON Logic expression in a `{ "condition": { "logic": { ... } } }` structure, not a bare JSON Logic expression.

#### 5. Condition Logic Verification Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Has logic wrapper | Condition wrapped in logic object | `mod.condition.logic` exists |
| Uses equality check | Condition uses == operator | `mod.condition.logic['==']` exists |
| Uses get_component_value | Fetches from another entity | Contains `get_component_value` operator |
| Correct entity path | Actor's in_liquid_body reference | Contains `liquids-states:in_liquid_body.liquid_body_id` |
| Correct component type | Liquid body component | Contains `liquids:liquid_body` |
| Correct property | Visibility property | Contains `visibility` |

## Acceptance Criteria

### Tests That Must Pass

- [x] `npm run test:integration -- tests/integration/mods/liquids/rise_to_surface_modifiers.test.js` passes
- [x] All four visibility modifiers are validated
- [x] Modifier values match specification (+10, +5, -5, -10)

### Test Coverage Checks

- [x] Modifier structure section has at least 6 tests (7 tests)
- [x] Modifier value section has at least 4 tests (8 tests)
- [x] Modifier condition section has at least 3 tests (3 tests)
- [x] Modifier tag/description section has at least 4 tests (8 tests)
- [x] Condition logic section has at least 5 tests (6 tests)

### Invariants That Must Remain True

- [x] No existing test files are modified
- [x] Tests only verify JSON structure, not runtime chance calculation
- [x] Tests validate modifier condition patterns match expected structure

## Verification Commands

```bash
# Run the new tests
npm run test:integration -- tests/integration/mods/liquids/rise_to_surface_modifiers.test.js

# Run all liquids tests to ensure no regressions
npm run test:integration -- tests/integration/mods/liquids/

# Validate both mods
npm run validate:mod:liquids
```

## Dependencies

- RISTOSURACT-003 (action file must exist with modifiers defined)
- RISTOSURACT-006 (manifest must be updated)

## Blocks

- None (this is a testing ticket)

## Reference

- Spec section: `specs/rise-to-surface-action.md` Section 7.4
- Action modifier structure: `specs/rise-to-surface-action.md` Section 4

## Notes on Modifier Testing

### Why Test Structure Only

Testing actual modifier application would require:
1. Full game runtime with chance resolution
2. Mocking random outcomes
3. Complex test fixtures

Instead, this ticket focuses on **structural validation**:
- Modifiers exist with correct values
- Conditions are properly formed
- Labels are present for UI display

### Runtime Testing (If Needed)

If runtime modifier testing becomes necessary, consider:
1. Creating a separate E2E test using game fixtures
2. Mocking the RESOLVE_OUTCOME operator to test modifier summation
3. Using snapshot testing for expected chance display output

---

## Outcome

**Completed on**: 2025-12-23

### What was changed vs originally planned

**Originally planned**:
- Create test file with structure validation for modifiers
- Tests for `label` property on modifiers
- Direct JSON Logic condition structure (without `logic` wrapper)

**Actually changed**:

1. **Ticket corrections** (before implementation):
   - Updated section 4 from "Modifier Label Tests" to "Modifier Tag/Description Tests" because the actual action uses `tag` and `description` properties, not `label`
   - Updated test pattern example to use `tag` and `description` assertions
   - Updated modifier condition pattern to show the actual `{ "condition": { "logic": { ... } } }` structure
   - Added note about the `logic` wrapper in the condition structure
   - Updated section 5 to include "Has logic wrapper" test

2. **Test file created**: `tests/integration/mods/liquids/rise_to_surface_modifiers.test.js`
   - 36 tests total across 7 describe blocks
   - Validates modifier structure, values, conditions, tags/descriptions, logic structure, ordering, and targetRole
   - Added extra tests beyond minimum requirements for ordering/progression and targetRole validation

### Test Summary

| Section | Required | Actual |
|---------|----------|--------|
| Modifier structure | 6 | 7 |
| Modifier values | 4 | 8 |
| Modifier conditions | 3 | 3 |
| Tag/description | 4 | 8 |
| Condition logic | 5 | 6 |
| **Extra**: Ordering | - | 3 |
| **Extra**: targetRole | - | 1 |
| **Total** | 22+ | 36 |

All 225 tests in `tests/integration/mods/liquids/` pass, confirming no regressions.
