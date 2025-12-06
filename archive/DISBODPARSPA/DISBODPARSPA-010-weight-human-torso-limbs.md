# DISBODPARSPA-010: Add `items:weight` to Human Torso/Limb Entity Definitions

**Status: ✅ COMPLETED**

---

## Summary

Add realistic `items:weight` component to human torso and limb body part entity definitions. These are the major structural body parts that represent significant mass when severed.

---

## Files to Touch

### Human Torso Definitions (15 files)

| File                                                  | Weight (kg) | Rationale                    |
| ----------------------------------------------------- | ----------- | ---------------------------- |
| `human_female_torso.entity.json`                      | 28.0        | Average female torso (toned) |
| `human_female_torso_hourglass_soft.entity.json`       | 26.0        | Slimmer, softer build        |
| `human_female_torso_hulking.entity.json`              | 34.0        | Large muscular build         |
| `human_female_torso_muscular_scarred.entity.json`     | 30.0        | Muscular build               |
| `human_female_torso_slim.entity.json`                 | 24.0        | Slim build                   |
| `human_female_torso_stocky.entity.json`               | 32.0        | Stocky build                 |
| `human_futa_torso.entity.json`                        | 30.0        | Average futa torso           |
| `human_futa_torso_hulking_scarred.entity.json`        | 35.0        | Large muscular build         |
| `human_male_torso.entity.json`                        | 32.0        | Average male torso           |
| `human_male_torso_hulking_hairy.entity.json`          | 42.0        | Very large build             |
| `human_male_torso_muscular.entity.json`               | 36.0        | Muscular male                |
| `human_male_torso_muscular_hairy.entity.json`         | 36.0        | Muscular male                |
| `human_male_torso_muscular_moderate.entity.json`      | 34.0        | Moderately muscular          |
| `human_male_torso_thick_hairy.entity.json`            | 38.0        | Thick build                  |
| `human_male_torso_thick_hairy_overweight.entity.json` | 45.0        | Overweight                   |

### Human Leg Definitions (11 files)

| File                                   | Weight (kg) | Rationale           |
| -------------------------------------- | ----------- | ------------------- |
| `human_leg.entity.json`                | 12.0        | Average leg         |
| `human_leg_athletic.entity.json`       | 13.0        | Athletic build      |
| `human_leg_hulking.entity.json`        | 16.0        | Large muscular leg  |
| `human_leg_hulking_hairy.entity.json`  | 16.0        | Large muscular leg  |
| `human_leg_long_lean.entity.json`      | 11.0        | Longer but leaner   |
| `human_leg_muscular.entity.json`       | 14.0        | Muscular leg        |
| `human_leg_muscular_hairy.entity.json` | 14.0        | Muscular leg        |
| `human_leg_shapely.entity.json`        | 12.0        | Average shapely leg |
| `human_leg_slim.entity.json`           | 10.0        | Slim leg            |
| `human_leg_soft_lissom.entity.json`    | 11.0        | Soft/graceful leg   |
| `human_leg_thick_hairy.entity.json`    | 15.0        | Thick leg           |

### Human Extremity Definitions (2 files)

| File                     | Weight (kg) | Rationale |
| ------------------------ | ----------- | --------- |
| `human_foot.entity.json` | 1.2         | Foot only |
| `human_hand.entity.json` | 0.45        | Hand only |

**Total: 28 files**

---

## Assumption Corrections

The original ticket listed files that do not exist in the codebase:

- ~~`human_arm.entity.json`~~ - No arm entity definitions exist
- ~~`human_finger.entity.json`~~ - No finger entity definitions exist
- ~~`human_thumb.entity.json`~~ - No thumb entity definitions exist
- ~~`human_toe.entity.json`~~ - No toe entity definitions exist
- ~~`human_male_torso_average.entity.json`~~ - Doesn't exist (use `human_male_torso.entity.json`)
- ~~`human_male_torso_overweight.entity.json`~~ - Doesn't exist (use `human_male_torso_thick_hairy_overweight.entity.json`)

Additional files discovered that were not in original ticket:

- Multiple leg variants (athletic, hulking, shapely, soft_lissom, etc.)
- Additional torso variants (hulking, slim, thick_hairy, muscular_hairy, etc.)

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- Human head/face parts (DISBODPARSPA-011)
- Human hair/extremity parts (DISBODPARSPA-012)
- Non-human entity definitions
- Schema changes to `anatomy:part` component
- Any source code files
- Arms, fingers, thumbs, toes (entities don't exist yet)

---

## Implementation Details

### Change Pattern

For each file, add the `items:weight` component to the `components` object:

**Before:**

```json
{
  "id": "anatomy:human_foot",
  "components": {
    "anatomy:part": { "subType": "foot", "hit_probability_weight": 3 },
    "anatomy:part_health": {
      "currentHealth": 15,
      "maxHealth": 15,
      "state": "healthy"
    },
    "core:name": { "text": "foot" }
  }
}
```

**After:**

```json
{
  "id": "anatomy:human_foot",
  "components": {
    "anatomy:part": { "subType": "foot", "hit_probability_weight": 3 },
    "anatomy:part_health": {
      "currentHealth": 15,
      "maxHealth": 15,
      "state": "healthy"
    },
    "core:name": { "text": "foot" },
    "items:weight": { "weight": 1.2 }
  }
}
```

### Weight Reference

| Body Part Type | Weight Range (kg) | Notes               |
| -------------- | ----------------- | ------------------- |
| Torso (female) | 24-34             | Varies by build     |
| Torso (male)   | 32-45             | Varies by build     |
| Torso (futa)   | 30-35             | Varies by build     |
| Full Leg       | 10-16             | Varies by build     |
| Hand           | 0.4-0.5           | Wrist to fingertips |
| Foot           | 1.0-1.3           | Ankle to toes       |

---

## Acceptance Criteria

### Tests That Must Pass

1. ✅ `npm run validate` passes for all modified files
2. ✅ All modified files contain valid JSON
3. ✅ All `items:weight.weight` values are > 0

### Validation Commands

```bash
# Validate all modified files
npm run validate

# Check a specific file
cat data/mods/anatomy/entities/definitions/human_foot.entity.json | jq '.components["items:weight"]'

# Bulk verify weight presence
for f in data/mods/anatomy/entities/definitions/human_{torso,leg,foot,hand}*.json data/mods/anatomy/entities/definitions/human_{female,male,futa}_torso*.json; do
  echo -n "$f: "
  jq -r '.components["items:weight"].weight // "MISSING"' "$f"
done
```

### Invariants That Must Remain True

1. **Existing Components Unchanged**: Do not modify any existing component data
2. **Weight Realism**: All weights must be plausible for the body part type
3. **JSON Validity**: All files must remain valid JSON
4. **Schema Compliance**: All files must pass `npm run validate`
5. **No Accidental Removals**: No components should be removed

---

## Dependencies

- None - this ticket can be worked independently

## Blocks

- DISBODPARSPA-033 (Validation tests check weight completeness)

---

## Outcome

**Completion Date:** 2025-12-04

### What Was Originally Planned

Add `items:weight` to 17 human torso/limb entity files (including files that don't exist: arm, finger, thumb, toe).

### What Was Actually Changed

**Ticket Corrections:**

- Removed 6 non-existent files from scope (human_arm, human_finger, human_thumb, human_toe, human_male_torso_average, human_male_torso_overweight)
- Added 17 files that actually exist but weren't in original ticket (leg variants, additional torso variants)

**Files Modified (28 total):**

- 15 torso entity definitions (female, male, futa variants)
- 11 leg entity definitions (all build variants)
- 2 extremity definitions (foot, hand)

**Test Added:**

- `tests/integration/mods/anatomy/humanTorsoLimbWeightValidation.test.js` (59 tests)
  - Validates weight presence in all 28 files
  - Validates weight ranges are realistic for body part types
  - Validates `items:weight` component structure compliance

### Validation Results

- `npm run validate`: ✅ PASSED (0 violations)
- New test suite: ✅ PASSED (59/59 tests)
