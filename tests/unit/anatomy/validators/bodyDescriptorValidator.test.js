import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptorValidator } from '../../../../src/anatomy/validators/bodyDescriptorValidator.js';

describe('BodyDescriptorValidator', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    validator = new BodyDescriptorValidator({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should accept logger dependency', () => {
      expect(
        () => new BodyDescriptorValidator({ logger: mockLogger })
      ).not.toThrow();
    });

    it('should work without logger (uses fallback)', () => {
      expect(() => new BodyDescriptorValidator()).not.toThrow();
    });

    it('should create an instance with default parameters', () => {
      const validatorWithDefaults = new BodyDescriptorValidator({});
      expect(validatorWithDefaults).toBeInstanceOf(BodyDescriptorValidator);
    });
  });

  describe('validateRecipeDescriptors', () => {
    it('should return valid:true for null input', () => {
      const result = validator.validateRecipeDescriptors(null);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should return valid:true for undefined input', () => {
      const result = validator.validateRecipeDescriptors(undefined);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should return valid:true for empty object', () => {
      const result = validator.validateRecipeDescriptors({});
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should validate valid descriptors with enumerated values', () => {
      const descriptors = {
        height: 'tall',
        build: 'athletic',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate valid descriptors with free-form values', () => {
      const descriptors = {
        skinColor: 'tan',
        smell: 'fresh linen',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate mixed enumerated and free-form descriptors', () => {
      const descriptors = {
        height: 'tall',
        skinColor: 'olive',
        build: 'athletic',
        smell: 'vanilla',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid descriptor values', () => {
      const descriptors = {
        height: 'invalid-height',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid value');
      expect(result.errors[0]).toContain('invalid-height');
      expect(result.errors[0]).toContain('height');
    });

    it('should return multiple errors for multiple invalid values', () => {
      const descriptors = {
        height: 'invalid-height',
        build: 'invalid-build',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });

    it('should return warnings for unknown descriptors', () => {
      const descriptors = {
        unknownDescriptor: 'value',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Unknown body descriptor');
      expect(result.warnings[0]).toContain('unknownDescriptor');
      expect(result.warnings[0]).toContain('not in registry');
    });

    it('should return multiple warnings for multiple unknown descriptors', () => {
      const descriptors = {
        unknownDescriptor1: 'value1',
        unknownDescriptor2: 'value2',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.warnings.length).toBe(2);
    });

    it('should return both errors and warnings when appropriate', () => {
      const descriptors = {
        height: 'invalid-height',
        unknownDescriptor: 'value',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should accept all valid height values', () => {
      const validHeights = [
        'gigantic',
        'very-tall',
        'tall',
        'average',
        'short',
        'petite',
        'tiny',
      ];
      for (const height of validHeights) {
        const result = validator.validateRecipeDescriptors({ height });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });

    it('should accept all valid build values', () => {
      const validBuilds = [
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
      for (const build of validBuilds) {
        const result = validator.validateRecipeDescriptors({ build });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });

    it('should accept all valid composition values', () => {
      const validCompositions = [
        'underweight',
        'lean',
        'average',
        'soft',
        'chubby',
        'overweight',
        'obese',
      ];
      for (const composition of validCompositions) {
        const result = validator.validateRecipeDescriptors({ composition });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });

    it('should accept all valid hairDensity values', () => {
      const validHairDensities = [
        'hairless',
        'sparse',
        'light',
        'moderate',
        'hairy',
        'very-hairy',
      ];
      for (const hairDensity of validHairDensities) {
        const result = validator.validateRecipeDescriptors({ hairDensity });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });
  });

  describe('validateFormattingConfig', () => {
    it('should return error if config is null', () => {
      const result = validator.validateFormattingConfig(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing descriptionOrder');
    });

    it('should return error if config is undefined', () => {
      const result = validator.validateFormattingConfig(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing descriptionOrder');
    });

    it('should return error if descriptionOrder missing', () => {
      const config = {};
      const result = validator.validateFormattingConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing descriptionOrder');
    });

    it('should return error if descriptionOrder is null', () => {
      const config = { descriptionOrder: null };
      const result = validator.validateFormattingConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing descriptionOrder');
    });

    it('should return valid:true if all descriptors present', () => {
      const config = {
        descriptionOrder: [
          'height',
          'skin_color',
          'build',
          'body_composition',
          'body_hair',
          'smell',
        ],
      };
      const configResult = validator.validateFormattingConfig(config);
      expect(configResult.valid).toBe(true);
      expect(configResult.warnings).toEqual([]);
    });

    it('should handle extra descriptors in descriptionOrder', () => {
      const config = {
        descriptionOrder: [
          'height',
          'skin_color',
          'build',
          'body_composition',
          'body_hair',
          'smell',
          'extra_descriptor_1',
          'extra_descriptor_2',
        ],
      };
      const result = validator.validateFormattingConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should return warnings for missing descriptors', () => {
      const config = {
        descriptionOrder: ['height', 'build'], // Missing skin_color, body_composition, body_hair, smell
      };
      const result = validator.validateFormattingConfig(config);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('missing from descriptionOrder');
    });

    it('should identify specific missing descriptors by displayKey', () => {
      const config = {
        descriptionOrder: ['height'], // Missing all others
      };
      const result = validator.validateFormattingConfig(config);
      expect(result.warnings.length).toBe(5); // 6 total - 1 present = 5 missing

      // Check that warnings mention the missing descriptors
      const warningText = result.warnings.join(' ');
      expect(warningText).toContain('skin_color');
      expect(warningText).toContain('build');
      expect(warningText).toContain('body_composition');
      expect(warningText).toContain('body_hair');
      expect(warningText).toContain('smell');
    });

    it('should have actionable warning messages', () => {
      const config = {
        descriptionOrder: ['height'],
      };
      const result = validator.validateFormattingConfig(config);
      expect(result.warnings[0]).toContain('defined in registry');
      expect(result.warnings[0]).toContain('missing from descriptionOrder');
      expect(result.warnings[0]).toContain(
        'will not appear in generated descriptions'
      );
    });

    it('should handle empty descriptionOrder array', () => {
      const config = {
        descriptionOrder: [],
      };
      const result = validator.validateFormattingConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBe(6); // All 6 descriptors missing
    });
  });

  describe('validateSystemConsistency', () => {
    it('should validate formatting config from dataRegistry', async () => {
      const mockDataRegistry = {
        get: jest.fn((type) => {
          if (type === 'anatomyFormatting') {
            return {
              descriptionOrder: [
                'height',
                'skin_color',
                'build',
                'body_composition',
                'body_hair',
                'smell',
              ],
            };
          }
          return null;
        }),
      };

      const consistencyResult = await validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyFormatting',
        'default'
      );
      expect(consistencyResult).toHaveProperty('errors');
      expect(consistencyResult).toHaveProperty('warnings');
      expect(consistencyResult).toHaveProperty('info');
    });

    it('should return error when formatting config not found', async () => {
      const mockDataRegistry = {
        get: jest.fn(() => null),
      };

      const result = await validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      expect(result.errors).toContain(
        'Formatting config not found: anatomy:default'
      );
    });

    it('should validate sample recipes from dataRegistry', async () => {
      const mockDataRegistry = {
        get: jest.fn((type, recipeId) => {
          if (type === 'anatomyFormatting') {
            return {
              descriptionOrder: [
                'height',
                'skin_color',
                'build',
                'body_composition',
                'body_hair',
                'smell',
              ],
            };
          }
          if (type === 'anatomyRecipes' && recipeId === 'anatomy:human_male') {
            return {
              bodyDescriptors: {
                height: 'tall',
                skinColor: 'tan',
              },
            };
          }
          if (
            type === 'anatomyRecipes' &&
            recipeId === 'anatomy:human_female'
          ) {
            return {
              bodyDescriptors: {
                height: 'average',
                skinColor: 'fair',
              },
            };
          }
          return null;
        }),
      };

      const recipeResult = await validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        'anatomy:human_male'
      );
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        'anatomy:human_female'
      );
      expect(recipeResult).toHaveProperty('errors');
    });

    it('should handle missing recipes gracefully', async () => {
      const mockDataRegistry = {
        get: jest.fn((type) => {
          if (type === 'anatomyFormatting') {
            return {
              descriptionOrder: [
                'height',
                'skin_color',
                'build',
                'body_composition',
                'body_hair',
                'smell',
              ],
            };
          }
          return null; // Recipes not found
        }),
      };

      const missingRecipeResult = await validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      // Should not error, just skip missing recipes
      expect(missingRecipeResult).toHaveProperty('errors');
      expect(missingRecipeResult).toHaveProperty('warnings');
      expect(missingRecipeResult).toHaveProperty('info');
    });

    it('should return info about registered descriptors', async () => {
      const mockDataRegistry = {
        get: jest.fn((type) => {
          if (type === 'anatomyFormatting') {
            return {
              descriptionOrder: [
                'height',
                'skin_color',
                'build',
                'body_composition',
                'body_hair',
                'smell',
              ],
            };
          }
          return null;
        }),
      };

      const infoResult = await validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      expect(infoResult.info.length).toBeGreaterThan(0);
      expect(infoResult.info[0]).toContain('Total registered descriptors');
      expect(infoResult.info[1]).toContain('Registered:');
    });

    it('should aggregate errors and warnings correctly', async () => {
      const mockDataRegistry = {
        get: jest.fn((type, id) => {
          if (type === 'anatomyFormatting') {
            return {
              descriptionOrder: ['height'], // Missing descriptors - will generate warnings
            };
          }
          if (type === 'anatomyRecipes' && id === 'anatomy:human_male') {
            return {
              bodyDescriptors: {
                height: 'invalid-height', // Invalid value - will generate error
              },
            };
          }
          return null;
        }),
      };

      const result = await validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      expect(result.warnings.length).toBeGreaterThan(0); // From missing descriptors in config
      expect(
        result.warnings.some((w) => w.includes('anatomy:human_male'))
      ).toBe(true); // From invalid recipe
    });

    it('should use async/await properly', async () => {
      const mockDataRegistry = {
        get: jest.fn(() => ({
          descriptionOrder: [
            'height',
            'skin_color',
            'build',
            'body_composition',
            'body_hair',
            'smell',
          ],
        })),
      };

      const promise = validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      expect(promise).toBeInstanceOf(Promise);
      const result = await promise;
      expect(result).toHaveProperty('errors');
    });

    it('should handle recipes without bodyDescriptors', async () => {
      const mockDataRegistry = {
        get: jest.fn((type, id) => {
          if (type === 'anatomyFormatting') {
            return {
              descriptionOrder: [
                'height',
                'skin_color',
                'build',
                'body_composition',
                'body_hair',
                'smell',
              ],
            };
          }
          if (type === 'anatomyRecipes' && id === 'anatomy:human_male') {
            return {}; // No bodyDescriptors property
          }
          return null;
        }),
      };

      const result = await validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      // Should not crash, should handle gracefully
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('info');
    });
  });
});
