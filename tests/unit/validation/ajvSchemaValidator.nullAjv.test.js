/**
 * @file Unit tests for AjvSchemaValidator covering uncovered lines
 * @description Tests specific error conditions and edge cases
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';

/**
 * Creates a mock logger for testing
 *
 * @returns {object} Mock logger with all required methods
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/** Utility to reset module mocks after each test */
afterEach(() => {
  jest.resetModules();
  jest.dontMock('ajv');
  jest.dontMock('ajv-formats');
});

describe('AjvSchemaValidator Missing Coverage Tests', () => {
  describe('Constructor failure handling', () => {
    it('should handle Ajv constructor failure during initialization', () => {
      // Mock Ajv constructor to fail
      jest.doMock('ajv', () => {
        return jest.fn(() => {
          throw new Error('Ajv constructor failed');
        });
      });
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator =
        require('../../../src/validation/ajvSchemaValidator.js').default;
      const logger = createMockLogger();

      expect(() => new AjvSchemaValidator({ logger })).toThrow(
        'AjvSchemaValidator: Failed to initialize Ajv.'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'AjvSchemaValidator: CRITICAL - Failed to instantiate Ajv or add formats:',
        expect.any(Error)
      );
    });
  });

  describe('preloadSchemas existing schema check - Line 316', () => {
    it('should skip adding schema when it already exists', () => {
      const mockAjv = {
        addSchema: jest.fn(),
        getSchema: jest.fn().mockReturnValue({ existing: 'schema' }),
        removeSchema: jest.fn(),
        schemas: {},
      };

      jest.doMock('ajv', () => jest.fn(() => mockAjv));
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator =
        require('../../../src/validation/ajvSchemaValidator.js').default;
      const logger = createMockLogger();
      const validator = new AjvSchemaValidator({ logger });

      const schemas = [{ schema: { type: 'object' }, id: 'existing-schema' }];

      validator.preloadSchemas(schemas);

      expect(mockAjv.addSchema).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        "AjvSchemaValidator: Schema 'existing-schema' already loaded. Skipping."
      );
    });
  });

  describe('getLoadedSchemaIds null ajv check - Line 534', () => {
    it('should return empty array when ajv is null', () => {
      const mockAjv = {
        addSchema: jest.fn(),
        getSchema: jest.fn(),
        removeSchema: jest.fn(),
        schemas: {},
      };

      jest.doMock('ajv', () => jest.fn(() => mockAjv));
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator =
        require('../../../src/validation/ajvSchemaValidator.js').default;
      const logger = createMockLogger();
      const validator = new AjvSchemaValidator({ logger });

      // Test with schemas being null
      mockAjv.schemas = null;
      // Mock the internal ajv to be null for this specific test
      Object.defineProperty(validator, '_AjvSchemaValidator__ajv', {
        value: null,
        writable: true,
        configurable: true,
      });

      const result = validator.getLoadedSchemaIds();

      expect(result).toEqual([]);
    });
  });

  describe('Error handling when schemas fail', () => {
    it('should handle error in getLoadedSchemaIds', () => {
      const mockAjv = {
        addSchema: jest.fn(),
        getSchema: jest.fn(),
        removeSchema: jest.fn(),
        get schemas() {
          throw new Error('Schema access failed');
        },
      };

      jest.doMock('ajv', () => jest.fn(() => mockAjv));
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator =
        require('../../../src/validation/ajvSchemaValidator.js').default;
      const logger = createMockLogger();
      const validator = new AjvSchemaValidator({ logger });

      const result = validator.getLoadedSchemaIds();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'AjvSchemaValidator: Error getting loaded schema IDs',
        { error: expect.any(Error) }
      );
    });

    it('should handle preload schema error during construction', () => {
      const mockAjv = {
        addSchema: jest.fn(() => {
          throw new Error('Preload failed');
        }),
        getSchema: jest.fn(() => null),
        removeSchema: jest.fn(),
        schemas: {},
      };

      jest.doMock('ajv', () => jest.fn(() => mockAjv));
      jest.doMock('ajv-formats', () => jest.fn());

      const AjvSchemaValidator =
        require('../../../src/validation/ajvSchemaValidator.js').default;
      const logger = createMockLogger();

      const preloadSchemas = [
        { schema: { type: 'object' }, id: 'test-schema' },
      ];

      // This should not throw, just log the error
      const validator = new AjvSchemaValidator({
        logger,
        preloadSchemas,
      });

      expect(validator).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to preload schema'),
        expect.objectContaining({
          schemaId: expect.any(String),
          error: expect.any(Error),
        })
      );
    });
  });
});
