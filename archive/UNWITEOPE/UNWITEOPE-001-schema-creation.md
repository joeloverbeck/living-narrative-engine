# UNWITEOPE-001: Create UNWIELD_ITEM Operation Schema

**Status: ✅ COMPLETED**

## Summary

Create the JSON schema for the `UNWIELD_ITEM` operation and add its reference to the root operation schema.

## Files to Create

| File                                              | Purpose                     |
| ------------------------------------------------- | --------------------------- |
| `data/schemas/operations/unwieldItem.schema.json` | Operation schema definition |

## Files to Modify

| File                                       | Change                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `data/schemas/operation.schema.json`       | Add `$ref` to unwieldItem schema in `anyOf` array                 |
| `src/configuration/staticConfiguration.js` | Add `'unwieldItem.schema.json'` to `OPERATION_SCHEMA_FILES` array |

> **Note (Added)**: The original ticket missed the `staticConfiguration.js` modification. Schema files must be registered in `OPERATION_SCHEMA_FILES` for the schema loader to discover them at runtime.

## Implementation Details

### unwieldItem.schema.json

Create the operation schema at `data/schemas/operations/unwieldItem.schema.json`:

> **Note (Corrected)**: Parameter names changed from `actor_id`/`item_id` to `actorEntity`/`itemEntity` to match existing item operation conventions (see `dropItemAtLocation.schema.json`, `pickUpItemFromLocation.schema.json`, `transferItem.schema.json`). Added pattern validation consistent with other item operations.

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
      "description": "Parameters for the UNWIELD_ITEM operation.",
      "properties": {
        "actorEntity": {
          "type": "string",
          "minLength": 1,
          "pattern": "^\\S(.*\\S)?$",
          "description": "Entity ID of the actor currently wielding the item"
        },
        "itemEntity": {
          "type": "string",
          "minLength": 1,
          "pattern": "^\\S(.*\\S)?$",
          "description": "Entity ID of the item to stop wielding"
        }
      },
      "required": ["actorEntity", "itemEntity"],
      "additionalProperties": false
    }
  }
}
```

### operation.schema.json Modification

Add the following `$ref` to the `anyOf` array in `data/schemas/operation.schema.json`:

> **Note (Corrected)**: The operation.schema.json is NOT alphabetically ordered - it uses functional grouping. Insert after `unlockMovement.schema.json` (line ~173) to group with other unlock/unequip operations, before `regenerateDescription.schema.json`.

```json
{ "$ref": "./operations/unwieldItem.schema.json" }
```

Insert after `unlockMovement.schema.json` to maintain functional grouping with unlock/unequip operations.

### staticConfiguration.js Modification

> **Note (Added)**: This section was missing from the original ticket.

Add the new schema file to the `OPERATION_SCHEMA_FILES` array in `src/configuration/staticConfiguration.js`, maintaining alphabetical order:

```javascript
'unwieldItem.schema.json',
```

Insert after `'unlockMovement.schema.json'` and before `'updateHungerState.schema.json'`.

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
4. [ ] `parameters` has `actorEntity` and `itemEntity` as required strings (with pattern validation)
5. [ ] `additionalProperties: false` prevents extra parameters
6. [ ] Reference added to `operation.schema.json` after `unlockMovement.schema.json`

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

| File                                                     | Purpose                          |
| -------------------------------------------------------- | -------------------------------- |
| `data/schemas/operations/unlockGrabbing.schema.json`     | Similar operation schema pattern |
| `data/schemas/operations/dropItemAtLocation.schema.json` | Similar parameter structure      |
| `data/schemas/base-operation.schema.json`                | Base schema to extend            |

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**

- Create `data/schemas/operations/unwieldItem.schema.json` with `actor_id`/`item_id` parameters
- Add `$ref` to `data/schemas/operation.schema.json` in alphabetical order

**Actually Changed (Corrections Applied):**

1. **Schema Created:** `data/schemas/operations/unwieldItem.schema.json`
   - Changed parameter names from `actor_id`/`item_id` to `actorEntity`/`itemEntity` to match existing item operation conventions
   - Added pattern validation (`"pattern": "^\\S(.*\\S)?$"`) consistent with other item operations

2. **Schema Reference Added:** `data/schemas/operation.schema.json`
   - Added `$ref` after `unlockMovement.schema.json` (functional grouping, not alphabetical)

3. **Schema Loader Registration:** `src/configuration/staticConfiguration.js`
   - **This was MISSING from the original ticket**
   - Added `'unwieldItem.schema.json'` to `OPERATION_SCHEMA_FILES` array
   - Without this, the schema would not be loaded at runtime

**Key Discrepancies Corrected:**

1. Parameter naming convention (`actorEntity`/`itemEntity` vs `actor_id`/`item_id`)
2. Missing `staticConfiguration.js` modification (critical for schema loading)
3. `operation.schema.json` uses functional grouping, not alphabetical order

**Tests Passing:**

- `npm run validate` ✅
- `npm run validate:strict` ✅
- `tests/integration/loaders/schemaLoader.integration.test.js` ✅
- `tests/integration/validation/schemaLoadingIntegrity.test.js` ✅
- `tests/integration/schemaLoader.operations.integration.test.js` ✅
