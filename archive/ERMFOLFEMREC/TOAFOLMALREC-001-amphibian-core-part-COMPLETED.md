# TOAFOLMALREC-001: Create amphibian_core.part.json

## Summary

Create the blueprint part file that defines core amphibian anatomy slots. This is the foundational part file that the toad-folk blueprint will compose.

**Status: Completed (implemented and validated)**

## Background

The dredgers mod needs a toad-folk male recipe (`dredgers:toad_folk_male_standard`) for the character Cress Siltwell. This ticket creates the amphibian core part, which defines slot definitions using the humanoid_slots library.

**Spec Reference**: `specs/toad-folk-male-recipe.md` - Section "1. parts/amphibian_core.part.json"

## Files Created

| File | Description |
|------|-------------|
| `data/mods/dredgers/parts/amphibian_core.part.json` | Blueprint part defining amphibian anatomy slots |

## Implementation Details

Created `data/mods/dredgers/parts/amphibian_core.part.json` with:

1. **Schema Reference**: `"$schema": "schema://living-narrative-engine/anatomy.blueprint-part.schema.json"`
2. **ID**: `"dredgers:amphibian_core"`
3. **Library**: `"anatomy:humanoid_slots"`
4. **Slots**: Mirrors the `humanoid_core` layout but omits both hair-related slots (`hair`, `pubic_hair`) because toads are fully hairless.
5. **Clothing Slot Mappings**: Standard mappings for head_gear, face_gear, torso_upper, arms, hands, legs, feet, etc.

### Key Differences from mustelid_core.part.json

- **No hair or pubic_hair slots** - Amphibians are hairless
- Same structure otherwise - uses humanoid_slots library

### Slot List (22 slots)

- head, left_arm, right_arm, left_leg, right_leg
- left_eye, right_eye, left_ear, right_ear
- nose, mouth, teeth
- left_hand, right_hand, left_foot, right_foot
- asshole, left_ass, right_ass
- heart, spine, brain

### Clothing Slot Mappings (10 mappings)

- head_gear, face_gear, torso_upper
- left_arm_clothing, right_arm_clothing
- hands, legs, feet, torso_lower, back_accessory

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**: File must pass JSON schema validation
   ```bash
   npm run validate
   ```
   - Part file must be valid against `anatomy.blueprint-part.schema.json`

2. **Manual Validation**: After subsequent tickets complete the recipe:
   ```bash
   npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
   ```
   - Part must be loadable by the blueprint system

### Invariants That Must Remain True

1. **Existing Part Unchanged**: `mustelid_core.part.json` must remain identical to its current state
2. **Hairless Anatomy**: Neither `hair` nor `pubic_hair` slots should appear in amphibian_core
3. **Standard Humanoid Compatibility**: All 22 slots use definitions from the `anatomy:humanoid_slots` library
4. **Valid References**: All `$use` references must point to existing slot definitions in the humanoid_slots library

### Completion Checklist

- [x] File created at `data/mods/dredgers/parts/amphibian_core.part.json`
- [x] Schema reference present and correct
- [x] ID is `dredgers:amphibian_core`
- [x] Library is `anatomy:humanoid_slots`
- [x] All 22 slots defined (no hair/pubic_hair)
- [x] All 10 clothing slot mappings defined
- [x] `npm run validate` passes
- [x] No changes to any other files

## Outcome

- Implemented hairless amphibian core part with 22 slots (hair and pubic_hair omitted) and standard clothing mappings.
- Validated via `npm run validate`; no other files modified.
