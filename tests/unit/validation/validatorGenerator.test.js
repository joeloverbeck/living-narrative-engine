/**
 * @file Unit tests for ValidatorGenerator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ValidatorGenerator from '../../../src/validation/validatorGenerator.js';
import { createTestBed } from '../../common/testBed.js';

describe('ValidatorGenerator', () => {
  let testBed;
  let generator;
  let mockLogger;
  let mockSimilarityCalculator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockSimilarityCalculator = {
      calculateDistance: jest.fn(),
      findClosest: jest.fn(),
    };
    generator = new ValidatorGenerator({
      logger: mockLogger,
      similarityCalculator: mockSimilarityCalculator,
    });
  });

  describe('constructor', () => {
    it('should validate logger dependency', () => {
      expect(() => {
        new ValidatorGenerator({
          logger: null,
          similarityCalculator: mockSimilarityCalculator,
        });
      }).toThrow();
    });

    it('should validate similarityCalculator dependency', () => {
      expect(() => {
        new ValidatorGenerator({
          logger: mockLogger,
          similarityCalculator: null,
        });
      }).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      expect(generator).toBeDefined();
    });
  });

  describe('generate - basic functionality', () => {
    it('should return null when validationRules is not present', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      };

      const validator = generator.generate(schema);
      expect(validator).toBe(null);
    });

    it('should return null when generateValidator is false', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: false,
        },
      };

      const validator = generator.generate(schema);
      expect(validator).toBe(null);
    });

    it('should throw when componentSchema is missing', () => {
      expect(() => {
        generator.generate(null);
      }).toThrow();
    });

    it('should throw when dataSchema is missing', () => {
      expect(() => {
        generator.generate({ id: 'test:component' });
      }).toThrow();
    });

    it('should generate validator when generateValidator is true', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      expect(validator).not.toBe(null);
      expect(typeof validator).toBe('function');
    });
  });

  describe('enum validation', () => {
    it('should validate valid enum value', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ texture: 'smooth' });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid enum value', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      mockSimilarityCalculator.findClosest.mockReturnValue('smooth');

      const validator = generator.generate(schema);
      const result = validator({ texture: 'smoth' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('invalidEnum');
      expect(result.errors[0].property).toBe('texture');
      expect(result.errors[0].value).toBe('smoth');
      expect(result.errors[0].validValues).toEqual(['smooth', 'rough', 'soft']);
      expect(result.errors[0].suggestion).toBe('smooth');
    });

    it('should use custom error message template', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum:
              'Custom error: {{property}} = {{value}} not in [{{validValues}}]',
          },
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ texture: 'invalid' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Custom error');
      expect(result.errors[0].message).toContain('texture');
      expect(result.errors[0].message).toContain('invalid');
    });

    it('should not provide suggestion when disabled', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
          suggestions: {
            enableSimilarity: false,
          },
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ texture: 'smoth' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestion).toBe(null);
      expect(mockSimilarityCalculator.findClosest).not.toHaveBeenCalled();
    });

    it('should skip validation for undefined optional enum field', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({});

      expect(result.valid).toBe(true);
    });

    it('should validate null enum values as invalid', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ texture: null });

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalidEnum');
    });
  });

  describe('type validation', () => {
    it('should validate correct string type', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ name: 'test' });

      expect(result.valid).toBe(true);
    });

    it('should reject incorrect string type', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ name: 123 });

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalidType');
      expect(result.errors[0].expectedType).toBe('string');
      expect(result.errors[0].actualType).toBe('number');
    });

    it('should validate correct number type', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            count: { type: 'number' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      expect(validator({ count: 42 }).valid).toBe(true);
      expect(validator({ count: 3.14 }).valid).toBe(true);
    });

    it('should validate correct boolean type', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            active: { type: 'boolean' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      expect(validator({ active: true }).valid).toBe(true);
      expect(validator({ active: false }).valid).toBe(true);
    });

    it('should validate correct array type', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            items: { type: 'array' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      expect(validator({ items: [] }).valid).toBe(true);
      expect(validator({ items: [1, 2, 3] }).valid).toBe(true);
    });

    it('should validate correct object type', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            data: { type: 'object' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      expect(validator({ data: {} }).valid).toBe(true);
      expect(validator({ data: { key: 'value' } }).valid).toBe(true);
      expect(validator({ data: null }).valid).toBe(false);
    });

    it('should reject NaN for number type', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            count: { type: 'number' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      expect(validator({ count: NaN }).valid).toBe(false);
    });

    it('should use custom error message for type validation', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidType:
              'Type mismatch: {{field}} must be {{expected}}, not {{actual}}',
          },
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ name: 123 });

      expect(result.errors[0].message).toContain('Type mismatch');
      expect(result.errors[0].message).toContain('name');
      expect(result.errors[0].message).toContain('string');
      expect(result.errors[0].message).toContain('number');
    });
  });

  describe('required field validation', () => {
    it('should validate when all required fields are present', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name', 'age'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ name: 'John', age: 30 });

      expect(result.valid).toBe(true);
    });

    it('should reject when required field is missing', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ age: 30 });

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('missingRequired');
      expect(result.errors[0].property).toBe('name');
    });

    it('should reject when required field is null', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ name: null });

      expect(result.valid).toBe(false);
      // null triggers type validation first (invalidType) and also required validation (missingRequired)
      expect(result.errors.length).toBeGreaterThan(0);
      const hasTypeError = result.errors.some((e) => e.type === 'invalidType');
      const hasRequiredError = result.errors.some(
        (e) => e.type === 'missingRequired'
      );
      expect(hasTypeError || hasRequiredError).toBe(true);
    });

    it('should reject when required field is empty string', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ name: '' });

      expect(result.valid).toBe(false);
    });

    it('should report multiple missing required fields', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            email: { type: 'string' },
          },
          required: ['name', 'age', 'email'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({});

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.every((e) => e.type === 'missingRequired')).toBe(
        true
      );
    });

    it('should use custom error message for missing required fields', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
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

      expect(result.errors[0].message).toContain(
        'Required field name is missing'
      );
    });
  });

  describe('combined validation', () => {
    it('should validate multiple properties', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
            density: { type: 'number' },
          },
          required: ['texture'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);

      // All valid
      expect(validator({ texture: 'smooth', density: 5 }).valid).toBe(true);

      // Invalid enum
      expect(validator({ texture: 'invalid', density: 5 }).valid).toBe(false);

      // Invalid type
      expect(
        validator({ texture: 'smooth', density: 'not a number' }).valid
      ).toBe(false);

      // Missing required
      expect(validator({ density: 5 }).valid).toBe(false);
    });

    it('should report multiple validation errors', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
            density: { type: 'number' },
            name: { type: 'string' },
          },
          required: ['name'],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ texture: 'invalid', density: 'not a number' });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should include schemaId in validation result', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ value: 'test' });

      expect(result.schemaId).toBe('test:component');
    });
  });

  describe('error handling', () => {
    it('should throw when validator is called without data', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      expect(() => {
        validator(null);
      }).toThrow();
    });

    it('should handle unknown types gracefully', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'unknownType' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({ value: 'anything' });

      // Unknown types should pass validation with a warning
      expect(result.valid).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown type')
      );
    });
  });

  describe('edge cases', () => {
    it('should handle schema with no properties', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {},
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({});

      expect(result.valid).toBe(true);
    });

    it('should handle schema with no required fields', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
          required: [],
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const validator = generator.generate(schema);
      const result = validator({});

      expect(result.valid).toBe(true);
    });

    it('should respect custom maxDistance for suggestions', () => {
      const schema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            texture: {
              type: 'string',
              enum: ['smooth', 'rough', 'soft'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
          suggestions: {
            maxDistance: 5,
          },
        },
      };

      mockSimilarityCalculator.findClosest.mockReturnValue('smooth');

      const validator = generator.generate(schema);
      validator({ texture: 'smoth' });

      expect(mockSimilarityCalculator.findClosest).toHaveBeenCalledWith(
        'smoth',
        ['smooth', 'rough', 'soft'],
        5
      );
    });
  });
});
