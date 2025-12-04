# DISBODPARSPA-014: Add `items:weight` to Creature Entity Definitions

## Status: COMPLETED

**Completed:** 2025-12-04

---

## Summary

Add realistic `items:weight` component to non-human, non-chicken creature body part entity definitions. This includes centaur, dragon, eldritch, cat/feline, and horse entity definitions.

---

## Files Touched (33 files total)

### Centaur Parts (5 files)

| File | Weight (kg) | Rationale |
|------|-------------|-----------|
| `data/mods/anatomy/entities/definitions/centaur_head.entity.json` | 5.0 | Humanoid head (similar to human) |
| `data/mods/anatomy/entities/definitions/centaur_leg_front.entity.json` | 25.0 | Front horse leg |
| `data/mods/anatomy/entities/definitions/centaur_leg_rear.entity.json` | 30.0 | Rear horse leg (larger) |
| `data/mods/anatomy/entities/definitions/centaur_torso.entity.json` | 150.0 | Lower horse body/torso |
| `data/mods/anatomy/entities/definitions/centaur_upper_torso.entity.json` | 35.0 | Human-like upper torso |

### Dragon Parts (5 files)

| File | Weight (kg) | Rationale |
|------|-------------|-----------|
| `data/mods/anatomy/entities/definitions/dragon_head.entity.json` | 50.0 | Large dragon head |
| `data/mods/anatomy/entities/definitions/dragon_leg.entity.json` | 60.0 | Per dragon leg |
| `data/mods/anatomy/entities/definitions/dragon_tail.entity.json` | 100.0 | Heavy dragon tail |
| `data/mods/anatomy/entities/definitions/dragon_torso.entity.json` | 500.0 | Main massive body |
| `data/mods/anatomy/entities/definitions/dragon_wing.entity.json` | 40.0 | Per wing |

### Eldritch Parts (15 files)

| File | Weight (kg) | Rationale |
|------|-------------|-----------|
| `data/mods/anatomy/entities/definitions/eldritch_baleful_eye.entity.json` | 2.0 | Large central eye |
| `data/mods/anatomy/entities/definitions/eldritch_compound_eye_stalk.entity.json` | 1.5 | Eye stalk |
| `data/mods/anatomy/entities/definitions/eldritch_core_mass.entity.json` | 200.0 | Central pulsating mass |
| `data/mods/anatomy/entities/definitions/eldritch_lamprey_mouth.entity.json` | 3.0 | Lamprey mouth |
| `data/mods/anatomy/entities/definitions/eldritch_malformed_hand.entity.json` | 2.0 | Malformed appendage |
| `data/mods/anatomy/entities/definitions/eldritch_membrane_wing.entity.json` | 8.0 | Membrane wing |
| `data/mods/anatomy/entities/definitions/eldritch_sensory_stalk.entity.json` | 0.5 | Sensory stalk |
| `data/mods/anatomy/entities/definitions/eldritch_speaking_orifice.entity.json` | 1.0 | Speaking orifice |
| `data/mods/anatomy/entities/definitions/eldritch_surface_eye.entity.json` | 0.3 | Small surface eye |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_feeding.entity.json` | 12.0 | Feeding tentacle |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_large.entity.json` | 20.0 | Large tentacle |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_sensory.entity.json` | 5.0 | Sensory tentacle |
| `data/mods/anatomy/entities/definitions/eldritch_vertical_maw.entity.json` | 15.0 | Large vertical maw |
| `data/mods/anatomy/entities/definitions/eldritch_vestigial_arm.entity.json` | 3.0 | Vestigial arm |
| `data/mods/anatomy/entities/definitions/eldritch_vocal_sac.entity.json` | 1.0 | Vocal sac |

### Cat Parts (4 files)

| File | Weight (kg) | Rationale |
|------|-------------|-----------|
| `data/mods/anatomy/entities/definitions/cat_ear.entity.json` | 0.01 | Cat ear |
| `data/mods/anatomy/entities/definitions/cat_ear_decorated.entity.json` | 0.02 | Decorated cat ear |
| `data/mods/anatomy/entities/definitions/cat_girl_torso.entity.json` | 25.0 | Cat-girl humanoid torso |
| `data/mods/anatomy/entities/definitions/cat_tail.entity.json` | 0.15 | Cat tail |

### Feline Eye Parts (3 files)

| File | Weight (kg) | Rationale |
|------|-------------|-----------|
| `data/mods/anatomy/entities/definitions/feline_eye_abyssal_black_glow.entity.json` | 0.008 | Feline eye |
| `data/mods/anatomy/entities/definitions/feline_eye_amber_slit.entity.json` | 0.008 | Feline eye |
| `data/mods/anatomy/entities/definitions/feline_eye_ice_blue_slit.entity.json` | 0.008 | Feline eye |

### Horse Parts (1 file)

| File | Weight (kg) | Rationale |
|------|-------------|-----------|
| `data/mods/anatomy/entities/definitions/horse_tail.entity.json` | 4.0 | Horse tail |

---

## Outcome

### What Was Actually Changed vs. Originally Planned

**Originally Planned:**
- The ticket originally listed ~43 hypothetical files based on expected naming conventions
- Expected file names like `centaur_hoof.entity.json`, `dragon_body.entity.json`, `eldritch_tentacle.entity.json`, `cat_body.entity.json`, `horse_body.entity.json` etc.

**Actual Changes:**
- The codebase had 33 creature entity files with different naming conventions than expected
- Files used more specific names (e.g., `centaur_leg_front.entity.json` instead of `centaur_leg.entity.json`)
- Eldritch entities had very specific names (e.g., `eldritch_tentacle_feeding.entity.json`, `eldritch_baleful_eye.entity.json`)
- Horse only had `horse_tail.entity.json` - no full body parts
- Cat entities included `cat_girl_torso.entity.json` (hybrid humanoid) rather than pure cat parts

**Resolution:**
1. **Corrected the ticket** first with the actual file list before making changes
2. Added `items:weight` component to all 33 actual creature entity files
3. Used `jq` for bulk JSON modification to ensure correctness
4. Created comprehensive validation test file

### Tests Added

| Test File | Purpose |
|-----------|---------|
| `tests/integration/mods/anatomy/creatureWeightValidation.test.js` | Validates all 33 creature entity files have proper `items:weight` components with realistic weight ranges |

The test file includes:
- Per-creature-type validation (Centaur, Dragon, Eldritch, Cat, Feline, Horse)
- Weight range validation appropriate to each creature type
- Schema compliance verification (exactly one `weight` property)
- Total file count verification (33 files)
- 75 test cases total

### Validation Results

- `npm run validate` - PASSED (0 violations across 51 mods)
- All 75 creature weight validation tests - PASSED
- Related human weight validation tests - PASSED (211 tests)
- All JSON files valid

---

## Acceptance Criteria Met

- [x] `npm run validate` passes for all modified files
- [x] All modified files contain valid JSON
- [x] All `items:weight.weight` values are > 0
- [x] Existing components unchanged
- [x] Weights are realistic for creature types
- [x] Schema compliance verified
- [x] Comprehensive tests added

---

## Dependencies

- None - completed independently

## Blocks

- DISBODPARSPA-033 (Validation tests check weight completeness) - NOW UNBLOCKED
