// src/tests/core/loaders/baseManifestItemLoader.processFileWrapper.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
// Adjust the import path as necessary
import { BaseManifestItemLoader } from '../../src/loaders/baseManifestItemLoader.js';
// Assume ValidationResult type is available or mock it if needed for type checking in tests
// import { ValidationResult } from '../../../src/interfaces/validation.js'; // Example import

// --- Mock Service Factories (Keep as provided, ensure ISchemaValidator has isSchemaLoaded) ---

const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/default.schema.json'),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getContentBasePath: jest.fn((type) => `./data/${type}`),
  ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, typeName, filename) =>
      `./data/mods/${modId}/${typeName}/${filename}`
  ),
  resolveContentPath: jest.fn(
    (typeName, filename) => `./data/${typeName}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest.fn(
    (modId) => `./data/mods/${modId}/mod.manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
  resolveManifestPath: jest.fn(
    (worldName) => `./data/worlds/${worldName}.world.json`
  ),
  ...overrides,
});

const createMockDataFetcher = (overrides = {}) => ({
  fetch: jest.fn().mockResolvedValue({}),
  ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
  getValidator: jest
    .fn()
    .mockReturnValue(() => ({ isValid: true, errors: null })),
  addSchema: jest.fn().mockResolvedValue(undefined),
  removeSchema: jest.fn().mockReturnValue(true),
  isSchemaLoaded: jest.fn().mockReturnValue(true), // <<< Ensure this exists
  ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined),
  getAll: jest.fn().mockReturnValue([]),
  getAllSystemRules: jest.fn().mockReturnValue([]),
  clear: jest.fn(),
  getManifest: jest.fn().mockReturnValue(null),
  setManifest: jest.fn(),
  getEntityDefinition: jest.fn(),
  getItemDefinition: jest.fn(),
  getLocationDefinition: jest.fn(),
  getConnectionDefinition: jest.fn(),
  getBlockerDefinition: jest.fn(),
  getActionDefinition: jest.fn(),
  getEventDefinition: jest.fn(),
  getComponentDefinition: jest.fn(),
  getAllEntityDefinitions: jest.fn().mockReturnValue([]),
  getAllItemDefinitions: jest.fn().mockReturnValue([]),
  getAllLocationDefinitions: jest.fn().mockReturnValue([]),
  getAllConnectionDefinitions: jest.fn().mockReturnValue([]),
  getAllBlockerDefinitions: jest.fn().mockReturnValue([]),
  getAllActionDefinitions: jest.fn().mockReturnValue([]),
  getAllEventDefinitions: jest.fn().mockReturnValue([]),
  getAllComponentDefinitions: jest.fn().mockReturnValue([]),
  getStartingPlayerId: jest.fn().mockReturnValue(null),
  getStartingLocationId: jest.fn().mockReturnValue(null),
  ...overrides,
});

const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

// --- Shared Mocks Instance for Tests ---
let mockContentType;
let mockConfig;
let mockResolver;
let mockFetcher;
let mockValidator;
let mockRegistry;
let mockLogger;
let loader; // Instance of BaseManifestItemLoader

beforeEach(() => {
  // <<< MODIFIED: Added contentType to setup
  mockContentType = 'testType';
  mockConfig = createMockConfiguration();
  mockResolver = createMockPathResolver();
  mockFetcher = createMockDataFetcher();
  mockValidator = createMockSchemaValidator();
  mockRegistry = createMockDataRegistry();
  mockLogger = createMockLogger();

  // Reset mocks before creating the instance to avoid pollution
  jest.clearAllMocks();

  // Recreate logger mock after clearAllMocks
  mockLogger = createMockLogger();
  // Recreate validator mock after clearAllMocks (especially isSchemaLoaded)
  mockValidator = createMockSchemaValidator();
  // Recreate config mock after clearAllMocks (especially getContentTypeSchemaId)
  mockConfig = createMockConfiguration();

  // Instantiate the loader with the new signature <<< MODIFIED
  loader = new BaseManifestItemLoader(
    mockContentType,
    mockConfig,
    mockResolver,
    mockFetcher,
    mockValidator,
    mockRegistry,
    mockLogger
  );

  // Mock internal methods USED BY OTHER test suites
  // These should be restored/overridden within their specific describe blocks if testing the real method
  // Note: We don't mock _validatePrimarySchema here as we test it directly later.
  loader._extractValidFilenames = jest.fn();
  loader._processFileWrapper = jest.fn();
  loader._processFetchedItem = jest.fn();
  // Ensure loader uses the mocks we can spy on
  loader._logger = mockLogger;
  loader._schemaValidator = mockValidator;
  loader._config = mockConfig;
  loader._pathResolver = mockResolver;
  loader._dataFetcher = mockFetcher;
  loader._dataRegistry = mockRegistry;
});

// --- Test Suite ---

// --- Existing Test Suite for _processFileWrapper ---
describe('BaseManifestItemLoader _processFileWrapper', () => {
  const modId = 'test-mod';
  const filename = 'item.json';
  const contentTypeDir = 'items';
  const typeName = 'items';
  const resolvedPath = `./data/mods/${modId}/${contentTypeDir}/${filename}`;
  const mockData = { id: 'test-item', value: 123 };
  // --- MODIFIED: Mock result should match the expected object structure ---
  const mockProcessResult = {
    qualifiedId: 'test-mod:test-item',
    didOverride: false,
  };

  // Note: loader, mocks are initialized in the global beforeEach.

  beforeEach(() => {
    // Restore the real _processFileWrapper for tests in this suite
    loader._processFileWrapper =
      BaseManifestItemLoader.prototype._processFileWrapper;
    // Ensure its dependency _processFetchedItem IS mocked (done in global beforeEach)
    loader._processFetchedItem = jest.fn();
    // Ensure other dependencies are the mocks (done in global beforeEach)
    // loader._pathResolver = mockResolver;
    // loader._dataFetcher = mockFetcher;
    // loader._logger = mockLogger;
    // Clear mocks used within _processFileWrapper (also done by global beforeEach)
    // jest.clearAllMocks(); // Redundant

    // --- MODIFIED: Mock the return value of _validatePrimarySchema for this suite ---
    // Ensure it doesn't throw in success cases and returns a valid result object
    loader._validatePrimarySchema = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: null });
  });

  it('Success Path: should resolve, fetch, validate, process, log debugs, and return result', async () => {
    // --- Arrange ---
    mockResolver.resolveModContentPath.mockReturnValue(resolvedPath);
    mockFetcher.fetch.mockResolvedValue(mockData);
    // --- MODIFIED: Configure the mock to return the object ---
    loader._processFetchedItem.mockResolvedValue(mockProcessResult);

    // --- Act ---
    const result = await loader._processFileWrapper(
      modId,
      filename,
      contentTypeDir,
      typeName
    );

    // --- Assert ---
    // --- MODIFIED: Check returned value is the object ---
    expect(result).toEqual(mockProcessResult);
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      modId,
      contentTypeDir,
      filename
    );
    expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPath);
    // --- ADDED: Assert primary schema validation was called ---
    expect(loader._validatePrimarySchema).toHaveBeenCalledWith(
      mockData,
      filename,
      modId,
      resolvedPath
    );
    // --- Assert _processFetchedItem was called ---
    expect(loader._processFetchedItem).toHaveBeenCalledWith(
      modId,
      filename,
      resolvedPath,
      mockData,
      typeName
    );
    expect(mockLogger.error).not.toHaveBeenCalled(); // No errors logged

    // --- Assert Debug Logs ---
    // Use expect.stringContaining or specific calls if order is not guaranteed by implementation details outside the tested function
    // Note: Constructor logs might appear first depending on how jest handles mock calls across setup and test execution.
    // Filter constructor logs if necessary or adjust expectations.
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Resolved path for ${filename}: ${resolvedPath}`
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Fetched data from ${resolvedPath}`
    );
    // Assume _validatePrimarySchema logs its own debug message if needed. We already asserted it was called.
    // --- MODIFIED: Check the success log format ---
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Successfully processed ${filename}. Result: ID=${mockProcessResult.qualifiedId}, Overwrite=${mockProcessResult.didOverride}`
    );
  });

  it('Path Resolution Error: should log error, not fetch/process, and re-throw', async () => {
    // --- Arrange ---
    const resolutionError = new Error('Path resolution failed');
    mockResolver.resolveModContentPath.mockImplementation(() => {
      throw resolutionError;
    });

    // --- Act & Assert ---
    await expect(
      loader._processFileWrapper(modId, filename, contentTypeDir, typeName)
    ).rejects.toThrow(resolutionError); // Verify re-throw

    // Assert logging
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      {
        modId: modId,
        filename: filename,
        path: 'Path not resolved', // resolvedPath is null here
        typeName: typeName,
        error: resolutionError.message,
      },
      resolutionError // Original error object
    );

    // Assert other methods not called
    expect(mockFetcher.fetch).not.toHaveBeenCalled();
    expect(loader._validatePrimarySchema).not.toHaveBeenCalled(); // <<< ADDED check
    expect(loader._processFetchedItem).not.toHaveBeenCalled();
    // Debug logs should not have been called either (except potentially constructor logs)
  });

  it('Data Fetching Error: should log error, not process, and re-throw', async () => {
    // --- Arrange ---
    const fetchError = new Error('File not found');
    mockResolver.resolveModContentPath.mockReturnValue(resolvedPath);
    mockFetcher.fetch.mockRejectedValue(fetchError); // Simulate fetch failure

    // --- Act & Assert ---
    await expect(
      loader._processFileWrapper(modId, filename, contentTypeDir, typeName)
    ).rejects.toThrow(fetchError); // Verify re-throw

    // Assert logging
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      {
        modId: modId,
        filename: filename,
        path: resolvedPath, // Path was resolved
        typeName: typeName,
        error: fetchError.message,
      },
      fetchError // Original error object
    );

    // Assert other methods not called
    expect(loader._validatePrimarySchema).not.toHaveBeenCalled(); // <<< ADDED check
    expect(loader._processFetchedItem).not.toHaveBeenCalled();
    // Debug logs for resolve would have happened before the error
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Resolved path for ${filename}: ${resolvedPath}`
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Fetched data')
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Successfully processed')
    );
  });

  // --- ADDED: Test for _validatePrimarySchema Error ---
  it('_validatePrimarySchema Error: should log error, not process, and re-throw', async () => {
    // --- Arrange ---
    const validationError = new Error('Schema validation failed');
    mockResolver.resolveModContentPath.mockReturnValue(resolvedPath);
    mockFetcher.fetch.mockResolvedValue(mockData);
    // Simulate _validatePrimarySchema throwing an error
    loader._validatePrimarySchema = jest.fn().mockImplementation(() => {
      throw validationError;
    });

    // --- Act & Assert ---
    await expect(
      loader._processFileWrapper(modId, filename, contentTypeDir, typeName)
    ).rejects.toThrow(validationError); // Verify re-throw

    // Assert logging (Error is logged by _processFileWrapper's catch block)
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      {
        modId: modId,
        filename: filename,
        path: resolvedPath, // Path resolved, data fetched
        typeName: typeName,
        error: validationError.message,
      },
      validationError // Original error object
    );

    // Assert _processFetchedItem not called
    expect(loader._processFetchedItem).not.toHaveBeenCalled();

    // Debug logs for resolve/fetch would have happened before the error
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Resolved path for ${filename}: ${resolvedPath}`
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Fetched data from ${resolvedPath}`
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Successfully processed')
    );
  });

  it('_processFetchedItem Error: should log error and re-throw', async () => {
    // --- Arrange ---
    const processError = new Error('Processing failed');
    mockResolver.resolveModContentPath.mockReturnValue(resolvedPath);
    mockFetcher.fetch.mockResolvedValue(mockData);
    // _validatePrimarySchema should succeed (mocked in beforeEach)
    loader._processFetchedItem.mockRejectedValue(processError); // Simulate processing failure

    // --- Act & Assert ---
    await expect(
      loader._processFileWrapper(modId, filename, contentTypeDir, typeName)
    ).rejects.toThrow(processError); // Verify re-throw

    // Assert logging
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      {
        modId: modId,
        filename: filename,
        path: resolvedPath, // Path was resolved, data fetched, validated
        typeName: typeName,
        error: processError.message,
      },
      processError // Original error object
    );
    // Debug logs for resolve/fetch/validation would have happened before the error
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Resolved path for ${filename}: ${resolvedPath}`
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Fetched data from ${resolvedPath}`
    );
    expect(loader._validatePrimarySchema).toHaveBeenCalledWith(
      mockData,
      filename,
      modId,
      resolvedPath
    ); // Validation was called
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Successfully processed')
    );
  });
});
