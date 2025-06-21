// src/tests/loaders/baseManifestItemLoader.loadItemsInternal.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
// Adjust the import path as necessary
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';
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
  // Recreate dependencyInjection mock after clearAllMocks (especially getContentTypeSchemaId)
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

// --- Corrected Test Suite for _loadItemsInternal ---
describe('BaseManifestItemLoader _loadItemsInternal', () => {
  const modId = 'test-mod';
  const manifest = { id: modId, content: {} }; // Basic manifest structure
  const contentKey = 'items';
  const contentTypeDir = 'items';
  const typeName = 'items';

  // Note: loader, mocks are set up in global beforeEach
  // _extractValidFilenames, _processFileWrapper are mocked by global beforeEach

  beforeEach(() => {
    // Restore the real _loadItemsInternal for tests in this suite
    loader._loadItemsInternal =
      BaseManifestItemLoader.prototype._loadItemsInternal;
    // Ensure its dependencies (_extractValidFilenames, _processFileWrapper) ARE mocked (done by global beforeEach)
    // loader._extractValidFilenames = jest.fn(); // Already mocked globally
    // loader._processFileWrapper = jest.fn(); // Already mocked globally
  });

  it('No Files Found: should return 0 count/errors/overrides, log debug, and not call processFileWrapper', async () => {
    // --- Arrange ---
    loader._extractValidFilenames.mockReturnValue([]); // Configure mock

    // --- Act ---
    const result = await loader._loadItemsInternal(
      modId,
      manifest,
      contentKey,
      contentTypeDir,
      typeName
    );

    // --- Assert ---
    expect(result).toEqual({ count: 0, overrides: 0, errors: 0 }); // <<< CORRECTED: Expect the result object
    // Or check properties individually:
    // expect(result.count).toBe(0);
    // expect(result.overrides).toBe(0);
    // expect(result.errors).toBe(0);
    expect(loader._extractValidFilenames).toHaveBeenCalledWith(
      manifest,
      contentKey,
      modId
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `No valid ${contentKey} filenames found for mod ${modId}.`
    );
    expect(loader._processFileWrapper).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled(); // No summary log needed
  });

  it('All Files Process Successfully: should return correct counts, call wrapper for each, log success summary', async () => {
    // --- Arrange ---
    const filenames = ['file1.json', 'file2.json'];
    const qualifiedId1 = `${modId}:file1`;
    const qualifiedId2 = `${modId}:file2`;
    loader._extractValidFilenames.mockReturnValue(filenames);
    // Mock wrapper to return the expected { qualifiedId, didOverride } object
    loader._processFileWrapper.mockImplementation(async (mId, fname) => {
      if (fname === 'file1.json')
        return { qualifiedId: qualifiedId1, didOverride: false }; // Assume no override
      if (fname === 'file2.json')
        return { qualifiedId: qualifiedId2, didOverride: false }; // Assume no override
      return { qualifiedId: 'unexpected-success', didOverride: false };
    });

    // --- Act ---
    const result = await loader._loadItemsInternal(
      modId,
      manifest,
      contentKey,
      contentTypeDir,
      typeName
    );

    // --- Assert ---
    expect(result).toEqual({ count: 2, overrides: 0, errors: 0 }); // <<< CORRECTED: Expect the result object
    // Or check properties individually:
    // expect(result.count).toBe(2);
    // expect(result.overrides).toBe(0);
    // expect(result.errors).toBe(0);
    expect(loader._extractValidFilenames).toHaveBeenCalledWith(
      manifest,
      contentKey,
      modId
    );
    expect(loader._processFileWrapper).toHaveBeenCalledTimes(2);
    expect(loader._processFileWrapper).toHaveBeenCalledWith(
      modId,
      'file1.json',
      contentTypeDir,
      typeName
    );
    expect(loader._processFileWrapper).toHaveBeenCalledWith(
      modId,
      'file2.json',
      contentTypeDir,
      typeName
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 2/2 ${contentKey} items.`
    ); // Assumes 0 overrides/errors
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Found 2 potential ${contentKey} files to process for mod ${modId}.`
    );
  });

  it('Some Files Fail, Some Override: should return correct counts, call wrapper for each, log summary with failures/overrides', async () => {
    // --- Arrange ---
    const filenames = ['file1.json', 'file2.json', 'file3.json'];
    const qualifiedId1 = `${modId}:file1`; // Will succeed with override
    const qualifiedId3 = `${modId}:file3`; // Will succeed without override
    const failureError = new Error('Failed to process file2');
    loader._extractValidFilenames.mockReturnValue(filenames);
    loader._processFileWrapper.mockImplementation(
      async (mId, fname, cTypeDir, tName) => {
        expect(tName).toBe(typeName); // Add assertion for typeName within mock
        if (fname === 'file1.json')
          return { qualifiedId: qualifiedId1, didOverride: true }; // Simulate success with override
        if (fname === 'file2.json') throw failureError; // Simulate rejection
        if (fname === 'file3.json')
          return { qualifiedId: qualifiedId3, didOverride: false }; // Simulate success without override
        throw new Error(`Unexpected filename in mock: ${fname}`);
      }
    );

    // --- Act ---
    const result = await loader._loadItemsInternal(
      modId,
      manifest,
      contentKey,
      contentTypeDir,
      typeName
    );

    // --- Assert ---
    expect(result).toEqual({ count: 2, overrides: 1, errors: 1 }); // <<< CORRECTED: Expect the result object
    // Or check properties individually:
    // expect(result.count).toBe(2); // file1 and file3 succeeded
    // expect(result.overrides).toBe(1); // file1 overwrote
    // expect(result.errors).toBe(1); // file2 failed
    expect(loader._extractValidFilenames).toHaveBeenCalledWith(
      manifest,
      contentKey,
      modId
    );
    expect(loader._processFileWrapper).toHaveBeenCalledTimes(3);
    expect(loader._processFileWrapper).toHaveBeenCalledWith(
      modId,
      'file1.json',
      contentTypeDir,
      typeName
    );
    expect(loader._processFileWrapper).toHaveBeenCalledWith(
      modId,
      'file2.json',
      contentTypeDir,
      typeName
    );
    expect(loader._processFileWrapper).toHaveBeenCalledWith(
      modId,
      'file3.json',
      contentTypeDir,
      typeName
    );
    // <<< CORRECTED: Updated expected log message to include overrides and failures
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 2/3 ${contentKey} items. (1 overrides) (1 failed)`
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Found 3 potential ${contentKey} files to process for mod ${modId}.`
    );
  });

  it('All Files Fail: should return 0 count/overrides, correct error count, call wrapper for each, log summary with all failures', async () => {
    // --- Arrange ---
    const filenames = ['file1.json', 'file2.json'];
    const failureError1 = new Error('Failed file1');
    const failureError2 = new Error('Failed file2');
    loader._extractValidFilenames.mockReturnValue(filenames);
    loader._processFileWrapper.mockImplementation(
      async (mId, fname, cTypeDir, tName) => {
        expect(tName).toBe(typeName);
        if (fname === 'file1.json') throw failureError1;
        if (fname === 'file2.json') throw failureError2;
        throw new Error(`Unexpected filename in mock: ${fname}`);
      }
    );

    // --- Act ---
    const result = await loader._loadItemsInternal(
      modId,
      manifest,
      contentKey,
      contentTypeDir,
      typeName
    );

    // --- Assert ---
    expect(result).toEqual({ count: 0, overrides: 0, errors: 2 }); // <<< CORRECTED: Expect the result object
    // Or check properties individually:
    // expect(result.count).toBe(0);
    // expect(result.overrides).toBe(0);
    // expect(result.errors).toBe(2);
    expect(loader._extractValidFilenames).toHaveBeenCalledWith(
      manifest,
      contentKey,
      modId
    );
    expect(loader._processFileWrapper).toHaveBeenCalledTimes(2);
    expect(loader._processFileWrapper).toHaveBeenCalledWith(
      modId,
      'file1.json',
      contentTypeDir,
      typeName
    );
    expect(loader._processFileWrapper).toHaveBeenCalledWith(
      modId,
      'file2.json',
      contentTypeDir,
      typeName
    );
    // <<< CORRECTED: Updated expected log message
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 0/2 ${contentKey} items. (2 failed)`
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Found 2 potential ${contentKey} files to process for mod ${modId}.`
    );
  });
});
