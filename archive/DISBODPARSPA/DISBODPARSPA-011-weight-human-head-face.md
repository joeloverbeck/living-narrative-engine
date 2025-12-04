# DISBODPARSPA-011: Add `items:weight` to Human Head/Face Entity Definitions

## Status: COMPLETED ✅

---

## Outcome

### What Was Actually Changed vs. Originally Planned

**Original Plan (from ticket):**
- Add `items:weight` to 16 files including `human_head`, `human_face`, `human_skull`, `human_ear`, `human_nose`, `human_mouth`, `human_tongue`, `human_lips`, `human_jaw`, `human_cheek`, `human_forehead`, `human_chin`, `human_neck`, `human_throat`, `human_brain`, and `human_eye`

**Actual Implementation:**
- The original file assumptions were **incorrect**: most of the assumed files (head, face, skull, ear, nose, mouth, tongue, lips, jaw, cheek, forehead, chin, neck, throat) **do not exist** in the codebase
- Added `items:weight` to **13 files** that actually exist:
  - 1 brain file: `human_brain.entity.json` (weight: 1.4 kg)
  - 12 eye variant files: all `human_eye_*.entity.json` (weight: 0.008 kg each)

**Discrepancy Resolution:**
- Updated ticket assumptions to reflect actual codebase structure before implementation
- Created new test file `humanHeadFaceWeightValidation.test.js` with 29 tests to validate the invariants

### Files Modified

| File | Change | Weight Added |
|------|--------|--------------|
| `data/mods/anatomy/entities/definitions/human_brain.entity.json` | Added `items:weight` | 1.4 kg |
| `data/mods/anatomy/entities/definitions/human_eye_amber.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_blue.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_blue_hooded.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_brown.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_brown_almond.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_cobalt.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_gray_hooded.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_green.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_hazel_almond.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_hazel_hooded.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_pale_blue_round.entity.json` | Added `items:weight` | 0.008 kg |
| `data/mods/anatomy/entities/definitions/human_eye_red_hooded.entity.json` | Added `items:weight` | 0.008 kg |

### Tests Added

| Test File | Description | Test Count |
|-----------|-------------|------------|
| `tests/integration/mods/anatomy/humanHeadFaceWeightValidation.test.js` | Validates brain and eye weight components | 29 tests |

---

## Summary

Add realistic `items:weight` component to human head and face body part entity definitions. These include the brain and eyes (with various visual descriptors).

---

## Files to Touch

| File | Weight (kg) | Rationale |
|------|-------------|-----------|
| `data/mods/anatomy/entities/definitions/human_brain.entity.json` | 1.4 | Average human brain |
| `data/mods/anatomy/entities/definitions/human_eye_amber.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_blue.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_blue_hooded.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_brown.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_brown_almond.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_cobalt.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_gray_hooded.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_green.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_hazel_almond.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_hazel_hooded.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_pale_blue_round.entity.json` | 0.008 | Single eyeball |
| `data/mods/anatomy/entities/definitions/human_eye_red_hooded.entity.json` | 0.008 | Single eyeball |

**Note**: Original ticket assumed files like `human_head`, `human_face`, `human_skull`, `human_ear`, `human_nose`, `human_mouth`, `human_tongue`, `human_lips`, `human_jaw`, `human_cheek`, `human_forehead`, `human_chin`, `human_neck`, `human_throat` existed. These files do NOT exist in the codebase. The actual head/face-related files are the brain and eye variants listed above.

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- Human torso/limb parts (DISBODPARSPA-010)
- Human hair/extremity parts (DISBODPARSPA-012)
- Non-human entity definitions
- Schema changes to `anatomy:part` component
- Any source code files
- Creating new entity definition files that don't exist

---

## Implementation Details

### Change Pattern

For each file, add the `items:weight` component to the `components` object:

**Before:**
```json
{
  "id": "anatomy:human_brain",
  "components": {
    "anatomy:part": { "subType": "brain", "hit_probability_weight": 0 },
    "anatomy:part_health": { "currentHealth": 40, "maxHealth": 40, "state": "healthy" },
    "anatomy:vital_organ": { "organType": "brain" },
    "core:name": { "text": "brain" }
  }
}
```

**After:**
```json
{
  "id": "anatomy:human_brain",
  "components": {
    "anatomy:part": { "subType": "brain", "hit_probability_weight": 0 },
    "anatomy:part_health": { "currentHealth": 40, "maxHealth": 40, "state": "healthy" },
    "anatomy:vital_organ": { "organType": "brain" },
    "core:name": { "text": "brain" },
    "items:weight": { "weight": 1.4 }
  }
}
```

### Weight Reference

| Body Part Type | Weight Range (kg) | Notes |
|----------------|-------------------|-------|
| Brain | 1.3-1.5 | Adult brain |
| Eye | 0.007-0.009 | Per eyeball |

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
cat data/mods/anatomy/entities/definitions/human_brain.entity.json | jq '.components["items:weight"]'

# Bulk verify weight presence
for f in data/mods/anatomy/entities/definitions/human_brain.entity.json data/mods/anatomy/entities/definitions/human_eye_*.entity.json; do
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
