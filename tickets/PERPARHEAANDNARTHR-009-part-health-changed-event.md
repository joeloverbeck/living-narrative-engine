# PERPARHEAANDNARTHR-009: Part Health Changed Event Schema

**Status:** Ready
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.25 days
**Dependencies:** None

---

## Objective

Create the event schema for `anatomy:part_health_changed`, which is dispatched whenever a body part's health value changes (via MODIFY_PART_HEALTH operation).

---

## Files to Touch

### New Files
- `data/mods/anatomy/events/part_health_changed.event.json`

### Modified Files
- None (mod manifest update in separate ticket)

---

## Out of Scope

**DO NOT modify:**
- Any existing event schemas
- Any operation handler files
- The mod manifest (covered in PERPARHEAANDNARTHR-011)
- Any component files
- Any test files

---

## Implementation Details

### Event Schema Structure

Create `data/mods/anatomy/events/part_health_changed.event.json`:

```json
{
  "$schema": "../../../schemas/event.schema.json",
  "id": "anatomy:part_health_changed",
  "description": "Dispatched whenever a body part's health value changes. Fires on ANY health modification (damage or healing), regardless of whether the narrative state changes.",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "partEntityId": {
        "type": "string",
        "description": "Entity ID of the affected body part"
      },
      "ownerEntityId": {
        "type": ["string", "null"],
        "description": "Entity ID of the character that owns this part (if determinable)"
      },
      "partType": {
        "type": "string",
        "description": "The subType of the part (e.g., 'arm', 'head', 'torso')"
      },
      "previousHealth": {
        "type": "number",
        "minimum": 0,
        "description": "Health value before the change"
      },
      "newHealth": {
        "type": "number",
        "minimum": 0,
        "description": "Health value after the change"
      },
      "maxHealth": {
        "type": "number",
        "minimum": 1,
        "description": "Maximum health capacity of the part"
      },
      "healthPercentage": {
        "type": "number",
        "minimum": 0,
        "maximum": 100,
        "description": "Current health as percentage of maximum (0-100)"
      },
      "delta": {
        "type": "number",
        "description": "Amount changed (negative = damage, positive = healing)"
      },
      "timestamp": {
        "type": "integer",
        "description": "Unix timestamp or game turn when the change occurred"
      }
    },
    "required": [
      "partEntityId",
      "partType",
      "previousHealth",
      "newHealth",
      "maxHealth",
      "healthPercentage",
      "delta",
      "timestamp"
    ],
    "additionalProperties": true
  }
}
```

### Design Rationale

1. **Follows limb_detached.event.json pattern**: Same structure with payloadSchema
2. **additionalProperties: true**: Enables future extensibility (damageType, source, etc.)
3. **ownerEntityId nullable**: May not always be determinable
4. **ownerEntityId not required**: Graceful degradation if owner unknown
5. **All numeric fields validated**: minimum/maximum where appropriate
6. **Comprehensive payload**: All fields from spec REQ-5 included

---

## Acceptance Criteria

### Tests That Must Pass

1. **JSON validity:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/events/part_health_changed.event.json'))"
   ```

2. **Schema validation:**
   - `npm run validate` passes without errors

3. **Event schema compliance:**
   - File validates against `event.schema.json`
   - `id` follows namespaced format `anatomy:part_health_changed`

### Invariants That Must Remain True

1. All existing anatomy events remain unchanged
2. `npm run test:ci` passes (no regressions)
3. Event ID matches exactly what handlers dispatch: `anatomy:part_health_changed`
4. Required fields match spec REQ-5

---

## Verification Steps

```bash
# 1. Verify event file is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/events/part_health_changed.event.json'))"

# 2. Verify event ID format
node -e "
  const event = JSON.parse(require('fs').readFileSync('data/mods/anatomy/events/part_health_changed.event.json'));
  console.log('Event ID:', event.id);
  console.log('Correct format:', event.id === 'anatomy:part_health_changed');
"

# 3. Run full validation
npm run validate

# 4. Run test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/anatomy/events/limb_detached.event.json`
- Event schema: `data/schemas/event.schema.json`
- Handler that dispatches this event: `src/logic/operationHandlers/modifyPartHealthHandler.js` (from ticket 004)
