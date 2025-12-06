# OPEHANARCANA-012: BREAK_BIDIRECTIONAL_CLOSENESS Schema Definition

**Status:** Completed
**Priority:** High (Phase 2)
**Estimated Effort:** 0.25 days
**Dependencies:** OPEHANARCANA-009 (ESTABLISH schema as reference)

---

## Objective

Create the JSON schema for the `BREAK_BIDIRECTIONAL_CLOSENESS` operation, which consolidates the release/break pattern for hugging/hand-holding relationships (6 rules, ~85% reduction).

---

## Files to Touch

### New Files

- `data/schemas/operations/breakBidirectionalCloseness.schema.json`

### Modified Files

- `data/schemas/operation.schema.json` (add `$ref` entry)
- `src/configuration/staticConfiguration.js` (add to `OPERATION_SCHEMA_FILES` list)

---

## Out of Scope

**DO NOT modify:**

- Any existing operation handler schemas
- Any operation handler implementation files
- Any rule files (migrations are separate tickets)
- Any DI registration files (covered in OPEHANARCANA-014)
- `preValidationUtils.js` (covered in OPEHANARCANA-014)
- ESTABLISH_BIDIRECTIONAL_CLOSENESS files (separate tickets)

---

## Implementation Details

### Schema Structure

Create `data/schemas/operations/breakBidirectionalCloseness.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/breakBidirectionalCloseness.schema.json",
  "title": "BREAK_BIDIRECTIONAL_CLOSENESS Operation",
  "description": "Removes mutual relationship components from both actor and target, cleaning up the bidirectional closeness relationship",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "BREAK_BIDIRECTIONAL_CLOSENESS" },
        "parameters": {
          "type": "object",
          "properties": {
            "actor_component_type": {
              "type": "string",
              "description": "Component type to remove from actor, e.g., 'hugging:hugging'",
              "pattern": "^[a-z_]+:[a-z_]+$"
            },
            "target_component_type": {
              "type": "string",
              "description": "Component type to remove from target, e.g., 'hugging:being_hugged'",
              "pattern": "^[a-z_]+:[a-z_]+$"
            },
            "additional_component_types_to_remove": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Additional component types to remove from both entities"
            },
            "regenerate_descriptions": {
              "type": "boolean",
              "default": true,
              "description": "Whether to regenerate entity descriptions after relationship removal"
            }
          },
          "required": ["actor_component_type", "target_component_type"],
          "additionalProperties": false
        }
      },
      "required": ["type", "parameters"]
    }
  ]
}
```

### operation.schema.json Update

Add to the `anyOf` array in alphabetical order:

```json
{ "$ref": "./operations/breakBidirectionalCloseness.schema.json" }
```

---

## Schema Design Rationale

1. **Simpler than ESTABLISH**: No data to add, just removal
2. **`actor_component_type` / `target_component_type`**: Primary components to remove
3. **`additional_component_types_to_remove`**: For complex cases with secondary components
4. **`regenerate_descriptions`**: Control description regeneration for performance

---

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation tests:**
   - `npm run validate` passes without errors
   - `npm run validate:strict` passes without errors

2. **JSON schema validity:**
   - Schema file is valid JSON (parseable)
   - Schema references resolve correctly

3. **Manual validation:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/breakBidirectionalCloseness.schema.json'))"
   ```

### Invariants That Must Remain True

1. All existing operation schemas remain unchanged
2. All existing rules continue to validate successfully
3. `npm run test:ci` passes (no regressions) _Note: validate:operations will fail until handler is implemented_

---

## Verification Steps

```bash
# 1. Verify schema is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/breakBidirectionalCloseness.schema.json'))"

# 2. Verify operation.schema.json is valid after modification
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operation.schema.json'))"

# 3. Run full validation
npm run validate

# 4. Run test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/schemas/operations/establishBidirectionalCloseness.schema.json`
- Base schema: `data/schemas/base-operation.schema.json`

## Outcome

- Created `data/schemas/operations/breakBidirectionalCloseness.schema.json`.
- Added reference to `data/schemas/operation.schema.json`.
- Added file to `src/configuration/staticConfiguration.js` (required for loading).
- `npm run validate` passes.
- `npm run validate:operations` fails as expected (missing implementation).
- `npm run test:unit` has unrelated failures regarding `InjuryStatusPanel` and `DeathCheckService` (pre-existing).
