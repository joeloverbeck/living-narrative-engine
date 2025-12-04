# HEACALOVE-010: Update sensory and internal organ entities with health calculation weights

## Overview
Add `health_calculation_weight` to sensory organs and internal organs (excluding vital organs handled in HEACALOVE-005).

## Weight Values
- Eyes: `health_calculation_weight: 2` (Tier 6: Sensory)
- Ears: `health_calculation_weight: 1` (Tier 6: Sensory)
- Nose: `health_calculation_weight: 1` (Tier 6: Sensory)
- Mouth: `health_calculation_weight: 1` (Tier 6: Sensory)
- Teeth: `health_calculation_weight: 0.5` (Tier 6: Sensory)

## Files to Modify

### Eye Entities
```bash
ls data/mods/anatomy/entities/definitions/*eye*.entity.json
```

Expected eye files:
- `human_eye_amber.entity.json`
- `human_eye_blue.entity.json`
- `human_eye_blue_hooded.entity.json`
- `human_eye_brown.entity.json`
- `human_eye_brown_almond.entity.json`
- `human_eye_cobalt.entity.json`
- `human_eye_gray_hooded.entity.json`
- `human_eye_green.entity.json`
- `human_eye_hazel_almond.entity.json`
- `human_eye_hazel_hooded.entity.json`
- `human_eye_pale_blue_round.entity.json`
- `human_eye_red_hooded.entity.json`
- `feline_eye_abyssal_black_glow.entity.json`
- `feline_eye_amber_slit.entity.json`
- `feline_eye_ice_blue_slit.entity.json`
- `tortoise_eye.entity.json`
- `eldritch_baleful_eye.entity.json`
- `eldritch_surface_eye.entity.json`
- `eldritch_compound_eye_stalk.entity.json`

### Ear Entities
```bash
ls data/mods/anatomy/entities/definitions/*ear*.entity.json
```

Expected ear files:
- `humanoid_ear.entity.json`
- `cat_ear.entity.json`
- `cat_ear_decorated.entity.json`

### Nose Entities
```bash
ls data/mods/anatomy/entities/definitions/*nose*.entity.json
```

Expected nose files:
- `humanoid_nose.entity.json`
- `humanoid_nose_scarred.entity.json`
- `humanoid_nose_small.entity.json`

### Mouth Entities
```bash
ls data/mods/anatomy/entities/definitions/*mouth*.entity.json
```

Expected mouth files:
- `humanoid_mouth.entity.json`
- `eldritch_lamprey_mouth.entity.json`

### Teeth Entities
```bash
ls data/mods/anatomy/entities/definitions/*teeth*.entity.json
```

Expected teeth files:
- `humanoid_teeth.entity.json`

## Implementation

### Eyes (weight: 2)
```json
"health_calculation_weight": 2
```

### Ears, Nose, Mouth (weight: 1)
```json
"health_calculation_weight": 1
```

### Teeth (weight: 0.5)
```json
"health_calculation_weight": 0.5
```

## Example Change (Eye)
Before:
```json
"anatomy:part": {
  "subType": "eye",
  "orientation": "left",
  "hit_probability_weight": 1
}
```

After:
```json
"anatomy:part": {
  "subType": "eye",
  "orientation": "left",
  "hit_probability_weight": 1,
  "health_calculation_weight": 2
}
```

## Rationale
- **Eyes (2)**: Vision loss significantly impacts quality of life and function
- **Ears/Nose/Mouth (1)**: Important sensory organs but less critical than eyes
- **Teeth (0.5)**: Loss is impactful but not life-threatening

## Acceptance Criteria
- [ ] All eye entities have `health_calculation_weight: 2`
- [ ] All ear entities have `health_calculation_weight: 1`
- [ ] All nose entities have `health_calculation_weight: 1`
- [ ] All mouth entities have `health_calculation_weight: 1`
- [ ] All teeth entities have `health_calculation_weight: 0.5`
- [ ] All files pass schema validation: `npm run validate`

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- Excludes vital organs (brain, heart, spine) - handled in HEACALOVE-005
- Includes creature variants (feline eyes, cat ears, eldritch parts)
- Beaks handled in HEACALOVE-012 as they're structural rather than purely sensory
