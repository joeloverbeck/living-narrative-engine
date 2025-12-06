/**
 * @file Unit tests for new clothing item entity definitions
 * Tests pink/white clothing collection including off-shoulder crop top, flared skirt, thigh-high socks, panties, and platform sneakers
 *
 * Note: Entities have been migrated to layer-specific mods (CLOLAYMIG migration):
 * - Base layer items → base-clothing mod
 * - Underwear layer items → underwear mod
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';

describe('New Clothing Items Unit Tests', () => {
  let ajv;
  let baseClothingEntitySchema;
  let underwearEntitySchema;

  // Entity paths after migration (CLOLAYMIG-013)
  const baseClothingEntitiesPath =
    'data/mods/base-clothing/entities/definitions';
  const underwearEntitiesPath = 'data/mods/underwear/entities/definitions';

  beforeEach(() => {
    ajv = new Ajv({ strict: false });

    // Schema for base-clothing mod entities
    baseClothingEntitySchema = {
      type: 'object',
      required: ['$schema', 'id', 'description', 'components'],
      properties: {
        $schema: { type: 'string' },
        id: { type: 'string', pattern: '^base-clothing:' },
        description: { type: 'string', minLength: 1 },
        components: {
          type: 'object',
          required: [
            'clothing:wearable',
            'core:material',
            'core:name',
            'core:description',
          ],
          properties: {
            'clothing:wearable': {
              type: 'object',
              required: ['layer', 'equipmentSlots', 'allowedLayers'],
              properties: {
                layer: {
                  type: 'string',
                  enum: ['underwear', 'base', 'outer', 'accessories', 'armor'],
                },
                equipmentSlots: {
                  type: 'object',
                  required: ['primary'],
                  properties: {
                    primary: { type: 'string' },
                    secondary: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
                allowedLayers: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      'underwear',
                      'base',
                      'outer',
                      'accessories',
                      'armor',
                    ],
                  },
                },
              },
            },
            'core:material': {
              type: 'object',
              required: ['material'],
              properties: {
                material: {
                  type: 'string',
                  enum: [
                    'cotton',
                    'wool',
                    'denim',
                    'leather',
                    'linen',
                    'silk',
                    'calfskin',
                  ],
                },
              },
            },
            'core:name': {
              type: 'object',
              required: ['text'],
              properties: {
                text: { type: 'string', minLength: 1 },
              },
            },
            'core:description': {
              type: 'object',
              required: ['text'],
              properties: {
                text: { type: 'string', minLength: 10 },
              },
            },
            'descriptors:color_basic': {
              type: 'object',
              required: ['color'],
              properties: {
                color: {
                  type: 'string',
                  enum: [
                    'red',
                    'blue',
                    'green',
                    'yellow',
                    'orange',
                    'purple',
                    'brown',
                    'black',
                    'white',
                    'gray',
                    'pink',
                  ],
                },
              },
            },
            'descriptors:texture': {
              type: 'object',
              required: ['texture'],
              properties: {
                texture: {
                  type: 'string',
                  enum: [
                    'smooth',
                    'rough',
                    'silky',
                    'coarse',
                    'bumpy',
                    'velvety',
                    'rib-knit',
                    'rugged',
                    'scarred',
                  ],
                },
              },
            },
            'descriptors:pattern': {
              type: 'object',
              required: ['pattern'],
              properties: {
                pattern: {
                  type: 'string',
                  enum: [
                    'solid',
                    'striped',
                    'polka-dot',
                    'heart',
                    'floral',
                    'geometric',
                    'plaid',
                    'checked',
                  ],
                },
              },
            },
          },
        },
      },
    };

    // Schema for underwear mod entities
    underwearEntitySchema = {
      ...baseClothingEntitySchema,
      properties: {
        ...baseClothingEntitySchema.properties,
        id: { type: 'string', pattern: '^underwear:' },
      },
    };
  });

  describe('Pink Off-The-Shoulder Crop Top', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        baseClothingEntitiesPath,
        'pink_off_shoulder_crop_top.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(baseClothingEntitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
    });

    it('should have correct entity metadata', () => {
      expect(entity.id).toBe('base-clothing:pink_off_shoulder_crop_top');
      expect(entity.description).toBe('Pink off-the-shoulder crop top');
      expect(entity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have correct wearable properties', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.layer).toBe('base');
      expect(wearable.equipmentSlots.primary).toBe('torso_upper');
      expect(wearable.equipmentSlots.secondary).toEqual([
        'left_arm_clothing',
        'right_arm_clothing',
      ]);
      expect(wearable.allowedLayers).toEqual(['underwear', 'base']);
    });

    it('should have correct material and descriptors', () => {
      expect(entity.components['core:material'].material).toBe('cotton');
      expect(entity.components['descriptors:color_basic'].color).toBe('pink');
      expect(entity.components['descriptors:texture'].texture).toBe('smooth');
    });

    it('should have descriptive name and description', () => {
      expect(entity.components['core:name'].text).toBe(
        'off-the-shoulder crop top'
      );
      expect(entity.components['core:description'].text).toContain('pink');
      expect(entity.components['core:description'].text).toContain('cotton');
      expect(entity.components['core:description'].text).toContain(
        'off-the-shoulder'
      );
      expect(entity.components['core:description'].text).toContain('crop');
    });
  });

  describe('Pink Short Flared Skirt', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        baseClothingEntitiesPath,
        'pink_short_flared_skirt.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(baseClothingEntitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
    });

    it('should have correct entity metadata', () => {
      expect(entity.id).toBe('base-clothing:pink_short_flared_skirt');
      expect(entity.description).toBe('Pink short flared skirt');
    });

    it('should have correct wearable properties for lower body', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.layer).toBe('base');
      expect(wearable.equipmentSlots.primary).toBe('torso_lower');
      expect(wearable.equipmentSlots.secondary).toBeUndefined();
      expect(wearable.allowedLayers).toEqual(['underwear', 'base']);
    });

    it('should have correct material and descriptors', () => {
      expect(entity.components['core:material'].material).toBe('cotton');
      expect(entity.components['descriptors:color_basic'].color).toBe('pink');
      expect(entity.components['descriptors:texture'].texture).toBe('smooth');
    });

    it('should describe flared silhouette and short length', () => {
      expect(entity.components['core:description'].text).toContain('flared');
      expect(entity.components['core:description'].text).toContain('short');
      expect(entity.components['core:description'].text).toContain('pink');
      expect(entity.components['core:description'].text).toContain('cotton');
    });
  });

  describe('White Thigh-High Socks with Pink Hearts', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        underwearEntitiesPath,
        'white_thigh_high_socks_pink_hearts.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(underwearEntitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
    });

    it('should have correct entity metadata', () => {
      expect(entity.id).toBe('underwear:white_thigh_high_socks_pink_hearts');
      expect(entity.description).toBe(
        'White thigh-high socks with pink heart pattern'
      );
    });

    it('should be underwear layer for feet', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.layer).toBe('underwear');
      expect(wearable.equipmentSlots.primary).toBe('feet');
      expect(wearable.allowedLayers).toEqual(['underwear']);
    });

    it('should have pattern component with heart pattern', () => {
      expect(entity.components['descriptors:pattern']).toBeDefined();
      expect(entity.components['descriptors:pattern'].pattern).toBe('heart');
    });

    it('should have correct material and colors', () => {
      expect(entity.components['core:material'].material).toBe('cotton');
      expect(entity.components['descriptors:color_basic'].color).toBe('white');
      expect(entity.components['descriptors:texture'].texture).toBe('smooth');
    });

    it('should describe thigh-high length and heart pattern', () => {
      expect(entity.components['core:description'].text).toContain(
        'thigh-high'
      );
      expect(entity.components['core:description'].text).toContain('heart');
      expect(entity.components['core:description'].text).toContain('pink');
      expect(entity.components['core:description'].text).toContain('white');
    });
  });

  describe('White Cotton Panties', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        underwearEntitiesPath,
        'white_cotton_panties.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(underwearEntitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
    });

    it('should have correct entity metadata', () => {
      expect(entity.id).toBe('underwear:white_cotton_panties');
      expect(entity.description).toBe('White cotton panties');
    });

    it('should be underwear layer for lower torso', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.layer).toBe('underwear');
      expect(wearable.equipmentSlots.primary).toBe('torso_lower');
      expect(wearable.allowedLayers).toEqual(['underwear']);
    });

    it('should have correct material and descriptors', () => {
      expect(entity.components['core:material'].material).toBe('cotton');
      expect(entity.components['descriptors:color_basic'].color).toBe('white');
      expect(entity.components['descriptors:texture'].texture).toBe('smooth');
    });

    it('should describe basic undergarment characteristics', () => {
      expect(entity.components['core:description'].text).toContain('cotton');
      expect(entity.components['core:description'].text).toContain('white');
      expect(
        entity.components['core:description'].text.toLowerCase()
      ).toContain('comfortable');
    });
  });

  describe('White Platform Sneakers', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        baseClothingEntitiesPath,
        'white_platform_sneakers.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(baseClothingEntitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
    });

    it('should have correct entity metadata', () => {
      expect(entity.id).toBe('base-clothing:white_platform_sneakers');
      expect(entity.description).toBe('White platform sneakers');
    });

    it('should be base layer footwear', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.layer).toBe('base');
      expect(wearable.equipmentSlots.primary).toBe('feet');
      expect(wearable.allowedLayers).toEqual(['underwear', 'base']);
    });

    it('should use leather material', () => {
      expect(entity.components['core:material'].material).toBe('leather');
      expect(entity.components['descriptors:color_basic'].color).toBe('white');
      expect(entity.components['descriptors:texture'].texture).toBe('smooth');
    });

    it('should describe platform sole and style', () => {
      expect(entity.components['core:description'].text).toContain('platform');
      expect(entity.components['core:description'].text).toContain('sneakers');
      expect(entity.components['core:description'].text).toContain('white');
      expect(entity.components['core:description'].text).toContain('leather');
    });
  });

  describe('Cross-Entity Validation for New Items', () => {
    let allNewEntities;

    beforeEach(() => {
      // Load base-clothing entities
      const baseClothingFiles = [
        'pink_off_shoulder_crop_top.entity.json',
        'pink_short_flared_skirt.entity.json',
        'white_platform_sneakers.entity.json',
      ];

      // Load underwear entities
      const underwearFiles = [
        'white_thigh_high_socks_pink_hearts.entity.json',
        'white_cotton_panties.entity.json',
      ];

      const baseClothingEntities = baseClothingFiles.map((filename) => {
        const filePath = join(
          process.cwd(),
          baseClothingEntitiesPath,
          filename
        );
        const fileContent = readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
      });

      const underwearEntities = underwearFiles.map((filename) => {
        const filePath = join(process.cwd(), underwearEntitiesPath, filename);
        const fileContent = readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
      });

      allNewEntities = [...baseClothingEntities, ...underwearEntities];
    });

    it('should have unique entity IDs', () => {
      const ids = allNewEntities.map((entity) => entity.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have consistent schema references', () => {
      const expectedSchema =
        'schema://living-narrative-engine/entity-definition.schema.json';

      for (const entity of allNewEntities) {
        expect(entity.$schema).toBe(expectedSchema);
      }
    });

    it('should have appropriate layer distribution', () => {
      const layerCounts = {
        underwear: 0,
        base: 0,
      };

      for (const entity of allNewEntities) {
        const layer = entity.components['clothing:wearable'].layer;
        if (layerCounts.hasOwnProperty(layer)) {
          layerCounts[layer]++;
        }
      }

      expect(layerCounts.underwear).toBe(2); // Panties and thigh-high socks
      expect(layerCounts.base).toBe(3); // Crop top, skirt, sneakers
    });

    it('should cover different equipment slots', () => {
      const slotCoverage = {
        torso_upper: 0,
        torso_lower: 0,
        feet: 0,
      };

      for (const entity of allNewEntities) {
        const primarySlot =
          entity.components['clothing:wearable'].equipmentSlots.primary;
        if (slotCoverage.hasOwnProperty(primarySlot)) {
          slotCoverage[primarySlot]++;
        }
      }

      expect(slotCoverage.torso_upper).toBe(1); // Crop top
      expect(slotCoverage.torso_lower).toBe(2); // Skirt and panties
      expect(slotCoverage.feet).toBe(2); // Socks and sneakers
    });

    it('should use pink color in appropriate items', () => {
      const pinkItems = allNewEntities.filter(
        (entity) =>
          entity.components['descriptors:color_basic']?.color === 'pink'
      );

      expect(pinkItems.length).toBe(2); // Crop top and skirt
      expect(pinkItems.map((e) => e.id)).toContain(
        'base-clothing:pink_off_shoulder_crop_top'
      );
      expect(pinkItems.map((e) => e.id)).toContain(
        'base-clothing:pink_short_flared_skirt'
      );
    });

    it('should have heart pattern only on socks', () => {
      const patternedItems = allNewEntities.filter(
        (entity) => entity.components['descriptors:pattern']
      );

      expect(patternedItems.length).toBe(1);
      expect(patternedItems[0].id).toBe(
        'underwear:white_thigh_high_socks_pink_hearts'
      );
      expect(patternedItems[0].components['descriptors:pattern'].pattern).toBe(
        'heart'
      );
    });

    it('should have rich descriptions for all items', () => {
      for (const entity of allNewEntities) {
        const description = entity.components['core:description'].text;

        expect(description.length).toBeGreaterThan(50);
        expect(description).toMatch(/\w+/);
        expect(description).not.toMatch(/^(A|An|The)\s+\w+\.$/);
      }
    });

    it('should form a complete outfit when combined', () => {
      const underwearItems = allNewEntities.filter(
        (e) => e.components['clothing:wearable'].layer === 'underwear'
      );
      const baseItems = allNewEntities.filter(
        (e) => e.components['clothing:wearable'].layer === 'base'
      );

      // Check that we have underwear items
      expect(underwearItems.length).toBe(2);

      // Check that we have base layer items
      expect(baseItems.length).toBe(3);

      // Verify layer compatibility
      const torsoLowerUnderwear = underwearItems.find(
        (e) =>
          e.components['clothing:wearable'].equipmentSlots.primary ===
          'torso_lower'
      );
      const torsoLowerBase = baseItems.find(
        (e) =>
          e.components['clothing:wearable'].equipmentSlots.primary ===
          'torso_lower'
      );

      expect(torsoLowerUnderwear).toBeDefined(); // Panties
      expect(torsoLowerBase).toBeDefined(); // Skirt
    });
  });

  describe('Pattern Component Integration', () => {
    it('should only use pattern component where appropriate', () => {
      // Base clothing entities
      const baseClothingFiles = [
        'pink_off_shoulder_crop_top.entity.json',
        'pink_short_flared_skirt.entity.json',
        'white_platform_sneakers.entity.json',
      ];

      for (const filename of baseClothingFiles) {
        const filePath = join(
          process.cwd(),
          baseClothingEntitiesPath,
          filename
        );
        const fileContent = readFileSync(filePath, 'utf8');
        const entity = JSON.parse(fileContent);

        // None of the base clothing items should have pattern
        expect(entity.components['descriptors:pattern']).toBeUndefined();
      }

      // Underwear entities
      const underwearFiles = [
        {
          file: 'white_thigh_high_socks_pink_hearts.entity.json',
          hasPattern: true,
        },
        { file: 'white_cotton_panties.entity.json', hasPattern: false },
      ];

      for (const { file, hasPattern } of underwearFiles) {
        const filePath = join(process.cwd(), underwearEntitiesPath, file);
        const fileContent = readFileSync(filePath, 'utf8');
        const entity = JSON.parse(fileContent);

        if (hasPattern) {
          expect(entity.components['descriptors:pattern']).toBeDefined();
          expect(entity.components['descriptors:pattern'].pattern).toBe(
            'heart'
          );
        } else {
          expect(entity.components['descriptors:pattern']).toBeUndefined();
        }
      }
    });
  });

  describe('Color Extension Validation', () => {
    it('should validate pink color usage in new items', () => {
      const entityFiles = [
        'pink_off_shoulder_crop_top.entity.json',
        'pink_short_flared_skirt.entity.json',
      ];

      for (const filename of entityFiles) {
        const filePath = join(
          process.cwd(),
          baseClothingEntitiesPath,
          filename
        );
        const fileContent = readFileSync(filePath, 'utf8');
        const entity = JSON.parse(fileContent);

        expect(entity.components['descriptors:color_basic'].color).toBe('pink');
      }
    });
  });
});
