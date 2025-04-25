// src/tests/core/services/manifestLoader.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ManifestLoader from '../../../core/services/manifestLoader.js'; // Adjust path as needed

// --- Mock Interfaces (Type Hinting Only) ---
/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/coreServices.js').ValidationResult} ValidationResult */

// --- Test Constants ---
const TEST_WORLD_NAME = 'testWorld';
const TEST_MANIFEST_SCHEMA_ID = 'test://schemas/manifest';
const TEST_MANIFEST_PATH = `./test/worlds/${TEST_WORLD_NAME}.world.json`;
const VALID_MANIFEST_DATA = {
  $schema: TEST_MANIFEST_SCHEMA_ID,
  worldName: TEST_WORLD_NAME,
  description: 'A test world manifest',
  startingLocationId: 'start',
  startingPlayerId: 'player1',
  contentFiles: { // Crucial post-validation property
    entities: ['player1.json', 'monster.json'],
    locations: ['start.json', 'cave.json'],
  },
  // other properties...
};
const INVALID_MANIFEST_DATA = {
  $schema: TEST_MANIFEST_SCHEMA_ID,
  // Missing required properties like worldName, contentFiles etc.
  description: 'An invalid manifest',
};
const MANIFEST_MISSING_CONTENT_FILES = {
  $schema: TEST_MANIFEST_SCHEMA_ID,
  worldName: TEST_WORLD_NAME,
  description: 'Manifest missing contentFiles',
  startingLocationId: 'start',
  startingPlayerId: 'player1',
  // contentFiles is missing
};


describe('ManifestLoader', () => {
  /** @type {jest.Mocked<IConfiguration>} */
  let mockConfiguration;
  /** @type {jest.Mocked<IPathResolver>} */
  let mockPathResolver;
  /** @type {jest.Mocked<IDataFetcher>} */
  let mockDataFetcher;
  /** @type {jest.Mocked<ISchemaValidator>} */
  let mockSchemaValidator;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {ManifestLoader} */
  let manifestLoader;

  beforeEach(() => {
    // [x] Mock Dependencies
    mockConfiguration = {
      getManifestSchemaId: jest.fn(),
      // Add dummy implementations for other IConfiguration methods if constructor checks them
      getBaseDataPath: jest.fn(),
      getSchemaFiles: jest.fn(),
      getContentTypeSchemaId: jest.fn(),
      getSchemaBasePath: jest.fn(),
      getContentBasePath: jest.fn(),
      getWorldBasePath: jest.fn(),
    };
    mockPathResolver = {
      resolveManifestPath: jest.fn(),
      // Dummy implementations for other IPathResolver methods
      resolveSchemaPath: jest.fn(),
      resolveContentPath: jest.fn(),
    };
    mockDataFetcher = {
      fetch: jest.fn(),
    };
    mockSchemaValidator = {
      addSchema: jest.fn(), // Not used by ManifestLoader, but part of interface
      getValidator: jest.fn(),
      isSchemaLoaded: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // [x] Configure Mocks - Basic Setup (Defaults for many tests)
    mockConfiguration.getManifestSchemaId.mockReturnValue(TEST_MANIFEST_SCHEMA_ID);
    mockPathResolver.resolveManifestPath.mockImplementation(
      (worldName) => `./test/worlds/${worldName}.world.json`
    );
    // Note: isSchemaLoaded, getValidator, fetch are configured per test scenario

    // Instantiate the loader with mocks
    manifestLoader = new ManifestLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockLogger
    );

    // Verify constructor logs info message (happens once per instantiation)
    expect(mockLogger.info).toHaveBeenCalledWith('ManifestLoader: Instance created and services injected.');
    // Clear the constructor call from mock history for cleaner test-specific checks
    mockLogger.info.mockClear();
  });

  // --- Task: Test Scenario: Successful Load and Validation ---
  it('[Success] should load, validate, and return the manifest data successfully', async () => {
    // Arrange
    const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null});
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
    mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
    mockDataFetcher.fetch.mockResolvedValue(VALID_MANIFEST_DATA);

    // Act
    const result = await manifestLoader.loadAndValidateManifest(TEST_WORLD_NAME);

    // Assert
    // Verify interactions
    expect(mockPathResolver.resolveManifestPath).toHaveBeenCalledWith(TEST_WORLD_NAME);
    expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(1);
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(TEST_MANIFEST_PATH);
    expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    expect(mockValidate).toHaveBeenCalledWith(VALID_MANIFEST_DATA);

    // Verify result
    expect(result).toEqual(VALID_MANIFEST_DATA);

    // Verify logging
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading manifest for world '${TEST_WORLD_NAME}'`));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`using schema ${TEST_MANIFEST_SCHEMA_ID}`));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Manifest for world '${TEST_WORLD_NAME}' loaded and validated successfully.`));
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  // --- Task: Test Scenario: Invalid worldName Input ---
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['spaces only', '   '],
  ])('[Failure] should reject or throw immediately if worldName is %s', async (desc, invalidInput) => {
    // Arrange (mocks are setup in beforeEach)

    // Act & Assert
    await expect(manifestLoader.loadAndValidateManifest(invalidInput))
      .rejects.toThrow('ManifestLoader: Invalid or empty worldName provided.');

    // Verify minimal interaction (constructor log cleared in beforeEach)
    expect(mockPathResolver.resolveManifestPath).not.toHaveBeenCalled();
    expect(mockConfiguration.getManifestSchemaId).not.toHaveBeenCalled();
    expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
    expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
    expect(mockSchemaValidator.getValidator).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled(); // Should throw before logging specific errors
  });

  // --- Task: Test Scenario: Manifest Schema ID Not Configured ---
  it('[Failure] should reject or throw if manifest schema ID is not configured', async () => {
    // Arrange
    mockConfiguration.getManifestSchemaId.mockReturnValue(null); // Explicitly configure null/undefined

    // Act & Assert
    await expect(manifestLoader.loadAndValidateManifest(TEST_WORLD_NAME))
      .rejects.toThrow('ManifestLoader: Manifest schema ID is not configured. Cannot validate manifest.');

    // Verify interactions
    expect(mockPathResolver.resolveManifestPath).toHaveBeenCalledWith(TEST_WORLD_NAME);
    expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(1);
    // Should fail *before* checking if schema is loaded
    expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
    expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled(); // Fails before the "Loading..." log
    expect(mockLogger.error).not.toHaveBeenCalled(); // Throws before logging error
  });

  // --- Task: Test Scenario: Prerequisite Schema Not Loaded ---
  it('[Failure] should reject or throw if the prerequisite manifest schema is not loaded', async () => {
    // Arrange
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false); // Schema not loaded

    // Act & Assert
    const expectedErrorMsg = `ManifestLoader: Prerequisite manifest schema ('${TEST_MANIFEST_SCHEMA_ID}') not loaded in validator. Cannot validate manifest for world '${TEST_WORLD_NAME}'. Ensure SchemaLoader ran successfully first.`;
    await expect(manifestLoader.loadAndValidateManifest(TEST_WORLD_NAME))
      .rejects.toThrow(expectedErrorMsg);

    // Verify interactions
    expect(mockPathResolver.resolveManifestPath).toHaveBeenCalledWith(TEST_WORLD_NAME);
    expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(1);
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    // Should fail *before* fetching data
    expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
    expect(mockSchemaValidator.getValidator).not.toHaveBeenCalled();

    // Verify logging
    expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
    expect(mockLogger.info).not.toHaveBeenCalled(); // Fails before the "Loading..." log
  });

  // --- Task: Test Scenario: Fetch Error ---
  it('[Failure] should reject or throw if data fetching fails', async () => {
    // Arrange
    const fetchError = new Error('Network Error or File Not Found');
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true); // Prerequisite met
    mockDataFetcher.fetch.mockRejectedValue(fetchError); // Configure fetch to fail

    // Act & Assert
    await expect(manifestLoader.loadAndValidateManifest(TEST_WORLD_NAME))
      .rejects.toThrow(`Error processing world manifest for '${TEST_WORLD_NAME}': ${fetchError.message}`);

    // Verify interactions up to the failure point
    expect(mockPathResolver.resolveManifestPath).toHaveBeenCalledWith(TEST_WORLD_NAME);
    expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(1);
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(TEST_MANIFEST_PATH);
    // Should fail *before* getting validator
    expect(mockSchemaValidator.getValidator).not.toHaveBeenCalled();

    // Verify logging
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading manifest for world '${TEST_WORLD_NAME}'`)); // Started loading
    expect(mockLogger.error).toHaveBeenCalledWith(
      `ManifestLoader: Failed to load or validate manifest ${TEST_MANIFEST_PATH}`,
      fetchError // Check that the original error was logged
    );
  });

  // --- Task: Test Scenario: Validator Function Not Found ---
  it('[Failure] should reject or throw if the validator function cannot be retrieved', async () => {
    // Arrange
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true); // Prerequisite met
    mockDataFetcher.fetch.mockResolvedValue(VALID_MANIFEST_DATA); // Fetch succeeds
    mockSchemaValidator.getValidator.mockReturnValue(undefined); // Validator not found

    // Act & Assert
    await expect(manifestLoader.loadAndValidateManifest(TEST_WORLD_NAME))
      .rejects.toThrow(`Error processing world manifest for '${TEST_WORLD_NAME}': ManifestLoader: Could not retrieve validator function for schema ${TEST_MANIFEST_SCHEMA_ID}, even though it was reported as loaded.`);

    // Verify interactions up to the failure point
    expect(mockPathResolver.resolveManifestPath).toHaveBeenCalledWith(TEST_WORLD_NAME);
    expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(1);
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(TEST_MANIFEST_PATH);
    expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);

    // Verify logging
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading manifest for world '${TEST_WORLD_NAME}'`)); // Started loading
    expect(mockLogger.error).toHaveBeenCalledWith(
      `ManifestLoader: Failed to load or validate manifest ${TEST_MANIFEST_PATH}`,
      expect.any(Error) // The internally thrown error
    );
    expect(mockLogger.error.mock.calls[0][1].message).toContain(`Could not retrieve validator function for schema ${TEST_MANIFEST_SCHEMA_ID}`); // Check logged error message
  });

  // --- Task: Test Scenario: Schema Validation Failure ---
  it('[Failure] should reject or throw if schema validation fails', async () => {
    // Arrange
    const validationErrors = [{path: '/worldName', message: 'is required'}];
    const mockValidate = jest.fn().mockReturnValue({isValid: false, errors: validationErrors});

    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true); // Prerequisite met
    mockDataFetcher.fetch.mockResolvedValue(INVALID_MANIFEST_DATA); // Fetch succeeds (with invalid data)
    mockSchemaValidator.getValidator.mockReturnValue(mockValidate); // Validator returns failure

    // Act & Assert
    await expect(manifestLoader.loadAndValidateManifest(TEST_WORLD_NAME))
      .rejects.toThrow(`Error processing world manifest for '${TEST_WORLD_NAME}': Schema validation failed for world manifest '${TEST_WORLD_NAME}'. See console for details.`);

    // Verify interactions up to the failure point
    expect(mockPathResolver.resolveManifestPath).toHaveBeenCalledWith(TEST_WORLD_NAME);
    expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(1);
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(TEST_MANIFEST_PATH);
    expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    expect(mockValidate).toHaveBeenCalledWith(INVALID_MANIFEST_DATA);

    // Verify logging
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading manifest for world '${TEST_WORLD_NAME}'`)); // Started loading
    expect(mockLogger.error).toHaveBeenCalledWith(
      `ManifestLoader: Schema validation failed for ${TEST_MANIFEST_PATH} using schema ${TEST_MANIFEST_SCHEMA_ID}:\n${JSON.stringify(validationErrors, null, 2)}`
    );
    // Also check the final catch block log
    expect(mockLogger.error).toHaveBeenCalledWith(
      `ManifestLoader: Failed to load or validate manifest ${TEST_MANIFEST_PATH}`,
      expect.any(Error) // The internally thrown error from validation failure
    );
    expect(mockLogger.error.mock.calls[1][1].message).toContain(`Schema validation failed for world manifest '${TEST_WORLD_NAME}'`); // Check the re-thrown error message part
  });

  // --- Task: Test Scenario: Post-Validation Check Failure (Missing contentFiles) ---
  it('[Failure] should reject or throw if post-validation check (missing contentFiles) fails', async () => {
    // Arrange
    const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null}); // Schema validation SUCCEEDS

    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true); // Prerequisite met
    mockDataFetcher.fetch.mockResolvedValue(MANIFEST_MISSING_CONTENT_FILES); // Fetch succeeds (with data missing contentFiles)
    mockSchemaValidator.getValidator.mockReturnValue(mockValidate); // Validator returns success

    // Act & Assert
    await expect(manifestLoader.loadAndValidateManifest(TEST_WORLD_NAME))
      .rejects.toThrow(`Error processing world manifest for '${TEST_WORLD_NAME}': Manifest for world '${TEST_WORLD_NAME}' is missing the required 'contentFiles' object.`);

    // Verify interactions up to the failure point
    expect(mockPathResolver.resolveManifestPath).toHaveBeenCalledWith(TEST_WORLD_NAME);
    expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(1);
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(TEST_MANIFEST_PATH);
    expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(TEST_MANIFEST_SCHEMA_ID);
    expect(mockValidate).toHaveBeenCalledWith(MANIFEST_MISSING_CONTENT_FILES); // Validation was called

    // Verify logging
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading manifest for world '${TEST_WORLD_NAME}'`)); // Started loading
    // Check the specific error log for the post-validation failure
    expect(mockLogger.error).toHaveBeenCalledWith(
      `ManifestLoader: Validated manifest for world '${TEST_WORLD_NAME}' is missing the required 'contentFiles' object.`
    );
    // Also check the final catch block log
    expect(mockLogger.error).toHaveBeenCalledWith(
      `ManifestLoader: Failed to load or validate manifest ${TEST_MANIFEST_PATH}`,
      expect.any(Error) // The internally thrown error from post-validation failure
    );
    expect(mockLogger.error.mock.calls[1][1].message).toContain('missing the required \'contentFiles\' object'); // Check the re-thrown error message part
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('loaded and validated successfully')); // Should not log success
  });

  // --- Test Constructor Validation (Edge Cases) ---
  describe('Constructor Validation', () => {
    it('should throw if IConfiguration is missing or invalid', () => {
      expect(() => new ManifestLoader(null, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockLogger))
        .toThrow(/Missing or invalid 'configuration' dependency/);
      expect(() => new ManifestLoader({}, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockLogger))
        .toThrow(/Missing or invalid 'configuration' dependency/);
    });

    it('should throw if IPathResolver is missing or invalid', () => {
      expect(() => new ManifestLoader(mockConfiguration, null, mockDataFetcher, mockSchemaValidator, mockLogger))
        .toThrow(/Missing or invalid 'pathResolver' dependency/);
      expect(() => new ManifestLoader(mockConfiguration, {}, mockDataFetcher, mockSchemaValidator, mockLogger))
        .toThrow(/Missing or invalid 'pathResolver' dependency/);
    });

    it('should throw if IDataFetcher is missing or invalid', () => {
      expect(() => new ManifestLoader(mockConfiguration, mockPathResolver, null, mockSchemaValidator, mockLogger))
        .toThrow(/Missing or invalid 'fetcher' dependency/);
      expect(() => new ManifestLoader(mockConfiguration, mockPathResolver, {}, mockSchemaValidator, mockLogger))
        .toThrow(/Missing or invalid 'fetcher' dependency/);
    });

    it('should throw if ISchemaValidator is missing or invalid', () => {
      expect(() => new ManifestLoader(mockConfiguration, mockPathResolver, mockDataFetcher, null, mockLogger))
        .toThrow(/Missing or invalid 'validator' dependency/);
      expect(() => new ManifestLoader(mockConfiguration, mockPathResolver, mockDataFetcher, {}, mockLogger)) // Missing methods
        .toThrow(/Missing or invalid 'validator' dependency/);
      expect(() => new ManifestLoader(mockConfiguration, mockPathResolver, mockDataFetcher, {getValidator: jest.fn()}, mockLogger)) // Missing isSchemaLoaded
        .toThrow(/Missing or invalid 'validator' dependency/);
    });

    it('should throw if ILogger is missing or invalid', () => {
      expect(() => new ManifestLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, null))
        .toThrow(/Missing or invalid 'logger' dependency/);
      expect(() => new ManifestLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, {})) // Missing methods
        .toThrow(/Missing or invalid 'logger' dependency/);
      expect(() => new ManifestLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, {info: jest.fn()})) // Missing error
        .toThrow(/Missing or invalid 'logger' dependency/);
    });
  });

});