/**
 * @file Tests for remaining uncovered branches in ajvSchemaValidator.js
 * @description Targets lines: 76, 148, 166-170, 185, 193-202, 252, 387, 475, 527-563, 586-624, 636, 726
 * Focuses on edge cases with non-Error objects and specific schema loader paths
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

describe('AjvSchemaValidator - Remaining Branch Coverage', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.resetModules();
    jest.dontMock('ajv');
    jest.dontMock('ajv-formats');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Line 76 - Fragment without # prefix in resolveFragment', () => {
    it('should handle schema reference with fragment but no # prefix', async () => {
      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      // Create a schema with nested definitions
      const schemaWithDefs = {
        $id: 'schema://test/with-defs.json',
        definitions: {
          stringType: { type: 'string' },
          numberType: { type: 'number' },
        },
        type: 'object',
        properties: {
          name: { $ref: '#/definitions/stringType' },
        },
      };

      await validator.addSchema(schemaWithDefs, schemaWithDefs.$id);

      // Validate that the schema was loaded
      expect(validator.isSchemaLoaded(schemaWithDefs.$id)).toBe(true);
    });
  });

  describe('Line 252 - Non-Error instance handling', () => {
    it('should handle non-Error thrown during addSchema', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn(),
        removeSchema: jest.fn(),
        compile: jest.fn(),
        schemas: {},
      };

      jest.doMock('ajv', () => {
        return jest.fn(() => mockAjvInstance);
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      const testSchema = { type: 'string' };

      // Mock to throw a non-Error object
      mockAjvInstance.getSchema.mockReturnValueOnce(null); // Schema doesn't exist
      mockAjvInstance.addSchema.mockImplementation(() => {
        // Throw a non-Error object (like a plain object or string)
        throw 'Non-error string thrown';
      });

      await expect(
        validator.addSchema(testSchema, 'schema://test/non-error.json')
      ).rejects.toThrow('Non-error string thrown');

      // Verify String(error) path was taken - should show the string
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error adding schema.*Non-error string thrown/),
        expect.objectContaining({
          schemaId: 'schema://test/non-error.json',
        })
      );
    });
  });

  // NOTE: Line 387 test removed - addSchema verification step was removed for performance
  // Schema compilation errors are now caught during validate() calls instead
  describe('addSchema without verification step', () => {
    it('should add schema without post-add verification for performance', async () => {
      jest.resetModules();

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      const testSchema = {
        $id: 'schema://test/no-verify.json',
        type: 'string',
      };

      await validator.addSchema(testSchema, testSchema.$id);

      // Schema should be added successfully
      expect(validator.isSchemaLoaded(testSchema.$id)).toBe(true);

      // No warnings should be logged (verification step removed)
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Line 475 - Non-Error in removeSchema catch', () => {
    it('should handle non-Error thrown during schema removal', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest
          .fn()
          .mockReturnValueOnce({ schema: { type: 'string' } }) // Schema exists
          .mockImplementation(() => {
            throw { status: 500, detail: 'Removal failed' };
          }),
        removeSchema: jest.fn(),
        schemas: {},
      };

      jest.doMock('ajv', () => {
        return jest.fn(() => mockAjvInstance);
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      const result = validator.removeSchema('schema://test/remove-error.json');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error removing schema.*\[object Object\]/),
        expect.objectContaining({
          schemaId: 'schema://test/remove-error.json',
        })
      );
    });
  });

  describe('Lines 527-563 - Non-Error in preloadSchemas catch', () => {
    it('should handle non-Error thrown during schema preload', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn().mockImplementation(() => {
          throw { code: 'PRELOAD_FAILED', reason: 'Schema invalid' };
        }),
        getSchema: jest.fn().mockReturnValue(null),
        removeSchema: jest.fn(),
        schemas: {},
      };

      jest.doMock('ajv', () => {
        return jest.fn(() => mockAjvInstance);
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const schemasToPreload = [
        {
          id: 'schema://test/preload1.json',
          schema: { type: 'string' },
        },
      ];

      // Constructor calls preloadSchemas
      new AjvSchemaValidator({
        logger: mockLogger,
        preloadSchemas: schemasToPreload,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to preload schema.*\[object Object\]/),
        expect.objectContaining({
          schemaId: 'schema://test/preload1.json',
        })
      );
    });
  });

  describe('Lines 586-624 - Non-Error in getValidator runtime validation', () => {
    it('should handle non-Error thrown during validation execution', async () => {
      jest.resetModules();

      const mockValidatorFn = jest.fn().mockImplementation(() => {
        throw { validationCode: 'RUNTIME_ERROR', info: 'Validation crashed' };
      });

      mockValidatorFn.errors = null;

      const mockAjvInstance = {
        addSchema: jest.fn().mockImplementation(function (schema, id) {
          // Simulate schema being added to the schemas map
          this.schemas[id] = { schema };
        }),
        getSchema: jest.fn().mockReturnValue(mockValidatorFn), // getValidator calls getSchema
        removeSchema: jest.fn(),
        schemas: {},
      };

      jest.doMock('ajv', () => {
        return jest.fn(() => mockAjvInstance);
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      await validator.addSchema(
        { type: 'string' },
        'schema://test/runtime-error.json'
      );

      const validatorFn = validator.getValidator(
        'schema://test/runtime-error.json'
      );
      expect(validatorFn).toBeDefined();

      const result = validatorFn({ test: 'data' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        expect.objectContaining({
          keyword: 'runtimeError',
          message: expect.stringContaining('[object Object]'),
        }),
      ]);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Runtime error during validation.*\[object Object\]/),
        expect.objectContaining({
          schemaId: 'schema://test/runtime-error.json',
        })
      );
    });
  });

  // NOTE: isSchemaLoaded no longer triggers compilation (performance optimization)
  // It only checks the schema map, so no compilation errors can occur
  describe('isSchemaLoaded - schema map check only', () => {
    it('should check schema map without triggering compilation', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockImplementation(() => {
          throw { errorType: 'COMPILATION_ERROR', description: 'Cannot compile' };
        }),
        removeSchema: jest.fn(),
        schemas: {
          'schema://test/compile-error.json': { schema: { type: 'string' } },
        },
      };

      jest.doMock('ajv', () => {
        return jest.fn(() => mockAjvInstance);
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      // isSchemaLoaded only checks the schema map, not compilation
      // So it returns true even if getSchema would throw
      const isLoaded = validator.isSchemaLoaded(
        'schema://test/compile-error.json'
      );

      expect(isLoaded).toBe(true); // Schema is in the map
      expect(mockAjvInstance.getSchema).not.toHaveBeenCalled(); // No compilation attempted
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning needed
    });
  });

  describe('Line 726 - Non-Error in validateSchemaRefs', () => {
    it('should handle non-Error thrown during schema ref validation', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockReturnValue({
          schema: { $ref: './unresolved.json' },
        }),
        compile: jest.fn().mockImplementation(() => {
          throw { refError: 'UNRESOLVED_REF', path: './unresolved.json' };
        }),
        removeSchema: jest.fn(),
        schemas: {},
      };

      jest.doMock('ajv', () => {
        return jest.fn(() => mockAjvInstance);
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      const isValid = validator.validateSchemaRefs('schema://test/bad-refs.json');

      expect(isValid).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Schema.*has unresolved \$refs or other issues.*\[object Object\]/
        ),
        expect.objectContaining({
          schemaId: 'schema://test/bad-refs.json',
        })
      );
    });
  });

  describe('Lines 166-170, 185, 193-202 - Schema loader edge cases', () => {
    it('should handle relative path resolution with getLoadedSchemaIds', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockReturnValue(null),
        removeSchema: jest.fn(),
        schemas: {},
      };

      let capturedLoader;

      jest.doMock('ajv', () => {
        return jest.fn((options = {}) => {
          capturedLoader = options.loadSchema;
          return mockAjvInstance;
        });
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      // Mock getLoadedSchemaIds to return empty array
      jest.spyOn(validator, 'getLoadedSchemaIds').mockReturnValue([]);

      // Try to load a relative path that cannot be resolved
      await expect(capturedLoader('./missing.json')).rejects.toThrow(
        'Cannot resolve schema reference: ./missing.json'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Could not resolve schema reference './missing.json'")
      );
    });

    it('should successfully resolve and log when finding schema by fallback search', async () => {
      jest.resetModules();

      const matchingSchema = { schema: { type: 'boolean' } };

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest
          .fn()
          .mockReturnValueOnce(null) // First try with absolute ID fails
          .mockReturnValueOnce(matchingSchema), // Second try with matching ID succeeds
        removeSchema: jest.fn(),
        schemas: {
          'schema://custom/prefix/types/common.json': matchingSchema,
        },
      };

      let capturedLoader;

      jest.doMock('ajv', () => {
        return jest.fn((options = {}) => {
          capturedLoader = options.loadSchema;
          return mockAjvInstance;
        });
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      // Override getLoadedSchemaIds to return our test schema
      jest
        .spyOn(validator, 'getLoadedSchemaIds')
        .mockReturnValue(['schema://custom/prefix/types/common.json']);

      // Request relative path that will trigger fallback search
      const result = await capturedLoader('../types/common.json');

      expect(result).toEqual({ type: 'boolean' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Found schema 'schema://custom/prefix/types/common.json' matching relative path 'types/common.json'"
        )
      );
    });

    it('should handle absolute schema resolution successfully', async () => {
      jest.resetModules();

      const targetSchema = { type: 'string', minLength: 1 };

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockReturnValue({ schema: targetSchema }),
        removeSchema: jest.fn(),
        schemas: {
          'schema://test/absolute.json': { schema: targetSchema },
        },
      };

      let capturedLoader;

      jest.doMock('ajv', () => {
        return jest.fn((options = {}) => {
          capturedLoader = options.loadSchema;
          return mockAjvInstance;
        });
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      new AjvSchemaValidator({ logger: mockLogger });

      // Try to resolve an absolute URI
      const result = await capturedLoader('schema://test/absolute.json');

      // Should return the schema content
      expect(result).toEqual(targetSchema);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Found existing schema for 'schema://test/absolute.json'")
      );
    });
  });

  describe('Line 148 - Debug logging in tryResolveFromId catch', () => {
    it('should log debug message when schema retrieval throws', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockImplementation((id) => {
          if (id.includes('fragment')) {
            throw new Error('Schema retrieval failed');
          }
          return null;
        }),
        removeSchema: jest.fn(),
        schemas: {},
      };

      let capturedLoader;

      jest.doMock('ajv', () => {
        return jest.fn((options = {}) => {
          capturedLoader = options.loadSchema;
          return mockAjvInstance;
        });
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      new AjvSchemaValidator({ logger: mockLogger });

      // Try to load with fragment which will trigger the error and debug log
      await expect(
        capturedLoader('./test.json#fragment')
      ).rejects.toThrow('Cannot resolve schema reference');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Error resolving schema 'schema://living-narrative-engine/test.json#fragment': Schema retrieval failed"
        )
      );
    });
  });
});
