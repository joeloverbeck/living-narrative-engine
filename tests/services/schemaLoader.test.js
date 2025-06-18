// src/tests/services/schemaLoader.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import SchemaLoader from '../../src/loaders/schemaLoader.js'; // Adjust path as needed

// --- Mocks Setup ---

// Mock Interface Implementations using jest.fn()
const mockConfiguration = {
  getSchemaFiles: jest.fn(),
  getContentTypeSchemaId: jest.fn(), // Add other methods if SchemaLoader constructor checks them, though not used in loadAndCompileAllSchemas directly
  getBaseDataPath: jest.fn(),
  getSchemaBasePath: jest.fn(),
  getContentBasePath: jest.fn(),
};

const mockPathResolver = {
  resolveSchemaPath: jest.fn(), // Add other methods if needed by other parts (not needed for this test)
  resolveContentPath: jest.fn(),
};

const mockDataFetcher = {
  fetch: jest.fn(),
};

const mockSchemaValidator = {
  addSchema: jest.fn(),
  isSchemaLoaded: jest.fn(), // Add getValidator if constructor checks it (not used in loadAndCompileAllSchemas)
  getValidator: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Test Suite ---

describe('SchemaLoader', () => {
  let schemaLoader;

  // Test Data
  const commonSchemaFile = 'common.schema.json';
  const entityDefinitionSchemaFile = 'entity-definition.schema.json';
  const entityInstanceSchemaFile = 'entity-instance.schema.json';
  const manifestSchemaFile = 'manifest.schema.json'; // Added for verification tests

  const commonSchemaPath = `./test/schemas/${commonSchemaFile}`;
  const entityDefinitionSchemaPath = `./test/schemas/${entityDefinitionSchemaFile}`;
  const entityInstanceSchemaPath = `./test/schemas/${entityInstanceSchemaFile}`;
  const manifestSchemaPath = `./test/schemas/${manifestSchemaFile}`;

  const commonSchemaId = 'test://schemas/common';
  const entityDefinitionSchemaId = 'test://schemas/entity-definition';
  const entityInstanceSchemaId = 'test://schemas/entity-instance';
  const manifestSchemaId = 'test://schemas/manifest';

  const commonSchemaData = { $id: commonSchemaId, title: 'Common Test' };
  const entityDefinitionSchemaData = { $id: entityDefinitionSchemaId, title: 'Entity Definition Test' };
  const entityInstanceSchemaData = { $id: entityInstanceSchemaId, title: 'Entity Instance Test' };
  const manifestSchemaData = { $id: manifestSchemaId, title: 'Manifest Test' };

  // Simpler setup, add more files/IDs if tests specifically require them
  const defaultSchemaFiles = [commonSchemaFile, entityDefinitionSchemaFile, entityInstanceSchemaFile];

  // Helper to reset mocks and setup default behaviors
  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful mock configuration
    mockConfiguration.getSchemaFiles.mockReturnValue([...defaultSchemaFiles]); // Use spread to avoid modifying original
    mockConfiguration.getContentTypeSchemaId.mockReturnValue('some-id');

    mockPathResolver.resolveSchemaPath.mockImplementation(
      (filename) => `./test/schemas/${filename}`
    );

    // Default mock implementations
    mockSchemaValidator.addSchema.mockResolvedValue(undefined); // Assume success
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false); // Assume not loaded by default
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      if (path === commonSchemaPath) return commonSchemaData;
      if (path === entityDefinitionSchemaPath) return entityDefinitionSchemaData;
      if (path === entityInstanceSchemaPath) return entityInstanceSchemaData;
      if (path === manifestSchemaPath) return manifestSchemaData;
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });

    // Instantiate the SchemaLoader with mocks
    schemaLoader = new SchemaLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockLogger
    );
    // Clear constructor log call immediately AFTER instantiation
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
  });

  // --- Test Scenarios ---

  // REMOVED: Test '[Skip Loading] should skip loading if manifest schema is already loaded'
  // This test is invalid because the loader logic no longer checks the manifest upfront to skip all loading.

  it('[No Schema Files] should resolve successfully and log warning if no schema files are configured', async () => {
    // Arrange
    mockConfiguration.getSchemaFiles.mockReturnValue([]); // No files

    // Act
    await expect(
      schemaLoader.loadAndCompileAllSchemas()
    ).resolves.toBeUndefined();

    // Assert
    expect(mockConfiguration.getSchemaFiles).toHaveBeenCalledTimes(1);
    // Crucially, none of the loading machinery should be called
    expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
    expect(mockPathResolver.resolveSchemaPath).not.toHaveBeenCalled();
    expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
    expect(mockSchemaValidator.addSchema).not.toHaveBeenCalled();

    // Check logs (This test remains correct)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'SchemaLoader: No schema files listed in configuration. Skipping schema loading.'
    );
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).not.toHaveBeenCalled(); // Constructor log was cleared
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // REMOVED: Test 'should handle case where manifestSchemaId is not configured'
  // This test is invalid because the loader logic no longer uses getManifestSchemaId during loading.

  it('should not try to add a schema if it is already loaded', async () => {
    // Arrange
    const filesToLoad = [commonSchemaFile, entityDefinitionSchemaFile];
    mockConfiguration.getSchemaFiles.mockReturnValue(filesToLoad);

    // Setup mocks: commonSchema is loaded, entityDefinitionSchema is not
    mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => {
      return id === commonSchemaId; // Only common is loaded
    });
    // Ensure fetch mock covers both files
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      if (path === commonSchemaPath) return commonSchemaData;
      if (path === entityDefinitionSchemaPath) return entityDefinitionSchemaData;
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });

    // Act
    await expect(
      schemaLoader.loadAndCompileAllSchemas()
    ).resolves.toBeUndefined();

    // Assert
    expect(mockConfiguration.getSchemaFiles).toHaveBeenCalledTimes(1);
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(
      filesToLoad.length
    ); // Called for both
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(filesToLoad.length); // Called for both

    // isSchemaLoaded is checked for *both* schemas before trying to add
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledTimes(
      filesToLoad.length
    );
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(
      commonSchemaId
    );
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(
      entityDefinitionSchemaId
    );

    // Only adds the one not already loaded (entitySchema)
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(1);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      entityDefinitionSchemaData,
      entityDefinitionSchemaId
    );
    expect(mockSchemaValidator.addSchema).not.toHaveBeenCalledWith(
      commonSchemaData,
      commonSchemaId
    );

    // Check logs - *** UPDATED Assertions ***
    // Check the initial processing log
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `SchemaLoader: Processing ${filesToLoad.length} schemas listed in configuration...`
    );

    // Check the debug log for skipping the loaded schema
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `SchemaLoader: Schema '${commonSchemaId}' from ${commonSchemaFile} already loaded. Skipping addition.`
    );

    // Check final success log message (only 1 *new* schema was added)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Schema processing complete. Added 1 new schemas')
    );
    // Ensure only expected logs were called
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // Test for missing $id (New test based on the updated code)
  it('should throw and log error if a schema file is missing $id', async () => {
    // Arrange
    const badSchemaFile = 'bad.schema.json';
    const badSchemaPath = './test/schemas/bad.schema.json';
    const badSchemaData = { title: 'Missing ID Test' }; // No $id

    mockConfiguration.getSchemaFiles.mockReturnValue([
      commonSchemaFile,
      badSchemaFile,
    ]);
    mockPathResolver.resolveSchemaPath.mockImplementation(
      (filename) => `./test/schemas/${filename}`
    );
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      if (path === commonSchemaPath) return commonSchemaData;
      if (path === badSchemaPath) return badSchemaData;
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });
    // commonSchema is not loaded initially
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Act & Assert
    await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(
      `Schema file ${badSchemaFile} (at ${badSchemaPath}) is missing required '$id' property.`
    );

    // Assert logs
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SchemaLoader: Schema file ${badSchemaFile} (at ${badSchemaPath}) is missing required '$id' property.`
    );
    // Check the final error log from the Promise.all catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'SchemaLoader: One or more configured schemas failed to load or process. Aborting.'
      ),
      expect.any(Error) // Check that the second argument is an error object
    );

    // Verify processing stopped (addSchema might be called for commonSchema before the error)
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(1); // Only commonSchema added before failure
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      commonSchemaData,
      commonSchemaId
    );
  });

  // Optional: Test constructor dependency validation (These should still pass)
  describe('Constructor Dependency Validation', () => {
    // No changes needed here assuming constructor checks remain valid
    it('should throw error if configuration is missing or invalid', () => {
      expect(
        () =>
          new SchemaLoader(
            null,
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            mockLogger
          )
      ).toThrow(/configuration/i);
      expect(
        () =>
          new SchemaLoader(
            {},
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            mockLogger
          )
      ).toThrow(/configuration/i);
      // Check specific function existence based on constructor checks
      const invalidConfig = { ...mockConfiguration, getSchemaFiles: undefined };
      expect(
        () =>
          new SchemaLoader(
            invalidConfig,
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            mockLogger
          )
      ).toThrow(/configuration/i);
    });
    it('should throw error if pathResolver is missing or invalid', () => {
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            null,
            mockDataFetcher,
            mockSchemaValidator,
            mockLogger
          )
      ).toThrow(/pathResolver/i);
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            {},
            mockDataFetcher,
            mockSchemaValidator,
            mockLogger
          )
      ).toThrow(/pathResolver/i);
    });
    it('should throw error if fetcher is missing or invalid', () => {
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            null,
            mockSchemaValidator,
            mockLogger
          )
      ).toThrow(/fetcher/i);
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            {},
            mockSchemaValidator,
            mockLogger
          )
      ).toThrow(/fetcher/i);
    });
    it('should throw error if validator is missing or invalid', () => {
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            null,
            mockLogger
          )
      ).toThrow(/validator/i);
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            {},
            mockLogger
          )
      ).toThrow(/validator/i);
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            { addSchema: jest.fn() },
            mockLogger
          )
      ).toThrow(/validator/i); // Missing isSchemaLoaded
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            { isSchemaLoaded: jest.fn() },
            mockLogger
          )
      ).toThrow(/validator/i); // Missing addSchema
    });
    it('should throw error if logger is missing or invalid', () => {
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            null
          )
      ).toThrow(/logger/i);
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            {}
          )
      ).toThrow(/logger/i);
      expect(
        () =>
          new SchemaLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            { info: jest.fn() }
          )
      ).toThrow(/logger/i); // Missing error
    });
  });
});
