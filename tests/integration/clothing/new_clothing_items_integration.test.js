/**
 * @file Integration tests for new clothing items
 * Tests loading, equipment system integration, layering rules, and pattern component functionality
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('New Clothing Items Integration Tests', () => {
  // Base clothing items migrated to base-clothing mod (CLOLAYMIG-013)
  const baseClothingFiles = [
    'pink_off_shoulder_crop_top.entity.json',
    'pink_short_flared_skirt.entity.json',
    'white_platform_sneakers.entity.json',
  ];

  // Underwear items migrated to underwear mod (CLOLAYMIG-010)
  const underwearFiles = [
    'white_thigh_high_socks_pink_hearts.entity.json',
    'white_cotton_panties.entity.json',
  ];

  describe('Entity Definition Files', () => {
    const newClothingFiles = [...baseClothingFiles];

    it('should have all new clothing entity definition files', () => {
      // Base clothing items migrated to base-clothing mod (CLOLAYMIG-013)
      for (const filename of newClothingFiles) {
        const filePath = join(
          process.cwd(),
          'data/mods/base-clothing/entities/definitions',
          filename
        );

        // Check file exists
        let fileExists = false;
        try {
          readFileSync(filePath, 'utf8');
          fileExists = true;
        } catch (err) {
          fileExists = false;
        }

        expect(fileExists).toBe(true);
      }
    });

    it('should have valid JSON structure in all entity files', () => {
      // Base clothing items migrated to base-clothing mod (CLOLAYMIG-013)
      for (const filename of newClothingFiles) {
        const filePath = join(
          process.cwd(),
          'data/mods/base-clothing/entities/definitions',
          filename
        );

        const content = readFileSync(filePath, 'utf8');
        let parsed;

        expect(() => {
          parsed = JSON.parse(content);
        }).not.toThrow();

        // Check basic structure
        expect(parsed).toHaveProperty('id');
        expect(parsed).toHaveProperty('components');
        expect(parsed.components).toHaveProperty('clothing:wearable');
        expect(parsed.components).toHaveProperty('core:name');
        expect(parsed.components).toHaveProperty('core:material');
      }
    });

    it('should have correct component structure for pink off-shoulder crop top', () => {
      // Entity migrated to base-clothing mod (CLOLAYMIG-013)
      const filePath = join(
        __dirname,
        '../../../data/mods/base-clothing/entities/definitions',
        'pink_off_shoulder_crop_top.entity.json'
      );

      const content = readFileSync(filePath, 'utf8');
      const entityData = JSON.parse(content);

      expect(entityData.id).toBe('base-clothing:pink_off_shoulder_crop_top');
      expect(entityData.components['clothing:wearable']).toEqual({
        layer: 'base',
        equipmentSlots: {
          primary: 'torso_upper',
          secondary: ['left_arm_clothing', 'right_arm_clothing'],
        },
        allowedLayers: ['underwear', 'base'],
      });
      expect(entityData.components['core:material'].material).toBe('cotton');
      expect(entityData.components['descriptors:color_basic'].color).toBe(
        'pink'
      );
    });

    it('should have correct component structure for pink skirt', () => {
      // Entity migrated to base-clothing mod (CLOLAYMIG-013)
      const filePath = join(
        __dirname,
        '../../../data/mods/base-clothing/entities/definitions',
        'pink_short_flared_skirt.entity.json'
      );

      const content = readFileSync(filePath, 'utf8');
      const entityData = JSON.parse(content);

      expect(entityData.id).toBe('base-clothing:pink_short_flared_skirt');
      expect(entityData.components['clothing:wearable']).toEqual({
        layer: 'base',
        equipmentSlots: {
          primary: 'torso_lower',
        },
        allowedLayers: ['underwear', 'base'],
      });
      expect(entityData.components['core:material'].material).toBe('cotton');
      expect(entityData.components['descriptors:color_basic'].color).toBe(
        'pink'
      );
    });

    it('should have correct component structure for white thigh-high socks (underwear mod)', () => {
      const filePath = join(
        __dirname,
        '../../../data/mods/underwear/entities/definitions',
        'white_thigh_high_socks_pink_hearts.entity.json'
      );

      const content = readFileSync(filePath, 'utf8');
      const entityData = JSON.parse(content);

      expect(entityData.id).toBe('underwear:white_thigh_high_socks_pink_hearts');
      expect(entityData.components['clothing:wearable']).toEqual({
        layer: 'underwear',
        equipmentSlots: {
          primary: 'feet',
        },
        allowedLayers: ['underwear'],
      });
      expect(entityData.components['core:material'].material).toBe('cotton');
      expect(entityData.components['descriptors:color_basic'].color).toBe(
        'white'
      );
      expect(entityData.components['descriptors:pattern'].pattern).toBe(
        'heart'
      );
    });

    it('should have correct component structure for white cotton panties (underwear mod)', () => {
      const filePath = join(
        __dirname,
        '../../../data/mods/underwear/entities/definitions',
        'white_cotton_panties.entity.json'
      );

      const content = readFileSync(filePath, 'utf8');
      const entityData = JSON.parse(content);

      expect(entityData.id).toBe('underwear:white_cotton_panties');
      expect(entityData.components['clothing:wearable']).toEqual({
        layer: 'underwear',
        equipmentSlots: {
          primary: 'torso_lower',
        },
        allowedLayers: ['underwear'],
      });
      expect(entityData.components['core:material'].material).toBe('cotton');
      expect(entityData.components['descriptors:color_basic'].color).toBe(
        'white'
      );
    });

    it('should have correct component structure for white platform sneakers', () => {
      // Entity migrated to base-clothing mod (CLOLAYMIG-013)
      const filePath = join(
        __dirname,
        '../../../data/mods/base-clothing/entities/definitions',
        'white_platform_sneakers.entity.json'
      );

      const content = readFileSync(filePath, 'utf8');
      const entityData = JSON.parse(content);

      expect(entityData.id).toBe('base-clothing:white_platform_sneakers');
      expect(entityData.components['clothing:wearable']).toEqual({
        layer: 'base',
        equipmentSlots: {
          primary: 'feet',
        },
        allowedLayers: ['underwear', 'base'],
      });
      expect(entityData.components['core:material'].material).toBe('leather');
      expect(entityData.components['descriptors:color_basic'].color).toBe(
        'white'
      );
    });
  });

  describe('Component Definition Files', () => {
    it('should have pattern component with heart pattern', () => {
      const filePath = join(
        __dirname,
        '../../../data/mods/descriptors/components',
        'pattern.component.json'
      );

      const content = readFileSync(filePath, 'utf8');
      const componentData = JSON.parse(content);

      expect(componentData.id).toBe('descriptors:pattern');
      expect(componentData.dataSchema.properties.pattern.enum).toContain(
        'heart'
      );
      expect(componentData.dataSchema.properties.pattern.enum).toContain(
        'solid'
      );
      expect(componentData.dataSchema.properties.pattern.default).toBe('solid');
    });

    it('should have color_basic component with pink color', () => {
      const filePath = join(
        __dirname,
        '../../../data/mods/descriptors/components',
        'color_basic.component.json'
      );

      const content = readFileSync(filePath, 'utf8');
      const componentData = JSON.parse(content);

      expect(componentData.id).toBe('descriptors:color_basic');
      expect(componentData.dataSchema.properties.color.enum).toContain('pink');
      expect(componentData.dataSchema.properties.color.enum).toContain('white');
    });
  });

  describe('Layering System Validation', () => {
    it('should respect underwear and base layering rules', () => {
      // Underwear items in underwear mod (CLOLAYMIG-010)
      for (const filename of underwearFiles) {
        const filePath = join(
          process.cwd(),
          'data/mods/underwear/entities/definitions',
          filename
        );
        const content = readFileSync(filePath, 'utf8');
        const entityData = JSON.parse(content);

        expect(entityData.components['clothing:wearable'].layer).toBe(
          'underwear'
        );
        expect(
          entityData.components['clothing:wearable'].allowedLayers
        ).toEqual(['underwear']);
      }

      // Base layer items migrated to base-clothing mod (CLOLAYMIG-013)
      for (const filename of baseClothingFiles) {
        const filePath = join(
          process.cwd(),
          'data/mods/base-clothing/entities/definitions',
          filename
        );
        const content = readFileSync(filePath, 'utf8');
        const entityData = JSON.parse(content);

        expect(entityData.components['clothing:wearable'].layer).toBe('base');
        expect(
          entityData.components['clothing:wearable'].allowedLayers
        ).toContain('underwear');
        expect(
          entityData.components['clothing:wearable'].allowedLayers
        ).toContain('base');
      }
    });

    it('should allow complete outfit composition without slot conflicts', () => {
      // Underwear items from underwear mod
      const underwearOutfitItems = [
        {
          file: 'white_cotton_panties.entity.json',
          expectedSlot: 'torso_lower',
          layer: 'underwear',
          mod: 'underwear',
        },
        {
          file: 'white_thigh_high_socks_pink_hearts.entity.json',
          expectedSlot: 'feet',
          layer: 'underwear',
          mod: 'underwear',
        },
      ];

      // Base clothing items migrated to base-clothing mod (CLOLAYMIG-013)
      const baseOutfitItems = [
        {
          file: 'pink_off_shoulder_crop_top.entity.json',
          expectedSlot: 'torso_upper',
          layer: 'base',
          mod: 'base-clothing',
        },
        {
          file: 'pink_short_flared_skirt.entity.json',
          expectedSlot: 'torso_lower',
          layer: 'base',
          mod: 'base-clothing',
        },
        {
          file: 'white_platform_sneakers.entity.json',
          expectedSlot: 'feet',
          layer: 'base',
          mod: 'base-clothing',
        },
      ];

      const outfitItems = [...underwearOutfitItems, ...baseOutfitItems];

      const slotsByLayer = {
        underwear: [],
        base: [],
      };

      for (const item of outfitItems) {
        const filePath = join(
          process.cwd(),
          `data/mods/${item.mod}/entities/definitions`,
          item.file
        );
        const content = readFileSync(filePath, 'utf8');
        const entityData = JSON.parse(content);

        const slot =
          entityData.components['clothing:wearable'].equipmentSlots.primary;
        expect(slot).toBe(item.expectedSlot);

        slotsByLayer[item.layer].push(slot);
      }

      // Check for no conflicts within each layer
      const underwearSlots = new Set(slotsByLayer.underwear);
      expect(underwearSlots.size).toBe(slotsByLayer.underwear.length); // No duplicates

      const baseSlots = new Set(slotsByLayer.base);
      expect(baseSlots.size).toBe(slotsByLayer.base.length); // No duplicates

      // Verify layering allows overlaps (e.g., panties and skirt both on torso_lower)
      expect(slotsByLayer.underwear).toContain('torso_lower');
      expect(slotsByLayer.base).toContain('torso_lower');
      expect(slotsByLayer.underwear).toContain('feet');
      expect(slotsByLayer.base).toContain('feet');
    });
  });

  describe('Material Properties', () => {
    it('should use appropriate materials for each item', () => {
      // Base clothing materials migrated to base-clothing mod (CLOLAYMIG-013)
      const clothingMaterialExpectations = [
        {
          file: 'pink_off_shoulder_crop_top.entity.json',
          expectedMaterial: 'cotton',
        },
        {
          file: 'pink_short_flared_skirt.entity.json',
          expectedMaterial: 'cotton',
        },
        {
          file: 'white_platform_sneakers.entity.json',
          expectedMaterial: 'leather',
        },
      ];

      // Underwear materials (underwear mod)
      const underwearMaterialExpectations = [
        {
          file: 'white_thigh_high_socks_pink_hearts.entity.json',
          expectedMaterial: 'cotton',
        },
        {
          file: 'white_cotton_panties.entity.json',
          expectedMaterial: 'cotton',
        },
      ];

      for (const item of clothingMaterialExpectations) {
        const filePath = join(
          process.cwd(),
          'data/mods/base-clothing/entities/definitions',
          item.file
        );
        const content = readFileSync(filePath, 'utf8');
        const entityData = JSON.parse(content);

        expect(entityData.components['core:material'].material).toBe(
          item.expectedMaterial
        );
      }

      for (const item of underwearMaterialExpectations) {
        const filePath = join(
          process.cwd(),
          'data/mods/underwear/entities/definitions',
          item.file
        );
        const content = readFileSync(filePath, 'utf8');
        const entityData = JSON.parse(content);

        expect(entityData.components['core:material'].material).toBe(
          item.expectedMaterial
        );
      }
    });
  });
});
