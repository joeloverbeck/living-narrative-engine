# CLOLAYMIG-010: Underwear - Remove from Clothing Mod

## Status: COMPLETED

## Summary

Remove the 33 underwear entity files from the `clothing` mod and update its manifest, now that they have been migrated to the `underwear` mod.

## Dependencies

- CLOLAYMIG-009 (Underwear - Update References) must be completed

## Files to Delete

Delete these 33 files from `data/mods/clothing/entities/definitions/`:

```
aubade_bahia_balconette_bra_pale_pink.entity.json
black_cotton_boxer_briefs.entity.json
black_leather_codpiece.entity.json
black_longline_sports_bra_medium_support.entity.json
charcoal_nylon_sports_bra.entity.json
cream_cotton_high_rise_briefs.entity.json
cream_cotton_soft_cup_bralette.entity.json
dark_gray_wool_boot_socks.entity.json
fitted_navy_cotton_boxer_briefs.entity.json
fuzzy_peach_socks.entity.json
graphite_wool_briefs.entity.json
gray_ribknit_cotton_socks.entity.json
high_waisted_ivory_tap_pants.entity.json
ivory_plunge_balconette_bra_french_lace.entity.json
la_perla_black_silk_triangle_bra.entity.json
lavender_fitted_camisole_lace_trim.entity.json
matte_sheer_tights_smoke_black.entity.json
nude_microfiber_seamless_thong.entity.json
nude_thong.entity.json
nylon_sports_bra.entity.json
pink_fuzzy_socks.entity.json
power_mesh_boxer_brief.entity.json
red_satin_bikini_briefs.entity.json
satin_cowl_neck_camisole.entity.json
seamless_plunge_bra_microfiber_nude.entity.json
spanx_high_waisted_control_briefs.entity.json
underwired_plunge_bra_nude_silk.entity.json
white_ankle_socks_ruffled_edges.entity.json
white_cotton_panties.entity.json
white_knee_high_socks_pink_bows.entity.json
white_midcrew_cotton_athletic_socks.entity.json
white_terry_lined_grip_socks.entity.json
white_thigh_high_socks_pink_hearts.entity.json
```

## Files to Modify

### `data/mods/clothing/mod-manifest.json`

Remove these 33 entries from the `entities.definitions` array.

**Entity count after this ticket depends on prior completions:**
- If all previous cleanups complete: 125 - 14 - 10 - 33 = **68 entities** (base-clothing only)
- This matches the base-clothing layer count

## Out of Scope

- **DO NOT** modify any files in the `underwear` mod
- **DO NOT** modify any recipe files
- **DO NOT** modify any other mod manifests
- **DO NOT** delete any non-underwear entity files
- **DO NOT** modify any other sections of the `clothing` manifest (components, actions, rules, etc.)

## Files Summary

| File | Action |
|------|--------|
| `data/mods/clothing/mod-manifest.json` | Remove 33 entries from definitions |
| `data/mods/clothing/entities/definitions/*.entity.json` | Delete 33 files |

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes - no duplicate entity warnings for underwear
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. The `underwear` mod has exactly 33 entity definitions
2. All recipe files continue to work (reference `underwear:*` IDs)
3. No broken entity references anywhere in the codebase
4. The game can start successfully with `npm run start`
5. The clothing mod's components, actions, rules, events, conditions, and scopes are unchanged

### Manual Verification

1. Count files in `data/mods/underwear/entities/definitions/` = 33
2. Verify `npm run validate` shows no duplicate entity warnings for underwear items
3. Run `npm run start` and verify the game loads

### Verification Commands

```bash
# Count underwear entities (should be 33)
ls -1 data/mods/underwear/entities/definitions/*.entity.json | wc -l

# Verify no duplicate IDs
grep -r '"id": "clothing:graphite_wool_briefs"' data/mods/
# Should return 0 results
```

## Post-Completion State

After this ticket:
- **Underwear migration is complete**
- `underwear` mod: 33 entities
- All underwear references point to `underwear:*`

## Rollback

```bash
# Restore deleted files from the underwear mod (they were copied)
for f in data/mods/underwear/entities/definitions/*.entity.json; do
  name=$(basename "$f")
  cp "$f" "data/mods/clothing/entities/definitions/$name"
  # Update ID back to clothing:*
  sed -i 's/"id": "underwear:/"id": "clothing:/g' "data/mods/clothing/entities/definitions/$name"
done

# Restore manifest
git checkout data/mods/clothing/mod-manifest.json
```

---

## Outcome

**Completed: 2025-11-26**

### What Was Actually Changed vs Originally Planned

**Planned Changes - All Completed As Specified:**
1. Deleted all 33 underwear entity files from `data/mods/clothing/entities/definitions/`
2. Updated `data/mods/clothing/mod-manifest.json` to remove the 33 entity entries from `entities.definitions`

**Additional Test Fixes Required:**
Two test files were referencing underwear items that had been migrated:

1. **`tests/integration/clothing/new_clothing_items_integration.test.js`**
   - Updated to use underwear mod path for migrated items (`white_thigh_high_socks_pink_hearts`, `white_cotton_panties`)
   - Changed expected entity IDs from `clothing:*` to `underwear:*`
   - Split test data arrays into `baseClothingFiles` and `underwearFiles`
   - Updated all relevant test blocks (entity structure, layering, outfit composition, material properties)

2. **`tests/integration/clothing/coverageMappingRuntime.integration.test.js`**
   - Removed `white_thigh_high_socks_pink_hearts` from two test arrays
   - Added migration note comments referencing CLOLAYMIG-010

**Test Strengthening:**
Extended `tests/integration/mods/underwear/underwearEntityMigration.integration.test.js`:
- Added new describe block `CLOLAYMIG-010: Clothing Mod Cleanup` with 3 tests:
  - Validates underwear entity files do NOT exist in clothing mod
  - Validates underwear entities are NOT referenced in clothing mod manifest
  - Validates no duplicate entity IDs between clothing and underwear mods

### Final Verification

| Verification | Expected | Actual |
|-------------|----------|--------|
| Underwear mod entity count | 33 | 33 ✓ |
| Clothing mod entity count | 68 | 68 ✓ |
| npm run validate | 0 violations | 0 violations ✓ |
| Underwear tests | Pass | 14 tests pass ✓ |
| Clothing tests | Pass | 285 tests pass ✓ |
| Duplicate entity IDs | None | None ✓ |

### Discrepancies From Ticket

**None.** The ticket assumptions were accurate. All 33 files existed in the clothing mod as specified, and the clothing mod manifest contained all 33 entries as expected.
