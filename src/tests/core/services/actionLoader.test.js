// Filename: src/tests/core/services/actionLoader.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ActionLoader from '../../../core/services/actionLoader.js'; // Adjust path to your ActionLoader
import {BaseManifestItemLoader} from '../../../core/services/baseManifestItemLoader.js'; // Base class for inheritance check

// --- Mock Service Factories (Copied from your provided setup) ---

const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    // Crucially, configure for 'actions' typeName
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'actions') {
            // Allow overriding for the specific failure test case
            if (overrides.getContentTypeSchemaId && typeof overrides.getContentTypeSchemaId === 'function') {
                const result = overrides.getContentTypeSchemaId(typeName);
                if (result !== undefined) return result; // Return override if provided
            }
            return 'http://example.com/schemas/action.schema.json';
        }
        return `http://example.com/schemas/${typeName}.schema.json`; // Default fallback
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    // Specific type path (ActionLoader uses 'actions')
    getContentBasePath: jest.fn((typeName) => `./data/${typeName}`),
    ...overrides, // Apply general overrides last
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
    fetch: jest.fn().mockResolvedValue({}), // Default mock fetch
    ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
    // Default to valid
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
    // Return a default validator function
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined), // Default to not finding existing items
    getAll: jest.fn().mockReturnValue([]),
    getAllSystemRules: jest.fn().mockReturnValue([]),
    clear: jest.fn(),
    getManifest: jest.fn().mockReturnValue(null),
    setManifest: jest.fn(),
    // Mock specific getters if ActionLoader interacts with them (unlikely for _processFetchedItem)
    getEntityDefinition: jest.fn(),
    getItemDefinition: jest.fn(),
    getLocationDefinition: jest.fn(),
    getConnectionDefinition: jest.fn(),
    getBlockerDefinition: jest.fn(),
    getActionDefinition: jest.fn(), // Might be used if checking overrides *within* the same mod load pass
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
let mockConfig;
let mockResolver;
let mockFetcher;
let mockValidator;
let mockRegistry;
let mockLogger;
let actionLoader; // Instance of ActionLoader

// --- Test Constants ---
const TEST_MOD_ID = 'test-action-mod';
const ACTION_SCHEMA_ID = 'http://example.com/schemas/action.schema.json';
const ACTION_CONTENT_KEY = 'actions'; // Key in manifest.content
const ACTION_CONTENT_DIR = 'actions'; // Directory name for content
const ACTION_TYPE_NAME = 'actions';   // Type name used in registry/schema lookup

beforeEach(() => {
    // Create fresh mocks before each test
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // Instantiate the ActionLoader
    // Use a try-catch block for instantiation specific tests that might fail here
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
        // Allow tests specifically checking constructor errors to proceed
        // console.log("Caught instantiation error during beforeEach (expected in some tests)");
        actionLoader = null; // Ensure loader is null if constructor fails
    }


    // Clear mocks *after* instantiation IF it succeeded.
    // Re-assign the fresh logger to the instance.
    if (actionLoader) {
        jest.clearAllMocks();
        mockLogger = createMockLogger(); // Re-create logger
        actionLoader._logger = mockLogger; // Ensure the instance uses the fresh mock

        // --- Mock Base Class Internal Methods ---
        // Spy on the prototype method for verification
        jest.spyOn(BaseManifestItemLoader.prototype, '_loadItemsInternal').mockResolvedValue(0); // Default mock
        // Ensure the instance uses the spy IF the method exists on the prototype
        if (typeof BaseManifestItemLoader.prototype._loadItemsInternal === 'function') {
            actionLoader._loadItemsInternal = BaseManifestItemLoader.prototype._loadItemsInternal;
        }
        // Use the real _processFetchedItem unless specifically mocked later
        if (ActionLoader.prototype._processFetchedItem) {
            actionLoader._processFetchedItem = ActionLoader.prototype._processFetchedItem.bind(actionLoader);
        }
    } else {
        // If instantiation failed, clear mocks created *before* the attempt
        jest.clearAllMocks();
        // Recreate mocks needed for tests that expect constructor failure
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
    }

});

// --- Test Suite ---

describe('ActionLoader', () => {

    // --- Constructor Tests (Leveraging Base Class Tests) ---
    describe('Constructor', () => {
        it('should instantiate successfully inheriting from BaseManifestItemLoader', () => {
            // Re-run constructor with fresh mocks for this specific test
            const tempLogger = createMockLogger();
            const tempConfig = createMockConfiguration();
            const loader = new ActionLoader(tempConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, tempLogger);

            expect(loader).toBeInstanceOf(ActionLoader);
            expect(loader).toBeInstanceOf(BaseManifestItemLoader);
            // Verify dependencies are stored (inherited check)
            expect(loader._config).toBe(tempConfig);
            expect(loader._pathResolver).toBe(mockResolver);
            expect(loader._dataFetcher).toBe(mockFetcher);
            expect(loader._schemaValidator).toBe(mockValidator);
            expect(loader._dataRegistry).toBe(mockRegistry);
            expect(loader._logger).toBe(tempLogger);

            // Check if the constructor logs the expected debug message
            expect(tempLogger.error).not.toHaveBeenCalled(); // Should not log error on successful init
        });

        it('should log an error if action schema ID is not found during construction', () => {
            // --- Arrange ---
            const errorLogger = createMockLogger();
            const badConfig = createMockConfiguration({
                getContentTypeSchemaId: jest.fn((typeName) => typeName === 'actions' ? null : 'fallback')
            });

            // --- Act ---
            // We expect this potentially to throw or just log, depending on implementation
            try {
                new ActionLoader(badConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, errorLogger);
            } catch (e) {
                // Ignore error if it throws, we just check logs
            }

            // --- Assert ---
            // Check that an error WAS logged during construction
            expect(errorLogger.error).toHaveBeenCalledTimes(1);
            expect(errorLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`ActionLoader: CRITICAL - Schema ID for '${ACTION_TYPE_NAME}' not found in configuration.`)
            );
        });


        // Note: Comprehensive constructor dependency validation tests are assumed
        // to be covered in BaseManifestItemLoader tests and are not repeated here
        // unless ActionLoader adds its *own* specific constructor validation.
    });

    // --- loadActionsForMod Tests ---
    describe('loadItemsForMod (Actions)', () => {
        const mockManifest = {
            id: TEST_MOD_ID,
            name: 'Test Action Mod',
            version: '1.0.0',
            content: {
                [ACTION_CONTENT_KEY]: ['action1.json', 'action2.json']
            }
        };
        const expectedLoadCount = 2; // Simulate 2 files processed successfully

        beforeEach(() => {
            // Reset the spy/mock for _loadItemsInternal before each test in this block
            // Ensure actionLoader is valid (it should be unless constructor test failed badly)
            if (actionLoader && typeof actionLoader._loadItemsInternal?.mockResolvedValue === 'function') {
                actionLoader._loadItemsInternal.mockResolvedValue(expectedLoadCount);
            } else if (typeof BaseManifestItemLoader.prototype._loadItemsInternal?.mockResolvedValue === 'function') {
                // If actionLoader failed init, mock the prototype directly for the test
                BaseManifestItemLoader.prototype._loadItemsInternal.mockResolvedValue(expectedLoadCount);
                // Need to instantiate here if beforeEach failed
                if (!actionLoader) {
                    actionLoader = new ActionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
                    actionLoader._loadItemsInternal = BaseManifestItemLoader.prototype._loadItemsInternal; // Re-link spy
                }
            } else {
                // Fallback if spy setup failed
                console.warn("Could not mock _loadItemsInternal for loadItemsForMod (Actions) tests");
            }
        });

        it('should log the loading message', async () => {
            expect(actionLoader).toBeDefined(); // Ensure loader is available
            // *** CORRECTION: Call loadItemsForMod instead of loadActionsForMod ***
            await actionLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                ACTION_CONTENT_KEY,
                ACTION_CONTENT_DIR,
                ACTION_TYPE_NAME
            );
            // The log message comes from the base class method and uses the constructor name
            expect(mockLogger.info).toHaveBeenCalledWith(
                `ActionLoader: Loading ${ACTION_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.` // Log message from BaseManifestItemLoader.loadItemsForMod
            );
        });

        it('should call _loadItemsInternal with correct parameters', async () => {
            expect(actionLoader).toBeDefined();
            expect(actionLoader._loadItemsInternal).toBeDefined(); // Check spy exists

            // *** CORRECTION: Call loadItemsForMod instead of loadActionsForMod ***
            await actionLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                ACTION_CONTENT_KEY,
                ACTION_CONTENT_DIR,
                ACTION_TYPE_NAME
            );

            // The internal delegation remains the same
            expect(actionLoader._loadItemsInternal).toHaveBeenCalledTimes(1);
            expect(actionLoader._loadItemsInternal).toHaveBeenCalledWith(
                TEST_MOD_ID,
                mockManifest,
                ACTION_CONTENT_KEY, // manifest key
                ACTION_CONTENT_DIR, // content directory
                ACTION_TYPE_NAME    // type name for registry/schema
            );
        });

        it('should return the result from _loadItemsInternal', async () => {
            expect(actionLoader).toBeDefined();
            // *** CORRECTION: Call loadItemsForMod instead of loadActionsForMod ***
            const result = await actionLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                ACTION_CONTENT_KEY,
                ACTION_CONTENT_DIR,
                ACTION_TYPE_NAME
            );
            expect(result).toBe(expectedLoadCount);
        });

        it('should handle errors from _loadItemsInternal', async () => {
            expect(actionLoader).toBeDefined();
            expect(actionLoader._loadItemsInternal).toBeDefined();
            const loadError = new Error('Internal loading failed');
            actionLoader._loadItemsInternal.mockRejectedValue(loadError);

            // *** CORRECTION: Call loadItemsForMod instead of loadActionsForMod ***
            await expect(actionLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                ACTION_CONTENT_KEY,
                ACTION_CONTENT_DIR,
                ACTION_TYPE_NAME
            )).rejects.toThrow(loadError);

            // Verify initial log still happened before the error
            expect(mockLogger.info).toHaveBeenCalledWith(
                `ActionLoader: Loading ${ACTION_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
            );
            // Base class or wrapper usually logs the error, not this method directly.
            // expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should return 0 if manifest has no actions content key', async () => {
            expect(actionLoader).toBeDefined();
            expect(actionLoader._loadItemsInternal).toBeDefined();
            const manifestNoActions = {
                id: TEST_MOD_ID,
                name: 'Test No Actions Mod',
                version: '1.0.0',
                content: { /* no 'actions' key */}
            };
            actionLoader._loadItemsInternal.mockResolvedValue(0); // Simulate base class returning 0

            // *** CORRECTION: Call loadItemsForMod instead of loadActionsForMod ***
            const result = await actionLoader.loadItemsForMod(
                TEST_MOD_ID,
                manifestNoActions,
                ACTION_CONTENT_KEY,
                ACTION_CONTENT_DIR,
                ACTION_TYPE_NAME
            );

            expect(result).toBe(0);
            // Verify _loadItemsInternal was still called, even with no relevant content
            expect(actionLoader._loadItemsInternal).toHaveBeenCalledWith(
                TEST_MOD_ID,
                manifestNoActions,
                ACTION_CONTENT_KEY,
                ACTION_CONTENT_DIR,
                ACTION_TYPE_NAME
            );
            // The base class's _loadItemsInternal would log the "No valid filenames" debug message.
        });
    });

    // --- _processFetchedItem Tests (Core ActionLoader Logic) ---
    describe('_processFetchedItem', () => {
        const filename = 'test_action.json';
        const resolvedPath = `./data/mods/${TEST_MOD_ID}/${ACTION_CONTENT_DIR}/${filename}`;

        // ***** CORRECTED Test Data *****
        const namespacedActionIdFromFile = 'core:test_action'; // VALID format
        const baseActionIdExtracted = 'test_action'; // Part after colon
        const baseActionData = {
            id: namespacedActionIdFromFile, // Use valid ID from file
            description: 'A sample action.',
            parameters: {} // Example structure
        };

        // Final ID used as KEY in registry (modId:baseActionId)
        const finalRegistryKey = `${TEST_MOD_ID}:${baseActionIdExtracted}`; // e.g., "test-action-mod:test_action"

        // Fully qualified ID RETURNED by _processFetchedItem (modId:namespacedActionId)
        const fullyQualifiedReturnedId = `${TEST_MOD_ID}:${namespacedActionIdFromFile}`; // e.g., "test-action-mod:core:test_action"


        // Use the real implementation for this suite
        beforeEach(() => {
            if (actionLoader && ActionLoader.prototype._processFetchedItem) {
                actionLoader._processFetchedItem = ActionLoader.prototype._processFetchedItem.bind(actionLoader);
            } else if (!actionLoader) {
                actionLoader = new ActionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
                actionLoader._processFetchedItem = ActionLoader.prototype._processFetchedItem.bind(actionLoader);
                jest.spyOn(BaseManifestItemLoader.prototype, '_loadItemsInternal').mockResolvedValue(0);
                if (typeof BaseManifestItemLoader.prototype._loadItemsInternal === 'function') {
                    actionLoader._loadItemsInternal = BaseManifestItemLoader.prototype._loadItemsInternal;
                }
            }
            mockValidator.isSchemaLoaded.mockReturnValue(true); // Assuming action schema doesn't need loading checks here
            mockConfig.getContentTypeSchemaId.mockReturnValue(ACTION_SCHEMA_ID);
        });

        it('Success Path: should validate, check registry (no override), store, log debug, and return data', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined();
            // --- Arrange ---
            const fetchedData = JSON.parse(JSON.stringify(baseActionData));
            mockValidator.validate.mockReturnValue({isValid: true, errors: null});
            mockRegistry.get.mockReturnValue(undefined);

            // --- Act ---
            const resultId = await actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME);

            // --- Assert ---
            // 1. Schema Validation
            expect(mockValidator.validate).toHaveBeenCalledTimes(1);
            expect(mockValidator.validate).toHaveBeenCalledWith(ACTION_SCHEMA_ID, fetchedData);

            // 2. Registry Check (for override) - uses finalRegistryKey
            expect(mockRegistry.get).toHaveBeenCalledTimes(1);
            expect(mockRegistry.get).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey); // Use correct key
            expect(mockLogger.warn).not.toHaveBeenCalled();

            // 3. Registry Store
            // Stored data includes the final registry key in its 'id' field
            const expectedStoredData = {
                ...baseActionData,          // Original data properties
                id: finalRegistryKey,       // ID within stored object is finalRegistryKey
                modId: TEST_MOD_ID,         // Added modId
                _sourceFile: filename       // Added source file
            };
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            // Store uses finalRegistryKey as the key
            expect(mockRegistry.store).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey, expectedStoredData);

            // 4. Logging (Adjust count if necessary)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing fetched item: ${filename}`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Schema validation passed for ${filename}`));
            // Check log uses the namespaced ID from file and extracted base ID
            // Base class store helper logs success using finalRegistryKey
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully stored ${ACTION_TYPE_NAME} item '${finalRegistryKey}'`));
            expect(mockLogger.error).not.toHaveBeenCalled();

            // 5. Return Value - should be fullyQualifiedReturnedId
            expect(resultId).toEqual(fullyQualifiedReturnedId);
        });

        it('Override Path: should validate, check registry (found override), log warning, store, log debug, and return data', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined();
            // --- Arrange ---
            const fetchedData = JSON.parse(JSON.stringify(baseActionData));
            const existingActionData = {
                id: finalRegistryKey, // Existing item would have the final registry key as its ID
                description: 'Old version',
                parameters: {},
                modId: 'some-other-mod',
                _sourceFile: 'old_action.json',
            };
            mockValidator.validate.mockReturnValue({isValid: true, errors: null});
            // Mock get to return existing data for the finalRegistryKey
            mockRegistry.get.mockImplementation((type, id) => {
                if (type === ACTION_TYPE_NAME && id === finalRegistryKey) {
                    return existingActionData;
                }
                return undefined;
            });

            // --- Act ---
            const resultId = await actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME);

            // --- Assert ---
            // 1. Schema Validation
            expect(mockValidator.validate).toHaveBeenCalledWith(ACTION_SCHEMA_ID, fetchedData);

            // 2. Registry Check (uses finalRegistryKey)
            expect(mockRegistry.get).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey);

            // 3. Override Warning Logged (uses finalRegistryKey)
            // Base class helper logs this warning
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`Overwriting existing ${ACTION_TYPE_NAME} definition with key '${finalRegistryKey}'.`)
            );

            // 4. Registry Store (uses finalRegistryKey)
            const expectedStoredData = {
                ...baseActionData,
                id: finalRegistryKey, // ID within stored object is finalRegistryKey
                modId: TEST_MOD_ID,
                _sourceFile: filename
            };
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey, expectedStoredData);

            // 5. Debug Log (Base class store helper logs success)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully stored ${ACTION_TYPE_NAME} item '${finalRegistryKey}'`));
            expect(mockLogger.error).not.toHaveBeenCalled();

            // 6. Return Value - should be fullyQualifiedReturnedId
            expect(resultId).toEqual(fullyQualifiedReturnedId);
        });

        it('Schema Validation Failure: should log error, throw, and not store', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined();
            // --- Arrange ---
            const fetchedData = JSON.parse(JSON.stringify(baseActionData));
            const validationErrors = [{message: 'Missing required property: target'}];
            mockValidator.validate.mockReturnValue({isValid: false, errors: validationErrors});

            // --- Act & Assert ---
            await expect(actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME))
                .rejects.toThrow(`Schema validation failed for action definition '${filename}' in mod '${TEST_MOD_ID}'.`);

            // Assert logging
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Schema validation failed for action definition '${filename}' using schema '${ACTION_SCHEMA_ID}'`),
                expect.objectContaining({ // Check context object
                    modId: TEST_MOD_ID,
                    filename: filename,
                    resolvedPath: resolvedPath,
                    schemaId: ACTION_SCHEMA_ID,
                    validationErrors: validationErrors,
                    // failedData: fetchedData // Implementation might include this
                })
            );

            // Assert not stored
            expect(mockRegistry.get).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing fetched item: ${filename}`)); // Initial log
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Stored action definition`)); // Store log didn't happen
        });

        it('Missing `id` Field Failure: should log error, throw, and not store', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined();
            // --- Arrange ---
            const fetchedData = {description: 'Action without an ID.'}; // No 'id' field
            mockValidator.validate.mockReturnValue({isValid: true, errors: null}); // Assume schema allows missing ID initially

            // --- Act & Assert ---
            await expect(actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME))
                .rejects.toThrow(`Invalid or missing 'id' in action definition file '${filename}' for mod '${TEST_MOD_ID}'.`);

            // Assert logging
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Invalid or missing 'id' in action definition file '${filename}'`),
                expect.objectContaining({ // Check context object
                    modId: TEST_MOD_ID,
                    filename: filename,
                    resolvedPath: resolvedPath,
                    receivedId: undefined // ID was missing
                })
            );

            // Assert schema validation *was* still called (happens before ID check)
            expect(mockValidator.validate).toHaveBeenCalledWith(ACTION_SCHEMA_ID, fetchedData);

            // Assert not stored or checked for override
            expect(mockRegistry.get).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Stored action definition`));
        });

        // NOTE: This test assumes the ActionLoader constructor issue (Failure 1) is resolved
        // OR that the constructor only logs and doesn't throw, allowing this test to proceed.
        it('Schema ID Not Found (simulated post-constructor): should log warn+error, throw, and not validate/store', async () => {
            // --- Arrange ---
            const specificLogger = createMockLogger(); // Use a specific logger for this test
            const badConfig = createMockConfiguration({
                // Mock config to return null for 'actions' schema ID
                getContentTypeSchemaId: jest.fn((typeName) => typeName === 'actions' ? null : 'fallback')
            });

            // Instantiate with the bad config and specific logger
            let loaderInstance;
            try {
                // We assume the constructor (even if unfixed) doesn't throw for missing ID
                loaderInstance = new ActionLoader(badConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, specificLogger);
            } catch (e) {
                console.error("Constructor threw during 'Schema ID Not Found' test setup:", e);
                // Handle potential constructor failure by creating a minimal mock
                loaderInstance = {
                    _processFetchedItem: ActionLoader.prototype._processFetchedItem?.bind(loaderInstance), // Bind if possible
                    _logger: specificLogger,
                    _config: badConfig,
                    _schemaValidator: mockValidator,
                    _dataRegistry: mockRegistry,
                    _getContentTypeSchemaId: BaseManifestItemLoader.prototype._getContentTypeSchemaId?.bind(loaderInstance), // Bind base helper
                    _storeItemInRegistry: BaseManifestItemLoader.prototype._storeItemInRegistry?.bind(loaderInstance), // Bind base helper
                    _typeName: ACTION_TYPE_NAME,
                    _contentTypeName: ACTION_TYPE_NAME,
                };
                // Re-bind after object creation
                if (ActionLoader.prototype._processFetchedItem) {
                    loaderInstance._processFetchedItem = ActionLoader.prototype._processFetchedItem.bind(loaderInstance);
                }
            }

            // Ensure method is available
            if (!loaderInstance?._processFetchedItem) {
                console.error("Failed to set up loaderInstance or _processFetchedItem for Schema ID Not Found test");
                expect(true).toBe(false); // Fail test explicitly
                return;
            }


            const filename = 'test_action_no_schema.json';
            const resolvedPath = `./data/mods/${TEST_MOD_ID}/${ACTION_CONTENT_DIR}/${filename}`;
            const fetchedData = JSON.parse(JSON.stringify(baseActionData)); // Use some valid-looking data

            // --- Act & Assert ---
            // Expect the specific error thrown by _processFetchedItem
            await expect(loaderInstance._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME))
                .rejects.toThrow(`Configuration Error: Action definition schema ID ('${ACTION_TYPE_NAME}') not configured.`);

            // Assert Logging:
            // 1. Expect the WARNING from the base class helper _getContentTypeSchemaId
            // ***** CORRECTION HERE *****
            expect(specificLogger.warn).toHaveBeenCalledWith(
                // Match the warning message from BaseManifestItemLoader._getContentTypeSchemaId
                expect.stringContaining(`${ActionLoader.name}: Schema ID for content type '${ACTION_TYPE_NAME}' not found in configuration.`)
            );
            // ***** END CORRECTION *****

            // 2. Expect the ERROR logged by _processFetchedItem itself before throwing
            expect(specificLogger.error).toHaveBeenCalledTimes(2); // Only error from _processFetchedItem
            expect(specificLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`ActionLoader [${TEST_MOD_ID}]: Cannot validate ${filename} - Action schema ID ('${ACTION_TYPE_NAME}') is not configured or was not found.`)
            );

            // NOTE: We are NOT checking for the constructor's CRITICAL error log here,
            // as that is covered by the first failing test ('should log an error if action schema ID is not found during construction')
            // and depends on fixing the constructor implementation.

            // Assert downstream methods not called by _processFetchedItem
            expect(mockValidator.validate).not.toHaveBeenCalled(); // Validation skipped
            expect(mockRegistry.get).not.toHaveBeenCalled();      // Storage helper not reached
            expect(mockRegistry.store).not.toHaveBeenCalled();     // Storage skipped
            // Check debug logs - initial processing log should happen
            expect(specificLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Processing fetched item: ${filename}`)
            );
            // Other debug logs related to validation/storage should NOT happen
            expect(specificLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Schema validation passed`));
            expect(specificLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully stored`));
        });


        // ***** CORRECTED 'Registry Store Failure' Test *****
        it('Registry Store Failure: should log error, throw after attempting store', async () => {
            expect(actionLoader?._processFetchedItem).toBeDefined();
            // --- Arrange ---
            const fetchedData = JSON.parse(JSON.stringify(baseActionData)); // Use corrected base data
            const storeError = new Error('Registry unavailable'); // Error to be thrown by store
            mockValidator.validate.mockReturnValue({isValid: true, errors: null});
            mockRegistry.get.mockReturnValue(undefined); // No override
            // Mock store to throw the specific error
            mockRegistry.store.mockImplementation(() => {
                throw storeError;
            });

            // --- Act & Assert ---
            // Execution should reach the store call because ID format is now valid
            await expect(actionLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, ACTION_TYPE_NAME))
                .rejects.toThrow(storeError); // Expect the *original* storeError

            // Assert logging (Check the log from the base class helper _storeItemInRegistry)
            expect(mockLogger.error).toHaveBeenCalledTimes(1);

            // ***** CORRECTED Assertion Arguments *****
            // 1. Expect the EXACT message logged by _storeItemInRegistry
            const expectedLogMessage = `ActionLoader [${TEST_MOD_ID}]: Failed to store ${ACTION_TYPE_NAME} item with key '${finalRegistryKey}' from file '${filename}' in data registry.`;

            // 2. Expect the details object logged by _storeItemInRegistry
            const expectedLogDetails = expect.objectContaining({
                modId: TEST_MOD_ID,
                category: ACTION_TYPE_NAME,
                baseItemId: baseActionIdExtracted, // Base helper logs the base ID
                finalRegistryKey: finalRegistryKey, // Base helper logs the final key
                sourceFilename: filename,           // Include sourceFilename
                error: storeError.message           // Base helper logs the error message string
            });

            // 3. Expect the original error object passed as the 3rd argument
            const expectedLogErrorObject = storeError;

            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedLogMessage,
                expectedLogDetails,
                expectedLogErrorObject
            );

            // Assert validation and check happened
            expect(mockValidator.validate).toHaveBeenCalled();
            expect(mockRegistry.get).toHaveBeenCalledWith(ACTION_TYPE_NAME, finalRegistryKey); // Checked with correct key
            expect(mockRegistry.store).toHaveBeenCalled(); // Store *was* attempted with correct key

            // Assert success log didn't happen
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully stored ${ACTION_TYPE_NAME} item`));
        });
    });
});