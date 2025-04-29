// Filename: src/tests/core/loaders/baseManifestItemLoader.loadItemsForMod.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {BaseManifestItemLoader} from '../../../core/loaders/baseManifestItemLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Copied from actionLoader.test.js) ---

const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    getContentTypeSchemaId: jest.fn((typeName) => `http://example.com/schemas/${typeName}.schema.json`),
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
    fetch: jest.fn().mockResolvedValue({}), // Default mock fetch
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
    async _processFetchedItem(modId, filename, resolvedPath, fetchedData, typeName) {
        // Not used in loadItemsForMod tests
        return `${modId}:${fetchedData?.id || 'dummyId'}`; // Return a plausible qualified ID
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
            [TEST_CONTENT_KEY]: ['item1.json']
        }
    };
    const EXPECTED_LOAD_COUNT = 5; // Arbitrary number for testing return value

    beforeEach(() => {
        // Create fresh mocks for each test
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // --- CORRECTED INSTANTIATION ---
        // Instantiate the test loader with contentType as the first argument
        testLoader = new TestableLoader(
            TEST_TYPE_NAME, // <-- Pass the contentType string
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger      // <-- Pass the logger
        );
        // --- END CORRECTION ---

        // --- Spy on the protected _loadItemsInternal method ON THE INSTANCE ---
        // This allows us to check if loadItemsForMod calls it correctly and control its behavior.
        // We default it to resolving with a specific count.
        loadItemsInternalSpy = jest.spyOn(testLoader, '_loadItemsInternal')
            .mockResolvedValue(EXPECTED_LOAD_COUNT);

        // Clear mocks *after* instantiation and spying to isolate test calls
        // Important: Clear mocks associated with dependencies, not the spy itself here.
        // Use mockClear() for Jest mock functions
        Object.values(mockConfig).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockResolver).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockFetcher).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockValidator).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockRegistry).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
        Object.values(mockLogger).forEach(fn => typeof fn === 'function' && fn.mockClear?.());

    });

    // --- Input Validation Tests ---
    describe('Input Validation', () => {
        // ***** CORRECTED TESTS for modId/modManifest: Expect ERROR log and return 0 *****
        it('should return 0 and log ERROR if modId is invalid', async () => {
            const invalidModIds = [null, undefined, ''];
            for (const invalidId of invalidModIds) {
                mockLogger.error.mockClear(); // Check error logger NOW
                loadItemsInternalSpy.mockClear();

                // Expect promise to resolve to 0
                await expect(testLoader.loadItemsForMod(
                    invalidId, MOCK_MANIFEST, TEST_CONTENT_KEY, TEST_CONTENT_DIR, TEST_TYPE_NAME
                )).resolves.toBe(0); // Check resolves to 0

                // Check the ERROR log with the message from the implementation
                expect(mockLogger.error).toHaveBeenCalledWith(
                    // Use the exact message format from the implementation
                    `TestableLoader: Invalid 'modId' provided for loading ${TEST_TYPE_NAME}. Must be a non-empty string. Received: ${invalidId}`
                );
                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).not.toHaveBeenCalled(); // No warn log expected
                expect(loadItemsInternalSpy).not.toHaveBeenCalled(); // Internal method should not be called
            }
        });

        it('should return 0 and log ERROR if modManifest is invalid', async () => {
            const invalidManifests = [null, undefined, 'not-an-object', 123];
            for (const invalidManifest of invalidManifests) {
                mockLogger.error.mockClear(); // Check error logger NOW
                loadItemsInternalSpy.mockClear();

                // Expect promise to resolve to 0
                await expect(testLoader.loadItemsForMod(
                    TEST_MOD_ID, invalidManifest, TEST_CONTENT_KEY, TEST_CONTENT_DIR, TEST_TYPE_NAME
                )).resolves.toBe(0); // Check resolves to 0

                // Check the ERROR log with the message from the implementation
                expect(mockLogger.error).toHaveBeenCalledWith(
                    // Use the exact message format from the implementation
                    `TestableLoader: Invalid 'modManifest' provided for loading ${TEST_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-null object. Received: ${typeof invalidManifest}`
                );
                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).not.toHaveBeenCalled(); // No warn log expected
                expect(loadItemsInternalSpy).not.toHaveBeenCalled();
            }
        });
        // ***** END CORRECTED TESTS *****


        // ***** KEPT TESTS for contentKey/contentTypeDir/typeName: Expect TypeError *****
        it('should throw TypeError and log error if contentKey is invalid', async () => {
            const invalidKeys = [null, undefined, ''];
            for (const invalidKey of invalidKeys) {
                mockLogger.error.mockClear(); // Use error logger
                loadItemsInternalSpy.mockClear();

                // Use expect(...).rejects.toThrow(TypeError)
                await expect(testLoader.loadItemsForMod(
                    TEST_MOD_ID, MOCK_MANIFEST, invalidKey, TEST_CONTENT_DIR, TEST_TYPE_NAME
                )).rejects.toThrow(TypeError); // Check for TypeError

                // Check the specific error message based on the failure log / implementation
                expect(mockLogger.error).toHaveBeenCalledWith(
                    // Exact message from implementation
                    `TestableLoader: Programming Error - Invalid 'contentKey' provided for loading ${TEST_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidKey}`
                );
                expect(mockLogger.error).toHaveBeenCalledTimes(1); // Ensure only one error log
                expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning log expected

                expect(loadItemsInternalSpy).not.toHaveBeenCalled();
            }
        });

        it('should throw TypeError and log error if contentTypeDir is invalid', async () => {
            const invalidDirs = [null, undefined, ''];
            for (const invalidDir of invalidDirs) {
                mockLogger.error.mockClear(); // Use error logger
                loadItemsInternalSpy.mockClear();

                // Use expect(...).rejects.toThrow(TypeError)
                await expect(testLoader.loadItemsForMod(
                    TEST_MOD_ID, MOCK_MANIFEST, TEST_CONTENT_KEY, invalidDir, TEST_TYPE_NAME
                )).rejects.toThrow(TypeError); // Check for TypeError

                // Check the specific error message based on the failure log / implementation
                expect(mockLogger.error).toHaveBeenCalledWith(
                    // Exact message from implementation
                    `TestableLoader: Programming Error - Invalid 'contentTypeDir' provided for loading ${TEST_TYPE_NAME} for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidDir}`
                );
                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning log expected

                expect(loadItemsInternalSpy).not.toHaveBeenCalled();
            }
        });

        it('should throw TypeError and log error if typeName is invalid', async () => {
            const invalidTypeNames = [null, undefined, ''];
            for (const invalidTypeName of invalidTypeNames) {
                mockLogger.error.mockClear(); // Use error logger
                loadItemsInternalSpy.mockClear();

                // Use expect(...).rejects.toThrow(TypeError)
                await expect(testLoader.loadItemsForMod(
                    TEST_MOD_ID, MOCK_MANIFEST, TEST_CONTENT_KEY, TEST_CONTENT_DIR, invalidTypeName
                )).rejects.toThrow(TypeError); // Check for TypeError

                // Check the specific error message based on the failure log / implementation
                expect(mockLogger.error).toHaveBeenCalledWith(
                    // Exact message from implementation
                    `TestableLoader: Programming Error - Invalid 'typeName' provided for loading content for mod '${TEST_MOD_ID}'. Must be a non-empty string. Received: ${invalidTypeName}`
                );
                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning log expected

                expect(loadItemsInternalSpy).not.toHaveBeenCalled();
            }
        });
        // ***** END KEPT TESTS *****
    });


    // --- Logging Test ---
    it('should log the informational loading message with correct class name and typeName', async () => {
        await testLoader.loadItemsForMod(
            TEST_MOD_ID, MOCK_MANIFEST, TEST_CONTENT_KEY, TEST_CONTENT_DIR, TEST_TYPE_NAME
        );

        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
            // Note: The class name comes from the instance (TestableLoader)
            `TestableLoader: Loading ${TEST_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings for valid input
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors for valid input
    });

    // --- Internal Call Test ---
    it('should call _loadItemsInternal with the exact parameters passed to it', async () => {
        await testLoader.loadItemsForMod(
            TEST_MOD_ID, MOCK_MANIFEST, TEST_CONTENT_KEY, TEST_CONTENT_DIR, TEST_TYPE_NAME
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

    // --- Return Value Test ---
    it('should return the numerical value returned by _loadItemsInternal', async () => {
        // Spy is already configured in beforeEach to return EXPECTED_LOAD_COUNT
        const result = await testLoader.loadItemsForMod(
            TEST_MOD_ID, MOCK_MANIFEST, TEST_CONTENT_KEY, TEST_CONTENT_DIR, TEST_TYPE_NAME
        );

        expect(result).toBe(EXPECTED_LOAD_COUNT);
    });

    // --- Error Handling Test ---
    it('should propagate errors thrown by _loadItemsInternal', async () => {
        const internalError = new Error("Internal processing failed!");
        loadItemsInternalSpy.mockRejectedValue(internalError); // Configure spy to throw

        await expect(testLoader.loadItemsForMod(
            TEST_MOD_ID, MOCK_MANIFEST, TEST_CONTENT_KEY, TEST_CONTENT_DIR, TEST_TYPE_NAME
        )).rejects.toThrow(internalError); // Expect the *same* error to be re-thrown

        // Verify the initial info log still happened before the error
        expect(mockLogger.info).toHaveBeenCalledWith(
            `TestableLoader: Loading ${TEST_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
        );
        // We don't expect loadItemsForMod itself to log the error, it just propagates it.
        // Error logging typically happens higher up or within the called method (_loadItemsInternal or _processFileWrapper)
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return 0 if _loadItemsInternal returns 0', async () => {
        loadItemsInternalSpy.mockResolvedValue(0); // Configure spy to return 0
        const result = await testLoader.loadItemsForMod(
            TEST_MOD_ID, MOCK_MANIFEST, TEST_CONTENT_KEY, TEST_CONTENT_DIR, TEST_TYPE_NAME
        );

        expect(result).toBe(0);
        expect(loadItemsInternalSpy).toHaveBeenCalledTimes(1); // Still called
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Still logs info message
    });
});