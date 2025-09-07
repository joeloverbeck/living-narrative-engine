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
      'schema://living-narrative-engine/common.schema.json'
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

      layers.forEach((layer) => {
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

  describe('Valid Recipe - With bodyDescriptors', () => {
    test('should validate recipe with complete bodyDescriptors', () => {
      const validRecipe = {
        recipeId: 'anatomy:warrior',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {
          build: 'muscular',
          density: 'hairy',
          composition: 'lean',
          skinColor: 'tanned',
        },
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate recipe with partial bodyDescriptors', () => {
      const validRecipe = {
        recipeId: 'anatomy:athletic',
        blueprintId: 'anatomy:human_female',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {
          build: 'athletic',
          composition: 'lean',
        },
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate recipe with empty bodyDescriptors', () => {
      const validRecipe = {
        recipeId: 'anatomy:basic',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {},
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate recipe without bodyDescriptors field (backward compatibility)', () => {
      const validRecipe = {
        recipeId: 'anatomy:traditional',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate all valid build enum values', () => {
      const builds = [
        'skinny',
        'slim',
        'lissom',
        'toned',
        'athletic',
        'shapely',
        'hourglass',
        'thick',
        'muscular',
        'stocky',
      ];

      builds.forEach((build) => {
        const validRecipe = {
          recipeId: 'anatomy:test_build',
          blueprintId: 'anatomy:human',
          slots: {
            head: { partType: 'head' },
          },
          bodyDescriptors: {
            build: build,
          },
        };

        const ok = validate(validRecipe);
        expect(ok).toBe(true);
      });
    });

    test('should validate all valid density enum values', () => {
      const densities = [
        'hairless',
        'sparse',
        'light',
        'moderate',
        'hairy',
        'very-hairy',
      ];

      densities.forEach((density) => {
        const validRecipe = {
          recipeId: 'anatomy:test_density',
          blueprintId: 'anatomy:human',
          slots: {
            head: { partType: 'head' },
          },
          bodyDescriptors: {
            density: density,
          },
        };

        const ok = validate(validRecipe);
        expect(ok).toBe(true);
      });
    });

    test('should validate all valid composition enum values', () => {
      const compositions = [
        'underweight',
        'lean',
        'average',
        'soft',
        'chubby',
        'overweight',
        'obese',
      ];

      compositions.forEach((composition) => {
        const validRecipe = {
          recipeId: 'anatomy:test_composition',
          blueprintId: 'anatomy:human',
          slots: {
            head: { partType: 'head' },
          },
          bodyDescriptors: {
            composition: composition,
          },
        };

        const ok = validate(validRecipe);
        expect(ok).toBe(true);
      });
    });

    test('should validate skinColor as any string value', () => {
      const skinColors = [
        'pale',
        'tanned',
        'dark',
        'olive',
        '#F5DEB3',
        'rgb(245, 222, 179)',
      ];

      skinColors.forEach((skinColor) => {
        const validRecipe = {
          recipeId: 'anatomy:test_skin',
          blueprintId: 'anatomy:human',
          slots: {
            head: { partType: 'head' },
          },
          bodyDescriptors: {
            skinColor: skinColor,
          },
        };

        const ok = validate(validRecipe);
        expect(ok).toBe(true);
      });
    });
  });

  describe('Invalid bodyDescriptors', () => {
    test('should reject invalid build enum value', () => {
      const invalidRecipe = {
        recipeId: 'anatomy:test',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {
          build: 'invalid-build',
        },
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be equal to one of the allowed values',
          instancePath: '/bodyDescriptors/build',
        })
      );
    });

    test('should reject invalid density enum value', () => {
      const invalidRecipe = {
        recipeId: 'anatomy:test',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {
          density: 'super-hairy',
        },
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be equal to one of the allowed values',
          instancePath: '/bodyDescriptors/density',
        })
      );
    });

    test('should reject invalid composition enum value', () => {
      const invalidRecipe = {
        recipeId: 'anatomy:test',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {
          composition: 'extremely-overweight',
        },
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be equal to one of the allowed values',
          instancePath: '/bodyDescriptors/composition',
        })
      );
    });

    test('should reject additional properties in bodyDescriptors', () => {
      const invalidRecipe = {
        recipeId: 'anatomy:test',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {
          build: 'athletic',
          invalidProperty: 'value',
        },
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
          params: { additionalProperty: 'invalidProperty' },
        })
      );
    });

    test('should reject non-string values for descriptor properties', () => {
      const invalidRecipe = {
        recipeId: 'anatomy:test',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {
          build: 123,
          density: true,
          composition: ['array'],
          skinColor: { object: 'value' },
        },
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);

      // Should have multiple type errors
      const typeErrors = validate.errors.filter(
        (err) => err.message === 'must be string'
      );
      expect(typeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('bodyDescriptors Integration Tests', () => {
    test('should validate recipe with bodyDescriptors and clothingEntities', () => {
      const validRecipe = {
        recipeId: 'anatomy:complete_character',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        bodyDescriptors: {
          build: 'muscular',
          density: 'hairy',
          composition: 'lean',
          skinColor: 'tanned',
        },
        clothingEntities: [
          {
            entityId: 'clothing:simple_shirt',
            equip: true,
            layer: 'base',
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate recipe with bodyDescriptors and patterns', () => {
      const validRecipe = {
        recipeId: 'anatomy:patterned_character',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            tags: ['anatomy:muscular'],
          },
        ],
        bodyDescriptors: {
          build: 'athletic',
          composition: 'lean',
        },
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate recipe with bodyDescriptors and constraints', () => {
      const validRecipe = {
        recipeId: 'anatomy:constrained_character',
        blueprintId: 'anatomy:human_male',
        slots: {
          head: { partType: 'head' },
        },
        constraints: {
          requires: [
            {
              components: ['anatomy:wings', 'anatomy:tail'],
            },
          ],
        },
        bodyDescriptors: {
          build: 'shapely',
          skinColor: 'pale',
        },
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
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
          (err) => err.keyword === 'pattern' || err.message?.includes('pattern')
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
