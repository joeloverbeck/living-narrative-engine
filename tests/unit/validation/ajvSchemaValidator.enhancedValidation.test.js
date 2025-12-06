/**
 * @file Unit tests for AjvSchemaValidator enhanced validation features
 * Tests ValidatorGenerator integration, caching, and pre-generation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createTestBed } from '../../common/testBed.js';

describe('AjvSchemaValidator - Enhanced Validation Features', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor with ValidatorGenerator', () => {
    it('should accept validatorGenerator and dataRegistry parameters', () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);

      // Act
      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      // Assert
      expect(validator).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Enhanced validation enabled')
      );
    });

    it('should work without validatorGenerator for backward compatibility', () => {
      // Act
      const validator = new AjvSchemaValidator({
        logger,
      });

      // Assert
      expect(validator).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Enhanced validation disabled')
      );
    });

    it('should validate validatorGenerator has required methods', () => {
      // Arrange
      const invalidGenerator = {}; // Missing 'generate' method
      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);

      // Act & Assert
      expect(() => {
        new AjvSchemaValidator({
          logger,
          validatorGenerator: invalidGenerator,
          dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('should validate dataRegistry has required methods', () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      const invalidRegistry = {}; // Missing required methods

      // Act & Assert
      expect(() => {
        new AjvSchemaValidator({
          logger,
          validatorGenerator: mockValidatorGenerator,
          dataRegistry: invalidRegistry,
        });
      }).toThrow();
    });

    it('should require both validatorGenerator and dataRegistry or neither', () => {
      // Arrange - Only validatorGenerator, no dataRegistry
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);

      // Act
      new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        // No dataRegistry
      });

      // Assert - Should disable enhanced validation
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Enhanced validation disabled')
      );
    });
  });

  describe('Two-stage validation', () => {
    it('should call AJV validator first', async () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      };

      await validator.addSchema(schema, 'test:schema');

      const invalidData = {}; // Missing required 'name'

      // Act
      const result = validator.validate('test:schema', invalidData);

      // Assert - Should fail at AJV stage
      expect(result.isValid).toBe(false);
      // Generated validator is called even when AJV fails (to get better error messages)
      expect(mockDataRegistry.getComponentDefinition).toHaveBeenCalledWith(
        'test:schema'
      );
    });

    it('should call generated validator after AJV passes', async () => {
      // Arrange
      const mockValidatorFn = jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] });
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      mockValidatorGenerator.generate.mockReturnValue(mockValidatorFn);

      const mockComponentDef = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: { value: { type: 'string' } },
        },
        validationRules: { generateValidator: true },
      };

      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);
      mockDataRegistry.getComponentDefinition.mockReturnValue(mockComponentDef);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      await validator.addSchema(mockComponentDef.dataSchema, 'test:component');

      const validData = { value: 'test' };

      // Act
      const result = validator.validate('test:component', validData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(mockDataRegistry.getComponentDefinition).toHaveBeenCalledWith(
        'test:component'
      );
      expect(mockValidatorGenerator.generate).toHaveBeenCalledWith(
        mockComponentDef
      );
      expect(mockValidatorFn).toHaveBeenCalledWith(validData);
    });

    it('should merge errors from both AJV and generated validator', async () => {
      // Note: This is a theoretical test case - in practice, if AJV passes, type validation
      // should already be done. But we test the merge logic anyway.
      const mockValidatorFn = jest.fn().mockReturnValue({
        valid: false,
        errors: [{ type: 'customError', message: 'Custom validation failed' }],
      });

      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      mockValidatorGenerator.generate.mockReturnValue(mockValidatorFn);

      const mockComponentDef = {
        id: 'test:merge',
        dataSchema: {
          type: 'object',
          properties: { value: { type: 'string' } },
        },
        validationRules: { generateValidator: true },
      };

      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);
      mockDataRegistry.getComponentDefinition.mockReturnValue(mockComponentDef);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      await validator.addSchema(mockComponentDef.dataSchema, 'test:merge');

      const data = { value: 'test' };

      // Act
      const result = validator.validate('test:merge', data);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ type: 'customError' })
      );
    });

    it('should skip generated validator if component not found in registry', async () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);
      mockDataRegistry.getComponentDefinition.mockReturnValue(undefined); // Not found

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      const schema = {
        type: 'object',
        properties: { value: { type: 'string' } },
      };
      await validator.addSchema(schema, 'test:not-a-component');

      const validData = { value: 'test' };

      // Act
      const result = validator.validate('test:not-a-component', validData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(mockValidatorGenerator.generate).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Component definition not found')
      );
    });

    it('should skip generated validator if generator returns null', async () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      mockValidatorGenerator.generate.mockReturnValue(null); // No validator generated

      const mockComponentDef = {
        id: 'test:no-validator',
        dataSchema: {
          type: 'object',
          properties: { value: { type: 'string' } },
        },
        // No validationRules - generator returns null
      };

      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);
      mockDataRegistry.getComponentDefinition.mockReturnValue(mockComponentDef);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      await validator.addSchema(
        mockComponentDef.dataSchema,
        'test:no-validator'
      );

      const validData = { value: 'test' };

      // Act
      const result = validator.validate('test:no-validator', validData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(mockValidatorGenerator.generate).toHaveBeenCalled();
    });
  });

  describe('Validator caching', () => {
    it('should cache generated validators', async () => {
      // Arrange
      const mockValidatorFn = jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] });
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      mockValidatorGenerator.generate.mockReturnValue(mockValidatorFn);

      const mockComponentDef = {
        id: 'test:cached',
        dataSchema: {
          type: 'object',
          properties: { value: { type: 'string' } },
        },
        validationRules: { generateValidator: true },
      };

      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);
      mockDataRegistry.getComponentDefinition.mockReturnValue(mockComponentDef);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      await validator.addSchema(mockComponentDef.dataSchema, 'test:cached');

      const validData = { value: 'test' };

      // Act - First validation
      validator.validate('test:cached', validData);
      // Act - Second validation
      validator.validate('test:cached', validData);

      // Assert - generate() should only be called once (cached on second call)
      expect(mockValidatorGenerator.generate).toHaveBeenCalledTimes(1);
      expect(mockValidatorFn).toHaveBeenCalledTimes(2);
    });

    it('should cache null for schemas without validators', async () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      mockValidatorGenerator.generate.mockReturnValue(null);

      const mockComponentDef = {
        id: 'test:null-cached',
        dataSchema: { type: 'object' },
      };

      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);
      mockDataRegistry.getComponentDefinition.mockReturnValue(mockComponentDef);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      await validator.addSchema(
        mockComponentDef.dataSchema,
        'test:null-cached'
      );

      // Act - Multiple validations
      validator.validate('test:null-cached', {});
      validator.validate('test:null-cached', {});

      // Assert - generate() called once, getComponentDefinition called once (cached)
      expect(mockValidatorGenerator.generate).toHaveBeenCalledTimes(1);
      expect(mockDataRegistry.getComponentDefinition).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache method', () => {
    it('should clear the generated validator cache', async () => {
      // Arrange
      const mockValidatorFn = jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] });
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      mockValidatorGenerator.generate.mockReturnValue(mockValidatorFn);

      const mockComponentDef = {
        id: 'test:clear',
        dataSchema: { type: 'object' },
        validationRules: { generateValidator: true },
      };

      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);
      mockDataRegistry.getComponentDefinition.mockReturnValue(mockComponentDef);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      await validator.addSchema(mockComponentDef.dataSchema, 'test:clear');

      // First validation to populate cache
      validator.validate('test:clear', {});

      // Act
      validator.clearCache();

      // Second validation after cache clear
      validator.validate('test:clear', {});

      // Assert - generate() should be called twice (once before, once after clear)
      expect(mockValidatorGenerator.generate).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(
        'Generated validator cache cleared'
      );
    });

    it('should handle clearCache when enhanced validation is disabled', () => {
      // Arrange - No validatorGenerator
      const validator = new AjvSchemaValidator({ logger });

      // Act & Assert - Should not throw
      expect(() => {
        validator.clearCache();
      }).not.toThrow();
    });
  });

  describe('preGenerateValidators method', () => {
    it('should pre-generate validators for provided schemas', () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      mockValidatorGenerator.generate.mockReturnValue(jest.fn());

      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      const schemas = [
        {
          id: 'test:schema1',
          validationRules: { generateValidator: true },
        },
        {
          id: 'test:schema2',
          validationRules: { generateValidator: true },
        },
      ];

      // Act
      validator.preGenerateValidators(schemas);

      // Assert
      expect(mockValidatorGenerator.generate).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Pre-generated 2 validators')
      );
    });

    it('should skip schemas without generateValidator flag', () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      const schemas = [
        {
          id: 'test:with-validator',
          validationRules: { generateValidator: true },
        },
        {
          id: 'test:without-validator',
          // No validationRules
        },
      ];

      mockValidatorGenerator.generate.mockReturnValue(jest.fn());

      // Act
      validator.preGenerateValidators(schemas);

      // Assert - Only one validator generated
      expect(mockValidatorGenerator.generate).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Pre-generated 1 validators')
      );
    });

    it('should get schemas from data registry if not provided', () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);

      const allSchemas = [
        {
          id: 'test:comp1',
          validationRules: { generateValidator: true },
        },
      ];

      mockDataRegistry.getAllComponentDefinitions.mockReturnValue(allSchemas);
      mockValidatorGenerator.generate.mockReturnValue(jest.fn());

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      // Act - No schemas provided
      validator.preGenerateValidators();

      // Assert
      expect(mockDataRegistry.getAllComponentDefinitions).toHaveBeenCalled();
      expect(mockValidatorGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during pre-generation gracefully', () => {
      // Arrange
      const mockValidatorGenerator = testBed.createMock('validatorGenerator', [
        'generate',
      ]);
      const mockDataRegistry = testBed.createMock('dataRegistry', [
        'getComponentDefinition',
        'getAllComponentDefinitions',
      ]);

      mockValidatorGenerator.generate.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      const validator = new AjvSchemaValidator({
        logger,
        validatorGenerator: mockValidatorGenerator,
        dataRegistry: mockDataRegistry,
      });

      const schemas = [
        {
          id: 'test:error-schema',
          validationRules: { generateValidator: true },
        },
      ];

      // Act & Assert - Should not throw
      expect(() => {
        validator.preGenerateValidators(schemas);
      }).not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to pre-generate validator'),
        expect.any(Error)
      );
    });

    it('should skip pre-generation when enhanced validation is disabled', () => {
      // Arrange - No validatorGenerator
      const validator = new AjvSchemaValidator({ logger });

      // Act
      validator.preGenerateValidators([{ id: 'test:schema' }]);

      // Assert
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Pre-generation skipped')
      );
    });
  });

  describe('Input validation', () => {
    it('should validate schemaId parameter', () => {
      // Arrange
      const validator = new AjvSchemaValidator({ logger });

      // Act
      const result = validator.validate('', { value: 'test' });

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors[0].keyword).toBe('invalidParameters');
    });

    it('should validate data parameter is present', async () => {
      // Arrange
      const validator = new AjvSchemaValidator({ logger });
      await validator.addSchema({ type: 'object' }, 'test:schema');

      // Act
      const result = validator.validate('test:schema', null);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors[0].keyword).toBe('invalidParameters');
    });
  });
});
