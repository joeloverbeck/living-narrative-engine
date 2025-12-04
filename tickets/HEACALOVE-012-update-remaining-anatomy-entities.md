# HEACALOVE-012: Update remaining anatomy entities with default weights

## Overview
Add `health_calculation_weight` to all anatomy entities not covered by previous tickets (HEACALOVE-005 through HEACALOVE-011).

## Identification Process
1. List all anatomy entity files
2. Exclude files already covered by tickets 005-011
3. Assign appropriate weights based on part type and function

## Remaining Entity Categories

### Tails (weight: 1)
```bash
ls data/mods/anatomy/entities/definitions/*tail*.entity.json
```

Expected files:
- `cat_tail.entity.json`
- `horse_tail.entity.json`
- `dragon_tail.entity.json`
- `chicken_tail.entity.json`
- `chicken_tail_large_long.entity.json`
- `tortoise_tail.entity.json`

### Wings (weight: 2)
```bash
ls data/mods/anatomy/entities/definitions/*wing*.entity.json
```

Expected files:
- `dragon_wing.entity.json`
- `chicken_wing.entity.json`
- `chicken_wing_buff.entity.json`
- `chicken_wing_copper_metallic.entity.json`
- `chicken_wing_glossy_black_iridescent.entity.json`
- `chicken_wing_slate_blue.entity.json`
- `chicken_wing_speckled.entity.json`
- `eldritch_membrane_wing.entity.json`

### Beaks (weight: 1)
```bash
ls data/mods/anatomy/entities/definitions/*beak*.entity.json
```

Expected files:
- `beak.entity.json`
- `chicken_beak.entity.json`
- `tortoise_beak.entity.json`

### Cephalopod Parts (weight: varies)
```bash
ls data/mods/anatomy/entities/definitions/*tentacle*.entity.json
ls data/mods/anatomy/entities/definitions/*mantle*.entity.json
```

Expected files:
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
```bash
ls data/mods/anatomy/entities/definitions/spider*.entity.json
```

Expected files:
- `spider_abdomen.entity.json` (weight: 6)
- `spider_cephalothorax.entity.json` (weight: 8)
- `spider_leg.entity.json` (weight: 1)
- `spider_pedipalp.entity.json` (weight: 1)
- `spider_spinneret.entity.json` (weight: 1)

### Chicken-Specific Parts (weight: varies)
```bash
ls data/mods/anatomy/entities/definitions/chicken*.entity.json
```

Additional chicken files not covered elsewhere:
- `chicken_brain.entity.json` (vital organ - see HEACALOVE-005 pattern, weight: 15)
- `chicken_heart.entity.json` (vital organ - see HEACALOVE-005 pattern, weight: 15)
- `chicken_spine.entity.json` (vital organ - see HEACALOVE-005 pattern, weight: 15)
- `chicken_comb.entity.json` (weight: 0.1)
- `chicken_comb_bantam.entity.json` (weight: 0.1)
- `chicken_comb_large_coarse.entity.json` (weight: 0.1)
- `chicken_wattle.entity.json` (weight: 0.1)
- `chicken_wattle_bantam.entity.json` (weight: 0.1)
- `chicken_wattle_large.entity.json` (weight: 0.1)
- `chicken_spur.entity.json` (weight: 0.5)

### Tortoise-Specific Parts (weight: varies)
- `tortoise_carapace.entity.json` (weight: 10 - like torso)
- `tortoise_plastron.entity.json` (weight: 8)

### Eldritch Parts (weight: varies)
```bash
ls data/mods/anatomy/entities/definitions/eldritch*.entity.json
```

Additional eldritch files not covered elsewhere:
- `eldritch_core_mass.entity.json` (weight: 10)
- `eldritch_sensory_stalk.entity.json` (weight: 1)
- `eldritch_speaking_orifice.entity.json` (weight: 1)
- `eldritch_vertical_maw.entity.json` (weight: 2)
- `eldritch_vestigial_arm.entity.json` (weight: 1)
- `eldritch_vocal_sac.entity.json` (weight: 1)

### Face Parts (weight: 1)
- `humanoid_face_bearded_full_trimmed.entity.json` (weight: 1)

### Asshole (weight: 0.2)
- `human_asshole.entity.json` (weight: 0.2)

### Equipment/Utility (weight: 0)
- `equipment_mount.entity.json` (weight: 0)
- `ink_reservoir.entity.json` (weight: 0.5)

## Weight Assignment Summary

| Part Type | Weight | Rationale |
|-----------|--------|-----------|
| Vital organs (chicken brain/heart/spine) | 15 | Life-critical |
| Carapace/shell | 10 | Structural protection |
| Mantles (cephalopod) | 8 | Main body mass |
| Cephalothorax | 8 | Main body segment |
| Plastron | 8 | Protective structure |
| Abdomen (spider) | 6 | Major body segment |
| Wings | 2 | Mobility/function |
| Large tentacles | 2 | Major appendages |
| Tails | 1 | Balance/communication |
| Beaks | 1 | Feeding apparatus |
| Spider legs/pedipalps | 1 | Small appendages |
| Sensory stalks | 1 | Minor sensory |
| Small tentacles | 1 | Minor appendages |
| Spurs | 0.5 | Defensive appendage |
| Ink reservoir | 0.5 | Defensive organ |
| Combs/wattles | 0.1 | Purely cosmetic |
| Asshole | 0.2 | Non-critical |
| Equipment mount | 0 | Not a body part |

## Implementation
For each entity, add the appropriate weight to `anatomy:part`:
```json
"health_calculation_weight": <weight_value>
```

## Acceptance Criteria
- [ ] All remaining anatomy entities identified
- [ ] All entities have appropriate `health_calculation_weight` added
- [ ] Chicken vital organs include cap properties (like HEACALOVE-005)
- [ ] All files pass schema validation: `npm run validate`
- [ ] No files are missed (verify with glob against completed list)

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
