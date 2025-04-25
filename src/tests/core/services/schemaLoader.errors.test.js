// src/tests/core/services/schemaLoader.errors.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SchemaLoader from '../../../core/services/schemaLoader.js'; // Adjust path as needed

// --- Mocks Setup (Minimal for Error Tests) ---
const mockConfiguration = {
  getSchemaFiles: jest.fn(),
  getManifestSchemaId: jest.fn(),
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
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
};

// --- Common Test Data ---
const commonSchemaFile = 'common.schema.json';
const entitySchemaFile = 'entity.schema.json';
const manifestSchemaId = 'test://schemas/manifest'; // Needed for initial check bypass
const commonSchemaPath = `./test/schemas/${commonSchemaFile}`;
const entitySchemaPath = `./test/schemas/${entitySchemaFile}`;
const commonSchemaId = 'test://schemas/common';
const entitySchemaId = 'test://schemas/entity';
const commonSchemaData = { $id: commonSchemaId, title: 'Common Test' };
const entitySchemaData = { $id: entitySchemaId, title: 'Entity Test' }; // Used only in addSchema test
const defaultSchemaFiles = [commonSchemaFile, entitySchemaFile];

// --- Isolated Error Test Suite ---
describe('SchemaLoader - Error Handling', () => {
  let schemaLoader;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    console.log('--- Test Start ---'); // Log start of a test

    // Configure mocks for a basic 2-file scenario where loading is attempted
    mockConfiguration.getSchemaFiles.mockReturnValue(defaultSchemaFiles);
    mockConfiguration.getManifestSchemaId.mockReturnValue(manifestSchemaId);
    mockPathResolver.resolveSchemaPath.mockImplementation(filename => {
      const path = `./test/schemas/${filename}`;
      console.log(`[Config] resolveSchemaPath called for ${filename}, returning ${path}`);
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
    mockSchemaValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
      console.log(`[Validator Mock] addSchema (default) called for ID: ${schemaId}. Resolving.`);
      return undefined;
    });
    // Default fetch resolves (will be overridden in specific tests)
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      console.log(`[Fetcher Mock] fetch (default) called for path: ${path}`);
      if (path === commonSchemaPath) {
        console.log(`[Fetcher Mock] fetch resolving for: ${commonSchemaPath}`);
        return commonSchemaData;
      }
      if (path === entitySchemaPath) {
        console.log(`[Fetcher Mock] fetch resolving for: ${entitySchemaPath}`);
        return entitySchemaData; // Return valid data by default
      }
      console.error(`[Fetcher Mock] fetch throwing: Unknown path ${path}`);
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });


    // Instantiate
    console.log('Instantiating SchemaLoader...');
    schemaLoader = new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockLogger);
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
        console.log(`[Fetch Error] Fetch mock resolving for: ${commonSchemaPath}`);
        return commonSchemaData;
      }
      if (path === entitySchemaPath) {
        console.log(`[Fetch Error] Fetch mock throwing for: ${entitySchemaPath}`);
        throw fetchError;
      }
      console.error(`[Fetch Error] Fetch mock throwing: Unknown path ${path}`);
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });
    // Redundant isSchemaLoaded mock (covered by beforeEach), but ensures it's false
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Act & Assert
    console.log('[Fetch Error] Calling loadAndCompileAllSchemas...');
    await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(fetchError);
    console.log('[Fetch Error] Rejection confirmed.');

    // Assertions
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(2);
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);

    // addSchema only called for the successful one
    console.log(`[Fetch Error] Checking addSchema calls. Count: ${mockSchemaValidator.addSchema.mock.calls.length}`);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(1); // Still expects 1
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(commonSchemaData, commonSchemaId);

    // Check logs
    expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific and aggregate
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SchemaLoader: Failed to load or process schema ${entitySchemaFile} (ID: unknown, Path: ${entitySchemaPath})`,
      fetchError
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SchemaLoader: One or more configured schemas failed to load or process. Aborting.',
      fetchError
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Schema processing complete'));
    console.log('[Fetch Error] Test checks complete.');
  });

  it('[Missing $id] should reject and log error if a fetched schema is missing $id', async () => {
    console.log('Starting [Missing $id] Test');
    // Arrange
    const schemaWithoutId = {title: 'Schema Without ID'};
    const expectedErrorMsg = `Schema file ${entitySchemaFile} (at ${entitySchemaPath}) is missing required '$id' property.`;

    // !!! PROBLEM !!!
    // This assertion runs *before* you've configured the mock fetcher
    // for this specific test case. It's using the default fetcher
    // mock from beforeEach, which returns valid data.
    // await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(expectedErrorMsg);

    mockDataFetcher.fetch.mockImplementation(async (path) => {
      console.log(`[Missing $id] Fetch mock called for path: ${path}`);
      if (path === commonSchemaPath) {
        console.log(`[Missing $id] Fetch mock resolving for: ${commonSchemaPath}`);
        return commonSchemaData;
      }
      if (path === entitySchemaPath) {
        console.log(`[Missing $id] Fetch mock returning invalid data for: ${entitySchemaPath}`);
        return schemaWithoutId;
      }
      console.error(`[Missing $id] Fetch mock throwing: Unknown path ${path}`);
      throw new Error(`Mock fetch error: Unknown path ${path}`);
    });
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Act & Assert
    console.log('[Missing $id] Calling loadAndCompileAllSchemas...');
    // !!! SOLUTION !!!
    // Move the assertion HERE, *after* the mocks specific to this test are configured.
    await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(expectedErrorMsg);
    console.log('[Missing $id] Rejection confirmed.');

    // Assertions
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(2);
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);

    // addSchema only called for the valid one
    console.log(`[Missing $id] Checking addSchema calls. Count: ${mockSchemaValidator.addSchema.mock.calls.length}`);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(1); // Still expects 1
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(commonSchemaData, commonSchemaId);

    // Check error logs
    expect(mockLogger.error).toHaveBeenCalledTimes(3);
    // Specific error for missing $id (logged before the throw)
    expect(mockLogger.error).toHaveBeenCalledWith(`SchemaLoader: ${expectedErrorMsg}`); // Add prefix in the assertion
    // Generic error logged by the inner catch block
    // Generic error logged by the inner catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SchemaLoader: Failed to load or process schema ${entitySchemaFile} (ID: unknown, Path: ${entitySchemaPath})`,
      expect.objectContaining({ message: expectedErrorMsg }) // Check the error object passed
    );
    // Aggregate error logged by the outer catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SchemaLoader: One or more configured schemas failed to load or process. Aborting.',
      expect.objectContaining({ message: expectedErrorMsg }) // Check the error object passed
    );
    console.log('[Missing $id] Test checks complete.');
  });


  it('[addSchema Error] should reject and log error if validator.addSchema fails', async () => {
    console.log('Starting [addSchema Error] Test');
    // Arrange
    const addSchemaError = new Error('Invalid Schema Structure');
    mockSchemaValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
      console.log(`[addSchema Error] addSchema mock called for ID: ${schemaId}`);
      if (schemaId === commonSchemaId) {
        console.log(`[addSchema Error] addSchema mock resolving for: ${commonSchemaId}`);
        // *** Explicitly return a resolved promise for clarity ***
        return Promise.resolve(undefined);
      }
      if (schemaId === entitySchemaId) {
        console.log(`[addSchema Error] addSchema mock throwing for: ${entitySchemaId}`);
        // *** Explicitly return a rejected promise for clarity ***
        return Promise.reject(addSchemaError);
      }
      // Fallback if needed, though shouldn't be reached with current files
      console.warn(`[addSchema Error] addSchema mock called for unexpected ID: ${schemaId}`);
      return Promise.resolve(undefined);
    });
    // Redundant isSchemaLoaded mock (covered by beforeEach), but ensures it's false
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Act & Assert
    console.log('[addSchema Error] Calling loadAndCompileAllSchemas...');
    // Expect the original addSchemaError to be thrown
    await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(addSchemaError); // Still expects rejection
    console.log('[addSchema Error] Rejection confirmed.');

    // Assertions
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(2);
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);

    // addSchema attempted for both
    console.log(`[addSchema Error] Checking addSchema calls. Count: ${mockSchemaValidator.addSchema.mock.calls.length}`);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(2); // Still expects 2 attempts

    // Check logs
    expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific and aggregate
    // Specific error from addSchema failure
    expect(mockLogger.error).toHaveBeenCalledWith(
      `SchemaLoader: Failed to load or process schema ${entitySchemaFile} (ID: ${entitySchemaId}, Path: ${entitySchemaPath})`,
      addSchemaError
    );
    // Aggregate error - receives the original error
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SchemaLoader: One or more configured schemas failed to load or process. Aborting.',
      addSchemaError
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Schema processing complete'));
    console.log('[addSchema Error] Test checks complete.');
  });

});