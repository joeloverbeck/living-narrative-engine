# HEACALOVE-008: Update limb entities with health calculation weights

## Overview
Add `health_calculation_weight: 3` to all arm and leg entity definitions.

## Weight Value
All limb variants get `health_calculation_weight: 3` (Tier 4: Mobility).

## Files to Modify

### Arm Entities
```bash
ls data/mods/anatomy/entities/definitions/*arm*.entity.json
```

Expected arm files:
- `humanoid_arm.entity.json`
- `humanoid_arm_athletic.entity.json`
- `humanoid_arm_hulking.entity.json`
- `humanoid_arm_hulking_hairy.entity.json`
- `humanoid_arm_hulking_scarred.entity.json`
- `humanoid_arm_lean.entity.json`
- `humanoid_arm_muscular.entity.json`
- `humanoid_arm_muscular_hairy.entity.json`
- `humanoid_arm_scarred.entity.json`
- `humanoid_arm_slim.entity.json`
- `humanoid_arm_soft.entity.json`
- `humanoid_arm_soft_lissom.entity.json`
- `humanoid_arm_thick_hairy.entity.json`
- `humanoid_arm_weathered_tannery_stained.entity.json`
- `tortoise_arm.entity.json`

### Leg Entities
```bash
ls data/mods/anatomy/entities/definitions/*leg*.entity.json
```

Expected leg files:
- `human_leg.entity.json`
- `human_leg_athletic.entity.json`
- `human_leg_hulking.entity.json`
- `human_leg_hulking_hairy.entity.json`
- `human_leg_long_lean.entity.json`
- `human_leg_muscular.entity.json`
- `human_leg_muscular_hairy.entity.json`
- `human_leg_shapely.entity.json`
- `human_leg_slim.entity.json`
- `human_leg_soft_lissom.entity.json`
- `human_leg_thick_hairy.entity.json`
- `centaur_leg_front.entity.json`
- `centaur_leg_rear.entity.json`
- `dragon_leg.entity.json`
- `chicken_leg.entity.json`
- `spider_leg.entity.json`
- `tortoise_leg.entity.json`

## Implementation
For each arm and leg entity, add to the `anatomy:part` component:
```json
"health_calculation_weight": 3
```

## Example Change
Before:
```json
"anatomy:part": {
  "subType": "arm",
  "orientation": "left",
  "hit_probability_weight": 5
}
```

After:
```json
"anatomy:part": {
  "subType": "arm",
  "orientation": "left",
  "hit_probability_weight": 5,
  "health_calculation_weight": 3
}
```

## Rationale
- **Weight 3**: Limbs are important for mobility and function but not life-critical
- Moderate weight reflects that losing a limb is serious but survivable
- Lower than head (8) and torso (10)

## Acceptance Criteria
- [ ] All arm entities identified and updated
- [ ] All leg entities identified and updated
- [ ] All files have `health_calculation_weight: 3` added
- [ ] All files pass schema validation: `npm run validate`
- [ ] No other properties are modified

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- Includes creature limbs (centaur, dragon, chicken, spider, tortoise)
- Excludes vestigial limbs which may be handled in HEACALOVE-012
- Hands and feet are handled separately in HEACALOVE-009
