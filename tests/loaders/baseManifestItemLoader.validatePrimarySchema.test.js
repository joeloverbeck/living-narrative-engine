// src/tests/loaders/baseManifestItemLoader.validatePrimarySchema.test.js

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

// --- NEW TEST SUITE for _validatePrimarySchema ---
describe('BaseManifestItemLoader _validatePrimarySchema', () => {
  const modId = 'test-mod';
  const filename = 'data.json';
  const resolvedPath = `/path/to/${filename}`;
  const data = { key: 'value' };
  const schemaId = 'http://example.com/schema/myType.json';
  let loaderName; // To store the loader name for consistent log messages

  beforeEach(() => {
    // Restore the real method for tests in this suite
    loader._validatePrimarySchema =
      BaseManifestItemLoader.prototype._validatePrimarySchema;
    // Ensure mocks used by the method are fresh (done by global beforeEach, but be explicit)
    loader._schemaValidator = mockValidator;
    loader._logger = mockLogger;
    // Set a default primary schema ID for the loader instance for most tests
    loader._primarySchemaId = schemaId;
    // Store loader name for use in expected log messages
    loaderName = loader.constructor.name;
    // Reset mock calls (also done by global beforeEach)
    jest.clearAllMocks();
  });

  it('Success Case: should call validator, log debug, and return success result', () => {
    // Arrange
    const successResult = { isValid: true, errors: null };
    mockValidator.isSchemaLoaded.mockReturnValue(true);
    mockValidator.validate.mockReturnValue(successResult);

    // Act
    const result = loader._validatePrimarySchema(
      data,
      filename,
      modId,
      resolvedPath
    );

    // Assert
    expect(result).toEqual(successResult);
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
    expect(mockValidator.validate).toHaveBeenCalledWith(schemaId, data);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `${loaderName} [${modId}]: Validating '${filename}' against primary schema '${schemaId}'.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('Missing Schema ID Case: should log debug, skip validation, and return success', () => {
    // Arrange
    loader._primarySchemaId = null; // Override for this test

    // Act
    const result = loader._validatePrimarySchema(
      data,
      filename,
      modId,
      resolvedPath
    );

    // Assert
    expect(result).toEqual({ isValid: true, errors: null });
    expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalled();
    expect(mockValidator.validate).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `${loaderName} [${modId}]: Skipping primary schema validation for '${filename}' as no primary schema ID is configured for this loader.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // <<< --- MODIFIED TEST CASE --- >>>
  it('Unloaded Schema Case: should log warning, skip validation, and return success', () => {
    // Arrange
    mockValidator.isSchemaLoaded.mockReturnValue(false); // Schema not loaded
    const expectedWarningMsg = `${loaderName} [${modId}]: Rule schema '${schemaId}' is configured but not loaded. Skipping validation for ${filename}.`;
    const expectedResult = { isValid: true, errors: null };

    // Act
    // Call the function directly, don't wrap in expect().toThrow
    const result = loader._validatePrimarySchema(
      data,
      filename,
      modId,
      resolvedPath
    );

    // Assert
    // 1. Check the return value (should indicate success/skip)
    expect(result).toEqual(expectedResult);

    // 2. Check that isSchemaLoaded was called
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);

    // 3. Check that validate was NOT called
    expect(mockValidator.validate).not.toHaveBeenCalled();

    // 4. Check that a WARNING was logged (NOT an error)
    expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMsg);
    expect(mockLogger.error).not.toHaveBeenCalled(); // Ensure no error was logged

    // 5. Check that specific debug messages were NOT logged
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Validating')
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('successful')
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping')
    ); // The "Skipping" message for *missing* schemaId should not appear here
  });
  // <<< --- END OF MODIFIED TEST CASE --- >>>

  it('Validation Failure Case: should log error with details and throw', () => {
    // Arrange
    const validationErrors = [
      {
        instancePath: '/key',
        message: 'should be integer',
        params: { type: 'integer' },
      },
      {
        instancePath: '/other',
        message: 'is required',
        params: { missingProperty: 'other' },
      },
    ];
    const failureResult = { isValid: false, errors: validationErrors };
    mockValidator.isSchemaLoaded.mockReturnValue(true);
    mockValidator.validate.mockReturnValue(failureResult);
    const expectedBaseErrorMsg = `${loaderName} [${modId}]: Primary schema validation failed for '${filename}' using schema '${schemaId}'.`;

    // Act & Assert
    expect(() =>
      loader._validatePrimarySchema(data, filename, modId, resolvedPath)
    ).toThrow(Error); // Check general error type

    // Use try/catch to inspect the thrown error message more easily
    try {
      loader._validatePrimarySchema(data, filename, modId, resolvedPath);
      // Should not reach here
      throw new Error('Test failed: Expected _validatePrimarySchema to throw');
    } catch (error) {
      // Match the exact error format including Details section
      const expectedFullErrorMsg = `${expectedBaseErrorMsg}\nDetails:\n  - Path: /key | Message: should be integer | Params: {"type":"integer"}\n  - Path: /other | Message: is required | Params: {"missingProperty":"other"}`;
      expect(error.message).toBe(expectedFullErrorMsg);
    }

    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
    expect(mockValidator.validate).toHaveBeenCalledWith(schemaId, data);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedBaseErrorMsg,
      expect.objectContaining({
        // Check context object passed to logger
        modId,
        filename,
        resolvedPath,
        schemaId,
        validationErrors: validationErrors,
      })
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `${loaderName} [${modId}]: Validating '${filename}' against primary schema '${schemaId}'.`
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('successful')
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping')
    );
  });

  it('Validation Failure Case (No Error Details): should log error and throw', () => {
    // Arrange
    const failureResult = { isValid: false, errors: null }; // No specific errors provided
    mockValidator.isSchemaLoaded.mockReturnValue(true);
    mockValidator.validate.mockReturnValue(failureResult);
    const expectedBaseErrorMsg = `${loaderName} [${modId}]: Primary schema validation failed for '${filename}' using schema '${schemaId}'.`;

    // Act & Assert
    expect(() =>
      loader._validatePrimarySchema(data, filename, modId, resolvedPath)
    ).toThrow(Error);

    try {
      loader._validatePrimarySchema(data, filename, modId, resolvedPath);
      throw new Error('Test failed: Expected _validatePrimarySchema to throw');
    } catch (error) {
      const expectedFullErrorMsg = `${expectedBaseErrorMsg}\nDetails:\nNo specific error details provided.`;
      expect(error.message).toBe(expectedFullErrorMsg);
    }

    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedBaseErrorMsg,
      expect.objectContaining({ validationErrors: null }) // Check context object passed to logger
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `${loaderName} [${modId}]: Validating '${filename}' against primary schema '${schemaId}'.`
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('successful')
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping')
    );
  });
});
