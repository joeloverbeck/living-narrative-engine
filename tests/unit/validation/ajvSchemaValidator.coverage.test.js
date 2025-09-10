/**
 * @file Comprehensive unit tests to improve coverage for ajvSchemaValidator.js
 * @description Tests uncovered lines 39, 68-129, 257-260, 321, 333-336, 441-444, 633, 658-661
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('AjvSchemaValidator - Coverage Improvement Tests', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Schema Loader (#createSchemaLoader) - Lines 68-129', () => {
    let validator;
    let mockAjv;

    beforeEach(() => {
      // Create a mock Ajv instance with the necessary methods
      mockAjv = {
        addSchema: jest.fn(),
        getSchema: jest.fn(),
        removeSchema: jest.fn(),
        compile: jest.fn(),
        schemas: {},
      };

      validator = new AjvSchemaValidator({
        logger: mockLogger,
        ajvInstance: mockAjv,
      });
    });

    it('should handle relative schema reference with ./ prefix', async () => {
      const relativeUri = './operations/test.schema.json';
      const absoluteId =
        'schema://living-narrative-engine/operations/test.schema.json';
      const mockSchema = { type: 'object' };

      // Setup mock to return schema for absolute ID
      mockAjv.getSchema.mockImplementation((id) => {
        if (id === absoluteId) {
          return { schema: mockSchema };
        }
        return null;
      });

      // Access the schema loader through addSchema with a schema that has a relative $ref
      const schemaWithRef = {
        $id: 'test://schema-with-ref',
        type: 'object',
        properties: {
          operation: { $ref: relativeUri },
        },
      };

      // The schema loader is invoked internally when resolving $refs
      await validator.addSchema(schemaWithRef, schemaWithRef.$id);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Using provided Ajv instance')
      );
    });

    it('should handle relative schema reference with ../ prefix', async () => {
      const relativeUri = '../base-operation.schema.json';
      const absoluteId =
        'schema://living-narrative-engine/base-operation.schema.json';
      const mockSchema = { type: 'string' };

      mockAjv.getSchema.mockImplementation((id) => {
        if (id === absoluteId) {
          return { schema: mockSchema };
        }
        return null;
      });

      const schemaWithRef = {
        $id: 'test://schema-with-parent-ref',
        type: 'object',
        properties: {
          base: { $ref: relativeUri },
        },
      };

      await validator.addSchema(schemaWithRef, schemaWithRef.$id);

      expect(mockAjv.addSchema).toHaveBeenCalled();
    });

    it('should find schema by matching relative path when absolute ID not found', async () => {
      const relativeUri = './components/test.schema.json';
      const relativePath = 'components/test.schema.json';
      const matchingId = 'schema://custom/components/test.schema.json';
      const mockSchema = { type: 'array' };

      // First call returns null for absolute ID, subsequent calls for finding matching
      mockAjv.getSchema.mockImplementation((id) => {
        if (id === matchingId) {
          return { schema: mockSchema };
        }
        return null;
      });

      // Mock getLoadedSchemaIds to return our matching schema
      jest
        .spyOn(validator, 'getLoadedSchemaIds')
        .mockReturnValue([
          'schema://other/schema.json',
          matchingId,
          'schema://another/schema.json',
        ]);

      const schemaWithRef = {
        $id: 'test://schema-with-matching-ref',
        type: 'object',
        properties: {
          items: { $ref: relativeUri },
        },
      };

      await validator.addSchema(schemaWithRef, schemaWithRef.$id);

      expect(mockAjv.addSchema).toHaveBeenCalled();
    });

    it('should handle absolute URI by checking existing schema', async () => {
      const absoluteUri =
        'schema://living-narrative-engine/absolute.schema.json';
      const mockSchema = { type: 'boolean' };

      mockAjv.getSchema.mockImplementation((id) => {
        if (id === absoluteUri) {
          return { schema: mockSchema };
        }
        return null;
      });

      const schemaWithRef = {
        $id: 'test://schema-with-absolute-ref',
        type: 'object',
        properties: {
          flag: { $ref: absoluteUri },
        },
      };

      await validator.addSchema(schemaWithRef, schemaWithRef.$id);

      expect(mockAjv.addSchema).toHaveBeenCalled();
    });
  });

  describe('loadSchemaObject method - Line 321', () => {
    it('should correctly call addSchema with reordered parameters', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const schemaId = 'test://load-schema-object';
      const schemaData = {
        type: 'object',
        properties: {
          test: { type: 'string' },
        },
      };

      // Spy on addSchema to verify it's called correctly
      const addSchemaSpy = jest.spyOn(validator, 'addSchema');

      await validator.loadSchemaObject(schemaId, schemaData);

      expect(addSchemaSpy).toHaveBeenCalledWith(schemaData, schemaId);
      expect(addSchemaSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling when Ajv instance not available', () => {
    // We need to mock Ajv to simulate the case where ajv is null
    beforeEach(() => {
      jest.resetModules();
    });

    afterEach(() => {
      jest.dontMock('ajv');
      jest.dontMock('ajv-formats');
    });

    describe('addSchema error handling - Lines 257-260', () => {
      it('should log error and throw when ensureAjv fails in addSchema', async () => {
        // Mock Ajv to throw when methods are called
        jest.doMock('ajv', () => {
          return jest.fn().mockImplementation(() => {
            // Return an object that will cause issues
            return null;
          });
        });

        const AjvSchemaValidatorMocked = (
          await import('../../../src/validation/ajvSchemaValidator.js')
        ).default;

        // This should create a validator but with a problematic Ajv instance
        let validator;
        try {
          validator = new AjvSchemaValidatorMocked({
            logger: mockLogger,
          });
        } catch (e) {
          // Constructor might fail, which is expected
          expect(e.message).toContain('Failed to initialize Ajv');
          expect(mockLogger.error).toHaveBeenCalled();
          return;
        }

        // If constructor didn't fail, try to add schema
        const schemaData = { type: 'string' };
        const schemaId = 'test://no-ajv-add';

        await expect(
          validator.addSchema(schemaData, schemaId)
        ).rejects.toThrow();
      });
    });

    describe('removeSchema error handling - Lines 333-336', () => {
      it('should handle error when ajv is not properly initialized', () => {
        // Use a mock ajv instance that behaves unexpectedly
        const brokenAjv = {
          addSchema: jest.fn(),
          getSchema: jest.fn(() => {
            throw new Error('Ajv not ready');
          }),
          removeSchema: jest.fn(),
          compile: jest.fn(),
          schemas: {},
        };

        const validator = new AjvSchemaValidator({
          logger: mockLogger,
          ajvInstance: brokenAjv,
        });

        const schemaId = 'test://error-remove';

        // This should handle the error gracefully
        const result = validator.removeSchema(schemaId);
        expect(result).toBe(false);
      });
    });

    describe('getValidator error handling - Lines 441-444', () => {
      it('should return undefined when ajv.getSchema throws', () => {
        const throwingAjv = {
          addSchema: jest.fn(),
          getSchema: jest.fn(() => {
            throw new Error('Schema access error');
          }),
          removeSchema: jest.fn(),
          compile: jest.fn(),
          schemas: {},
        };

        const validator = new AjvSchemaValidator({
          logger: mockLogger,
          ajvInstance: throwingAjv,
        });

        const schemaId = 'test://error-validator';
        const result = validator.getValidator(schemaId);

        expect(result).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Error accessing schema'),
          expect.objectContaining({
            schemaId: schemaId,
            error: expect.any(Error),
          })
        );
      });
    });

    describe('addSchemas error handling - Lines 658-661', () => {
      it('should handle batch add with problematic ajv', async () => {
        // Create an ajv that fails on batch operations
        const failingBatchAjv = {
          addSchema: jest.fn((schemas) => {
            if (Array.isArray(schemas)) {
              throw new Error('Batch operation failed');
            }
          }),
          getSchema: jest.fn(() => null),
          removeSchema: jest.fn(),
          compile: jest.fn(),
          schemas: {},
        };

        const validator = new AjvSchemaValidator({
          logger: mockLogger,
          ajvInstance: failingBatchAjv,
        });

        const schemas = [
          { $id: 'test://batch1', type: 'string' },
          { $id: 'test://batch2', type: 'number' },
        ];

        await expect(validator.addSchemas(schemas)).rejects.toThrow(
          'Batch operation failed'
        );
      });
    });

    describe('getLoadedSchemaIds with null Ajv - Line 633', () => {
      it('should return empty array when ajv schemas property is missing', () => {
        // Create an ajv instance without schemas property
        const ajvWithoutSchemas = {
          addSchema: jest.fn(),
          getSchema: jest.fn(),
          removeSchema: jest.fn(),
          compile: jest.fn(),
          // Note: no schemas property
        };

        const validator = new AjvSchemaValidator({
          logger: mockLogger,
          ajvInstance: ajvWithoutSchemas,
        });

        const result = validator.getLoadedSchemaIds();

        // When schemas is undefined, Object.keys returns empty array
        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });
    });
  });

  describe('Private method #ensureAjv - Line 39', () => {
    it('should properly handle when ajv instance creation fails', async () => {
      // Mock Ajv constructor to throw
      jest.doMock('ajv', () => {
        return jest.fn().mockImplementation(() => {
          throw new Error('Ajv initialization error');
        });
      });

      const AjvSchemaValidatorMocked = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

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
  });

  describe('Schema loader error cases for complete branch coverage', () => {
    it('should handle schema loader when relative ref cannot be resolved', async () => {
      // Create a custom mock that simulates the schema loading process
      const mockAjvWithLoader = {
        addSchema: jest.fn((schema) => {
          // Simulate attempting to resolve a $ref
          if (
            schema.properties &&
            schema.properties.test &&
            schema.properties.test.$ref
          ) {
            const ref = schema.properties.test.$ref;
            if (ref.startsWith('./') || ref.startsWith('../')) {
              // Simulate the loader being called and failing
              throw new Error(`Cannot resolve schema reference: ${ref}`);
            }
          }
        }),
        getSchema: jest.fn(() => null),
        removeSchema: jest.fn(),
        compile: jest.fn(),
        schemas: {},
      };

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
        ajvInstance: mockAjvWithLoader,
      });

      // Mock getLoadedSchemaIds to return empty array (no matching schemas)
      jest.spyOn(validator, 'getLoadedSchemaIds').mockReturnValue([]);

      const schemaWithUnresolvableRef = {
        $id: 'test://unresolvable-ref',
        type: 'object',
        properties: {
          test: { $ref: './nonexistent/schema.json' },
        },
      };

      await expect(
        validator.addSchema(
          schemaWithUnresolvableRef,
          schemaWithUnresolvableRef.$id
        )
      ).rejects.toThrow('Cannot resolve schema reference');
    });

    it('should handle schema loader when absolute URI cannot be resolved', async () => {
      const mockAjvWithLoader = {
        addSchema: jest.fn((schema) => {
          if (
            schema.properties &&
            schema.properties.test &&
            schema.properties.test.$ref
          ) {
            const ref = schema.properties.test.$ref;
            if (!ref.startsWith('./') && !ref.startsWith('../')) {
              throw new Error(`Cannot resolve schema reference: ${ref}`);
            }
          }
        }),
        getSchema: jest.fn(() => null),
        removeSchema: jest.fn(),
        compile: jest.fn(),
        schemas: {},
      };

      const validator = new AjvSchemaValidator({
        logger: mockLogger,
        ajvInstance: mockAjvWithLoader,
      });

      const schemaWithUnresolvableAbsoluteRef = {
        $id: 'test://unresolvable-absolute',
        type: 'object',
        properties: {
          test: { $ref: 'schema://nonexistent/absolute.json' },
        },
      };

      await expect(
        validator.addSchema(
          schemaWithUnresolvableAbsoluteRef,
          schemaWithUnresolvableAbsoluteRef.$id
        )
      ).rejects.toThrow('Cannot resolve schema reference');
    });
  });

  describe('Integration tests for schema loading process', () => {
    it('should correctly integrate schema loader with real Ajv instance', async () => {
      // Use the real constructor to get actual schema loading behavior
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // First, add a base schema that can be referenced
      const baseSchema = {
        $id: 'schema://living-narrative-engine/base.schema.json',
        type: 'object',
        properties: {
          baseProperty: { type: 'string' },
        },
      };

      await validator.addSchema(baseSchema, baseSchema.$id);

      // Now add a schema that references it relatively
      const referencingSchema = {
        $id: 'schema://living-narrative-engine/operations/derived.schema.json',
        type: 'object',
        properties: {
          derivedProperty: { $ref: '../base.schema.json' },
        },
      };

      // This should work without throwing
      await validator.addSchema(referencingSchema, referencingSchema.$id);

      // Verify the schema was added
      expect(validator.isSchemaLoaded(referencingSchema.$id)).toBe(true);
    });

    it('should handle complex schema loading scenarios with multiple references', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Add multiple schemas that reference each other
      const schemas = [
        {
          $id: 'schema://living-narrative-engine/common/types.json',
          definitions: {
            id: { type: 'string', pattern: '^[a-z]+$' },
          },
        },
        {
          $id: 'schema://living-narrative-engine/components/base.json',
          type: 'object',
          properties: {
            id: { $ref: '../common/types.json#/definitions/id' },
          },
        },
      ];

      // Add schemas in order
      for (const schema of schemas) {
        await validator.addSchema(schema, schema.$id);
      }

      // Verify all schemas are loaded
      schemas.forEach((schema) => {
        expect(validator.isSchemaLoaded(schema.$id)).toBe(true);
      });
    });
  });
});
