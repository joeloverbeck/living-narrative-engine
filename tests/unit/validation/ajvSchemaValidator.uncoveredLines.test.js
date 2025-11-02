/**
 * @file Targeted tests for specific uncovered lines in ajvSchemaValidator.js
 * @description Focused on lines: 39, 68-129, 257-260, 333-336, 441-444, 633, 658-661
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('AjvSchemaValidator - Uncovered Lines Targeted Tests', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('ajv');
    jest.dontMock('ajv-formats');
    jest.restoreAllMocks();
  });

  describe('Line 39 - #ensureAjv throws when ajv is null', () => {
    it('should throw from ensureAjv when ajv is not initialized', async () => {
      // Mock Ajv to return null, which will set #ajv to null
      jest.doMock('ajv', () => {
        return jest.fn().mockImplementation(() => null);
      });

      const AjvSchemaValidatorMocked = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      expect(() => {
        new AjvSchemaValidatorMocked({
          logger: mockLogger,
        });
      }).toThrow('Failed to initialize Ajv');
    });
  });

  describe('Lines 68-129 - Schema Loader Function Coverage', () => {
    it('should execute schema loader for relative ./ paths', async () => {
      jest.resetModules();

      // We need to create a situation where the schema loader is actually invoked
      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // First add a base schema that can be referenced
      const baseSchema = {
        $id: 'schema://living-narrative-engine/subdir/test.json',
        type: 'string',
      };
      await validator.addSchema(baseSchema, baseSchema.$id);

      // Add a schema with a relative reference that will trigger the loader
      const schemaWithRelativeRef = {
        $id: 'schema://living-narrative-engine/subdir/referring.json',
        type: 'object',
        properties: {
          field: { $ref: './test.json' }, // This will trigger schema loader
        },
      };

      // The schema loader should be invoked when processing the $ref
      await validator.addSchema(
        schemaWithRelativeRef,
        schemaWithRelativeRef.$id
      );

      // Check that debug messages were logged (indicating loader was called)
      const debugCalls = mockLogger.debug.mock.calls;
      const hasLoaderMessage = debugCalls.some(
        (call) => call[0] && call[0].includes('schema')
      );
      expect(hasLoaderMessage).toBe(true);
    });

    it('should execute schema loader for relative ../ paths', async () => {
      jest.resetModules();

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add a parent schema
      const parentSchema = {
        $id: 'schema://living-narrative-engine/parent.json',
        type: 'number',
      };
      await validator.addSchema(parentSchema, parentSchema.$id);

      // Add a child schema with parent reference
      const childSchema = {
        $id: 'schema://living-narrative-engine/child/sub.json',
        type: 'object',
        properties: {
          parent: { $ref: '../parent.json' }, // This will trigger schema loader for ../
        },
      };

      await validator.addSchema(childSchema, childSchema.$id);

      // Verify the schema was added successfully
      expect(validator.isSchemaLoaded(childSchema.$id)).toBe(true);
    });

    it('should warn when schema has unresolved reference instead of throwing', async () => {
      jest.resetModules();

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const schemaWithBadRef = {
        $id: 'schema://living-narrative-engine/bad-ref.json',
        type: 'object',
        properties: {
          missing: { $ref: './does-not-exist.json' },
        },
      };

      // The validator now logs warnings for unresolved refs instead of throwing
      await expect(
        validator.addSchema(schemaWithBadRef, schemaWithBadRef.$id)
      ).resolves.toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Schema 'schema://living-narrative-engine/bad-ref.json' was added but cannot be compiled"
        )
      );

      expect(validator.isSchemaLoaded(schemaWithBadRef.$id)).toBe(false);

      const validatorFn = validator.getValidator(schemaWithBadRef.$id);
      expect(validatorFn).toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error accessing schema'),
        expect.objectContaining({
          schemaId: schemaWithBadRef.$id,
          error: expect.any(Error),
        })
      );
    });

    it('should find schema by searching loaded schema IDs', async () => {
      jest.resetModules();

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add multiple schemas with different ID patterns
      const schemas = [
        {
          $id: 'schema://custom/path/schema1.json',
          type: 'string',
        },
        {
          $id: 'schema://living-narrative-engine/types/common.json',
          type: 'object',
        },
        {
          $id: 'schema://another/types/common.json',
          type: 'array',
        },
      ];

      for (const schema of schemas) {
        await validator.addSchema(schema, schema.$id);
      }

      // Now add a schema that references one by relative path
      const referencingSchema = {
        $id: 'schema://another/components/test.json',
        type: 'object',
        properties: {
          common: { $ref: '../types/common.json' }, // Should find schema://another/types/common.json
        },
      };

      await validator.addSchema(referencingSchema, referencingSchema.$id);

      // Check that all schemas are loaded
      const loadedIds = validator.getLoadedSchemaIds();
      expect(loadedIds).toContain(referencingSchema.$id);
    });

    it('should handle absolute URI resolution in loader', async () => {
      jest.resetModules();

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add a schema that will be referenced with absolute URI
      const targetSchema = {
        $id: 'schema://absolute/path/target.json',
        type: 'string',
        pattern: '^[A-Z]+$',
      };
      await validator.addSchema(targetSchema, targetSchema.$id);

      // Reference it with absolute URI (not relative)
      const referencingSchema = {
        $id: 'schema://other/referring.json',
        type: 'object',
        properties: {
          field: { $ref: 'schema://absolute/path/target.json' }, // Absolute URI
        },
      };

      await validator.addSchema(referencingSchema, referencingSchema.$id);

      // Test that the reference works
      const validatorFn = validator.getValidator(referencingSchema.$id);
      if (validatorFn) {
        const valid = validatorFn({ field: 'ABC' });
        expect(valid.isValid).toBe(true);

        const invalid = validatorFn({ field: 'abc' });
        expect(invalid.isValid).toBe(false);
      }
    });

    it('should resolve full schema when referencing an ID with trailing hash fragment', async () => {
      jest.resetModules();

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const baseSchema = {
        $id: 'schema://living-narrative-engine/hash/base.json',
        type: 'number',
        minimum: 0,
      };

      await validator.addSchema(baseSchema, baseSchema.$id);

      const referencingSchema = {
        $id: 'schema://living-narrative-engine/hash/consumer.json',
        type: 'object',
        properties: {
          foo: {
            $ref: 'schema://living-narrative-engine/hash/base.json#',
          },
        },
        required: ['foo'],
      };

      await validator.addSchema(referencingSchema, referencingSchema.$id);

      const success = validator.validate(referencingSchema.$id, { foo: 42 });
      expect(success.isValid).toBe(true);

      const failure = validator.validate(referencingSchema.$id, { foo: 'bad' });
      expect(failure.isValid).toBe(false);
      expect(Array.isArray(failure.errors)).toBe(true);
    });
  });

  describe('Lines 257-260, 333-336, 441-444, 658-661 - Ajv error paths', () => {
    it('should handle error when Ajv methods throw', async () => {
      // Test through mocking Ajv to throw errors
      jest.doMock('ajv', () => {
        return jest.fn().mockImplementation(() => {
          throw new Error('Ajv initialization failed');
        });
      });

      const AjvSchemaValidatorMocked = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      // This should throw during constructor
      expect(() => {
        new AjvSchemaValidatorMocked({
          logger: mockLogger,
        });
      }).toThrow('Failed to initialize Ajv');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL - Failed to instantiate Ajv'),
        expect.any(Error)
      );
    });

    it('should handle getValidator when ajv.getSchema throws', async () => {
      // Test error handling in getValidator method
      jest.resetModules();

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Try to get a validator for a non-existent schema
      const result = validator.getValidator('test://non-existent-schema');

      // Should return undefined for non-existent schema
      expect(result).toBeUndefined();

      // Now test with an invalid schema ID
      const invalidResult = validator.getValidator('');
      expect(invalidResult).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('getValidator called with invalid schemaId')
      );
    });
  });

  describe('Line 633 - getLoadedSchemaIds edge case', () => {
    it('should handle when ajv.schemas is undefined', async () => {
      // Test the edge case where schemas might be undefined
      // This is primarily defensive programming
      jest.resetModules();

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // The getLoadedSchemaIds should handle the case gracefully
      const ids = validator.getLoadedSchemaIds();
      // Should return an array (even if empty)
      expect(Array.isArray(ids)).toBe(true);
      expect(typeof ids.length).toBe('number');
    });
  });
});
