# Add Documentation to Recipe Schema

**Status**: COMPLETED

## Files to Touch

- `data/schemas/anatomy.recipe.schema.json`

## Out of Scope

- Changing the structure or types in the schema.
- Renaming the `properties` field.

## Scope Clarification (Updated)

The `properties` field appears in **three slot-related definitions** that all share the same filtering semantics:

1. `slotDefinition` (line ~292) - individual slot configs
2. `v1PatternDefinition` (line ~344) - V1 pattern slot matching
3. `enhancedPatternDefinition` (line ~408) - V2 enhanced pattern matching

**Note:** The `clothingEntities.properties` field (line ~155) is intentionally DIFFERENT - it IS for runtime overrides when instantiating clothing, not for filtering. This field should NOT be changed.

## Acceptance Criteria

### Specific Tests

- **Manual Verification:**
  - Inspect `data/schemas/anatomy.recipe.schema.json`.
  - Verify all three slot-related `properties` fields have the updated description.
  - Verify the description explicitly states: "Filters entities by exact component property values. NOT for runtime overrides."
- **Schema Validation:**
  - Run `npm run validate` to ensure valid JSON schema.
  - Verify existing recipes still pass validation.

### Invariants

- Valid recipes must still pass schema validation (no breaking changes).
- The `clothingEntities.properties` field description must remain unchanged (it IS for overrides).

---

## Outcome

### What Was Originally Planned

The original ticket assumed only ONE `properties` field in `slotDefinition` needed documentation.

### What Was Actually Changed

**Discrepancy Found**: During implementation, discovered that the `properties` field appears in THREE slot-related definitions (not just one), all sharing the same filtering semantics.

**Ticket Corrected First**: Updated the ticket with "Scope Clarification" section before making code changes, as instructed.

**Schema Changes Made** (3 edits in `data/schemas/anatomy.recipe.schema.json`):

1. `slotDefinition.properties.properties.description` (line ~294)
2. `v1PatternDefinition.properties.properties.description` (line ~344)
3. `enhancedPatternDefinition.properties.properties.description` (line ~410)

All changed to: `"Filters entities by exact component property values. NOT for runtime overrides."`

**Preserved**: `clothingEntities.properties` description left unchanged (it IS for overrides).

**Tests Added** (4 new tests in `tests/unit/schemas/anatomy.recipe.schema.test.js`):

- Verifies slotDefinition properties field description contains filtering semantics
- Verifies v1PatternDefinition properties field description contains filtering semantics
- Verifies enhancedPatternDefinition properties field description contains filtering semantics
- Verifies clothingEntities.properties retains different (override) semantics

### Verification

- All 181 anatomy test suites (3526 tests) pass
- All 61 schema test suites (1218 tests) pass
- All 4 new documentation tests pass
- JSON schema remains valid
- Existing recipes continue to pass validation
