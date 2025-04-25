// src/tests/core/services/genericContentLoader.fetchError.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import GenericContentLoader from '../../../core/services/genericContentLoader.js'; // Adjust path if this file is moved

// --- Mock Interfaces (Type Hinting Only) ---
/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/coreServices.js').ValidationResult} ValidationResult */

describe('GenericContentLoader - Fetch Error Test', () => {
  // --- Mock Variables ---
  /** @type {jest.Mocked<IConfiguration>} */
  let mockConfiguration;
  /** @type {jest.Mocked<IPathResolver>} */
  let mockPathResolver;
  /** @type {jest.Mocked<IDataFetcher>} */
  let mockDataFetcher;
  /** @type {jest.Mocked<ISchemaValidator>} */
  let mockSchemaValidator;
  /** @type {jest.Mocked<IDataRegistry>} */
  let mockDataRegistry;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {GenericContentLoader} */
  let contentLoader;

  // --- Test Constants ---
  const ITEMS_SCHEMA_ID = 'test://schemas/item';
  // Add other schema IDs if needed by future tests in this file, though only ITEMS_SCHEMA_ID is needed for this test.
  // const TRIGGERS_SCHEMA_ID = 'test://schemas/trigger';
  // const WEAPONS_SCHEMA_ID = 'test://schemas/weapon';
  // const ACTIONS_SCHEMA_ID = 'test://schemas/action';

  beforeEach(() => {
    // [x] Mock Dependencies
    mockConfiguration = {
      getContentTypeSchemaId: jest.fn(),
      // Dummy implementations for other IConfiguration methods (required by constructor checks)
      getBaseDataPath: jest.fn(),
      getSchemaFiles: jest.fn(),
      getManifestSchemaId: jest.fn(),
      getSchemaBasePath: jest.fn(),
      getContentBasePath: jest.fn(),
      getWorldBasePath: jest.fn(),
    };
    mockPathResolver = {
      resolveContentPath: jest.fn(),
      // Dummy implementations for other IPathResolver methods
      resolveSchemaPath: jest.fn(),
      resolveManifestPath: jest.fn(),
    };
    mockDataFetcher = {
      fetch: jest.fn(),
    };
    mockSchemaValidator = {
      addSchema: jest.fn(),
      getValidator: jest.fn(),
      isSchemaLoaded: jest.fn(),
      validate: jest.fn(), // <--- ADD THIS LINE
    };
    mockDataRegistry = {
      store: jest.fn(),
      get: jest.fn(),
      // Dummy implementations for other IDataRegistry methods
      getAll: jest.fn(),
      clear: jest.fn(),
      getManifest: jest.fn(),
      setManifest: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // [x] Configure Mocks - Basic Setup
    mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
      switch (typeName) {
        case 'items':
          return ITEMS_SCHEMA_ID;
          // Add other cases if needed
        default:
          return undefined;
      }
    });
    mockPathResolver.resolveContentPath.mockImplementation(
      (typeName, filename) => `./test/data/${typeName}/${filename}`
    );
    // Default mock behavior (can be overridden in tests)
    mockDataRegistry.get.mockReturnValue(undefined); // Assume no duplicates by default

    // Instantiate the loader with mocks
    contentLoader = new GenericContentLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator, // Now passing the complete mock
      mockDataRegistry,
      mockLogger
    );

    // Verify constructor logs info message (happens once per instantiation)
    expect(mockLogger.info).toHaveBeenCalledWith('GenericContentLoader: Instance created and services injected.');
    // Clear the constructor call from mock history for cleaner test-specific checks
    mockLogger.info.mockClear();
  });

  // =======================================================
  // --- Task: Test Scenario: Fetch Error (One File) ---
  // =======================================================
  it('[Fetch Error] should reject and log error if fetching one file fails', async () => {
    // Arrange
    const typeName = 'items';
    const filenames = ['item1.json', 'item2.json'];
    const item1Path = `./test/data/${typeName}/${filenames[0]}`;
    const item2Path = `./test/data/${typeName}/${filenames[1]}`;
    const item1Data = {id: 'item1_id', name: 'Potion', value: 10};
    const fetchError = new Error('File not found');
    const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null}); // Validator needed for successful file

    mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      if (path === item1Path) return item1Data;
      if (path === item2Path) throw fetchError;
      throw new Error(`Unexpected fetch path: ${path}`);
    });

    // Act & Assert rejection
    await expect(contentLoader.loadContentFiles(typeName, filenames))
      .rejects.toThrow(`Error processing ${typeName} file ${filenames[1]} at path ${item2Path}: ${fetchError.message}`);

    // Assert Service Interactions & Logging
    // Verify Service Interactions leading up to error
    expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
    expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(ITEMS_SCHEMA_ID);
    expect(mockPathResolver.resolveContentPath).toHaveBeenCalledWith(typeName, filenames[0]);
    expect(mockPathResolver.resolveContentPath).toHaveBeenCalledWith(typeName, filenames[1]);
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(item1Path);
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(item2Path);

    // Verify processing of the successful file
    expect(mockValidate).toHaveBeenCalledWith(item1Data); // item1 validation should occur
    expect(mockValidate).toHaveBeenCalledTimes(1); // Only called for the successful one

    expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item1Data.id); // item1 check should occur
    expect(mockDataRegistry.get).toHaveBeenCalledTimes(1); // Only called for item1

    // Verify store was called for the successful file.
    expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item1Data.id, item1Data);
    expect(mockDataRegistry.store).toHaveBeenCalledTimes(1); // Only for the successful one

    // Verify Logging
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item1Path}`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item2Path}`)); // Processing starts

    // Verify the FIRST error log call (logs the specific file failure)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to load/process file ${filenames[1]} (type ${typeName}, path: ${item2Path})`),
      fetchError // The second argument should be the original error object that was caught
    );

    // --- FIX for the user's reported error ---
    // The original test asserted that the logged error *message* contained the *re-thrown* error's message.
    // However, the logger is called with the *original* caught error (`WorkspaceError`).
    // This assertion verifies the message of the actual error object passed to the logger.
    expect(mockLogger.error.mock.calls[0][1].message).toBe(fetchError.message); // Should correctly be "File not found"

    // Verify the SECOND error log call (logs the aggregate failure for the type)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to load one or more files for content type '${typeName}'`),
      expect.any(Error) // The aggregate error from Promise.all rejection (which wraps the re-thrown error)
    );
    // Optionally, check the message of the error in the second log call:
    expect(mockLogger.error.mock.calls[1][1].message).toBe(`Error processing ${typeName} file ${filenames[1]} at path ${item2Path}: ${fetchError.message}`);


    // Ensure success message was NOT logged
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
    expect(mockLogger.error).toHaveBeenCalledTimes(2); // One for the specific file, one for the aggregate failure
  });

  // Add other tests here if needed, or keep it focused on this one scenario.

});