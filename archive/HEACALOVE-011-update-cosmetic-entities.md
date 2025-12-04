# HEACALOVE-011: Update cosmetic entities with health calculation weights

**Status: COMPLETED**

## Overview
Add low `health_calculation_weight` values to cosmetic/aesthetic body parts that have minimal impact on overall health.

## Weight Values (Tier 7: Cosmetic)
- Hair: `health_calculation_weight: 0.1`
- Ass cheeks: `health_calculation_weight: 0.2`
- Breasts: `health_calculation_weight: 0.3`
- Pubic hair: `health_calculation_weight: 0.1`
- Genitals (penis, vagina, testicles): `health_calculation_weight: 0.5`

## Files Modified

### Hair Entities (17 files, weight: 0.1)
- `human_hair.entity.json`
- `human_hair_black_long_tousled.entity.json`
- `human_hair_blonde.entity.json`
- `human_hair_blonde_buzzed.entity.json`
- `human_hair_blonde_long_braided.entity.json`
- `human_hair_blonde_long_straight.entity.json`
- `human_hair_blonde_medium_ponytail.entity.json`
- `human_hair_blonde_medium_straight.entity.json`
- `human_hair_brown_short_ponytail.entity.json`
- `human_hair_medium_brown_ponytail.entity.json`
- `human_hair_raven.entity.json`
- `human_hair_raven_medium_straight.entity.json`
- `human_hair_red_ponytails.entity.json`
- `human_hair_red_tousled.entity.json`
- `human_hair_short_brown_wavy.entity.json`
- `human_hair_short_dirty_blonde_wavy.entity.json`
- `human_hair_short_gray_wavy.entity.json`

### Pubic Hair Entity (1 file, weight: 0.1)
- `human_pubic_hair.entity.json`

### Ass Cheek Entities (10 files, weight: 0.2)
- `human_ass_cheek.entity.json`
- `human_ass_cheek_bubbly.entity.json`
- `human_ass_cheek_firm.entity.json`
- `human_ass_cheek_firm_athletic_shelf.entity.json`
- `human_ass_cheek_firm_muscular_shelf.entity.json`
- `human_ass_cheek_firm_thick.entity.json`
- `human_ass_cheek_round.entity.json`
- `human_ass_cheek_round_soft.entity.json`
- `human_ass_cheek_small_bubbly.entity.json`
- `human_ass_cheek_small_round.entity.json`

### Breast Entities (7 files, weight: 0.3)
- `human_breast.entity.json`
- `human_breast_a_cup.entity.json`
- `human_breast_c_cup_firm.entity.json`
- `human_breast_c_cup_soft.entity.json`
- `human_breast_d_cup.entity.json`
- `human_breast_g_cup.entity.json`
- `human_breast_shelf.entity.json`

### Genital Entities (13 files, weight: 0.5)
- `human_penis.entity.json`
- `human_penis_small.entity.json`
- `human_penis_thick_huge.entity.json`
- `human_penis_thick_large.entity.json`
- `human_vagina.entity.json`
- `human_vagina_deep_ridged.entity.json`
- `human_vagina_large_soft.entity.json`
- `human_vagina_petite_firm.entity.json`
- `human_vagina_silky_tight.entity.json`
- `human_vagina_soft_pliant.entity.json`
- `human_vagina_tight_smooth.entity.json`
- `human_testicle.entity.json`
- `human_testicle_thick.entity.json`

**Total: 48 entity files modified**

## Implementation

### Hair and Pubic Hair (weight: 0.1)
```json
"health_calculation_weight": 0.1
```

### Ass Cheeks (weight: 0.2)
```json
"health_calculation_weight": 0.2
```

### Breasts (weight: 0.3)
```json
"health_calculation_weight": 0.3
```

### Genitals (weight: 0.5)
```json
"health_calculation_weight": 0.5
```

## Rationale
- **Hair (0.1)**: Purely cosmetic, no health impact
- **Ass cheeks (0.2)**: Cosmetic/padding, minimal health impact
- **Breasts (0.3)**: Tissue mass but not critical function
- **Genitals (0.5)**: Important organs but not life-critical

These low weights prevent cosmetic damage from disproportionately affecting overall health while still contributing to the calculation.

## Acceptance Criteria
- [x] All hair entities have `health_calculation_weight: 0.1`
- [x] Pubic hair entity has `health_calculation_weight: 0.1`
- [x] All ass cheek entities have `health_calculation_weight: 0.2`
- [x] All breast entities have `health_calculation_weight: 0.3`
- [x] All genital entities have `health_calculation_weight: 0.5`
- [x] All files pass schema validation: `npm run validate`

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property (completed)

## Notes
- These parts have high `hit_probability_weight` but low `health_calculation_weight`
- This creates realistic scenarios where hitting these parts doesn't drastically reduce health
- The original bug scenario had ass_cheek damage disproportionately affecting health

---

## Outcome

### What was actually changed vs originally planned

**Changes aligned with plan:**
- All 48 cosmetic entity files were updated with the correct `health_calculation_weight` values
- Weight values exactly as specified: hair/pubic_hair=0.1, ass_cheek=0.2, breast=0.3, genitals=0.5
- All files pass schema validation

**Ticket corrections made:**
- The original ticket's bash command `ls *hair*.entity.json` was misleading as it also matches non-hair entities with "hairy" in their names (e.g., `human_leg_hulking_hairy.entity.json`). The actual hair entity list in the ticket was correct; only the bash example was misleading.
- No code changes or API modifications required beyond adding the `health_calculation_weight` property to entity JSON files

**Tests added:**
- Created `tests/integration/mods/anatomy/cosmeticHealthCalculationWeightValidation.test.js`
- 106 test cases covering:
  - Per-entity validation of health_calculation_weight values
  - Count verification for each category (17 hair, 1 pubic hair, 10 ass cheek, 7 breast, 13 genital)
  - anatomy:part component structure validation
  - Tier weight rationale verification (all cosmetic weights < 1.0)

**Implementation date:** 2025-12-04
