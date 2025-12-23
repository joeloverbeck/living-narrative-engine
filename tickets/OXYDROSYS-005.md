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
