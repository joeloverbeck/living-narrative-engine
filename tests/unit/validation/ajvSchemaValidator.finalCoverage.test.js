/**
 * @file Final tests for remaining uncovered branches in ajvSchemaValidator.js
 * @description Targets the last few uncovered lines: 76, 148, 166-170, 185, 193-202, 563, 624
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

describe('AjvSchemaValidator - Final Coverage Tests', () => {
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
    it('should handle schema resolution with fragment', async () => {
      // This line is actually covered by existing tests that use fragments
      // The ternary operator handles both cases: with and without # prefix
      // Line 76 is part of internal fragment resolution logic that's exercised
      // whenever schema references with fragments are used
      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      // Add a schema with definitions
      const schemaWithDefs = {
        $id: 'schema://test/with-definitions.json',
        definitions: {
          myString: { type: 'string', minLength: 1 },
        },
        type: 'object',
        properties: {
          name: { $ref: '#/definitions/myString' },
        },
      };

      await validator.addSchema(schemaWithDefs, schemaWithDefs.$id);

      // Validate data against the schema (which uses internal fragment resolution)
      const result = validator.validate(schemaWithDefs.$id, { name: 'test' });
      expect(result.isValid).toBe(true);
    });
  });

  describe('Line 148 - Non-Error in tryResolveFromId debug logging', () => {
    it('should log String(error) when getSchema throws non-Error', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockImplementation((id) => {
          if (id.includes('fragment')) {
            // Throw a non-Error object
            throw {
              code: 'SCHEMA_ACCESS_ERROR',
              detail: 'Cannot access schema',
            };
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

      // Try to load with fragment which triggers error
      await expect(capturedLoader('./test.json#fragment')).rejects.toThrow();

      // Check that debug was called with String(error) for non-Error object
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Error resolving schema.*\[object Object\]/)
      );
    });
  });

  describe('Lines 166-170 - Empty absoluteBaseId path', () => {
    it('should handle relative path that results in empty base', async () => {
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

      // Mock to return empty array (no schemas loaded)
      jest.spyOn(validator, 'getLoadedSchemaIds').mockReturnValue([]);

      // Try a path that after normalization might result in empty base
      await expect(capturedLoader('#fragment-only')).rejects.toThrow(
        'Cannot resolve schema reference'
      );
    });
  });

  describe('Lines 185, 193-202 - Fallback search with relativeBasePath', () => {
    it('should search loaded schemas and log when match found', async () => {
      jest.resetModules();

      const targetSchema = { type: 'number' };

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest
          .fn()
          .mockReturnValueOnce(null) // First absolute try fails
          .mockReturnValueOnce({ schema: targetSchema }), // Fallback succeeds
        removeSchema: jest.fn(),
        schemas: {
          'schema://custom/path/types/common.json': { schema: targetSchema },
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

      // Mock getLoadedSchemaIds to return schemas
      jest
        .spyOn(validator, 'getLoadedSchemaIds')
        .mockReturnValue(['schema://custom/path/types/common.json']);

      // Request relative path
      const result = await capturedLoader('../types/common.json');

      expect(result).toEqual(targetSchema);

      // Check that debug logging happened for the match found
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /Found schema.*schema:\/\/custom\/path\/types\/common\.json.*matching relative path/
        )
      );
    });
  });

  describe('Line 563 - Non-Error in getValidator warn logging', () => {
    it('should log String(error) when getSchema throws non-Error', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockImplementation(() => {
          // Throw a non-Error (string)
          throw 'Schema access failed';
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

      const result = validator.getValidator('schema://test/error.json');

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Error accessing schema.*Schema access failed/),
        expect.objectContaining({
          schemaId: 'schema://test/error.json',
        })
      );
    });
  });

  describe('Line 624 - schemas map fallback to empty object', () => {
    it('should handle case where ajv.schemas is undefined', async () => {
      jest.resetModules();

      const mockAjvInstance = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockImplementation(() => {
          throw new Error('Schema not accessible');
        }),
        removeSchema: jest.fn(),
        // schemas property is undefined, not an object
      };

      // Make schemas undefined
      Object.defineProperty(mockAjvInstance, 'schemas', {
        get() {
          return undefined;
        },
        configurable: true,
      });

      jest.doMock('ajv', () => {
        return jest.fn(() => mockAjvInstance);
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator = (
        await import('../../../src/validation/ajvSchemaValidator.js')
      ).default;

      const validator = new AjvSchemaValidator({ logger: mockLogger });

      // This should use the || {} fallback
      const isLoaded = validator.isSchemaLoaded('schema://test/any.json');

      // Should return false (schema not in empty map)
      expect(isLoaded).toBe(false);
    });
  });
});
