# FACCLOSLOANDREDFIX-006: Add defaultClothingSlotMappings to Slot Library Schema

## Summary

Extend the `anatomy.slot-library.schema.json` schema to allow a new optional property `defaultClothingSlotMappings` that can hold default clothing slot mappings to be auto-inherited by parts.

## Context

Currently every part file redundantly defines the same `clothingSlotMappings`. By adding schema support for `defaultClothingSlotMappings` in the slot library, we can later (FACCLOSLOANDREDFIX-007, 008) have the loader auto-merge these defaults into parts, eliminating redundancy.

## Files to Touch

### Must Modify (1 file)

1. `data/schemas/anatomy.slot-library.schema.json`

## Out of Scope

- DO NOT modify the slot library data file (handled in FACCLOSLOANDREDFIX-008)
- DO NOT modify the loader (handled in FACCLOSLOANDREDFIX-007)
- DO NOT modify part files
- DO NOT modify entity files
- DO NOT modify any other schema files
- DO NOT add any other properties to the schema

## Implementation Details

Add a new optional property `defaultClothingSlotMappings` to the schema's `properties` section. The type should mirror the existing `clothingSlotMappings` structure used in part files.

**Schema addition:**
```json
{
  "properties": {
    // ... existing properties (id, description, slotDefinitions, clothingDefinitions) ...

    "defaultClothingSlotMappings": {
      "type": "object",
      "description": "Default clothing slot mappings automatically inherited by parts using this library. Parts can override individual mappings.",
      "additionalProperties": {
        "$ref": "#/definitions/clothingSlotMapping"
      }
    }
  }
}
```

**Note:** Verify the actual `$ref` path by examining the existing schema structure. The reference should point to whatever definition type is used for individual clothing slot mappings (likely an object with `$use` or direct slot configuration).

### Schema Structure Investigation

Before implementing, examine:
1. How `clothingSlotMappings` is defined in part file schemas
2. Whether a reusable `clothingSlotMapping` definition exists
3. The exact property names and structure in the existing slot library schema

If no `clothingSlotMapping` definition exists, you may need to:
- Create one in the `definitions` section, OR
- Use inline type definition matching the existing part file pattern

## Acceptance Criteria

### Tests That Must Pass

1. Schema validation passes: `npm run validate`
2. The schema file itself is valid JSON Schema
3. Existing slot library validates against updated schema
4. All existing anatomy tests pass: `npm run test:unit -- --testPathPattern="anatomy"`

### Invariants That Must Remain True

1. **Backward compatible**: Schema changes must NOT break validation of existing slot library files
2. **Property is optional**: `defaultClothingSlotMappings` should NOT be in `required` array
3. **Valid JSON Schema**: File remains a valid JSON Schema document
4. **Existing properties unchanged**: All pre-existing properties and definitions remain exactly as they were
5. **Reference resolution**: Any `$ref` used must resolve correctly within the schema
6. **Consistent structure**: The mapping structure matches what part files use for `clothingSlotMappings`

### Manual Verification

After implementation:
1. `npm run validate` completes without errors
2. Can validate a slot library file with `defaultClothingSlotMappings` using the schema
3. Can validate a slot library file WITHOUT `defaultClothingSlotMappings` (backward compat)

## Test Case for Schema

Create a test case that validates:
```json
{
  "id": "test:slot_library",
  "slotDefinitions": {},
  "clothingDefinitions": {},
  "defaultClothingSlotMappings": {
    "test_slot": { "$use": "some_definition" }
  }
}
```

## Dependencies

- None (schema-only change)

## Blocked By

- Nothing (can be done in parallel with Phase 1)

## Blocks

- FACCLOSLOANDREDFIX-007 (loader needs schema support before using the property)
- FACCLOSLOANDREDFIX-008 (slot library can't use property until schema allows it)
