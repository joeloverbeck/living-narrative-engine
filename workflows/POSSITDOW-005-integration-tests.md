# POSSITDOW-005: Build Integration & Scope Tests for Distance Seating

**Phase:** 2 - Systems Integration
**Priority:** High
**Estimated Effort:** 8 hours

## Goal

Deliver the comprehensive integration test coverage described in the specification to validate discoverability, rule execution, error handling, and regression scenarios for the new sit-at-distance feature.

## Context

Tests should live under `tests/integration/mods/positioning/` and leverage existing `ModTestFixture` helpers. Where possible, reuse or extend current fixtures to demonstrate coexistence with `positioning:sit_down`.

## Tasks

### 1. Action Metadata Validation
- Author a test file section that loads the new action definition and asserts `id`, `name`, `description`, targets, and component requirements match specification expectations.
- Confirm no forbidden component regressions exist relative to the baseline sit-down action.

### 2. Positive Discoverability Scenario
- Construct a fixture with furniture `spots = [secondaryActor, null, null]` and a standing player actor.
- Assert `resolveAvailableActions` includes both `positioning:sit_down_at_distance` and the legacy `positioning:sit_down`, verifying template strings include both targets for the new action.

### 3. Negative Discoverability Scenarios
- Add sub-tests for each disqualifying arrangement:
  - Furniture with only two spots.
  - Furniture with the middle seat occupied.
  - Furniture with non-rightmost occupant lacking two free spots.
- Ensure the new action is absent while legacy behaviors remain available when appropriate.

### 4. Rule Execution Success Path
- Simulate `core:attempt_action` for the new action and assert:
  - Actor receives `positioning:sitting_on` with `spot_index = secondaryIndex + 2`.
  - Gap seat remains null and furniture `spots` reflect expected occupancy.
  - No additional closeness components are added between actor and secondary occupant.
  - Success log references both targets.

### 5. Defensive Behavior Test
- Pre-fill the target seat between scope resolution and rule execution to mimic a race condition.
- Verify the rule aborts cleanly: actor remains standing, log communicates failure, and furniture state stays untouched.

### 6. Regression Coverage
- Re-run an existing `handle_sit_down` scenario (or create one if absent) to confirm the legacy action still seats actors leftmost and coexists with the new action.

### 7. Optional Scope Resolution Unit Test
- If feasible, add a focused test that invokes the new scope directly against multiple seating configurations to ensure only the rightmost-with-space occupant is returned.

### 8. Test Execution
- Run `npm run test:integration -- tests/integration/mods/positioning/<file>` and include results in the PR description.

## Acceptance Criteria
- Integration suite covers all scenarios outlined above with clear assertions.
- Optional scope test either exists or documented rationale provided for omission.
- All new tests pass locally and run in CI.
