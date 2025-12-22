# LIQSWIBETCONBOD-004: Swim Rule Implementation

## Status: COMPLETED ✅

## Goal
Implement `handle_swim_to_connected_liquid_body` to resolve chance-based outcomes, update actor state on success, and emit sense-aware perceptible events.

## File list (expected to touch)
- data/mods/liquids/rules/handle_swim_to_connected_liquid_body.rule.json
- data/mods/liquids/mod-manifest.json

## Out of scope
- Action, scope, or condition definitions.
- Any updates to UI or engine code under src/.
- Tests (handled in separate tickets).

## Acceptance criteria
### Specific tests that must pass
- `npm run validate` ✅

### Invariants that must remain true
- On `CRITICAL_SUCCESS` and `SUCCESS`, both `liquids-states:in_liquid_body.liquid_body_id` and `core:position.locationId` update to the connected body/location and `REGENERATE_DESCRIPTION` is called. ✅
- On `FAILURE` and `FUMBLE`, no component changes occur. ✅
- Perceptible events remain sense-aware (actor_description and alternate_descriptions fields included). ✅
- End-turn success flag aligns with outcome (`true` for success states, `false` otherwise). ✅

---

## Outcome

### What was actually changed vs originally planned

**Files created:**
1. `data/mods/liquids/rules/handle_swim_to_connected_liquid_body.rule.json` - New rule file implementing the full chance-based outcome handling

**Files modified:**
1. `data/mods/liquids/mod-manifest.json` - Added the new rule to the rules array

### Implementation Details

The rule file follows established patterns from:
- `handle_feel_your_way_to_an_exit.rule.json` (chance-based outcome structure)
- `handle_enter_liquid_body.rule.json` (liquids-specific patterns)
- `pass_through_breach.rule.json` (multi-target payload access via `primaryId`/`secondaryId`)

Key implementation decisions:
1. **RESOLVE_OUTCOME** uses `skills:mobility_skill` with default 0, difficulty modifier 50, linear formula
2. **Four flat IF blocks** handle each outcome (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE) following the established pattern
3. **Multi-target access**: Primary target (connected liquid body) via `event.payload.primaryId`, secondary target (destination location) via `event.payload.secondaryId`
4. **Sense-aware perceptible events** include `actor_description` and `alternate_descriptions` (auditory, tactile) for all outcomes
5. **Success outcomes** (CRITICAL_SUCCESS, SUCCESS) update both `liquids-states:in_liquid_body.liquid_body_id` and `core:position.locationId`, call `REGENERATE_DESCRIPTION`, and dispatch arrival perceptible events
6. **Failure outcomes** (FAILURE, FUMBLE) dispatch only failure perceptible events with no component changes
7. **Macros** `core:logSuccessOutcomeAndEndTurn` and `core:logFailureOutcomeAndEndTurn` handle end-turn flow

### Assumption Corrections
No corrections were needed to the ticket. The ticket's assumptions about:
- File paths ✅
- Out of scope items ✅ (action, scope, condition already existed)
- Acceptance criteria ✅

All aligned correctly with the actual codebase state.
