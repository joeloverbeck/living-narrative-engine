# DISBODPARSPA-002: Create `anatomy:body_part_spawned` Event Definition

**Status: ✅ COMPLETED** (2025-12-04)

## Summary

Create a new event definition `anatomy:body_part_spawned` that fires when a dismembered body part is spawned as a pickable entity in the world. This event enables other systems (narrative, UI, AI) to react to spawned body parts.

---

## Files to Touch

| File                                                    | Change Type  | Description               |
| ------------------------------------------------------- | ------------ | ------------------------- |
| `data/mods/anatomy/events/body_part_spawned.event.json` | Create (NEW) | New event definition file |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/services/dismemberedBodyPartSpawner.js` - Dispatching the event is DISBODPARSPA-021
- `data/mods/anatomy/events/dismembered.event.json` - Existing event, no changes
- Any rule files that might subscribe to this event
- `src/events/eventBus.js` - No changes needed
- Test files - Event validation is implicit via schema validation

---

## Implementation Details

### New File: `data/mods/anatomy/events/body_part_spawned.event.json`

> **Note (Assumption Corrections):**
>
> - The `$schema` uses a relative path (`../../../schemas/event.schema.json`) consistent with other anatomy events, not the schema URI format shown in JSON schema files.
> - The `timestamp` field uses `"type": "integer"` consistent with other anatomy events (`anatomy:dismembered`, `anatomy:limb_detached`), not `"number"`.

```json
{
  "$schema": "../../../schemas/event.schema.json",
  "id": "anatomy:body_part_spawned",
  "description": "Fired when a dismembered body part is spawned as a pickable entity in the world",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "entityId": {
        "type": "string",
        "description": "ID of the character who lost the body part"
      },
      "entityName": {
        "type": "string",
        "description": "Display name of the character"
      },
      "spawnedEntityId": {
        "type": "string",
        "description": "ID of the newly spawned body part entity"
      },
      "spawnedEntityName": {
        "type": "string",
        "description": "Display name of the spawned entity (e.g., \"Sarah's left leg\")"
      },
      "partType": {
        "type": "string",
        "description": "Type of body part (e.g., 'leg', 'arm', 'head')"
      },
      "orientation": {
        "type": "string",
        "description": "Orientation of the part (left, right, mid, or null for parts without orientation)"
      },
      "definitionId": {
        "type": "string",
        "description": "Entity definition ID used to spawn the body part (e.g., 'anatomy:human_leg')"
      },
      "timestamp": {
        "type": "integer",
        "description": "Unix timestamp when the body part was spawned"
      }
    },
    "required": [
      "entityId",
      "entityName",
      "spawnedEntityId",
      "spawnedEntityName",
      "partType",
      "definitionId",
      "timestamp"
    ],
    "additionalProperties": false
  }
}
```

### Design Notes

1. **orientation is optional**: Not all body parts have orientation (e.g., head, torso) - these have `null` or `"mid"`
2. **Event timing**: This event fires AFTER the spawned entity is fully created and configured
3. **Event sequence**: `anatomy:dismembered` → spawner service → `anatomy:body_part_spawned`

---

## Acceptance Criteria

### Tests That Must Pass

#### Schema Validation

1. ✅ `npm run validate` passes with new event file
2. ✅ Event schema follows project event schema standards

#### Manual Validation

```bash
# Validate event schema
npm run validate

# Check event file syntax
cat data/mods/anatomy/events/body_part_spawned.event.json | jq .

# Verify file is in correct location
ls -la data/mods/anatomy/events/
```

### Invariants That Must Remain True

1. **Event ID Format**: Follows `namespace:event_name` convention (`anatomy:body_part_spawned`)
2. **Schema Compliance**: Event definition must validate against `schema://living-narrative-engine/event.schema.json`
3. **Payload Schema**: Must be a valid JSON Schema defining the payload structure
4. **Required Fields**: All required fields must be present in every dispatch

---

## Example Event Payload

When "Sarah" loses her left leg:

```json
{
  "type": "anatomy:body_part_spawned",
  "payload": {
    "entityId": "entity-sarah-123",
    "entityName": "Sarah",
    "spawnedEntityId": "entity-spawned-leg-456",
    "spawnedEntityName": "Sarah's left leg",
    "partType": "leg",
    "orientation": "left",
    "definitionId": "anatomy:human_leg",
    "timestamp": 1733347200000
  }
}
```

---

## Dependencies

- None - this ticket can be worked independently

## Blocks

- DISBODPARSPA-021 (Spawner service dispatches this event)
- DISBODPARSPA-030 (Unit tests verify event dispatching)
- DISBODPARSPA-032 (Integration tests verify event flow)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**

- Create event definition file with `$schema` using URI format (`schema://living-narrative-engine/event.schema.json`)
- Use `"type": "number"` for timestamp field

**Actual Changes:**

- Created `data/mods/anatomy/events/body_part_spawned.event.json` with corrected schema path (relative path `../../../schemas/event.schema.json` consistent with other anatomy events)
- Used `"type": "integer"` for timestamp field (consistent with `anatomy:dismembered`, `anatomy:limb_detached`)

**Tests Added (originally marked as out-of-scope but added for robustness):**

- Updated `tests/integration/mods/anatomy/missingEventDefinitions.integration.test.js`:
  - File existence test for `body_part_spawned.event.json`
  - JSON structure validation test
  - 6 payload schema validation tests covering valid payloads, missing required fields, and additional properties rejection

**Validation Results:**

- `npm run validate` passes
- All 42 tests in the anatomy event definitions test suite pass
