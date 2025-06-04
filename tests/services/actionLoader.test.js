// Filename: src/tests/core/services/actionLoader.test.js

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals'; // Added afterEach
import ActionLoader from '../../src/loaders/actionLoader.js'; // Adjust path to your ActionLoader
import { BaseManifestItemLoader } from '../../src/loaders/baseManifestItemLoader.js'; // Base class for inheritance check

// --- Mock Service Factories (Keep as is) ---
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (
      overrides.getContentTypeSchemaId &&
      typeof overrides.getContentTypeSchemaId === 'function'
    ) {
      const result = overrides.getContentTypeSchemaId(typeName);
      if (result !== undefined) return result;
    }
    if (typeName === 'actions') {
      return 'http://example.com/schemas/action.schema.json';
    }
    return `http://example.com/schemas/${typeName}.schema.json`;
  }),
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

// --- Shared Mocks Instance for Tests (Keep as is) ---
let mockConfig;
let mockResolver;
let mockFetcher;
let mockValidator;
let mockRegistry;
let mockLogger;
let actionLoader;
let loadItemsInternalSpy;
let validatePrimarySchemaSpy; // Keep the spy setup, but don't assert call in _processFetchedItem tests

// --- Test Constants (Keep as is) ---
const TEST_MOD_ID = 'test-action-mod';
const ACTION_SCHEMA_ID = 'http://example.com/schemas/action.schema.json';
const ACTION_CONTENT_KEY = 'actions';
const ACTION_CONTENT_DIR = 'actions';
const ACTION_TYPE_NAME = 'actions';

beforeEach(() => {
  // Keep as is
  mockConfig = createMockConfiguration();
  mockResolver = createMockPathResolver();
  mockFetcher = createMockDataFetcher();
  mockValidator = createMockSchemaValidator();
  mockRegistry = createMockDataRegistry();
  mockLogger = createMockLogger();

  try {
    actionLoader = new ActionLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );
  } catch (error) {
    actionLoader = null;
  }

  if (actionLoader) {
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
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    loadItemsInternalSpy = jest
      .spyOn(actionLoader, '_loadItemsInternal')
      .mockResolvedValue(0);
    // Still spy on _validatePrimarySchema for OTHER tests (e.g., testing _processFileWrapper if needed),
    // but mock its return value for the _processFetchedItem tests which assume validation passed.
    validatePrimarySchemaSpy = jest
      .spyOn(actionLoader, '_validatePrimarySchema')
      .mockReturnValue({ isValid: true, errors: null });
    actionLoader._logger = mockLogger;
  } else {
    jest.clearAllMocks();
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();
  }
});

afterEach(() => {
  // Keep as is
  jest.restoreAllMocks();
});

// --- Test Suite ---
describe('ActionLoader', () => {
  // --- Constructor Tests ---
  describe('Constructor', () => {
    it('should instantiate successfully inheriting from BaseManifestItemLoader', () => {
      // Keep this test as is - it should still pass
      const tempLogger = createMockLogger();
      const tempConfig = createMockConfiguration();
      const loader = new ActionLoader(
        tempConfig,
        mockResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        tempLogger
      );
      expect(loader).toBeInstanceOf(ActionLoader);
      expect(loader).toBeInstanceOf(BaseManifestItemLoader);
      expect(loader._config).toBe(tempConfig);
      expect(loader._pathResolver).toBe(mockResolver);
      expect(loader._dataFetcher).toBe(mockFetcher);
      expect(loader._schemaValidator).toBe(mockValidator);
      expect(loader._dataRegistry).toBe(mockRegistry);
      expect(loader._logger).toBe(tempLogger);
      expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledWith('actions');
      expect(loader._primarySchemaId).toEqual(ACTION_SCHEMA_ID);
      expect(tempLogger.debug).toHaveBeenCalledWith(
        `ActionLoader: Initialized.`
      ); // This one comes from ActionLoader
      // Base constructor also logs debug if schema found
      expect(tempLogger.error).not.toHaveBeenCalled();
      expect(tempLogger.warn).not.toHaveBeenCalled();
    });

    it('should log a WARNING via base constructor if action schema ID is not found', () => {
      const warnLogger = createMockLogger();
      const badConfig = createMockConfiguration({
        getContentTypeSchemaId: jest.fn((typeName) =>
          typeName === 'actions' ? null : 'fallback'
        ),
      });

      new ActionLoader(
        badConfig,
        mockResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        warnLogger
      );

      expect(warnLogger.warn).toHaveBeenCalledTimes(1);
      expect(warnLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `ActionLoader: Primary schema ID for content type 'actions' not found in configuration. Primary validation might be skipped.`
        )
      );
      expect(warnLogger.error).not.toHaveBeenCalled();
      expect(warnLogger.debug).toHaveBeenCalledWith(
        'ActionLoader: Initialized.'
      );
    });
  });

  // --- loadItemsForMod Tests (Keep as is) ---
  describe('loadItemsForMod (Actions)', () => {
    const mockManifest = {
      id: TEST_MOD_ID,
      name: 'Test Action Mod',
      version: '1.0.0',
      content: { [ACTION_CONTENT_KEY]: ['action1.json', 'action2.json'] },
    };
    // --- Corrected: Base class now returns LoadItemsResult object ---
    const expectedLoadResult = { count: 2, overrides: 0, errors: 0 };

    beforeEach(() => {
      // --- Corrected: Mock _loadItemsInternal to return the object ---
      if (actionLoader && loadItemsInternalSpy) {
        loadItemsInternalSpy.mockResolvedValue(expectedLoadResult);
      } else if (!actionLoader) {
        actionLoader = new ActionLoader(
          mockConfig,
          mockResolver,
          mockFetcher,
          mockValidator,
          mockRegistry,
          mockLogger
        );
        loadItemsInternalSpy = jest
          .spyOn(actionLoader, '_loadItemsInternal')
          .mockResolvedValue(expectedLoadResult);
        validatePrimarySchemaSpy = jest
          .spyOn(actionLoader, '_validatePrimarySchema')
          .mockReturnValue({ isValid: true, errors: null });
      }
    });
    it('should log the loading message', async () => {
      expect(actionLoader).toBeDefined();
      await actionLoader.loadItemsForMod(
        TEST_MOD_ID,
        mockManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `ActionLoader: Loading ${ACTION_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
      );
    });
    it('should call _loadItemsInternal with correct parameters', async () => {
      expect(actionLoader).toBeDefined();
      expect(loadItemsInternalSpy).toBeDefined();
      await actionLoader.loadItemsForMod(
        TEST_MOD_ID,
        mockManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1);
      expect(loadItemsInternalSpy).toHaveBeenCalledWith(
        TEST_MOD_ID,
        mockManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
    });
    it('should return the result from _loadItemsInternal', async () => {
      expect(actionLoader).toBeDefined();
      const result = await actionLoader.loadItemsForMod(
        TEST_MOD_ID,
        mockManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      // --- Corrected: Expect the LoadItemsResult object ---
      expect(result).toEqual(expectedLoadResult);
    });
    it('should handle errors from _loadItemsInternal', async () => {
      expect(actionLoader).toBeDefined();
      expect(loadItemsInternalSpy).toBeDefined();
      const loadError = new Error('Internal loading failed');
      loadItemsInternalSpy.mockRejectedValue(loadError);
      await expect(
        actionLoader.loadItemsForMod(
          TEST_MOD_ID,
          mockManifest,
          ACTION_CONTENT_KEY,
          ACTION_CONTENT_DIR,
          ACTION_TYPE_NAME
        )
      ).rejects.toThrow(loadError);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `ActionLoader: Loading ${ACTION_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
      );
      // Base class handles the error logging now
    });
    it('should return 0 count if manifest has no actions content key', async () => {
      // Renamed slightly for clarity
      expect(actionLoader).toBeDefined();
      expect(loadItemsInternalSpy).toBeDefined();
      const manifestNoActions = {
        id: TEST_MOD_ID,
        name: 'Test No Actions Mod',
        version: '1.0.0',
        content: {},
      };
      // --- Corrected: _loadItemsInternal returns the zero object ---
      const expectedZeroResult = { count: 0, overrides: 0, errors: 0 };
      loadItemsInternalSpy.mockResolvedValue(expectedZeroResult);
      const result = await actionLoader.loadItemsForMod(
        TEST_MOD_ID,
        manifestNoActions,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      expect(result).toEqual(expectedZeroResult);
      expect(loadItemsInternalSpy).toHaveBeenCalledWith(
        TEST_MOD_ID,
        manifestNoActions,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
    });
  });

  // --- _processFetchedItem Tests (Assertions Corrected) ---
  describe('_processFetchedItem', () => {
    const filename = 'test_action.json';
    const resolvedPath = `./data/mods/${TEST_MOD_ID}/${ACTION_CONTENT_DIR}/${filename}`;
    const namespacedActionIdFromFile = 'core:test_action';
    const baseActionIdExtracted = 'test_action';
    const baseActionData = {
      id: namespacedActionIdFromFile,
      description: 'A sample action.',
      parameters: {},
    };
    const finalRegistryKey = `${TEST_MOD_ID}:${baseActionIdExtracted}`;
    // _processFetchedItem returns an object now
    const expectedSuccessResult = {
      qualifiedId: finalRegistryKey,
      didOverride: false,
    };
    const expectedOverrideResult = {
      qualifiedId: finalRegistryKey,
      didOverride: true,
    };

    beforeEach(() => {
      // Keep as is
      if (!actionLoader) {
        actionLoader = new ActionLoader(
          mockConfig,
          mockResolver,
          mockFetcher,
          mockValidator,
          mockRegistry,
          mockLogger
        );
        loadItemsInternalSpy = jest
          .spyOn(actionLoader, '_loadItemsInternal')
          .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }); // Correct return type
        validatePrimarySchemaSpy = jest
          .spyOn(actionLoader, '_validatePrimarySchema')
          .mockReturnValue({ isValid: true, errors: null });
      }
      mockRegistry.get.mockClear();
      mockRegistry.store.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockLogger.debug.mockClear();
      // We don't need to mock the primary schema validation implementation here anymore for these specific tests
      validatePrimarySchemaSpy
        .mockClear()
        .mockReturnValue({ isValid: true, errors: null }); // Still clear spy, ensure it returns valid for precondition
      actionLoader._primarySchemaId = ACTION_SCHEMA_ID; // Ensure schema ID is set for completeness, though not directly used in these tests
      // --- Mock the internal _storeItemInRegistry helper ---
      // It's usually better to spy on the *dependency* (registry.store)
      // but since the logic for overwriting check and return value is *in* the helper,
      // let's mock the helper itself for these specific unit tests.
      jest.spyOn(actionLoader, '_storeItemInRegistry').mockReturnValue(false); // Default: no override
    });

    it('Success Path: should check registry, store, log, and return ID with override=false', async () => {
      expect(actionLoader?._processFetchedItem).toBeDefined();
      const fetchedData = JSON.parse(JSON.stringify(baseActionData));
      // Configure mocks specific to this test
      mockRegistry.get.mockReturnValue(undefined); // Ensure registry.get returns undefined for non-override case
      // Mock the helper to return false (no override)
      const storeItemSpy = jest
        .spyOn(actionLoader, '_storeItemInRegistry')
        .mockReturnValue(false);

      const result = await actionLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        ACTION_TYPE_NAME
      );

      // --- Assertions REMOVED for validatePrimarySchemaSpy ---
      // expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
      expect(mockValidator.validate).not.toHaveBeenCalled(); // This validates secondary schemas, should not be called by ActionLoader

      // Assertions for ID extraction and storage delegation (via the spy on the helper)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Processing fetched item: ${filename}`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Extracted full ID '${namespacedActionIdFromFile}' and base ID '${baseActionIdExtracted}'`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Delegating storage for action (base ID: '${baseActionIdExtracted}')`
        )
      );
      // Assert the helper was called correctly
      expect(storeItemSpy).toHaveBeenCalledTimes(1);
      expect(storeItemSpy).toHaveBeenCalledWith(
        ACTION_TYPE_NAME,
        TEST_MOD_ID,
        baseActionIdExtracted,
        fetchedData,
        filename
      );

      // Assert registry check (which happens inside the helper, but we can mock registry.get for setup)
      // Note: The _storeItemInRegistry spy replaces the actual helper logic including the registry.get call.
      // If we wanted to test the *internal* logic of _storeItemInRegistry, we wouldn't mock it.
      // Since we *are* mocking it, we don't need to assert registry.get here. We trust the helper spy.

      // Assert logging (final success log comes from _processFetchedItem)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully processed action from ${filename}. Returning final registry key: ${finalRegistryKey}, Overwrite: false`
        )
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Assert the final return value from _processFetchedItem
      expect(result).toEqual(expectedSuccessResult);
    });

    it('Override Path: should check registry, log warning, store, log, and return ID with override=true', async () => {
      expect(actionLoader?._processFetchedItem).toBeDefined();
      const fetchedData = JSON.parse(JSON.stringify(baseActionData));
      const existingActionData = {
        id: finalRegistryKey,
        description: 'Old',
        modId: 'other',
        _sourceFile: 'old.json',
      };
      // Configure mocks specific to this test
      mockRegistry.get.mockReturnValue(existingActionData); // Setup for overwrite check inside the helper
      // Mock the helper to return true (override occurred)
      const storeItemSpy = jest
        .spyOn(actionLoader, '_storeItemInRegistry')
        .mockReturnValue(true);

      const result = await actionLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        ACTION_TYPE_NAME
      );

      // --- Assertions REMOVED for validatePrimarySchemaSpy ---
      // expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);

      // Assert helper call
      expect(storeItemSpy).toHaveBeenCalledTimes(1);
      expect(storeItemSpy).toHaveBeenCalledWith(
        ACTION_TYPE_NAME,
        TEST_MOD_ID,
        baseActionIdExtracted,
        fetchedData,
        filename
      );

      // Assert logging (final success log comes from _processFetchedItem)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Processing fetched item: ${filename}`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Extracted full ID '${namespacedActionIdFromFile}' and base ID '${baseActionIdExtracted}'`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Delegating storage for action (base ID: '${baseActionIdExtracted}')`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully processed action from ${filename}. Returning final registry key: ${finalRegistryKey}, Overwrite: true`
        )
      );

      // Warning log happens inside the helper, which is mocked.
      // If testing the helper directly, we'd check mockLogger.warn. Here we trust the helper spy's return value.
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Assert the final return value from _processFetchedItem
      expect(result).toEqual(expectedOverrideResult);
    });

    it('Primary Schema Validation Failure: should NOT throw error from _processFetchedItem (validation is external)', async () => {
      // This test case is fundamentally changed because validation is outside _processFetchedItem.
      // We'll test that _processFetchedItem *doesn't* throw and completes normally *if called*,
      // assuming validation hypothetically failed *before* it was called (though the test setup can't enforce that perfectly now).
      expect(actionLoader?._processFetchedItem).toBeDefined();
      const fetchedData = JSON.parse(JSON.stringify(baseActionData));
      const validationError = new Error(
        `Schema validation failed for '${filename}'`
      );

      // Spy on the helper, ensure it's NOT called if _processFetchedItem throws early (which it shouldn't now)
      const storeItemSpy = jest
        .spyOn(actionLoader, '_storeItemInRegistry')
        .mockReturnValue(false);

      // --- REMOVED: Mocking the spy to throw ---
      // validatePrimarySchemaSpy.mockImplementation(() => { throw validationError; });

      // --- REMOVED: Expecting rejection ---
      // await expect(actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME)).rejects.toThrow(validationError);
      // --- ADDED: Expect successful completion (return value doesn't matter as much as it not throwing) ---
      await expect(
        actionLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          ACTION_TYPE_NAME
        )
      ).resolves.toBeDefined();

      // --- REMOVED: Asserting the schema spy was called (it won't be from here) ---
      // expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
      // expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);

      // --- Assertions that certain things *don't* happen (because the method completed successfully in this isolated test) ---
      // Error log specific to validation failure shouldn't occur here
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        `ActionLoader [${TEST_MOD_ID}]: Halting processing for '${filename}' due to primary schema validation error.`
      );
      // The store helper *would* be called in this direct invocation scenario
      // expect(storeItemSpy).not.toHaveBeenCalled(); // This might be called now, actually.

      // The original intent was that storage doesn't happen if validation fails upstream.
      // This test can no longer effectively test that specific interaction via direct call.
    });

    it('Missing `id` Field Failure: should log error, throw, and not attempt storage', async () => {
      expect(actionLoader?._processFetchedItem).toBeDefined();
      const fetchedData = { description: 'Action without an ID.' }; // Missing 'id'
      const storeItemSpy = jest.spyOn(actionLoader, '_storeItemInRegistry'); // Spy but don't mock implementation

      // --- REMOVED: Asserting the schema spy was called ---
      // validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null }); // Precondition still holds

      await expect(
        actionLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          ACTION_TYPE_NAME
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in action definition file '${filename}' for mod '${TEST_MOD_ID}'.`
      );

      // --- REMOVED: Asserting the schema spy was called ---
      // expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
      // expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);

      // Assert the specific error log for missing ID
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Invalid or missing 'id' in action definition file '${filename}'`
        ),
        expect.objectContaining({ receivedId: undefined })
      );
      // Ensure storage was not attempted
      expect(storeItemSpy).not.toHaveBeenCalled(); // Check the spy on the helper
    });

    it('Registry Store Failure: should attempt storage (call helper), log error from helper, and re-throw', async () => {
      expect(actionLoader?._processFetchedItem).toBeDefined();
      const fetchedData = JSON.parse(JSON.stringify(baseActionData));
      const storeError = new Error('Registry unavailable');

      // Mock the _storeItemInRegistry helper to throw the error
      const storeItemSpy = jest
        .spyOn(actionLoader, '_storeItemInRegistry')
        .mockImplementation(() => {
          throw storeError;
        });

      // --- REMOVED: Asserting the schema spy was called ---
      // validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null }); // Precondition

      await expect(
        actionLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          ACTION_TYPE_NAME
        )
      ).rejects.toThrow(storeError);

      // --- REMOVED: Asserting the schema spy was called ---
      // expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);

      // Assert that the storage helper *was* called
      expect(storeItemSpy).toHaveBeenCalledTimes(1);
      expect(storeItemSpy).toHaveBeenCalledWith(
        ACTION_TYPE_NAME,
        TEST_MOD_ID,
        baseActionIdExtracted,
        fetchedData,
        filename
      );

      // Error logging now happens inside the helper, which we mocked to throw.
      // If testing the helper directly, we'd check mockLogger.error.
      // Here, we just confirm the error propagated.
    });

    it('Invalid ID Format (e.g., namespace only): should log error, throw, and not attempt storage', async () => {
      expect(actionLoader?._processFetchedItem).toBeDefined();
      const invalidId = 'namespaceonly:'; // Invalid because name part is empty
      const fetchedData = { id: invalidId, description: 'Action with bad ID' };
      const storeItemSpy = jest.spyOn(actionLoader, '_storeItemInRegistry'); // Spy

      // --- REMOVED: Asserting the schema spy was called ---
      // validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null }); // Precondition

      await expect(
        actionLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          ACTION_TYPE_NAME
        )
      ).rejects.toThrow(
        `Could not extract base Action ID from '${invalidId}' in ${filename}. Invalid format.`
      );

      // --- REMOVED: Asserting the schema spy was called ---
      // expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);

      // Assert specific logging for bad base ID extraction
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Could not extract valid base ID from ID '${invalidId}' in file '${filename}'. Format requires 'name' or 'namespace:name' with non-empty parts.`
        )
      );

      // Assert not stored
      expect(storeItemSpy).not.toHaveBeenCalled();
    });
  });
});
