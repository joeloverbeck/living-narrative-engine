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
    // For loadItemsForMod, we spy on _loadItemsInternal.
    // For _processFetchedItem, we DON'T spy on _getContentTypeSchemaId or _storeItemInRegistry
    // because we want the actual base implementations to run (they use the injected mocks).
    // We only set the spy here, the mock implementation is set in relevant describe blocks.
    jest.spyOn(BaseManifestItemLoader.prototype, '_loadItemsInternal');

    // Bind the actual _processFetchedItem method for testing (Specific to EventLoader)
    if (EventLoader.prototype._processFetchedItem) {
        eventLoader._processFetchedItem = EventLoader.prototype._processFetchedItem.bind(eventLoader);
    }

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
            expect(loader._config).toBe(tempConfig);
            expect(loader._pathResolver).toBe(mockResolver);
            expect(loader._dataFetcher).toBe(mockFetcher);
            expect(loader._schemaValidator).toBe(mockValidator);
            expect(loader._dataRegistry).toBe(mockRegistry);
            expect(loader._logger).toBe(tempLogger);
            expect(tempLogger.error).not.toHaveBeenCalled();
        });

        it('should log initialization message', () => {
            new EventLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith('EventLoader: Initialized.');
        });
    });

    // --- loadItemsForMod Tests ---
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
        let internalLoadSpy; // To hold the spy instance

        beforeEach(() => {
            // Reset the spy and its mock implementation before each test in this block
            internalLoadSpy = jest.spyOn(BaseManifestItemLoader.prototype, '_loadItemsInternal');
            internalLoadSpy.mockResolvedValue(expectedLoadCount); // Default mock behavior
        });

        it('should return 0 and log error if modId is missing or invalid', async () => {
            // *** Use loadItemsForMod with all arguments ***
            const result = await eventLoader.loadItemsForMod(
                null, // Invalid modId
                mockManifest,
                EVENT_CONTENT_KEY,
                EVENT_CONTENT_DIR,
                EVENT_TYPE_NAME
            );
            expect(result).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                // *** Updated expected log message based on base class validation ***
                `EventLoader: Invalid 'modId' provided for loading ${EVENT_TYPE_NAME}. Must be a non-empty string. Received: null`
            );
            // Verify the internal method was not called due to validation failure
            expect(internalLoadSpy).not.toHaveBeenCalled();
        });

        it('should return 0 and log error if modManifest is missing or invalid', async () => {
            // *** Use loadItemsForMod with all arguments ***
            const result = await eventLoader.loadItemsForMod(
                TEST_MOD_ID,
                undefined, // Invalid manifest
                EVENT_CONTENT_KEY,
                EVENT_CONTENT_DIR,
                EVENT_TYPE_NAME
            );
            expect(result).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                // *** Updated expected log message based on base class validation ***
                `EventLoader: Invalid 'modManifest' provided for loading ${EVENT_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-null object. Received: undefined`
            );
            // Verify the internal method was not called due to validation failure
            expect(internalLoadSpy).not.toHaveBeenCalled();
        });

        it('should throw TypeError and log error if contentKey is invalid', async () => {
            const invalidKey = '';
            const expectedErrorMsg = `${eventLoader.constructor.name}: Programming Error - Invalid 'contentKey' provided for loading ${EVENT_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidKey}`;

            await expect(eventLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                invalidKey, // Invalid contentKey
                EVENT_CONTENT_DIR,
                EVENT_TYPE_NAME
            )).rejects.toThrow(new TypeError(expectedErrorMsg));

            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            // Verify the internal method was not called due to validation failure
            expect(internalLoadSpy).not.toHaveBeenCalled();
        });

        it('should throw TypeError and log error if contentTypeDir is invalid', async () => {
            const invalidDir = null;
            const expectedErrorMsg = `${eventLoader.constructor.name}: Programming Error - Invalid 'contentTypeDir' provided for loading ${EVENT_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidDir}`;

            await expect(eventLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                EVENT_CONTENT_KEY,
                invalidDir, // Invalid contentTypeDir
                EVENT_TYPE_NAME
            )).rejects.toThrow(new TypeError(expectedErrorMsg));

            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            // Verify the internal method was not called due to validation failure
            expect(internalLoadSpy).not.toHaveBeenCalled();
        });

        it('should throw TypeError and log error if typeName is invalid', async () => {
            const invalidTypeName = ' ';
            const expectedErrorMsg = `${eventLoader.constructor.name}: Programming Error - Invalid 'typeName' provided for loading content for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidTypeName}`;

            await expect(eventLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                EVENT_CONTENT_KEY,
                EVENT_CONTENT_DIR,
                invalidTypeName // Invalid typeName
            )).rejects.toThrow(new TypeError(expectedErrorMsg));

            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            // Verify the internal method was not called due to validation failure
            expect(internalLoadSpy).not.toHaveBeenCalled();
        });

        it('should log the loading info message', async () => {
            // *** Use loadItemsForMod with all arguments ***
            await eventLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                EVENT_CONTENT_KEY,
                EVENT_CONTENT_DIR,
                EVENT_TYPE_NAME
            );
            // This initial log comes from the public loadItemsForMod wrapper
            expect(mockLogger.info).toHaveBeenCalledWith(
                // *** Ensure message matches base class generic log ***
                `EventLoader: Loading ${EVENT_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
            );
            // Also check the debug log for delegation
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Delegating loading for type '${EVENT_TYPE_NAME}' to _loadItemsInternal.`
            );
        });

        it('should call _loadItemsInternal with correct parameters', async () => {
            // *** Use loadItemsForMod with all arguments ***
            await eventLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                EVENT_CONTENT_KEY,
                EVENT_CONTENT_DIR,
                EVENT_TYPE_NAME
            );

            // Verify the internal method was called correctly by the public wrapper
            expect(internalLoadSpy).toHaveBeenCalledTimes(1);
            expect(internalLoadSpy).toHaveBeenCalledWith(
                TEST_MOD_ID,           // Should be trimmed version, but test ID has no whitespace
                mockManifest,
                EVENT_CONTENT_KEY,     // Should be trimmed version
                EVENT_CONTENT_DIR,     // Should be trimmed version
                EVENT_TYPE_NAME        // Should be trimmed version
            );
        });

        it('should return the count from _loadItemsInternal', async () => {
            // *** Use loadItemsForMod with all arguments ***
            const result = await eventLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                EVENT_CONTENT_KEY,
                EVENT_CONTENT_DIR,
                EVENT_TYPE_NAME
            );
            // Should return the value resolved by the mocked internal method
            expect(result).toBe(expectedLoadCount);
            // Check the final debug log
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Finished loading for type '${EVENT_TYPE_NAME}'. Count: ${expectedLoadCount}`
            );
        });

        it('should handle errors from _loadItemsInternal by propagating them', async () => {
            const loadError = new Error('Internal base loading failed');
            // Configure the spy to reject *after* initial validation passes
            internalLoadSpy.mockRejectedValue(loadError);

            // *** Use loadItemsForMod with all arguments ***
            await expect(eventLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                EVENT_CONTENT_KEY,
                EVENT_CONTENT_DIR,
                EVENT_TYPE_NAME
            )).rejects.toThrow(loadError); // Should throw the error from the internal method

            // Verify initial log still happened
            expect(mockLogger.info).toHaveBeenCalledWith(
                `EventLoader: Loading ${EVENT_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
            );
            // Verify delegation log happened
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `EventLoader [${TEST_MOD_ID}]: Delegating loading for type '${EVENT_TYPE_NAME}' to _loadItemsInternal.`
            );
            // Verify internal method *was* called (and subsequently threw the error)
            expect(internalLoadSpy).toHaveBeenCalledTimes(1);
            // The summary log within _loadItemsInternal handles logging the failure count,
            // and _processFileWrapper logs the specific error, so we don't need to check logger.error here.
        });
    });

    // --- _processFetchedItem Tests (Core EventLoader Logic) ---
    // No changes needed in this section based on the errors provided.
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
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            const expectedStoredData = {
                ...fetchedData,
                id: finalRegistryKey, // ID is overwritten by helper
                modId: TEST_MOD_ID,
                _sourceFile: filename,
            };
            expect(mockRegistry.store).toHaveBeenCalledWith(EVENT_TYPE_NAME, finalRegistryKey, expectedStoredData);
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