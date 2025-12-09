# SEACONINT-001: Create furniture:near_furniture Component Schema

**Status**: COMPLETED
**Priority**: HIGH
**Estimated Effort**: 30 minutes
**Dependencies**: None
**Blocks**: SEACONINT-002, SEACONINT-006, SEACONINT-007

## Objective

Create a new component schema `furniture:near_furniture` that tracks which furniture entities a piece of furniture is "near" for seated interaction purposes.

## Files Created

| File | Purpose |
|------|---------|
| `data/mods/furniture/components/near_furniture.component.json` | Component schema definition |

## Files Modified

None.

## Out of Scope

- **DO NOT** modify any existing component schemas
- **DO NOT** modify the furniture mod manifest (handled in SEACONINT-007)
- **DO NOT** create any operator code (handled in SEACONINT-002)
- **DO NOT** update any entity instances (handled in SEACONINT-006)
- **DO NOT** create any tests (component schemas don't have dedicated tests)

## Implementation Details

Created the component schema file at `data/mods/furniture/components/near_furniture.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "furniture:near_furniture",
  "description": "Tracks which furniture entities this piece of furniture is 'near' for seated interaction purposes. Actors sitting on this furniture can interact with containers on nearby furniture.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["nearFurnitureIds"],
    "properties": {
      "nearFurnitureIds": {
        "type": "array",
        "description": "Array of entity instance IDs of furniture that this furniture is near",
        "items": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
        },
        "uniqueItems": true,
        "default": []
      }
    }
  }
}
```

## Design Notes

- **Instance-level configuration**: This component is added to entity instances, not definitions, because proximity is specific to the placement of furniture in a particular location
- **One-directional relationship**: Stool knows it's near the table; table doesn't need to know about stools
- **Multiple nearby furniture**: A sofa could be near both a coffee table and a nightstand

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` passes with the new component schema
2. Schema validation accepts valid `nearFurnitureIds` arrays:
   - Empty array: `[]`
   - Single ID: `["fantasy:table_instance"]`
   - Multiple IDs: `["fantasy:table_instance", "fantasy:nightstand_instance"]`
3. Schema validation rejects invalid data:
   - Missing `nearFurnitureIds` field
   - Non-array value for `nearFurnitureIds`
   - Invalid ID format (no colon, invalid characters)
   - Duplicate IDs in the array

### Invariants That Must Remain True

1. Existing furniture entity definitions remain unchanged
2. Existing furniture entity instances remain valid
3. The component schema follows the standard component schema format
4. No breaking changes to the furniture mod

## Verification Commands

```bash
# Validate schema syntax
npm run validate

# Ensure no regressions
npm run test:ci
```

---

## Outcome

**Completed**: 2025-12-09

### What Was Actually Changed vs Originally Planned

The implementation matched the original plan exactly. The only additional work required was:

1. **Created `components/` directory**: The furniture mod did not have a `components/` directory, so `data/mods/furniture/components/` was created to house the new component schema.

### Verification Results

- **`npm run validate`**: PASSED - Schema loaded and validated successfully
- **Unit tests**: All 39,319 tests passed
- **Integration tests**: 16,053 tests passed (2 pre-existing failures in unrelated intoxicants and cache modules)

### Notes for Follow-up Tickets

- The new component file shows as "unregistered" in validation output until SEACONINT-007 adds it to `mod-manifest.json`
- No tests were added as component schemas are validated by the schema loading system itself
