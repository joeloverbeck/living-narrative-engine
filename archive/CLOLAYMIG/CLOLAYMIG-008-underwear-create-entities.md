# CLOLAYMIG-008: Underwear - Create Entities in New Mod

**Status: COMPLETED**

## Outcome

### What Was Actually Changed

1. Created 33 entity files in `data/mods/underwear/entities/definitions/`
2. Updated `data/mods/underwear/mod-manifest.json` to include all 33 entity definitions
3. Each entity ID was changed from `clothing:*` to `underwear:*`

### Unchanged From Plan

- All 33 entities exactly as specified in the ticket
- No modifications to `clothing` mod (entities remain there temporarily)
- No recipe reference updates (handled by CLOLAYMIG-009)
- No other mod manifests modified

### Tests Added

- Created `tests/integration/mods/underwear/underwearEntityMigration.integration.test.js` (11 tests)
  - Entity file existence validation (2 tests)
  - Entity ID migration validation (3 tests)
  - Entity structure preservation (4 tests)
  - Mod manifest validation (2 tests)

### Verification

- `npm run validate` - PASSED
- `npm run test:unit -- tests/unit/clothing/entities/` - 69 tests PASSED
- `npm run test:integration -- tests/integration/clothing/` - 285 tests PASSED
- `npm run test:integration -- tests/integration/mods/underwear/` - 11 tests PASSED

---

## Summary

Copy 33 underwear entity files from `clothing` mod to `underwear` mod and update their entity IDs from `clothing:*` to `underwear:*`.

## Dependencies

- CLOLAYMIG-001 (Infrastructure Setup) must be completed

## Entity List (33 items)

| Current File                                           | Current ID                                          | New ID                                               |
| ------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| `aubade_bahia_balconette_bra_pale_pink.entity.json`    | `clothing:aubade_bahia_balconette_bra_pale_pink`    | `underwear:aubade_bahia_balconette_bra_pale_pink`    |
| `black_cotton_boxer_briefs.entity.json`                | `clothing:black_cotton_boxer_briefs`                | `underwear:black_cotton_boxer_briefs`                |
| `black_leather_codpiece.entity.json`                   | `clothing:black_leather_codpiece`                   | `underwear:black_leather_codpiece`                   |
| `black_longline_sports_bra_medium_support.entity.json` | `clothing:black_longline_sports_bra_medium_support` | `underwear:black_longline_sports_bra_medium_support` |
| `charcoal_nylon_sports_bra.entity.json`                | `clothing:charcoal_nylon_sports_bra`                | `underwear:charcoal_nylon_sports_bra`                |
| `cream_cotton_high_rise_briefs.entity.json`            | `clothing:cream_cotton_high_rise_briefs`            | `underwear:cream_cotton_high_rise_briefs`            |
| `cream_cotton_soft_cup_bralette.entity.json`           | `clothing:cream_cotton_soft_cup_bralette`           | `underwear:cream_cotton_soft_cup_bralette`           |
| `dark_gray_wool_boot_socks.entity.json`                | `clothing:dark_gray_wool_boot_socks`                | `underwear:dark_gray_wool_boot_socks`                |
| `fitted_navy_cotton_boxer_briefs.entity.json`          | `clothing:fitted_navy_cotton_boxer_briefs`          | `underwear:fitted_navy_cotton_boxer_briefs`          |
| `fuzzy_peach_socks.entity.json`                        | `clothing:fuzzy_peach_socks`                        | `underwear:fuzzy_peach_socks`                        |
| `graphite_wool_briefs.entity.json`                     | `clothing:graphite_wool_briefs`                     | `underwear:graphite_wool_briefs`                     |
| `gray_ribknit_cotton_socks.entity.json`                | `clothing:gray_ribknit_cotton_socks`                | `underwear:gray_ribknit_cotton_socks`                |
| `high_waisted_ivory_tap_pants.entity.json`             | `clothing:high_waisted_ivory_tap_pants`             | `underwear:high_waisted_ivory_tap_pants`             |
| `ivory_plunge_balconette_bra_french_lace.entity.json`  | `clothing:ivory_plunge_balconette_bra_french_lace`  | `underwear:ivory_plunge_balconette_bra_french_lace`  |
| `la_perla_black_silk_triangle_bra.entity.json`         | `clothing:la_perla_black_silk_triangle_bra`         | `underwear:la_perla_black_silk_triangle_bra`         |
| `lavender_fitted_camisole_lace_trim.entity.json`       | `clothing:lavender_fitted_camisole_lace_trim`       | `underwear:lavender_fitted_camisole_lace_trim`       |
| `matte_sheer_tights_smoke_black.entity.json`           | `clothing:matte_sheer_tights_smoke_black`           | `underwear:matte_sheer_tights_smoke_black`           |
| `nude_microfiber_seamless_thong.entity.json`           | `clothing:nude_microfiber_seamless_thong`           | `underwear:nude_microfiber_seamless_thong`           |
| `nude_thong.entity.json`                               | `clothing:nude_thong`                               | `underwear:nude_thong`                               |
| `nylon_sports_bra.entity.json`                         | `clothing:nylon_sports_bra`                         | `underwear:nylon_sports_bra`                         |
| `pink_fuzzy_socks.entity.json`                         | `clothing:pink_fuzzy_socks`                         | `underwear:pink_fuzzy_socks`                         |
| `power_mesh_boxer_brief.entity.json`                   | `clothing:power_mesh_boxer_brief`                   | `underwear:power_mesh_boxer_brief`                   |
| `red_satin_bikini_briefs.entity.json`                  | `clothing:red_satin_bikini_briefs`                  | `underwear:red_satin_bikini_briefs`                  |
| `satin_cowl_neck_camisole.entity.json`                 | `clothing:satin_cowl_neck_camisole`                 | `underwear:satin_cowl_neck_camisole`                 |
| `seamless_plunge_bra_microfiber_nude.entity.json`      | `clothing:seamless_plunge_bra_microfiber_nude`      | `underwear:seamless_plunge_bra_microfiber_nude`      |
| `spanx_high_waisted_control_briefs.entity.json`        | `clothing:spanx_high_waisted_control_briefs`        | `underwear:spanx_high_waisted_control_briefs`        |
| `underwired_plunge_bra_nude_silk.entity.json`          | `clothing:underwired_plunge_bra_nude_silk`          | `underwear:underwired_plunge_bra_nude_silk`          |
| `white_ankle_socks_ruffled_edges.entity.json`          | `clothing:white_ankle_socks_ruffled_edges`          | `underwear:white_ankle_socks_ruffled_edges`          |
| `white_cotton_panties.entity.json`                     | `clothing:white_cotton_panties`                     | `underwear:white_cotton_panties`                     |
| `white_knee_high_socks_pink_bows.entity.json`          | `clothing:white_knee_high_socks_pink_bows`          | `underwear:white_knee_high_socks_pink_bows`          |
| `white_midcrew_cotton_athletic_socks.entity.json`      | `clothing:white_midcrew_cotton_athletic_socks`      | `underwear:white_midcrew_cotton_athletic_socks`      |
| `white_terry_lined_grip_socks.entity.json`             | `clothing:white_terry_lined_grip_socks`             | `underwear:white_terry_lined_grip_socks`             |
| `white_thigh_high_socks_pink_hearts.entity.json`       | `clothing:white_thigh_high_socks_pink_hearts`       | `underwear:white_thigh_high_socks_pink_hearts`       |

## Files to Create

Copy each file from `data/mods/clothing/entities/definitions/` to `data/mods/underwear/entities/definitions/` and update the `id` field:

```
data/mods/underwear/entities/definitions/
├── aubade_bahia_balconette_bra_pale_pink.entity.json
├── black_cotton_boxer_briefs.entity.json
├── black_leather_codpiece.entity.json
├── black_longline_sports_bra_medium_support.entity.json
├── charcoal_nylon_sports_bra.entity.json
├── cream_cotton_high_rise_briefs.entity.json
├── cream_cotton_soft_cup_bralette.entity.json
├── dark_gray_wool_boot_socks.entity.json
├── fitted_navy_cotton_boxer_briefs.entity.json
├── fuzzy_peach_socks.entity.json
├── graphite_wool_briefs.entity.json
├── gray_ribknit_cotton_socks.entity.json
├── high_waisted_ivory_tap_pants.entity.json
├── ivory_plunge_balconette_bra_french_lace.entity.json
├── la_perla_black_silk_triangle_bra.entity.json
├── lavender_fitted_camisole_lace_trim.entity.json
├── matte_sheer_tights_smoke_black.entity.json
├── nude_microfiber_seamless_thong.entity.json
├── nude_thong.entity.json
├── nylon_sports_bra.entity.json
├── pink_fuzzy_socks.entity.json
├── power_mesh_boxer_brief.entity.json
├── red_satin_bikini_briefs.entity.json
├── satin_cowl_neck_camisole.entity.json
├── seamless_plunge_bra_microfiber_nude.entity.json
├── spanx_high_waisted_control_briefs.entity.json
├── underwired_plunge_bra_nude_silk.entity.json
├── white_ankle_socks_ruffled_edges.entity.json
├── white_cotton_panties.entity.json
├── white_knee_high_socks_pink_bows.entity.json
├── white_midcrew_cotton_athletic_socks.entity.json
├── white_terry_lined_grip_socks.entity.json
└── white_thigh_high_socks_pink_hearts.entity.json
```

## Files to Modify

### `data/mods/underwear/mod-manifest.json`

Add all 33 entity files to the `definitions` array:

```json
"content": {
  "entities": {
    "definitions": [
      "aubade_bahia_balconette_bra_pale_pink.entity.json",
      "black_cotton_boxer_briefs.entity.json",
      "black_leather_codpiece.entity.json",
      "black_longline_sports_bra_medium_support.entity.json",
      "charcoal_nylon_sports_bra.entity.json",
      "cream_cotton_high_rise_briefs.entity.json",
      "cream_cotton_soft_cup_bralette.entity.json",
      "dark_gray_wool_boot_socks.entity.json",
      "fitted_navy_cotton_boxer_briefs.entity.json",
      "fuzzy_peach_socks.entity.json",
      "graphite_wool_briefs.entity.json",
      "gray_ribknit_cotton_socks.entity.json",
      "high_waisted_ivory_tap_pants.entity.json",
      "ivory_plunge_balconette_bra_french_lace.entity.json",
      "la_perla_black_silk_triangle_bra.entity.json",
      "lavender_fitted_camisole_lace_trim.entity.json",
      "matte_sheer_tights_smoke_black.entity.json",
      "nude_microfiber_seamless_thong.entity.json",
      "nude_thong.entity.json",
      "nylon_sports_bra.entity.json",
      "pink_fuzzy_socks.entity.json",
      "power_mesh_boxer_brief.entity.json",
      "red_satin_bikini_briefs.entity.json",
      "satin_cowl_neck_camisole.entity.json",
      "seamless_plunge_bra_microfiber_nude.entity.json",
      "spanx_high_waisted_control_briefs.entity.json",
      "underwired_plunge_bra_nude_silk.entity.json",
      "white_ankle_socks_ruffled_edges.entity.json",
      "white_cotton_panties.entity.json",
      "white_knee_high_socks_pink_bows.entity.json",
      "white_midcrew_cotton_athletic_socks.entity.json",
      "white_terry_lined_grip_socks.entity.json",
      "white_thigh_high_socks_pink_hearts.entity.json"
    ],
    "instances": []
  }
}
```

## Out of Scope

- **DO NOT** delete any files from `clothing` mod yet
- **DO NOT** modify `clothing/mod-manifest.json`
- **DO NOT** modify any recipe files
- **DO NOT** modify any mod manifests other than `underwear/mod-manifest.json`
- **DO NOT** modify any other mods' dependencies

## Entity ID Update Pattern

For each copied file, update only the `id` field:

```diff
- "id": "clothing:graphite_wool_briefs",
+ "id": "underwear:graphite_wool_briefs",
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
2. All recipe files continue to work (still reference `clothing:*` IDs)
3. The `underwear` mod loads successfully with 33 entities
4. Each entity in `underwear` has correct `underwear:*` ID prefix
5. Entity file names remain identical (only content changes)

### Manual Verification

1. Count files in `data/mods/underwear/entities/definitions/` = 33
2. Verify each file has `"id": "underwear:..."` (not `clothing:...`)
3. Run `npm run validate` - should pass (duplicate warnings are acceptable temporarily)

## Rollback

```bash
rm -rf data/mods/underwear/entities/definitions/*.entity.json
# Reset manifest to empty definitions array
```
