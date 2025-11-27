# OPEHANARCANA-009: ESTABLISH_BIDIRECTIONAL_CLOSENESS Schema Definition

**Status:** Ready
**Priority:** High (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-005 (Phase 1 complete)

---

## Objective

Create the JSON schema for the `ESTABLISH_BIDIRECTIONAL_CLOSENESS` operation, which will consolidate the hugging/hand-holding establishment pattern affecting 12 rules (each ~200 lines).

---

## Files to Touch

### New Files
- `data/schemas/operations/establishBidirectionalCloseness.schema.json`

### Modified Files
- `data/schemas/operation.schema.json` (add `$ref` entry)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation handler schemas
- Any operation handler implementation files
- Any rule files (migrations are separate tickets)
- Any DI registration files (covered in OPEHANARCANA-011)
- `preValidationUtils.js` (covered in OPEHANARCANA-011)
- PREPARE_ACTION_CONTEXT files (Phase 1 complete)

---

## Implementation Details

### Schema Structure

Create `data/schemas/operations/establishBidirectionalCloseness.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/establishBidirectionalCloseness.schema.json",
  "title": "ESTABLISH_BIDIRECTIONAL_CLOSENESS Operation",
  "description": "Establishes mutual relationship components on both actor and target, with automatic cleanup of existing third-party relationships",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "ESTABLISH_BIDIRECTIONAL_CLOSENESS" },
        "parameters": {
          "type": "object",
          "properties": {
            "actor_component_type": {
              "type": "string",
              "description": "Component type to add to actor, e.g., 'hugging:hugging'",
              "pattern": "^[a-z_]+:[a-z_]+$"
            },
            "target_component_type": {
              "type": "string",
              "description": "Component type to add to target, e.g., 'hugging:being_hugged'",
              "pattern": "^[a-z_]+:[a-z_]+$"
            },
            "actor_data": {
              "type": "object",
              "description": "Component data for actor (supports template variables like {event.payload.targetId})"
            },
            "target_data": {
              "type": "object",
              "description": "Component data for target (supports template variables like {event.payload.actorId})"
            },
            "clean_existing": {
              "type": "boolean",
              "default": true,
              "description": "Whether to clean up existing relationships with third parties before establishing new ones"
            },
            "existing_component_types_to_clean": {
              "type": "array",
              "items": { "type": "string" },
              "description": "List of component types to remove from both entities before establishing new relationship. If not provided, defaults to removing actor_component_type and target_component_type."
            },
            "regenerate_descriptions": {
              "type": "boolean",
              "default": true,
              "description": "Whether to regenerate entity descriptions after relationship change"
            }
          },
          "required": ["actor_component_type", "target_component_type", "actor_data", "target_data"],
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
{ "$ref": "./operations/establishBidirectionalCloseness.schema.json" }
```

---

## Schema Design Rationale

1. **`actor_component_type` / `target_component_type`**: Namespaced component IDs for flexibility
2. **`actor_data` / `target_data`**: Objects that support template variable interpolation
3. **`clean_existing`**: Boolean flag to control third-party cleanup (some relationships may not need it)
4. **`existing_component_types_to_clean`**: Override default cleanup behavior for complex cases
5. **`regenerate_descriptions`**: Control whether descriptions are regenerated (performance optimization)

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
   node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/establishBidirectionalCloseness.schema.json'))"
   ```

### Invariants That Must Remain True

1. All existing operation schemas remain unchanged
2. All existing rules continue to validate successfully
3. `npm run test:ci` passes (no regressions)
4. Schema follows the exact same pattern as other operation schemas

---

## Verification Steps

```bash
# 1. Verify schema is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/establishBidirectionalCloseness.schema.json'))"

# 2. Verify operation.schema.json is valid after modification
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operation.schema.json'))"

# 3. Run full validation
npm run validate

# 4. Run test suite to ensure no regressions
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/schemas/operations/addComponent.schema.json`
- Similar complexity: `data/schemas/operations/establishSittingCloseness.schema.json`
- Base schema: `data/schemas/base-operation.schema.json`
- Integration point: `data/schemas/operation.schema.json`
