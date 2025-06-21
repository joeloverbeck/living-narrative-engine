// src/tests/loaders/baseManifestItemLoader.extractValidFilenames.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
// Adjust the import path as necessary
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';
import { createMockConfiguration, createMockPathResolver } from '../../common/mockFactories/index.js';
// Assume ValidationResult type is available or mock it if needed for type checking in tests
// import { ValidationResult } from '../../../src/interfaces/validation.js'; // Example import

// --- Mock Service Factories (Keep as provided, ensure ISchemaValidator has isSchemaLoaded) ---

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

// --- Existing Test Suite for _extractValidFilenames ---
describe('BaseManifestItemLoader _extractValidFilenames', () => {
  const modId = 'test-mod';
  const contentKey = 'components';

  // Note: loader and mockLogger are initialized in the global beforeEach

  beforeEach(() => {
    // Ensure we are testing the REAL implementation in this suite
    loader._extractValidFilenames =
      BaseManifestItemLoader.prototype._extractValidFilenames;
    // Clear logger mocks specifically for this suite's tests (global beforeEach clears all mocks initially)
    // jest.clearAllMocks(); // Redundant due to global beforeEach, but safe to leave
    // loader._logger = mockLogger; // Ensure logger is our spy (done in global beforeEach)
  });

  it('should return valid, trimmed filenames for a standard input', () => {
    const manifest = {
      id: modId,
      content: {
        [contentKey]: [' file1.json ', 'file2.json', 'nested/file3.json'],
      },
    };
    const expected = ['file1.json', 'file2.json', 'nested/file3.json'];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return empty array and log debug if manifest is null', () => {
    const manifest = null;
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return empty array and log debug if manifest is undefined', () => {
    const manifest = undefined;
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return empty array and log debug if manifest.content is null', () => {
    const manifest = { id: modId, content: null };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return empty array and log debug if manifest.content is undefined', () => {
    const manifest = { id: modId, content: undefined };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return empty array and log debug if contentKey is missing', () => {
    const manifest = { id: modId, content: {} }; // content exists, but key does not
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return empty array and log debug if contentKey value is null', () => {
    const manifest = { id: modId, content: { [contentKey]: null } };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return empty array and log debug if contentKey value is undefined', () => {
    const manifest = { id: modId, content: { [contentKey]: undefined } };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return empty array and log warning if contentKey value is not an array (string)', () => {
    const manifest = { id: modId, content: { [contentKey]: 'not-an-array' } };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Expected an array for content key '${contentKey}' but found type 'string'. Skipping.`
    );
  });

  it('should return empty array and log warning if contentKey value is not an array (number)', () => {
    const manifest = { id: modId, content: { [contentKey]: 123 } };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Expected an array for content key '${contentKey}' but found type 'number'. Skipping.`
    );
  });

  it('should return empty array and log warning if contentKey value is not an array (object)', () => {
    const manifest = {
      id: modId,
      content: { [contentKey]: { file: 'oops.json' } },
    };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Expected an array for content key '${contentKey}' but found type 'object'. Skipping.`
    );
  });

  it('should return empty array and log no warnings for an empty array input', () => {
    const manifest = { id: modId, content: { [contentKey]: [] } };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should filter out invalid types and log warnings for each', () => {
    const invalidNumber = 123;
    const invalidNull = null;
    const invalidObject = { a: 1 };
    const invalidEmptyString = '   '; // Whitespace only

    const manifest = {
      id: modId,
      content: {
        [contentKey]: [
          'valid1.json',
          invalidNumber,
          '  valid2.json ',
          invalidNull,
          invalidEmptyString,
          invalidObject,
          'valid3.json',
        ],
      },
    };
    const expected = ['valid1.json', 'valid2.json', 'valid3.json'];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.warn).toHaveBeenCalledTimes(4); // One for each invalid entry
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`,
      invalidNumber
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`,
      invalidNull
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Empty string filename found in '${contentKey}' list after trimming. Skipping.`
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`,
      invalidObject
    );
  });

  it('should return empty array and log warnings if array contains only invalid types', () => {
    const invalidNumber = 456;
    const invalidNull = null;
    const invalidObject = { b: 2 };
    const invalidEmptyString = '';

    const manifest = {
      id: modId,
      content: {
        [contentKey]: [
          invalidNumber,
          invalidNull,
          invalidEmptyString,
          invalidObject,
        ],
      },
    };
    const expected = [];

    const result = loader._extractValidFilenames(manifest, contentKey, modId);

    expect(result).toEqual(expected);
    expect(mockLogger.warn).toHaveBeenCalledTimes(4); // One for each invalid entry
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`,
      invalidNumber
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`,
      invalidNull
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Empty string filename found in '${contentKey}' list after trimming. Skipping.`
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`,
      invalidObject
    );
  });
});
