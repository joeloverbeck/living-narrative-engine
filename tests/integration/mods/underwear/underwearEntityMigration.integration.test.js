/**
 * @file Integration tests for CLOLAYMIG-008 & CLOLAYMIG-010: Underwear entity migration
 * Validates that underwear entities were correctly created in the underwear mod
 * and removed from the clothing mod (cleanup)
 * @see tickets/CLOLAYMIG-008-underwear-create-entities.md
 * @see tickets/CLOLAYMIG-010-underwear-cleanup.md
 */

import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('CLOLAYMIG-008 & CLOLAYMIG-010: Underwear Entity Migration', () => {
  const underwearModPath = path.resolve('./data/mods/underwear');
  const clothingModPath = path.resolve('./data/mods/clothing');
  const underwearEntitiesPath = path.join(underwearModPath, 'entities/definitions');
  const clothingEntitiesPath = path.join(clothingModPath, 'entities/definitions');

  // Full list of 33 underwear entities per CLOLAYMIG-008
  const underwearEntityFiles = [
    'aubade_bahia_balconette_bra_pale_pink.entity.json',
    'black_cotton_boxer_briefs.entity.json',
    'black_leather_codpiece.entity.json',
    'black_longline_sports_bra_medium_support.entity.json',
    'charcoal_nylon_sports_bra.entity.json',
    'cream_cotton_high_rise_briefs.entity.json',
    'cream_cotton_soft_cup_bralette.entity.json',
    'dark_gray_wool_boot_socks.entity.json',
    'fitted_navy_cotton_boxer_briefs.entity.json',
    'fuzzy_peach_socks.entity.json',
    'graphite_wool_briefs.entity.json',
    'gray_ribknit_cotton_socks.entity.json',
    'high_waisted_ivory_tap_pants.entity.json',
    'ivory_plunge_balconette_bra_french_lace.entity.json',
    'la_perla_black_silk_triangle_bra.entity.json',
    'lavender_fitted_camisole_lace_trim.entity.json',
    'matte_sheer_tights_smoke_black.entity.json',
    'nude_microfiber_seamless_thong.entity.json',
    'nude_thong.entity.json',
    'nylon_sports_bra.entity.json',
    'pink_fuzzy_socks.entity.json',
    'power_mesh_boxer_brief.entity.json',
    'red_satin_bikini_briefs.entity.json',
    'satin_cowl_neck_camisole.entity.json',
    'seamless_plunge_bra_microfiber_nude.entity.json',
    'spanx_high_waisted_control_briefs.entity.json',
    'underwired_plunge_bra_nude_silk.entity.json',
    'white_ankle_socks_ruffled_edges.entity.json',
    'white_cotton_panties.entity.json',
    'white_knee_high_socks_pink_bows.entity.json',
    'white_midcrew_cotton_athletic_socks.entity.json',
    'white_terry_lined_grip_socks.entity.json',
    'white_thigh_high_socks_pink_hearts.entity.json',
  ];

  describe('Entity File Existence', () => {
    it('should have underwear entity files', async () => {
      const files = await fs.readdir(underwearEntitiesPath);
      const entityFiles = files.filter((f) => f.endsWith('.entity.json'));

      // At least the original 33 entities from migration should exist
      expect(entityFiles.length).toBeGreaterThanOrEqual(33);
    });

    it('should have all expected entity files', async () => {
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
        const exists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);

        expect(exists).toBe(true);
      }
    });
  });

  describe('Entity ID Migration', () => {
    it('should have underwear: prefix for all entity IDs', async () => {
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.id).toMatch(/^underwear:/);
      }
    });

    it('should NOT have clothing: prefix for any entity ID', async () => {
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.id).not.toMatch(/^clothing:/);
      }
    });

    it('should preserve entity name after namespace in ID', async () => {
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
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

      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.$schema).toBe(expectedSchema);
      }
    });

    it('should have required clothing:wearable component with underwear layer', async () => {
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        expect(entity.components).toBeDefined();
        expect(entity.components['clothing:wearable']).toBeDefined();
        expect(entity.components['clothing:wearable'].layer).toBe('underwear');
      }
    });

    it('should have core:material component', async () => {
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
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
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
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
    it('should have underwear mod manifest with all 33 entity definitions', async () => {
      const manifestPath = path.join(underwearModPath, 'mod-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      expect(manifest.id).toBe('underwear');
      expect(manifest.content.entities.definitions).toHaveLength(33);
    });

    it('should reference all entity files in manifest', async () => {
      const manifestPath = path.join(underwearModPath, 'mod-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      for (const filename of underwearEntityFiles) {
        expect(manifest.content.entities.definitions).toContain(filename);
      }
    });
  });

  // CLOLAYMIG-010: Cleanup validation - ensure underwear entities removed from clothing mod
  describe('CLOLAYMIG-010: Clothing Mod Cleanup', () => {
    it('should NOT have any underwear entity files in clothing mod', async () => {
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(clothingEntitiesPath, filename);
        const exists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);

        expect(exists).toBe(false);
      }
    });

    it('should NOT reference underwear entities in clothing mod manifest', async () => {
      const manifestPath = path.join(clothingModPath, 'mod-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      for (const filename of underwearEntityFiles) {
        expect(manifest.content.entities.definitions).not.toContain(filename);
      }
    });

    it('should have no duplicate entity IDs between clothing and underwear mods', async () => {
      // Get all entity IDs from underwear mod
      const underwearIds = new Set();
      for (const filename of underwearEntityFiles) {
        const filePath = path.join(underwearEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);
        underwearIds.add(entity.id);
      }

      // Check if clothing entities directory exists - if not, migration is complete
      // (clothing entities were split into base-clothing, outer-clothing, etc.)
      const clothingEntitiesDirExists = await fs
        .access(clothingEntitiesPath)
        .then(() => true)
        .catch(() => false);

      if (!clothingEntitiesDirExists) {
        // Migration complete - clothing mod no longer has entities directory
        return;
      }

      // Get all entity IDs from clothing mod and check for overlap
      const clothingFiles = await fs.readdir(clothingEntitiesPath);
      const clothingEntityFiles = clothingFiles.filter((f) =>
        f.endsWith('.entity.json')
      );

      for (const filename of clothingEntityFiles) {
        const filePath = path.join(clothingEntitiesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const entity = JSON.parse(content);

        // No clothing entity should have an ID that's also in underwear mod
        expect(underwearIds.has(entity.id)).toBe(false);
      }
    });
  });
});
