# FRAIMMRIGSTR-005: Add Rigid Structure Component to Human Core Entities (COMPLETED)

## Summary
Add the `anatomy:has_rigid_structure` component to all human core skeletal entity definitions (torsos, heads, spine, teeth, nose).

## Background
Human core body parts contain bones that can fracture. Each entity definition file needs the new component added to enable the fracture immunity system to correctly allow fractures on these parts.

## File List

### Files to Modify (32 files)

#### Torso Entities (15 files)
- `data/mods/anatomy/entities/definitions/human_female_torso.entity.json`
- `data/mods/anatomy/entities/definitions/human_female_torso_hourglass_soft.entity.json`
- `data/mods/anatomy/entities/definitions/human_female_torso_hulking.entity.json`
- `data/mods/anatomy/entities/definitions/human_female_torso_muscular_scarred.entity.json`
- `data/mods/anatomy/entities/definitions/human_female_torso_slim.entity.json`
- `data/mods/anatomy/entities/definitions/human_female_torso_stocky.entity.json`
- `data/mods/anatomy/entities/definitions/human_futa_torso.entity.json`
- `data/mods/anatomy/entities/definitions/human_futa_torso_hulking_scarred.entity.json`
- `data/mods/anatomy/entities/definitions/human_male_torso.entity.json`
- `data/mods/anatomy/entities/definitions/human_male_torso_hulking_hairy.entity.json`
- `data/mods/anatomy/entities/definitions/human_male_torso_muscular.entity.json`
- `data/mods/anatomy/entities/definitions/human_male_torso_muscular_hairy.entity.json`
- `data/mods/anatomy/entities/definitions/human_male_torso_muscular_moderate.entity.json`
- `data/mods/anatomy/entities/definitions/human_male_torso_thick_hairy.entity.json`
- `data/mods/anatomy/entities/definitions/human_male_torso_thick_hairy_overweight.entity.json`

#### Head Entities (11 files)
- `data/mods/anatomy/entities/definitions/humanoid_head.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_attractive.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_bearded.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_beautiful.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_cute.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_hideous.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_moustached.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_plain.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_plain_weary.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_scarred.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_stubble.entity.json`

#### Spine Entity (1 file)
- `data/mods/anatomy/entities/definitions/human_spine.entity.json`

#### Teeth Entity (1 file)
- `data/mods/anatomy/entities/definitions/humanoid_teeth.entity.json`

#### Nose Entities (4 files) - **Note: structureType should be "cartilage"**
- `data/mods/anatomy/entities/definitions/humanoid_nose.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_nose_medium.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_nose_scarred.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_nose_small.entity.json`

## Out of Scope
- **DO NOT** modify limb entities (FRAIMMRIGSTR-004)
- **DO NOT** modify creature entities (FRAIMMRIGSTR-006A)
- **DO NOT** modify soft tissue entities (breast, ass_cheek, etc.) - they should NOT have this component
- **DO NOT** modify source code in `src/`
- **Avoid** modifying tests unless validation or behavior changes require coverage updates

## Implementation Details

### For Most Entities (torso, head, spine, teeth)
Add to the `components` object:
```json
"anatomy:has_rigid_structure": {
  "structureType": "bone"
}
```

### For Nose Entities ONLY
Add to the `components` object:
```json
"anatomy:has_rigid_structure": {
  "structureType": "cartilage"
}
```

**Rationale:** The human nose contains cartilage, not bone, as its primary structural element. This affects narrative descriptions ("the cartilage cracks" vs "the bone fractures").

## Acceptance Criteria

### Tests That Must Pass
```bash
npm run validate
npm run test:unit -- --runInBand
```
- Schema validation passes for all modified files
- All unit tests continue to pass
- No validation errors in mod loading

### Invariants That Must Remain True
- All existing components in each file remain unchanged
- Only the new `anatomy:has_rigid_structure` component is added
- Nose entities use `"structureType": "cartilage"`, all others use `"structureType": "bone"`
- JSON formatting remains consistent (2-space indentation)
- No other properties are modified

## Estimated Diff Size
~33 files, ~4 lines added per file = ~132 lines total

## Dependencies
- FRAIMMRIGSTR-001 (component schema already exists)

## Blocked By
- None (FRAIMMRIGSTR-001 completed)

## Blocks
- FRAIMMRIGSTR-008 (E2E tests need entity data)

## Outcome
- Added `anatomy:has_rigid_structure` to the listed human core torso/head/spine/teeth/nose entities with bone or cartilage types.
- Scope and test guidance updated to match current repo state (component exists; FRAIMMRIGSTR-001 complete; run unit tests with `--runInBand`).
