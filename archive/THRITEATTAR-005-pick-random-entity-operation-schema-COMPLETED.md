# THRITEATTAR-005: Create PICK_RANDOM_ENTITY Operation Schema (COMPLETED)

## Outcome
- Created `data/schemas/operations/pickRandomEntity.schema.json` with the specified schema structure.
- Updated `data/schemas/operation.schema.json` to include the reference to the new schema.
- Verified validation using `node -e ...` and `npm run validate`.
- NOTE: `npm run validate:operations` fails as expected because the handler implementation is explicitly out of scope for this ticket.

## Summary

Create the JSON schema for the new `PICK_RANDOM_ENTITY` operation. This operation picks a random entity from a location with optional exclusions and component filters. It is needed for the FUMBLE outcome where the thrown item may hit an unintended entity.

## Files to Create

| File | Purpose |
|------|---------|
| `data/schemas/operations/pickRandomEntity.schema.json` | Operation schema definition |

## Files to Modify

| File | Modification |
|------|-------------|
| `data/schemas/operation.schema.json` | Add `$ref` to the new schema in the `anyOf` array |

## Implementation Details

### pickRandomEntity.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/pickRandomEntity.schema.json",
  "title": "PICK_RANDOM_ENTITY Operation",
  "description": "Picks a random entity from a location with optional exclusions and component filters",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "type": "object",
      "properties": {
        "type": {
          "const": "PICK_RANDOM_ENTITY"
        },
        "parameters": {
          "type": "object",
          "properties": {
            "location_id": {
              "description": "Location to search for entities",
              "oneOf": [
                { "type": "string" },
                { "type": "object" }
              ]
            },
            "exclude_entities": {
              "description": "Array of entity IDs to exclude from selection",
              "type": "array",
              "items": {
                "oneOf": [
                  { "type": "string" },
                  { "type": "object" }
                ]
              },
              "default": []
            },
            "require_components": {
              "description": "Entity must have ALL these components",
              "type": "array",
              "items": { "type": "string" },
              "default": []
            },
            "exclude_components": {
              "description": "Entity must NOT have ANY of these components",
              "type": "array",
              "items": { "type": "string" },
              "default": []
            },
            "result_variable": {
              "description": "Variable name to store the selected entity ID (or null if none)",
              "type": "string"
            }
          },
          "required": ["location_id", "result_variable"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

### Modification to operation.schema.json

Add the following `$ref` entry to the `anyOf` array (alphabetically sorted):

```json
{ "$ref": "./operations/pickRandomEntity.schema.json" }
```

### Parameter Details

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `location_id` | string/object | Yes | - | Location entity ID or JSON Logic expression |
| `exclude_entities` | array | No | `[]` | Entity IDs to exclude from selection |
| `require_components` | array | No | `[]` | Components the entity must have (AND logic) |
| `exclude_components` | array | No | `[]` | Components the entity must NOT have (OR logic) |
| `result_variable` | string | Yes | - | Context variable to store result |

## Out of Scope

- **DO NOT** create the handler implementation (THRITEATTAR-006)
- **DO NOT** modify DI registrations (THRITEATTAR-007)
- **DO NOT** modify preValidationUtils.js (THRITEATTAR-007)
- **DO NOT** create test files (THRITEATTAR-011)

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` completes without errors
2. Schema is valid JSON Schema draft-07
3. Schema correctly extends base-operation.schema.json
4. `$ref` in operation.schema.json resolves correctly

### Invariants That Must Remain True

1. All existing operation schemas continue to function correctly
2. The operation type `PICK_RANDOM_ENTITY` is unique
3. Schema follows the same pattern as other operation schemas
4. `additionalProperties: false` prevents unexpected parameters

## Validation Commands

```bash
# Verify schema is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/pickRandomEntity.schema.json'))"

# Run project validation (checks schema integrity)
npm run validate
```

## Reference Files

For understanding operation schema patterns:
- `data/schemas/operations/getDamageCapabilities.schema.json` - Similar operation schema
- `data/schemas/operations/setVariable.schema.json` - Simple operation pattern
- `data/schemas/base-operation.schema.json` - Base schema being extended

## Dependencies

- None (schema can be created independently)

## Blocks

- THRITEATTAR-006 (handler implementation needs this schema)
- THRITEATTAR-007 (pre-validation needs this operation type)
- THRITEATTAR-009 (macros use this operation)
