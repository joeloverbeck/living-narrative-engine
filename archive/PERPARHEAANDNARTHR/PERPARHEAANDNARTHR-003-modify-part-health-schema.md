# PERPARHEAANDNARTHR-003: MODIFY_PART_HEALTH Schema Definition

**Status:** Completed ✓
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Completed Date:** 2025-11-28

---

## Objective

Create the JSON schema for the `MODIFY_PART_HEALTH` operation, which changes a body part's health value by a delta amount (positive for healing, negative for damage).

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned (ticket assumptions):**
1. Create schema with inline parameters definition
2. Update `operation.schema.json` only
3. Do NOT modify `preValidationUtils.js`

**Actual Implementation (after codebase analysis):**
1. ✅ Created schema using `$defs/Parameters` with `$ref` pattern (matching established codebase convention)
2. ✅ Updated `operation.schema.json` with `$ref` entry
3. ✅ Updated `staticConfiguration.js` - **discovered requirement** (schema loader needs file registered)
4. ✅ Updated `preValidationUtils.js` - **discovered requirement** (integration test enforces operation type completeness)

**Key Discrepancies Found:**
- Ticket proposed inline parameters but actual pattern uses `$defs/Parameters` with `$ref`
- Ticket omitted `staticConfiguration.js` update requirement
- Ticket explicitly excluded `preValidationUtils.js` but integration test `operationTypeCompleteness.test.js` requires all schemas to have matching whitelist entries

**Files Changed:**
| File | Change Type |
|------|-------------|
| `data/schemas/operations/modifyPartHealth.schema.json` | Created |
| `data/schemas/operation.schema.json` | Modified (added `$ref`) |
| `src/configuration/staticConfiguration.js` | Modified (added to OPERATION_SCHEMA_FILES) |
| `src/utils/preValidationUtils.js` | Modified (added to KNOWN_OPERATION_TYPES) |

**Tests:**
- No new tests created (schema-only ticket - existing validation tests cover this)
- All existing tests pass: `npm run validate`, `npm run validate:strict`
- Schema tests: 67 suites, 1241 tests passed
- Integration validation tests: 56 suites, 450 tests passed

---

## Files to Touch

### New Files
- `data/schemas/operations/modifyPartHealth.schema.json`

### Modified Files
- `data/schemas/operation.schema.json` (add `$ref` entry to `$defs/Operation/anyOf` array)
- `src/configuration/staticConfiguration.js` (add `'modifyPartHealth.schema.json'` to `OPERATION_SCHEMA_FILES` array)
- `src/utils/preValidationUtils.js` (add `'MODIFY_PART_HEALTH'` to `KNOWN_OPERATION_TYPES` array - **required by operationTypeCompleteness integration test**)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation schemas
- Any operation handler implementation files
- Any rule files
- Any DI registration files (covered in PERPARHEAANDNARTHR-005)
- Any component files
- Any test files

**Note:** `preValidationUtils.js` MUST be modified (originally listed as out-of-scope for ticket 005) because the `operationTypeCompleteness.test.js` integration test requires all operation schemas to have matching whitelist entries. This is a schema completeness requirement, not a handler registration requirement.

---

## Implementation Details

### Schema Structure

Create `data/schemas/operations/modifyPartHealth.schema.json`:

**Note:** This schema follows the established pattern from `addComponent.schema.json` and `updateHungerState.schema.json`, using `$defs/Parameters` with a `$ref` instead of inline parameters definition.

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
          "$ref": "#/$defs/Parameters"
        }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the MODIFY_PART_HEALTH operation.",
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
  }
}
```

### operation.schema.json Update

Add to the `$defs/Operation/anyOf` array in `data/schemas/operation.schema.json`.

Find the correct alphabetical position in the existing `anyOf` array within the `Operation` definition. Insert:

```json
{ "$ref": "./operations/modifyPartHealth.schema.json" }
```

Insert after `modifyContextArray.schema.json` and before any operations starting with "n..." (if none exist, at the end of the "mod*" group).

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
