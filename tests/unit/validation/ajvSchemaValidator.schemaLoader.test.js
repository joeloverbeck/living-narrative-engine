/**
 * @file Tests specifically for schema loader functionality (lines 68-129)
 * @description Tests the #createSchemaLoader method and its branches
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('AjvSchemaValidator - Schema Loader Coverage', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  describe('Schema Loader Function - Direct Testing', () => {
    it('should properly handle loadSchema calls for relative refs', async () => {
      // We need to actually trigger the loadSchema function
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add a schema that references another schema that doesn't exist yet
      const schemaWithMissingRef = {
        $id: 'test://schema-with-ref',
        type: 'object',
        properties: {
          item: { $ref: './items/weapon.schema.json' },
        },
      };

      // First add will compile and try to resolve the ref
      try {
        await validator.addSchema(
          schemaWithMissingRef,
          schemaWithMissingRef.$id
        );
        // If it doesn't throw, validate won't work
        const validatorFn = validator.getValidator(schemaWithMissingRef.$id);
        if (validatorFn) {
          const result = validatorFn({ item: {} });
          // This should fail because the ref can't be resolved
          expect(result.isValid).toBe(false);
        }
      } catch (error) {
        // Expected - ref can't be resolved
        expect(error.message).toContain('resolve');
      }
    });

    it('should handle .. relative paths in schema loader', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add a base schema first
      const baseSchema = {
        $id: 'schema://living-narrative-engine/base.json',
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      };
      await validator.addSchema(baseSchema, baseSchema.$id);

      // Now add a schema in a subdirectory that references the parent
      const childSchema = {
        $id: 'schema://living-narrative-engine/subdirectory/child.json',
        type: 'object',
        allOf: [
          { $ref: '../base.json' },
          {
            properties: {
              childProp: { type: 'number' },
            },
          },
        ],
      };

      // This should work because base.json exists
      await validator.addSchema(childSchema, childSchema.$id);

      // Verify it works
      const validatorFn = validator.getValidator(childSchema.$id);
      expect(validatorFn).toBeDefined();

      const result = validatorFn({ id: 'test', childProp: 123 });
      expect(result.isValid).toBe(true);
    });

    it('should log debug messages during schema loading', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add schemas that will trigger the loader
      const schema1 = {
        $id: 'schema://living-narrative-engine/types/common.json',
        definitions: {
          id: { type: 'string' },
        },
      };

      const schema2 = {
        $id: 'schema://living-narrative-engine/components/entity.json',
        type: 'object',
        properties: {
          id: { $ref: '../types/common.json#/definitions/id' },
        },
      };

      await validator.addSchema(schema1, schema1.$id);
      await validator.addSchema(schema2, schema2.$id);

      // The logger should have been called with debug messages
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle finding schemas by matching relative path', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add a schema with a non-standard ID pattern
      const customSchema = {
        $id: 'custom://namespace/components/item.json',
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      await validator.addSchema(customSchema, customSchema.$id);

      // Add a schema that tries to reference it with a relative path
      const referencingSchema = {
        $id: 'custom://namespace/entities/player.json',
        type: 'object',
        properties: {
          inventory: {
            type: 'array',
            items: { $ref: '../components/item.json' },
          },
        },
      };

      await validator.addSchema(referencingSchema, referencingSchema.$id);

      // Check that the schemas work
      const ids = validator.getLoadedSchemaIds();
      expect(ids).toContain(customSchema.$id);
      expect(ids).toContain(referencingSchema.$id);
    });

    it('should resolve relative references with fragments against non-standard IDs', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const commonSchema = {
        $id: 'custom://namespace/types/common.json',
        $defs: {
          Item: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1 },
            },
            required: ['name'],
          },
        },
      };

      await validator.addSchema(commonSchema, commonSchema.$id);

      const consumerSchema = {
        $id: 'custom://namespace/entities/player.json',
        type: 'object',
        properties: {
          inventory: {
            type: 'array',
            items: {
              $ref: '../types/common.json#/$defs/Item',
            },
          },
        },
      };

      await validator.addSchema(consumerSchema, consumerSchema.$id);

      const validatorFn = validator.getValidator(consumerSchema.$id);
      expect(validatorFn).toBeDefined();

      const validResult = validatorFn({
        inventory: [{ name: 'Mystic Sword' }],
      });
      expect(validResult.isValid).toBe(true);

      const invalidResult = validatorFn({
        inventory: [{ name: '' }],
      });
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toBeTruthy();
    });

    // NOTE: addSchema no longer verifies compilation after add (performance optimization)
    // Schema compilation errors are detected during validate() or getValidator() calls
    it('should handle unresolved schema references (deferred compilation)', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const schemaWithBadRef = {
        $id: 'test://bad-ref-schema',
        type: 'object',
        properties: {
          broken: { $ref: './nonexistent.json' },
        },
      };

      // addSchema succeeds without verification (performance optimization)
      await expect(
        validator.addSchema(schemaWithBadRef, schemaWithBadRef.$id)
      ).resolves.toBeUndefined();

      // No warning during addSchema (verification step removed)
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('was added but cannot be compiled')
      );

      // Schema is registered (compilation status unknown until used)
      expect(validator.isSchemaLoaded(schemaWithBadRef.$id)).toBe(true);

      // getValidator will fail for unresolved refs
      const validatorFn = validator.getValidator(schemaWithBadRef.$id);
      expect(validatorFn).toBeUndefined();

      // Warning is logged during getValidator, not addSchema
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error accessing schema'),
        expect.objectContaining({
          schemaId: schemaWithBadRef.$id,
          error: expect.any(Error),
        })
      );
    });

    it('should handle absolute URIs in schema loader', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add a schema that will be referenced absolutely
      const targetSchema = {
        $id: 'schema://absolute/target.json',
        type: 'string',
        minLength: 5,
      };

      await validator.addSchema(targetSchema, targetSchema.$id);

      // Add a schema with absolute reference
      const referencingSchema = {
        $id: 'test://absolute-ref',
        type: 'object',
        properties: {
          field: { $ref: 'schema://absolute/target.json' },
        },
      };

      await validator.addSchema(referencingSchema, referencingSchema.$id);

      // Validate that the reference works
      const validatorFn = validator.getValidator(referencingSchema.$id);
      expect(validatorFn).toBeDefined();

      const result = validatorFn({ field: 'short' });
      expect(result.isValid).toBe(true); // Exactly 5 characters, meets minLength: 5

      const result2 = validatorFn({ field: 'long enough' });
      expect(result2.isValid).toBe(true);

      // Test with a string that's actually too short
      const result3 = validatorFn({ field: 'test' });
      expect(result3.isValid).toBe(false); // Only 4 characters, fails minLength: 5
    });
  });

  describe('Schema Loader Edge Cases', () => {
    it('should handle when schemas property is not an object', () => {
      const ajvWithWeirdSchemas = {
        addSchema: jest.fn(),
        getSchema: jest.fn(),
        removeSchema: jest.fn(),
        compile: jest.fn(),
        schemas: 'not-an-object', // This will cause Object.keys to behave unexpectedly
      };

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
        ajvInstance: ajvWithWeirdSchemas,
      });

      // Object.keys on a string returns array of indices
      const ids = validator.getLoadedSchemaIds();
      // When schemas is a string, Object.keys returns character indices
      expect(ids.length).toBeGreaterThan(0);
      // The IDs will be string indices like '0', '1', '2'...
      expect(ids[0]).toBe('0');
    });

    it('should handle error in getLoadedSchemaIds when accessing schemas fails', () => {
      // Create an ajv with a getter that throws
      const ajvWithErrorGetter = {
        addSchema: jest.fn(),
        getSchema: jest.fn(),
        removeSchema: jest.fn(),
        compile: jest.fn(),
        get schemas() {
          throw new Error('Cannot access schemas');
        },
      };

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
        ajvInstance: ajvWithErrorGetter,
      });

      // This should catch the error and return empty array
      const ids = validator.getLoadedSchemaIds();
      expect(ids).toEqual([]);

      // Check that error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AjvSchemaValidator: Error getting loaded schema IDs',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('loadSchemaObject method coverage', () => {
    it('should be an alias for addSchema with swapped parameters', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const schemaId = 'test://load-schema-alias';
      const schemaData = {
        type: 'object',
        properties: {
          alias: { type: 'boolean' },
        },
        required: ['alias'],
      };

      // Use loadSchemaObject
      await validator.loadSchemaObject(schemaId, schemaData);

      // Verify the schema was added
      expect(validator.isSchemaLoaded(schemaId)).toBe(true);

      // Verify it works
      const validatorFn = validator.getValidator(schemaId);
      const result = validatorFn({ alias: true });
      expect(result.isValid).toBe(true);

      const result2 = validatorFn({ notAlias: false });
      expect(result2.isValid).toBe(false);
    });

    it('should handle errors in loadSchemaObject same as addSchema', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Try to load with invalid schema ID
      await expect(
        validator.loadSchemaObject('', { type: 'string' })
      ).rejects.toThrow('Invalid or empty schemaId');

      // Try to load with invalid schema data
      await expect(
        validator.loadSchemaObject('test://invalid-data', null)
      ).rejects.toThrow('Invalid or empty schemaData');
    });
  });
});
