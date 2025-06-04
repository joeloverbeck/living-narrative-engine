// Filename: src/tests/core/loaders/baseManifestItemLoader.loadItemsForMod.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseManifestItemLoader } from '../../src/loaders/baseManifestItemLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Copied from actionLoader.test.js) ---

const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn(
    (typeName) => `http://example.com/schemas/${typeName}.schema.json`
  ),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getContentBasePath: jest.fn((typeName) => `./data/${typeName}`),
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
  fetch: jest.fn().mockResolvedValue({}), // Default mock fetch
  ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
  getValidator: jest
    .fn()
    .mockReturnValue(() => ({ isValid: true, errors: null })),
  addSchema: jest.fn().mockResolvedValue(undefined),
  removeSchema: jest.fn().mockReturnValue(true),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined),
  getAll: jest.fn().mockReturnValue([]),
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

// --- Minimal Concrete Subclass for Testing ---

class TestableLoader extends BaseManifestItemLoader {
  // Use the real constructor defined in BaseManifestItemLoader
  // No need to override constructor here

  // Dummy implementation for the abstract method to satisfy the base class
  // We won't call this directly in these tests, as we mock _loadItemsInternal
  async _processFetchedItem(
    modId,
    filename,
    resolvedPath,
    fetchedData,
    typeName
  ) {
    // Mock implementation required by the abstract class, needs to return the correct shape now
    // based on the JSDoc for _processFetchedItem. Assume no override for simplicity here.
    return {
      qualifiedId: `${modId}:${fetchedData?.id || 'dummyId'}`,
      didOverride: false,
    };
  }

  // Allow spying on the protected method
  // We intentionally don't override _loadItemsInternal, we'll spy on the instance's method
}

// --- Test Suite ---

describe('BaseManifestItemLoader.loadItemsForMod', () => {
  let mockConfig;
  let mockResolver;
  let mockFetcher;
  let mockValidator;
  let mockRegistry;
  let mockLogger;
  let testLoader; // Instance of TestableLoader
  let loadItemsInternalSpy; // Spy for the protected method

  // Test constants
  const TEST_MOD_ID = 'test-mod';
  const TEST_CONTENT_KEY = 'items';
  const TEST_CONTENT_DIR = 'items';
  const TEST_TYPE_NAME = 'items'; // Use this for the constructor's contentType
  const MOCK_MANIFEST = {
    id: TEST_MOD_ID,
    name: 'Test Mod',
    version: '1.0.0',
    content: {
      [TEST_CONTENT_KEY]: ['item1.json'],
    },
  };
  // --- CORRECTED: Mock return value for successful load ---
  const EXPECTED_LOAD_RESULT = { count: 5, overrides: 0, errors: 0 }; // Mock result object

  beforeEach(() => {
    // Create fresh mocks for each test
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    testLoader = new TestableLoader(
      TEST_TYPE_NAME,
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // --- Spy on the protected _loadItemsInternal method ON THE INSTANCE ---
    // --- CORRECTED: Mock resolve with the object structure ---
    loadItemsInternalSpy = jest
      .spyOn(testLoader, '_loadItemsInternal')
      .mockResolvedValue(EXPECTED_LOAD_RESULT); // Mock with the result object

    // Clear mocks *after* instantiation and spying to isolate test calls
    Object.values(mockConfig).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockResolver).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockFetcher).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockValidator).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockRegistry).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockLogger).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
  });

  // --- Input Validation Tests ---
  describe('Input Validation', () => {
    // ***** CORRECTED TESTS for modId/modManifest: Expect ERROR log and return { count: 0, ... } *****
    it('should return { count: 0, overrides: 0, errors: 0 } and log ERROR if modId is invalid', async () => {
      const invalidModIds = [null, undefined, ''];
      const expectedReturn = { count: 0, overrides: 0, errors: 0 }; // Expected object

      for (const invalidId of invalidModIds) {
        mockLogger.error.mockClear();
        loadItemsInternalSpy.mockClear();

        // --- CORRECTED ASSERTION: Use .toEqual for object comparison ---
        await expect(
          testLoader.loadItemsForMod(
            invalidId,
            MOCK_MANIFEST,
            TEST_CONTENT_KEY,
            TEST_CONTENT_DIR,
            TEST_TYPE_NAME
          )
        ).resolves.toEqual(expectedReturn); // Check resolves to the expected object

        expect(mockLogger.error).toHaveBeenCalledWith(
          `TestableLoader: Invalid 'modId' provided for loading ${TEST_TYPE_NAME}. Must be a non-empty string. Received: ${invalidId}`
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(loadItemsInternalSpy).not.toHaveBeenCalled();
      }
    });

    it('should return { count: 0, overrides: 0, errors: 0 } and log ERROR if modManifest is invalid', async () => {
      const invalidManifests = [null, undefined, 'not-an-object', 123];
      const expectedReturn = { count: 0, overrides: 0, errors: 0 }; // Expected object

      for (const invalidManifest of invalidManifests) {
        mockLogger.error.mockClear();
        loadItemsInternalSpy.mockClear();

        // --- CORRECTED ASSERTION: Use .toEqual for object comparison ---
        await expect(
          testLoader.loadItemsForMod(
            TEST_MOD_ID,
            invalidManifest,
            TEST_CONTENT_KEY,
            TEST_CONTENT_DIR,
            TEST_TYPE_NAME
          )
        ).resolves.toEqual(expectedReturn); // Check resolves to the expected object

        expect(mockLogger.error).toHaveBeenCalledWith(
          `TestableLoader: Invalid 'modManifest' provided for loading ${TEST_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-null object. Received: ${typeof invalidManifest}`
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(loadItemsInternalSpy).not.toHaveBeenCalled();
      }
    });
    // ***** END CORRECTED TESTS *****

    // ***** KEPT TESTS for contentKey/contentTypeDir/typeName: Expect TypeError *****
    // These tests expect errors to be *thrown*, not resolved values, so they remain correct.
    it('should throw TypeError and log error if contentKey is invalid', async () => {
      const invalidKeys = [null, undefined, ''];
      for (const invalidKey of invalidKeys) {
        mockLogger.error.mockClear();
        loadItemsInternalSpy.mockClear();

        await expect(
          testLoader.loadItemsForMod(
            TEST_MOD_ID,
            MOCK_MANIFEST,
            invalidKey,
            TEST_CONTENT_DIR,
            TEST_TYPE_NAME
          )
        ).rejects.toThrow(TypeError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          `TestableLoader: Programming Error - Invalid 'contentKey' provided for loading ${TEST_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidKey}`
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(loadItemsInternalSpy).not.toHaveBeenCalled();
      }
    });

    it('should throw TypeError and log error if contentTypeDir is invalid', async () => {
      const invalidDirs = [null, undefined, ''];
      for (const invalidDir of invalidDirs) {
        mockLogger.error.mockClear();
        loadItemsInternalSpy.mockClear();

        await expect(
          testLoader.loadItemsForMod(
            TEST_MOD_ID,
            MOCK_MANIFEST,
            TEST_CONTENT_KEY,
            invalidDir,
            TEST_TYPE_NAME
          )
        ).rejects.toThrow(TypeError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          `TestableLoader: Programming Error - Invalid 'contentTypeDir' provided for loading ${TEST_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidDir}`
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(loadItemsInternalSpy).not.toHaveBeenCalled();
      }
    });

    it('should throw TypeError and log error if typeName is invalid', async () => {
      const invalidTypeNames = [null, undefined, ''];
      for (const invalidTypeName of invalidTypeNames) {
        mockLogger.error.mockClear();
        loadItemsInternalSpy.mockClear();

        await expect(
          testLoader.loadItemsForMod(
            TEST_MOD_ID,
            MOCK_MANIFEST,
            TEST_CONTENT_KEY,
            TEST_CONTENT_DIR,
            invalidTypeName
          )
        ).rejects.toThrow(TypeError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          `TestableLoader: Programming Error - Invalid 'typeName' provided for loading content for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidTypeName}`
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(loadItemsInternalSpy).not.toHaveBeenCalled();
      }
    });
    // ***** END KEPT TESTS *****
  });

  // --- Logging Test ---
  it('should log the informational loading message with correct class name and typeName', async () => {
    await testLoader.loadItemsForMod(
      TEST_MOD_ID,
      MOCK_MANIFEST,
      TEST_CONTENT_KEY,
      TEST_CONTENT_DIR,
      TEST_TYPE_NAME
    );

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `TestableLoader: Loading ${TEST_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- Internal Call Test ---
  it('should call _loadItemsInternal with the exact parameters passed to it', async () => {
    await testLoader.loadItemsForMod(
      TEST_MOD_ID,
      MOCK_MANIFEST,
      TEST_CONTENT_KEY,
      TEST_CONTENT_DIR,
      TEST_TYPE_NAME
    );

    expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1);
    expect(loadItemsInternalSpy).toHaveBeenCalledWith(
      TEST_MOD_ID,
      MOCK_MANIFEST,
      TEST_CONTENT_KEY,
      TEST_CONTENT_DIR,
      TEST_TYPE_NAME
    );
  });

  // --- CORRECTED Return Value Test ---
  it('should return the object value returned by _loadItemsInternal', async () => {
    // Spy is configured in beforeEach to return EXPECTED_LOAD_RESULT (the object)
    const result = await testLoader.loadItemsForMod(
      TEST_MOD_ID,
      MOCK_MANIFEST,
      TEST_CONTENT_KEY,
      TEST_CONTENT_DIR,
      TEST_TYPE_NAME
    );

    // --- CORRECTED ASSERTION: Expect the object ---
    expect(result).toEqual(EXPECTED_LOAD_RESULT);
  });

  // --- Error Handling Test ---
  it('should propagate errors thrown by _loadItemsInternal', async () => {
    const internalError = new Error('Internal processing failed!');
    loadItemsInternalSpy.mockRejectedValue(internalError); // Configure spy to throw

    await expect(
      testLoader.loadItemsForMod(
        TEST_MOD_ID,
        MOCK_MANIFEST,
        TEST_CONTENT_KEY,
        TEST_CONTENT_DIR,
        TEST_TYPE_NAME
      )
    ).rejects.toThrow(internalError);

    expect(mockLogger.info).toHaveBeenCalledWith(
      `TestableLoader: Loading ${TEST_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
    );
    // No error expected to be logged *by loadItemsForMod* itself when propagating
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- CORRECTED Return Value Test (Zero Case) ---
  it('should return { count: 0, ... } if _loadItemsInternal returns { count: 0, ... }', async () => {
    const zeroResult = { count: 0, overrides: 0, errors: 0 };
    loadItemsInternalSpy.mockResolvedValue(zeroResult); // Configure spy to return the zero object
    const result = await testLoader.loadItemsForMod(
      TEST_MOD_ID,
      MOCK_MANIFEST,
      TEST_CONTENT_KEY,
      TEST_CONTENT_DIR,
      TEST_TYPE_NAME
    );

    // --- CORRECTED ASSERTION: Expect the zero object ---
    expect(result).toEqual(zeroResult);
    expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });
});
