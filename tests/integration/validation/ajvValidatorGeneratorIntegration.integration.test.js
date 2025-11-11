/**
 * @file Integration tests for AjvSchemaValidator with ValidatorGenerator
 * Tests the two-stage validation pipeline: AJV → Generated Validator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ValidatorGenerator from '../../../src/validation/validatorGenerator.js';
import StringSimilarityCalculator from '../../../src/validation/stringSimilarityCalculator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { createTestBed } from '../../common/testBed.js';

describe('AjvSchemaValidator - ValidatorGenerator Integration', () => {
  let testBed;
  let validator;
  let dataRegistry;
  let validatorGenerator;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();

    // Create real dependencies
    const similarityCalculator = new StringSimilarityCalculator({ logger });
    validatorGenerator = new ValidatorGenerator({ logger, similarityCalculator });
    dataRegistry = new InMemoryDataRegistry({ logger });

    // Create validator with enhanced validation enabled
    validator = new AjvSchemaValidator({
      logger,
      validatorGenerator,
      dataRegistry,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Two-stage validation pipeline', () => {
    it('should validate with AJV only when no validationRules', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        // No validationRules - generated validator disabled
      };

      // Register component in data registry
      dataRegistry.store('components', 'test:component', componentSchema);

      // Add schema to AJV
      await validator.addSchema(componentSchema.dataSchema, 'test:component');

      const validData = { name: 'Test' };

      // Act
      const result = validator.validate('test:component', validData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate with both AJV and generated validator when validationRules present', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:body',
        dataSchema: {
          type: 'object',
          properties: {
            skinColor: {
              type: 'string',
              enum: ['pale', 'fair', 'olive', 'tan', 'brown', 'dark'],
            },
          },
          required: ['skinColor'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid {{property}}: "{{value}}". Valid options: {{validValues}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
          },
        },
      };

      // Register component in data registry
      dataRegistry.store('components', 'test:body', componentSchema);

      // Add schema to AJV
      await validator.addSchema(componentSchema.dataSchema, 'test:body');

      const validData = { skinColor: 'pale' };

      // Act
      const result = validator.validate('test:body', validData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should return AJV errors when AJV validation fails', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:typed',
        dataSchema: {
          type: 'object',
          properties: {
            age: { type: 'number' },
          },
          required: ['age'],
        },
      };

      dataRegistry.store('components', 'test:typed', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:typed');

      const invalidData = { age: 'not-a-number' };

      // Act
      const result = validator.validate('test:typed', invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should have AJV error about type mismatch
      expect(result.errors.some((e) => e.keyword === 'type')).toBe(true);
    });

    it('should return enhanced errors from generated validator', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:descriptor',
        dataSchema: {
          type: 'object',
          properties: {
            build: {
              type: 'string',
              enum: ['slim', 'athletic', 'average', 'stocky', 'heavyset'],
            },
          },
          required: ['build'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid {{property}}: "{{value}}". Valid options: {{validValues}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
          },
        },
      };

      dataRegistry.store('components', 'test:descriptor', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:descriptor');

      // Data passes AJV (string type) but fails enum validation
      const invalidData = { build: 'athlet' }; // Typo: should be 'athletic' (within edit distance 3)

      // Act
      const result = validator.validate('test:descriptor', invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Should have enhanced error from generated validator
      const enumError = result.errors.find((e) => e.type === 'invalidEnum');
      expect(enumError).toBeDefined();
      expect(enumError.property).toBe('build');
      expect(enumError.value).toBe('athlet');
      expect(enumError.suggestion).toBe('athletic'); // Closest match
    });

    it('should provide suggestions for typos in enum values', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:color',
        dataSchema: {
          type: 'object',
          properties: {
            skinColor: {
              type: 'string',
              enum: ['pale', 'fair', 'olive', 'tan', 'brown', 'dark'],
            },
          },
        },
        validationRules: {
          generateValidator: true,
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
          },
        },
      };

      dataRegistry.store('components', 'test:color', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:color');

      const invalidData = { skinColor: 'pael' }; // Typo: should be 'pale'

      // Act
      const result = validator.validate('test:color', invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      const enumError = result.errors.find((e) => e.type === 'invalidEnum');
      expect(enumError).toBeDefined();
      expect(enumError.suggestion).toBe('pale');
    });
  });

  describe('Validator caching', () => {
    it('should cache generated validators for performance', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:cached',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string', enum: ['a', 'b', 'c'] },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      dataRegistry.store('components', 'test:cached', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:cached');

      const validData = { value: 'a' };

      // Act - First validation (generates and caches validator)
      const result1 = validator.validate('test:cached', validData);
      // Act - Second validation (uses cached validator)
      const result2 = validator.validate('test:cached', validData);

      // Assert
      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
      // Both validations should succeed
    });

    it('should clear cache when clearCache is called', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:clearable',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string', enum: ['x', 'y', 'z'] },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      dataRegistry.store('components', 'test:clearable', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:clearable');

      // First validation to populate cache
      validator.validate('test:clearable', { value: 'x' });

      // Act
      validator.clearCache();

      // Second validation after cache clear
      const result = validator.validate('test:clearable', { value: 'y' });

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe('Pre-generation support', () => {
    it('should pre-generate validators for all component schemas', () => {
      // Arrange
      const schemas = [
        {
          id: 'test:comp1',
          dataSchema: {
            type: 'object',
            properties: { val: { type: 'string', enum: ['a', 'b'] } },
          },
          validationRules: { generateValidator: true },
        },
        {
          id: 'test:comp2',
          dataSchema: {
            type: 'object',
            properties: { num: { type: 'number' } },
          },
          validationRules: { generateValidator: true },
        },
        {
          id: 'test:comp3',
          dataSchema: {
            type: 'object',
            properties: { text: { type: 'string' } },
          },
          // No validationRules - should skip
        },
      ];

      // Register schemas
      schemas.forEach((schema) => {
        dataRegistry.store('components', schema.id, schema);
      });

      // Act
      validator.preGenerateValidators(schemas);

      // Assert - logger should show 2 validators generated (comp1, comp2)
      const infoLogs = logger.info.mock.calls.map((call) => call[0]);
      expect(infoLogs.some((log) => log.includes('Pre-generated 2 validators'))).toBe(true);
    });

    it('should use pre-generated validators during validation', async () => {
      // Arrange
      const schema = {
        id: 'test:pregenerated',
        dataSchema: {
          type: 'object',
          properties: {
            color: { type: 'string', enum: ['red', 'green', 'blue'] },
          },
        },
        validationRules: { generateValidator: true },
      };

      dataRegistry.store('components', 'test:pregenerated', schema);
      await validator.addSchema(schema.dataSchema, 'test:pregenerated');

      // Pre-generate
      validator.preGenerateValidators([schema]);

      // Act
      const result = validator.validate('test:pregenerated', { color: 'red' });

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe('Backward compatibility', () => {
    it('should work without validatorGenerator (backward compatibility)', async () => {
      // Arrange - Create validator WITHOUT validatorGenerator
      const basicValidator = new AjvSchemaValidator({
        logger,
        // No validatorGenerator or dataRegistry
      });

      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };

      await basicValidator.addSchema(schema, 'test:basic');

      const validData = { name: 'Test' };

      // Act
      const result = basicValidator.validate('test:basic', validData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should handle schemas not in data registry gracefully', async () => {
      // Arrange
      const schema = {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
      };

      await validator.addSchema(schema, 'test:not-a-component');

      const validData = { value: 'test' };

      // Act - Schema not in registry, should fall back to AJV only
      const result = validator.validate('test:not-a-component', validData);

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe('Error message formatting', () => {
    it('should use custom error templates from validationRules', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:custom-error',
        dataSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
          },
          required: ['status'],
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'The {{property}} field has an invalid value: "{{value}}". Please use one of: {{validValues}}',
          },
        },
      };

      dataRegistry.store('components', 'test:custom-error', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:custom-error');

      const invalidData = { status: 'disabled' };

      // Act
      const result = validator.validate('test:custom-error', invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      const enumError = result.errors.find((e) => e.type === 'invalidEnum');
      expect(enumError).toBeDefined();
      expect(enumError.message).toContain('The status field has an invalid value');
      expect(enumError.message).toContain('active, inactive, pending');
    });

    it('should handle required field errors with custom messages', async () => {
      // Arrange
      const componentSchema = {
        id: 'test:required',
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
          errorMessages: {
            missingRequired: 'Required field {{field}} is missing',
          },
        },
      };

      dataRegistry.store('components', 'test:required', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:required');

      const invalidData = { name: 'John' }; // Missing 'age'

      // Act
      const result = validator.validate('test:required', invalidData);

      // Assert
      expect(result.isValid).toBe(false);
      const requiredError = result.errors.find((e) => e.type === 'missingRequired');
      expect(requiredError).toBeDefined();
      expect(requiredError.message).toContain('Required field age is missing');
    });
  });
});
