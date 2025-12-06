# DISBODPARSPA-015: Add `items:weight` to Utility/Generic Entity Definitions

## Status: COMPLETED

## Outcome

### What Was Originally Planned

The original ticket assumed the existence of generic files like:

- `generic_limb.entity.json`
- `generic_organ.entity.json`
- `generic_appendage.entity.json`

These files did not exist. The ticket's discovery command was correct, but the expected files were hypothetical.

### What Was Actually Changed

**Ticket Corrections:**
The ticket was updated to reflect the actual file inventory discovered:

1. **Humanoid Base Parts (36 files)**: `humanoid_arm*.entity.json`, `humanoid_head*.entity.json`, `humanoid_hand*.entity.json`, `humanoid_face*.entity.json`, `humanoid_ear.entity.json`, `humanoid_mouth.entity.json`, `humanoid_nose*.entity.json`, `humanoid_teeth.entity.json`

2. **Cephalopod Parts (9 files)**: `beak.entity.json`, `ink_reservoir.entity.json`, `kraken_*.entity.json`, `octopus_*.entity.json`, `squid_*.entity.json`

3. **Spider Parts (5 files)**: `spider_abdomen.entity.json`, `spider_cephalothorax.entity.json`, `spider_leg.entity.json`, `spider_pedipalp.entity.json`, `spider_spinneret.entity.json`

4. **Tortoise Parts (11 files)**: `tortoise_*.entity.json` (11 variants)

5. **Utility Parts (1 file)**: `equipment_mount.entity.json`

6. **Excluded**: `blueprint_slot.entity.json` (correctly excluded - no `anatomy:part` component)

**Code Changes:**

- Added `items:weight` component to 62 entity definition files
- All weights are biologically realistic values based on part type

**Tests Added:**

- Created `tests/integration/mods/anatomy/utilityEntityWeightValidation.test.js` (65 tests)
- Tests validate weight presence, positive values, and realistic ranges for all utility entity types
- Includes coverage completeness test ensuring all 62 in-scope files have weight

### Validation Results

- `npm run validate`: PASSED
- Weight validation tests: 65 tests PASSED
- All 5 weight validation test suites: 268 tests PASSED

---

## Summary

Add realistic `items:weight` component to any remaining body part entity definitions that don't fit into the human, chicken, or creature categories covered by tickets 010-014. This includes humanoid base parts, additional creature types (cephalopods, spiders, tortoises), and utility parts.

---

## Files to Touch

This ticket covers any body part entity definitions not covered by tickets 010-014.

### Discovery Command

```bash
# Find all entity definitions in anatomy mod
ls data/mods/anatomy/entities/definitions/*.entity.json | wc -l

# Find files NOT matching human, chicken, or creature patterns from tickets 010-014
for f in data/mods/anatomy/entities/definitions/*.entity.json; do
  basename "$f" | grep -qvE "^(human_|chicken_|centaur_|dragon_|eldritch_|cat_|feline_|horse_)" && echo "$f"
done
```

### Actual Files (63 total, 62 requiring weight)

#### Humanoid Base Parts (36 files)

Generic humanoid body parts used as base definitions:

- `humanoid_arm*.entity.json` (17 variants)
- `humanoid_head*.entity.json` (12 variants)
- `humanoid_hand*.entity.json` (4 variants)
- `humanoid_face*.entity.json` (1 variant)
- `humanoid_ear.entity.json`
- `humanoid_mouth.entity.json`
- `humanoid_nose*.entity.json` (3 variants)
- `humanoid_teeth.entity.json`

#### Cephalopod Parts (9 files)

- `beak.entity.json` - Kraken beak (5.0 kg)
- `ink_reservoir.entity.json` - Kraken ink reservoir (2.0 kg)
- `kraken_head.entity.json`, `kraken_mantle.entity.json`, `kraken_tentacle.entity.json`
- `octopus_mantle.entity.json`, `octopus_tentacle.entity.json`
- `squid_mantle.entity.json`, `squid_tentacle.entity.json`

#### Spider Parts (5 files)

- `spider_abdomen.entity.json`
- `spider_cephalothorax.entity.json`
- `spider_leg.entity.json`
- `spider_pedipalp.entity.json`
- `spider_spinneret.entity.json`

#### Tortoise Parts (11 files)

- `tortoise_arm.entity.json`, `tortoise_hand.entity.json`
- `tortoise_leg.entity.json`, `tortoise_foot.entity.json`
- `tortoise_head.entity.json`, `tortoise_beak.entity.json`, `tortoise_eye.entity.json`
- `tortoise_torso_with_shell.entity.json`, `tortoise_carapace.entity.json`, `tortoise_plastron.entity.json`
- `tortoise_tail.entity.json`

#### Utility/Template Files (2 files)

- `equipment_mount.entity.json` - Equipment attachment point (0.5 kg, has anatomy:part)
- `blueprint_slot.entity.json` - **EXCLUDED** (no anatomy:part, not a body part)

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- Human entity definitions starting with `human_` (DISBODPARSPA-010, 011, 012)
- Chicken entity definitions starting with `chicken_` (DISBODPARSPA-013)
- Creature entity definitions - centaur*, dragon*, eldritch*, cat*, feline*, horse* (DISBODPARSPA-014)
- `blueprint_slot.entity.json` - This is a structural template without anatomy:part, not a body part
- Schema changes to `anatomy:part` component
- Any source code files
- Test files

---

## Implementation Details

### Change Pattern

For each file, add the `items:weight` component to the `components` object:

**Before:**

```json
{
  "id": "anatomy:humanoid_arm",
  "components": {
    "anatomy:part": { "subType": "arm", "hit_probability_weight": 8 },
    "anatomy:part_health": {
      "currentHealth": 25,
      "maxHealth": 25,
      "state": "healthy"
    },
    "core:name": { "text": "arm" }
  }
}
```

**After:**

```json
{
  "id": "anatomy:humanoid_arm",
  "components": {
    "anatomy:part": { "subType": "arm", "hit_probability_weight": 8 },
    "anatomy:part_health": {
      "currentHealth": 25,
      "maxHealth": 25,
      "state": "healthy"
    },
    "core:name": { "text": "arm" },
    "items:weight": { "weight": 4.0 }
  }
}
```

### Weight Guidelines

| Part Category                | Weight (kg) | Notes                  |
| ---------------------------- | ----------- | ---------------------- |
| **Humanoid Parts**           |             |                        |
| humanoid_arm (all variants)  | 4.0         | Average human arm      |
| humanoid_head (all variants) | 5.0         | Average human head     |
| humanoid_hand (all variants) | 0.4         | Average human hand     |
| humanoid_face                | 0.3         | Facial tissue only     |
| humanoid_ear                 | 0.01        | Ear cartilage          |
| humanoid_mouth               | 0.05        | Oral tissue            |
| humanoid_nose (all variants) | 0.03        | Nasal cartilage        |
| humanoid_teeth               | 0.05        | Full set teeth         |
| **Cephalopod Parts**         |             |                        |
| beak (kraken)                | 5.0         | Large chitinous beak   |
| ink_reservoir                | 2.0         | Large organ with fluid |
| kraken_head                  | 50.0        | Titanic head           |
| kraken_mantle                | 200.0       | Massive body           |
| kraken_tentacle              | 100.0       | Massive limb           |
| octopus_mantle               | 15.0        | Medium body            |
| octopus_tentacle             | 3.0         | Medium limb            |
| squid_mantle                 | 10.0        | Medium body            |
| squid_tentacle               | 2.0         | Medium limb            |
| **Spider Parts**             |             |                        |
| spider_abdomen               | 0.02        | Medium spider          |
| spider_cephalothorax         | 0.015       | Head-thorax            |
| spider_leg                   | 0.002       | Single leg             |
| spider_pedipalp              | 0.001       | Small appendage        |
| spider_spinneret             | 0.005       | Silk organ             |
| **Tortoise Parts**           |             |                        |
| tortoise_arm                 | 1.5         | Front limb             |
| tortoise_hand                | 0.3         | Front foot             |
| tortoise_leg                 | 2.0         | Rear limb              |
| tortoise_foot                | 0.4         | Rear foot              |
| tortoise_head                | 0.8         | Head                   |
| tortoise_beak                | 0.05        | Horny beak             |
| tortoise_eye                 | 0.02        | Eye                    |
| tortoise_torso_with_shell    | 15.0        | Body with shell        |
| tortoise_carapace            | 5.0         | Top shell              |
| tortoise_plastron            | 3.0         | Bottom shell           |
| tortoise_tail                | 0.2         | Short tail             |
| **Utility**                  |             |                        |
| equipment_mount              | 0.5         | Abstract mount point   |

---

## Acceptance Criteria

### Tests That Must Pass

1. ✅ `npm run validate` passes for all modified files
2. ✅ All modified files contain valid JSON
3. ✅ All `items:weight.weight` values are > 0
4. ✅ ALL entity definitions with `anatomy:part` component have `items:weight`

### Validation Commands

```bash
# Validate all modified files
npm run validate

# Count total files vs files with weight (excluding non-body-parts)
total=$(for f in data/mods/anatomy/entities/definitions/*.entity.json; do
  jq -e '.components["anatomy:part"]' "$f" >/dev/null 2>&1 && echo "$f"
done | wc -l)
with_weight=$(for f in data/mods/anatomy/entities/definitions/*.entity.json; do
  jq -e '.components["anatomy:part"]' "$f" >/dev/null 2>&1 && \
  jq -e '.components["items:weight"]' "$f" >/dev/null 2>&1 && echo "$f"
done | wc -l)
echo "Body parts total: $total, With weight: $with_weight"

# Find any body parts MISSING weight component
for f in data/mods/anatomy/entities/definitions/*.entity.json; do
  jq -e '.components["anatomy:part"]' "$f" >/dev/null 2>&1 && \
  (jq -e '.components["items:weight"]' "$f" >/dev/null 2>&1 || echo "MISSING: $f")
done
```

### Invariants That Must Remain True

1. **Existing Components Unchanged**: Do not modify any existing component data
2. **Weight Realism**: All weights should be reasonable for the part type
3. **JSON Validity**: All files must remain valid JSON
4. **Schema Compliance**: All files must pass `npm run validate`
5. **No Accidental Removals**: No components should be removed
6. **Complete Coverage**: After this ticket, 100% of body part definitions (with anatomy:part) have weight
7. **Exclusion of Non-Body-Parts**: `blueprint_slot.entity.json` is not modified (no anatomy:part)

---

## Dependencies

- None - this ticket can be worked independently
- Recommended to work AFTER tickets 010-014 to minimize discovery overlap

## Blocks

- DISBODPARSPA-033 (Validation tests check weight completeness)
