# LIQSWIBETCONBOD-006: Swim Rule Outcome Tests

**Status**: ✅ COMPLETED

## Goal
Add tests that validate outcome handling, state updates, and UI/perceptible events for the swim rule.

## File list (expected to touch)
- tests/ (new or updated suites for swim rule outcomes)
- tests/__snapshots__/ (only if snapshot-based expectations are required)

## Out of scope
- Action/scopes/condition definitions.
- Any changes to mod data or core engine code.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand`
- Any new test files introduced in this ticket

### Invariants that must remain true
- `CRITICAL_SUCCESS` and `SUCCESS` update `liquids-states:in_liquid_body.liquid_body_id` and `core:position.locationId` and invoke `REGENERATE_DESCRIPTION`.
- `FAILURE` and `FUMBLE` leave components unchanged.
- Perceptible event payloads include sense-aware fields and outcome-specific text.
- UI events (`core:display_successful_action_result` / `core:display_failed_action_result`) match the outcome.
- `END_TURN` success flag aligns with the outcome.

---

## Outcome

### What was actually changed
- **Created**: `tests/integration/mods/liquids/swim_to_connected_liquid_body_rule_execution.test.js` (39 tests)
  - Tests modeled after `feel_your_way_to_an_exit_rule_execution.test.js` pattern

### Test coverage summary
The new test suite validates:

1. **Rule and condition wiring** (1 test)
   - Verifies rule_id, event_type, condition_ref registration

2. **Setup operations** (2 tests)
   - Name lookups for actor, liquid body, and location
   - Position query and outcome resolution with mobility_skill

3. **Outcome branching** (1 test)
   - Flat structure with 4 IF branches for CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE

4. **CRITICAL_SUCCESS branch** (8 tests)
   - Updates liquid_body_id and locationId components
   - Calls REGENERATE_DESCRIPTION
   - Dispatches departure/arrival perceptions with effortless messaging
   - Includes sense-aware fields (actor_description, alternate_descriptions)
   - Ends with success macro

5. **SUCCESS branch** (6 tests)
   - Same component updates and regeneration as CRITICAL_SUCCESS
   - Different messaging tone
   - Sense-aware fields included
   - Ends with success macro

6. **FAILURE branch** (5 tests)
   - Leaves all components unchanged
   - Dispatches perception with struggling message
   - Includes sense-aware fields with labored/erratic descriptions
   - Ends with failure macro

7. **FUMBLE branch** (5 tests)
   - Leaves all components unchanged
   - Dispatches perception with uncoordinated/submerged message
   - Includes sense-aware fields with desperate/chaotic descriptions
   - Ends with failure macro

8. **Dependency validation** (3 tests)
   - skills, liquids-states, positioning dependencies

9. **Turn ending guarantees** (3 tests)
   - All branches have turn-ending macros
   - Success outcomes use success macro
   - Failure outcomes use failure macro

10. **Perception type validation** (2 tests)
    - All events use valid perception types
    - All swim events use physical.self_action

11. **State update order validation** (3 tests)
    - liquid_body_id modified before position
    - REGENERATE_DESCRIPTION after both modifications

### Differences from originally planned
- No snapshots needed (all assertions done via direct JSON inspection)
- Tests follow structural validation pattern rather than runtime execution pattern
- No changes to mod data or core engine code (as specified in out of scope)

### Test results
```
PASS tests/integration/mods/liquids/swim_to_connected_liquid_body_rule_execution.test.js
Test Suites: 1 passed, 1 total
Tests:       39 passed, 39 total
```
