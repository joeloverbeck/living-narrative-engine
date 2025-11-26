# UNWITEOPE-001: Create UNWIELD_ITEM Operation Schema

## Summary

Create the JSON schema for the `UNWIELD_ITEM` operation and add its reference to the root operation schema.

## Files to Create

| File | Purpose |
|------|---------|
| `data/schemas/operations/unwieldItem.schema.json` | Operation schema definition |

## Files to Modify

| File | Change |
|------|--------|
| `data/schemas/operation.schema.json` | Add `$ref` to unwieldItem schema in `anyOf` array |

## Implementation Details

### unwieldItem.schema.json

Create the operation schema at `data/schemas/operations/unwieldItem.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/unwieldItem.schema.json",
  "title": "UNWIELD_ITEM Operation",
  "description": "Stops wielding an item, releasing grabbing appendages and updating the wielding component. Idempotent - succeeds silently if item is not currently wielded.",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UNWIELD_ITEM" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "actor_id": {
          "type": "string",
          "minLength": 1,
          "description": "Entity ID of the actor currently wielding the item"
        },
        "item_id": {
          "type": "string",
          "minLength": 1,
          "description": "Entity ID of the item to stop wielding"
        }
      },
      "required": ["actor_id", "item_id"],
      "additionalProperties": false
    }
  }
}
```

### operation.schema.json Modification

Add the following `$ref` to the `anyOf` array in `data/schemas/operation.schema.json`, maintaining alphabetical order:

```json
{ "$ref": "./operations/unwieldItem.schema.json" }
```

Insert after `unlockGrabbing.schema.json` and before `validateInventoryCapacity.schema.json` (or at the correct alphabetical position).

## Out of Scope

- **DO NOT** create the handler implementation (UNWITEOPE-002)
- **DO NOT** modify DI registrations (UNWITEOPE-003)
- **DO NOT** create tests (UNWITEOPE-004, UNWITEOPE-007)
- **DO NOT** modify any rule files (UNWITEOPE-005, UNWITEOPE-006)
- **DO NOT** modify any source code files

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate schema syntax
npm run validate

# Full schema validation
npm run validate:strict

# Schema-specific tests
npm run test:ci
```

### Manual Verification Checklist

1. [ ] `unwieldItem.schema.json` exists at correct path
2. [ ] Schema follows `allOf` pattern with base-operation reference
3. [ ] `type` is correctly set to `"const": "UNWIELD_ITEM"`
4. [ ] `parameters` has `actor_id` and `item_id` as required strings
5. [ ] `additionalProperties: false` prevents extra parameters
6. [ ] Reference added to `operation.schema.json` at correct alphabetical position

### Invariants That Must Remain True

- [ ] Schema validates successfully with AJV
- [ ] Schema `$id` follows project convention
- [ ] Schema extends `base-operation.schema.json`
- [ ] All existing operation schemas continue to validate
- [ ] `npm run validate` passes without errors
- [ ] No modifications to any files outside the file list

## Dependencies

- **Depends on**: None (first ticket in series)
- **Blocked by**: None
- **Blocks**: UNWITEOPE-002 (handler needs schema), UNWITEOPE-003 (DI needs handler)

## Reference Files

| File | Purpose |
|------|---------|
| `data/schemas/operations/unlockGrabbing.schema.json` | Similar operation schema pattern |
| `data/schemas/operations/dropItemAtLocation.schema.json` | Similar parameter structure |
| `data/schemas/base-operation.schema.json` | Base schema to extend |
