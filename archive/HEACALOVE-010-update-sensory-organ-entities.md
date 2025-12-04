# HEACALOVE-010: Update sensory and internal organ entities with health calculation weights

**Status: COMPLETED**

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
- [x] All eye entities have `health_calculation_weight: 2`
- [x] All ear entities have `health_calculation_weight: 1`
- [x] All nose entities have `health_calculation_weight: 1`
- [x] All mouth entities have `health_calculation_weight: 1`
- [x] All teeth entities have `health_calculation_weight: 0.5`
- [x] All files pass schema validation: `npm run validate`

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- Excludes vital organs (brain, heart, spine) - handled in HEACALOVE-005
- Includes creature variants (feline eyes, cat ears, eldritch parts)
- Beaks handled in HEACALOVE-012 as they're structural rather than purely sensory

---

## Outcome

### What was actually changed vs originally planned

**Original Plan**: Add `health_calculation_weight` property to all sensory organ entities (eyes, ears, nose, mouth, teeth) according to the specified tier weights.

**Actual Implementation**: Executed exactly as planned with no deviations.

### Summary of Changes

| Category | Files Modified | Weight Applied |
|----------|---------------|----------------|
| Eyes | 19 entities | 2 |
| Ears | 3 entities | 1 |
| Noses | 3 entities | 1 |
| Mouths | 2 entities | 1 |
| Teeth | 1 entity | 0.5 |
| **Total** | **28 entities** | - |

### New Tests Created

**File**: `tests/integration/mods/anatomy/sensoryOrganHealthCalculationWeightValidation.test.js`

- **64 test cases** covering:
  - Individual weight validation for all 28 entities
  - Entity count verification (19 eyes, 3 ears, 3 noses, 2 mouths, 1 teeth)
  - Component structure validation for all sensory entities
  - Tier hierarchy verification (eyes > ears/nose/mouth > teeth)
  - Weight consistency with Tier 6 design

### Verification Results

- `npm run validate`: PASSED (0 violations across 51 mods)
- Integration tests: All 64 new tests PASSED
- Existing health calculation weight tests: All continue to PASS

### Files Modified

All 28 entity files in `data/mods/anatomy/entities/definitions/`:

**Eyes (19 files)**:
- human_eye_amber.entity.json
- human_eye_blue.entity.json
- human_eye_blue_hooded.entity.json
- human_eye_brown.entity.json
- human_eye_brown_almond.entity.json
- human_eye_cobalt.entity.json
- human_eye_gray_hooded.entity.json
- human_eye_green.entity.json
- human_eye_hazel_almond.entity.json
- human_eye_hazel_hooded.entity.json
- human_eye_pale_blue_round.entity.json
- human_eye_red_hooded.entity.json
- feline_eye_abyssal_black_glow.entity.json
- feline_eye_amber_slit.entity.json
- feline_eye_ice_blue_slit.entity.json
- tortoise_eye.entity.json
- eldritch_baleful_eye.entity.json
- eldritch_surface_eye.entity.json
- eldritch_compound_eye_stalk.entity.json

**Ears (3 files)**:
- humanoid_ear.entity.json
- cat_ear.entity.json
- cat_ear_decorated.entity.json

**Noses (3 files)**:
- humanoid_nose.entity.json
- humanoid_nose_scarred.entity.json
- humanoid_nose_small.entity.json

**Mouths (2 files)**:
- humanoid_mouth.entity.json
- eldritch_lamprey_mouth.entity.json

**Teeth (1 file)**:
- humanoid_teeth.entity.json
