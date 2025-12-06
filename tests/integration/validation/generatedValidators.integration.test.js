/**
 * @file Integration tests for generated validators
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ValidatorGenerator from '../../../src/validation/validatorGenerator.js';
import StringSimilarityCalculator from '../../../src/validation/stringSimilarityCalculator.js';
import { createTestBed } from '../../common/testBed.js';

describe('ValidatorGenerator - Integration Tests', () => {
  let testBed;
  let generator;
  let mockLogger;
  let similarityCalculator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    similarityCalculator = new StringSimilarityCalculator({
      logger: mockLogger,
    });
    generator = new ValidatorGenerator({
      logger: mockLogger,
      similarityCalculator,
    });
  });

  describe('Real component schema validation', () => {
    it('should generate validator from component schema with validationRules', () => {
      // Simulate a real component schema with validationRules
      const schema = {
        id: 'descriptors:texture',
        description: 'Texture descriptor component',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft', 'bumpy', 'silky'],
            },
          },
          required: ['value'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum:
              'Invalid texture value: {{value}}. Valid textures: {{validValues}}',
            missingRequired: 'Texture value is required',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 2,
          },
        },
      };

      const validator = generator.generate(schema);

      expect(validator).not.toBe(null);
      expect(typeof validator).toBe('function');
    });

    it('should validate valid component data', () => {
      const schema = {
        id: 'descriptors:texture',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
          required: ['value'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ value: 'smooth' });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.schemaId).toBe('descriptors:texture');
    });

    it('should validate invalid component data (enum)', () => {
      const schema = {
        id: 'descriptors:texture',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
          required: ['value'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum:
              'Invalid texture: {{value}}. Use one of: {{validValues}}',
          },
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ value: 'bumpy' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('invalidEnum');
      expect(result.errors[0].message).toContain('Invalid texture');
      expect(result.errors[0].message).toContain('bumpy');
    });

    it('should validate invalid component data (type)', () => {
      const schema = {
        id: 'descriptors:texture',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
          required: ['value'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ value: 123 });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should have both type error and enum error
      const hasTypeError = result.errors.some((e) => e.type === 'invalidType');
      expect(hasTypeError).toBe(true);
    });

    it('should validate missing required fields', () => {
      const schema = {
        id: 'descriptors:texture',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
          required: ['value'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            missingRequired: 'Required field {{field}} is missing',
          },
        },
      };

      const validator = generator.generate(schema);
      const result = validator({});

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missingRequired');
      expect(result.errors[0].message).toContain('value');
    });
  });

  describe('Error messages and suggestions', () => {
    it('should receive helpful error messages with suggestions', () => {
      const schema = {
        id: 'descriptors:skin_color',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['pale', 'fair', 'olive', 'tan', 'brown', 'dark'],
            },
          },
          required: ['value'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum:
              'Invalid skin color: {{value}}. Valid colors: {{validValues}}. Did you mean: {{suggestion}}?',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 2,
          },
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ value: 'pal' }); // Typo: should be 'pale'

      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestion).toBe('pale');
      expect(result.errors[0].message).toContain('Invalid skin color');
      expect(result.errors[0].message).toContain('pal');
    });

    it('should provide suggestions for typos using real similarity calculator', () => {
      const schema = {
        id: 'descriptors:texture',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft', 'bumpy'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);

      // Test various typos
      expect(validator({ value: 'smoth' }).errors[0].suggestion).toBe('smooth');
      expect(validator({ value: 'rugh' }).errors[0].suggestion).toBe('rough');
      expect(validator({ value: 'sft' }).errors[0].suggestion).toBe('soft');
    });

    it('should not provide suggestion when value is too different', () => {
      const schema = {
        id: 'descriptors:texture',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
          suggestions: {
            maxDistance: 2,
          },
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ value: 'completely_different' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestion).toBe(null);
    });
  });

  describe('Complex descriptor component schemas', () => {
    it('should validate descriptor component with multiple properties', () => {
      const schema = {
        id: 'descriptors:body',
        dataSchema: {
          type: 'object',
          properties: {
            height: {
              type: 'string',
              enum: ['very_short', 'short', 'average', 'tall', 'very_tall'],
            },
            build: {
              type: 'string',
              enum: ['slim', 'average', 'muscular', 'heavy'],
            },
            skin_color: {
              type: 'string',
              enum: ['pale', 'fair', 'olive', 'tan', 'brown', 'dark'],
            },
          },
          required: ['height', 'build', 'skin_color'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid {{property}}: {{value}}',
            missingRequired: 'Missing required descriptor: {{field}}',
          },
        },
      };

      const validator = generator.generate(schema);

      // Valid data
      expect(
        validator({
          height: 'average',
          build: 'muscular',
          skin_color: 'tan',
        }).valid
      ).toBe(true);

      // Invalid enum
      const result1 = validator({
        height: 'giant',
        build: 'muscular',
        skin_color: 'tan',
      });
      expect(result1.valid).toBe(false);
      expect(result1.errors[0].property).toBe('height');

      // Missing required
      const result2 = validator({
        height: 'average',
        build: 'muscular',
      });
      expect(result2.valid).toBe(false);
      const missingError = result2.errors.find(
        (e) => e.type === 'missingRequired'
      );
      expect(missingError).toBeDefined();
      expect(missingError.property).toBe('skin_color');
    });

    it('should handle optional vs required descriptors', () => {
      const schema = {
        id: 'descriptors:body',
        dataSchema: {
          type: 'object',
          properties: {
            height: {
              type: 'string',
              enum: ['short', 'average', 'tall'],
            },
            hair_color: {
              type: 'string',
              enum: ['black', 'brown', 'blonde', 'red'],
            },
            eye_color: {
              type: 'string',
              enum: ['blue', 'brown', 'green', 'hazel'],
            },
          },
          required: ['height'], // Only height is required
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);

      // Valid with only required field
      expect(validator({ height: 'average' }).valid).toBe(true);

      // Valid with all fields
      expect(
        validator({
          height: 'average',
          hair_color: 'brown',
          eye_color: 'blue',
        }).valid
      ).toBe(true);

      // Invalid without required field
      expect(
        validator({
          hair_color: 'brown',
          eye_color: 'blue',
        }).valid
      ).toBe(false);
    });
  });

  describe('End-to-end validation workflow', () => {
    it('should complete full validation cycle with errors and suggestions', () => {
      const schema = {
        id: 'descriptors:texture',
        description: 'Texture descriptor with validation',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft', 'bumpy', 'silky', 'coarse'],
            },
          },
          required: ['value'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum:
              'Invalid texture "{{value}}". Choose from: {{validValues}}',
            missingRequired: 'Texture value is required',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
          },
        },
      };

      const validator = generator.generate(schema);

      // Step 1: Validate correct data
      const validResult = validator({ value: 'smooth' });
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);

      // Step 2: Detect typo and provide suggestion
      const typoResult = validator({ value: 'smoth' });
      expect(typoResult.valid).toBe(false);
      expect(typoResult.errors[0].type).toBe('invalidEnum');
      expect(typoResult.errors[0].suggestion).toBe('smooth');

      // Step 3: Detect missing required field
      const missingResult = validator({});
      expect(missingResult.valid).toBe(false);
      expect(missingResult.errors[0].type).toBe('missingRequired');

      // Step 4: Detect type mismatch
      const typeResult = validator({ value: 123 });
      expect(typeResult.valid).toBe(false);
      const hasTypeError = typeResult.errors.some(
        (e) => e.type === 'invalidType'
      );
      expect(hasTypeError).toBe(true);
    });

    it('should work with real anatomy descriptor patterns', () => {
      // Simulate real anatomy descriptor component
      const schema = {
        id: 'descriptors:hair_density',
        dataSchema: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              enum: ['bald', 'sparse', 'normal', 'thick', 'very_thick'],
            },
          },
          required: ['value'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum:
              'Hair density "{{value}}" is not valid. Options: {{validValues}}',
          },
        },
      };

      const validator = generator.generate(schema);

      // Valid values
      expect(validator({ value: 'bald' }).valid).toBe(true);
      expect(validator({ value: 'normal' }).valid).toBe(true);
      expect(validator({ value: 'very_thick' }).valid).toBe(true);

      // Invalid value with suggestion
      const result = validator({ value: 'thik' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestion).toBe('thick');
    });
  });
});
