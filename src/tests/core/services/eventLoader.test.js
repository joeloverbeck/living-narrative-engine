// Filename: src/tests/core/services/eventLoader.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import EventLoader from '../../../core/services/eventLoader.js'; // Adjust path to your EventLoader
import {BaseManifestItemLoader} from '../../../core/services/baseManifestItemLoader.js'; // Base class for inheritance check

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
    // Configure specifically for 'events' typeName
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'events') {
            // Allow overriding for the specific failure test case
            if (overrides.getContentTypeSchemaId && typeof overrides.getContentTypeSchemaId === 'function') {
                const result = overrides.getContentTypeSchemaId(typeName);
                if (result !== undefined) return result; // Return override if provided
            }
            return 'http://example.com/schemas/event.schema.json';
        }
        return `http://example.com/schemas/${typeName}.schema.json`; // Default fallback
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    // Specific type path (EventLoader uses 'events')
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
    // Default to valid
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
    // Return a default validator function
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    isSchemaLoaded: jest.fn().mockReturnValue(false), // Default to payload schemas NOT being loaded
    ...overrides,
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

    // Instantiate the EventLoader
    eventLoader = new EventLoader(
        mockConfig,
        mockResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        mockLogger
    );

    // Clear mocks *after* instantiation. Re-assign mocks to instance.
    jest.clearAllMocks();
    eventLoader._config = mockConfig;
    eventLoader._pathResolver = mockResolver;
    eventLoader._dataFetcher = mockFetcher;
    eventLoader._schemaValidator = mockValidator;
    eventLoader._dataRegistry = mockRegistry;
    eventLoader._logger = mockLogger;


    // --- Mock Base Class Internal Methods ---
    // Spy ONLY on methods EventLoader explicitly delegates to in the method being tested,
    // OR methods whose call we want to prevent/verify without executing their full logic.
    // For loadEventsForMod, we spy on _loadItemsInternal.
    // For _processFetchedItem, we DON'T spy on _getContentTypeSchemaId or _storeItemInRegistry
    // because we want the actual base implementations to run (they use the injected mocks).
    jest.spyOn(BaseManifestItemLoader.prototype, '_loadItemsInternal'); // Don't mock implementation here, do it in the relevant describe block

    // Ensure the instance uses the spy if needed (though prototype spy is usually sufficient)
    if (typeof eventLoader._loadItemsInternal === 'function') {
        eventLoader._loadItemsInternal = BaseManifestItemLoader.prototype._loadItemsInternal;
    }

    // Bind the actual _processFetchedItem method for testing
    if (EventLoader.prototype._processFetchedItem) {
        eventLoader._processFetchedItem = EventLoader.prototype._processFetchedItem.bind(eventLoader);
    }

    // --- IMPORTANT CORRECTION: REMOVED PROBLEMATIC SPIES/MOCKS ---
    // REMOVED: jest.spyOn(BaseManifestItemLoader.prototype, '_getContentTypeSchemaId')...
    // REMOVED: jest.spyOn(BaseManifestItemLoader.prototype, '_storeItemInRegistry')...
    // REMOVED: Assignments related to the removed spies
});

// --- Test Suite ---

describe('EventLoader', () => {

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should instantiate successfully inheriting from BaseManifestItemLoader', () => {
            // Re-run constructor with fresh mocks for this specific test
            const tempLogger = createMockLogger();
            const tempConfig = createMockConfiguration();
            const loader = new EventLoader(tempConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, tempLogger);

            expect(loader).toBeInstanceOf(EventLoader);
            expect(loader).toBeInstanceOf(BaseManifestItemLoader);
            // Verify dependencies are stored (inherited check)
            expect(loader._config).toBe(tempConfig);
            expect(loader._pathResolver).toBe(mockResolver);
            expect(loader._dataFetcher).toBe(mockFetcher);
            expect(loader._schemaValidator).toBe(mockValidator);
            expect(loader._dataRegistry).toBe(mockRegistry);
            expect(loader._logger).toBe(tempLogger);
            expect(tempLogger.error).not.toHaveBeenCalled();
        });

        it('should log initialization message', () => {
            // This test relies on the logger passed during instantiation in beforeEach
            new EventLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
            // Need to check the mockLogger created *for this test*, not the global one potentially cleared
            expect(mockLogger.debug).toHaveBeenCalledWith('EventLoader: Initialized.');
        });
    });

    // --- loadEventsForMod Tests ---
    describe('loadEventsForMod', () => {
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
            // Configure the spy/mock for _loadItemsInternal for this block
            // Use the spy attached to the instance in the outer beforeEach
            if (typeof eventLoader._loadItemsInternal?.mockResolvedValue === 'function') {
                eventLoader._loadItemsInternal.mockResolvedValue(expectedLoadCount);
            } else {
                console.warn("Could not mock _loadItemsInternal for loadEventsForMod tests");
            }
        });

        it('should return 0 and log error if modId is missing', async () => {
            const result = await eventLoader.loadEventsForMod(null, mockManifest);
            expect(result).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'EventLoader: Mod ID or Manifest is missing for loadEventsForMod.',
                expect.objectContaining({modId: null, modManifestProvided: true})
            );
            expect(eventLoader._loadItemsInternal).not.toHaveBeenCalled();
        });

        it('should return 0 and log error if modManifest is missing', async () => {
            const result = await eventLoader.loadEventsForMod(TEST_MOD_ID, undefined);
            expect(result).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'EventLoader: Mod ID or Manifest is missing for loadEventsForMod.',
                expect.objectContaining({modId: TEST_MOD_ID, modManifestProvided: false})
            );
            expect(eventLoader._loadItemsInternal).not.toHaveBeenCalled();
        });


        it('should log the loading info message', async () => {
            await eventLoader.loadEventsForMod(TEST_MOD_ID, mockManifest);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `EventLoader: Loading event definitions for mod '${TEST_MOD_ID}'.`
            );
        });

        it('should call _loadItemsInternal with correct parameters', async () => {
            await eventLoader.loadEventsForMod(TEST_MOD_ID, mockManifest);

            expect(eventLoader._loadItemsInternal).toHaveBeenCalledTimes(1);
            expect(eventLoader._loadItemsInternal).toHaveBeenCalledWith(
                TEST_MOD_ID,
                mockManifest,
                EVENT_CONTENT_KEY, // manifest key
                EVENT_CONTENT_DIR, // content directory
                EVENT_TYPE_NAME    // type name for registry/schema
            );
        });

        it('should return the count from _loadItemsInternal', async () => {
            const result = await eventLoader.loadEventsForMod(TEST_MOD_ID, mockManifest);
            expect(result).toBe(expectedLoadCount);
        });

        it('should handle errors from _loadItemsInternal by propagating them', async () => {
            const loadError = new Error('Internal base loading failed');
            // Ensure the mock is configured to reject
            if (typeof eventLoader._loadItemsInternal?.mockRejectedValue === 'function') {
                eventLoader._loadItemsInternal.mockRejectedValue(loadError);
            } else {
                throw new Error("Cannot configure _loadItemsInternal mock to reject");
            }


            await expect(eventLoader.loadEventsForMod(TEST_MOD_ID, mockManifest))
                .rejects.toThrow(loadError);

            // Verify initial log still happened
            expect(mockLogger.info).toHaveBeenCalledWith(
                `EventLoader: Loading event definitions for mod '${TEST_MOD_ID}'.`
            );
            // Base class handles logging the error itself during _loadItemsInternal failure
        });
    });

    // --- _processFetchedItem Tests (Core EventLoader Logic) ---
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
            // No payloadSchema field
        };

        const fullEventIdFromFile = baseEventData.id; // e.g., "core:test_event"
        const baseEventIdExtracted = 'test_event';    // e.g., "test_event"
        const finalRegistryKey = `${TEST_MOD_ID}:${baseEventIdExtracted}`; // e.g., "test-event-mod:test_event"
        const payloadSchemaId = `${fullEventIdFromFile}#payload`; // e.g., "core:test_event#payload"


        // Reset relevant mocks before each test in this block
        beforeEach(() => {
            mockConfig.getContentTypeSchemaId.mockReturnValue(EVENT_SCHEMA_ID);
            mockValidator.validate.mockReturnValue({isValid: true, errors: null});
            mockValidator.isSchemaLoaded.mockReturnValue(false); // Default: payload schema not loaded
            mockValidator.addSchema.mockResolvedValue(undefined);
            mockRegistry.get.mockReturnValue(undefined); // Default: no override
            mockRegistry.store.mockClear(); // Clear store mock specifically
            mockLogger.error.mockClear(); // Clear error logs
            mockLogger.warn.mockClear(); // Clear warn logs
            mockLogger.debug.mockClear(); // Clear debug logs

            // Ensure the real _processFetchedItem is bound if needed (redundant but safe)
            if (EventLoader.prototype._processFetchedItem) {
                eventLoader._processFetchedItem = EventLoader.prototype._processFetchedItem.bind(eventLoader);
            }
        });

        // --- Success Path ---
        it('Success Path (with payload schema): should validate, extract ID, register payload schema, store, log, and return final key', async () => {
            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // 1. Schema Validation (Main Definition)
            // Verify the *actual* base class method was called (indirectly via `this._getContentTypeSchemaId`)
            // We check this by ensuring the mockConfig method was called.
            expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith('events');
            expect(mockValidator.validate).toHaveBeenCalledTimes(1);
            expect(mockValidator.validate).toHaveBeenCalledWith(EVENT_SCHEMA_ID, fetchedData);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Schema validation passed for ${filename}`));

            // 2. ID Extraction
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullEventIdFromFile}' and base event ID '${baseEventIdExtracted}'`));

            // 3. Payload Schema Registration
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found valid payloadSchema in ${filename}`));
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(payloadSchemaId);
            expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
            expect(mockValidator.addSchema).toHaveBeenCalledWith(fetchedData.payloadSchema, payloadSchemaId);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully registered payload schema '${payloadSchemaId}'`));

            // 4. Storage (via base helper)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Delegating storage for event (base ID: '${baseEventIdExtracted}')`));
            // Check that registry.store was actually called by the *real* base helper
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            const expectedStoredData = {
                ...fetchedData,
                id: finalRegistryKey, // ID is overwritten by helper
                modId: TEST_MOD_ID,
                _sourceFile: filename,
            };
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalRegistryKey, expectedStoredData);
            // Check the success log *from the real base helper*
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully stored ${EVENT_TYPE_NAME} item '${finalRegistryKey}'`));


            // 5. Return Value
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully processed event definition from ${filename}. Returning final registry key: ${finalRegistryKey}`));
            expect(resultKey).toEqual(finalRegistryKey);

            // 6. No Errors/Warnings
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('Success Path (no payload schema): should validate, extract ID, skip payload schema registration, store, log, and return final key', async () => {
            const fetchedData = JSON.parse(JSON.stringify(eventDataNoPayload));
            const simpleFullId = eventDataNoPayload.id; // e.g., "mod:simple_event"
            const simpleBaseId = 'simple_event';
            const simpleFinalKey = `${TEST_MOD_ID}:${simpleBaseId}`;

            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // 1. Schema Validation
            expect(mockValidator.validate).toHaveBeenCalledWith(EVENT_SCHEMA_ID, fetchedData);

            // 2. ID Extraction
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${simpleFullId}' and base event ID '${simpleBaseId}'`));

            // 3. Payload Schema Registration (Skipped)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found in ${filename} for event '${simpleFullId}'. Skipping`));
            expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalled();
            expect(mockValidator.addSchema).not.toHaveBeenCalled();

            // 4. Storage (via base helper)
            // Check that registry.store was actually called by the *real* base helper
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            const expectedStoredData = {
                ...fetchedData,
                id: simpleFinalKey,
                modId: TEST_MOD_ID,
                _sourceFile: filename,
            };
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, simpleFinalKey, expectedStoredData);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully stored ${EVENT_TYPE_NAME} item '${simpleFinalKey}'`));

            // 5. Return Value
            expect(resultKey).toEqual(simpleFinalKey);

            // 6. No Errors/Warnings
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });


        // --- Failure Scenarios ---

        it('Failure: Event schema ID not configured', async () => {
            // Use the override mechanism in the factory for this specific case
            mockConfig = createMockConfiguration({getContentTypeSchemaId: () => null});
            // Re-assign the modified mock to the instance
            eventLoader._config = mockConfig;

            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Configuration Error: Event definition schema ID ('events') not configured.`);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Cannot validate ${filename} - Event schema ID ('events') is not configured.`,
                expect.objectContaining({modId: TEST_MOD_ID, filename, resolvedPath})
            );
            expect(mockValidator.validate).not.toHaveBeenCalled();
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('Failure: Schema validation fails', async () => {
            const validationErrors = [{instancePath: "/id", message: "must be type string"}];
            mockValidator.validate.mockReturnValue({isValid: false, errors: validationErrors});
            const fetchedData = {invalid_structure: true}; // Data that would fail validation

            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Schema validation failed for event definition '${filename}' in mod '${TEST_MOD_ID}'.`);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Schema validation failed for event definition '${filename}'.`,
                expect.objectContaining({
                    modId: TEST_MOD_ID,
                    filename,
                    resolvedPath,
                    schemaId: EVENT_SCHEMA_ID,
                    validationErrors
                })
            );
            expect(mockLogger.error).toHaveBeenCalledWith(`Validation Errors:\n${JSON.stringify(validationErrors, null, 2)}`);
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('Failure: Missing `id` field in data', async () => {
            const fetchedData = {description: 'Event without ID'}; // No 'id' field

            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Invalid or missing 'id' in event definition file '${filename}' for mod '${TEST_MOD_ID}'.`);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Invalid or missing 'id' in event definition file '${filename}'. ID must be a non-empty string.`,
                expect.objectContaining({modId: TEST_MOD_ID, filename, resolvedPath, receivedId: undefined})
            );
            // Validation still happens before ID check
            expect(mockValidator.validate).toHaveBeenCalledWith(EVENT_SCHEMA_ID, fetchedData);
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('Failure: Invalid `id` field type (not string)', async () => {
            const fetchedData = {id: 123, description: 'Numeric ID'};

            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Invalid or missing 'id' in event definition file '${filename}' for mod '${TEST_MOD_ID}'.`);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Invalid or missing 'id' in event definition file '${filename}'`),
                expect.objectContaining({receivedId: 123})
            );
            expect(mockValidator.validate).toHaveBeenCalled(); // Validation still called
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('Failure: Cannot extract base ID (e.g., only colon)', async () => {
            const fetchedData = {id: ':', description: 'Just a colon'};

            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Could not extract valid base event ID from ':' in ${filename}`);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Could not extract valid base event ID from full ID ':' in file '${filename}'.`,
                expect.objectContaining({modId: TEST_MOD_ID, filename, fullEventIdFromFile: ':'})
            );
            expect(mockValidator.validate).toHaveBeenCalled(); // Validation still called
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });


        it('Failure: Payload schema registration fails', async () => {
            const addSchemaError = new Error('Failed to add schema to validator');
            mockValidator.addSchema.mockRejectedValue(addSchemaError);
            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`CRITICAL: Failed to register payload schema '${payloadSchemaId}' for event '${fullEventIdFromFile}'.`);

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
            expect(mockRegistry.store).not.toHaveBeenCalled(); // Should fail before storing
        });


        it('Warning: Payload schema already loaded', async () => {
            mockValidator.isSchemaLoaded.mockReturnValue(true); // Simulate already loaded
            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            // Should still succeed overall
            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(resultKey).toEqual(finalRegistryKey);

            // Verify warning was logged
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Payload schema ID '${payloadSchemaId}' for event '${fullEventIdFromFile}' in file '${filename}' was already loaded. Overwriting or duplicate definition detected.`
            );
            // Verify addSchema was NOT called again
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            // Verify storage still happened (via the base class method calling registry.store)
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('Failure: Storage fails (error from registry.store)', async () => {
            const storeError = new Error('Registry write failed');
            // Mock the actual registry store method to throw
            mockRegistry.store.mockImplementation(() => {
                throw storeError;
            });

            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            // The error should propagate up through the *real* _storeItemInRegistry
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(storeError);

            // Verify the steps before storage were completed
            expect(mockValidator.validate).toHaveBeenCalled();
            expect(mockValidator.addSchema).toHaveBeenCalled(); // Assume payload schema registration succeeded

            // Verify the store method was called (and threw)
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalRegistryKey, expect.any(Object));


            // Verify the error log (which should be logged by the *real* base _storeItemInRegistry)
            const loaderClassName = eventLoader.constructor.name; // Get class name dynamically
            expect(mockLogger.error).toHaveBeenCalledWith(
                `${loaderClassName} [${TEST_MOD_ID}]: Failed to store ${EVENT_TYPE_NAME} item with key '${finalRegistryKey}' from file '${filename}' in data registry.`,
                expect.objectContaining({
                    modId: TEST_MOD_ID,
                    category: EVENT_TYPE_NAME,
                    baseItemId: baseEventIdExtracted,
                    finalRegistryKey: finalRegistryKey,
                    sourceFilename: filename,
                    error: storeError.message
                }),
                storeError // Log the original error object too
            );

            // Verify the final "Successfully processed" log was NOT called
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully processed event definition'));
        });

        // --- Edge Cases ---
        it('Edge Case: Event ID without namespace', async () => {
            const fetchedData = {
                id: 'simple_event_no_ns',
                description: 'Event without namespace prefix'
            };
            const fullId = fetchedData.id;
            const baseId = fetchedData.id; // Base ID is the same as full ID
            const finalKey = `${TEST_MOD_ID}:${baseId}`;

            const resultKey = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            expect(resultKey).toEqual(finalKey);
            // Verify correct IDs logged
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullId}' and base event ID '${baseId}'`));
            // Verify storage helper called with correct base ID (indirectly check via registry.store)
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalKey, expect.objectContaining({
                id: finalKey,
                modId: TEST_MOD_ID
            }));
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

            expect(resultKey).toEqual(finalKey);
            // Verify correct IDs logged
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullId}' and base event ID '${baseId}'`));
            // Verify storage helper called with correct base ID (indirectly check via registry.store)
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalKey, expect.objectContaining({
                id: finalKey,
                modId: TEST_MOD_ID
            }));
        });

        it('Edge Case: Empty but valid payloadSchema object', async () => {
            const fetchedData = {
                id: 'core:empty_payload_event',
                description: 'Event with empty payload schema object',
                payloadSchema: {} // Empty object
            };
            const fullId = fetchedData.id;

            await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // Should skip registration
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found in ${filename} for event '${fullId}'. Skipping`));
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            // Should still store the main event definition
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        });

        it('Edge Case: Null payloadSchema', async () => {
            const fetchedData = {
                id: 'core:null_payload_event',
                description: 'Event with null payload schema',
                payloadSchema: null
            };
            const fullId = fetchedData.id;

            await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);

            // Should skip registration
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found in ${filename} for event '${fullId}'. Skipping`));
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            // Should still store the main event definition
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        });
    });
});