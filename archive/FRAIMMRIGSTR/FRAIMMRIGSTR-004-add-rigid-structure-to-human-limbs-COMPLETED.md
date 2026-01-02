# FRAIMMRIGSTR-004: Add Rigid Structure Component to Human Limb Entities

## Summary
Add the `anatomy:has_rigid_structure` component to all human limb entity definitions (legs, arms, hands, feet).

## Background
Human limbs contain bones that can fracture. Each entity definition file needs the new component added to enable the fracture immunity system to correctly allow fractures on these parts.

## Reassessment Notes
- The `anatomy:has_rigid_structure` component schema already exists in `data/mods/anatomy/components/has_rigid_structure.component.json`.
- `FractureApplicator` already checks for rigid structure in `src/anatomy/applicators/fractureApplicator.js`, and unit coverage exists in `tests/unit/anatomy/applicators/fractureApplicator.test.js`.
- This ticket remains scoped to data updates only (human limb entity definitions).

## File List

### Files to Modify (~35 files)

#### Leg Entities (12 files)
- `data/mods/anatomy/entities/definitions/human_leg.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_athletic.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_hourglass_hairless.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_hulking.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_hulking_hairy.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_long_lean.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_muscular.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_muscular_hairy.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_shapely.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_slim.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_soft_lissom.entity.json`
- `data/mods/anatomy/entities/definitions/human_leg_thick_hairy.entity.json`

#### Arm Entities (15 files)
- `data/mods/anatomy/entities/definitions/humanoid_arm.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_athletic.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_hourglass_hairless.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_hulking.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_hulking_hairy.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_hulking_scarred.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_lean.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_muscular.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_muscular_hairy.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_scarred.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_slim.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_soft.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_soft_lissom.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_thick_hairy.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_arm_weathered_tannery_stained.entity.json`

#### Hand Entities (7 files)
- `data/mods/anatomy/entities/definitions/human_hand.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_hand_craftsman_scarred.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_hand_craftsman_stained.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_hand_diver.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_hand_gardener.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_hand_rough.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_hand_scarred.entity.json`

#### Foot Entity (1 file)
- `data/mods/anatomy/entities/definitions/human_foot.entity.json`

## Out of Scope
- **DO NOT** modify torso entities (FRAIMMRIGSTR-005)
- **DO NOT** modify head entities (FRAIMMRIGSTR-005)
- **DO NOT** modify spine, teeth, nose entities (FRAIMMRIGSTR-005)
- **DO NOT** modify creature entities (FRAIMMRIGSTR-006A)
- **DO NOT** modify soft tissue entities (penis, breast, etc.) - they should NOT have this component
- **DO NOT** modify source code in `src/`
- **DO NOT** add or modify tests unless the data change reveals a coverage gap

## Implementation Details

For each entity file, add the following to the `components` object:

```json
"anatomy:has_rigid_structure": {
  "structureType": "bone"
}
```

### Example Transformation

**Before:**
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:human_leg",
  "description": "A human leg",
  "components": {
    "anatomy:part": { ... },
    "anatomy:part_health": { ... },
    "anatomy:sockets": { ... },
    "core:movement": { ... },
    "core:name": { ... },
    "core:weight": { ... }
  }
}
```

**After:**
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:human_leg",
  "description": "A human leg",
  "components": {
    "anatomy:part": { ... },
    "anatomy:part_health": { ... },
    "anatomy:sockets": { ... },
    "core:movement": { ... },
    "core:name": { ... },
    "core:weight": { ... },
    "anatomy:has_rigid_structure": {
      "structureType": "bone"
    }
  }
}
```

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
- JSON formatting remains consistent (2-space indentation)
- No other properties are modified

## Estimated Diff Size
~35 files, ~4 lines added per file = ~140 lines total

## Dependencies
- FRAIMMRIGSTR-001 is already satisfied (component schema exists)

## Blocked By
- None

## Blocks
- FRAIMMRIGSTR-007 (E2E tests need entity data)

## Outcome
- Added `anatomy:has_rigid_structure` to all human limb entity definitions listed in this ticket; no source or test changes were required.
- Updated assumptions to reflect the existing component schema and applicator behavior.

## Status
Completed
