// src/tests/services/schemaLoader.errors.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SchemaLoader from '../../src/loaders/schemaLoader.js'; // Adjust path as needed

// --- Mocks Setup (Minimal for Error Tests) ---
const mockConfiguration = {
  getSchemaFiles: jest.fn(),
  // getContentTypeSchemaId not needed for these tests based on current SchemaLoader
};
const mockPathResolver = {
  resolveSchemaPath: jest.fn(),
};
const mockDataFetcher = {
  fetch: jest.fn(),
};
const mockSchemaValidator = {
  addSchema: jest.fn(),
  isSchemaLoaded: jest.fn(),
};
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Common Test Data ---
const commonSchemaFile = 'common.schema.json';
const entityDefinitionSchemaFile = 'entity-definition.schema.json';
const entityInstanceSchemaFile = 'entity-instance.schema.json';
const manifestSchemaId = 'test://schemas/manifest'; // Needed for initial check bypass
const commonSchemaPath = `./test/schemas/${commonSchemaFile}`;
const entityDefinitionSchemaPath = `./test/schemas/${entityDefinitionSchemaFile}`;
const entityInstanceSchemaPath = `./test/schemas/${entityInstanceSchemaFile}`;
const commonSchemaId = 'test://schemas/common';
const entityDefinitionSchemaId = 'test://schemas/entity-definition';
const entityInstanceSchemaId = 'test://schemas/entity-instance';
const commonSchemaData = { $id: commonSchemaId, title: 'Common Test' };
const entityDefinitionSchemaData = { $id: entityDefinitionSchemaId, title: 'Entity Definition Test' };
const entityInstanceSchemaData = { $id: entityInstanceSchemaId, title: 'Entity Instance Test' };
const defaultSchemaFiles = [commonSchemaFile, entityDefinitionSchemaFile, entityInstanceSchemaFile];

// --- Isolated Error Test Suite ---
describe('SchemaLoader - Error Handling', () => {
  let schemaLoader;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    console.log('--- Test Start ---'); // Log start of a test

    // Configure mocks for a basic 2-file scenario where loading is attempted
    mockConfiguration.getSchemaFiles.mockReturnValue(defaultSchemaFiles);
    mockPathResolver.resolveSchemaPath.mockImplementation((filename) => {
      const path = `./test/schemas/${filename}`;
      console.log(
        `[Config] resolveSchemaPath called for ${filename}, returning ${path}`
      );
      return path;
    });
    // Ensure loading isn't skipped and addSchema *can* be called
    mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => {
      console.log(`[Validator Mock] isSchemaLoaded called for ID: ${id}`);
      // Simulate manifest not loaded initially, other schemas not loaded unless added
      // For simplicity in error tests, assume nothing is loaded beforehand unless specified
      return false;
    });
    // Default addSchema resolves (will be overridden in specific test)
    mockSchemaValidator.addSchema.mockImplementation(
      async (schemaData, schemaId) => {
        console.log(
          `[Validator Mock] addSchema (default) called for ID: ${schemaId}. Resolving.`
        );
        return undefined;
      }
    );
    // Default fetch resolves (will be overridden in specific tests)
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      console.log(`[Fetcher Mock] fetch (default) called for path: ${path}`);
      if (path === commonSchemaPath) {
        console.log(`[Fetcher Mock] fetch resolving for: ${commonSchemaPath}`);
        return commonSchemaData;
      }
      if (path === entityDefinitionSchemaPath) {
        console.log(`[Fetcher Mock] fetch resolving for: ${entityDefinitionSchemaPath}`);
        return entityDefinitionSchemaData;
      }
      if (path === entityInstanceSchemaPath) {
        console.log(`[Fetcher Mock] fetch resolving for: ${entityInstanceSchemaPath}`);
        return entityInstanceSchemaData;
      }
      console.error(`[Fetcher Mock] fetch throwing: Unknown path ${path}`);
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });

    // Instantiate
    console.log('Instantiating SchemaLoader...');
    schemaLoader = new SchemaLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockLogger
    );
    mockLogger.info.mockClear(); // Clear constructor log
  });

  afterEach(() => {
    console.log('--- Test End --- \n'); // Log end of a test
  });

  it('[Fetch Error] should reject and log error if fetching a schema fails', async () => {
    console.log('Starting [Fetch Error] Test');
    // Arrange
    const fetchError = new Error('Network Error');
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      console.log(`[Fetch Error] Fetch mock called for path: ${path}`);
      if (path === commonSchemaPath) {
        console.log(
          `[Fetch Error] Fetch mock resolving for: ${commonSchemaPath}`
        );
        return commonSchemaData;
      }
      if (path === entityDefinitionSchemaPath) {
        console.log(
          `[Fetch Error] Fetch mock throwing for: ${entityDefinitionSchemaPath}`
        );
        throw fetchError;
      }
      if (path === entityInstanceSchemaPath) {
        return entityInstanceSchemaData;
      }
      console.error(`[Fetch Error] Fetch mock throwing: Unknown path ${path}`);
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });
    // Redundant isSchemaLoaded mock (covered by beforeEach), but ensures it's false
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Act & Assert
    console.log('[Fetch Error] Calling loadAndCompileAllSchemas...');
    await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(
      fetchError
    );
    console.log('[Fetch Error] Rejection confirmed.');

    // Assertions
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(defaultSchemaFiles.length);
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(defaultSchemaFiles.length);

    // addSchema only called for the successful one(s) before failure
    console.log(
      `[Fetch Error] Checking addSchema calls. Count: ${mockSchemaValidator.addSchema.mock.calls.length}`
    );
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      commonSchemaData,
      commonSchemaId
    );
    expect(mockSchemaValidator.addSchema).not.toHaveBeenCalledWith(
      entityDefinitionSchemaData,
      entityDefinitionSchemaId
    );

    // Check logs
    expect(mockLogger.error).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SchemaLoader: Failed to load or process schema ${entityDefinitionSchemaFile} (ID: unknown, Path: ${entityDefinitionSchemaPath})`,
      fetchError
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SchemaLoader: One or more configured schemas failed to load or process. Aborting.',
      fetchError
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Schema processing complete')
    );
    console.log('[Fetch Error] Test checks complete.');
  });

  it('[Missing $id] should reject and log error if a fetched schema is missing $id', async () => {
    console.log('Starting [Missing $id] Test');
    // Arrange
    const schemaWithoutId = { title: 'Schema Without ID' };
    const expectedErrorMsg = `Schema file ${entityDefinitionSchemaFile} (at ${entityDefinitionSchemaPath}) is missing required '$id' property.`;

    mockDataFetcher.fetch.mockImplementation(async (path) => {
      console.log(`[Missing $id] Fetch mock called for path: ${path}`);
      if (path === commonSchemaPath) {
        console.log(
          `[Missing $id] Fetch mock resolving for: ${commonSchemaPath}`
        );
        return commonSchemaData;
      }
      if (path === entityDefinitionSchemaPath) {
        console.log(
          `[Missing $id] Fetch mock returning invalid data for: ${entityDefinitionSchemaPath}`
        );
        return schemaWithoutId;
      }
      if (path === entityInstanceSchemaPath) {
        return entityInstanceSchemaData;
      }
      console.error(`[Missing $id] Fetch mock throwing: Unknown path ${path}`);
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Act & Assert
    console.log('[Missing $id] Calling loadAndCompileAllSchemas...');
    await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(
      expectedErrorMsg
    );
    console.log('[Missing $id] Rejection confirmed.');

    // Assertions
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(defaultSchemaFiles.length);
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(defaultSchemaFiles.length);

    // addSchema only called for the valid one
    console.log(
      `[Missing $id] Checking addSchema calls. Count: ${mockSchemaValidator.addSchema.mock.calls.length}`
    );
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(2);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      commonSchemaData,
      commonSchemaId
    );
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      entityInstanceSchemaData,
      entityInstanceSchemaId
    );

    // Check error logs
    expect(mockLogger.error).toHaveBeenCalledTimes(3);
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SchemaLoader: ${expectedErrorMsg}`
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SchemaLoader: Failed to load or process schema ${entityDefinitionSchemaFile} (ID: unknown, Path: ${entityDefinitionSchemaPath})`,
      expect.objectContaining({ message: expectedErrorMsg })
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SchemaLoader: One or more configured schemas failed to load or process. Aborting.',
      expect.objectContaining({ message: expectedErrorMsg })
    );
    console.log('[Missing $id] Test checks complete.');
  });

  it('[addSchema Error] should reject and log error if validator.addSchema fails', async () => {
    console.log('Starting [addSchema Error] Test');
    // Arrange
    const addSchemaError = new Error('Invalid Schema Structure');
    mockSchemaValidator.addSchema.mockImplementation(
      async (schemaData, schemaId) => {
        console.log(
          `[addSchema Error] addSchema mock called for ID: ${schemaId}`
        );
        if (schemaId === commonSchemaId) {
          console.log(
            `[addSchema Error] addSchema resolving for ${commonSchemaId}`
          );
          return undefined;
        }
        if (schemaId === entityDefinitionSchemaId) {
          console.log(
            `[addSchema Error] addSchema throwing for ${entityDefinitionSchemaId}`
          );
          throw addSchemaError;
        }
        if (schemaId === entityInstanceSchemaId) {
          return undefined;
        }
        return undefined;
      }
    );
    // Redundant isSchemaLoaded mock (covered by beforeEach), but ensures it's false
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Act & Assert
    console.log('[addSchema Error] Calling loadAndCompileAllSchemas...');
    await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(
      addSchemaError
    );
    console.log('[addSchema Error] Rejection confirmed.');

    // Assertions
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(defaultSchemaFiles.length);
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(defaultSchemaFiles.length);

    // addSchema attempted for all
    console.log(
      `[addSchema Error] Checking addSchema calls. Count: ${mockSchemaValidator.addSchema.mock.calls.length}`
    );
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(defaultSchemaFiles.length);

    // Check logs
    expect(mockLogger.error).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SchemaLoader: Failed to load or process schema ${entityDefinitionSchemaFile} (ID: ${entityDefinitionSchemaId}, Path: ${entityDefinitionSchemaPath})`,
      addSchemaError
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SchemaLoader: One or more configured schemas failed to load or process. Aborting.',
      addSchemaError
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Schema processing complete')
    );
    console.log('[addSchema Error] Test checks complete.');
  });
});
