// tests/unit/loaders/schemaLoader.refs-validation.test.js

/**
 * @file Unit tests for SchemaLoader $refs validation functionality
 * Tests coverage for lines 151-158 (validateSchemaRefs validation loop)
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';

describe('SchemaLoader - $refs Validation', () => {
  let schemaLoader;
  let mockConfiguration;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockLogger;

  // Test data
  const testSchemaFiles = ['schema1.json', 'schema2.json', 'schema3.json'];
  const testSchemaData = [
    { $id: 'test://schema1', title: 'Schema 1' },
    { $id: 'test://schema2', title: 'Schema 2' },
    { $id: 'test://schema3', title: 'Schema 3' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocks
    mockConfiguration = {
      getSchemaFiles: jest.fn().mockReturnValue(testSchemaFiles),
      getContentTypeSchemaId: jest.fn(),
      getBaseDataPath: jest.fn(),
      getSchemaBasePath: jest.fn(),
      getContentBasePath: jest.fn(),
    };

    mockPathResolver = {
      resolveSchemaPath: jest.fn().mockImplementation(
        (filename) => `./test/schemas/${filename}`
      ),
      resolveContentPath: jest.fn(),
    };

    mockDataFetcher = {
      fetch: jest.fn().mockImplementation(async (path) => {
        const index = testSchemaFiles.findIndex(
          (file) => path === `./test/schemas/${file}`
        );
        if (index !== -1) return testSchemaData[index];
        throw new Error(`Mock fetch error: Unknown path ${path}`);
      }),
    };

    mockSchemaValidator = {
      addSchema: jest.fn().mockResolvedValue(undefined),
      addSchemas: jest.fn().mockResolvedValue(undefined),
      isSchemaLoaded: jest.fn().mockReturnValue(false),
      getValidator: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Instantiate SchemaLoader
    schemaLoader = new SchemaLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockLogger
    );

    // Clear constructor logs
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
  });

  describe('validateSchemaRefs method exists', () => {
    it('should validate $refs for all schemas when validateSchemaRefs returns true (valid refs)', async () => {
      // Arrange
      mockSchemaValidator.validateSchemaRefs = jest.fn().mockReturnValue(true);

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      expect(mockSchemaValidator.validateSchemaRefs).toHaveBeenCalledTimes(3);
      
      // Verify it was called for each schema
      testSchemaData.forEach((schema) => {
        expect(mockSchemaValidator.validateSchemaRefs).toHaveBeenCalledWith(
          schema.$id
        );
      });

      // Verify debug logs for successful validation
      testSchemaData.forEach((schema) => {
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `SchemaLoader: Schema '${schema.$id}' loaded successfully with all $refs resolved.`
        );
      });

      // Verify no warning logs
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should log warnings when validateSchemaRefs returns false (invalid refs)', async () => {
      // Arrange
      mockSchemaValidator.validateSchemaRefs = jest
        .fn()
        .mockReturnValue(false);

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      expect(mockSchemaValidator.validateSchemaRefs).toHaveBeenCalledTimes(3);
      
      // Verify it was called for each schema
      testSchemaData.forEach((schema) => {
        expect(mockSchemaValidator.validateSchemaRefs).toHaveBeenCalledWith(
          schema.$id
        );
      });

      // Verify warning logs for unresolved $refs
      testSchemaData.forEach((schema) => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `SchemaLoader: Schema '${schema.$id}' loaded but has unresolved $refs. This may cause validation issues.`
        );
      });

      // Verify no debug logs for successful resolution
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('loaded successfully with all $refs resolved')
      );
    });

    it('should handle mixed validation results (some valid, some invalid refs)', async () => {
      // Arrange
      mockSchemaValidator.validateSchemaRefs = jest
        .fn()
        .mockImplementation((schemaId) => {
          // Return true for schema1, false for schema2 and schema3
          return schemaId === 'test://schema1';
        });

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      expect(mockSchemaValidator.validateSchemaRefs).toHaveBeenCalledTimes(3);

      // Verify debug log for schema1 (valid)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `SchemaLoader: Schema 'test://schema1' loaded successfully with all $refs resolved.`
      );

      // Verify warning logs for schema2 and schema3 (invalid)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SchemaLoader: Schema 'test://schema2' loaded but has unresolved $refs. This may cause validation issues.`
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SchemaLoader: Schema 'test://schema3' loaded but has unresolved $refs. This may cause validation issues.`
      );

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateSchemaRefs method does not exist', () => {
    it('should skip $refs validation when validateSchemaRefs method is undefined', async () => {
      // Arrange
      // Don't add validateSchemaRefs method to mockSchemaValidator
      // (it's undefined by default)

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      // Verify that no $refs validation logs appear
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('loaded successfully with all $refs resolved')
      );
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('has unresolved $refs')
      );

      // Verify normal processing logs still occur
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `SchemaLoader: Processing ${testSchemaFiles.length} schemas listed in configuration (batch registration)...`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `SchemaLoader: Batch schema registration complete. Added ${testSchemaFiles.length} schemas.`
      );
    });

    it('should skip $refs validation when validateSchemaRefs is not a function', async () => {
      // Arrange
      mockSchemaValidator.validateSchemaRefs = 'not-a-function';

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      // Verify that no $refs validation logs appear
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('loaded successfully with all $refs resolved')
      );
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('has unresolved $refs')
      );

      // Verify normal processing continues
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `SchemaLoader: Processing ${testSchemaFiles.length} schemas listed in configuration (batch registration)...`
      );
    });
  });

  describe('edge cases', () => {
    it('should handle validateSchemaRefs throwing an error gracefully', async () => {
      // Arrange
      const validationError = new Error('$refs validation failed');
      mockSchemaValidator.validateSchemaRefs = jest.fn().mockImplementation(() => {
        throw validationError;
      });

      // Act & Assert
      // The current implementation doesn't catch errors from validateSchemaRefs,
      // so it will propagate up. This tests the actual behavior.
      await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(
        validationError
      );

      // Verify it attempted to validate at least the first schema
      expect(mockSchemaValidator.validateSchemaRefs).toHaveBeenCalledWith(
        'test://schema1'
      );
    });

    it('should handle empty loadedSchemas array in $refs validation', async () => {
      // Arrange
      mockConfiguration.getSchemaFiles.mockReturnValue([]);
      mockSchemaValidator.validateSchemaRefs = jest.fn().mockReturnValue(true);

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      expect(mockSchemaValidator.validateSchemaRefs).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SchemaLoader: No schema files listed in configuration. Skipping schema loading.'
      );
    });
  });
});