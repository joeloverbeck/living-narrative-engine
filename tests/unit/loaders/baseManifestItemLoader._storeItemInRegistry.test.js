// Filename: src/tests/loaders/baseManifestItemLoader._storeItemInRegistry.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Minimal for this test suite) ---

// Only need DataRegistry and Logger for _storeItemInRegistry tests,
// but the Base constructor needs all dependencies. We provide minimal mocks.
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
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
  getContentBasePath: jest.fn((type) => `./data/${type}`),
  ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, registryKey, filename) =>
      `./data/mods/${modId}/${registryKey}/${filename}`
  ),
  resolveContentPath: jest.fn(
    (registryKey, filename) => `./data/${registryKey}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest.fn(
    (modId) => `./data/mods/${modId}/mod-manifest.json`
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
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn().mockReturnValue(false), // Default: no override
  get: jest.fn().mockReturnValue(undefined),
  getAll: jest.fn().mockReturnValue([]),
  clear: jest.fn(),
  ...overrides,
});

const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

// --- Minimal Concrete Subclass for Testing Protected Method ---

class TestableLoader extends BaseManifestItemLoader {
  publicStoreItemInRegistry(
    category,
    modId,
    baseItemId,
    dataToStore,
    sourceFilename
  ) {
    return this._storeItemInRegistry.call(
      this,
      category,
      modId,
      baseItemId,
      dataToStore,
      sourceFilename
    );
  }

  async _processFetchedItem(_modId, _filename, _resolvedPath, _fetchedData) {
    return {
      id: _fetchedData?.id || 'dummyId',
      didOverride: false,
      qualifiedId: `${_modId}:${_fetchedData?.id || 'dummyId'}`,
    };
  }

  getLoggerClassName() {
    return this.constructor.name;
  }
}

// --- Test Suite ---

describe('BaseManifestItemLoader._storeItemInRegistry', () => {
  let mockConfig;
  let mockResolver;
  let mockFetcher;
  let mockValidator;
  let mockRegistry;
  let mockLogger;
  let testLoader;

  const TEST_MOD_ID = 'testMod';
  const TEST_CATEGORY = 'items';
  const TEST_FILENAME = 'item.json';
  const TEST_CONTENT_TYPE = 'items';

  beforeEach(() => {
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    testLoader = new TestableLoader(
      TEST_CONTENT_TYPE,
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    jest.clearAllMocks(); // Clear mocks after instantiation

    // Re-assign mocks directly to the instance variables
    testLoader._config = mockConfig;
    testLoader._pathResolver = mockResolver;
    testLoader._dataFetcher = mockFetcher;
    testLoader._schemaValidator = mockValidator;
    testLoader._dataRegistry = mockRegistry;
    testLoader._logger = mockLogger;
    testLoader._primarySchemaId =
      mockConfig.getContentTypeSchemaId(TEST_CONTENT_TYPE);
  });

  describe('Registry Check and Override Warning', () => {
    const baseItemId = 'item1';
    const data = { value: 'new' }; // dataToStore should not need 'id', _storeItemInRegistry adds it from baseItemId
    const finalRegistryKey = `${TEST_MOD_ID}:${baseItemId}`;
    const loaderClassName = 'TestableLoader';

    it('should NOT log a warning if registry.store returns false (no override)', () => {
      mockRegistry.store.mockReturnValue(false);

      testLoader.publicStoreItemInRegistry(
        TEST_CATEGORY,
        TEST_MOD_ID,
        baseItemId,
        data,
        TEST_FILENAME
      );

      expect(mockRegistry.store).toHaveBeenCalledWith(
        TEST_CATEGORY,
        finalRegistryKey,
        expect.objectContaining({
          id: baseItemId,
          _fullId: finalRegistryKey,
          _modId: TEST_MOD_ID,
          _sourceFile: TEST_FILENAME,
          value: 'new',
        })
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      // Debug for "Storing item..." and "Item ... stored successfully..."
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${loaderClassName} [${TEST_MOD_ID}]: Storing item in registry. Category: '${TEST_CATEGORY}', Qualified ID: '${finalRegistryKey}', Base ID: '${baseItemId}', Filename: '${TEST_FILENAME}'`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${loaderClassName} [${TEST_MOD_ID}]: Item '${finalRegistryKey}' (Base: '${baseItemId}') stored successfully in category '${TEST_CATEGORY}'.`
      );
    });

    it('should log a warning if registry.store returns true (override)', () => {
      mockRegistry.store.mockReturnValue(true); // Simulate item was overridden

      testLoader.publicStoreItemInRegistry(
        TEST_CATEGORY,
        TEST_MOD_ID,
        baseItemId,
        data,
        TEST_FILENAME
      );

      expect(mockRegistry.store).toHaveBeenCalledWith(
        TEST_CATEGORY,
        finalRegistryKey,
        expect.objectContaining({
          id: baseItemId,
          _fullId: finalRegistryKey,
          _modId: TEST_MOD_ID,
          _sourceFile: TEST_FILENAME,
          value: 'new',
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${loaderClassName} [${TEST_MOD_ID}]: Item '${finalRegistryKey}' (Base: '${baseItemId}') in category '${TEST_CATEGORY}' from file '${TEST_FILENAME}' overwrote an existing entry.`
      );
      // Debug for "Storing item..."
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${loaderClassName} [${TEST_MOD_ID}]: Storing item in registry. Category: '${TEST_CATEGORY}', Qualified ID: '${finalRegistryKey}', Base ID: '${baseItemId}', Filename: '${TEST_FILENAME}'`
      );
    });
  });

  describe('Data Augmentation and Storage', () => {
    const baseItemId = 'item1';
    const originalData = { description: 'Test', extra: true };
    const finalRegistryKey = `${TEST_MOD_ID}:${baseItemId}`;
    const loaderClassName = 'TestableLoader';

    it('should augment data with base id, _fullId, modId, and _sourceFile before storing', () => {
      mockRegistry.store.mockReturnValue(false); // No override

      const result = testLoader.publicStoreItemInRegistry(
        TEST_CATEGORY,
        TEST_MOD_ID,
        baseItemId,
        originalData,
        TEST_FILENAME
      );

      const expectedStoredData = {
        id: baseItemId, // Base ID
        _fullId: finalRegistryKey, // Qualified ID
        _modId: TEST_MOD_ID,
        _sourceFile: TEST_FILENAME,
        description: 'Test',
        extra: true,
      };

      expect(mockRegistry.store).toHaveBeenCalledTimes(1);
      expect(mockRegistry.store).toHaveBeenCalledWith(
        TEST_CATEGORY,
        finalRegistryKey,
        expect.objectContaining(expectedStoredData)
      );
      expect(result.qualifiedId).toBe(finalRegistryKey);
      expect(result.didOverride).toBe(false);
    });

    it('should correctly use baseItemId for "id" field even if original data had a conflicting "id"', () => {
      mockRegistry.store.mockReturnValue(false); // No override
      const dataWithConflictingId = {
        id: 'originalConflictingId',
        description: 'Test',
        extra: true,
      };

      const result = testLoader.publicStoreItemInRegistry(
        TEST_CATEGORY,
        TEST_MOD_ID,
        baseItemId, // This baseItemId should take precedence for the 'id' field
        dataWithConflictingId,
        TEST_FILENAME
      );

      const expectedStoredData = {
        id: baseItemId, // Should be baseItemId, not 'originalConflictingId'
        _fullId: finalRegistryKey,
        _modId: TEST_MOD_ID,
        _sourceFile: TEST_FILENAME,
        description: 'Test',
        extra: true,
      };

      expect(mockRegistry.store).toHaveBeenCalledTimes(1);
      expect(mockRegistry.store).toHaveBeenCalledWith(
        TEST_CATEGORY,
        finalRegistryKey,
        expect.objectContaining(expectedStoredData)
      );
      expect(result.qualifiedId).toBe(finalRegistryKey);
      expect(result.didOverride).toBe(false);
    });

    it('should log debug messages on successful storage (no override)', () => {
      mockRegistry.store.mockReturnValue(false); // No override

      testLoader.publicStoreItemInRegistry(
        TEST_CATEGORY,
        TEST_MOD_ID,
        baseItemId,
        originalData,
        TEST_FILENAME
      );

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `${loaderClassName} [${TEST_MOD_ID}]: Storing item in registry. Category: '${TEST_CATEGORY}', Qualified ID: '${finalRegistryKey}', Base ID: '${baseItemId}', Filename: '${TEST_FILENAME}'`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        `${loaderClassName} [${TEST_MOD_ID}]: Item '${finalRegistryKey}' (Base: '${baseItemId}') stored successfully in category '${TEST_CATEGORY}'.`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Storage Error Handling', () => {
    const baseItemId = 'item1';
    const data = { value: 'test' };
    const storageError = new Error('Registry store failed');

    it('should re-throw error from registry.store and not log it within _storeItemInRegistry', () => {
      mockRegistry.store.mockImplementation(() => {
        throw storageError;
      });

      expect(() => {
        testLoader.publicStoreItemInRegistry(
          TEST_CATEGORY,
          TEST_MOD_ID,
          baseItemId,
          data,
          TEST_FILENAME
        );
      }).toThrow(storageError);

      // _storeItemInRegistry itself does not catch or log errors from dataRegistry.store()
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  // Test argument validation (newly added based on implementation review)
  describe('Argument Validation', () => {
    const validBaseItemId = 'validItem';
    const validData = { value: 'data' };
    const validFilename = 'file.json';

    it.each([
      [
        null,
        TEST_MOD_ID,
        validBaseItemId,
        validData,
        validFilename,
        'Category must be a non-empty string',
      ],
      [
        '',
        TEST_MOD_ID,
        validBaseItemId,
        validData,
        validFilename,
        'Category must be a non-empty string',
      ],
      [
        TEST_CATEGORY,
        null,
        validBaseItemId,
        validData,
        validFilename,
        'ModId must be a non-empty string',
      ],
      [
        TEST_CATEGORY,
        '',
        validBaseItemId,
        validData,
        validFilename,
        'ModId must be a non-empty string',
      ],
      [
        TEST_CATEGORY,
        TEST_MOD_ID,
        null,
        validData,
        validFilename,
        'BaseItemId must be a non-empty string',
      ],
      [
        TEST_CATEGORY,
        TEST_MOD_ID,
        '',
        validData,
        validFilename,
        'BaseItemId must be a non-empty string',
      ],
      [
        TEST_CATEGORY,
        TEST_MOD_ID,
        validBaseItemId,
        null,
        validFilename,
        "Data for 'testMod:validItem' (category: items) must be an object",
      ],
      [
        TEST_CATEGORY,
        TEST_MOD_ID,
        validBaseItemId,
        'not-an-object',
        validFilename,
        "Data for 'testMod:validItem' (category: items) must be an object",
      ],
    ])(
      'should log error and throw TypeError for invalid arguments: category="%s", modId="%s", baseItemId="%s", dataToStore="%s"',
      (
        category,
        modId,
        baseItemId,
        dataToStore,
        filename,
        expectedLogPartial
      ) => {
        expect(() =>
          testLoader.publicStoreItemInRegistry(
            category,
            modId,
            baseItemId,
            dataToStore,
            filename
          )
        ).toThrow(TypeError);

        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(expectedLogPartial)
        );
        expect(mockRegistry.store).not.toHaveBeenCalled(); // Should not attempt to store
      }
    );
  });
});
