# GRA001CHABASGRANECACT-011: Create Rule Execution Tests

## Summary
Create the integration test file `grab_neck_target_rule_execution.test.js` that verifies the rule correctly handles all four outcomes (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE) with proper state changes and perceptible event dispatching. Use the existing rule wiring test as the static baseline and focus this file on runtime execution.

Status: Completed

## File List (Files to Touch)

### Files to Create
- `tests/integration/mods/grabbing/grab_neck_target_rule_execution.test.js`

## Out of Scope

**DO NOT modify or touch:**
- `tests/integration/mods/grabbing/squeeze_neck_with_both_hands_action_discovery.test.js`
- Any mod data files in `data/mods/`
- Any source code in `src/`
- Any test helper files in `tests/common/`
- Action discovery tests (separate ticket)
- Component validation tests (separate ticket)

## Implementation Details

### Updated Assumptions
- The mod test handler factory's chanceCalculationService mock always returns `SUCCESS`. To execute non-SUCCESS outcomes, override the `RESOLVE_OUTCOME` handler in the test environment (in the test file only).
- `ModTestFixture.forRule()` auto-loads conditions using rule naming conventions; `handle_grab_neck_target` does not map to `event-is-action-grab-neck-target`. Use `ModTestFixture.forAction()` so the correct condition auto-loads.
- The existing `tests/integration/mods/grabbing/handle_grab_neck_target_rule_validation.test.js` already validates static JSON structure (narratives, components, macros). This ticket should avoid duplicating that static coverage and focus on runtime side effects and event payloads.
- The ModTestHandlerFactory registers `LOCK_GRABBING` as a mocked handler in grabbing tests; validate the call parameters instead of appendage state changes.

### Test File Structure

```javascript
/**
 * @file Integration tests for grabbing:grab_neck_target rule execution.
 * @description Verifies the rule correctly handles all outcomes with proper
 * state changes, appendage locking, and sense-aware perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
// Additional imports as needed for rule execution testing
```

### Test Cases Required

#### CRITICAL_SUCCESS Outcome Tests
| Test Case | Description |
|-----------|-------------|
| `adds grabbing_neck component to actor on CRITICAL_SUCCESS` | Actor gets `grabbing-states:grabbing_neck` with correct data |
| `adds neck_grabbed component to target on CRITICAL_SUCCESS` | Target gets `grabbing-states:neck_grabbed` with correct data |
| `locks 1 appendage on actor on CRITICAL_SUCCESS` | One grabbing appendage is locked and holds the target |
| `dispatches perceptible event with critical success narrative` | Event uses critical success narrative and alternate descriptions |

#### SUCCESS Outcome Tests
| Test Case | Description |
|-----------|-------------|
| `adds grabbing_neck component to actor on SUCCESS` | Actor gets component with same structure as critical |
| `adds neck_grabbed component to target on SUCCESS` | Target gets component |
| `locks 1 appendage on actor on SUCCESS` | One grabbing appendage is locked and holds the target |
| `dispatches perceptible event with success narrative` | Event includes firm hold narrative |

#### FAILURE Outcome Tests
| Test Case | Description |
|-----------|-------------|
| `does not add grabbing_neck component on FAILURE` | Actor state unchanged |
| `does not add neck_grabbed component on FAILURE` | Target state unchanged |
| `does not lock appendages on FAILURE` | No grabbing appendages are locked |
| `dispatches perceptible event with failure narrative` | Event includes evasion narrative and auditory alternate description |

#### FUMBLE Outcome Tests
| Test Case | Description |
|-----------|-------------|
| `adds fallen component to actor on FUMBLE` | Actor gets `recovery-states:fallen` |
| `does not add grabbing_neck component on FUMBLE` | Actor doesn't get grabbing state |
| `does not add neck_grabbed component to target on FUMBLE` | Target state unchanged |
| `does not lock appendages on FUMBLE` | No grabbing appendages are locked |
| `dispatches perceptible event with fumble narrative` | Event includes crash/fall narrative and alternate descriptions |

#### Component Data Validation Tests
Validate component data as part of the SUCCESS/CRITICAL_SUCCESS execution assertions to avoid duplicating static JSON structure tests.

#### Perceptible Event Structure Tests
Verify runtime event payload fields from the dispatched `core:perceptible_event` (descriptionText, actorDescription, targetDescription, perceptionType, alternateDescriptions).

### Test Setup Pattern

```javascript
describe('grabbing:grab_neck_target rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('grabbing', 'grabbing:grab_neck_target');
    // Override RESOLVE_OUTCOME in tests as needed to force outcomes.
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('CRITICAL_SUCCESS outcome', () => {
    // Tests for critical success
  });

  describe('SUCCESS outcome', () => {
    // Tests for success
  });

  describe('FAILURE outcome', () => {
    // Tests for failure
  });

  describe('FUMBLE outcome', () => {
    // Tests for fumble
  });

  describe('component data validation', () => {
    // Tests for data structure
  });

  describe('perceptible event structure', () => {
    // Tests for event format
  });
});
```

## Acceptance Criteria

### Tests That Must Pass
- All new tests in this file pass: `npm run test:integration -- tests/integration/mods/grabbing/grab_neck_target_rule_execution.test.js`
- Existing tests in grabbing folder pass: `npm run test:integration -- tests/integration/mods/grabbing/`
- No regressions in overall test suite

### Invariants That Must Remain True
- Test file follows established patterns from other rule execution tests
- Uses `ModTestFixture.forRule()` factory method (if available) or appropriate setup
- Each outcome is tested independently
- State changes are verified through component presence/absence
- Perceptible events are captured and validated
- All assertions use Jest's `expect()` API
- `beforeEach` and `afterEach` properly initialize and cleanup

## Verification Steps

1. File exists: `tests/integration/mods/grabbing/grab_neck_target_rule_execution.test.js`
2. Tests pass: `npm run test:integration -- tests/integration/mods/grabbing/grab_neck_target_rule_execution.test.js`
3. All four outcomes are tested
4. Component data structure is validated
5. Perceptible events are validated
6. Appendage locking is verified (or verified NOT to occur)

## Dependencies
- GRA001CHABASGRANECACT-007 (rule must exist)
- GRA001CHABASGRANECACT-008 (old files must be deleted)

## Blocked By
- GRA001CHABASGRANECACT-008

## Blocks
- None

## Test Count Estimate
- CRITICAL_SUCCESS: 3-4 tests
- SUCCESS: 3-4 tests
- FAILURE: 2-3 tests
- FUMBLE: 3-4 tests
- **Total: ~12-15 tests**

## Complexity Note
This is the largest test file. Consider organizing into logical `describe` blocks for each outcome to keep the file readable and maintainable.

## Outcome
- Added runtime execution coverage for all four outcomes using forced RESOLVE_OUTCOME results and perceptible event payload validation.
- Validated LOCK_GRABBING call parameters (handler is mocked in ModTestHandlerFactory) instead of asserting appendage state changes.
