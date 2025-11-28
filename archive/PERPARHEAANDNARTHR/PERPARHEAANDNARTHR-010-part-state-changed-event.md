# PERPARHEAANDNARTHR-010: Part State Changed Event Schema

**Status:** Completed
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.25 days
**Dependencies:** None

---

## Objective

Create the event schema for `anatomy:part_state_changed`, which is dispatched only when a body part crosses a health state threshold boundary (via UPDATE_PART_HEALTH_STATE operation).

---

## Files to Touch

### New Files
- `data/mods/anatomy/events/part_state_changed.event.json`

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
- The `part_health_changed.event.json` (separate event)

---

## Implementation Details

### Event Schema Structure

Create `data/mods/anatomy/events/part_state_changed.event.json`:

```json
{
  "$schema": "../../../schemas/event.schema.json",
  "id": "anatomy:part_state_changed",
  "description": "Dispatched only when a body part crosses a health state threshold boundary. Does NOT fire on every health change - only when the narrative state label actually changes (e.g., healthy -> bruised).",
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
      "previousState": {
        "type": "string",
        "enum": ["healthy", "bruised", "wounded", "badly_damaged", "destroyed"],
        "description": "Narrative health state before the transition"
      },
      "newState": {
        "type": "string",
        "enum": ["healthy", "bruised", "wounded", "badly_damaged", "destroyed"],
        "description": "Narrative health state after the transition"
      },
      "turnsInPreviousState": {
        "type": "integer",
        "minimum": 0,
        "description": "Number of consecutive turns spent in the previous state before this transition"
      },
      "healthPercentage": {
        "type": "number",
        "minimum": 0,
        "maximum": 100,
        "description": "Current health as percentage of maximum (0-100)"
      },
      "isDeterioration": {
        "type": "boolean",
        "description": "True if transitioning to a worse state (damage), false if improving (healing)"
      },
      "timestamp": {
        "type": "integer",
        "description": "Unix timestamp or game turn when the transition occurred"
      }
    },
    "required": [
      "partEntityId",
      "partType",
      "previousState",
      "newState",
      "turnsInPreviousState",
      "healthPercentage",
      "isDeterioration",
      "timestamp"
    ],
    "additionalProperties": false
  }
}
```

### Design Rationale

1. **Follows limb_detached.event.json pattern**: Same structure with payloadSchema
2. **additionalProperties: false**: Matches existing anatomy event patterns for consistency
3. **State enums validated**: Only valid states allowed
4. **isDeterioration field**: Enables rules to easily distinguish damage from healing
5. **turnsInPreviousState**: Useful for time-based narrative effects
6. **ownerEntityId nullable**: May not always be determinable

---

## Acceptance Criteria

### Tests That Must Pass

1. **JSON validity:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/events/part_state_changed.event.json'))"
   ```

2. **Schema validation:**
   - `npm run validate` passes without errors

3. **Event schema compliance:**
   - File validates against `event.schema.json`
   - `id` follows namespaced format `anatomy:part_state_changed`

4. **State enum consistency:**
   - States match component enum: `healthy`, `bruised`, `wounded`, `badly_damaged`, `destroyed`

### Invariants That Must Remain True

1. All existing anatomy events remain unchanged
2. `npm run test:ci` passes (no regressions)
3. Event ID matches exactly what handlers dispatch: `anatomy:part_state_changed`
4. Required fields match spec REQ-6
5. State enums match component schema exactly

---

## Verification Steps

```bash
# 1. Verify event file is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/events/part_state_changed.event.json'))"

# 2. Verify state enums match component
node -e "
  const event = JSON.parse(require('fs').readFileSync('data/mods/anatomy/events/part_state_changed.event.json'));
  const states = event.payloadSchema.properties.previousState.enum;
  const expected = ['healthy', 'bruised', 'wounded', 'badly_damaged', 'destroyed'];
  console.log('States:', states);
  console.log('Match expected:', JSON.stringify(states) === JSON.stringify(expected));
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
- Component states: `data/mods/anatomy/components/part_health.component.json` (from ticket 001)
- Handler that dispatches this event: `src/logic/operationHandlers/updatePartHealthStateHandler.js` (from ticket 007)

---

## Outcome

### What Changed vs. Originally Planned

**Ticket Correction:**
- Changed `additionalProperties: true` → `additionalProperties: false` to match existing anatomy event patterns (`limb_detached.event.json`, `part_health_changed.event.json`)

**Implementation:**
- Created `data/mods/anatomy/events/part_state_changed.event.json` as specified

### Verification Results

- ✅ JSON validity check passed
- ✅ State enum verification passed (exact match)
- ✅ `npm run validate` passed (0 violations across 44 mods)
- ✅ `npm run test:unit` passed (37,640 tests, 2,253 test suites)
- ✅ No existing files modified

### Files Created

| File | Description |
|------|-------------|
| `data/mods/anatomy/events/part_state_changed.event.json` | Event schema for health state threshold crossings |

### Completion Date

2025-11-28
