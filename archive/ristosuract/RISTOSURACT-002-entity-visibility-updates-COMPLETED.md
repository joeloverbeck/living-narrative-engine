# RISTOSURACT-002: Update dredgers liquid body entities with visibility [COMPLETED]

## Summary

Update all existing liquid body entity definitions in the dredgers mod to include the required `visibility: "opaque"` property. This is required after RISTOSURACT-001 makes visibility a required field.

## Status: ✅ COMPLETED

## Files Touched

### Entity Definitions (4 files) - MODIFIED

1. `data/mods/dredgers/entities/definitions/flooded_approach_liquid_body.entity.json` - Added `visibility: "opaque"`
2. `data/mods/dredgers/entities/definitions/canal_run_segment_a_liquid_body.entity.json` - Added `visibility: "opaque"`
3. `data/mods/dredgers/entities/definitions/canal_run_segment_b_liquid_body.entity.json` - Added `visibility: "opaque"`
4. `data/mods/dredgers/entities/definitions/canal_run_segment_c_liquid_body.entity.json` - Added `visibility: "opaque"`

### Entity Instances (4 files) - VERIFIED NO CHANGES NEEDED

5. `data/mods/dredgers/entities/instances/flooded_approach_liquid_body.entity.json` - Verified: Only overrides `core:position`, inherits `liquids:liquid_body` from definition
6. `data/mods/dredgers/entities/instances/canal_run_segment_a_liquid_body.entity.json` - Verified: Only overrides `core:position`
7. `data/mods/dredgers/entities/instances/canal_run_segment_b_liquid_body.entity.json` - Verified: Only overrides `core:position`
8. `data/mods/dredgers/entities/instances/canal_run_segment_c_liquid_body.entity.json` - Verified: Only overrides `core:position`

### Tests (1 file) - CREATED

9. `tests/integration/mods/dredgers/liquidBodyVisibility.integration.test.js` - New test file verifying:
   - All 4 entity definitions have `visibility: "opaque"`
   - All `connected_liquid_body_ids` values preserved unchanged
   - All entity IDs, names, and descriptions unchanged

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned**: Add `visibility: "opaque"` to 4 entity definition files
**Actual**: Exactly as planned

**Planned**: Verify instance files need no changes
**Actual**: Confirmed - all instance files only override `core:position`, inheriting `liquids:liquid_body` from their definitions

**Additional**: Created `liquidBodyVisibility.integration.test.js` to capture this invariant and ensure future modifications don't break the visibility property or connected_liquid_body_ids

### Verification Results

- ✅ `npm run validate` passes (0 cross-reference violations across 82 mods)
- ✅ `npm run test:integration -- tests/integration/mods/liquids/` passes (130 tests)
- ✅ `npm run test:unit -- tests/unit/mods/liquids/` passes (19 tests)
- ✅ New test `liquidBodyVisibility.integration.test.js` passes (11 tests)
- ✅ `grep -l "visibility" data/mods/dredgers/entities/definitions/*liquid_body*.json | wc -l` = 4

### Invariants Verified

- [x] All `connected_liquid_body_ids` values remain unchanged
- [x] All entity IDs remain unchanged
- [x] All instance IDs remain unchanged
- [x] All `definitionId` references remain unchanged
- [x] `core:name` and `core:description` remain unchanged
- [x] `core:position` (in instances) remains unchanged
- [x] No new files created (except test file)

## Dependencies

- ✅ RISTOSURACT-001 (component schema updated first) - COMPLETED

## Blocks

- RISTOSURACT-009 (component schema tests) - Now unblocked
