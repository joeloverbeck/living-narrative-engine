# PERPARHEAANDNARTHR-003: MODIFY_PART_HEALTH Schema Definition

**Status:** Ready
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None

---

## Objective

Create the JSON schema for the `MODIFY_PART_HEALTH` operation, which changes a body part's health value by a delta amount (positive for healing, negative for damage).

---

## Files to Touch

### New Files
- `data/schemas/operations/modifyPartHealth.schema.json`

### Modified Files
- `data/schemas/operation.schema.json` (add `$ref` entry to `anyOf` array)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation schemas
- Any operation handler implementation files
- Any rule files
- Any DI registration files (covered in PERPARHEAANDNARTHR-005)
- `preValidationUtils.js` (covered in PERPARHEAANDNARTHR-005)
- Any component files
- Any test files

---

## Implementation Details

### Schema Structure

Create `data/schemas/operations/modifyPartHealth.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/modifyPartHealth.schema.json",
  "title": "MODIFY_PART_HEALTH Operation",
  "description": "Changes a body part's health value by a delta amount. Negative delta = damage, positive delta = healing. Automatically clamps to [0, maxHealth] bounds and dispatches health changed event.",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "MODIFY_PART_HEALTH" },
        "parameters": {
          "type": "object",
          "properties": {
            "part_entity_ref": {
              "description": "Reference to the body part entity. Can be a direct entity ID string or a JSON Logic expression that resolves to an entity ID.",
              "oneOf": [
                { "type": "string" },
                { "type": "object" }
              ]
            },
            "delta": {
              "description": "Health change amount. Negative values deal damage, positive values heal. Can be a number or JSON Logic expression.",
              "oneOf": [
                { "type": "number" },
                { "type": "object" }
              ]
            },
            "clamp_to_bounds": {
              "type": "boolean",
              "default": true,
              "description": "If true, clamps result to [0, maxHealth]. If false, allows overflow/underflow (not recommended)."
            }
          },
          "required": ["part_entity_ref", "delta"],
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
{ "$ref": "./operations/modifyPartHealth.schema.json" }
```

Insert after entries starting with "mod..." and before entries starting with "mov...".

### Design Rationale

1. **part_entity_ref flexibility**: Supports both direct ID strings and JSON Logic for dynamic resolution
2. **delta flexibility**: Supports both literal numbers and JSON Logic expressions
3. **clamp_to_bounds default true**: Safe default prevents negative health or exceeding max
4. **additionalProperties false**: Strict schema prevents future creep
5. **required parameters**: Both part_entity_ref and delta are mandatory

---

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation tests:**
   - `npm run validate` passes without errors
   - `npm run validate:strict` passes without errors

2. **JSON schema validity:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/modifyPartHealth.schema.json'))"
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
4. Schema follows exact same pattern as other operation schemas (e.g., `addComponent.schema.json`)
5. Operation type constant is exactly `MODIFY_PART_HEALTH`

---

## Verification Steps

```bash
# 1. Verify schema is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/modifyPartHealth.schema.json'))"

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
- Base schema: `data/schemas/base-operation.schema.json`
- Integration point: `data/schemas/operation.schema.json`
- Similar operations: `data/schemas/operations/updateHungerState.schema.json` (if exists)
