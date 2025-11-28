# OPEHANARCANA-001: PREPARE_ACTION_CONTEXT Schema Definition

**Status:** Completed
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None

---

## Objective

Create the JSON schema for the `PREPARE_ACTION_CONTEXT` operation, which will consolidate the common context setup pattern used by 194 rules (82% of all rules).

---

## Files to Touch

### New Files
- `data/schemas/operations/prepareActionContext.schema.json`

### Modified Files
- `data/schemas/operation.schema.json` (add `$ref` entry)
- `src/configuration/staticConfiguration.js` (register new schema file)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation handler schemas
- Any operation handler implementation files
- Any rule files (migrations are separate tickets)
- Any DI registration files (covered in OPEHANARCANA-003)
- `preValidationUtils.js` (covered in OPEHANARCANA-003)

---

## Implementation Details

### Schema Structure

Create `data/schemas/operations/prepareActionContext.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/prepareActionContext.schema.json",
  "title": "PREPARE_ACTION_CONTEXT Operation",
  "description": "Consolidates common action context setup: resolves actor/target names, queries position, sets perception type and IDs",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "PREPARE_ACTION_CONTEXT" },
        "parameters": {
          "type": "object",
          "properties": {
            "perception_type": {
              "type": "string",
              "default": "action_target_general",
              "description": "Type of perception event for witnesses"
            },
            "include_secondary": {
              "type": "boolean",
              "default": false,
              "description": "Whether to resolve secondaryId name"
            },
            "secondary_name_variable": {
              "type": "string",
              "description": "Variable name for secondary entity name (required if include_secondary is true)"
            }
          },
          "additionalProperties": false
        }
      },
      "required": ["type"]
    }
  ]
}
```

### operation.schema.json Update

Add to the `anyOf` array in alphabetical order:

```json
{ "$ref": "./operations/prepareActionContext.schema.json" }
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation tests:**
   - `npm run validate` passes without errors
   - `npm run validate:strict` passes without errors

2. **JSON schema validity:**
   - Schema file is valid JSON (parseable)
   - Schema references resolve correctly (`$ref` to base-operation.schema.json)

3. **Manual validation:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/prepareActionContext.schema.json'))"
   ```

### Invariants That Must Remain True

1. All existing operation schemas remain unchanged
2. All existing rules continue to validate successfully
3. `npm run test:unit && npm run test:integration` passes (no logic regressions)
4. Schema follows the exact same pattern as other operation schemas (e.g., `addComponent.schema.json`)

> **Note:** `npm run test:ci` (specifically `validate:operations`) and `npm run test:integration` (specifically `operationTypeCompleteness.test.js`) will fail until the handler implementation, DI registration, and `preValidationUtils.js` updates (OPEHANARCANA-002, OPEHANARCANA-003) are complete. This is expected for this phased implementation.

---

## Verification Steps

```bash
# 1. Verify schema is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/prepareActionContext.schema.json'))"

# 2. Verify operation.schema.json is valid after modification
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operation.schema.json'))"

# 3. Run full validation
npm run validate

# 4. Run test suite (excluding validate:operations)
npm run typecheck
npm run test:unit
npm run test:integration
```

---

## Reference Files

- Pattern to follow: `data/schemas/operations/addComponent.schema.json`
- Base schema: `data/schemas/base-operation.schema.json`
- Integration point: `data/schemas/operation.schema.json`

## Outcome

- Created `data/schemas/operations/prepareActionContext.schema.json`.
- Added reference to `data/schemas/operation.schema.json`.
- **Deviation:** Modified `src/configuration/staticConfiguration.js` to register the new schema file (omitted from original ticket scope).
- **Note:** `npm run test:ci` and `npm run test:integration` are currently failing as expected due to missing implementation and DI registration, which are covered in subsequent tickets (OPEHANARCANA-002, OPEHANARCANA-003). The "Out of Scope" constraints prevented fixing these tests in this ticket.

