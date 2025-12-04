# HEACALOVE-011: Update cosmetic entities with health calculation weights

## Overview
Add low `health_calculation_weight` values to cosmetic/aesthetic body parts that have minimal impact on overall health.

## Weight Values (Tier 7: Cosmetic)
- Hair: `health_calculation_weight: 0.1`
- Ass cheeks: `health_calculation_weight: 0.2`
- Breasts: `health_calculation_weight: 0.3`
- Pubic hair: `health_calculation_weight: 0.1`
- Genitals (penis, vagina, testicles): `health_calculation_weight: 0.5`

## Files to Modify

### Hair Entities
```bash
ls data/mods/anatomy/entities/definitions/*hair*.entity.json
```

Expected hair files:
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
- `human_pubic_hair.entity.json`

### Ass Cheek Entities
```bash
ls data/mods/anatomy/entities/definitions/*ass_cheek*.entity.json
```

Expected ass cheek files:
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

### Breast Entities
```bash
ls data/mods/anatomy/entities/definitions/*breast*.entity.json
```

Expected breast files:
- `human_breast.entity.json`
- `human_breast_a_cup.entity.json`
- `human_breast_c_cup_firm.entity.json`
- `human_breast_c_cup_soft.entity.json`
- `human_breast_d_cup.entity.json`
- `human_breast_g_cup.entity.json`
- `human_breast_shelf.entity.json`

### Genital Entities
```bash
ls data/mods/anatomy/entities/definitions/*penis*.entity.json
ls data/mods/anatomy/entities/definitions/*vagina*.entity.json
ls data/mods/anatomy/entities/definitions/*testicle*.entity.json
```

Expected genital files:
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

## Example Change (Ass Cheek)
Before:
```json
"anatomy:part": {
  "subType": "ass_cheek",
  "orientation": "right",
  "hit_probability_weight": 4
}
```

After:
```json
"anatomy:part": {
  "subType": "ass_cheek",
  "orientation": "right",
  "hit_probability_weight": 4,
  "health_calculation_weight": 0.2
}
```

## Rationale
- **Hair (0.1)**: Purely cosmetic, no health impact
- **Ass cheeks (0.2)**: Cosmetic/padding, minimal health impact
- **Breasts (0.3)**: Tissue mass but not critical function
- **Genitals (0.5)**: Important organs but not life-critical

These low weights prevent cosmetic damage from disproportionately affecting overall health while still contributing to the calculation.

## Acceptance Criteria
- [ ] All hair entities have `health_calculation_weight: 0.1`
- [ ] Pubic hair entity has `health_calculation_weight: 0.1`
- [ ] All ass cheek entities have `health_calculation_weight: 0.2`
- [ ] All breast entities have `health_calculation_weight: 0.3`
- [ ] All genital entities have `health_calculation_weight: 0.5`
- [ ] All files pass schema validation: `npm run validate`

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- These parts have high `hit_probability_weight` but low `health_calculation_weight`
- This creates realistic scenarios where hitting these parts doesn't drastically reduce health
- The original bug scenario had ass_cheek damage disproportionately affecting health
