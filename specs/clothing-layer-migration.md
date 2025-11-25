# Clothing Layer Migration Specification

## Overview

This specification documents the migration of 125 clothing entities from the monolithic `clothing` mod into 4 layer-specific mods, following the pattern established by the `armor` mod.

### Goals

1. **Separate concerns**: Each layer-specific mod owns entities of a single clothing layer
2. **Maintain shared infrastructure**: The `clothing` mod retains components, actions, rules, events, conditions, and scopes
3. **Update all references**: Entity IDs change from `clothing:*` to their new mod namespace
4. **Phased execution**: Minimize risk through layer-by-layer migration with validation checkpoints

### Non-Goals

- Modifying the clothing component schemas
- Changing the layer system itself
- Migrating the existing `armor` mod (already separate)

---

## Target Architecture

### Dependency Hierarchy

```
                    ┌──────────────┐
                    │     core     │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼─────┐  ┌──────▼─────┐  ┌──────▼─────┐
    │  anatomy   │  │   items    │  │ descriptors│
    └──────┬─────┘  └──────┬─────┘  └──────┬─────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼───────┐
                    │   clothing   │  ← Components, Actions, Rules, Scopes ONLY
                    └──────┬───────┘
                           │
      ┌────────────┬───────┴───────┬────────────┐
      │            │               │            │
┌─────▼────┐ ┌─────▼─────┐ ┌───────▼─────┐ ┌────▼──────┐
│underwear │ │base-cloth-│ │outer-cloth- │ │accessories│
│(33 items)│ │ing (68)   │ │ing (10)     │ │(14 items) │
└──────────┘ └───────────┘ └─────────────┘ └───────────┘
                                  │
                           ┌──────▼───────┐
                           │    armor     │  (existing - no changes)
                           └──────────────┘
```

### New Mod Names

| Mod ID | Layer | Entity Count | Entity ID Pattern |
|--------|-------|--------------|-------------------|
| `underwear` | underwear | 33 | `underwear:item_name` |
| `base-clothing` | base | 68 | `base-clothing:item_name` |
| `outer-clothing` | outer | 10 | `outer-clothing:item_name` |
| `accessories` | accessories | 14 | `accessories:item_name` |

### Clothing Mod (Post-Migration)

The `clothing` mod becomes a **framework mod** containing:

**KEEP:**
- `components/` - All 5 component definitions
  - `wearable.component.json`
  - `coverage_mapping.component.json`
  - `equipment.component.json`
  - `slot_metadata.component.json`
  - `blocks_removal.component.json`
- `actions/` - Both clothing actions
  - `remove_clothing.action.json`
  - `remove_others_clothing.action.json`
- `rules/` - Both rule handlers
- `events/` - All 4 clothing events
- `conditions/` - Both conditions
- `scopes/` - All 5 scope definitions

**REMOVE:**
- `entities/definitions/` - All 125 entity files (moved to layer mods)

---

## Mod Manifest Template

Each new layer mod follows this structure (based on `armor` mod pattern):

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "<mod-id>",
  "version": "1.0.0",
  "name": "<Display Name>",
  "description": "<layer> clothing entities",
  "author": "Living Narrative Engine",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "descriptors", "version": "^1.0.0" },
    { "id": "items", "version": "^1.0.0" },
    { "id": "clothing", "version": "^1.0.0" }
  ],
  "gameVersion": ">=0.0.1",
  "content": {
    "entities": {
      "definitions": [
        "entity1.entity.json",
        "entity2.entity.json"
      ],
      "instances": []
    }
  }
}
```

---

## Entity Distribution by Layer

### Accessories Layer (14 items) → `accessories` mod

| Current ID | New ID |
|------------|--------|
| `clothing:black_calfskin_belt` | `accessories:black_calfskin_belt` |
| `clothing:black_diamond_silver_spike_collar` | `accessories:black_diamond_silver_spike_collar` |
| `clothing:black_leather_collar_silver_bell` | `accessories:black_leather_collar_silver_bell` |
| `clothing:black_tactical_work_belt` | `accessories:black_tactical_work_belt` |
| `clothing:dark_brown_leather_belt` | `accessories:dark_brown_leather_belt` |
| `clothing:layered_gold_chain_necklaces` | `accessories:layered_gold_chain_necklaces` |
| `clothing:layered_pearl_choker` | `accessories:layered_pearl_choker` |
| `clothing:mikimoto_delicate_pearl_strand` | `accessories:mikimoto_delicate_pearl_strand` |
| `clothing:platinum_necklace` | `accessories:platinum_necklace` |
| `clothing:silver_chain_pendant_necklace` | `accessories:silver_chain_pendant_necklace` |
| `clothing:slate_nylon_baseball_cap` | `accessories:slate_nylon_baseball_cap` |
| `clothing:small_steel_huggie_hoops` | `accessories:small_steel_huggie_hoops` |
| `clothing:south_sea_pearl_necklace_16mm` | `accessories:south_sea_pearl_necklace_16mm` |
| `clothing:twisted_black_metal_crown_blood_red_gems` | `accessories:twisted_black_metal_crown_blood_red_gems` |

### Outer Layer (10 items) → `outer-clothing` mod

| Current ID | New ID |
|------------|--------|
| `clothing:battle_scarred_leather_jacket` | `outer-clothing:battle_scarred_leather_jacket` |
| `clothing:charcoal_heather_zip_up_hoodie` | `outer-clothing:charcoal_heather_zip_up_hoodie` |
| `clothing:dark_olive_cotton_twill_chore_jacket` | `outer-clothing:dark_olive_cotton_twill_chore_jacket` |
| `clothing:floor_length_black_leather_coat` | `outer-clothing:floor_length_black_leather_coat` |
| `clothing:flowing_cape_blood_red` | `outer-clothing:flowing_cape_blood_red` |
| `clothing:indigo_denim_trucker_jacket` | `outer-clothing:indigo_denim_trucker_jacket` |
| `clothing:leather_work_apron` | `outer-clothing:leather_work_apron` |
| `clothing:military_coat_midnight_blue_gold_epaulettes` | `outer-clothing:military_coat_midnight_blue_gold_epaulettes` |
| `clothing:pale_pink_fleece_hoodie_heart_patches` | `outer-clothing:pale_pink_fleece_hoodie_heart_patches` |
| `clothing:white_structured_linen_blazer` | `outer-clothing:white_structured_linen_blazer` |

### Underwear Layer (33 items) → `underwear` mod

| Current ID | New ID |
|------------|--------|
| `clothing:aubade_bahia_balconette_bra_pale_pink` | `underwear:aubade_bahia_balconette_bra_pale_pink` |
| `clothing:black_cotton_boxer_briefs` | `underwear:black_cotton_boxer_briefs` |
| `clothing:black_leather_codpiece` | `underwear:black_leather_codpiece` |
| `clothing:black_longline_sports_bra_medium_support` | `underwear:black_longline_sports_bra_medium_support` |
| `clothing:charcoal_nylon_sports_bra` | `underwear:charcoal_nylon_sports_bra` |
| `clothing:cream_cotton_high_rise_briefs` | `underwear:cream_cotton_high_rise_briefs` |
| `clothing:cream_cotton_soft_cup_bralette` | `underwear:cream_cotton_soft_cup_bralette` |
| `clothing:dark_gray_wool_boot_socks` | `underwear:dark_gray_wool_boot_socks` |
| `clothing:fitted_navy_cotton_boxer_briefs` | `underwear:fitted_navy_cotton_boxer_briefs` |
| `clothing:fuzzy_peach_socks` | `underwear:fuzzy_peach_socks` |
| `clothing:graphite_wool_briefs` | `underwear:graphite_wool_briefs` |
| `clothing:gray_ribknit_cotton_socks` | `underwear:gray_ribknit_cotton_socks` |
| `clothing:high_waisted_ivory_tap_pants` | `underwear:high_waisted_ivory_tap_pants` |
| `clothing:ivory_plunge_balconette_bra_french_lace` | `underwear:ivory_plunge_balconette_bra_french_lace` |
| `clothing:la_perla_black_silk_triangle_bra` | `underwear:la_perla_black_silk_triangle_bra` |
| `clothing:lavender_fitted_camisole_lace_trim` | `underwear:lavender_fitted_camisole_lace_trim` |
| `clothing:matte_sheer_tights_smoke_black` | `underwear:matte_sheer_tights_smoke_black` |
| `clothing:nude_microfiber_seamless_thong` | `underwear:nude_microfiber_seamless_thong` |
| `clothing:nude_thong` | `underwear:nude_thong` |
| `clothing:nylon_sports_bra` | `underwear:nylon_sports_bra` |
| `clothing:pink_fuzzy_socks` | `underwear:pink_fuzzy_socks` |
| `clothing:power_mesh_boxer_brief` | `underwear:power_mesh_boxer_brief` |
| `clothing:red_satin_bikini_briefs` | `underwear:red_satin_bikini_briefs` |
| `clothing:satin_cowl_neck_camisole` | `underwear:satin_cowl_neck_camisole` |
| `clothing:seamless_plunge_bra_microfiber_nude` | `underwear:seamless_plunge_bra_microfiber_nude` |
| `clothing:spanx_high_waisted_control_briefs` | `underwear:spanx_high_waisted_control_briefs` |
| `clothing:underwired_plunge_bra_nude_silk` | `underwear:underwired_plunge_bra_nude_silk` |
| `clothing:white_ankle_socks_ruffled_edges` | `underwear:white_ankle_socks_ruffled_edges` |
| `clothing:white_cotton_panties` | `underwear:white_cotton_panties` |
| `clothing:white_knee_high_socks_pink_bows` | `underwear:white_knee_high_socks_pink_bows` |
| `clothing:white_midcrew_cotton_athletic_socks` | `underwear:white_midcrew_cotton_athletic_socks` |
| `clothing:white_terry_lined_grip_socks` | `underwear:white_terry_lined_grip_socks` |
| `clothing:white_thigh_high_socks_pink_hearts` | `underwear:white_thigh_high_socks_pink_hearts` |

### Base Layer (68 items) → `base-clothing` mod

| Current ID | New ID |
|------------|--------|
| `clothing:baby_blue_crop_tank` | `base-clothing:baby_blue_crop_tank` |
| `clothing:black_athletic_sneakers` | `base-clothing:black_athletic_sneakers` |
| `clothing:black_breeches_tapered_knee` | `base-clothing:black_breeches_tapered_knee` |
| `clothing:black_cargo_joggers` | `base-clothing:black_cargo_joggers` |
| `clothing:black_foam_slide_sandals` | `base-clothing:black_foam_slide_sandals` |
| `clothing:black_leather_duty_boots` | `base-clothing:black_leather_duty_boots` |
| `clothing:black_running_shorts_red_trim` | `base-clothing:black_running_shorts_red_trim` |
| `clothing:black_silk_robe_kimono_sleeves` | `base-clothing:black_silk_robe_kimono_sleeves` |
| `clothing:black_stretch_silk_bodysuit` | `base-clothing:black_stretch_silk_bodysuit` |
| `clothing:black_trail_running_shoes` | `base-clothing:black_trail_running_shoes` |
| `clothing:block_heel_slingbacks_leather_taupe` | `base-clothing:block_heel_slingbacks_leather_taupe` |
| `clothing:blush_pink_cotton_robe` | `base-clothing:blush_pink_cotton_robe` |
| `clothing:bronze_silk_blouse` | `base-clothing:bronze_silk_blouse` |
| `clothing:brown_suede_loafers` | `base-clothing:brown_suede_loafers` |
| `clothing:charcoal_wool_tshirt` | `base-clothing:charcoal_wool_tshirt` |
| `clothing:cotton_twill_trousers` | `base-clothing:cotton_twill_trousers` |
| `clothing:cream_poets_shirt_billowing_sleeves` | `base-clothing:cream_poets_shirt_billowing_sleeves` |
| `clothing:croc_embossed_ankle_boots` | `base-clothing:croc_embossed_ankle_boots` |
| `clothing:dark_burgundy_long_sleeve_tshirt` | `base-clothing:dark_burgundy_long_sleeve_tshirt` |
| `clothing:dark_indigo_denim_jeans` | `base-clothing:dark_indigo_denim_jeans` |
| `clothing:dark_olive_high_rise_double_pleat_trousers` | `base-clothing:dark_olive_high_rise_double_pleat_trousers` |
| `clothing:digitigrade_foot_wraps_burgundy` | `base-clothing:digitigrade_foot_wraps_burgundy` |
| `clothing:fitted_black_leather_trousers` | `base-clothing:fitted_black_leather_trousers` |
| `clothing:fitted_burgundy_vest_brass_buttons` | `base-clothing:fitted_burgundy_vest_brass_buttons` |
| `clothing:flat_trainers` | `base-clothing:flat_trainers` |
| `clothing:forest_green_cotton_linen_button_down` | `base-clothing:forest_green_cotton_linen_button_down` |
| `clothing:full_length_black_velvet_gown` | `base-clothing:full_length_black_velvet_gown` |
| `clothing:fuzzy_pink_slippers` | `base-clothing:fuzzy_pink_slippers` |
| `clothing:giuseppe_zanotti_harmony_115_sandals_black_crystal` | `base-clothing:giuseppe_zanotti_harmony_115_sandals_black_crystal` |
| `clothing:graphite_wool_wide_leg_trousers` | `base-clothing:graphite_wool_wide_leg_trousers` |
| `clothing:heavy_brocade_vest_silver_serpentine` | `base-clothing:heavy_brocade_vest_silver_serpentine` |
| `clothing:high_compression_leggings` | `base-clothing:high_compression_leggings` |
| `clothing:high_waisted_pencil_skirt_black` | `base-clothing:high_waisted_pencil_skirt_black` |
| `clothing:knee_high_combat_boots` | `base-clothing:knee_high_combat_boots` |
| `clothing:leather_slippers` | `base-clothing:leather_slippers` |
| `clothing:leather_stiletto_pumps` | `base-clothing:leather_stiletto_pumps` |
| `clothing:manolo_blahnik_hangisi_flats_blush_satin` | `base-clothing:manolo_blahnik_hangisi_flats_blush_satin` |
| `clothing:mint_green_cotton_nightgown_daisies` | `base-clothing:mint_green_cotton_nightgown_daisies` |
| `clothing:navy_cotton_tank_top` | `base-clothing:navy_cotton_tank_top` |
| `clothing:nude_leather_ankle_tie_sandals` | `base-clothing:nude_leather_ankle_tie_sandals` |
| `clothing:orange_cotton_short_shorts` | `base-clothing:orange_cotton_short_shorts` |
| `clothing:pale_blue_oxford_button_down` | `base-clothing:pale_blue_oxford_button_down` |
| `clothing:pink_cotton_shorts_white_piping` | `base-clothing:pink_cotton_shorts_white_piping` |
| `clothing:pink_off_shoulder_crop_top` | `base-clothing:pink_off_shoulder_crop_top` |
| `clothing:pink_short_flared_skirt` | `base-clothing:pink_short_flared_skirt` |
| `clothing:red_compression_racerback_tank` | `base-clothing:red_compression_racerback_tank` |
| `clothing:red_matte_lycra_high_waist_bike_shorts` | `base-clothing:red_matte_lycra_high_waist_bike_shorts` |
| `clothing:red_satin_shawl_robe` | `base-clothing:red_satin_shawl_robe` |
| `clothing:ribbed_cotton_tank_slim_red` | `base-clothing:ribbed_cotton_tank_slim_red` |
| `clothing:saint_laurent_anja_105_pumps_black_patent` | `base-clothing:saint_laurent_anja_105_pumps_black_patent` |
| `clothing:sand_beige_cotton_chinos` | `base-clothing:sand_beige_cotton_chinos` |
| `clothing:sand_silk_wrap_dress` | `base-clothing:sand_silk_wrap_dress` |
| `clothing:sand_suede_chukka_boots` | `base-clothing:sand_suede_chukka_boots` |
| `clothing:shale_gray_nylon_field_pants` | `base-clothing:shale_gray_nylon_field_pants` |
| `clothing:shawl_collar_blush_pink_robe` | `base-clothing:shawl_collar_blush_pink_robe` |
| `clothing:slate_gray_wool_long_sleeve_top` | `base-clothing:slate_gray_wool_long_sleeve_top` |
| `clothing:soft_gray_sweatpants` | `base-clothing:soft_gray_sweatpants` |
| `clothing:structured_bodice_deep_crimson_steel_boning` | `base-clothing:structured_bodice_deep_crimson_steel_boning` |
| `clothing:thigh_high_steel_tipped_boots` | `base-clothing:thigh_high_steel_tipped_boots` |
| `clothing:versace_barocco_black_gold_slip_dress` | `base-clothing:versace_barocco_black_gold_slip_dress` |
| `clothing:white_cotton_crew_tshirt` | `base-clothing:white_cotton_crew_tshirt` |
| `clothing:white_cotton_linen_trousers` | `base-clothing:white_cotton_linen_trousers` |
| `clothing:white_cotton_shift_dress` | `base-clothing:white_cotton_shift_dress` |
| `clothing:white_leather_sneakers` | `base-clothing:white_leather_sneakers` |
| `clothing:white_platform_sneakers` | `base-clothing:white_platform_sneakers` |
| `clothing:white_slippers_bow_detail` | `base-clothing:white_slippers_bow_detail` |
| `clothing:ysl_black_tuxedo_trousers` | `base-clothing:ysl_black_tuxedo_trousers` |
| `clothing:zimmermann_powder_pink_linen_midi_dress` | `base-clothing:zimmermann_powder_pink_linen_midi_dress` |

---

## Migration Phases

### Phase 0: Infrastructure Setup (1 PR)

**Objective:** Create empty mod structures and update load order.

**Tasks:**

1. Create directory structure:
   ```
   data/mods/accessories/
   ├── mod-manifest.json
   └── entities/
       └── definitions/

   data/mods/underwear/
   ├── mod-manifest.json
   └── entities/
       └── definitions/

   data/mods/outer-clothing/
   ├── mod-manifest.json
   └── entities/
       └── definitions/

   data/mods/base-clothing/
   ├── mod-manifest.json
   └── entities/
       └── definitions/
   ```

2. Create mod-manifest.json for each (using template above, empty definitions array)

3. Update `data/game.json` to include new mods after `clothing`:
   ```json
   "mods": [
     ...
     "clothing",
     "underwear",
     "base-clothing",
     "outer-clothing",
     "accessories",
     "armor",
     ...
   ]
   ```

**Validation:**
```bash
npm run validate
npm run test:ci
```

**Rollback:** Delete new directories, revert game.json.

---

### Phase 1: Accessories Migration (3 sub-PRs)

**Why first?** Smallest layer (14 items), lowest risk.

#### Phase 1a: Create Accessory Entities

1. Copy 14 entity files to `data/mods/accessories/entities/definitions/`
2. Update `id` field in each file from `clothing:*` to `accessories:*`
3. Update `data/mods/accessories/mod-manifest.json` with definitions list

**Validation:** `npm run validate`

#### Phase 1b: Update Accessory References

**Files requiring updates:**

| File | References to Update |
|------|---------------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | `black_tactical_work_belt` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | `dark_brown_leather_belt` |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | `black_leather_collar_silver_bell` |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | `black_tactical_work_belt`, `slate_nylon_baseball_cap` |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | `black_tactical_work_belt`, `slate_nylon_baseball_cap` |
| `data/mods/fantasy/mod-manifest.json` | Add `accessories` dependency |
| `data/mods/patrol/mod-manifest.json` | Add `accessories` dependency |

**Search/Replace pattern:**
```
Find: "clothing:black_tactical_work_belt"
Replace: "accessories:black_tactical_work_belt"
```

**Validation:** `npm run validate && npm run test:ci`

#### Phase 1c: Remove Old Accessory Entities

1. Delete 14 entity files from `data/mods/clothing/entities/definitions/`
2. Update `data/mods/clothing/mod-manifest.json` to remove entries

**Validation:** `npm run validate && npm run test:ci`

---

### Phase 2: Outer Clothing Migration (3 sub-PRs)

#### Phase 2a: Create Outer Entities

1. Copy 10 entity files to `data/mods/outer-clothing/entities/definitions/`
2. Update `id` field from `clothing:*` to `outer-clothing:*`
3. Update manifest

#### Phase 2b: Update Outer References

**Files requiring updates:**

| File | References to Update |
|------|---------------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | `battle_scarred_leather_jacket` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | `leather_work_apron` |
| `data/mods/fantasy/mod-manifest.json` | Add `outer-clothing` dependency |

**Validation:** `npm run validate && npm run test:ci`

#### Phase 2c: Remove Old Outer Entities

1. Delete 10 entity files from clothing mod
2. Update clothing manifest

---

### Phase 3: Underwear Migration (3 sub-PRs)

#### Phase 3a: Create Underwear Entities

1. Copy 33 entity files to `data/mods/underwear/entities/definitions/`
2. Update `id` field from `clothing:*` to `underwear:*`
3. Update manifest

#### Phase 3b: Update Underwear References

**Files requiring updates:**

| File | References to Update |
|------|---------------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | `graphite_wool_briefs`, `charcoal_nylon_sports_bra`, `dark_gray_wool_boot_socks` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | `graphite_wool_briefs`, `dark_gray_wool_boot_socks` |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | `graphite_wool_briefs`, `dark_gray_wool_boot_socks` |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | `charcoal_nylon_sports_bra`, `graphite_wool_briefs`, `dark_gray_wool_boot_socks` |
| `data/mods/fantasy/mod-manifest.json` | Add `underwear` dependency |
| `data/mods/patrol/mod-manifest.json` | Add `underwear` dependency |

#### Phase 3c: Remove Old Underwear Entities

1. Delete 33 entity files from clothing mod
2. Update clothing manifest

---

### Phase 4: Base Clothing Migration (3-4 sub-PRs)

**Largest layer (68 items).** Consider splitting into sub-phases by category:
- Phase 4a-1: Tops (~20 items)
- Phase 4a-2: Bottoms (~20 items)
- Phase 4a-3: Footwear (~20 items)
- Phase 4a-4: Dresses/Full outfits (~8 items)

#### Phase 4a: Create Base Entities

1. Copy 68 entity files to `data/mods/base-clothing/entities/definitions/`
2. Update `id` field from `clothing:*` to `base-clothing:*`
3. Update manifest

#### Phase 4b: Update Base References

**Files requiring updates:**

| File | References to Update |
|------|---------------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | `shale_gray_nylon_field_pants`, `black_leather_duty_boots` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | `shale_gray_nylon_field_pants`, `charcoal_wool_tshirt`, `black_leather_duty_boots` |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | `cream_poets_shirt_billowing_sleeves`, `black_breeches_tapered_knee`, `digitigrade_foot_wraps_burgundy` |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | `shale_gray_nylon_field_pants`, `charcoal_wool_tshirt`, `black_leather_duty_boots` |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | `shale_gray_nylon_field_pants`, `black_leather_duty_boots` |
| `data/mods/fantasy/mod-manifest.json` | Add `base-clothing` dependency |
| `data/mods/patrol/mod-manifest.json` | Add `base-clothing` dependency |

#### Phase 4c: Remove Old Base Entities

1. Delete 68 entity files from clothing mod
2. Update clothing manifest

---

## Reference Update Checklist

### Recipe Files Requiring Updates

| File | Total Refs | Items by Layer |
|------|------------|----------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | 7 | underwear: 3, base: 2, outer: 1, accessories: 1 |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | 7 | underwear: 2, base: 3, outer: 1, accessories: 1 |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | 4 | base: 3, accessories: 1 |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | 7 | underwear: 2, base: 3, accessories: 2 |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | 7 | underwear: 3, base: 2, accessories: 2 |

**Total recipe references: 32**

### Mod Manifests Requiring Dependency Updates

After all phases complete, these mods need clothing layer dependencies:

| Mod | New Dependencies |
|-----|-----------------|
| `fantasy` | `underwear`, `base-clothing`, `outer-clothing`, `accessories` |
| `patrol` | `underwear`, `base-clothing`, `accessories` |

---

## Validation Commands

Run after each sub-phase:

```bash
# Schema and mod validation
npm run validate

# Full test suite
npm run test:ci

# Integration tests specifically
npm run test:integration
```

---

## Rollback Strategy

### Per-Phase Rollback

Each phase can be rolled back independently:

1. **Entity creation phase**: Delete new mod entity files, revert manifest
2. **Reference update phase**: Git revert the recipe/manifest changes
3. **Entity removal phase**: Restore deleted files from git history

### Complete Rollback

```bash
git reset --hard <pre-migration-commit>
```

---

## Post-Migration Verification

After all phases complete:

1. **Verify clothing mod has no entities:**
   ```bash
   ls data/mods/clothing/entities/definitions/
   # Should be empty
   ```

2. **Verify entity counts:**
   - `underwear`: 33 entities
   - `base-clothing`: 68 entities
   - `outer-clothing`: 10 entities
   - `accessories`: 14 entities

3. **Run full validation:**
   ```bash
   npm run validate
   npm run test:ci
   npm run test:e2e
   ```

4. **Test character creation:**
   - Create a character using fantasy/patrol recipes
   - Verify clothing entities are properly equipped

---

## Timeline Estimate

| Phase | Items | Est. Time | PRs |
|-------|-------|-----------|-----|
| Phase 0: Infrastructure | - | 1 hour | 1 |
| Phase 1: Accessories | 14 | 3 hours | 3 |
| Phase 2: Outer | 10 | 2 hours | 3 |
| Phase 3: Underwear | 33 | 4 hours | 3 |
| Phase 4: Base | 68 | 6 hours | 3-4 |
| **Total** | **125** | **~16 hours** | **13-14 PRs** |

---

## Files Summary

### Files to Create

- `data/mods/underwear/mod-manifest.json`
- `data/mods/underwear/entities/definitions/*.entity.json` (33 files)
- `data/mods/base-clothing/mod-manifest.json`
- `data/mods/base-clothing/entities/definitions/*.entity.json` (68 files)
- `data/mods/outer-clothing/mod-manifest.json`
- `data/mods/outer-clothing/entities/definitions/*.entity.json` (10 files)
- `data/mods/accessories/mod-manifest.json`
- `data/mods/accessories/entities/definitions/*.entity.json` (14 files)

### Files to Modify

- `data/game.json` - Add 4 new mods
- `data/mods/clothing/mod-manifest.json` - Remove 125 entity references
- `data/mods/fantasy/mod-manifest.json` - Add dependencies
- `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` - Update 7 refs
- `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` - Update 7 refs
- `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` - Update 4 refs
- `data/mods/patrol/mod-manifest.json` - Add dependencies
- `data/mods/patrol/recipes/dylan_crace.recipe.json` - Update 7 refs
- `data/mods/patrol/recipes/len_amezua.recipe.json` - Update 7 refs

### Files to Delete

- `data/mods/clothing/entities/definitions/*.entity.json` (125 files, moved to new mods)
