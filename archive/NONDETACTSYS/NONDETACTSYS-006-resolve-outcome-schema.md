# NONDETACTSYS-006: Create RESOLVE_OUTCOME Operation Schema

**Status**: ✅ COMPLETED (2025-11-26)

## Summary

Create the JSON schema definition for the `RESOLVE_OUTCOME` operation and add its reference to the main operation schema. This operation is used in rule actions to resolve non-deterministic action outcomes.

## Files to Create

| File                                                 | Purpose                     |
| ---------------------------------------------------- | --------------------------- |
| `data/schemas/operations/resolveOutcome.schema.json` | Operation schema definition |

## Files to Modify

| File                                       | Change                                                             |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `data/schemas/operation.schema.json`       | Add `$ref` to resolveOutcome.schema.json in `anyOf` array          |
| `src/configuration/staticConfiguration.js` | Add `resolveOutcome.schema.json` to `OPERATION_SCHEMA_FILES` array |

## Implementation Details

### resolveOutcome.schema.json

**Note**: Uses `$defs/Parameters` pattern to match existing operation schemas in this project.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/resolveOutcome.schema.json",
  "title": "RESOLVE_OUTCOME Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "RESOLVE_OUTCOME" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the RESOLVE_OUTCOME operation. Resolves a non-deterministic action outcome using skill-based probability.",
      "properties": {
        "actor_skill_component": {
          "type": "string",
          "description": "Component ID for actor's skill (e.g., 'skills:melee_skill')"
        },
        "target_skill_component": {
          "type": "string",
          "description": "Component ID for target's skill (for opposed checks)"
        },
        "actor_skill_default": {
          "type": "integer",
          "default": 0,
          "description": "Default value if actor lacks skill component"
        },
        "target_skill_default": {
          "type": "integer",
          "default": 0,
          "description": "Default value if target lacks skill component"
        },
        "formula": {
          "type": "string",
          "enum": ["ratio", "logistic", "linear"],
          "default": "ratio",
          "description": "Probability calculation formula"
        },
        "difficulty_modifier": {
          "type": "integer",
          "default": 0,
          "description": "Static modifier to difficulty"
        },
        "result_variable": {
          "type": "string",
          "description": "Context variable to store result object"
        }
      },
      "required": ["actor_skill_component", "result_variable"],
      "additionalProperties": false
    }
  }
}
```

### operation.schema.json Modification

Add to the `anyOf` array (alphabetically sorted):

```json
{ "$ref": "./operations/resolveOutcome.schema.json" }
```

## Out of Scope

- **DO NOT** create the handler implementation (NONDETACTSYS-007)
- **DO NOT** add to preValidationUtils.js (NONDETACTSYS-008)
- **DO NOT** register in DI (NONDETACTSYS-008)
- **DO NOT** create tests (schema validation is automatic)
- **DO NOT** modify any service files

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate all schemas
npm run validate

# Validate schema structure
npm run typecheck

# Full validation suite
npm run test:ci
```

### Schema Validation Tests

The following JSON should pass validation:

```json
{
  "type": "RESOLVE_OUTCOME",
  "parameters": {
    "actor_skill_component": "skills:melee_skill",
    "target_skill_component": "skills:defense_skill",
    "actor_skill_default": 10,
    "target_skill_default": 0,
    "formula": "ratio",
    "result_variable": "attackResult"
  }
}
```

The following should fail validation:

```json
// Missing required actor_skill_component
{
  "type": "RESOLVE_OUTCOME",
  "parameters": {
    "result_variable": "attackResult"
  }
}

// Missing required result_variable
{
  "type": "RESOLVE_OUTCOME",
  "parameters": {
    "actor_skill_component": "skills:melee_skill"
  }
}

// Invalid formula value
{
  "type": "RESOLVE_OUTCOME",
  "parameters": {
    "actor_skill_component": "skills:melee_skill",
    "result_variable": "attackResult",
    "formula": "invalid"
  }
}
```

### Invariants That Must Remain True

- [x] Schema follows existing operation schema patterns
- [x] Schema extends base-operation.schema.json correctly
- [x] All property types are correct
- [x] Required properties are correct
- [x] Default values are specified
- [x] Schema ID follows naming convention
- [x] $ref in operation.schema.json is alphabetically sorted
- [x] No modifications to other schema files (except staticConfiguration.js for schema loading)

## Dependencies

- **Depends on**: Nothing
- **Blocked by**: Nothing
- **Blocks**: NONDETACTSYS-007 (handler needs schema for validation)

## Reference Files

| File                                               | Purpose                          |
| -------------------------------------------------- | -------------------------------- |
| `data/schemas/operations/addComponent.schema.json` | Operation schema pattern         |
| `data/schemas/operations/if.schema.json`           | Complex operation schema pattern |
| `data/schemas/base-operation.schema.json`          | Base schema to extend            |
| `data/schemas/operation.schema.json`               | Where to add $ref                |

## Outcome

### What Was Changed vs Originally Planned

1. **Schema Pattern Correction**: The original ticket proposed an inline `parameters` definition. This was corrected to use the `$defs/Parameters` pattern to match the project's existing operation schema conventions.

2. **Additional File Modification**: Required adding `resolveOutcome.schema.json` to `OPERATION_SCHEMA_FILES` array in `src/configuration/staticConfiguration.js` - not documented in the original ticket but necessary for the schema to be loaded.

### Files Created

- `data/schemas/operations/resolveOutcome.schema.json`

### Files Modified

- `data/schemas/operation.schema.json` (added `$ref` in alphabetical order after `resolveDirection`)
- `src/configuration/staticConfiguration.js` (added to `OPERATION_SCHEMA_FILES` array)
- `tickets/NONDETACTSYS-006-resolve-outcome-schema.md` (this ticket - corrected schema pattern)

### Validation Results

- ✅ `npm run validate` - PASSED
- ✅ Schema loaded successfully (103 schemas total)
- ✅ Integration tests passed
- ⚠️ `npm run typecheck` - Pre-existing errors unrelated to this change
