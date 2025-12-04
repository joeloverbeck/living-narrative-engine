# HEACALOVE-006: Update torso entities with health calculation weights

## Status: COMPLETED

## Overview
Add `health_calculation_weight: 10` to all torso entity definitions.

## Weight Value
All torso variants get `health_calculation_weight: 10` (Tier 2: Body-Critical).

## Files to Modify
Find all torso entities:
```bash
ls data/mods/anatomy/entities/definitions/*torso*.entity.json
```

Expected files include:
- `human_male_torso.entity.json`
- `human_male_torso_hulking_hairy.entity.json`
- `human_male_torso_muscular.entity.json`
- `human_male_torso_muscular_hairy.entity.json`
- `human_male_torso_muscular_moderate.entity.json`
- `human_male_torso_thick_hairy.entity.json`
- `human_male_torso_thick_hairy_overweight.entity.json`
- `human_female_torso.entity.json`
- `human_female_torso_hourglass_soft.entity.json`
- `human_female_torso_hulking.entity.json`
- `human_female_torso_muscular_scarred.entity.json`
- `human_female_torso_slim.entity.json`
- `human_female_torso_stocky.entity.json`
- `human_futa_torso.entity.json`
- `human_futa_torso_hulking_scarred.entity.json`
- `cat_girl_torso.entity.json`
- `centaur_torso.entity.json`
- `centaur_upper_torso.entity.json`
- `dragon_torso.entity.json`
- `chicken_torso.entity.json`
- `tortoise_torso_with_shell.entity.json`

## Implementation
For each torso entity, add to the `anatomy:part` component:
```json
"health_calculation_weight": 10
```

## Example Change
Before:
```json
"anatomy:part": {
  "subType": "torso",
  "hit_probability_weight": 8
}
```

After:
```json
"anatomy:part": {
  "subType": "torso",
  "hit_probability_weight": 8,
  "health_calculation_weight": 10
}
```

## Rationale
- **Weight 10**: Torso is the body's core structure; damage significantly impacts overall health
- Second highest tier after vital organs (15)
- Reflects that torso damage impairs overall function substantially

## Acceptance Criteria
- [x] All torso entities identified via glob pattern
- [x] All torso entities have `health_calculation_weight: 10` added
- [x] All files pass schema validation: `npm run validate`
- [x] No other properties are modified

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- Use a script or bulk edit tool for efficiency
- Preserve existing formatting and property order where practical
- Double-check creature-specific torsos (dragon, chicken, etc.) are included

---

## Outcome

### What Was Actually Changed

All 21 torso entity files were updated with `health_calculation_weight: 10` in their `anatomy:part` component:

**Human Male Torsos (7 files):**
- `human_male_torso.entity.json`
- `human_male_torso_hulking_hairy.entity.json`
- `human_male_torso_muscular.entity.json`
- `human_male_torso_muscular_hairy.entity.json`
- `human_male_torso_muscular_moderate.entity.json`
- `human_male_torso_thick_hairy.entity.json`
- `human_male_torso_thick_hairy_overweight.entity.json`

**Human Female Torsos (6 files):**
- `human_female_torso.entity.json`
- `human_female_torso_hourglass_soft.entity.json`
- `human_female_torso_hulking.entity.json`
- `human_female_torso_muscular_scarred.entity.json`
- `human_female_torso_slim.entity.json`
- `human_female_torso_stocky.entity.json`

**Human Futa Torsos (2 files):**
- `human_futa_torso.entity.json`
- `human_futa_torso_hulking_scarred.entity.json`

**Non-Human Torsos (6 files):**
- `cat_girl_torso.entity.json`
- `centaur_torso.entity.json`
- `centaur_upper_torso.entity.json`
- `dragon_torso.entity.json`
- `chicken_torso.entity.json`
- `tortoise_torso_with_shell.entity.json`

### Deviation from Original Plan

None. All 21 expected torso files were found and updated exactly as specified in the ticket.

### Validation Results

- **Schema validation**: PASSED (`npm run validate` completed successfully with 0 violations across 51 mods)
- **Torso/weight tests**: PASSED (68 tests in `humanTorsoLimbWeightValidation.test.js`, `creatureWeightValidation.test.js`, `utilityEntityWeightValidation.test.js`)
- **Injury aggregation service tests**: PASSED (54 tests verifying `health_calculation_weight` is properly used)

### Tests Added/Modified

No new tests were needed. Existing test coverage adequately validates:
1. Entity schema compliance via `npm run validate`
2. Weight validation via existing integration tests in `tests/integration/mods/anatomy/`
3. Health calculation logic via `tests/unit/anatomy/services/injuryAggregationService.test.js`

### Pre-existing Issues (Unrelated to This Ticket)

The following test failures existed before this implementation and are unrelated:
- Missing `getDamageCapabilities.schema.json` (from incomplete separate ticket)
- Missing `bodyGraphService` dependency in some integration tests
- `core:weight` component schema test (due to component being moved from items to core mod)
