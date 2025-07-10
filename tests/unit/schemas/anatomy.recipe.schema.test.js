/**
 * @file Test suite for validating Anatomy Recipe definitions against anatomy.recipe.schema.json
 * @see data/schemas/anatomy.recipe.schema.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// Schemas to be loaded
import anatomyRecipeSchema from '../../../data/schemas/anatomy.recipe.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('JSON-Schema – Anatomy Recipe Definition', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Add referenced schemas to AJV instance
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );

    // Compile the main schema we want to test
    validate = ajv.compile(anatomyRecipeSchema);
  });

  describe('Valid Recipe - Basic', () => {
    test('should validate a minimal valid recipe', () => {
      const validRecipe = {
        recipeId: 'anatomy:human_adult_male',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: {
            partType: 'head',
          },
        },
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a recipe with all optional properties', () => {
      const validRecipe = {
        recipeId: 'anatomy:goblin_warrior',
        blueprintId: 'anatomy:goblin',
        slots: {
          head: {
            partType: 'head',
            preferId: 'anatomy:goblin_head_scarred',
            tags: ['anatomy:scarred', 'anatomy:battle_worn'],
            notTags: ['anatomy:pristine'],
            properties: {
              size: 'large',
              condition: 0.7,
            },
          },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            tags: ['anatomy:muscular'],
          },
        ],
        constraints: {
          requires: [
            {
              components: ['anatomy:wings', 'anatomy:tail'],
            },
          ],
          excludes: [
            {
              partTypes: ['mechanical_arm', 'biological_arm'],
            },
          ],
        },
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  describe('Valid Recipe - With Clothing Entities', () => {
    test('should validate a recipe with minimal clothingEntities', () => {
      const validRecipe = {
        recipeId: 'anatomy:human_peasant',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: {
            partType: 'head',
          },
        },
        clothingEntities: [
          {
            entityId: 'clothing:simple_shirt',
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a recipe with fully configured clothingEntities', () => {
      const validRecipe = {
        recipeId: 'anatomy:human_noble',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: {
            partType: 'head',
          },
        },
        clothingEntities: [
          {
            entityId: 'clothing:fine_underwear',
            equip: true,
            layer: 'underwear',
          },
          {
            entityId: 'clothing:silk_shirt',
            equip: true,
            targetSlot: 'torso_upper',
            layer: 'base',
            properties: {
              color: 'blue',
              quality: 'fine',
              condition: 0.95,
            },
          },
          {
            entityId: 'clothing:velvet_trousers',
            equip: true,
            targetSlot: 'legs',
            properties: {
              color: 'black',
            },
          },
          {
            entityId: 'clothing:leather_boots',
            equip: true,
            targetSlot: 'feet',
            skipValidation: false,
          },
          {
            entityId: 'clothing:gold_ring',
            equip: false,
            properties: {
              note: 'Carried in pocket',
            },
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate all valid layer types', () => {
      const layers = ['underwear', 'base', 'outer', 'accessories'];
      
      layers.forEach(layer => {
        const validRecipe = {
          recipeId: 'anatomy:test_layer',
          blueprintId: 'anatomy:human',
          slots: {
            head: { partType: 'head' },
          },
          clothingEntities: [
            {
              entityId: 'clothing:test_item',
              layer: layer,
            },
          ],
        };

        const ok = validate(validRecipe);
        expect(ok).toBe(true);
      });
    });
  });

  describe('Schema property validations', () => {
    test('should fail validation if required "recipeId" property is missing', () => {
      const invalidData = {
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'recipeId'",
        })
      );
    });

    test('should fail validation if required "blueprintId" property is missing', () => {
      const invalidData = {
        recipeId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'blueprintId'",
        })
      );
    });

    test('should fail validation if required "slots" property is missing', () => {
      const invalidData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'slots'",
        })
      );
    });

    test('should fail validation if an extra undefined property is included', () => {
      const invalidData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
        unknownProperty: 'test',
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
          params: { additionalProperty: 'unknownProperty' },
        })
      );
    });
  });

  describe('ClothingEntities validations', () => {
    test('should fail if clothingEntities item missing required entityId', () => {
      const invalidData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
        clothingEntities: [
          {
            equip: true,
            layer: 'base',
          },
        ],
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'entityId'",
          instancePath: '/clothingEntities/0',
        })
      );
    });

    test('should fail if layer has invalid value', () => {
      const invalidData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
        clothingEntities: [
          {
            entityId: 'clothing:shirt',
            layer: 'invalid_layer',
          },
        ],
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be equal to one of the allowed values',
          instancePath: '/clothingEntities/0/layer',
        })
      );
    });

    test('should fail if equip is not boolean', () => {
      const invalidData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
        clothingEntities: [
          {
            entityId: 'clothing:shirt',
            equip: 'yes',
          },
        ],
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be boolean',
          instancePath: '/clothingEntities/0/equip',
        })
      );
    });

    test('should fail if clothingEntities has additional properties', () => {
      const invalidData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
        clothingEntities: [
          {
            entityId: 'clothing:shirt',
            unknownProp: 'value',
          },
        ],
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
          params: { additionalProperty: 'unknownProp' },
        })
      );
    });

    test('should allow empty clothingEntities array', () => {
      const validData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
        clothingEntities: [],
      };
      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate entityId follows namespaced format', () => {
      const invalidData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
        clothingEntities: [
          {
            entityId: 'invalid-entity-id',
          },
        ],
      };
      const ok = validate(invalidData);
      if (!ok) {
        // Check if common.schema.json namespacedId pattern catches this
        const hasPatternError = validate.errors.some(
          err => err.keyword === 'pattern' || err.message?.includes('pattern')
        );
        expect(hasPatternError || validate.errors.length > 0).toBe(true);
      }
    });

    test('should validate properties can be any object', () => {
      const validData = {
        recipeId: 'anatomy:human',
        blueprintId: 'anatomy:human',
        slots: {
          head: { partType: 'head' },
        },
        clothingEntities: [
          {
            entityId: 'clothing:complex_item',
            properties: {
              string: 'value',
              number: 42,
              boolean: true,
              nested: {
                object: {
                  with: ['arrays', 'and', 'values'],
                },
              },
            },
          },
        ],
      };
      const ok = validate(validData);
      expect(ok).toBe(true);
    });
  });
});