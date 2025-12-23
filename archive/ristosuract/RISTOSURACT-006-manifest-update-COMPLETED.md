# RISTOSURACT-006: Update liquids mod-manifest.json [COMPLETED]

## Summary

Update the liquids mod manifest to include the new action, condition, and rule files created in RISTOSURACT-003, RISTOSURACT-004, and RISTOSURACT-005.

## Files to Touch

- `data/mods/liquids/mod-manifest.json` - Add new files to content arrays

## Out of Scope

- **DO NOT** modify any other manifest files
- **DO NOT** change mod ID, version, name, description, or dependencies
- **DO NOT** modify the components, scopes, events, or entities arrays
- **DO NOT** create any new files
- **DO NOT** remove any existing entries from the manifest

## Implementation Details

### Current State (content section)

```json
{
  "content": {
    "components": [
      "liquid_body.component.json"
    ],
    "actions": [
      "climb_out_of_liquid_body.action.json",
      "enter_liquid_body.action.json",
      "swim_to_connected_liquid_body.action.json"
    ],
    "rules": [
      "handle_climb_out_of_liquid_body.rule.json",
      "handle_enter_liquid_body.rule.json",
      "handle_swim_to_connected_liquid_body.rule.json"
    ],
    "conditions": [
      "event-is-action-climb-out-of-liquid-body.condition.json",
      "event-is-action-enter-liquid-body.condition.json",
      "event-is-action-swim-to-connected-liquid-body.condition.json"
    ],
    "scopes": [
      "connected_liquid_bodies_for_actor.scope",
      "connected_liquid_body_location.scope",
      "liquid_bodies_at_location.scope",
      "liquid_body_actor_is_in.scope"
    ],
    "events": [],
    "entities": {
      "definitions": [],
      "instances": []
    }
  }
}
```

### Target State (content section - only showing changed arrays)

```json
{
  "content": {
    "actions": [
      "climb_out_of_liquid_body.action.json",
      "enter_liquid_body.action.json",
      "rise_to_surface.action.json",
      "swim_to_connected_liquid_body.action.json"
    ],
    "rules": [
      "handle_climb_out_of_liquid_body.rule.json",
      "handle_enter_liquid_body.rule.json",
      "handle_rise_to_surface.rule.json",
      "handle_swim_to_connected_liquid_body.rule.json"
    ],
    "conditions": [
      "event-is-action-climb-out-of-liquid-body.condition.json",
      "event-is-action-enter-liquid-body.condition.json",
      "event-is-action-rise-to-surface.condition.json",
      "event-is-action-swim-to-connected-liquid-body.condition.json"
    ]
  }
}
```

### Specific Changes

| Array | Add Entry | Position |
|-------|-----------|----------|
| actions | `"rise_to_surface.action.json"` | After enter_liquid_body, before swim_to_connected |
| rules | `"handle_rise_to_surface.rule.json"` | After handle_enter_liquid_body, before handle_swim_to_connected |
| conditions | `"event-is-action-rise-to-surface.condition.json"` | After event-is-action-enter, before event-is-action-swim |

**Note**: Alphabetical order is preferred but not strictly required. The positions above maintain a logical grouping.

## Acceptance Criteria

### Tests That Must Pass

- [x] `npm run validate:mod:liquids` passes
- [x] Manifest JSON is valid (parseable)
- [x] All referenced files exist in their respective directories
- [x] `npm run test:integration -- tests/integration/mods/liquids/` passes

### Structural Validation Checks

- [x] actions array contains `"rise_to_surface.action.json"`
- [x] rules array contains `"handle_rise_to_surface.rule.json"`
- [x] conditions array contains `"event-is-action-rise-to-surface.condition.json"`
- [x] All existing entries remain unchanged
- [x] No duplicate entries exist

### Invariants That Must Remain True

- [x] Mod ID remains `liquids`
- [x] Version remains `1.0.0`
- [x] All dependencies remain unchanged
- [x] components array is unchanged
- [x] scopes array is unchanged
- [x] events array is unchanged (empty)
- [x] entities object is unchanged

## Verification Commands

```bash
# Validate manifest and mod
npm run validate:mod:liquids

# Verify JSON is valid
node -e "console.log(JSON.parse(require('fs').readFileSync('data/mods/liquids/mod-manifest.json')))"

# Check new entries exist
grep '"rise_to_surface.action.json"' data/mods/liquids/mod-manifest.json
grep '"handle_rise_to_surface.rule.json"' data/mods/liquids/mod-manifest.json
grep '"event-is-action-rise-to-surface.condition.json"' data/mods/liquids/mod-manifest.json

# Verify files exist
ls data/mods/liquids/actions/rise_to_surface.action.json
ls data/mods/liquids/rules/handle_rise_to_surface.rule.json
ls data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json
```

## Dependencies

- RISTOSURACT-003 (action file must exist)
- RISTOSURACT-004 (condition file must exist)
- RISTOSURACT-005 (rule file must exist)

## Blocks

- RISTOSURACT-007 (action discovery tests)
- RISTOSURACT-008 (rule execution tests)
- RISTOSURACT-010 (modifier integration tests)

---

## Outcome

**Status**: COMPLETED

**Date**: 2024-12-23

### What Was Actually Changed

1. **`data/mods/liquids/mod-manifest.json`**:
   - Added `"rise_to_surface.action.json"` to the `actions` array
   - Added `"handle_rise_to_surface.rule.json"` to the `rules` array
   - Added `"event-is-action-rise-to-surface.condition.json"` to the `conditions` array

### Verification Results

- All 12 liquids integration tests passed
- JSON validation passed
- All three new entries verified present in manifest
- All prerequisite files (action, condition, rule) verified to exist

### Discrepancies From Original Plan

**None** - The ticket assumptions about current state were accurate and the implementation proceeded exactly as planned.
