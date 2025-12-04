# DISBODPARSPA-013: Add `items:weight` to Chicken Entity Definitions

## Summary

Add realistic `items:weight` component to all chicken body part entity definitions. Chickens have **26** body part definitions across base entities and variants.

---

## Files to Touch

| File | Weight (kg) | Rationale |
|------|-------------|-----------|
| `chicken_torso.entity.json` | 1.5 | Main body cavity |
| `chicken_head.entity.json` | 0.08 | Standard head |
| `chicken_head_chalky_white.entity.json` | 0.08 | Head variant |
| `chicken_head_rust_red.entity.json` | 0.08 | Head variant |
| `chicken_head_twisted_joints.entity.json` | 0.08 | Head variant |
| `chicken_brain.entity.json` | 0.004 | Internal organ |
| `chicken_heart.entity.json` | 0.008 | Internal organ |
| `chicken_spine.entity.json` | 0.05 | Internal organ |
| `chicken_wing.entity.json` | 0.15 | Base wing |
| `chicken_wing_buff.entity.json` | 0.15 | Wing variant |
| `chicken_wing_copper_metallic.entity.json` | 0.15 | Wing variant |
| `chicken_wing_glossy_black_iridescent.entity.json` | 0.15 | Wing variant |
| `chicken_wing_slate_blue.entity.json` | 0.15 | Wing variant |
| `chicken_wing_speckled.entity.json` | 0.15 | Wing variant |
| `chicken_leg.entity.json` | 0.2 | Single leg (thigh+drum) |
| `chicken_foot.entity.json` | 0.03 | Single foot |
| `chicken_spur.entity.json` | 0.005 | Rooster spur |
| `chicken_beak.entity.json` | 0.005 | Beak |
| `chicken_comb.entity.json` | 0.01 | Base comb |
| `chicken_comb_bantam.entity.json` | 0.006 | Small bantam comb |
| `chicken_comb_large_coarse.entity.json` | 0.015 | Large comb variant |
| `chicken_wattle.entity.json` | 0.005 | Base wattle |
| `chicken_wattle_bantam.entity.json` | 0.003 | Small bantam wattle |
| `chicken_wattle_large.entity.json` | 0.008 | Large wattle variant |
| `chicken_tail.entity.json` | 0.05 | Base tail feathers |
| `chicken_tail_large_long.entity.json` | 0.08 | Large tail variant |

**Total**: 26 files

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- Human entity definitions (DISBODPARSPA-010, 011, 012)
- Other creature entity definitions (DISBODPARSPA-014)
- Schema changes to `anatomy:part` component
- Any source code files (except test files if needed for validation)

---

## Implementation Details

### Change Pattern

For each file, add the `items:weight` component to the `components` object:

**Before:**
```json
{
  "id": "anatomy:chicken_wing",
  "components": {
    "anatomy:part": { "subType": "chicken_wing", "hit_probability_weight": 6 },
    "anatomy:part_health": { "currentHealth": 8, "maxHealth": 8, "state": "healthy" },
    "core:name": { "text": "chicken wing" },
    "descriptors:texture": { "texture": "feathered" }
  }
}
```

**After:**
```json
{
  "id": "anatomy:chicken_wing",
  "components": {
    "anatomy:part": { "subType": "chicken_wing", "hit_probability_weight": 6 },
    "anatomy:part_health": { "currentHealth": 8, "maxHealth": 8, "state": "healthy" },
    "core:name": { "text": "chicken wing" },
    "descriptors:texture": { "texture": "feathered" },
    "items:weight": { "weight": 0.15 }
  }
}
```

### Weight Reference (Adult Chicken ~2-4 kg total)

| Body Part Type | Weight Range (kg) | Notes |
|----------------|-------------------|-------|
| Torso | 1.2-2.0 | Main body cavity |
| Head | 0.06-0.1 | Including brain case |
| Brain | 0.003-0.005 | Internal organ |
| Heart | 0.006-0.01 | Internal organ |
| Spine | 0.04-0.06 | Vertebral column |
| Wing | 0.1-0.2 | Per wing |
| Leg (full) | 0.15-0.25 | Thigh + drumstick |
| Foot | 0.02-0.04 | Per foot |
| Spur | 0.003-0.007 | Rooster keratinous growth |
| Beak | 0.003-0.007 | Keratinous structure |
| Comb | 0.005-0.02 | Varies by breed |
| Wattle | 0.003-0.01 | Varies by breed |
| Tail | 0.04-0.1 | Varies by breed/sex |

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

# List all chicken entity files
ls data/mods/anatomy/entities/definitions/chicken_*.json | wc -l

# Bulk verify weight presence
for f in data/mods/anatomy/entities/definitions/chicken_*.json; do
  echo -n "$f: "
  jq -r '.components["items:weight"].weight // "MISSING"' "$f"
done
```

### Invariants That Must Remain True

1. **Existing Components Unchanged**: Do not modify any existing component data
2. **Weight Realism**: All weights must be plausible for chicken body parts
3. **JSON Validity**: All files must remain valid JSON
4. **Schema Compliance**: All files must pass `npm run validate`
5. **No Accidental Removals**: No components should be removed
6. **Complete Coverage**: All 26 chicken_*.json files must have weight added

---

## Dependencies

- None - this ticket can be worked independently

## Blocks

- DISBODPARSPA-033 (Validation tests check weight completeness)

---

## Status: ✅ COMPLETED

Completed on: 2025-12-04

---

## Outcome

### What Changed vs Originally Planned

**Original Plan (from initial ticket):**
- Ticket originally listed ~26 files but with incorrect file names:
  - Listed non-existent files: `chicken_body.entity.json`, `chicken_neck.entity.json`, `chicken_breast.entity.json`, `chicken_eye.entity.json`, `chicken_feathers.entity.json`
  - Used `chicken_body` instead of actual `chicken_torso`

**Actual Implementation:**
- **Ticket corrected first** to accurately list all 26 existing files
- All 26 actual chicken entity files updated with `items:weight` component
- Internal organs included: `chicken_brain` (0.004kg), `chicken_heart` (0.008kg), `chicken_spine` (0.05kg)
- Variant files included with appropriate size-appropriate weights:
  - Bantam variants: smaller weights (e.g., `chicken_comb_bantam` = 0.006kg)
  - Large variants: larger weights (e.g., `chicken_comb_large_coarse` = 0.015kg)

### Files Modified

**Entity Files (26):**
All files in `data/mods/anatomy/entities/definitions/chicken_*.entity.json`

**Test Files (1):**
- `tests/integration/anatomy/chickenEntityValidation.test.js` - Added weight validation test suite

### Test Results

- **Validation**: `npm run validate` passes with 0 violations
- **Tests**: 152 tests pass (including 58 new weight validation tests)
  - Weight presence checks for all 26 entities
  - Weight > 0 validation for all entities
  - Weight realism checks (torso heaviest, variant consistency, size ordering)
