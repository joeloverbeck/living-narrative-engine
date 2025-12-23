# RISTOSURACT-008: Rule execution tests for rise_to_surface

## Status: ✅ COMPLETED

## Summary

Create integration tests for the `handle_rise_to_surface` rule, verifying condition wiring, setup operations, outcome branches, and perception event formatting.

## Files to Touch

- `tests/integration/mods/liquids/rise_to_surface_rule_execution.test.js` (NEW FILE)

## Out of Scope

- **DO NOT** modify any mod data files
- **DO NOT** modify any existing test files
- **DO NOT** create tests for action discovery (handled in RISTOSURACT-007)
- **DO NOT** create tests for modifiers (handled in RISTOSURACT-010)
- **DO NOT** create tests for component schema (handled in RISTOSURACT-009)

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Integration tests for handle_rise_to_surface rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, and branch side effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handleRiseRule from '../../../../data/mods/liquids/rules/handle_rise_to_surface.rule.json' assert { type: 'json' };
import eventIsActionRise from '../../../../data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json' assert { type: 'json' };
import liquidsManifest from '../../../../data/mods/liquids/mod-manifest.json' assert { type: 'json' };

// Helper function
const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_rise_to_surface rule', () => {
  // Test implementation...
});
```

### Required Test Sections

#### 1. Rule Registration Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Rule ID | Correct rule_id | `rule_id === 'handle_rise_to_surface'` |
| Event type | Triggers on attempt_action | `event_type === 'core:attempt_action'` |
| Condition ref | References correct condition | `condition_ref === 'liquids:event-is-action-rise-to-surface'` |
| Condition ID | Condition has correct ID | `id === 'liquids:event-is-action-rise-to-surface'` |
| Condition logic | Checks correct action | Logic checks `liquids:rise_to_surface` |
| Manifest rules | Rule in manifest | Array contains `'handle_rise_to_surface.rule.json'` |
| Manifest conditions | Condition in manifest | Array contains `'event-is-action-rise-to-surface.condition.json'` |

#### 2. Setup Operations Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Actor name | GET_NAME for actor | `result_variable === 'actorName'` |
| Liquid body name | GET_NAME for primary target | Uses `{event.payload.primaryId}`, stores in `liquidBodyName` |
| Position query | QUERY_COMPONENT for position | `component_type === 'core:position'`, `result_variable === 'actorPosition'` |
| Liquid body query | QUERY_COMPONENT for liquid_body | `component_type === 'liquids:liquid_body'`, `result_variable === 'liquidBodyComponent'` |
| Resolve outcome | RESOLVE_OUTCOME setup | Uses `skills:mobility_skill`, `difficulty_modifier === 50`, `result_variable === 'surfaceResult'` |
| Location variable | SET_VARIABLE for locationId | `value === '{context.actorPosition.locationId}'` |
| Visibility variable | SET_VARIABLE for liquidVisibility | `value === '{context.liquidBodyComponent.visibility}'` |

#### 3. Outcome Branch Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Branch count | Four IF branches exist | `ifOps.length === 4` |
| CRITICAL_SUCCESS exists | Branch for critical success | `findIfByOutcome('CRITICAL_SUCCESS')` is defined |
| SUCCESS exists | Branch for success | `findIfByOutcome('SUCCESS')` is defined |
| FAILURE exists | Branch for failure | `findIfByOutcome('FAILURE')` is defined |
| FUMBLE exists | Branch for fumble | `findIfByOutcome('FUMBLE')` is defined |

#### 4. Success Branches Tests (CRITICAL_SUCCESS and SUCCESS)

| Test | Description | Assertion |
|------|-------------|-----------|
| Remove submerged | REMOVE_COMPONENT for submerged | `component_type === 'liquids-states:submerged'`, `entity_ref === 'actor'` |
| Regenerate description | REGENERATE_DESCRIPTION called | Operation exists in then_actions |
| Perception event | DISPATCH_PERCEPTIBLE_EVENT | Operation exists with required fields |
| Success macro | Uses success macro | Contains `core:logSuccessOutcomeAndEndTurn` |

#### 5. Failure Branches Tests (FAILURE and FUMBLE)

| Test | Description | Assertion |
|------|-------------|-----------|
| No remove component | No REMOVE_COMPONENT | Branch does NOT contain REMOVE_COMPONENT |
| No regenerate | No REGENERATE_DESCRIPTION | Branch does NOT contain REGENERATE_DESCRIPTION |
| Perception event | DISPATCH_PERCEPTIBLE_EVENT | Operation exists |
| Failure macro | Uses failure macro | Contains `core:logFailureOutcomeAndEndTurn` |

#### 6. Perception Event Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Location | Uses actor position | `location_id === '{context.actorPosition.locationId}'` |
| Perception type | Physical self action | `perception_type === 'physical.self_action'` |
| Actor description | First person included | `actor_description` is present |
| Alternate auditory | Sound fallback | `alternate_descriptions.auditory` is present |
| Alternate tactile | Touch fallback | `alternate_descriptions.tactile` is present |
| Visibility in text | Message includes visibility | `description_text` contains `{context.liquidVisibility}` |

## Acceptance Criteria

### Tests That Must Pass

- [x] `npm run test:integration -- tests/integration/mods/liquids/rise_to_surface_rule_execution.test.js` passes
- [x] All assertions verify rule structure matches specification

### Test Coverage Checks

- [x] Registration section has at least 7 tests
- [x] Setup operations section has at least 7 tests
- [x] Outcome branch section has 5 tests (count + 4 existence)
- [x] Success branches section has at least 4 tests per branch
- [x] Failure branches section has at least 4 tests per branch
- [x] Perception event section has at least 6 tests

### Invariants That Must Remain True

- [x] No existing test files are modified
- [x] Tests follow existing patterns from swim_to_connected_liquid_body_rule_execution.test.js
- [x] Tests only verify JSON structure, not runtime behavior

## Verification Commands

```bash
# Run the new tests
npm run test:integration -- tests/integration/mods/liquids/rise_to_surface_rule_execution.test.js

# Run all liquids tests to ensure no regressions
npm run test:integration -- tests/integration/mods/liquids/
```

## Dependencies

- RISTOSURACT-006 (manifest must be updated)

## Blocks

- None (this is a testing ticket)

## Reference

- Pattern reference: `tests/integration/mods/liquids/swim_to_connected_liquid_body_rule_execution.test.js`
- Spec section: `specs/rise-to-surface-action.md` Section 7.2

---

## Outcome

### What Was Actually Changed

**New File Created:**
- `tests/integration/mods/liquids/rise_to_surface_rule_execution.test.js` (725 lines, 38 tests)

### Test Coverage Summary

| Section | Required | Actual |
|---------|----------|--------|
| Registration | 7 | 7 |
| Setup Operations | 7 | 7 |
| Outcome Branches | 5 | 5 |
| Success Branches | 8 | 10 |
| Failure Branches | 8 | 9 |
| Total | 35 | 38 |

### Additional Tests Beyond Requirements

The implementation exceeded requirements with additional validation tests:
- **Turn Ending Guarantees**: 3 tests verifying all branches have turn-ending macros
- **Perception Type Validation**: 2 tests ensuring valid perception types
- **State Update Order Validation**: 1 test verifying REMOVE_COMPONENT before REGENERATE_DESCRIPTION
- **Visibility Placeholder Validation**: 1 test ensuring visibility interpolation in all descriptions

### Test Results

```
PASS tests/integration/mods/liquids/rise_to_surface_rule_execution.test.js
Test Suites: 1 passed, 1 total
Tests:       38 passed, 38 total
```

All liquids test suites pass (13 suites, 189 tests total).

### Deviation from Original Plan

**None** - All ticket assumptions were validated against the actual rule JSON and found to be correct. Implementation followed the ticket exactly with additional edge case coverage.
