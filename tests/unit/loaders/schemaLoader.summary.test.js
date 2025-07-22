// tests/unit/loaders/schemaLoader.summary.test.js

/**
 * @file Unit tests for SchemaLoader summary functionality
 * Tests coverage for lines 182-217 (getSchemaLoadingSummary method)
 * and lines 170-174 (summary logging with getLoadedSchemaIds)
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';

describe('SchemaLoader - Summary Functionality', () => {
  let schemaLoader;
  let mockConfiguration;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockLogger;

  // Test data
  const testSchemaFiles = ['schema1.json', 'schema2.json'];
  const testSchemaData = [
    { $id: 'test://schema1', title: 'Schema 1' },
    { $id: 'test://schema2', title: 'Schema 2' },
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
      isSchemaLoaded: jest.fn(),
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

  describe('Summary logging during loadAndCompileAllSchemas (lines 170-174)', () => {
    it('should log schema summary when getLoadedSchemaIds method exists', async () => {
      // Arrange
      const loadedSchemaIds = ['test://schema1', 'test://schema2', 'test://schema3'];
      mockSchemaValidator.getLoadedSchemaIds = jest.fn().mockReturnValue(loadedSchemaIds);

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      expect(mockSchemaValidator.getLoadedSchemaIds).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `SchemaLoader: Loaded ${loadedSchemaIds.length} schemas: ${loadedSchemaIds.join(', ')}`
      );
    });

    it('should skip summary logging when getLoadedSchemaIds method does not exist', async () => {
      // Arrange
      // Don't add getLoadedSchemaIds to mockSchemaValidator (undefined by default)

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      // Verify that the summary info log doesn't appear
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('schemas:')
      );

      // Verify normal debug logs still occur
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `SchemaLoader: Processing ${testSchemaFiles.length} schemas listed in configuration (batch registration)...`
      );
    });

    it('should skip summary logging when getLoadedSchemaIds is not a function', async () => {
      // Arrange
      mockSchemaValidator.getLoadedSchemaIds = 'not-a-function';

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('schemas:')
      );
    });

    it('should handle empty schema IDs array from getLoadedSchemaIds', async () => {
      // Arrange
      mockSchemaValidator.getLoadedSchemaIds = jest.fn().mockReturnValue([]);

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      expect(mockSchemaValidator.getLoadedSchemaIds).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SchemaLoader: Loaded 0 schemas: '
      );
    });
  });

  describe('getSchemaLoadingSummary method (lines 182-217)', () => {
    it('should return basic summary with correct total configured count', () => {
      // Arrange
      // Mock isSchemaLoaded to return true for all schemas (no missing issues)
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      expect(summary).toBeDefined();
      expect(summary.totalConfigured).toBe(testSchemaFiles.length);
      expect(summary.loadedSchemas).toEqual([]);
      expect(summary.issues).toEqual([]);
    });

    it('should include loaded schemas when getLoadedSchemaIds method exists', () => {
      // Arrange
      const loadedSchemaIds = ['test://schema1', 'test://schema2'];
      mockSchemaValidator.getLoadedSchemaIds = jest.fn().mockReturnValue(loadedSchemaIds);
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      expect(mockSchemaValidator.getLoadedSchemaIds).toHaveBeenCalledTimes(1);
      expect(summary.totalConfigured).toBe(testSchemaFiles.length);
      expect(summary.loadedSchemas).toEqual(loadedSchemaIds);
      expect(summary.issues).toEqual([]);
    });

    it('should have empty loaded schemas when getLoadedSchemaIds method does not exist', () => {
      // Arrange
      // Don't add getLoadedSchemaIds method (undefined by default)
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      expect(summary.totalConfigured).toBe(testSchemaFiles.length);
      expect(summary.loadedSchemas).toEqual([]);
      expect(summary.issues).toEqual([]);
    });

    it('should detect missing critical schemas', () => {
      // Arrange
      const criticalSchemas = [
        'schema://living-narrative-engine/common.schema.json',
        'schema://living-narrative-engine/world.schema.json',
        'schema://living-narrative-engine/entity-instance.schema.json',
      ];
      
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockImplementation((schemaId) => {
        // Only the first critical schema is loaded
        return schemaId === criticalSchemas[0];
      });

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      expect(summary.issues).toContain(
        `Critical schema '${criticalSchemas[1]}' not loaded`
      );
      expect(summary.issues).toContain(
        `Critical schema '${criticalSchemas[2]}' not loaded`
      );
      expect(summary.issues).not.toContain(
        `Critical schema '${criticalSchemas[0]}' not loaded`
      );
      expect(summary.issues).toHaveLength(2);
    });

    it('should detect unresolved $refs in critical schemas when validateSchemaRefs exists', () => {
      // Arrange
      const criticalSchemas = [
        'schema://living-narrative-engine/common.schema.json',
        'schema://living-narrative-engine/world.schema.json',
        'schema://living-narrative-engine/entity-instance.schema.json',
      ];

      // All critical schemas are loaded
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
      
      // But some have invalid $refs
      mockSchemaValidator.validateSchemaRefs = jest.fn().mockImplementation((schemaId) => {
        // Only the first schema has valid refs
        return schemaId === criticalSchemas[0];
      });

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      expect(summary.issues).toContain(
        `Schema '${criticalSchemas[1]}' has unresolved $refs`
      );
      expect(summary.issues).toContain(
        `Schema '${criticalSchemas[2]}' has unresolved $refs`
      );
      expect(summary.issues).not.toContain(
        `Schema '${criticalSchemas[0]}' has unresolved $refs`
      );
      expect(summary.issues).toHaveLength(2);
    });

    it('should skip $refs validation when validateSchemaRefs method does not exist', () => {
      // Arrange
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
      // Don't add validateSchemaRefs method (undefined by default)

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      expect(summary.issues).toEqual([]);
    });

    it('should skip $refs validation when validateSchemaRefs is not a function', () => {
      // Arrange
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
      mockSchemaValidator.validateSchemaRefs = 'not-a-function';

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      expect(summary.issues).toEqual([]);
    });

    it('should detect multiple types of issues simultaneously', () => {
      // Arrange
      const criticalSchemas = [
        'schema://living-narrative-engine/common.schema.json',
        'schema://living-narrative-engine/world.schema.json',
        'schema://living-narrative-engine/entity-instance.schema.json',
      ];

      // Mixed scenario: some loaded, some not
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockImplementation((schemaId) => {
        return schemaId === criticalSchemas[0]; // Only first is loaded
      });

      // For the loaded schema, it has invalid $refs
      mockSchemaValidator.validateSchemaRefs = jest.fn().mockReturnValue(false);

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      // Should detect both missing schemas and invalid $refs
      expect(summary.issues).toContain(
        `Critical schema '${criticalSchemas[1]}' not loaded`
      );
      expect(summary.issues).toContain(
        `Critical schema '${criticalSchemas[2]}' not loaded`
      );
      expect(summary.issues).toContain(
        `Schema '${criticalSchemas[0]}' has unresolved $refs`
      );
      expect(summary.issues).toHaveLength(3);
    });

    it('should return no issues when all critical schemas are loaded with valid refs', () => {
      // Arrange
      mockSchemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
      mockSchemaValidator.validateSchemaRefs = jest.fn().mockReturnValue(true);

      // Act
      const summary = schemaLoader.getSchemaLoadingSummary();

      // Assert
      expect(summary.issues).toEqual([]);
    });

    describe('edge cases', () => {
      it('should handle empty schema files configuration', () => {
        // Arrange
        mockConfiguration.getSchemaFiles.mockReturnValue([]);

        // Act
        const summary = schemaLoader.getSchemaLoadingSummary();

        // Assert
        expect(summary.totalConfigured).toBe(0);
        expect(summary.loadedSchemas).toEqual([]);
        expect(summary.issues).toHaveLength(3); // All critical schemas will be missing
      });

      it('should handle isSchemaLoaded throwing an error', () => {
        // Arrange
        mockSchemaValidator.isSchemaLoaded = jest.fn().mockImplementation(() => {
          throw new Error('Schema validation error');
        });

        // Act & Assert
        expect(() => schemaLoader.getSchemaLoadingSummary()).toThrow(
          'Schema validation error'
        );
      });

      it('should handle validateSchemaRefs throwing an error', () => {
        // Arrange
        mockSchemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
        mockSchemaValidator.validateSchemaRefs = jest.fn().mockImplementation(() => {
          throw new Error('$refs validation error');
        });

        // Act & Assert
        expect(() => schemaLoader.getSchemaLoadingSummary()).toThrow(
          '$refs validation error'
        );
      });
    });
  });
});