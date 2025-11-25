/**
 * @file Unit tests for Jon Ureña clothing entity definitions
 * Tests individual clothing entity JSON structure, schema compliance, and component data validity
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';

describe('Jon Ureña Clothing Entities Unit Tests', () => {
  let ajv;
  let entitySchema;
  const clothingEntitiesPath = 'data/mods/clothing/entities/definitions';

  beforeEach(() => {
    ajv = new Ajv({ strict: false });

    // Mock entity schema - in real implementation this would be loaded from schema files
    entitySchema = {
      type: 'object',
      required: ['$schema', 'id', 'description', 'components'],
      properties: {
        $schema: { type: 'string' },
        id: { type: 'string', pattern: '^clothing:' },
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
                    enum: ['underwear', 'base', 'outer', 'accessories', 'armor'],
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
          },
        },
      },
    };
  });

  describe('Dark-Olive Cotton Twill Chore Jacket', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        clothingEntitiesPath,
        'dark_olive_cotton_twill_chore_jacket.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(entitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
    });

    it('should have correct entity metadata', () => {
      expect(entity.id).toBe('clothing:dark_olive_cotton_twill_chore_jacket');
      expect(entity.description).toBe(
        'Dark-olive cotton twill chore jacket with utilitarian design'
      );
      expect(entity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have correct wearable properties', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.layer).toBe('outer');
      expect(wearable.equipmentSlots.primary).toBe('torso_upper');
      expect(wearable.equipmentSlots.secondary).toEqual([
        'left_arm_clothing',
        'right_arm_clothing',
      ]);
      expect(wearable.allowedLayers).toEqual(['underwear', 'base', 'outer']);
    });

    it('should have correct material and descriptors', () => {
      expect(entity.components['core:material'].material).toBe('cotton');
      expect(entity.components['descriptors:color_basic'].color).toBe('green');
      expect(entity.components['descriptors:texture'].texture).toBe('rugged');
    });

    it('should have descriptive name and description', () => {
      expect(entity.components['core:name'].text).toBe('chore jacket');
      expect(entity.components['core:description'].text).toContain(
        'dark-olive'
      );
      expect(entity.components['core:description'].text).toContain(
        'cotton twill'
      );
      expect(entity.components['core:description'].text).toContain(
        'utilitarian'
      );
    });
  });

  describe('Forest-Green Cotton-Linen Button-Down', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        clothingEntitiesPath,
        'forest_green_cotton_linen_button_down.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(entitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
    });

    it('should have correct entity metadata', () => {
      expect(entity.id).toBe('clothing:forest_green_cotton_linen_button_down');
      expect(entity.description).toBe(
        'Forest-green cotton-linen button-down shirt'
      );
    });

    it('should have correct wearable properties for base layer', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.layer).toBe('base');
      expect(wearable.equipmentSlots.primary).toBe('torso_upper');
      expect(wearable.allowedLayers).toContain('base');
    });

    it('should have correct material and descriptors', () => {
      expect(entity.components['core:material'].material).toBe('cotton');
      expect(entity.components['descriptors:color_basic'].color).toBe('green');
      expect(entity.components['descriptors:texture'].texture).toBe('smooth');
    });

    it('should reference cotton-linen blend in description', () => {
      expect(entity.components['core:description'].text).toContain(
        'cotton-linen blend'
      );
      expect(entity.components['core:description'].text).toContain(
        'forest-green'
      );
    });
  });

  describe('Charcoal Wool T-Shirt', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        clothingEntitiesPath,
        'charcoal_wool_tshirt.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(entitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
    });

    it('should have correct entity metadata', () => {
      expect(entity.id).toBe('clothing:charcoal_wool_tshirt');
      expect(entity.description).toBe('Charcoal merino wool T-shirt');
    });

    it('should have simpler equipment slots for T-shirt', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.equipmentSlots.primary).toBe('torso_upper');
      expect(wearable.equipmentSlots.secondary).toBeUndefined(); // T-shirt doesn't need arm slots
    });

    it('should use wool material and gray color', () => {
      expect(entity.components['core:material'].material).toBe('wool');
      expect(entity.components['descriptors:color_basic'].color).toBe('gray');
    });

    it('should mention merino wool properties', () => {
      expect(entity.components['core:description'].text).toContain(
        'merino wool'
      );
      expect(entity.components['core:description'].text).toContain(
        'temperature regulation'
      );
    });
  });

  describe('Dark-Indigo Denim Jeans', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        clothingEntitiesPath,
        'dark_indigo_denim_jeans.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(entitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
    });

    it('should use legs equipment slot', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.equipmentSlots.primary).toBe('legs');
      expect(wearable.allowedLayers).toEqual(['base', 'outer']); // No underwear layer for legs
    });

    it('should use denim material and extended color', () => {
      expect(entity.components['core:material'].material).toBe('denim');
      expect(entity.components['descriptors:color_extended'].color).toBe(
        'indigo'
      );
      expect(entity.components['descriptors:texture'].texture).toBe('rugged');
    });

    it('should mention raw denim characteristics', () => {
      expect(entity.components['core:description'].text).toContain('raw denim');
      expect(entity.components['core:description'].text).toContain(
        'fading patterns'
      );
    });
  });

  describe('Sand-Suede Chukka Boots', () => {
    let entity;

    beforeEach(() => {
      const filePath = join(
        process.cwd(),
        clothingEntitiesPath,
        'sand_suede_chukka_boots.entity.json'
      );
      const fileContent = readFileSync(filePath, 'utf8');
      entity = JSON.parse(fileContent);
    });

    it('should have valid JSON structure', () => {
      expect(entity).toBeDefined();
      expect(typeof entity).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(entitySchema);
      const valid = validate(entity);

      expect(valid).toBe(true);
    });

    it('should use feet equipment slot', () => {
      const wearable = entity.components['clothing:wearable'];

      expect(wearable.equipmentSlots.primary).toBe('feet');
      expect(wearable.allowedLayers).toEqual(['base', 'outer']);
    });

    it('should use leather material with sand-beige color', () => {
      expect(entity.components['core:material'].material).toBe('leather');
      expect(entity.components['descriptors:color_extended'].color).toBe(
        'sand-beige'
      );
      expect(entity.components['descriptors:texture'].texture).toBe('velvety');
    });

    it('should describe suede and chukka characteristics', () => {
      expect(entity.components['core:description'].text).toContain('suede');
      expect(entity.components['core:description'].text).toContain('chukka');
      expect(entity.components['core:description'].text).toContain(
        'two-eyelet lacing'
      );
    });
  });

  // Note: Dark-Brown Leather Belt tests removed - entity migrated to accessories mod
  // See CLOLAYMIG-004 for migration details

  describe('Cross-Entity Validation', () => {
    let allEntities;

    beforeEach(() => {
      // Note: dark_brown_leather_belt.entity.json removed - migrated to accessories mod
      const entityFiles = [
        'dark_olive_cotton_twill_chore_jacket.entity.json',
        'forest_green_cotton_linen_button_down.entity.json',
        'charcoal_wool_tshirt.entity.json',
        'dark_indigo_denim_jeans.entity.json',
        'sand_suede_chukka_boots.entity.json',
      ];

      allEntities = entityFiles.map((filename) => {
        const filePath = join(process.cwd(), clothingEntitiesPath, filename);
        const fileContent = readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
      });
    });

    it('should have unique entity IDs', () => {
      const ids = allEntities.map((entity) => entity.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have consistent schema references', () => {
      const expectedSchema =
        'schema://living-narrative-engine/entity-definition.schema.json';

      for (const entity of allEntities) {
        expect(entity.$schema).toBe(expectedSchema);
      }
    });

    it('should cover all clothing slots appropriately', () => {
      const slotCoverage = {
        torso_upper: 0,
        legs: 0,
        feet: 0,
      };

      for (const entity of allEntities) {
        const primarySlot =
          entity.components['clothing:wearable'].equipmentSlots.primary;
        if (slotCoverage.hasOwnProperty(primarySlot)) {
          slotCoverage[primarySlot]++;
        }
      }

      expect(slotCoverage.torso_upper).toBe(3); // T-shirt, button-down, jacket
      expect(slotCoverage.legs).toBe(1); // Jeans
      expect(slotCoverage.feet).toBe(1); // Boots
      // Note: torso_lower (Belt) removed - migrated to accessories mod
    });

    it('should have appropriate layer distribution', () => {
      const layerCounts = {
        base: 0,
        outer: 0,
      };

      for (const entity of allEntities) {
        const layer = entity.components['clothing:wearable'].layer;
        if (layerCounts.hasOwnProperty(layer)) {
          layerCounts[layer]++;
        }
      }

      expect(layerCounts.base).toBe(4); // T-shirt, button-down, jeans, boots
      expect(layerCounts.outer).toBe(1); // Jacket
      // Note: accessories (Belt) removed - migrated to accessories mod
    });

    it('should use diverse but valid materials', () => {
      const materials = allEntities.map(
        (entity) => entity.components['core:material'].material
      );

      const uniqueMaterials = new Set(materials);

      expect(uniqueMaterials.size).toBeGreaterThan(1); // Should use multiple materials
      expect(uniqueMaterials).toContain('cotton');
      expect(uniqueMaterials).toContain('wool');
      expect(uniqueMaterials).toContain('denim');
      expect(uniqueMaterials).toContain('leather');
    });

    it('should have rich, descriptive text for all items', () => {
      for (const entity of allEntities) {
        const description = entity.components['core:description'].text;

        expect(description.length).toBeGreaterThan(50); // Substantial description
        expect(description).toMatch(/\w+/); // Contains words
        expect(description).not.toMatch(/^(A|An|The)\s+\w+\.$/); // Not just "A thing."
      }
    });
  });
});
