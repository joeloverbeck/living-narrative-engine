# RISTOSURACT-005: Create handle_rise_to_surface rule

**Status: COMPLETED**

## Summary

Create the rule file that handles the `rise_to_surface` action execution with four outcome branches: CRITICAL_SUCCESS, SUCCESS, FAILURE, and FUMBLE.

## Files to Touch

- `data/mods/liquids/rules/handle_rise_to_surface.rule.json` (NEW FILE)

## Out of Scope

- **DO NOT** modify mod-manifest.json (handled in RISTOSURACT-006)
- **DO NOT** modify the action file (handled in RISTOSURACT-003)
- **DO NOT** modify the condition file (handled in RISTOSURACT-004)
- **DO NOT** modify any existing rule files
- **DO NOT** modify any component files
- **DO NOT** add any mechanical effects for "inhaling liquid" on fumble (flavor text only)

## Implementation Details

### Rule Structure Overview

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_rise_to_surface",
  "comment": "Handles liquids:rise_to_surface action with chance-based outcomes.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "liquids:event-is-action-rise-to-surface"
  },
  "actions": [
    // Setup operations (7 operations)
    // Four IF branches for outcomes
  ]
}
```

### Setup Operations (Before IF Branches)

1. **GET_NAME** - Get actor name → `actorName`
2. **GET_NAME** - Get liquid body name (from `{event.payload.primaryId}`) → `liquidBodyName`
3. **QUERY_COMPONENT** - Get actor position → `actorPosition`
4. **QUERY_COMPONENT** - Get liquid body component → `liquidBodyComponent`
5. **RESOLVE_OUTCOME** - Fixed difficulty contest with mobility_skill → `surfaceResult`
6. **SET_VARIABLE** - Store locationId from position
7. **SET_VARIABLE** - Store liquidVisibility from component

### Outcome Branches

#### CRITICAL_SUCCESS
- REMOVE_COMPONENT: `liquids-states:submerged`
- REGENERATE_DESCRIPTION: actor
- DISPATCH_PERCEPTIBLE_EVENT with sense-aware descriptions
- SET_VARIABLE: logMessage
- macro: `core:logSuccessOutcomeAndEndTurn`

#### SUCCESS
- REMOVE_COMPONENT: `liquids-states:submerged`
- REGENERATE_DESCRIPTION: actor
- DISPATCH_PERCEPTIBLE_EVENT with sense-aware descriptions
- SET_VARIABLE: logMessage
- macro: `core:logSuccessOutcomeAndEndTurn`

#### FAILURE
- DISPATCH_PERCEPTIBLE_EVENT (no state change)
- SET_VARIABLE: logMessage
- macro: `core:logFailureOutcomeAndEndTurn`

#### FUMBLE
- DISPATCH_PERCEPTIBLE_EVENT (includes "inhales liquid" flavor)
- SET_VARIABLE: logMessage
- macro: `core:logFailureOutcomeAndEndTurn`

### DISPATCH_PERCEPTIBLE_EVENT Pattern

All four branches use this pattern:
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "<third-person description>",
    "actor_description": "<first-person description>",
    "perception_type": "physical.self_action",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.primaryId}",
    "involved_entities": [],
    "alternate_descriptions": {
      "auditory": "<sound-based fallback>",
      "tactile": "<touch-based fallback>"
    }
  }
}
```

### Key Message Placeholders

All messages include:
- `{context.actorName}`
- `{context.liquidVisibility}`
- `{context.liquidBodyName}`

## Acceptance Criteria

### Tests That Must Pass

- [x] Rule JSON is valid (parseable)
- [x] Rule follows schema `schema://living-narrative-engine/rule.schema.json`

### Structural Validation Checks

- [x] rule_id is `handle_rise_to_surface`
- [x] event_type is `core:attempt_action`
- [x] condition_ref is `liquids:event-is-action-rise-to-surface`
- [x] RESOLVE_OUTCOME uses `skills:mobility_skill` with difficulty_modifier 50
- [x] Four IF branches exist for CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE

### Behavioral Checks

- [x] CRITICAL_SUCCESS removes `liquids-states:submerged` and calls REGENERATE_DESCRIPTION
- [x] SUCCESS removes `liquids-states:submerged` and calls REGENERATE_DESCRIPTION
- [x] FAILURE does NOT remove submerged component
- [x] FUMBLE does NOT remove submerged component
- [x] All branches dispatch perception events with actor_description and alternate_descriptions
- [x] Success outcomes use `core:logSuccessOutcomeAndEndTurn`
- [x] Failure outcomes use `core:logFailureOutcomeAndEndTurn`

### Invariants That Must Remain True

- [x] No existing files are modified
- [x] No mechanical damage/status effects on fumble (flavor only)
- [x] REGENERATE_DESCRIPTION only on success outcomes
- [x] All messages include visibility in text

## Verification Commands

```bash
# Verify JSON is valid
node -e "console.log(JSON.parse(require('fs').readFileSync('data/mods/liquids/rules/handle_rise_to_surface.rule.json')))"

# Check rule_id
grep '"rule_id": "handle_rise_to_surface"' data/mods/liquids/rules/handle_rise_to_surface.rule.json

# Check condition reference
grep '"condition_ref": "liquids:event-is-action-rise-to-surface"' data/mods/liquids/rules/handle_rise_to_surface.rule.json

# Count IF branches (should be 4)
grep -c '"type": "IF"' data/mods/liquids/rules/handle_rise_to_surface.rule.json
```

## Dependencies

- RISTOSURACT-003 (action file must exist for action ID reference)
- RISTOSURACT-004 (condition file must exist for condition_ref)

## Blocks

- RISTOSURACT-006 (manifest needs to include this file)
- RISTOSURACT-008 (rule execution tests)

## Reference

See `specs/rise-to-surface-action.md` Section 5 for complete rule specification with all message text.

---

## Outcome

**Completed on:** 2025-12-23

### What Was Actually Changed

1. **Created `data/mods/liquids/rules/handle_rise_to_surface.rule.json`** (262 lines)
   - Implemented exact rule structure from spec Section 5
   - 7 setup operations for context gathering
   - 4 flat IF branches for each outcome type
   - All perceptible events include sense-aware fields (actor_description, alternate_descriptions with auditory/tactile)
   - All messages include `{context.liquidVisibility}` placeholder
   - FUMBLE has no mechanical effects (flavor text only as specified)

2. **Created `tests/integration/mods/liquids/rise_to_surface_rule_execution.test.js`** (473 lines)
   - 38 passing tests covering all acceptance criteria
   - Tests for rule registration, setup operations, all four outcome branches
   - Tests for turn ending guarantees, perception type validation
   - Tests for state update order (REGENERATE_DESCRIPTION after REMOVE_COMPONENT)
   - Tests for visibility placeholder validation in all messages

### Deviations from Original Plan

**None.** Implementation matched the ticket specification exactly. All invariants were preserved:
- No existing files modified
- No mechanical effects on fumble (flavor only)
- REGENERATE_DESCRIPTION only on success outcomes
- All messages include visibility placeholder

### Test Results

All 38 tests pass:
- Rule registration and condition wiring
- Setup operations validation
- CRITICAL_SUCCESS branch (7 tests)
- SUCCESS branch (6 tests)
- FAILURE branch (6 tests)
- FUMBLE branch (6 tests)
- Turn ending guarantees (3 tests)
- Perception type validation (2 tests)
- State update order validation (2 tests)
- Visibility placeholder validation (2 tests)
