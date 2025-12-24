# OXYDROSYS-005: Create respiratory slot library

## Description

Create a slot library defining respiratory organ slots that can be reused across different creature blueprints.

## Files to Create

- `data/mods/breathing/libraries/respiratory.slot-library.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add library to `content.libraries` array

## Out of Scope

- Modifications to existing anatomy slot libraries
- Integration with specific blueprints (separate tickets)
- Entity definitions

## Acceptance Criteria

1. **Schema valid**: Library passes anatomy.slot-library.schema.json validation
2. **Slot definitions**: `standard_lung` slot defined with requirements for `partType: "lung"`
3. **ID format**: `breathing:respiratory_slots`

## Tests That Must Pass

- `npm run validate` - Schema validation

## Invariants

- Does not modify any existing slot library
- Follows established slot library patterns from `anatomy:humanoid_slots`

---

## Outcome

**Status**: Completed

### Files Created

1. **`data/mods/breathing/libraries/respiratory.slot-library.json`**
   - ID: `breathing:respiratory_slots`
   - Defines `standard_lung` slot with:
     - Socket: `lung_socket`
     - Requirements: `partType: "lung"`, components: `["anatomy:part", "breathing:respiratory_organ"]`

2. **`tests/unit/mods/breathing/libraries/respiratory.slot-library.test.js`**
   - 12 unit tests covering schema validation, library definition, slot definition, and invariants

### Files Modified

1. **`data/mods/breathing/mod-manifest.json`**
   - Added `"libraries": ["respiratory.slot-library.json"]` to content section
   - Added `"anatomy"` as a dependency (required because slot references `anatomy:part` component)

### Acceptance Criteria Verification

1. **Schema valid**: Passed `npm run validate` with 0 cross-reference violations
2. **Slot definitions**: `standard_lung` slot correctly defined with `partType: "lung"`
3. **ID format**: Library ID is `breathing:respiratory_slots`

### Tests

- All 12 unit tests pass
- Schema validation passes

### Notes

- Added `anatomy` mod as a dependency since the slot library requires the `anatomy:part` component
- Followed patterns from `anatomy:humanoid_slots` for slot definition structure
