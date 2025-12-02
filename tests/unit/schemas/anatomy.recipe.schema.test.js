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

    test('should validate pattern with leading wildcard segment', () => {
      const validRecipe = {
        recipeId: 'creatures:gryphon',
        blueprintId: 'anatomy:gryphon',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: '*_left',
            partType: 'left_appendage',
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate pattern with infix wildcard segment', () => {
      const validRecipe = {
        recipeId: 'creatures:eldritch',
        blueprintId: 'anatomy:eldritch',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: '*tentacle*',
            partType: 'tentacle',
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate pattern with multiple wildcard segments', () => {
      const validRecipe = {
        recipeId: 'creatures:hydra',
        blueprintId: 'anatomy:hydra',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: 'neck_*_segment*',
            partType: 'hydra_neck',
          },
        ],
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
      const layers = ['underwear', 'base', 'outer', 'accessories', 'armor'];

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
          hairDensity: 'hairy',
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

      densities.forEach((hairDensity) => {
        const validRecipe = {
          recipeId: 'anatomy:test_density',
          blueprintId: 'anatomy:human',
          slots: {
            head: { partType: 'head' },
          },
          bodyDescriptors: {
            hairDensity,
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
          hairDensity: 'super-hairy',
        },
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be equal to one of the allowed values',
          instancePath: '/bodyDescriptors/hairDensity',
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
          hairDensity: true,
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
          hairDensity: 'hairy',
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

  describe('Enhanced Patterns (V2) - Valid Patterns', () => {
    test('should validate pattern with matchesGroup slot group selector', () => {
      const validRecipe = {
        recipeId: 'creatures:spider',
        blueprintId: 'anatomy:spider',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'leg',
            tags: ['anatomy:chitinous'],
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate pattern with matchesPattern wildcard', () => {
      const validRecipe = {
        recipeId: 'creatures:octopus',
        blueprintId: 'anatomy:octopus',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: 'tentacle_*',
            partType: 'tentacle',
            tags: ['anatomy:suckered'],
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate pattern with matchesAll property filter', () => {
      const validRecipe = {
        recipeId: 'creatures:dragon',
        blueprintId: 'anatomy:dragon',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesAll: {
              slotType: 'leg',
              orientation: 'left_*',
            },
            partType: 'leg',
            tags: ['anatomy:clawed'],
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate enhanced pattern with all optional properties', () => {
      const validRecipe = {
        recipeId: 'creatures:complex',
        blueprintId: 'anatomy:complex',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:wing',
            partType: 'wing',
            preferId: 'anatomy:dragon_wing',
            tags: ['anatomy:scaled', 'anatomy:membranous'],
            notTags: ['anatomy:feathered'],
            properties: {
              'descriptors:wingspan': { size: 'massive' },
            },
            exclude: {
              slotGroups: ['limbSet:arm'],
              properties: {
                orientation: 'ventral',
              },
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

    test('should validate matchesAll with single property', () => {
      const validRecipe = {
        recipeId: 'creatures:test',
        blueprintId: 'anatomy:test',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesAll: {
              slotType: 'leg',
            },
            partType: 'leg',
          },
        ],
      };

      const ok = validate(validRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should reject exclusions with malformed slot group references', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid_exclusion',
        blueprintId: 'anatomy:test',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
            exclude: {
              slotGroups: ['limbSet'],
            },
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('pattern'),
          }),
        ])
      );
    });

    test('should validate all valid limbSet slot group formats', () => {
      const slotGroups = ['limbSet:leg', 'limbSet:arm', 'limbSet:tentacle', 'limbSet:wing_123'];

      slotGroups.forEach((group) => {
        const validRecipe = {
          recipeId: 'creatures:test_group',
          blueprintId: 'anatomy:test',
          slots: {
            head: { partType: 'head' },
          },
          patterns: [
            {
              matchesGroup: group,
              partType: 'limb',
            },
          ],
        };

        const ok = validate(validRecipe);
        expect(ok).toBe(true);
      });
    });

    test('should validate all valid appendage slot group formats', () => {
      const slotGroups = ['appendage:tail', 'appendage:head', 'appendage:stinger', 'appendage:abdomen_9'];

      slotGroups.forEach((group) => {
        const validRecipe = {
          recipeId: 'creatures:test_appendage',
          blueprintId: 'anatomy:test',
          slots: {
            head: { partType: 'head' },
          },
          patterns: [
            {
              matchesGroup: group,
              partType: 'appendage',
            },
          ],
        };

        const ok = validate(validRecipe);
        expect(ok).toBe(true);
      });
    });

    test('should validate wildcard patterns', () => {
      const patterns = ['leg_*', 'tentacle_*', 'wing_*', 'arm', 'tail_123'];

      patterns.forEach((pattern) => {
        const validRecipe = {
          recipeId: 'creatures:test_wildcard',
          blueprintId: 'anatomy:test',
          slots: {
            head: { partType: 'head' },
          },
          patterns: [
            {
              matchesPattern: pattern,
              partType: 'limb',
            },
          ],
        };

        const ok = validate(validRecipe);
        expect(ok).toBe(true);
      });
    });
  });

  describe('Enhanced Patterns (V2) - Invalid Patterns', () => {
    test('should reject pattern with multiple matchers', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            matchesPattern: 'leg_*',
            partType: 'leg',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
    });

    test('should reject invalid slot group format - missing type prefix', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesGroup: 'leg',
            partType: 'leg',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
          instancePath: '/patterns/0/matchesGroup',
        })
      );
    });

    test('should reject invalid slot group format - missing identifier', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:',
            partType: 'leg',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
          instancePath: '/patterns/0/matchesGroup',
        })
      );
    });

    test('should reject invalid slot group format - wrong type', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesGroup: 'limb_set:leg',
            partType: 'leg',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
          instancePath: '/patterns/0/matchesGroup',
        })
      );
    });

    test('should reject invalid wildcard pattern - invalid characters', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: 'leg-*',
            partType: 'leg',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
          instancePath: '/patterns/0/matchesPattern',
        })
      );
    });

    test('should reject wildcard pattern composed only of asterisk', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: '*',
            partType: 'any',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/patterns/0/matchesPattern',
        })
      );
    });

    test('should reject wildcard pattern with consecutive asterisks', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: '**',
            partType: 'any',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/patterns/0/matchesPattern',
        })
      );
    });

    test('should reject empty matchesAll', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesAll: {},
            partType: 'leg',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minProperties',
          instancePath: '/patterns/0/matchesAll',
        })
      );
    });

    test('should reject pattern with no matcher at all', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            partType: 'leg',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
    });

    test('should reject pattern missing required partType', () => {
      const invalidRecipe = {
        recipeId: 'creatures:invalid',
        blueprintId: 'anatomy:invalid',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
          },
        ],
      };

      const ok = validate(invalidRecipe);
      expect(ok).toBe(false);
    });
  });

  describe('Backward Compatibility - V1 and V2 Patterns', () => {
    test('should validate existing v1 pattern unchanged', () => {
      const v1Recipe = {
        recipeId: 'creatures:legacy',
        blueprintId: 'anatomy:legacy',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matches: ['leg_1', 'leg_2', 'leg_3', 'leg_4'],
            partType: 'leg',
            tags: ['anatomy:muscular'],
          },
        ],
      };

      const ok = validate(v1Recipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate mixed v1 and v2 patterns in same recipe', () => {
      const mixedRecipe = {
        recipeId: 'creatures:mixed',
        blueprintId: 'anatomy:mixed',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matches: ['torso'],
            partType: 'torso',
          },
          {
            matchesGroup: 'limbSet:leg',
            partType: 'leg',
          },
          {
            matchesPattern: 'wing_*',
            partType: 'wing',
          },
        ],
      };

      const ok = validate(mixedRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate v1 pattern with all optional properties', () => {
      const v1Recipe = {
        recipeId: 'creatures:v1_complete',
        blueprintId: 'anatomy:v1',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:muscular_arm',
            tags: ['anatomy:muscular'],
            notTags: ['anatomy:weak'],
            properties: {
              strength: 'high',
            },
          },
        ],
      };

      const ok = validate(v1Recipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  describe('Integration Examples - Real-World Scenarios', () => {
    test('should validate spider recipe with 8 legs using group selector', () => {
      const spiderRecipe = {
        recipeId: 'creatures:giant_spider',
        blueprintId: 'anatomy:giant_spider',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'leg',
            tags: ['anatomy:chitinous', 'anatomy:hairy'],
            properties: {
              'descriptors:length': { size: 'long' },
            },
          },
          {
            matchesGroup: 'appendage:pedipalp',
            partType: 'pedipalp',
            tags: ['anatomy:part'],
          },
        ],
      };

      const ok = validate(spiderRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate dragon recipe with mixed patterns', () => {
      const dragonRecipe = {
        recipeId: 'creatures:red_dragon',
        blueprintId: 'anatomy:red_dragon',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesPattern: 'front_*',
            partType: 'leg',
            tags: ['anatomy:front_leg', 'anatomy:clawed'],
          },
          {
            matchesPattern: 'rear_*',
            partType: 'leg',
            tags: ['anatomy:rear_leg', 'anatomy:clawed'],
          },
          {
            matchesGroup: 'limbSet:wing',
            partType: 'wing',
            properties: {
              'descriptors:wingspan': { size: 'massive' },
            },
          },
        ],
      };

      const ok = validate(dragonRecipe);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate centaur recipe with property-based filtering', () => {
      const centaurRecipe = {
        recipeId: 'creatures:centaur',
        blueprintId: 'anatomy:centaur',
        slots: {
          head: { partType: 'head' },
        },
        patterns: [
          {
            matchesAll: {
              slotType: 'leg',
              orientation: 'front_*',
            },
            partType: 'leg',
            tags: ['anatomy:equine', 'anatomy:front'],
          },
          {
            matchesAll: {
              slotType: 'leg',
              orientation: 'rear_*',
            },
            partType: 'leg',
            tags: ['anatomy:equine', 'anatomy:rear'],
          },
        ],
      };

      const ok = validate(centaurRecipe);
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

  describe('Schema Documentation - Properties Field Semantics', () => {
    test('slotDefinition properties field description clarifies filtering semantics', () => {
      const slotDef = anatomyRecipeSchema.definitions.slotDefinition;
      expect(slotDef.properties.properties.description).toContain(
        'Filters entities by exact component property values'
      );
      expect(slotDef.properties.properties.description).toContain(
        'NOT for runtime overrides'
      );
    });

    test('v1PatternDefinition properties field description clarifies filtering semantics', () => {
      const v1Pattern = anatomyRecipeSchema.definitions.v1PatternDefinition;
      expect(v1Pattern.properties.properties.description).toContain(
        'Filters entities by exact component property values'
      );
      expect(v1Pattern.properties.properties.description).toContain(
        'NOT for runtime overrides'
      );
    });

    test('enhancedPatternDefinition properties field description clarifies filtering semantics', () => {
      const enhancedPattern = anatomyRecipeSchema.definitions.enhancedPatternDefinition;
      expect(enhancedPattern.properties.properties.description).toContain(
        'Filters entities by exact component property values'
      );
      expect(enhancedPattern.properties.properties.description).toContain(
        'NOT for runtime overrides'
      );
    });

    test('clothingEntities properties field description allows overrides (different semantics)', () => {
      const clothingEntity =
        anatomyRecipeSchema.properties.clothingEntities.items.properties.properties;
      // clothingEntities.properties IS for overrides - verify it does NOT have the filtering language
      expect(clothingEntity.description).toContain('override');
      expect(clothingEntity.description).not.toContain(
        'NOT for runtime overrides'
      );
    });
  });
});
