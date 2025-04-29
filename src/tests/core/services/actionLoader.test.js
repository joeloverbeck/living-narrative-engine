// Filename: src/tests/core/services/actionLoader.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals'; // Added afterEach
import ActionLoader from '../../../core/loaders/actionLoader.js'; // Adjust path to your ActionLoader
import {BaseManifestItemLoader} from '../../../core/loaders/baseManifestItemLoader.js'; // Base class for inheritance check

// --- Mock Service Factories (Keep as is) ---
const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (overrides.getContentTypeSchemaId && typeof overrides.getContentTypeSchemaId === 'function') {
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
    resolveModContentPath: jest.fn((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});
const createMockDataFetcher = (overrides = {}) => ({
    fetch: jest.fn().mockResolvedValue({}),
    ...overrides,
});
const createMockSchemaValidator = (overrides = {}) => ({
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
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
let validatePrimarySchemaSpy;

// --- Test Constants (Keep as is) ---
const TEST_MOD_ID = 'test-action-mod';
const ACTION_SCHEMA_ID = 'http://example.com/schemas/action.schema.json';
const ACTION_CONTENT_KEY = 'actions';
const ACTION_CONTENT_DIR = 'actions';
const ACTION_TYPE_NAME = 'actions';

beforeEach(() => { // Keep as is
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    try {
        actionLoader = new ActionLoader(
            mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger
        );
    } catch (error) {
        actionLoader = null;
    }

    if (actionLoader) {
        Object.values(mockConfig).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockResolver).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockFetcher).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockValidator).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockRegistry).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        mockLogger.info.mockClear(); mockLogger.warn.mockClear(); mockLogger.error.mockClear(); mockLogger.debug.mockClear();

        loadItemsInternalSpy = jest.spyOn(actionLoader, '_loadItemsInternal').mockResolvedValue(0);
        validatePrimarySchemaSpy = jest.spyOn(actionLoader, '_validatePrimarySchema').mockReturnValue({ isValid: true, errors: null });
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

afterEach(() => { // Keep as is
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
            const loader = new ActionLoader(tempConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, tempLogger);
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
            expect(tempLogger.debug).toHaveBeenCalledWith(`ActionLoader: Initialized.`); // This one comes from ActionLoader
            // Base constructor also logs debug if schema found
            expect(tempLogger.error).not.toHaveBeenCalled();
            expect(tempLogger.warn).not.toHaveBeenCalled();
        });

        it('should log a WARNING via base constructor if action schema ID is not found', () => {
            const warnLogger = createMockLogger();
            const badConfig = createMockConfiguration({
                getContentTypeSchemaId: jest.fn((typeName) => (typeName === 'actions' ? null : 'fallback'))
            });

            new ActionLoader(badConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, warnLogger);

            expect(warnLogger.warn).toHaveBeenCalledTimes(1);
            // --- CORRECTED EXPECTATION ---
            // Expect 'ActionLoader:' because base class uses this.constructor.name
            expect(warnLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`ActionLoader: Primary schema ID for content type 'actions' not found in configuration. Primary validation might be skipped.`)
            );
            // --- END CORRECTION ---
            expect(warnLogger.error).not.toHaveBeenCalled();
            expect(warnLogger.debug).toHaveBeenCalledWith('ActionLoader: Initialized.');
        });
    });

    // --- loadItemsForMod Tests (Keep as is) ---
    describe('loadItemsForMod (Actions)', () => {
        const mockManifest = { id: TEST_MOD_ID, name: 'Test Action Mod', version: '1.0.0', content: { [ACTION_CONTENT_KEY]: ['action1.json', 'action2.json'] }};
        const expectedLoadCount = 2;

        beforeEach(() => {
            if (actionLoader && loadItemsInternalSpy) { loadItemsInternalSpy.mockResolvedValue(expectedLoadCount); }
            else if (!actionLoader) {
                actionLoader = new ActionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
                loadItemsInternalSpy = jest.spyOn(actionLoader, '_loadItemsInternal').mockResolvedValue(expectedLoadCount);
                validatePrimarySchemaSpy = jest.spyOn(actionLoader, '_validatePrimarySchema').mockReturnValue({ isValid: true, errors: null });
            }
        });
        it('should log the loading message', async () => { /* ... */ });
        it('should call _loadItemsInternal with correct parameters', async () => { /* ... */ });
        it('should return the result from _loadItemsInternal', async () => { /* ... */ });
        it('should handle errors from _loadItemsInternal', async () => { /* ... */ });
        it('should return 0 if manifest has no actions content key', async () => { /* ... */ });
        // These tests call the base class method and are unaffected by the internal changes to _processFetchedItem
        // Re-paste the bodies if needed, but they should remain the same.
        it('should log the loading message', async () => {
            expect(actionLoader).toBeDefined();
            await actionLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, ACTION_CONTENT_KEY, ACTION_CONTENT_DIR, ACTION_TYPE_NAME);
            expect(mockLogger.info).toHaveBeenCalledWith(`ActionLoader: Loading ${ACTION_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`);
        });
        it('should call _loadItemsInternal with correct parameters', async () => {
            expect(actionLoader).toBeDefined();
            expect(loadItemsInternalSpy).toBeDefined();
            await actionLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, ACTION_CONTENT_KEY, ACTION_CONTENT_DIR, ACTION_TYPE_NAME);
            expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1);
            expect(loadItemsInternalSpy).toHaveBeenCalledWith(TEST_MOD_ID, mockManifest, ACTION_CONTENT_KEY, ACTION_CONTENT_DIR, ACTION_TYPE_NAME);
        });
        it('should return the result from _loadItemsInternal', async () => {
            expect(actionLoader).toBeDefined();
            const result = await actionLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, ACTION_CONTENT_KEY, ACTION_CONTENT_DIR, ACTION_TYPE_NAME);
            expect(result).toBe(expectedLoadCount);
        });
        it('should handle errors from _loadItemsInternal', async () => {
            expect(actionLoader).toBeDefined();
            expect(loadItemsInternalSpy).toBeDefined();
            const loadError = new Error('Internal loading failed');
            loadItemsInternalSpy.mockRejectedValue(loadError);
            await expect(actionLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, ACTION_CONTENT_KEY, ACTION_CONTENT_DIR, ACTION_TYPE_NAME)).rejects.toThrow(loadError);
            expect(mockLogger.info).toHaveBeenCalledWith(`ActionLoader: Loading ${ACTION_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`);
        });
        it('should return 0 if manifest has no actions content key', async () => {
            expect(actionLoader).toBeDefined();
            expect(loadItemsInternalSpy).toBeDefined();
            const manifestNoActions = { id: TEST_MOD_ID, name: 'Test No Actions Mod', version: '1.0.0', content: {} };
            loadItemsInternalSpy.mockResolvedValue(0);
            const result = await actionLoader.loadItemsForMod(TEST_MOD_ID, manifestNoActions, ACTION_CONTENT_KEY, ACTION_CONTENT_DIR, ACTION_TYPE_NAME);
            expect(result).toBe(0);
            expect(loadItemsInternalSpy).toHaveBeenCalledWith(TEST_MOD_ID, manifestNoActions, ACTION_CONTENT_KEY, ACTION_CONTENT_DIR, ACTION_TYPE_NAME);
        });
    });

    // --- _processFetchedItem Tests (Refactored Assertions) ---
    describe('_processFetchedItem', () => {
        const filename = 'test_action.json';
        const resolvedPath = `./data/mods/${TEST_MOD_ID}/${ACTION_CONTENT_DIR}/${filename}`;
        const namespacedActionIdFromFile = 'core:test_action';
        const baseActionIdExtracted = 'test_action';
        const baseActionData = { id: namespacedActionIdFromFile, description: 'A sample action.', parameters: {} };
        const finalRegistryKey = `${TEST_MOD_ID}:${baseActionIdExtracted}`;
        const fullyQualifiedReturnedId = `${TEST_MOD_ID}:${namespacedActionIdFromFile}`;

        beforeEach(() => { // Keep as is
            if (!actionLoader) {
                actionLoader = new ActionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
                loadItemsInternalSpy = jest.spyOn(actionLoader, '_loadItemsInternal').mockResolvedValue(0);
                validatePrimarySchemaSpy = jest.spyOn(actionLoader, '_validatePrimarySchema').mockReturnValue({ isValid: true, errors: null });
            }
            mockRegistry.get.mockClear(); mockRegistry.store.mockClear(); mockLogger.warn.mockClear(); mockLogger.error.mockClear(); mockLogger.debug.mockClear();
            validatePrimarySchemaSpy.mockClear().mockReturnValue({ isValid: true, errors: null });
            actionLoader._primarySchemaId = ACTION_SCHEMA_ID;
        });

        it('Success Path: should call primary validation, check registry, store, log, and return ID', async () => { /* Keep as is */ });
        it('Override Path: should call primary validation, check registry (found override), log warning, store, log, and return ID', async () => { /* Keep as is */ });
        it('Primary Schema Validation Failure: should throw error from _validatePrimarySchema, log, and not store', async () => { /* Keep as is */ });
        it('Missing `id` Field Failure: should call primary validation, then log error, throw, and not store', async () => { /* Keep as is */ });
        it('Registry Store Failure: should call primary validation, extract ID, then log error from base helper, throw', async () => { /* Keep as is */ });

        // Re-paste bodies if needed, but they should remain the same and pass after the previous fix
        it('Success Path: should call primary validation, check registry, store, log, and return ID', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined(); expect(validatePrimarySchemaSpy).toBeDefined();
            const fetchedData = JSON.parse(JSON.stringify(baseActionData)); mockRegistry.get.mockReturnValue(undefined);
            const resultId = await actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1); expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);
            expect(mockValidator.validate).not.toHaveBeenCalled();
            expect(mockRegistry.get).toHaveBeenCalledTimes(1); expect(mockRegistry.get).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey); expect(mockLogger.warn).not.toHaveBeenCalled();
            const expectedStoredData = { ...baseActionData, id: finalRegistryKey, modId: TEST_MOD_ID, _sourceFile: filename };
            expect(mockRegistry.store).toHaveBeenCalledTimes(1); expect(mockRegistry.store).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey, expectedStoredData);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing fetched item: ${filename}`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full ID '${namespacedActionIdFromFile}' and base ID '${baseActionIdExtracted}'`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Delegating storage for action (base ID: '${baseActionIdExtracted}')`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully stored ${ACTION_TYPE_NAME} item '${finalRegistryKey}'`));
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(resultId).toEqual(fullyQualifiedReturnedId);
        });
        it('Override Path: should call primary validation, check registry (found override), log warning, store, log, and return ID', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined(); expect(validatePrimarySchemaSpy).toBeDefined();
            const fetchedData = JSON.parse(JSON.stringify(baseActionData)); const existingActionData = { id: finalRegistryKey, description: 'Old', modId: 'other', _sourceFile: 'old.json' }; mockRegistry.get.mockReturnValue(existingActionData);
            const resultId = await actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1); expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);
            expect(mockRegistry.get).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey);
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Overwriting existing ${ACTION_TYPE_NAME} definition with key '${finalRegistryKey}'.`));
            const expectedStoredData = { ...baseActionData, id: finalRegistryKey, modId: TEST_MOD_ID, _sourceFile: filename };
            expect(mockRegistry.store).toHaveBeenCalledTimes(1); expect(mockRegistry.store).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey, expectedStoredData);
            expect(resultId).toEqual(fullyQualifiedReturnedId); expect(mockLogger.error).not.toHaveBeenCalled();
        });
        it('Primary Schema Validation Failure: should throw error from _validatePrimarySchema, log, and not store', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined(); expect(validatePrimarySchemaSpy).toBeDefined();
            const fetchedData = JSON.parse(JSON.stringify(baseActionData)); const validationError = new Error(`Schema validation failed for '${filename}'`);
            validatePrimarySchemaSpy.mockImplementation(() => { throw validationError; });
            await expect(actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME)).rejects.toThrow(validationError);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1); expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);
            expect(mockLogger.error).toHaveBeenCalledWith(`ActionLoader [${TEST_MOD_ID}]: Halting processing for '${filename}' due to primary schema validation error.`);
            expect(mockRegistry.get).not.toHaveBeenCalled(); expect(mockRegistry.store).not.toHaveBeenCalled();
        });
        it('Missing `id` Field Failure: should call primary validation, then log error, throw, and not store', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined(); expect(validatePrimarySchemaSpy).toBeDefined();
            const fetchedData = {description: 'Action without an ID.'}; validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null });
            await expect(actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME)).rejects.toThrow(`Invalid or missing 'id' in action definition file '${filename}' for mod '${TEST_MOD_ID}'.`);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1); expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);
            expect(mockLogger.error).toHaveBeenCalledTimes(1); expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid or missing 'id' in action definition file '${filename}'`), expect.objectContaining({ receivedId: undefined }));
            expect(mockRegistry.get).not.toHaveBeenCalled(); expect(mockRegistry.store).not.toHaveBeenCalled();
        });
        it('Registry Store Failure: should call primary validation, extract ID, then log error from base helper, throw', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined(); expect(validatePrimarySchemaSpy).toBeDefined();
            const fetchedData = JSON.parse(JSON.stringify(baseActionData)); const storeError = new Error('Registry unavailable');
            validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null }); mockRegistry.get.mockReturnValue(undefined);
            mockRegistry.store.mockImplementation(() => { throw storeError; });
            await expect(actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME)).rejects.toThrow(storeError);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1); expect(mockRegistry.get).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey);
            expect(mockRegistry.store).toHaveBeenCalledTimes(1); expect(mockRegistry.store).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey, expect.any(Object));
            expect(mockLogger.error).toHaveBeenCalledTimes(1); expect(mockLogger.error).toHaveBeenCalledWith(`ActionLoader [${TEST_MOD_ID}]: Failed to store ${ACTION_TYPE_NAME} item with key '${finalRegistryKey}' from file '${filename}' in data registry.`, expect.objectContaining({ finalRegistryKey: finalRegistryKey, error: storeError.message }), storeError);
        });

        // --- CORRECTED TEST for Invalid ID Format ---
        it('Invalid ID Format (e.g., namespace only): should call primary validation, then log error, throw, and not store', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined();
            expect(validatePrimarySchemaSpy).toBeDefined();
            // --- Arrange ---
            const invalidId = 'namespaceonly:'; // Invalid because name part is empty
            const fetchedData = { id: invalidId, description: 'Action with bad ID' };
            // Validation passes (mocked)
            validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null });

            // --- Act & Assert ---
            // Expect rejection with the specific error message from the refined logic
            await expect(actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME))
                .rejects.toThrow(`Could not extract base Action ID from '${invalidId}' in ${filename}. Invalid format.`);

            // Assert _validatePrimarySchema *was* called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);

            // Assert specific logging for bad base ID extraction
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // Check the log message matches the refined error check
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Could not extract valid base ID from ID '${invalidId}' in file '${filename}'. Format requires 'name' or 'namespace:name' with non-empty parts.`)
            );

            // Assert not stored or checked for override
            expect(mockRegistry.get).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });
        // --- END CORRECTION ---

    });
});