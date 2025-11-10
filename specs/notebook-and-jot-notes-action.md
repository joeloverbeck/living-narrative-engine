# Specification: Notebook Item and "Jot Down Notes" Action

## Overview

This specification describes the implementation of a waterproof field notebook item and an associated "jot down notes on notebook" action within the items mod (`data/mods/items/`). The notebook represents a physical, unauthorized personal documentation system used by actors for logging observations, anomalies, and field data.

## Background

The notebook is inspired by a character who maintains an unauthorized Rite-in-the-Rain waterproof notebook for independent record-keeping, logging: temperature, EM noise, visual flicker, sound anomalies, heart rate spikes, partner statements, communications traffic, and timestamps. The character uses color-coded ink (black for readings, blue for observations, red for anomalies) to categorize entries.

## Design Decisions

### Note Content Generation

Since the engine lacks mechanisms for players (human or LLM) to specify arbitrary note text, notes will be **procedurally generated** based on:
1. **Generic observation templates** - Randomized field observations
2. **Timestamp data** - When the note was written
3. **Context-aware elements** (optional future enhancement) - Actor's location, nearby entities, recent perceptions

Notes will follow the character's logging style: technical, concise, and categorized.

### Notebook Structure

The notebook uses two components:
- **`items:readable`** (existing) - Contains the full accumulated text of all notes, readable via the `read_item` action
- **`items:writable_notebook`** (new) - Tracks individual note entries with metadata (timestamp, entry number)

This dual-component approach allows:
- Reading the full notebook as a single text block (via existing read_item action)
- Tracking individual notes with metadata for future features (search, filtering, export)
- Maintaining compatibility with existing readable item systems

## Implementation Plan

### 1. New Component: `items:writable_notebook`

**File**: `data/mods/items/components/writable_notebook.component.json`

**Purpose**: Marker component indicating an item can have notes written to it. Tracks individual note entries with metadata.

**Schema**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:writable_notebook",
  "description": "Component for items that can have notes written to them. Tracks individual entries with timestamps.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "entries": {
        "type": "array",
        "description": "Individual note entries with metadata",
        "items": {
          "type": "object",
          "properties": {
            "entryNumber": {
              "type": "integer",
              "description": "Sequential entry number",
              "minimum": 1
            },
            "timestamp": {
              "type": "string",
              "description": "ISO 8601 timestamp when note was written"
            },
            "noteText": {
              "type": "string",
              "description": "The note content",
              "minLength": 1
            },
            "category": {
              "type": "string",
              "description": "Note category (reading, observation, anomaly)",
              "enum": ["reading", "observation", "anomaly"]
            }
          },
          "required": ["entryNumber", "timestamp", "noteText", "category"],
          "additionalProperties": false
        },
        "default": []
      },
      "nextEntryNumber": {
        "type": "integer",
        "description": "Next available entry number",
        "minimum": 1,
        "default": 1
      },
      "maxEntries": {
        "type": "integer",
        "description": "Maximum number of entries before notebook is full",
        "minimum": 1,
        "default": 100
      }
    },
    "required": ["entries", "nextEntryNumber", "maxEntries"],
    "additionalProperties": false
  }
}
```

**Rationale**:
- Array structure allows for future enhancements (filtering, searching, pagination)
- Sequential entry numbers provide clear organization
- Category field enables color-coding simulation
- Max entries cap prevents infinite growth

### 2. New Action: `items:jot_down_notes`

**File**: `data/mods/items/actions/jot_down_notes.action.json`

**Schema**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:jot_down_notes",
  "name": "Jot Down Notes",
  "description": "Write observations and data into a notebook for personal record-keeping.",
  "targets": {
    "primary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "notebook",
      "description": "Notebook to write in"
    }
  },
  "required_components": {
    "primary": ["items:item", "items:writable_notebook"]
  },
  "forbidden_components": {
    "actor": ["positioning:doing_complex_performance"]
  },
  "prerequisites": [],
  "template": "jot down notes in {notebook}",
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
- Requires `items:writable_notebook` component
- Forbidden during complex performances (requires focus)
- Dark theme visual matches the utilitarian nature of field notes

### 3. New Condition: `items:event-is-action-jot-down-notes`

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

### 4. New Rule: `handle_jot_down_notes`

**File**: `data/mods/items/rules/handle_jot_down_notes.rule.json`

**Logic Flow**:

1. **Query notebook state** - Get current `items:writable_notebook` component
2. **Check capacity** - Verify notebook isn't full (entries.length < maxEntries)
3. **Generate note content** - Create procedural note text based on category rotation
4. **Get timestamp** - Use `GET_TIMESTAMP` operation
5. **Add entry** - Use `MODIFY_ARRAY_FIELD` to push new entry to `entries` array
6. **Increment counter** - Use `MODIFY_COMPONENT` to increment `nextEntryNumber`
7. **Rebuild readable text** - Update `items:readable` component with all accumulated notes
8. **Dispatch public perception** - Show actor writing in notebook
9. **Display success** - Show confirmation message
10. **End turn** - Mark turn complete

**Key Operations Used**:
- `GET_TIMESTAMP` - Capture current time
- `QUERY_COMPONENT` - Read notebook state
- `GET_NAME` - Get actor and notebook names
- `MATH` - Check capacity, calculate entry number
- `IF` - Branch on capacity check
- `MODIFY_ARRAY_FIELD` (mode: "push") - Add new entry
- `MODIFY_COMPONENT` (mode: "set") - Update counter and readable text
- `DISPATCH_PERCEPTIBLE_EVENT` - Public observation of writing
- `DISPATCH_EVENT` - UI feedback
- `END_TURN` - Complete action

**Note Generation Strategy**:

Notes are generated using a rotation through three categories:
1. **Reading** (Entry N mod 3 == 0): Environmental measurements
   - "Temperature reading: 18°C. EM noise: nominal. Visual clarity: good."
   - "Ambient sound: 42dB. No electromagnetic anomalies detected."

2. **Observation** (Entry N mod 3 == 1): Behavioral and procedural notes
   - "Perimeter check at HH:MM. Automated systems reporting green across all sectors."
   - "Comms traffic normal. No irregularities in partner communications."

3. **Anomaly** (Entry N mod 3 == 2): Flags and concerns
   - "Visual flicker observed in sector 7. Duration: 3 seconds. Logging for correlation."
   - "Heart rate spike during routine scan. Possible equipment malfunction. Monitoring."

**Pseudo-Schema** (simplified for clarity):
```json
{
  "rule_id": "handle_jot_down_notes",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "items:event-is-action-jot-down-notes" },
  "actions": [
    "QUERY_COMPONENT: get items:writable_notebook → notebookData",
    "GET_NAME: actor → actorName",
    "GET_NAME: target → notebookName",
    "GET_TIMESTAMP → currentTimestamp",
    "QUERY_COMPONENT: get actor core:position → actorPosition",
    "MATH: notebookData.entries.length < notebookData.maxEntries → hasCapacity",
    "IF hasCapacity THEN:",
    "  SET_VARIABLE: entryNumber = notebookData.nextEntryNumber",
    "  MATH: entryNumber % 3 → categoryIndex",
    "  IF categoryIndex == 0: SET category = 'reading', noteText = template_A",
    "  IF categoryIndex == 1: SET category = 'observation', noteText = template_B",
    "  IF categoryIndex == 2: SET category = 'anomaly', noteText = template_C",
    "  MODIFY_ARRAY_FIELD: push to notebookData.entries { entryNumber, timestamp, noteText, category }",
    "  MODIFY_COMPONENT: increment notebookData.nextEntryNumber",
    "  FOR_EACH entry in notebookData.entries → rebuild readable text",
    "  MODIFY_COMPONENT: update items:readable.text with rebuilt text",
    "  DISPATCH_PERCEPTIBLE_EVENT: '{actorName} jots down notes in {notebookName}.'",
    "  DISPATCH_EVENT: success message",
    "  END_TURN: success",
    "ELSE:",
    "  DISPATCH_EVENT: '{notebookName} is full. No more space for entries.'",
    "  END_TURN: failure"
  ]
}
```

### 5. Example Notebook Entity Definition

**Not a file** - This would be created dynamically in tests or by mod authors. Example structure:

```javascript
const notebook = new ModEntityBuilder('field_notebook_001')
  .withName('Waterproof Field Notebook')
  .withComponent('core:description', {
    text: 'A battered Rite-in-the-Rain waterproof notebook with a olive drab cover. Multiple colored pens are clipped to the spine.'
  })
  .withComponent('items:item', {})
  .withComponent('items:portable', {})
  .withComponent('items:weight', { weight: 0.3 })
  .withComponent('items:readable', {
    text: '-- Field Notebook --\n\nNo entries yet.'
  })
  .withComponent('items:writable_notebook', {
    entries: [],
    nextEntryNumber: 1,
    maxEntries: 100
  })
  .build();
```

### 6. Readable Text Format

When the notebook is read via `items:read_item`, the accumulated text should follow this format:

```
-- Field Notebook --
Unauthorized personal documentation system. Paper trail, not digital. Can't delete paper.

Entry 1 [READING] - 2025-11-10T14:32:15Z
Temperature reading: 18°C. EM noise: nominal. Visual clarity: good.

Entry 2 [OBSERVATION] - 2025-11-10T15:47:22Z
Perimeter check at 15:47. Automated systems reporting green across all sectors.

Entry 3 [ANOMALY] - 2025-11-10T16:12:08Z
Visual flicker observed in sector 7. Duration: 3 seconds. Logging for correlation.

---
Total entries: 3 / 100
```

The rule should construct this text by iterating through the `entries` array and concatenating formatted strings.

## Testing Requirements

### Unit Tests

None required - all logic is in rule operations which are integration-tested.

### Integration Tests

**File**: `tests/integration/mods/items/jotDownNotesRuleExecution.test.js`

**Test Cases**:

1. **Successfully writes first entry**
   - Setup: Actor with empty notebook in inventory
   - Execute: `jot_down_notes` action
   - Assert:
     - `items:writable_notebook.entries` has 1 entry
     - Entry has correct structure (entryNumber: 1, timestamp, noteText, category: 'reading')
     - `nextEntryNumber` incremented to 2
     - `items:readable.text` contains formatted entry
     - Perceptible event dispatched
     - Turn ended successfully

2. **Successfully writes multiple entries with category rotation**
   - Setup: Actor with notebook (2 existing entries)
   - Execute: `jot_down_notes` action 3 times
   - Assert:
     - Entries 3, 4, 5 added with correct categories (anomaly, reading, observation)
     - Readable text includes all 5 entries
     - All entries have unique timestamps

3. **Prevents writing when notebook is full**
   - Setup: Notebook with `maxEntries: 2` and 2 existing entries
   - Execute: `jot_down_notes` action
   - Assert:
     - No new entry added
     - Failure message dispatched: "... is full. No more space..."
     - Turn ended with failure

4. **Maintains readable text format consistency**
   - Setup: Notebook with 3 entries
   - Execute: Read notebook via `read_item`
   - Assert:
     - Text follows specification format
     - All entries present with correct headers
     - Footer shows correct entry count

5. **Requires notebook in inventory**
   - Setup: Notebook at location (not in inventory)
   - Execute: `jot_down_notes` action
   - Assert:
     - Action not available (filtered by scope)

**File**: `tests/integration/mods/items/jotDownNotesActionDiscovery.test.js`

**Test Cases**:

1. **Action appears for writable notebook in inventory**
   - Setup: Actor with writable notebook in inventory
   - Assert: `jot_down_notes` action is available

2. **Action does NOT appear for non-writable items**
   - Setup: Actor with regular readable book (no writable_notebook component)
   - Assert: `jot_down_notes` action not available

3. **Action does NOT appear when actor is performing complex action**
   - Setup: Actor with notebook, but has `positioning:doing_complex_performance`
   - Assert: `jot_down_notes` action not available

## Future Enhancements

### Phase 2 - Player-Specified Notes
- Add UI modal for text input
- Operation to accept custom note text from player
- Validation and sanitization of player input

### Phase 3 - Context-Aware Notes
- Integrate with perception system to reference recent events
- Add location-specific note templates
- Include nearby entity names in generated notes

### Phase 4 - Advanced Features
- Search/filter notes by category
- Export notes to external format
- Note-sharing between actors
- Notebook durability/damage system

## Dependencies

### Existing Systems
- **items mod**: Uses existing scopes, components (item, portable, readable, weight)
- **Operation handlers**: GET_TIMESTAMP, MODIFY_ARRAY_FIELD, MODIFY_COMPONENT, IF, MATH
- **Event system**: DISPATCH_PERCEPTIBLE_EVENT for public observation

### No New Operations Required
All necessary operations exist in the current operation schema registry.

## Validation

### Schema Validation
- Run `npm run validate` to verify all new JSON files
- Ensure component schema passes AJV validation
- Verify action and rule schemas are valid

### Mod Validation
- Add notebook action to mod manifest if required
- Verify condition references resolve correctly
- Check that all operation types are registered in `preValidationUtils.js`

### Manual Testing
- Create notebook entity in test scenario
- Verify action appears in UI
- Execute action and check notebook state
- Read notebook and verify format
- Test full notebook scenario

## File Checklist

- [ ] `data/mods/items/components/writable_notebook.component.json`
- [ ] `data/mods/items/actions/jot_down_notes.action.json`
- [ ] `data/mods/items/conditions/event-is-action-jot-down-notes.condition.json`
- [ ] `data/mods/items/rules/handle_jot_down_notes.rule.json`
- [ ] `tests/integration/mods/items/jotDownNotesRuleExecution.test.js`
- [ ] `tests/integration/mods/items/jotDownNotesActionDiscovery.test.js`
- [ ] Update `data/mods/items/mod-manifest.json` (if actions list exists)

## Open Questions

1. **Should notebook be a pre-defined entity or only created via tests/mod content?**
   - Recommendation: Leave as test/mod-defined. No core entity needed.

2. **Should there be a character trait or skill that affects note quality?**
   - Recommendation: Phase 2 enhancement. Current spec uses generic templates.

3. **Should notes have a character limit per entry?**
   - Recommendation: Yes, add `maxLength: 500` to noteText in component schema.

4. **Should timestamps be displayed in a human-readable format in readable text?**
   - Recommendation: Yes, format as "YYYY-MM-DD HH:MM:SS" in readable text generation.

5. **Should there be different notebook types (waterproof, regular, tactical)?**
   - Recommendation: Future enhancement. Current spec uses generic writable_notebook.

## Summary

This specification provides a complete plan for implementing a waterproof field notebook item and "jot down notes" action within the existing items mod infrastructure. The implementation:

- **Extends existing systems** without requiring new operation handlers
- **Uses established patterns** from other items actions (read, examine)
- **Supports future enhancement** through structured component design
- **Maintains consistency** with project architecture and testing standards

The notebook captures the essence of unauthorized personal documentation while working within the engine's technical constraints by using procedurally generated note content rather than requiring player text input.
