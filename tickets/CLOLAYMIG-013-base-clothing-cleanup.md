# CLOLAYMIG-013: Base-Clothing - Remove from Clothing Mod

## Summary

Remove the 68 base-clothing entity files from the `clothing` mod and update its manifest, now that they have been migrated to the `base-clothing` mod.

## Dependencies

- CLOLAYMIG-012 (Base-Clothing - Update References) must be completed

## Files to Delete

Delete these 68 files from `data/mods/clothing/entities/definitions/`:

```
baby_blue_crop_tank.entity.json
black_athletic_sneakers.entity.json
black_breeches_tapered_knee.entity.json
black_cargo_joggers.entity.json
black_foam_slide_sandals.entity.json
black_leather_duty_boots.entity.json
black_running_shorts_red_trim.entity.json
black_silk_robe_kimono_sleeves.entity.json
black_stretch_silk_bodysuit.entity.json
black_trail_running_shoes.entity.json
block_heel_slingbacks_leather_taupe.entity.json
blush_pink_cotton_robe.entity.json
bronze_silk_blouse.entity.json
brown_suede_loafers.entity.json
charcoal_wool_tshirt.entity.json
cotton_twill_trousers.entity.json
cream_poets_shirt_billowing_sleeves.entity.json
croc_embossed_ankle_boots.entity.json
dark_burgundy_long_sleeve_tshirt.entity.json
dark_indigo_denim_jeans.entity.json
dark_olive_high_rise_double_pleat_trousers.entity.json
digitigrade_foot_wraps_burgundy.entity.json
fitted_black_leather_trousers.entity.json
fitted_burgundy_vest_brass_buttons.entity.json
flat_trainers.entity.json
forest_green_cotton_linen_button_down.entity.json
full_length_black_velvet_gown.entity.json
fuzzy_pink_slippers.entity.json
giuseppe_zanotti_harmony_115_sandals_black_crystal.entity.json
graphite_wool_wide_leg_trousers.entity.json
heavy_brocade_vest_silver_serpentine.entity.json
high_compression_leggings.entity.json
high_waisted_pencil_skirt_black.entity.json
knee_high_combat_boots.entity.json
leather_slippers.entity.json
leather_stiletto_pumps.entity.json
manolo_blahnik_hangisi_flats_blush_satin.entity.json
mint_green_cotton_nightgown_daisies.entity.json
navy_cotton_tank_top.entity.json
nude_leather_ankle_tie_sandals.entity.json
orange_cotton_short_shorts.entity.json
pale_blue_oxford_button_down.entity.json
pink_cotton_shorts_white_piping.entity.json
pink_off_shoulder_crop_top.entity.json
pink_short_flared_skirt.entity.json
red_compression_racerback_tank.entity.json
red_matte_lycra_high_waist_bike_shorts.entity.json
red_satin_shawl_robe.entity.json
ribbed_cotton_tank_slim_red.entity.json
saint_laurent_anja_105_pumps_black_patent.entity.json
sand_beige_cotton_chinos.entity.json
sand_silk_wrap_dress.entity.json
sand_suede_chukka_boots.entity.json
shale_gray_nylon_field_pants.entity.json
shawl_collar_blush_pink_robe.entity.json
slate_gray_wool_long_sleeve_top.entity.json
soft_gray_sweatpants.entity.json
structured_bodice_deep_crimson_steel_boning.entity.json
thigh_high_steel_tipped_boots.entity.json
versace_barocco_black_gold_slip_dress.entity.json
white_cotton_crew_tshirt.entity.json
white_cotton_linen_trousers.entity.json
white_cotton_shift_dress.entity.json
white_leather_sneakers.entity.json
white_platform_sneakers.entity.json
white_slippers_bow_detail.entity.json
ysl_black_tuxedo_trousers.entity.json
zimmermann_powder_pink_linen_midi_dress.entity.json
```

## Files to Modify

### `data/mods/clothing/mod-manifest.json`

Remove these 68 entries from the `entities.definitions` array.

**Entity count after this ticket:**
- If all previous cleanups complete: 125 - 14 - 10 - 33 - 68 = **0 entities** (clothing mod becomes framework-only)
- This is the final cleanup - clothing mod retains only components, actions, rules, events, conditions, and scopes

## Out of Scope

- **DO NOT** modify any files in the `base-clothing` mod
- **DO NOT** modify any recipe files
- **DO NOT** modify any other mod manifests
- **DO NOT** delete any non-base-clothing entity files
- **DO NOT** modify any other sections of the `clothing` manifest (components, actions, rules, etc.)

## Files Summary

| File | Action |
|------|--------|
| `data/mods/clothing/mod-manifest.json` | Remove 68 entries from definitions |
| `data/mods/clothing/entities/definitions/*.entity.json` | Delete 68 files |

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes - no duplicate entity warnings for base items
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. The `base-clothing` mod has exactly 68 entity definitions
2. All recipe files continue to work (reference `base-clothing:*` IDs)
3. No broken entity references anywhere in the codebase
4. The game can start successfully with `npm run start`
5. The clothing mod's components, actions, rules, events, conditions, and scopes are unchanged
6. The clothing mod's `entities/definitions/` folder is empty after this ticket

### Manual Verification

1. Count files in `data/mods/base-clothing/entities/definitions/` = 68
2. Count files in `data/mods/clothing/entities/definitions/` = 0
3. Verify `npm run validate` shows no duplicate entity warnings for base items
4. Run `npm run start` and verify the game loads

### Verification Commands

```bash
# Count base-clothing entities (should be 68)
ls -1 data/mods/base-clothing/entities/definitions/*.entity.json | wc -l

# Count clothing entities (should be 0)
ls -1 data/mods/clothing/entities/definitions/*.entity.json 2>/dev/null | wc -l

# Verify no duplicate IDs
grep -r '"id": "clothing:charcoal_wool_tshirt"' data/mods/
# Should return 0 results
```

## Post-Completion State

After this ticket:
- **Base-clothing migration is complete**
- **All entity migrations are complete**
- `clothing` mod: 0 entities (framework mod only)
- `base-clothing` mod: 68 entities
- `underwear` mod: 33 entities
- `outer-clothing` mod: 10 entities
- `accessories` mod: 14 entities
- Total entities: 125 (unchanged, just redistributed)

## Rollback

```bash
# Restore deleted files from the base-clothing mod (they were copied)
for f in data/mods/base-clothing/entities/definitions/*.entity.json; do
  name=$(basename "$f")
  cp "$f" "data/mods/clothing/entities/definitions/$name"
  # Update ID back to clothing:*
  sed -i 's/"id": "base-clothing:/"id": "clothing:/g' "data/mods/clothing/entities/definitions/$name"
done

# Restore manifest
git checkout data/mods/clothing/mod-manifest.json
```
