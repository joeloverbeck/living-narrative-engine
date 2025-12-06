# DISBODPARSPA-012: Add `items:weight` to Human Hair Entity Definitions

## ✅ STATUS: COMPLETED

**Completed**: 2025-12-04

---

## Summary

Add realistic `items:weight` component to human hair body part entity definitions. Weight is determined by the hair length descriptor in each file.

**Note**: Original ticket assumed existence of separate eyebrow, eyelash, tooth, nail, and skin files. These do NOT exist in the codebase. This ticket is scoped to hair entity definitions only.

---

## Outcome

### Originally Planned (10 files)

- `human_hair_bald.entity.json` - NOT FOUND (doesn't exist)
- `human_hair_short.entity.json` - NOT FOUND (doesn't exist)
- `human_hair_medium.entity.json` - NOT FOUND (doesn't exist)
- `human_hair_long.entity.json` - NOT FOUND (doesn't exist)
- `human_hair_very_long.entity.json` - NOT FOUND (doesn't exist)
- `human_eyebrow.entity.json` - NOT FOUND (doesn't exist)
- `human_eyelash.entity.json` - NOT FOUND (doesn't exist)
- `human_tooth.entity.json` - NOT FOUND (doesn't exist)
- `human_nail.entity.json` - NOT FOUND (doesn't exist)
- `human_skin.entity.json` - NOT FOUND (doesn't exist)

### Actually Changed (17 files)

The codebase uses descriptive hair file names with color/style combinations:

| File                                             | Weight (kg) | Hair Length |
| ------------------------------------------------ | ----------- | ----------- |
| `human_hair.entity.json`                         | 0.1         | medium      |
| `human_hair_black_long_tousled.entity.json`      | 0.15        | long        |
| `human_hair_blonde.entity.json`                  | 0.15        | long        |
| `human_hair_blonde_buzzed.entity.json`           | 0.02        | buzzed      |
| `human_hair_blonde_long_braided.entity.json`     | 0.15        | long        |
| `human_hair_blonde_long_straight.entity.json`    | 0.15        | long        |
| `human_hair_blonde_medium_ponytail.entity.json`  | 0.1         | medium      |
| `human_hair_blonde_medium_straight.entity.json`  | 0.1         | medium      |
| `human_hair_brown_short_ponytail.entity.json`    | 0.05        | short       |
| `human_hair_medium_brown_ponytail.entity.json`   | 0.1         | medium      |
| `human_hair_raven.entity.json`                   | 0.15        | long        |
| `human_hair_raven_medium_straight.entity.json`   | 0.1         | medium      |
| `human_hair_red_ponytails.entity.json`           | 0.1         | medium      |
| `human_hair_red_tousled.entity.json`             | 0.1         | medium      |
| `human_hair_short_brown_wavy.entity.json`        | 0.05        | short       |
| `human_hair_short_dirty_blonde_wavy.entity.json` | 0.05        | short       |
| `human_hair_short_gray_wavy.entity.json`         | 0.05        | short       |

### Test Created

- `tests/integration/mods/anatomy/humanHairWeightValidation.test.js` - 42 test cases covering:
  - Long hair weight validation (5 files)
  - Medium hair weight validation (7 files)
  - Short hair weight validation (4 files)
  - Buzzed hair weight validation (1 file)
  - Schema compliance for all 17 files
  - Weight value range validation by hair length

---

## Files to Touch

| File                                                                                    | Weight (kg) | Rationale               |
| --------------------------------------------------------------------------------------- | ----------- | ----------------------- |
| `data/mods/anatomy/entities/definitions/human_hair.entity.json`                         | 0.1         | medium length (generic) |
| `data/mods/anatomy/entities/definitions/human_hair_black_long_tousled.entity.json`      | 0.15        | long hair               |
| `data/mods/anatomy/entities/definitions/human_hair_blonde.entity.json`                  | 0.15        | long hair               |
| `data/mods/anatomy/entities/definitions/human_hair_blonde_buzzed.entity.json`           | 0.02        | buzzed (very short)     |
| `data/mods/anatomy/entities/definitions/human_hair_blonde_long_braided.entity.json`     | 0.15        | long hair               |
| `data/mods/anatomy/entities/definitions/human_hair_blonde_long_straight.entity.json`    | 0.15        | long hair               |
| `data/mods/anatomy/entities/definitions/human_hair_blonde_medium_ponytail.entity.json`  | 0.1         | medium hair             |
| `data/mods/anatomy/entities/definitions/human_hair_blonde_medium_straight.entity.json`  | 0.1         | medium hair             |
| `data/mods/anatomy/entities/definitions/human_hair_brown_short_ponytail.entity.json`    | 0.05        | short hair              |
| `data/mods/anatomy/entities/definitions/human_hair_medium_brown_ponytail.entity.json`   | 0.1         | medium hair             |
| `data/mods/anatomy/entities/definitions/human_hair_raven.entity.json`                   | 0.15        | long hair               |
| `data/mods/anatomy/entities/definitions/human_hair_raven_medium_straight.entity.json`   | 0.1         | medium hair             |
| `data/mods/anatomy/entities/definitions/human_hair_red_ponytails.entity.json`           | 0.1         | medium hair             |
| `data/mods/anatomy/entities/definitions/human_hair_red_tousled.entity.json`             | 0.1         | medium hair             |
| `data/mods/anatomy/entities/definitions/human_hair_short_brown_wavy.entity.json`        | 0.05        | short hair              |
| `data/mods/anatomy/entities/definitions/human_hair_short_dirty_blonde_wavy.entity.json` | 0.05        | short hair              |
| `data/mods/anatomy/entities/definitions/human_hair_short_gray_wavy.entity.json`         | 0.05        | short hair              |

**Total**: 17 files

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- Human torso/limb parts (DISBODPARSPA-010)
- Human head/face parts (DISBODPARSPA-011)
- Non-human entity definitions
- Schema changes to `anatomy:part` component
- Any source code files
- **Extremity files** (eyebrow, eyelash, tooth, nail, skin) - these do NOT exist in the codebase

---

## Implementation Details

### Change Pattern

For each file, add the `items:weight` component to the `components` object:

**Before:**

```json
{
  "id": "anatomy:human_hair_blonde_long_braided",
  "components": {
    "anatomy:part": { "subType": "hair", "hit_probability_weight": 0.25 },
    "core:name": { "text": "hair" }
  }
}
```

**After:**

```json
{
  "id": "anatomy:human_hair_blonde_long_braided",
  "components": {
    "anatomy:part": { "subType": "hair", "hit_probability_weight": 0.25 },
    "core:name": { "text": "hair" },
    "items:weight": { "weight": 0.15 }
  }
}
```

### Weight Reference by Hair Length

| Hair Length | Weight (kg) | Notes              |
| ----------- | ----------- | ------------------ |
| buzzed      | 0.02        | Very short/minimal |
| short       | 0.05        | Short styles       |
| medium      | 0.1         | Shoulder length    |
| long        | 0.15        | Back length        |

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
cat data/mods/anatomy/entities/definitions/human_hair_blonde_long_braided.entity.json | jq '.components["items:weight"]'

# Bulk verify weight presence
for f in data/mods/anatomy/entities/definitions/human_hair*.json; do
  echo -n "$f: "
  jq -r '.components["items:weight"].weight // "MISSING"' "$f"
done
```

### Invariants That Must Remain True

1. **Existing Components Unchanged**: Do not modify any existing component data
2. **Weight Realism**: All weights must be plausible for the hair type
3. **JSON Validity**: All files must remain valid JSON
4. **Schema Compliance**: All files must pass `npm run validate`
5. **No Accidental Removals**: No components should be removed

---

## Dependencies

- None - this ticket can be worked independently

## Blocks

- DISBODPARSPA-033 (Validation tests check weight completeness)
