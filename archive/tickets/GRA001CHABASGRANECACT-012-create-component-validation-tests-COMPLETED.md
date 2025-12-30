# GRA001CHABASGRANECACT-012: Create Component Validation Tests

**Status: ✅ COMPLETED**

## Summary
Create the integration test file `grabbing_states_component_validation.test.js` that verifies the new `grabbing-states` mod components are correctly structured and follow established patterns.

## File List (Files to Touch)

### Files to Create
- `tests/integration/mods/grabbing/grabbing_states_component_validation.test.js`

## Out of Scope

**DO NOT modify or touch:**
- Any other test files in the grabbing folder
- Any mod data files in `data/mods/`
- Any source code in `src/`
- Any test helper files in `tests/common/`
- Action discovery tests (separate ticket)
- Rule execution tests (separate ticket)

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Integration tests for grabbing-states mod component validation.
 * @description Verifies the grabbing_neck and neck_grabbed components are
 * correctly structured with proper schemas and activity metadata.
 */

import { describe, it, expect } from '@jest/globals';
import grabbingNeckComponent from '../../../../data/mods/grabbing-states/components/grabbing_neck.component.json';
import neckGrabbedComponent from '../../../../data/mods/grabbing-states/components/neck_grabbed.component.json';

describe('grabbing-states component validation', () => {
  // Tests
});
```

### Test Cases Required

#### grabbing_neck Component Tests
| Test Case | Description |
|-----------|-------------|
| `grabbing_neck has valid schema reference` | `$schema` points to component.schema.json |
| `grabbing_neck has correct ID format` | ID is `grabbing-states:grabbing_neck` |
| `grabbing_neck has meaningful description` | Description is present and non-empty |
| `grabbing_neck requires grabbed_entity_id` | In required array |
| `grabbing_neck requires initiated` | In required array |
| `grabbing_neck grabbed_entity_id has correct pattern` | Entity ID pattern allows namespaced and simple IDs |
| `grabbing_neck has consented field with default false` | Boolean with default |
| `grabbing_neck has activityMetadata` | Activity metadata object exists |
| `grabbing_neck activityMetadata has correct template` | Uses `{actor}` and `{target}` placeholders |
| `grabbing_neck activityMetadata has targetRole pointing to grabbed_entity_id` | Correct field reference |
| `grabbing_neck activityMetadata has priority 70` | Higher than restraining (67) |

#### neck_grabbed Component Tests
| Test Case | Description |
|-----------|-------------|
| `neck_grabbed has valid schema reference` | `$schema` points to component.schema.json |
| `neck_grabbed has correct ID format` | ID is `grabbing-states:neck_grabbed` |
| `neck_grabbed has meaningful description` | Description is present and non-empty |
| `neck_grabbed requires grabbing_entity_id` | In required array |
| `neck_grabbed does NOT require initiated` | Passive role, no initiated field |
| `neck_grabbed grabbing_entity_id has correct pattern` | Entity ID pattern allows namespaced and simple IDs |
| `neck_grabbed has consented field with default false` | Boolean with default |
| `neck_grabbed has activityMetadata` | Activity metadata object exists |
| `neck_grabbed activityMetadata has correct template` | Uses `{actor}` and `{target}` placeholders |
| `neck_grabbed activityMetadata has targetRole pointing to grabbing_entity_id` | Correct field reference |
| `neck_grabbed activityMetadata has priority 66` | Lower than grabbing_neck (70) |

#### Cross-Component Validation Tests
| Test Case | Description |
|-----------|-------------|
| `grabbing_neck priority is higher than neck_grabbed priority` | 70 > 66 |
| `both components use additionalProperties false` | No extra properties allowed |
| `entity ID fields use same pattern in both components` | Pattern consistency |
| `both components have shouldDescribeInActivity default true` | Activity descriptions enabled |

### Test Setup Pattern

```javascript
describe('grabbing-states component validation', () => {
  describe('grabbing_neck component', () => {
    it('has valid schema reference', () => {
      expect(grabbingNeckComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('has correct ID format', () => {
      expect(grabbingNeckComponent.id).toBe('grabbing-states:grabbing_neck');
    });

    // ... more tests
  });

  describe('neck_grabbed component', () => {
    // ... tests
  });

  describe('cross-component validation', () => {
    // ... tests
  });
});
```

## Acceptance Criteria

### Tests That Must Pass
- All new tests in this file pass: `npm run test:integration -- tests/integration/mods/grabbing/grabbing_states_component_validation.test.js`
- Existing tests in grabbing folder pass: `npm run test:integration -- tests/integration/mods/grabbing/`
- No regressions in overall test suite

### Invariants That Must Remain True
- Test file follows established component validation patterns
- Tests directly import component JSON files
- All assertions use Jest's `expect()` API
- Tests are organized by component and then by cross-component concerns
- Priority ordering is validated (grabbing_neck > neck_grabbed)
- Required fields are explicitly validated

## Verification Steps

1. File exists: `tests/integration/mods/grabbing/grabbing_states_component_validation.test.js`
2. Tests pass: `npm run test:integration -- tests/integration/mods/grabbing/grabbing_states_component_validation.test.js`
3. All component fields are validated
4. Activity metadata is validated
5. Priority ordering is validated
6. Schema adherence is validated

## Dependencies
- GRA001CHABASGRANECACT-002 (grabbing_neck component must exist)
- GRA001CHABASGRANECACT-003 (neck_grabbed component must exist)

## Blocked By
- GRA001CHABASGRANECACT-002
- GRA001CHABASGRANECACT-003

## Blocks
- None

## Test Count Estimate
- grabbing_neck: 11 tests
- neck_grabbed: 11 tests
- Cross-component: 4 tests
- **Total: ~26 tests**

## Notes
This test file validates the component definitions themselves, not their runtime behavior. Runtime behavior (adding/removing components during rule execution) is tested in ticket 011.

---

## Outcome

**Completed: 2025-12-30**

### What Was Actually Changed vs Originally Planned

**Planned:**
- Create test file with ~26 tests covering grabbing_neck, neck_grabbed, and cross-component validation

**Actual:**
- Created `tests/integration/mods/grabbing/grabbing_states_component_validation.test.js` with **30 tests** (4 more than estimated)
- All ticket assumptions about component structure were accurate - no corrections needed to the ticket
- Followed the established pattern from `tests/integration/mods/attack-states/attacked_by_component.test.js`

**Additional Tests Beyond Estimate:**
- Added `has shouldDescribeInActivity default true` test for grabbing_neck component
- Added `uses additionalProperties false` test for grabbing_neck component
- Added `has shouldDescribeInActivity default true` test for neck_grabbed component
- Added `uses additionalProperties false` test for neck_grabbed component

**Test Results:**
- All 30 new tests pass
- All 64 tests in `tests/integration/mods/grabbing/` pass with no regressions
- Test execution time: ~0.5 seconds

**Files Created:**
- `tests/integration/mods/grabbing/grabbing_states_component_validation.test.js`

**Files Modified:**
- None (as specified in Out of Scope)

**Deviations:**
- None - implementation followed ticket exactly, with minor test count increase for completeness
