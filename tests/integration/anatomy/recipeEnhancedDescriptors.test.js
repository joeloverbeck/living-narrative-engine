/**
 * @file Integration tests for enhanced body descriptors in anatomy recipes
 * Tests the complete flow of using new descriptor values in recipes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Anatomy Recipe - Enhanced Descriptors Integration', () => {
  let ajv;
  let recipeSchema;
  let validateRecipe;

  beforeEach(() => {
    // Load the anatomy recipe schema
    const schemaPath = join(
      process.cwd(),
      'data/schemas/anatomy.recipe.schema.json'
    );
    const commonSchemaPath = join(
      process.cwd(),
      'data/schemas/common.schema.json'
    );

    recipeSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const commonSchema = JSON.parse(readFileSync(commonSchemaPath, 'utf8'));

    // Setup AJV with schemas
    ajv = new Ajv({ strict: false, allErrors: true });
    ajv.addSchema(commonSchema);
    validateRecipe = ajv.compile(recipeSchema);
  });

  describe('Horror/Medical composition values', () => {
    it('should accept atrophied composition in recipe', () => {
      const recipe = {
        recipeId: 'test:horror_entity',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          composition: 'atrophied',
        },
        slots: {},
      };

      const valid = validateRecipe(recipe);
      expect(valid).toBe(true);
      if (!valid) {
        console.error('Validation errors:', validateRecipe.errors);
      }
    });

    it('should accept skeletal composition', () => {
      const recipe = {
        recipeId: 'test:undead',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          composition: 'skeletal',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept rotting composition for undead', () => {
      const recipe = {
        recipeId: 'test:zombie',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          composition: 'rotting',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept all new composition values', () => {
      const newValues = [
        'atrophied',
        'emaciated',
        'skeletal',
        'malnourished',
        'dehydrated',
        'wasted',
        'desiccated',
        'bloated',
        'rotting',
      ];

      for (const value of newValues) {
        const recipe = {
          recipeId: `test:composition_${value}`,
          blueprintId: 'anatomy:humanoid',
          bodyDescriptors: {
            composition: value,
          },
          slots: {},
        };

        const valid = validateRecipe(recipe);
        expect(valid).toBe(true);
        if (!valid) {
          console.error(
            `Failed for composition: ${value}`,
            validateRecipe.errors
          );
        }
      }
    });
  });

  describe('Extreme physique build values', () => {
    it('should accept atrophied build for vestigial limbs', () => {
      const recipe = {
        recipeId: 'test:atrophied_limbs',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'atrophied',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept skeletal build', () => {
      const recipe = {
        recipeId: 'test:skeletal_creature',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'skeletal',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept all new build values', () => {
      const newValues = [
        'frail',
        'gaunt',
        'skeletal',
        'atrophied',
        'cadaverous',
        'massive',
        'willowy',
        'barrel-chested',
        'lanky',
      ];

      for (const value of newValues) {
        const recipe = {
          recipeId: `test:build_${value}`,
          blueprintId: 'anatomy:humanoid',
          bodyDescriptors: {
            build: value,
          },
          slots: {},
        };

        const valid = validateRecipe(recipe);
        expect(valid).toBe(true);
        if (!valid) {
          console.error(`Failed for build: ${value}`, validateRecipe.errors);
        }
      }
    });
  });

  describe('Extreme height values', () => {
    it('should accept colossal height', () => {
      const recipe = {
        recipeId: 'test:giant',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          height: 'colossal',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept titanic height', () => {
      const recipe = {
        recipeId: 'test:titan',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          height: 'titanic',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept minuscule height', () => {
      const recipe = {
        recipeId: 'test:fairy',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          height: 'minuscule',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept microscopic height', () => {
      const recipe = {
        recipeId: 'test:micro_being',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          height: 'microscopic',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept all new height values', () => {
      const newValues = ['colossal', 'titanic', 'minuscule', 'microscopic'];

      for (const value of newValues) {
        const recipe = {
          recipeId: `test:height_${value}`,
          blueprintId: 'anatomy:humanoid',
          bodyDescriptors: {
            height: value,
          },
          slots: {},
        };

        const valid = validateRecipe(recipe);
        expect(valid).toBe(true);
        if (!valid) {
          console.error(`Failed for height: ${value}`, validateRecipe.errors);
        }
      }
    });
  });

  describe('Combined descriptor scenarios', () => {
    it('should accept horror entity with multiple enhanced descriptors', () => {
      const recipe = {
        recipeId: 'anatomy:writhing_observer',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'hulking',
          composition: 'bloated',
          height: 'colossal',
          skinColor: 'translucent-gray',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept undead with skeletal descriptors', () => {
      const recipe = {
        recipeId: 'test:skeleton_warrior',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'skeletal',
          composition: 'desiccated',
          height: 'tall',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept starving survivor', () => {
      const recipe = {
        recipeId: 'test:survivor',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'gaunt',
          composition: 'emaciated',
          height: 'average',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept fairy creature', () => {
      const recipe = {
        recipeId: 'test:pixie',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'willowy',
          composition: 'lean',
          height: 'minuscule',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept diseased patient', () => {
      const recipe = {
        recipeId: 'test:patient',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'frail',
          composition: 'malnourished',
          height: 'short',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });

    it('should accept giant with massive build', () => {
      const recipe = {
        recipeId: 'test:frost_giant',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'massive',
          composition: 'overweight',
          height: 'titanic',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(true);
    });
  });

  describe('Backward compatibility', () => {
    it('should still accept all original composition values', () => {
      const originalValues = [
        'underweight',
        'lean',
        'average',
        'soft',
        'chubby',
        'overweight',
        'obese',
      ];

      for (const value of originalValues) {
        const recipe = {
          recipeId: `test:original_composition_${value}`,
          blueprintId: 'anatomy:humanoid',
          bodyDescriptors: {
            composition: value,
          },
          slots: {},
        };

        expect(validateRecipe(recipe)).toBe(true);
      }
    });

    it('should still accept all original build values', () => {
      const originalValues = [
        'skinny',
        'slim',
        'lissom',
        'toned',
        'athletic',
        'shapely',
        'hourglass',
        'thick',
        'muscular',
        'hulking',
        'stocky',
      ];

      for (const value of originalValues) {
        const recipe = {
          recipeId: `test:original_build_${value}`,
          blueprintId: 'anatomy:humanoid',
          bodyDescriptors: {
            build: value,
          },
          slots: {},
        };

        expect(validateRecipe(recipe)).toBe(true);
      }
    });

    it('should still accept all original height values', () => {
      const originalValues = [
        'gigantic',
        'very-tall',
        'tall',
        'average',
        'short',
        'petite',
        'tiny',
      ];

      for (const value of originalValues) {
        const recipe = {
          recipeId: `test:original_height_${value}`,
          blueprintId: 'anatomy:humanoid',
          bodyDescriptors: {
            height: value,
          },
          slots: {},
        };

        expect(validateRecipe(recipe)).toBe(true);
      }
    });
  });

  describe('Invalid descriptor values', () => {
    it('should reject invalid composition value', () => {
      const recipe = {
        recipeId: 'test:invalid',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          composition: 'super-fat',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(false);
    });

    it('should reject invalid build value', () => {
      const recipe = {
        recipeId: 'test:invalid',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          build: 'super-muscular',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(false);
    });

    it('should reject invalid height value', () => {
      const recipe = {
        recipeId: 'test:invalid',
        blueprintId: 'anatomy:humanoid',
        bodyDescriptors: {
          height: 'super-gigantic',
        },
        slots: {},
      };

      expect(validateRecipe(recipe)).toBe(false);
    });
  });
});
