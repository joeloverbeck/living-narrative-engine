# PERPARHEAANDNARTHR-006: UPDATE_PART_HEALTH_STATE Schema Definition

**Status:** Ready
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None

---

## Objective

Create the JSON schema for the `UPDATE_PART_HEALTH_STATE` operation, which recalculates the narrative health state from the current health percentage and manages the `turnsInState` counter.

---

## Files to Touch

### New Files
- `data/schemas/operations/updatePartHealthState.schema.json`

### Modified Files
- `data/schemas/operation.schema.json` (add `$ref` entry to `anyOf` array)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation schemas
- Any operation handler implementation files
- Any rule files
- Any DI registration files (covered in PERPARHEAANDNARTHR-008)
- `preValidationUtils.js` (covered in PERPARHEAANDNARTHR-008)
- Any component files
- Any test files

---

## Implementation Details

### Schema Structure

Create `data/schemas/operations/updatePartHealthState.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/updatePartHealthState.schema.json",
  "title": "UPDATE_PART_HEALTH_STATE Operation",
  "description": "Recalculates narrative health state from current health percentage. Updates turnsInState counter (resets on state change, increments otherwise). Dispatches part_state_changed event only when state actually changes.",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UPDATE_PART_HEALTH_STATE" },
        "parameters": {
          "type": "object",
          "properties": {
            "part_entity_ref": {
              "description": "Reference to the body part entity. Can be a direct entity ID string or a JSON Logic expression that resolves to an entity ID.",
              "oneOf": [
                { "type": "string" },
                { "type": "object" }
              ]
            }
          },
          "required": ["part_entity_ref"],
          "additionalProperties": false
        }
      },
      "required": ["type", "parameters"]
    }
  ]
}
```

### operation.schema.json Update

Add to the `anyOf` array in **alphabetical order**:

```json
{ "$ref": "./operations/updatePartHealthState.schema.json" }
```

Insert after entries starting with "upd..." - should be near `updateHungerState.schema.json` if it exists.

### Design Rationale

1. **Single parameter**: Only needs the part entity reference - all other data comes from the component
2. **part_entity_ref flexibility**: Supports both direct ID strings and JSON Logic for dynamic resolution
3. **Minimalist schema**: State calculation logic is in the handler, not configurable via parameters
4. **additionalProperties false**: Strict schema prevents future creep

---

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation tests:**
   - `npm run validate` passes without errors
   - `npm run validate:strict` passes without errors

2. **JSON schema validity:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/updatePartHealthState.schema.json'))"
   ```

3. **operation.schema.json validity:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/schemas/operation.schema.json'))"
   ```

4. **Schema reference resolution:**
   - `$ref` to `base-operation.schema.json` resolves correctly

### Invariants That Must Remain True

1. All existing operation schemas remain unchanged
2. All existing rules continue to validate successfully
3. `npm run test:ci` passes (no regressions)
4. Schema follows exact same pattern as other operation schemas
5. Operation type constant is exactly `UPDATE_PART_HEALTH_STATE`

---

## Verification Steps

```bash
# 1. Verify schema is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/updatePartHealthState.schema.json'))"

# 2. Verify operation.schema.json is valid after modification
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operation.schema.json'))"

# 3. Run full validation
npm run validate

# 4. Run strict validation
npm run validate:strict

# 5. Run test suite to ensure no regressions
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/schemas/operations/addComponent.schema.json`
- Similar operation: `data/schemas/operations/updateHungerState.schema.json` (if exists)
- Base schema: `data/schemas/base-operation.schema.json`
- Integration point: `data/schemas/operation.schema.json`
