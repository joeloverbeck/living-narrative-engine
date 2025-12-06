# DISBODPARSPA-001: Add `definitionId` Field to `anatomy:part` Component Schema

## Status: ✅ COMPLETED

**Completed**: 2025-12-04

---

## Summary

Extend the `anatomy:part` component schema to include a `definitionId` field that stores the entity definition ID from which the body part was instantiated. This enables the system to trace body part instances back to their original definitions for spawning purposes.

## Rationale

When dismemberment occurs, the system needs to know which entity definition to instantiate for the spawned body part. While entity instances have a `definitionId` getter at runtime, this information is not persisted in component data and could be lost after serialization/save-load cycles.

---

## Outcome

### What Was Actually Changed

| File                                                               | Change Type | Description                                                 |
| ------------------------------------------------------------------ | ----------- | ----------------------------------------------------------- |
| `data/mods/anatomy/components/part.component.json`                 | Modified    | Added optional `definitionId` string property to dataSchema |
| `tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js` | Modified    | Added 5 new tests for `definitionId` field validation       |

### Versus Originally Planned

The implementation matched the original plan exactly:

- ✅ Added `definitionId` property as optional string field
- ✅ Maintained backward compatibility (existing payloads without `definitionId` still valid)
- ✅ Schema ID unchanged (`anatomy:part`)
- ✅ Required fields unchanged (only `subType` required)
- ✅ `additionalProperties: false` maintained

### Tests Added

| Test                                                    | Rationale                                           |
| ------------------------------------------------------- | --------------------------------------------------- |
| `✓ valid with definitionId`                             | Validates basic usage of new field                  |
| `✓ valid with orientation and definitionId`             | Validates combination with existing optional fields |
| `✓ valid with all optional fields`                      | Validates full schema with all fields populated     |
| `✗ invalid - definitionId must be string`               | Type enforcement for `definitionId`                 |
| `✓ backward compatibility - valid without definitionId` | Explicit backward compatibility guarantee           |

### Verification Results

```
✅ npm run validate - PASSED (0 violations across 51 mods)
✅ Unit tests - 115 tests passed in core-and-anatomy.allComponents.schema.test.js
✅ entityGraphBuilder tests - 41 tests passed (unit + integration)
```

---

## Files to Touch

| File                                               | Change Type | Description                           |
| -------------------------------------------------- | ----------- | ------------------------------------- |
| `data/mods/anatomy/components/part.component.json` | Modify      | Add `definitionId` property to schema |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/entityGraphBuilder.js` - Populating the field is DISBODPARSPA-020
- Any entity definition files - No need to add `definitionId` to static definitions
- `src/anatomy/services/damageTypeEffectsService.js` - No changes
- `src/anatomy/services/dismemberedBodyPartSpawner.js` - Does not exist yet (DISBODPARSPA-021)
- Test files - Minimal schema validation only; full tests in DISBODPARSPA-031
- Migration logic for existing saved games

---

## Implementation Details

### Current Schema

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:part",
  "description": "Marks an entity as an anatomy body part with a specific subtype",
  "dataSchema": {
    "type": "object",
    "properties": {
      "subType": {
        "type": "string",
        "description": "The specific type of body part (e.g., 'leg', 'arm', 'breast', 'head')"
      },
      "orientation": {
        "type": "string",
        "description": "The orientation of the body part inherited from parent socket (e.g., 'left', 'right', 'mid', or indexed like '1', '2')"
      },
      "hit_probability_weight": {
        "type": "number",
        "description": "Relative weight for being hit in a general attack (e.g., torso > finger)",
        "minimum": 0,
        "default": 1.0
      }
    },
    "required": ["subType"],
    "additionalProperties": false
  }
}
```

### Updated Schema

Add the `definitionId` property:

```json
{
  "properties": {
    ...existing properties...,
    "definitionId": {
      "type": "string",
      "description": "The entity definition ID this body part was instantiated from (e.g., 'anatomy:human_foot'). Populated at runtime during anatomy graph building."
    }
  }
}
```

**Note**: `definitionId` is NOT required - it's optional for backward compatibility with existing saved games and entity definitions.

---

## Acceptance Criteria

### Tests That Must Pass

#### Schema Validation (via `npm run validate`)

1. ✅ Schema validates successfully with `npm run validate`
2. ✅ Example components with `definitionId` validate correctly
3. ✅ Example components without `definitionId` still validate (backward compatibility)

#### Manual Validation Test

```bash
# Validate schema syntax
npm run validate

# Should complete without errors for anatomy mod
```

### Invariants That Must Remain True

1. **Backward Compatibility**: Existing entity definitions and saved games with `anatomy:part` components that lack `definitionId` must remain valid
2. **Schema ID Unchanged**: Component ID remains `anatomy:part`
3. **Required Fields Unchanged**: Only `subType` is required; `definitionId` is optional
4. **additionalProperties**: Must remain `false` to catch typos

---

## Verification Commands

```bash
# Validate all schemas and mods
npm run validate

# Check specific schema file
cat data/mods/anatomy/components/part.component.json | jq .
```

---

## Dependencies

- None - this ticket can be worked independently

## Blocks

- DISBODPARSPA-020 (EntityGraphBuilder needs schema to exist)
- DISBODPARSPA-021 (Spawner service reads definitionId)
- DISBODPARSPA-030 (Unit tests for spawner)
- DISBODPARSPA-031 (Unit tests for EntityGraphBuilder)
