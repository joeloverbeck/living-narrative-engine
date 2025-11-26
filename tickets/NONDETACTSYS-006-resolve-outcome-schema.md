# NONDETACTSYS-006: Create RESOLVE_OUTCOME Operation Schema

## Summary

Create the JSON schema definition for the `RESOLVE_OUTCOME` operation and add its reference to the main operation schema. This operation is used in rule actions to resolve non-deterministic action outcomes.

## Files to Create

| File | Purpose |
|------|---------|
| `data/schemas/operations/resolveOutcome.schema.json` | Operation schema definition |

## Files to Modify

| File | Change |
|------|--------|
| `data/schemas/operation.schema.json` | Add `$ref` to resolveOutcome.schema.json in `anyOf` array |

## Implementation Details

### resolveOutcome.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/resolveOutcome.schema.json",
  "title": "RESOLVE_OUTCOME Operation",
  "description": "Resolves a non-deterministic action outcome using skill-based probability",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "RESOLVE_OUTCOME" },
        "parameters": {
          "type": "object",
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
      },
      "required": ["type", "parameters"]
    }
  ]
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

- [ ] Schema follows existing operation schema patterns
- [ ] Schema extends base-operation.schema.json correctly
- [ ] All property types are correct
- [ ] Required properties are correct
- [ ] Default values are specified
- [ ] Schema ID follows naming convention
- [ ] $ref in operation.schema.json is alphabetically sorted
- [ ] No modifications to other schema files

## Dependencies

- **Depends on**: Nothing
- **Blocked by**: Nothing
- **Blocks**: NONDETACTSYS-007 (handler needs schema for validation)

## Reference Files

| File | Purpose |
|------|---------|
| `data/schemas/operations/addComponent.schema.json` | Operation schema pattern |
| `data/schemas/operations/if.schema.json` | Complex operation schema pattern |
| `data/schemas/base-operation.schema.json` | Base schema to extend |
| `data/schemas/operation.schema.json` | Where to add $ref |
