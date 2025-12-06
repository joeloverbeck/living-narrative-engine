# CLOLAYMIG-005: Outer-Clothing - Create Entities in New Mod

**Status: ✅ COMPLETED**

## Summary

Copy 10 outer-layer entity files from `clothing` mod to `outer-clothing` mod and update their entity IDs from `clothing:*` to `outer-clothing:*`.

## Dependencies

- CLOLAYMIG-001 (Infrastructure Setup) must be completed

## Entity List (10 items)

| Current File                                              | Current ID                                             | New ID                                                       |
| --------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `battle_scarred_leather_jacket.entity.json`               | `clothing:battle_scarred_leather_jacket`               | `outer-clothing:battle_scarred_leather_jacket`               |
| `charcoal_heather_zip_up_hoodie.entity.json`              | `clothing:charcoal_heather_zip_up_hoodie`              | `outer-clothing:charcoal_heather_zip_up_hoodie`              |
| `dark_olive_cotton_twill_chore_jacket.entity.json`        | `clothing:dark_olive_cotton_twill_chore_jacket`        | `outer-clothing:dark_olive_cotton_twill_chore_jacket`        |
| `floor_length_black_leather_coat.entity.json`             | `clothing:floor_length_black_leather_coat`             | `outer-clothing:floor_length_black_leather_coat`             |
| `flowing_cape_blood_red.entity.json`                      | `clothing:flowing_cape_blood_red`                      | `outer-clothing:flowing_cape_blood_red`                      |
| `indigo_denim_trucker_jacket.entity.json`                 | `clothing:indigo_denim_trucker_jacket`                 | `outer-clothing:indigo_denim_trucker_jacket`                 |
| `leather_work_apron.entity.json`                          | `clothing:leather_work_apron`                          | `outer-clothing:leather_work_apron`                          |
| `military_coat_midnight_blue_gold_epaulettes.entity.json` | `clothing:military_coat_midnight_blue_gold_epaulettes` | `outer-clothing:military_coat_midnight_blue_gold_epaulettes` |
| `pale_pink_fleece_hoodie_heart_patches.entity.json`       | `clothing:pale_pink_fleece_hoodie_heart_patches`       | `outer-clothing:pale_pink_fleece_hoodie_heart_patches`       |
| `white_structured_linen_blazer.entity.json`               | `clothing:white_structured_linen_blazer`               | `outer-clothing:white_structured_linen_blazer`               |

## Files to Create

Copy each file from `data/mods/clothing/entities/definitions/` to `data/mods/outer-clothing/entities/definitions/` and update the `id` field:

```
data/mods/outer-clothing/entities/definitions/
├── battle_scarred_leather_jacket.entity.json
├── charcoal_heather_zip_up_hoodie.entity.json
├── dark_olive_cotton_twill_chore_jacket.entity.json
├── floor_length_black_leather_coat.entity.json
├── flowing_cape_blood_red.entity.json
├── indigo_denim_trucker_jacket.entity.json
├── leather_work_apron.entity.json
├── military_coat_midnight_blue_gold_epaulettes.entity.json
├── pale_pink_fleece_hoodie_heart_patches.entity.json
└── white_structured_linen_blazer.entity.json
```

## Files to Modify

### `data/mods/outer-clothing/mod-manifest.json`

Add all 10 entity files to the `definitions` array:

```json
"content": {
  "entities": {
    "definitions": [
      "battle_scarred_leather_jacket.entity.json",
      "charcoal_heather_zip_up_hoodie.entity.json",
      "dark_olive_cotton_twill_chore_jacket.entity.json",
      "floor_length_black_leather_coat.entity.json",
      "flowing_cape_blood_red.entity.json",
      "indigo_denim_trucker_jacket.entity.json",
      "leather_work_apron.entity.json",
      "military_coat_midnight_blue_gold_epaulettes.entity.json",
      "pale_pink_fleece_hoodie_heart_patches.entity.json",
      "white_structured_linen_blazer.entity.json"
    ],
    "instances": []
  }
}
```

## Out of Scope

- **DO NOT** delete any files from `clothing` mod yet
- **DO NOT** modify `clothing/mod-manifest.json`
- **DO NOT** modify any recipe files
- **DO NOT** modify any mod manifests other than `outer-clothing/mod-manifest.json`
- **DO NOT** modify any other mods' dependencies

## Entity ID Update Pattern

For each copied file, update only the `id` field:

```diff
- "id": "clothing:battle_scarred_leather_jacket",
+ "id": "outer-clothing:battle_scarred_leather_jacket",
```

**Do not change any other fields in the entity files.**

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes (may show duplicate entity warnings - expected)
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. The `clothing` mod still contains all original entity definitions
2. All recipe files continue to work (still reference `clothing:*` IDs for outer items)
3. The `outer-clothing` mod loads successfully with 10 entities
4. Each entity in `outer-clothing` has correct `outer-clothing:*` ID prefix
5. Entity file names remain identical (only content changes)

### Manual Verification

1. Count files in `data/mods/outer-clothing/entities/definitions/` = 10
2. Verify each file has `"id": "outer-clothing:..."` (not `clothing:...`)
3. Run `npm run validate` - should pass (duplicate warnings are acceptable temporarily)

## Rollback

```bash
rm -rf data/mods/outer-clothing/entities/definitions/*.entity.json
# Reset manifest to empty definitions array
```

---

## Outcome

### What Was Actually Changed

1. **Created 10 entity files** in `data/mods/outer-clothing/entities/definitions/`:
   - `battle_scarred_leather_jacket.entity.json`
   - `charcoal_heather_zip_up_hoodie.entity.json`
   - `dark_olive_cotton_twill_chore_jacket.entity.json`
   - `floor_length_black_leather_coat.entity.json`
   - `flowing_cape_blood_red.entity.json`
   - `indigo_denim_trucker_jacket.entity.json`
   - `leather_work_apron.entity.json`
   - `military_coat_midnight_blue_gold_epaulettes.entity.json`
   - `pale_pink_fleece_hoodie_heart_patches.entity.json`
   - `white_structured_linen_blazer.entity.json`

2. **Updated `data/mods/outer-clothing/mod-manifest.json`** to include all 10 entity definitions in the `definitions` array.

### Verification Results

- ✅ `npm run validate` passed (0 cross-reference violations)
- ✅ Unit tests: 2233 suites, 36863 tests passed
- ✅ Integration tests: 1808 suites, 13584 tests passed
- ✅ All 10 files have correct `outer-clothing:*` ID prefix
- ✅ Original `clothing` mod entities remain unchanged

### Deviation from Plan

None - implementation followed the ticket exactly as specified.

### Date Completed

2025-11-26
