# HEACALOVE-012: Update remaining anatomy entities with default weights

**Status**: ✅ COMPLETED

## Overview

Add `health_calculation_weight` to all anatomy entities not covered by previous tickets (HEACALOVE-005 through HEACALOVE-011).

## Assumption Corrections (discovered during implementation)

During implementation, the following discrepancies were found and corrected:

1. **Chicken vital organs already have weights**: `chicken_brain.entity.json`, `chicken_heart.entity.json`, and `chicken_spine.entity.json` already have `health_calculation_weight: 15` from a previous ticket.

2. **Spider leg already covered**: `spider_leg.entity.json` already has `health_calculation_weight: 3` from HEACALOVE-008.

3. **blueprint_slot.entity.json excluded**: This entity has no `anatomy:part` component (it's a structural utility entity), so `health_calculation_weight` does not apply.

4. **Total entities to update**: 49 files (not all originally listed, some were already done)

## Verified Remaining Entity Categories

### Tails (weight: 1)

Files requiring update:

- `cat_tail.entity.json`
- `horse_tail.entity.json`
- `dragon_tail.entity.json`
- `chicken_tail.entity.json`
- `chicken_tail_large_long.entity.json`
- `tortoise_tail.entity.json`

### Wings (weight: 2)

Files requiring update:

- `dragon_wing.entity.json`
- `chicken_wing.entity.json`
- `chicken_wing_buff.entity.json`
- `chicken_wing_copper_metallic.entity.json`
- `chicken_wing_glossy_black_iridescent.entity.json`
- `chicken_wing_slate_blue.entity.json`
- `chicken_wing_speckled.entity.json`
- `eldritch_membrane_wing.entity.json`

### Beaks (weight: 1)

Files requiring update:

- `beak.entity.json`
- `chicken_beak.entity.json`
- `tortoise_beak.entity.json`

### Cephalopod Parts (weight: varies)

Files requiring update:

- `kraken_tentacle.entity.json` (weight: 2)
- `kraken_mantle.entity.json` (weight: 8)
- `octopus_tentacle.entity.json` (weight: 2)
- `octopus_mantle.entity.json` (weight: 8)
- `squid_tentacle.entity.json` (weight: 2)
- `squid_mantle.entity.json` (weight: 8)
- `eldritch_tentacle_feeding.entity.json` (weight: 1)
- `eldritch_tentacle_large.entity.json` (weight: 2)
- `eldritch_tentacle_sensory.entity.json` (weight: 1)

### Spider Parts (weight: varies)

Files requiring update (spider_leg already done):

- `spider_abdomen.entity.json` (weight: 6)
- `spider_cephalothorax.entity.json` (weight: 8)
- `spider_pedipalp.entity.json` (weight: 1)
- `spider_spinneret.entity.json` (weight: 1)

### Chicken-Specific Parts (weight: varies)

Files requiring update (vital organs already done):

- `chicken_comb.entity.json` (weight: 0.1)
- `chicken_comb_bantam.entity.json` (weight: 0.1)
- `chicken_comb_large_coarse.entity.json` (weight: 0.1)
- `chicken_wattle.entity.json` (weight: 0.1)
- `chicken_wattle_bantam.entity.json` (weight: 0.1)
- `chicken_wattle_large.entity.json` (weight: 0.1)
- `chicken_spur.entity.json` (weight: 0.5)

### Tortoise-Specific Parts (weight: varies)

Files requiring update:

- `tortoise_carapace.entity.json` (weight: 10)
- `tortoise_plastron.entity.json` (weight: 8)

### Eldritch Parts (weight: varies)

Files requiring update:

- `eldritch_core_mass.entity.json` (weight: 10)
- `eldritch_sensory_stalk.entity.json` (weight: 1)
- `eldritch_speaking_orifice.entity.json` (weight: 1)
- `eldritch_vertical_maw.entity.json` (weight: 2)
- `eldritch_vestigial_arm.entity.json` (weight: 1)
- `eldritch_vocal_sac.entity.json` (weight: 1)

### Face Parts (weight: 5)

Files requiring update:

- `humanoid_face_bearded_full_trimmed.entity.json` (weight: 5 - head variant, same as other heads)

### Asshole (weight: 0.2)

Files requiring update:

- `human_asshole.entity.json` (weight: 0.2)

### Equipment/Utility (weight: 0 or 0.5)

Files requiring update:

- `equipment_mount.entity.json` (weight: 0)
- `ink_reservoir.entity.json` (weight: 0.5)

## Weight Assignment Summary

| Part Type                                | Weight | Rationale             |
| ---------------------------------------- | ------ | --------------------- |
| Vital organs (chicken brain/heart/spine) | 15     | Life-critical         |
| Carapace/shell                           | 10     | Structural protection |
| Mantles (cephalopod)                     | 8      | Main body mass        |
| Cephalothorax                            | 8      | Main body segment     |
| Plastron                                 | 8      | Protective structure  |
| Abdomen (spider)                         | 6      | Major body segment    |
| Wings                                    | 2      | Mobility/function     |
| Large tentacles                          | 2      | Major appendages      |
| Tails                                    | 1      | Balance/communication |
| Beaks                                    | 1      | Feeding apparatus     |
| Spider legs/pedipalps                    | 1      | Small appendages      |
| Sensory stalks                           | 1      | Minor sensory         |
| Small tentacles                          | 1      | Minor appendages      |
| Spurs                                    | 0.5    | Defensive appendage   |
| Ink reservoir                            | 0.5    | Defensive organ       |
| Combs/wattles                            | 0.1    | Purely cosmetic       |
| Asshole                                  | 0.2    | Non-critical          |
| Equipment mount                          | 0      | Not a body part       |

## Implementation

For each entity, add the appropriate weight to `anatomy:part`:

```json
"health_calculation_weight": <weight_value>
```

## Acceptance Criteria

- [x] All remaining anatomy entities identified
- [x] All entities have appropriate `health_calculation_weight` added
- [x] Chicken vital organs already had weights (not in scope)
- [x] All files pass schema validation: `npm run validate`
- [x] No files are missed (verified with comprehensive test suite)

## Dependencies

- HEACALOVE-001: Schema must have `health_calculation_weight` property
- HEACALOVE-002: Schema must have cap properties (for chicken vital organs)

## Verification

Run at the end:

```bash
# Find any anatomy entities missing health_calculation_weight
grep -L "health_calculation_weight" data/mods/anatomy/entities/definitions/*.entity.json
```

## Notes

- This is the catch-all ticket for remaining entities
- Some entities may need to be added to HEACALOVE-005 if they're vital organs
- Equipment mount gets weight 0 as it's not a biological part

---

## Outcome

### What was actually changed vs originally planned

**Originally planned**: Add `health_calculation_weight` to ~49 "remaining" anatomy entities.

**Actual changes**:

1. **Assumption corrections identified**:
   - `chicken_brain.entity.json`, `chicken_heart.entity.json`, `chicken_spine.entity.json` already had `health_calculation_weight: 15`
   - `spider_leg.entity.json` already had `health_calculation_weight: 3` from HEACALOVE-008
   - `blueprint_slot.entity.json` has no `anatomy:part` component (utility entity)
   - `humanoid_face_bearded_full_trimmed.entity.json` uses weight 5 (head variant), not 1

2. **48 entity files updated** with appropriate `health_calculation_weight` values:
   - 3 beaks (weight: 1)
   - 6 tails (weight: 1)
   - 8 wings (weight: 2)
   - 6 cephalopod parts (tentacles: 2, mantles: 8)
   - 3 eldritch tentacles (feeding/sensory: 1, large: 2)
   - 4 spider parts (abdomen: 6, cephalothorax: 8, pedipalp/spinneret: 1)
   - 7 chicken cosmetic parts (combs/wattles: 0.1, spur: 0.5)
   - 2 tortoise shell parts (carapace: 10, plastron: 8)
   - 6 eldritch misc parts (core_mass: 10, others: 1-2)
   - 1 face variant (weight: 5)
   - 1 human_asshole (weight: 0.2)
   - 1 equipment_mount (weight: 0)
   - 1 ink_reservoir (weight: 0.5)

3. **New test file created**: `tests/integration/mods/anatomy/remainingAnatomyHealthCalculationWeightValidation.test.js`
   - 55 tests covering all 48 entities
   - Validates weight values by category
   - Total entity count verification

### Tests modified/added

| Test File                                                                                  | Type | Rationale                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/mods/anatomy/remainingAnatomyHealthCalculationWeightValidation.test.js` | New  | Comprehensive validation of all HEACALOVE-012 entities with health_calculation_weight values; ensures future changes don't break consistency |

### Validation Results

- `npm run validate`: 0 violations across 52 mods
- All existing health_calculation_weight tests: 300 passed
- New HEACALOVE-012 test suite: 55 passed
