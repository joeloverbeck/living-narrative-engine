# Specification: Notebook Item and "Jot Down Notes" Action

## Overview

This specification describes the implementation of a waterproof field notebook item and an associated "jot down notes on notebook" action within the items mod (`data/mods/items/`). The notebook is a static readable item for a demo scenario, representing an unauthorized personal documentation system used for logging patrol observations and anomalies.

## Background

The notebook is part of a patrol scenario where a character maintains an unauthorized Rite-in-the-Rain waterproof notebook for independent record-keeping. The notebook already contains organized notes about patrol rounds and observations regarding the "rip in reality" phenomenon. For the demo scenario, the notebook's content is pre-written and static.

## Design Decisions

### Simplified Approach

For this demo scenario, we're taking a simplified approach:
- The notebook is a **regular readable item** with static text content
- The "jot down notes" action produces only **perceptible and success event messages**
- **No actual note content is generated or modified** - this avoids complexity for a demo item
- The notebook entity will be created in the **patrol mod** (`data/mods/patrol/`) as part of the scenario

### Notebook Structure

The notebook uses only existing components:
- **`items:item`** - Marks it as an item
- **`items:portable`** - Allows it to be carried
- **`items:weight`** - Physical weight
- **`items:readable`** - Contains pre-written notes about patrol observations and the rip in reality

## Implementation Plan

### 1. New Action: `items:jot_down_notes`

**File**: `data/mods/items/actions/jot_down_notes.action.json`

**Schema**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:jot_down_notes",
  "name": "Jot Down Notes",
  "description": "Make notes in a notebook.",
  "targets": {
    "primary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "notebook",
      "description": "Notebook to write in"
    }
  },
  "required_components": {
    "primary": ["items:item", "items:readable"]
  },
  "forbidden_components": {
    "actor": ["positioning:doing_complex_performance"]
  },
  "prerequisites": [],
  "template": "jot down notes on {notebook}",
  "visual": {
    "backgroundColor": "#2d3436",
    "textColor": "#dfe6e9",
    "hoverBackgroundColor": "#636e72",
    "hoverTextColor": "#ffffff"
  }
}
```

**Rationale**:
- Targets inventory items only (actor must be holding notebook)
- Requires `items:readable` component (works with any readable item)
- Forbidden during complex performances (requires focus)
- Dark theme visual matches the utilitarian nature of field notes

### 2. New Condition: `items:event-is-action-jot-down-notes`

**File**: `data/mods/items/conditions/event-is-action-jot-down-notes.condition.json`

**Schema**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-jot-down-notes",
  "description": "True when event is attempting the jot_down_notes action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:jot_down_notes"
    ]
  }
}
```

### 3. New Rule: `handle_jot_down_notes`

**File**: `data/mods/items/rules/handle_jot_down_notes.rule.json`

**Logic Flow**:

1. **Get actor and notebook names** - Use `GET_NAME` operations
2. **Dispatch perceptible event** - Show "{actor} jots down notes on {primary}."
3. **Dispatch success event** - Show "{actor} jots down notes on {primary}."
4. **End turn** - Mark turn complete

**Key Operations Used**:
- `GET_NAME` - Get actor and notebook names for message formatting
- `DISPATCH_PERCEPTIBLE_EVENT` - Public observation of writing
- `DISPATCH_EVENT` - UI success feedback
- `END_TURN` - Complete action

**Pseudo-Schema** (simplified for clarity):
```json
{
  "rule_id": "handle_jot_down_notes",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "items:event-is-action-jot-down-notes" },
  "actions": [
    "GET_NAME: actor → actorName",
    "GET_NAME: primary → notebookName",
    "DISPATCH_PERCEPTIBLE_EVENT: '{actorName} jots down notes on {notebookName}.'",
    "DISPATCH_EVENT: type='core:action_successful', message='{actorName} jots down notes on {notebookName}.'",
    "END_TURN: success"
  ]
}
```

### 4. Notebook Entity Definition

**File**: `data/mods/patrol/entities/definitions/field_notebook.entity.json`

**Purpose**: Create the physical notebook entity for the patrol scenario with pre-written notes about patrol observations and the rip in reality.

**Schema**:
```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "field_notebook_001",
  "name": "Waterproof Field Notebook",
  "components": {
    "core:description": {
      "text": "A battered Rite-in-the-Rain waterproof notebook with an olive drab cover. Multiple colored pens are clipped to the spine. The pages are filled with meticulous handwriting."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.3
    },
    "items:readable": {
      "text": "-- Field Notebook --\nUnauthorized personal documentation system. Paper trail, not digital. Can't delete paper.\n\n=== PATROL OBSERVATIONS ===\n\nEntry 1 - Sector 3 Patrol (14:20)\nTemperature: 18°C. EM noise: nominal. Visual clarity: good.\nPerimeter check complete. All automated systems green.\n\nEntry 2 - Sector 7 Anomaly (15:47)\nVisual flicker observed. Duration: 3 seconds.\nAir pressure drop detected. Recording coordinates.\n\nEntry 3 - The Rip (16:12)\nIt's there again. Same location. Expanding?\nCommand won't listen. Need to document everything.\nEdges shimmer like heat distortion but temperature is normal.\nSound: low frequency hum, barely perceptible.\n\nEntry 4 - Partner Observation (17:03)\nPartner dismisses concerns. Following protocol.\nBut protocol doesn't account for reality fractures.\n\nEntry 5 - Equipment Check (18:30)\nAll sensors calibrated. This is real.\nThe rip in reality grows 2cm per day.\nSomeone needs to know.\n\n=== END ENTRIES ===\n\nNote: Keep this notebook secure. Official channels compromised or willfully ignorant."
    }
  }
}
```

**Rationale**:
- Located in `patrol` mod as part of the demo scenario
- Pre-filled with narrative-appropriate content about patrol duties and the anomaly
- Uses only existing item components
- Can be read via the existing `items:read_item` action
- Content reinforces the unauthorized documentation theme

## Testing Requirements

### Unit Tests

None required - all logic is in rule operations which are integration-tested.

### Integration Tests

**File**: `tests/integration/mods/items/jotDownNotesRuleExecution.test.js`

**Test Cases**:

1. **Successfully executes jot down notes action**
   - Setup: Actor with readable notebook in inventory
   - Execute: `jot_down_notes` action
   - Assert:
     - Perceptible event dispatched with message "{actorName} jots down notes on {notebookName}."
     - Success event dispatched with same message
     - Turn ended successfully
     - No components modified (notebook content remains static)

2. **Requires notebook in inventory**
   - Setup: Notebook at location (not in inventory)
   - Execute: Try to discover `jot_down_notes` action
   - Assert:
     - Action not available (filtered by scope)

**File**: `tests/integration/mods/items/jotDownNotesActionDiscovery.test.js`

**Test Cases**:

1. **Action appears for readable notebook in inventory**
   - Setup: Actor with readable notebook in inventory
   - Assert: `jot_down_notes` action is available

2. **Action appears for any readable item in inventory**
   - Setup: Actor with regular readable book in inventory
   - Assert: `jot_down_notes` action is available (works on any readable item)

3. **Action does NOT appear when actor is performing complex action**
   - Setup: Actor with notebook, but has `positioning:doing_complex_performance`
   - Assert: `jot_down_notes` action not available

## Future Enhancements

If this action needs to be expanded beyond the demo scenario:

### Phase 2 - Dynamic Note Generation
- Add actual note content generation based on context
- Create `items:writable_notebook` component to track entries
- Update `items:readable` text dynamically when notes are added

### Phase 3 - Player-Specified Notes
- Add UI modal for text input
- Operation to accept custom note text from player
- Validation and sanitization of player input

### Phase 4 - Context-Aware Notes
- Integrate with perception system to reference recent events
- Add location-specific note templates
- Include nearby entity names in generated notes

## Dependencies

### Existing Systems
- **items mod**: Uses existing scopes, components (item, portable, readable, weight), actions (read_item)
- **Operation handlers**: GET_NAME, DISPATCH_PERCEPTIBLE_EVENT, DISPATCH_EVENT, END_TURN
- **Event system**: Standard action attempt and success pattern
- **patrol mod**: Will contain the notebook entity definition

### No New Operations Required
All necessary operations exist in the current operation schema registry.

## Validation

### Schema Validation
- Run `npm run validate` to verify all new JSON files
- Verify action, condition, and rule schemas are valid
- Ensure notebook entity schema is valid

### Mod Validation
- Verify condition references resolve correctly
- Check that `items:jot_down_notes` is registered as a known action type
- Ensure patrol mod can load the notebook entity

### Manual Testing
- Add notebook entity to patrol scenario
- Give notebook to actor's inventory
- Verify action appears in UI
- Execute action and verify event messages
- Read notebook via `read_item` to see static content

## File Checklist

- [ ] `data/mods/items/actions/jot_down_notes.action.json`
- [ ] `data/mods/items/conditions/event-is-action-jot-down-notes.condition.json`
- [ ] `data/mods/items/rules/handle_jot_down_notes.rule.json`
- [ ] `data/mods/patrol/entities/definitions/field_notebook.entity.json`
- [ ] `tests/integration/mods/items/jotDownNotesRuleExecution.test.js`
- [ ] `tests/integration/mods/items/jotDownNotesActionDiscovery.test.js`
- [ ] Update `data/mods/items/mod-manifest.json` (if actions list exists)

## Summary

This specification provides a simplified plan for implementing a waterproof field notebook item and "jot down notes" action for a demo scenario. The implementation:

- **Uses only existing components** - no new component types needed
- **Provides simple event messaging** - perceptible and success events with actor and notebook names
- **Creates static notebook content** - pre-written notes about patrol observations and the rip in reality
- **Minimizes complexity** - avoids dynamic note generation for demo purposes
- **Follows established patterns** - matches other simple items actions

The notebook serves as a narrative device for the patrol scenario, containing pre-written observations about patrol rounds and the mysterious "rip in reality" phenomenon. The "jot down notes" action provides a simple roleplay action without modifying the notebook's static content.
