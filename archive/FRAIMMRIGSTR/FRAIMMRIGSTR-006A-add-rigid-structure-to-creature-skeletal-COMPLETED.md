# FRAIMMRIGSTR-006A: Add Rigid Structure Component to Creature Skeletal Entities

## Status
Completed

## Summary
Add the `anatomy:has_rigid_structure` component to creature entity definitions that have bone-based skeletal structure (legs, arms, hands, feet, heads, spines, teeth, beaks).

## Background
Creature body parts that contain bones (like folk humanoids, birds, dragons) should be able to fracture. This ticket covers bony skeletal parts with `structureType: "bone"`.

## File List

### Files to Modify (~60 files - all with `structureType: "bone"`)

#### Beak Entities
- `data/mods/anatomy-creatures/entities/definitions/beak.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_beak.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_beak.entity.json`

#### Leg Entities
- `data/mods/anatomy-creatures/entities/definitions/chicken_leg.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/centaur_leg_front.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/centaur_leg_rear.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/dragon_leg.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/newt_folk_leg.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_folk_leg.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_leg.entity.json`

#### Arm Entities
- `data/mods/anatomy-creatures/entities/definitions/eldritch_vestigial_arm.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/newt_folk_arm.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_folk_arm.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_arm.entity.json`

#### Hand Entities
- `data/mods/anatomy-creatures/entities/definitions/badger_hand_demolition_scarred.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/eldritch_malformed_hand.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/newt_folk_hand_webbed.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_folk_hand_webbed.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_hand.entity.json`

#### Foot Entities
- `data/mods/anatomy-creatures/entities/definitions/chicken_foot.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/newt_folk_foot_webbed.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_folk_foot_webbed.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_foot.entity.json`

#### Torso Entities
- `data/mods/anatomy-creatures/entities/definitions/badger_folk_male_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/beaver_folk_male_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/cat_girl_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/cat_girl_torso_working_strength.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/centaur_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/centaur_upper_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/dragon_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/ermine_folk_female_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/hyena_folk_female_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/newt_folk_male_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_folk_male_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_torso_with_shell.entity.json`

#### Head Entities
- `data/mods/anatomy-creatures/entities/definitions/centaur_head.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_head.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_head_chalky_white.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_head_rust_red.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_head_twisted_joints.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/dragon_head.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/hyena_folk_head.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/newt_folk_head.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_folk_head.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_head.entity.json`

#### Spine Entities
- `data/mods/anatomy-creatures/entities/definitions/chicken_spine.entity.json`

#### Teeth Entities
- `data/mods/anatomy-creatures/entities/definitions/beaver_folk_teeth.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/cat_folk_teeth.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/hyena_teeth.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/newt_teeth.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_teeth.entity.json`

#### Wing Entities
- `data/mods/anatomy-creatures/entities/definitions/chicken_wing.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_wing_buff.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_wing_copper_metallic.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_wing_glossy_black_iridescent.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_wing_slate_blue.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_wing_speckled.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/dragon_wing.entity.json`

#### Muzzle Entities
- `data/mods/anatomy-creatures/entities/definitions/hyena_muzzle.entity.json`

## Out of Scope

### DO NOT Modify - Soft Tissue (No rigid structure)
- `*_penis.entity.json` (newt_folk_penis, toad_folk_penis, etc.)
- `*_testicle.entity.json` (toad_folk_testicle, etc.)
- `*_ass_cheek.entity.json` (newt_folk_ass_cheek, toad_folk_ass_cheek, etc.)
- `*_breast.entity.json` (any breast entities)
- `*_eye.entity.json` (all eye variants)
- `*_ear.entity.json` (all ear variants - cartilage only, too soft)
- `*_tail.entity.json` (most tails are soft tissue)
- `*_tentacle.entity.json` (all tentacles are soft tissue)
- `*_lung.entity.json` (internal organs)
- `*_mantle.entity.json` (soft body mass)
- `*_nostril.entity.json` (soft tissue)
- `*_heart.entity.json` (internal organs)
- `*_comb.entity.json` (chicken comb is soft tissue)
- `data/mods/anatomy-creatures/entities/definitions/kraken_head.entity.json` (cephalopod soft tissue)
- `data/mods/anatomy-creatures/entities/definitions/eldritch_membrane_wing.entity.json` (membrane, no bones)

### DO NOT Modify - Different Ticket
- Spider/arthropod parts (FRAIMMRIGSTR-006B - chitin)
- Shell/carapace parts (FRAIMMRIGSTR-006B - shell)

### DO NOT Modify - Other
- Human entities (FRAIMMRIGSTR-004, FRAIMMRIGSTR-005)
- Source code in `src/`
- Test code (no changes expected for this ticket)

## Implementation Details

For each skeletal entity file, add to the `components` object:
```json
"anatomy:has_rigid_structure": {
  "structureType": "bone"
}
```

### Special Cases - Verify Structure Type
- **Muzzles** (`hyena_muzzle.entity.json`): Contains bone - use `"bone"`
- **Wings** (chicken, dragon): Contain bone - use `"bone"`
- **Beaks**: Contain bone core - use `"bone"`
 - **Centaur rear leg**: Bony rear leg/hoof - include with `"bone"`

## Acceptance Criteria

### Tests That Must Pass
```bash
npm run validate
npm run test:unit
```
- Schema validation passes for all modified files
- All unit tests continue to pass
- No validation errors in mod loading

### Invariants That Must Remain True
- All existing components in each file remain unchanged
- Only the new `anatomy:has_rigid_structure` component is added
- All files use `"structureType": "bone"`
- JSON formatting remains consistent (2-space indentation)
- No soft tissue parts are modified

## Estimated Diff Size
~60 files, ~4 lines added per file = ~240 lines total

## Dependencies
- FRAIMMRIGSTR-001 (component schema must exist)

## Blocked By
- None (component schema already exists)

## Blocks
- FRAIMMRIGSTR-008 (E2E tests need entity data)

## Outcome
- Added `anatomy:has_rigid_structure` with `"structureType": "bone"` to the listed creature skeletal entity definitions.
- Kept scope limited to bone-based parts; left soft tissue, exoskeletal/chitin, and shell entities untouched.
