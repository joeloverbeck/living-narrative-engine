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

Arm files to update (15 total):

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

**Excluded** (per Notes section - vestigial limbs handled in HEACALOVE-012):

- `eldritch_vestigial_arm.entity.json`

### Leg Entities

```bash
ls data/mods/anatomy/entities/definitions/*leg*.entity.json
```

Leg files to update (17 total):

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

## Status

**COMPLETED** - 2025-12-04

## Acceptance Criteria

- [x] All arm entities identified and updated
- [x] All leg entities identified and updated
- [x] All files have `health_calculation_weight: 3` added
- [x] All files pass schema validation: `npm run validate`
- [x] No other properties are modified

## Dependencies

- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes

- Includes creature limbs (centaur, dragon, chicken, spider, tortoise)
- Excludes vestigial limbs which may be handled in HEACALOVE-012
- Hands and feet are handled separately in HEACALOVE-009

## Outcome

### Changes Made vs. Originally Planned

The implementation matched the original plan with one clarification:

1. **Ticket Correction**: Added explicit exclusion of `eldritch_vestigial_arm.entity.json` which existed in the codebase but was not listed in the original ticket. The ticket already mentioned vestigial limbs should be excluded (handled in HEACALOVE-012), so this was a documentation clarification, not a scope change.

2. **Files Modified** (32 total):
   - 15 arm entity files - added `"health_calculation_weight": 3`
   - 17 leg entity files - added `"health_calculation_weight": 3`

3. **Files NOT Modified**:
   - `eldritch_vestigial_arm.entity.json` - excluded per vestigial limb handling in HEACALOVE-012

### Tests Added

- **New Test File**: `tests/integration/mods/anatomy/limbHealthCalculationWeightValidation.test.js`
  - 67 test cases covering:
    - All 15 arm entities have `health_calculation_weight: 3`
    - All 17 leg entities have `health_calculation_weight: 3`
    - Entity count verification
    - Vestigial limb exclusion verification
    - anatomy:part component structure validation

### Validation Results

- `npm run validate`: ✅ Passed
- `limbHealthCalculationWeightValidation.test.js`: ✅ 67/67 tests passed
- `headHealthCalculationWeightValidation.test.js`: ✅ 39/39 tests passed (regression check)
