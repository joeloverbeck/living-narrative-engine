// Filename: src/tests/core/loaders/eventLoader.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals'; // Added afterEach
import EventLoader from '../../../core/loaders/eventLoader.js'; // Adjust path to your EventLoader
import {BaseManifestItemLoader} from '../../../core/loaders/baseManifestItemLoader.js'; // Base class for inheritance check

// --- Mock Service Factories (Adapted for EventLoader) ---

/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/coreServices.js').ModManifest} ModManifest */


/** Creates a mock IConfiguration service. */
const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    // Mock specifically for 'events' typeName, used by Base Class constructor
    getContentTypeSchemaId: jest.fn((typeName) => {
        // Allow overriding for specific test cases (e.g., base constructor failure)
        if (overrides.getContentTypeSchemaId && typeof overrides.getContentTypeSchemaId === 'function') {
            const result = overrides.getContentTypeSchemaId(typeName);
            if (result !== undefined) return result;
        }
        // Default behavior relevant to EventLoader
        if (typeName === 'events') {
            return 'http://example.com/schemas/event.schema.json';
        }
        // Default fallback for other types if needed by base class internals/tests
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getContentBasePath: jest.fn((typeName) => `./data/${typeName}`),
    ...overrides, // Apply general overrides last
});

/** Creates a mock IPathResolver service. */
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

/** Creates a mock IDataFetcher service. */
const createMockDataFetcher = (overrides = {}) => ({
    fetch: jest.fn().mockResolvedValue({}), // Default mock fetch
    ...overrides,
});

/** Creates a mock ISchemaValidator service. */
const createMockSchemaValidator = (overrides = {}) => ({
    // Mock validate for internal use by the *base class* _validatePrimarySchema
    // It might be called by the base class method we are now spying on.
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
    // Mock getValidator as it might be used by base class
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
    // Mock addSchema for event-specific payload schema logic
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    // Mock isSchemaLoaded used for both primary (base) and payload (event) schemas
    isSchemaLoaded: jest.fn().mockReturnValue(true), // Assume primary schema is loaded by default for tests
    ...overrides, // Apply general overrides last
});

/** Creates a mock IDataRegistry service. */
const createMockDataRegistry = (overrides = {}) => ({
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined), // Default to not finding existing items
    getAll: jest.fn().mockReturnValue([]),
    clear: jest.fn(),
    getAllSystemRules: jest.fn().mockReturnValue([]), // Adding methods potentially needed by base class
    getManifest: jest.fn().mockReturnValue(null),
    setManifest: jest.fn(),
    ...overrides,
});

/** Creates a mock ILogger service. */
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
});

// --- Shared Mocks Instance for Tests ---
/** @type {IConfiguration} */
let mockConfig;
/** @type {IPathResolver} */
let mockResolver;
/** @type {IDataFetcher} */
let mockFetcher;
/** @type {ISchemaValidator} */
let mockValidator;
/** @type {IDataRegistry} */
let mockRegistry;
/** @type {ILogger} */
let mockLogger;
/** @type {EventLoader} */
let eventLoader;

// --- Spies ---
let validatePrimarySchemaSpy;
let storeItemInRegistrySpy;
let loadItemsInternalSpy;

// --- Test Constants ---
const TEST_MOD_ID = 'test-event-mod';
const EVENT_SCHEMA_ID = 'http://example.com/schemas/event.schema.json';
const EVENT_CONTENT_KEY = 'events'; // Key in manifest.content
const EVENT_CONTENT_DIR = 'events'; // Directory name for content
const EVENT_TYPE_NAME = 'events';   // Type name used in registry/schema lookup

beforeEach(() => {
    // Create fresh mocks before each test
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // --- Set up Spies ---
    // Spy on the method EventLoader now calls for primary validation
    validatePrimarySchemaSpy = jest.spyOn(BaseManifestItemLoader.prototype, '_validatePrimarySchema');
    // Spy on the method EventLoader calls for storage
    storeItemInRegistrySpy = jest.spyOn(BaseManifestItemLoader.prototype, '_storeItemInRegistry');
    // Spy on the internal loading method used by loadItemsForMod
    loadItemsInternalSpy = jest.spyOn(BaseManifestItemLoader.prototype, '_loadItemsInternal');


    // Instantiate the EventLoader *after* setting up spies on the prototype
    eventLoader = new EventLoader(
        mockConfig,
        mockResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        mockLogger
    );

    // Clear mocks *after* instantiation if needed, but keep spy references.
    // jest.clearAllMocks(); // Careful: this clears spies too unless restored. Reset mocks manually.
    mockConfig.getContentTypeSchemaId.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockRegistry.store.mockClear();
    mockRegistry.get.mockClear();
    mockValidator.validate.mockClear();
    mockValidator.addSchema.mockClear();
    mockValidator.isSchemaLoaded.mockClear();
    mockFetcher.fetch.mockClear();

    // Re-assign potentially cleared mocks back to the instance if needed
    eventLoader._config = mockConfig;
    eventLoader._pathResolver = mockResolver;
    eventLoader._dataFetcher = mockFetcher;
    eventLoader._schemaValidator = mockValidator;
    eventLoader._dataRegistry = mockRegistry;
    eventLoader._logger = mockLogger;


    // --- Mock Base Class Internal Methods' Behavior ---
    // Default behavior for spies - they will call the original implementation unless mocked
    // For _loadItemsInternal, we usually want to mock its return value
    loadItemsInternalSpy.mockResolvedValue(0); // Default to loading 0 items
    // For _validatePrimarySchema, we default to success for most tests
    validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null }); // Mock the resolved value (it's synchronous)
    // For _storeItemInRegistry, we let the original run by default, as it just calls registry.store
    // We will mock registry.store directly or mockImplementation of the spy if needed.

    // Bind the actual _processFetchedItem method for testing (Specific to EventLoader)
    // Ensure we are testing the actual implementation, not a potential mock from other tests
    if (EventLoader.prototype._processFetchedItem) {
        eventLoader._processFetchedItem = EventLoader.prototype._processFetchedItem.bind(eventLoader);
    }

});

afterEach(() => {
    // Restore all spies to their original implementations
    jest.restoreAllMocks();
});


// --- Test Suite ---

describe('EventLoader', () => {

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should instantiate successfully inheriting from BaseManifestItemLoader and call super with "events"', () => {
            // Re-run constructor with fresh mocks for this specific test
            const tempConfig = createMockConfiguration();
            const tempLogger = createMockLogger();
            const loader = new EventLoader(tempConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, tempLogger);

            expect(loader).toBeInstanceOf(EventLoader);
            expect(loader).toBeInstanceOf(BaseManifestItemLoader);
            // AC: EventLoader constructor calls super() passing 'events' as the first argument...
            // Verify by checking that the base constructor used 'events' to get the schema ID
            expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledWith('events');
            expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledTimes(1); // Ensure it was called only once during init

            // Check dependencies are stored
            expect(loader._config).toBe(tempConfig);
            expect(loader._pathResolver).toBe(mockResolver);
            expect(loader._dataFetcher).toBe(mockFetcher);
            expect(loader._schemaValidator).toBe(mockValidator);
            expect(loader._dataRegistry).toBe(mockRegistry);
            expect(loader._logger).toBe(tempLogger);
            expect(tempLogger.error).not.toHaveBeenCalled(); // No errors during construction
            // Verify internal primarySchemaId is likely set (optional check, internal detail)
            // expect(loader._primarySchemaId).toEqual(EVENT_SCHEMA_ID);
        });

    });

    // --- loadItemsForMod Tests ---
    // These tests remain largely the same, as they test the public base class method
    // and its interaction with the *mocked* _loadItemsInternal. The refactoring
    // of _processFetchedItem doesn't directly impact these tests.
    describe('loadItemsForMod', () => {
        const mockManifest = {
            id: TEST_MOD_ID,
            name: 'Test Event Mod',
            version: '1.0.0',
            content: {
                [EVENT_CONTENT_KEY]: ['event1.json', 'event2.json']
            }
        };
        const expectedLoadCount = 2; // Simulate 2 files processed successfully

        beforeEach(() => {
            // Reset the spy's mock implementation before each test in this block
            loadItemsInternalSpy.mockResolvedValue(expectedLoadCount); // Default success mock
        });

        // Input validation tests (remain the same, handled by base class)
        it('should return 0 and log error if modId is missing or invalid', async () => {
            const result = await eventLoader.loadItemsForMod(null, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(result).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid 'modId' provided for loading ${EVENT_TYPE_NAME}`));
            expect(loadItemsInternalSpy).not.toHaveBeenCalled();
        });

        it('should return 0 and log error if modManifest is missing or invalid', async () => {
            const result = await eventLoader.loadItemsForMod(TEST_MOD_ID, undefined, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(result).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid 'modManifest' provided for loading ${EVENT_TYPE_NAME}`));
            expect(loadItemsInternalSpy).not.toHaveBeenCalled();
        });

        it('should throw TypeError and log error if contentKey is invalid', async () => {
            const invalidKey = '';
            await expect(eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, invalidKey, EVENT_CONTENT_DIR, EVENT_TYPE_NAME))
                .rejects.toThrow(TypeError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid 'contentKey' provided`));
            expect(loadItemsInternalSpy).not.toHaveBeenCalled();
        });

        it('should throw TypeError and log error if contentTypeDir is invalid', async () => {
            const invalidDir = null;
            await expect(eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, invalidDir, EVENT_TYPE_NAME))
                .rejects.toThrow(TypeError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid 'contentTypeDir' provided`));
            expect(loadItemsInternalSpy).not.toHaveBeenCalled();
        });

        it('should throw TypeError and log error if typeName is invalid', async () => {
            const invalidTypeName = ' ';
            await expect(eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, invalidTypeName))
                .rejects.toThrow(TypeError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid 'typeName' provided`));
            expect(loadItemsInternalSpy).not.toHaveBeenCalled();
        });


        // Delegation tests (remain the same)
        it('should log the loading info message', async () => {
            await eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `EventLoader: Loading ${EVENT_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Delegating loading for type '${EVENT_TYPE_NAME}' to _loadItemsInternal.`
            );
        });

        it('should call _loadItemsInternal with correct parameters', async () => {
            await eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1);
            expect(loadItemsInternalSpy).toHaveBeenCalledWith(
                TEST_MOD_ID,
                mockManifest,
                EVENT_CONTENT_KEY,
                EVENT_CONTENT_DIR,
                EVENT_TYPE_NAME
            );
        });

        it('should return the count from _loadItemsInternal', async () => {
            const result = await eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(result).toBe(expectedLoadCount);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Finished loading for type '${EVENT_TYPE_NAME}'. Count: ${expectedLoadCount}`
            );
        });

        it('should handle errors from _loadItemsInternal by propagating them', async () => {
            const loadError = new Error('Internal base loading failed');
            loadItemsInternalSpy.mockRejectedValue(loadError);

            await expect(eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME))
                .rejects.toThrow(loadError);

            expect(mockLogger.info).toHaveBeenCalledWith(
                `EventLoader: Loading ${EVENT_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Delegating loading for type '${EVENT_TYPE_NAME}' to _loadItemsInternal.`
            );
            expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1);
            // Base class's _loadItemsInternal and _processFileWrapper handle detailed error logging
        });
    });

    // --- _processFetchedItem Tests (Core EventLoader Logic - NOW REFACTORED) ---
    describe('_processFetchedItem', () => {
        const filename = 'test_event.json';
        const resolvedPath = `./data/mods/${TEST_MOD_ID}/${EVENT_CONTENT_DIR}/${filename}`;

        // Base event data structure
        const baseEventData = {
            id: 'core:test_event', // Full ID as it appears in the file
            description: 'A sample event definition.',
            payloadSchema: { // Example with a payload schema
                type: 'object',
                properties: {
                    targetId: {type: 'string', description: 'Entity ID receiving the effect.'},
                    amount: {type: 'integer', description: 'Magnitude of the effect.'}
                },
                required: ['targetId', 'amount']
            }
        };
        // Event data without a payload schema
        const eventDataNoPayload = {
            id: 'mod:simple_event',
            description: 'An event without a payload schema.',
        };

        const fullEventIdFromFile = baseEventData.id; // e.g., "core:test_event"
        const baseEventIdExtracted = 'test_event';    // e.g., "test_event"
        const finalRegistryKey = `${TEST_MOD_ID}:${baseEventIdExtracted}`; // e.g., "test-event-mod:test_event"
        const payloadSchemaId = `${fullEventIdFromFile}#payload`; // e.g., "core:test_event#payload"


        // Reset relevant mocks before each test in this block
        beforeEach(() => {
            // Default mocks for successful processing *after* primary validation
            mockValidator.isSchemaLoaded.mockReturnValue(false); // Default: payload schema not loaded yet
            mockValidator.addSchema.mockResolvedValue(undefined);
            mockRegistry.get.mockReturnValue(undefined); // Default: no override
            // Reset spies/mocks specific to _processFetchedItem tests
            validatePrimarySchemaSpy.mockClear();
            storeItemInRegistrySpy.mockClear(); // Clear calls, keep spy
            // Default to successful primary validation for most tests
            validatePrimarySchemaSpy.mockReturnValue({isValid: true, errors: null});
            // Let _storeItemInRegistry execute its original logic by default
            storeItemInRegistrySpy.mockImplementation(
                (category, modId, baseItemId, dataToStore, sourceFilename) => {
                    const finalKey = `${modId}:${baseItemId}`;
                    const finalData = { ...dataToStore, id: finalKey, modId, _sourceFile: sourceFilename };
                    // Simulate the call to registry.store that the original method does
                    mockRegistry.store(category, finalKey, finalData);
                    // Original method also logs debug on success, we won't mock that part here
                }
            );
        });

        // --- Success Path ---
        it('Success Path (with payload): should call primary validation, extract ID, register payload schema, store, log, and return final key', async () => {
            const fetchedData = JSON.parse(JSON.stringify(baseEventData));
            // Assume payload schema is not loaded yet for this test
            mockValidator.isSchemaLoaded.mockReturnValueOnce(false); // For payload schema check

            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // 1. Primary Schema Validation (Delegated)
            // AC: EventLoader._processFetchedItem calls this._validatePrimarySchema(...) as the first step.
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);
            // AC: EventLoader._processFetchedItem no longer contains the manual code block...
            expect(mockConfig.getContentTypeSchemaId).not.toHaveBeenCalled(); // Should not be called *within* _processFetchedItem
            expect(mockValidator.validate).not.toHaveBeenCalled(); // Should not be called *directly* within _processFetchedItem for primary schema

            // 2. ID Extraction (Remains)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullEventIdFromFile}' and base event ID '${baseEventIdExtracted}'`));

            // 3. Payload Schema Registration (Remains)
            // AC: Checking for and registering payloadSchema ... remains functional.
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found valid payloadSchema in ${filename}`));
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(payloadSchemaId); // Called for payload schema
            expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
            expect(mockValidator.addSchema).toHaveBeenCalledWith(fetchedData.payloadSchema, payloadSchemaId);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully registered payload schema '${payloadSchemaId}'`));

            // 4. Storage (Delegated via base helper)
            // AC: Calling _storeItemInRegistry remains functional.
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Delegating storage for event (base ID: '${baseEventIdExtracted}')`));
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, baseEventIdExtracted, fetchedData, filename);
            // Verify the underlying registry call made by the (unmocked) spy implementation
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            const expectedStoredData = {
                ...fetchedData,
                id: finalRegistryKey, // ID is overwritten by helper
                modId: TEST_MOD_ID,
                _sourceFile: filename,
            };
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalRegistryKey, expectedStoredData);

            // 5. Return Value (Remains)
            // AC: Returning the final ID remains functional.
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully processed event definition from ${filename}. Returning final registry key: ${finalRegistryKey}`));
            expect(resultKey).toEqual(finalRegistryKey);

            // 6. No Errors/Warnings expected
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('Success Path (no payload): should call primary validation, extract ID, skip payload schema, store, log, and return final key', async () => {
            const fetchedData = JSON.parse(JSON.stringify(eventDataNoPayload));
            const simpleFullId = eventDataNoPayload.id;
            const simpleBaseId = 'simple_event';
            const simpleFinalKey = `${TEST_MOD_ID}:${simpleBaseId}`;

            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // 1. Primary Schema Validation (Delegated)
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);

            // 2. ID Extraction (Remains)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${simpleFullId}' and base event ID '${simpleBaseId}'`));

            // 3. Payload Schema Registration (Skipped - Remains)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found in ${filename} for event '${simpleFullId}'. Skipping`));
            expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalledWith(expect.stringContaining('#payload')); // Ensure payload check didn't happen
            expect(mockValidator.addSchema).not.toHaveBeenCalled();

            // 4. Storage (Delegated via base helper - Remains)
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, simpleBaseId, fetchedData, filename);
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            const expectedStoredData = {
                ...fetchedData,
                id: simpleFinalKey,
                modId: TEST_MOD_ID,
                _sourceFile: filename,
            };
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, simpleFinalKey, expectedStoredData);

            // 5. Return Value (Remains)
            expect(resultKey).toEqual(simpleFinalKey);

            // 6. No Errors/Warnings expected
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });


        // --- Failure Scenarios ---

        it('Failure: Primary schema validation fails (simulated via spy)', async () => {
            const validationError = new Error(`Schema validation failed for event definition '${filename}' in mod '${TEST_MOD_ID}'.`);
            // Simulate the base validation method throwing an error
            validatePrimarySchemaSpy.mockImplementation(() => {
                // Simulate the logging that might happen inside _validatePrimarySchema before throwing
                mockLogger.error(`Simulated base validation failure log for ${filename}`);
                throw validationError;
            });

            const fetchedData = { invalid_structure: true }; // Data that would fail

            // Expect _processFetchedItem to reject because _validatePrimarySchema threw
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(validationError);

            // Verify primary validation was called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);

            // Verify the simulated error log was called
            expect(mockLogger.error).toHaveBeenCalledWith(`Simulated base validation failure log for ${filename}`);

            // Ensure subsequent steps were skipped
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('Failure: Missing `id` field in data (occurs after successful primary validation)', async () => {
            const fetchedData = {description: 'Event without ID'}; // No 'id' field

            // Primary validation succeeds (default mock behavior)
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Invalid or missing 'id' in event definition file '${filename}' for mod '${TEST_MOD_ID}'.`);

            // Verify primary validation was called and succeeded
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            expect(validatePrimarySchemaSpy).toHaveBeenCalledWith(fetchedData, filename, TEST_MOD_ID, resolvedPath);

            // Verify the specific error for missing ID was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Invalid or missing 'id' in event definition file '${filename}'. ID must be a non-empty string.`,
                expect.objectContaining({modId: TEST_MOD_ID, filename, resolvedPath, receivedId: undefined})
            );

            // Ensure subsequent steps were skipped
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('Failure: Invalid `id` field type (not string)', async () => {
            const fetchedData = {id: 123, description: 'Numeric ID'};

            // Primary validation succeeds (default mock behavior)
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Invalid or missing 'id' in event definition file '${filename}' for mod '${TEST_MOD_ID}'.`);

            // Verify primary validation was called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);

            // Verify the specific error for invalid ID was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Invalid or missing 'id' in event definition file '${filename}'`),
                expect.objectContaining({receivedId: 123})
            );

            // Ensure subsequent steps were skipped
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('Failure: Cannot extract base ID (e.g., only colon)', async () => {
            const fetchedData = {id: ':', description: 'Just a colon'};

            // Primary validation succeeds (default mock behavior)
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Could not extract valid base event ID from ':' in ${filename}`);

            // Verify primary validation was called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);

            // Verify the specific error for base ID extraction failed
            // --- FIXED: Updated expected error message string ---
            expect(mockLogger.error).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Could not extract valid base event ID from full ID ':' in file '${filename}'. ID format must be 'namespace:baseId' or 'baseId' with non-empty parts.`,
                expect.objectContaining({modId: TEST_MOD_ID, filename, fullEventIdFromFile: ':'})
            );
            // Ensure subsequent steps were skipped
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });


        it('Failure: Payload schema registration fails', async () => {
            const addSchemaError = new Error('Failed to add schema to validator');
            mockValidator.addSchema.mockRejectedValue(addSchemaError);
            // Assume payload schema is not loaded yet
            mockValidator.isSchemaLoaded.mockReturnValueOnce(false); // For payload schema check

            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            // Primary validation succeeds (default mock behavior)
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`CRITICAL: Failed to register payload schema '${payloadSchemaId}' for event '${fullEventIdFromFile}'.`);

            // Verify primary validation was called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            // Verify ID extraction happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullEventIdFromFile}'`));
            // Verify payload check happened
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(payloadSchemaId);
            // Verify addSchema was called (and threw)
            expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
            expect(mockValidator.addSchema).toHaveBeenCalledWith(fetchedData.payloadSchema, payloadSchemaId);

            // Verify the specific error log for registration failure
            expect(mockLogger.error).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: CRITICAL - Failed to register payload schema '${payloadSchemaId}' for event '${fullEventIdFromFile}' from file '${filename}'.`,
                expect.objectContaining({
                    modId: TEST_MOD_ID,
                    filename,
                    fullEventIdFromFile,
                    payloadSchemaId,
                    error: addSchemaError.message
                }),
                addSchemaError // Log the original error object too
            );
            // Ensure storage was skipped
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });


        it('Warning: Payload schema already loaded', async () => {
            // Assume payload schema IS loaded for this test
            mockValidator.isSchemaLoaded.mockReturnValueOnce(true); // For payload schema check

            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            // Should still succeed overall
            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(resultKey).toEqual(finalRegistryKey);

            // Verify primary validation was called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);

            // Verify payload check happened
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(payloadSchemaId);

            // Verify warning was logged
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Payload schema ID '${payloadSchemaId}' for event '${fullEventIdFromFile}' in file '${filename}' was already loaded. Overwriting or duplicate definition detected.`
            );
            // Verify addSchema was NOT called again
            expect(mockValidator.addSchema).not.toHaveBeenCalled();

            // Verify storage still happened
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledTimes(1); // Via the spy's implementation
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('Failure: Storage fails (error from base _storeItemInRegistry)', async () => {
            const storeError = new Error('Registry write failed');
            // Mock the base storage helper to throw an error
            storeItemInRegistrySpy.mockImplementation(() => {
                // Simulate the logging that might happen inside _storeItemInRegistry before throwing
                mockLogger.error(`Simulated base storage failure log for ${finalRegistryKey}`);
                throw storeError;
            });
            // Assume payload schema registration succeeds
            mockValidator.isSchemaLoaded.mockReturnValueOnce(false);
            mockValidator.addSchema.mockResolvedValue(undefined);

            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            // Primary validation succeeds (default mock behavior)
            // Payload schema registration succeeds
            // _storeItemInRegistry is called but throws
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(storeError);

            // Verify the steps before storage were completed
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            expect(mockValidator.addSchema).toHaveBeenCalledTimes(1); // Assume payload schema registration succeeded

            // Verify the store helper method was called (and threw)
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, baseEventIdExtracted, fetchedData, filename);

            // Verify the error log (which should be logged by the *mocked* base _storeItemInRegistry)
            expect(mockLogger.error).toHaveBeenCalledWith(`Simulated base storage failure log for ${finalRegistryKey}`);
            // Underlying mockRegistry.store should NOT have been called because the spy threw first
            expect(mockRegistry.store).not.toHaveBeenCalled();

            // Verify the final "Successfully processed" log was NOT called
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully processed event definition'));
        });

        // --- Edge Cases (No changes needed other than primary validation check) ---
        it('Edge Case: Event ID without namespace', async () => {
            const fetchedData = {
                id: 'simple_event_no_ns',
                description: 'Event without namespace prefix'
            };
            const fullId = fetchedData.id;
            const baseId = fetchedData.id; // Base ID is the same as full ID
            const finalKey = `${TEST_MOD_ID}:${baseId}`;

            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // Verify primary validation called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            // Verify result
            expect(resultKey).toEqual(finalKey);
            // Verify correct IDs logged
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullId}' and base event ID '${baseId}'`));
            // Verify storage helper called with correct base ID
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, baseId, fetchedData, filename);
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalKey, expect.objectContaining({ id: finalKey, modId: TEST_MOD_ID }));
        });

        it('Edge Case: Event ID with multiple colons', async () => {
            const fetchedData = {
                id: 'mod:category:complex_event',
                description: 'Event with multiple colons in ID'
            };
            const fullId = fetchedData.id;
            const baseId = 'category:complex_event'; // Everything after the first colon
            const finalKey = `${TEST_MOD_ID}:${baseId}`;

            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // Verify primary validation called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            // Verify result
            expect(resultKey).toEqual(finalKey);
            // Verify correct IDs logged
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullId}' and base event ID '${baseId}'`));
            // Verify storage helper called with correct base ID
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, baseId, fetchedData, filename);
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalKey, expect.objectContaining({ id: finalKey, modId: TEST_MOD_ID }));
        });

        it('Edge Case: Empty but valid payloadSchema object', async () => {
            const fetchedData = {
                id: 'core:empty_payload_event',
                description: 'Event with empty payload schema object',
                payloadSchema: {} // Empty object
            };
            const fullId = fetchedData.id;
            const baseId = 'empty_payload_event';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;

            await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // Verify primary validation called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            // Should skip registration
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found in ${filename} for event '${fullId}'. Skipping`));
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            // Should still store the main event definition
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalKey, expect.any(Object));
        });

        it('Edge Case: Null payloadSchema', async () => {
            const fetchedData = {
                id: 'core:null_payload_event',
                description: 'Event with null payload schema',
                payloadSchema: null
            };
            const fullId = fetchedData.id;
            const baseId = 'null_payload_event';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;

            await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // Verify primary validation called
            expect(validatePrimarySchemaSpy).toHaveBeenCalledTimes(1);
            // Should skip registration
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found in ${filename} for event '${fullId}'. Skipping`));
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            // Should still store the main event definition
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalKey, expect.any(Object));
        });
    });
});