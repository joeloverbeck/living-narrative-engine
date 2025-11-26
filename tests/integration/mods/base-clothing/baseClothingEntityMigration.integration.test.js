/**
 * @file Integration tests for CLOLAYMIG-011: Base-clothing entity migration
 * Validates that base-clothing entities were correctly created in the base-clothing mod
 * with correct ID prefixes
 * @see tickets/CLOLAYMIG-011-base-clothing-create-entities.md
 */

import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('CLOLAYMIG-011: Base-Clothing Entity Migration', () => {
  const baseClothingModPath = path.resolve('./data/mods/base-clothing');
  const clothingModPath = path.resolve('./data/mods/clothing');
  const baseClothingEntitiesPath = path.join(
    baseClothingModPath,
    'entities/definitions'
  );
  const clothingEntitiesPath = path.join(
    clothingModPath,
    'entities/definitions'
  );

  // Full list of 68 base-clothing entities per CLOLAYMIG-011
  const baseClothingEntityFiles = [
    'baby_blue_crop_tank.entity.json',
    'black_athletic_sneakers.entity.json',
    'black_breeches_tapered_knee.entity.json',
    'black_cargo_joggers.entity.json',
    'black_foam_slide_sandals.entity.json',
    'black_leather_duty_boots.entity.json',
    'black_running_shorts_red_trim.entity.json',
    'black_silk_robe_kimono_sleeves.entity.json',
    'black_stretch_silk_bodysuit.entity.json',
    'black_trail_running_shoes.entity.json',
    'block_heel_slingbacks_leather_taupe.entity.json',
    'blush_pink_cotton_robe.entity.json',
    'bronze_silk_blouse.entity.json',
    'brown_suede_loafers.entity.json',
    'charcoal_wool_tshirt.entity.json',
    'cotton_twill_trousers.entity.json',
    'cream_poets_shirt_billowing_sleeves.entity.json',
    'croc_embossed_ankle_boots.entity.json',
    'dark_burgundy_long_sleeve_tshirt.entity.json',
    'dark_indigo_denim_jeans.entity.json',
    'dark_olive_high_rise_double_pleat_trousers.entity.json',
    'digitigrade_foot_wraps_burgundy.entity.json',
    'fitted_black_leather_trousers.entity.json',
    'fitted_burgundy_vest_brass_buttons.entity.json',
    'flat_trainers.entity.json',
    'forest_green_cotton_linen_button_down.entity.json',
    'full_length_black_velvet_gown.entity.json',
    'fuzzy_pink_slippers.entity.json',
    'giuseppe_zanotti_harmony_115_sandals_black_crystal.entity.json',
    'graphite_wool_wide_leg_trousers.entity.json',
    'heavy_brocade_vest_silver_serpentine.entity.json',
    'high_compression_leggings.entity.json',
    'high_waisted_pencil_skirt_black.entity.json',
    'knee_high_combat_boots.entity.json',
    'leather_slippers.entity.json',
    'leather_stiletto_pumps.entity.json',
    'manolo_blahnik_hangisi_flats_blush_satin.entity.json',
    'mint_green_cotton_nightgown_daisies.entity.json',
    'navy_cotton_tank_top.entity.json',
    'nude_leather_ankle_tie_sandals.entity.json',
    'orange_cotton_short_shorts.entity.json',
    'pale_blue_oxford_button_down.entity.json',
    'pink_cotton_shorts_white_piping.entity.json',
    'pink_off_shoulder_crop_top.entity.json',
    'pink_short_flared_skirt.entity.json',
    'red_compression_racerback_tank.entity.json',
    'red_matte_lycra_high_waist_bike_shorts.entity.json',
    'red_satin_shawl_robe.entity.json',
    'ribbed_cotton_tank_slim_red.entity.json',
    'saint_laurent_anja_105_pumps_black_patent.entity.json',
    'sand_beige_cotton_chinos.entity.json',
    'sand_silk_wrap_dress.entity.json',
    'sand_suede_chukka_boots.entity.json',
    'shale_gray_nylon_field_pants.entity.json',
    'shawl_collar_blush_pink_robe.entity.json',
    'slate_gray_wool_long_sleeve_top.entity.json',
    'soft_gray_sweatpants.entity.json',
    'structured_bodice_deep_crimson_steel_boning.entity.json',
    'thigh_high_steel_tipped_boots.entity.json',
    'versace_barocco_black_gold_slip_dress.entity.json',
    'white_cotton_crew_tshirt.entity.json',
    'white_cotton_linen_trousers.entity.json',
    'white_cotton_shift_dress.entity.json',
    'white_leather_sneakers.entity.json',
    'white_platform_sneakers.entity.json',
    'white_slippers_bow_detail.entity.json',
    'ysl_black_tuxedo_trousers.entity.json',
    'zimmermann_powder_pink_linen_midi_dress.entity.json',
  ];

  describe('Entity File Existence', () => {
    it('should have at least the expected base-clothing entity files', async () => {
      const files = await fs.readdir(baseClothingEntitiesPath);
      const entityFiles = files.filter((f) => f.endsWith('.entity.json'));

      // Should have at least the originally migrated entities (may grow over time)
      expect(entityFiles.length).toBeGreaterThanOrEqual(
        baseClothingEntityFiles.length
      );
    });

    it('should have all expected entity files', async () => {
      for (const filename of baseClothingEntityFiles) {
        const filePath = path.join(baseClothingEntitiesPath, filename);
        const exists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);

        expect(exists).toBe(true);
      }
    });
  });

  describe('Entity ID Migration', () => {
    it('should have base-clothing: prefix for all entity IDs', async () => {
      for (const filename of baseClothingEntityFiles) {
        const filePath = path.join(baseClothingEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.id).toMatch(/^base-clothing:/);
      }
    });

    it('should NOT have clothing: prefix for any entity ID', async () => {
      for (const filename of baseClothingEntityFiles) {
        const filePath = path.join(baseClothingEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.id).not.toMatch(/^clothing:/);
      }
    });

    it('should preserve entity name after namespace in ID', async () => {
      for (const filename of baseClothingEntityFiles) {
        const filePath = path.join(baseClothingEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        // Extract expected name from filename (remove .entity.json)
        const expectedName = filename.replace('.entity.json', '');
        const actualName = entity.id.split(':')[1];

        expect(actualName).toBe(expectedName);
      }
    });
  });

  describe('Entity Structure Preservation', () => {
    it('should have valid JSON schema reference', async () => {
      const expectedSchema =
        'schema://living-narrative-engine/entity-definition.schema.json';

      for (const filename of baseClothingEntityFiles) {
        const filePath = path.join(baseClothingEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.$schema).toBe(expectedSchema);
      }
    });

    it('should have required clothing:wearable component with base layer', async () => {
      for (const filename of baseClothingEntityFiles) {
        const filePath = path.join(baseClothingEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.components).toBeDefined();
        expect(entity.components['clothing:wearable']).toBeDefined();
        expect(entity.components['clothing:wearable'].layer).toBe('base');
      }
    });

    it('should have core:material component', async () => {
      for (const filename of baseClothingEntityFiles) {
        const filePath = path.join(baseClothingEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.components['core:material']).toBeDefined();
        expect(entity.components['core:material'].material).toBeDefined();
        expect(typeof entity.components['core:material'].material).toBe(
          'string'
        );
      }
    });

    it('should have core:name and core:description components', async () => {
      for (const filename of baseClothingEntityFiles) {
        const filePath = path.join(baseClothingEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.components['core:name']).toBeDefined();
        expect(entity.components['core:name'].text).toBeDefined();
        expect(entity.components['core:description']).toBeDefined();
        expect(entity.components['core:description'].text).toBeDefined();
      }
    });
  });

  describe('Mod Manifest', () => {
    it('should have base-clothing mod manifest with at least the expected entity definitions', async () => {
      const manifestPath = path.join(baseClothingModPath, 'mod-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      expect(manifest.id).toBe('base-clothing');
      // Should have at least the originally migrated entities (may grow over time)
      expect(manifest.content.entities.definitions.length).toBeGreaterThanOrEqual(
        baseClothingEntityFiles.length
      );
    });

    it('should reference all entity files in manifest', async () => {
      const manifestPath = path.join(baseClothingModPath, 'mod-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      for (const filename of baseClothingEntityFiles) {
        expect(manifest.content.entities.definitions).toContain(filename);
      }
    });

    it('should have correct dependencies including clothing mod', async () => {
      const manifestPath = path.join(baseClothingModPath, 'mod-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      const dependencyIds = manifest.dependencies.map((d) => d.id);
      expect(dependencyIds).toContain('clothing');
    });
  });

  describe('Post-Migration Cleanup Verification', () => {
    // Note: After CLOLAYMIG-013 (cleanup phase), entities have been removed from the
    // clothing mod and exist only in base-clothing mod with new ID prefix.
    it('should have no base-layer entities remaining in clothing mod', async () => {
      // Check that clothing mod no longer has these entity files
      let clothingEntityCount = 0;
      try {
        const clothingFiles = await fs.readdir(clothingEntitiesPath);
        clothingEntityCount = clothingFiles.filter((f) =>
          f.endsWith('.entity.json')
        ).length;
      } catch {
        // Directory may not exist or be empty - that's expected post-cleanup
        clothingEntityCount = 0;
      }

      // Clothing mod should have 0 entities (all migrated to layer-specific mods)
      expect(clothingEntityCount).toBe(0);
    });

    it('should have all entities exclusively in base-clothing mod with correct prefix', async () => {
      // Verify the sample file exists in base-clothing with correct ID
      const sampleFile = 'charcoal_wool_tshirt.entity.json';

      const baseClothingPath = path.join(baseClothingEntitiesPath, sampleFile);

      const baseClothingContent = await fs.readFile(baseClothingPath, 'utf8');
      const baseClothingEntity = JSON.parse(baseClothingContent);

      expect(baseClothingEntity.id).toBe('base-clothing:charcoal_wool_tshirt');
    });
  });
});
