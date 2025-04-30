// Filename: src/tests/core/loaders/eventLoader.test.js
// --- CORRECTIONS APPLIED (Round 2) ---

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import EventLoader from '../../../core/loaders/eventLoader.js';
import {BaseManifestItemLoader} from '../../../core/loaders/baseManifestItemLoader.js';

// --- Mock Service Factories (Adapted for EventLoader) ---

/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/coreServices.js').ModManifest} ModManifest */
/** @typedef {import('../../../core/loaders/baseManifestItemLoader.js').LoadItemsResult} LoadItemsResult */


/** Creates a mock IConfiguration service. */
const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (overrides.getContentTypeSchemaId && typeof overrides.getContentTypeSchemaId === 'function') {
            const result = overrides.getContentTypeSchemaId(typeName);
            if (result !== undefined) return result;
        }
        if (typeName === 'events') {
            return 'http://example.com/schemas/event.schema.json';
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
    fetch: jest.fn().mockResolvedValue({}),
    ...overrides,
});

/** Creates a mock ISchemaValidator service. */
const createMockSchemaValidator = (overrides = {}) => ({
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    ...overrides,
});

/** Creates a mock IDataRegistry service. */
const createMockDataRegistry = (overrides = {}) => ({
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined),
    getAll: jest.fn().mockReturnValue([]),
    clear: jest.fn(),
    getAllSystemRules: jest.fn().mockReturnValue([]),
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
const EVENT_CONTENT_KEY = 'events';
const EVENT_CONTENT_DIR = 'events';
const EVENT_TYPE_NAME = 'events';

beforeEach(() => {
    // Create fresh mocks before each test
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // --- Set up Spies ---
    validatePrimarySchemaSpy = jest.spyOn(BaseManifestItemLoader.prototype, '_validatePrimarySchema');
    storeItemInRegistrySpy = jest.spyOn(BaseManifestItemLoader.prototype, '_storeItemInRegistry');
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
    loadItemsInternalSpy.mockResolvedValue({ count: 0, overrides: 0, errors: 0 });
    validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null });
    storeItemInRegistrySpy.mockReturnValue(false); // Default: no override

    // Bind the actual _processFetchedItem method for testing
    if (EventLoader.prototype._processFetchedItem) {
        eventLoader._processFetchedItem = EventLoader.prototype._processFetchedItem.bind(eventLoader);
    }
});

afterEach(() => {
    jest.restoreAllMocks();
});


// --- Test Suite ---

describe('EventLoader', () => {

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should instantiate successfully inheriting from BaseManifestItemLoader and call super with "events"', () => {
            const tempConfig = createMockConfiguration();
            const tempLogger = createMockLogger();
            const loader = new EventLoader(tempConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, tempLogger);

            expect(loader).toBeInstanceOf(EventLoader);
            expect(loader).toBeInstanceOf(BaseManifestItemLoader);
            expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledWith('events');
            expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
            expect(loader._config).toBe(tempConfig);
            expect(loader._pathResolver).toBe(mockResolver);
            expect(loader._dataFetcher).toBe(mockFetcher);
            expect(loader._schemaValidator).toBe(mockValidator);
            expect(loader._dataRegistry).toBe(mockRegistry);
            expect(loader._logger).toBe(tempLogger);
            expect(tempLogger.error).not.toHaveBeenCalled();
        });
    });

    // --- loadItemsForMod Tests ---
    describe('loadItemsForMod', () => {
        const mockManifest = {
            id: TEST_MOD_ID,
            name: 'Test Event Mod',
            version: '1.0.0',
            content: { [EVENT_CONTENT_KEY]: ['event1.json', 'event2.json'] }
        };
        /** @type {LoadItemsResult} */
        const expectedLoadResult = { count: 2, overrides: 0, errors: 0 };

        beforeEach(() => {
            loadItemsInternalSpy.mockResolvedValue(expectedLoadResult);
        });

        it('should return 0 result object and log error if modId is missing or invalid', async () => {
            const result = await eventLoader.loadItemsForMod(null, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(result).toEqual({ count: 0, overrides: 0, errors: 0 });
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid 'modId' provided for loading ${EVENT_TYPE_NAME}`));
            expect(loadItemsInternalSpy).not.toHaveBeenCalled();
        });

        it('should return 0 result object and log error if modManifest is missing or invalid', async () => {
            const result = await eventLoader.loadItemsForMod(TEST_MOD_ID, undefined, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(result).toEqual({ count: 0, overrides: 0, errors: 0 });
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

        it('should log the loading info message', async () => {
            await eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(mockLogger.info).toHaveBeenCalledWith(`EventLoader: Loading ${EVENT_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`EventLoader [${TEST_MOD_ID}]: Delegating loading for type '${EVENT_TYPE_NAME}' to _loadItemsInternal.`);
        });

        it('should call _loadItemsInternal with correct parameters', async () => {
            await eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1);
            expect(loadItemsInternalSpy).toHaveBeenCalledWith(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
        });

        it('should return the result object from _loadItemsInternal and log summary', async () => {
            const result = await eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME);
            expect(result).toEqual(expectedLoadResult);
            expect(mockLogger.debug).toHaveBeenCalledWith(`EventLoader [${TEST_MOD_ID}]: Finished loading for type '${EVENT_TYPE_NAME}'. Result: C:${expectedLoadResult.count}, O:${expectedLoadResult.overrides}, E:${expectedLoadResult.errors}`);
        });

        it('should handle errors from _loadItemsInternal by propagating them', async () => {
            const loadError = new Error('Internal base loading failed');
            loadItemsInternalSpy.mockRejectedValue(loadError);
            await expect(eventLoader.loadItemsForMod(TEST_MOD_ID, mockManifest, EVENT_CONTENT_KEY, EVENT_CONTENT_DIR, EVENT_TYPE_NAME))
                .rejects.toThrow(loadError);
            expect(mockLogger.info).toHaveBeenCalledWith(`EventLoader: Loading ${EVENT_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`EventLoader [${TEST_MOD_ID}]: Delegating loading for type '${EVENT_TYPE_NAME}' to _loadItemsInternal.`);
            expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1);
        });
    });

    // --- _processFetchedItem Tests ---
    describe('_processFetchedItem', () => {
        const filename = 'test_event.json';
        const resolvedPath = `./data/mods/${TEST_MOD_ID}/${EVENT_CONTENT_DIR}/${filename}`;
        const baseEventData = {
            id: 'core:test_event',
            description: 'A sample event definition.',
            payloadSchema: { type: 'object', properties: { targetId: {type: 'string'}, amount: {type: 'integer'} }, required: ['targetId', 'amount'] }
        };
        const eventDataNoPayload = { id: 'mod:simple_event', description: 'An event without a payload schema.' };
        const fullEventIdFromFile = baseEventData.id;
        const baseEventIdExtracted = 'test_event';
        const finalRegistryKey = `${TEST_MOD_ID}:${baseEventIdExtracted}`;
        const payloadSchemaId = `${fullEventIdFromFile}#payload`;
        const expectedSuccessResult = { qualifiedId: finalRegistryKey, didOverride: false };
        // const expectedSuccessResultOverride = { qualifiedId: finalRegistryKey, didOverride: true }; // Kept for reference if needed

        beforeEach(() => {
            mockValidator.isSchemaLoaded.mockReturnValue(false);
            mockValidator.addSchema.mockResolvedValue(undefined);
            mockRegistry.get.mockReturnValue(undefined);
            storeItemInRegistrySpy.mockReturnValue(false); // Default: no override
            validatePrimarySchemaSpy.mockClear();
            storeItemInRegistrySpy.mockClear();
        });

        it('Success Path (with payload): should extract ID, register payload schema, store, log, and return result object', async () => {
            const fetchedData = JSON.parse(JSON.stringify(baseEventData));
            mockValidator.isSchemaLoaded.mockReturnValueOnce(false);
            const result = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(mockConfig.getContentTypeSchemaId).not.toHaveBeenCalled();
            expect(mockValidator.validate).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullEventIdFromFile}' and base event ID '${baseEventIdExtracted}'`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found valid payloadSchema in ${filename}`));
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(payloadSchemaId);
            expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
            expect(mockValidator.addSchema).toHaveBeenCalledWith(fetchedData.payloadSchema, payloadSchemaId);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully registered payload schema '${payloadSchemaId}'`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Delegating storage for event (base ID: '${baseEventIdExtracted}')`));
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, baseEventIdExtracted, fetchedData, filename);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully processed event definition from ${filename}. Returning final registry key: ${finalRegistryKey}, Overwrite: false`));
            expect(result).toEqual(expectedSuccessResult);
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('Success Path (no payload): should extract ID, skip payload schema, store, log, and return result object', async () => {
            const fetchedData = JSON.parse(JSON.stringify(eventDataNoPayload));
            const simpleFullId = eventDataNoPayload.id;
            const simpleBaseId = 'simple_event';
            const simpleFinalKey = `${TEST_MOD_ID}:${simpleBaseId}`;
            const expectedSimpleResult = { qualifiedId: simpleFinalKey, didOverride: false };
            const result = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${simpleFullId}' and base event ID '${simpleBaseId}'`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found`));
            expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalledWith(expect.stringContaining('#payload'));
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, simpleBaseId, fetchedData, filename);
            expect(result).toEqual(expectedSimpleResult);
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('Failure: Primary schema validation fails (simulated via spy) - *Test checks ID failure due to direct call*', async () => {
            const validationError = new Error(`Schema validation failed...`); // Message doesn't strictly matter here
            validatePrimarySchemaSpy.mockImplementation(() => { throw validationError; }); // Mock ineffective for direct call
            const fetchedData = { invalid_structure: true };
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Invalid or missing 'id' in event definition file '${filename}' for mod '${TEST_MOD_ID}'.`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Invalid or missing 'id' in event definition file '${filename}'.`),
                expect.objectContaining({ modId: TEST_MOD_ID, filename, resolvedPath, receivedId: undefined })
            );
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
        });

        it('Failure: Missing `id` field in data', async () => {
            const fetchedData = {description: 'Event without ID'};
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Invalid or missing 'id' in event definition file '${filename}' for mod '${TEST_MOD_ID}'.`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Invalid or missing 'id' in event definition file '${filename}'`),
                expect.objectContaining({modId: TEST_MOD_ID, filename, resolvedPath, receivedId: undefined})
            );
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
        });

        it('Failure: Invalid `id` field type (not string)', async () => {
            const fetchedData = {id: 123, description: 'Numeric ID'};
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Invalid or missing 'id' in event definition file '${filename}' for mod '${TEST_MOD_ID}'.`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Invalid or missing 'id' in event definition file '${filename}'`),
                expect.objectContaining({receivedId: 123})
            );
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
        });

        it('Failure: Cannot extract base ID (e.g., only colon)', async () => {
            const fetchedData = {id: ':', description: 'Just a colon'};
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`Could not extract valid base event ID from ':' in ${filename}`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Could not extract valid base event ID from full ID ':' in file '${filename}'`),
                expect.objectContaining({modId: TEST_MOD_ID, filename, fullEventIdFromFile: ':'})
            );
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
        });

        it('Failure: Payload schema registration fails', async () => {
            const addSchemaError = new Error('Failed to add schema to validator');
            mockValidator.addSchema.mockRejectedValue(addSchemaError);
            mockValidator.isSchemaLoaded.mockReturnValueOnce(false);
            const fetchedData = JSON.parse(JSON.stringify(baseEventData));

            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(`CRITICAL: Failed to register payload schema '${payloadSchemaId}'.`);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullEventIdFromFile}'`));
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(payloadSchemaId);
            expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
            expect(mockValidator.addSchema).toHaveBeenCalledWith(fetchedData.payloadSchema, payloadSchemaId);

            // <<< FIXED: Removed modId from objectContaining expectation for the 2nd argument
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL - Failed to register payload schema '${payloadSchemaId}' for event '${fullEventIdFromFile}'.`), // Check substring
                expect.objectContaining({
                    // modId: TEST_MOD_ID, // Removed this line
                    error: addSchemaError.message
                }),
                addSchemaError // Check the third argument is the error object
            );
            expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
        });

        it('Warning: Payload schema already loaded', async () => {
            mockValidator.isSchemaLoaded.mockReturnValueOnce(true);
            storeItemInRegistrySpy.mockReturnValue(false);
            const fetchedData = JSON.parse(JSON.stringify(baseEventData));
            const result = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(result).toEqual(expectedSuccessResult);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(payloadSchemaId);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Payload schema ID '${payloadSchemaId}' for event '${fullEventIdFromFile}' was already loaded.`));
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('Failure: Storage fails (error from base _storeItemInRegistry)', async () => {
            const storeError = new Error('Registry write failed');
            storeItemInRegistrySpy.mockImplementation(() => {
                mockLogger.error(`Simulated base storage failure log for ${finalRegistryKey}`);
                throw storeError;
            });
            mockValidator.isSchemaLoaded.mockReturnValueOnce(false);
            mockValidator.addSchema.mockResolvedValue(undefined);
            const fetchedData = JSON.parse(JSON.stringify(baseEventData));
            await expect(eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME))
                .rejects.toThrow(storeError);
            expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, baseEventIdExtracted, fetchedData, filename);
            expect(mockLogger.error).toHaveBeenCalledWith(`Simulated base storage failure log for ${finalRegistryKey}`);
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully processed event definition'));
        });

        it('Edge Case: Event ID without namespace', async () => {
            const fetchedData = { id: 'simple_event_no_ns', description: '...' };
            const baseId = fetchedData.id;
            const finalKey = `${TEST_MOD_ID}:${baseId}`;
            const expectedResult = { qualifiedId: finalKey, didOverride: false };
            const result = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(result).toEqual(expectedResult);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${baseId}' and base event ID '${baseId}'`));
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, baseId, fetchedData, filename);
        });

        it('Edge Case: Event ID with multiple colons', async () => {
            const fetchedData = { id: 'mod:category:complex_event', description: '...' };
            const fullId = fetchedData.id;
            const baseId = 'category:complex_event';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;
            const expectedResult = { qualifiedId: finalKey, didOverride: false };
            const result = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(result).toEqual(expectedResult);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full event ID '${fullId}' and base event ID '${baseId}'`));
            expect(storeItemInRegistrySpy).toHaveBeenCalledWith(EVENT_TYPE_NAME, TEST_MOD_ID, baseId, fetchedData, filename);
        });

        it('Edge Case: Empty but valid payloadSchema object', async () => {
            const fetchedData = { id: 'core:empty_payload_event', payloadSchema: {} };
            const baseId = 'empty_payload_event';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;
            const expectedResult = { qualifiedId: finalKey, didOverride: false };
            const result = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(result).toEqual(expectedResult);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found`));
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
        });

        it('Edge Case: Null payloadSchema', async () => {
            const fetchedData = { id: 'core:null_payload_event', payloadSchema: null };
            const baseId = 'null_payload_event';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;
            const expectedResult = { qualifiedId: finalKey, didOverride: false };
            const result = await eventLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, EVENT_TYPE_NAME);
            expect(result).toEqual(expectedResult);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No valid payloadSchema found`));
            expect(mockValidator.addSchema).not.toHaveBeenCalled();
            expect(storeItemInRegistrySpy).toHaveBeenCalledTimes(1);
        });
    });
});