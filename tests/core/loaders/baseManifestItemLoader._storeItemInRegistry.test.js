// Filename: src/tests/core/loaders/baseManifestItemLoader._storeItemInRegistry.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {BaseManifestItemLoader} from '../../../src/loaders/baseManifestItemLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Minimal for this test suite) ---

// Only need DataRegistry and Logger for _storeItemInRegistry tests,
// but the Base constructor needs all dependencies. We provide minimal mocks.
const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    getContentTypeSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/default.schema.json'),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getContentBasePath: jest.fn(type => `./data/${type}`),
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
    get: jest.fn().mockReturnValue(undefined), // Default: item not found
    getAll: jest.fn().mockReturnValue([]),
    clear: jest.fn(),
    // Add other methods if Base constructor validation requires them
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
    // Expose the protected method publicly for testing
    // MODIFIED: Accepts arguments expected by _storeItemInRegistry directly
    publicStoreItemInRegistry(category, modId, baseItemId, dataToStore, sourceFilename) {
        // Bind 'this' explicitly to ensure context is correct when calling protected method
        // Pass arguments directly as received
        return this._storeItemInRegistry.call(this, category, modId, baseItemId, dataToStore, sourceFilename);
    }

    // Dummy implementation for the abstract method to satisfy the base class
    async _processFetchedItem(modId, filename, resolvedPath, fetchedData, typeName) {
        // Not used in these tests, but required for instantiation
        return {id: fetchedData?.id || 'dummyId'};
    }

    // Expose the logger directly for easier checking of the class name prefix in logs
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
    let testLoader; // Instance of TestableLoader

    const TEST_MOD_ID = 'testMod';
    const TEST_CATEGORY = 'items';
    const TEST_FILENAME = 'item.json';
    const TEST_CONTENT_TYPE = 'items'; // <<< ADDED: Define a suitable content type

    beforeEach(() => {
        // Create fresh mocks for each test
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // Instantiate the test loader WITH the contentType argument
        testLoader = new TestableLoader(
            TEST_CONTENT_TYPE, // <<< FIXED: Pass the content type string first
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );

        // Clear mocks after instantiation to isolate test calls
        // Note: jest.clearAllMocks() clears all mocks, including those potentially
        // used during instantiation if the constructor called mocked methods.
        // Re-assigning might be needed if constructor logic relied heavily on specific mock states.
        jest.clearAllMocks();

        // Re-assign mocks directly to the instance variables if clearAllMocks affects them
        // This ensures the mocks used within the test methods are the fresh ones.
        testLoader._config = mockConfig;
        testLoader._pathResolver = mockResolver;
        testLoader._dataFetcher = mockFetcher;
        testLoader._schemaValidator = mockValidator;
        testLoader._dataRegistry = mockRegistry;
        testLoader._logger = mockLogger;
        // Ensure primarySchemaId is set based on the mock config for the TEST_CONTENT_TYPE
        testLoader._primarySchemaId = mockConfig.getContentTypeSchemaId(TEST_CONTENT_TYPE);

    });

    // --- REMOVED ID Extraction Tests ---
    // These tests were removed because ID extraction/validation is the responsibility
    // of the calling method (e.g., _processFetchedItem), not _storeItemInRegistry itself.
    // _storeItemInRegistry assumes a valid baseItemId is passed in.

    // --- Registry Check & Override Tests ---
    describe('Registry Check and Override Warning', () => {
        const baseItemId = 'item1';
        const data = {id: 'item1', value: 'new'}; // Original data might still have the ID
        const finalRegistryKey = `${TEST_MOD_ID}:${baseItemId}`; // Key calculation happens inside the method

        it('should NOT log a warning if registry.get returns undefined', () => {
            mockRegistry.get.mockReturnValue(undefined); // Simulate item not existing

            // Call with explicit baseItemId
            testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);

            expect(mockRegistry.get).toHaveBeenCalledWith(TEST_CATEGORY, finalRegistryKey);
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockRegistry.store).toHaveBeenCalledTimes(1); // Should still store
        });

        it('should log a warning if registry.get returns an existing item', () => {
            const existingItem = {
                id: finalRegistryKey, // Existing item would have the final key
                value: 'old',
                modId: 'anotherMod',
                _sourceFile: 'old_item.json'
            };
            mockRegistry.get.mockReturnValue(existingItem); // Simulate item exists
            const loaderClassName = testLoader.getLoggerClassName();


            // Call with explicit baseItemId
            testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);

            expect(mockRegistry.get).toHaveBeenCalledWith(TEST_CATEGORY, finalRegistryKey);
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            // Check the warning message structure (slightly adjusted based on implementation)
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`${loaderClassName} [${TEST_MOD_ID}]: Overwriting existing ${TEST_CATEGORY} definition with key '${finalRegistryKey}'.`),
                // Note: The implementation provided logs slightly different details, adjust if needed
                // For example, if it doesn't log the specific context object shown here:
                // expect.objectContaining({
                //     modId: TEST_MOD_ID,
                //     category: TEST_CATEGORY,
                //     finalRegistryKey: finalRegistryKey,
                //     sourceFilename: TEST_FILENAME,
                //     existingItemModId: existingItem.modId,
                //     existingItemSourceFile: existingItem._sourceFile,
                // })
            );
            // Check the message based on the provided implementation's log format:
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${loaderClassName} [${TEST_MOD_ID}]: Overwriting existing ${TEST_CATEGORY} definition with key '${finalRegistryKey}'. ` +
                `New Source: ${TEST_FILENAME}. Previous Source: ${existingItem._sourceFile || 'unknown'} from mod '${existingItem.modId || 'unknown'}.'`,
                // The implementation logs only the message string, not a context object for warn
            );

            expect(mockRegistry.store).toHaveBeenCalledTimes(1); // Should still store (override)
        });
    });

    // --- Data Augmentation & Storage Call Tests ---
    describe('Data Augmentation and Storage', () => {
        const baseItemId = 'item1';
        const finalRegistryKey = `${TEST_MOD_ID}:${baseItemId}`;

        it('should call registry.store exactly once (non-override case)', () => {
            const data = {value: 'data'}; // Data doesn't strictly need 'id' here for this test
            mockRegistry.get.mockReturnValue(undefined);

            testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);

            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        });

        it('should call registry.store exactly once (override case)', () => {
            const data = {value: 'data'};
            const existingItem = {id: finalRegistryKey, value: 'old'};
            mockRegistry.get.mockReturnValue(existingItem);

            testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);

            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        });

        it('should augment data with final id, modId, and _sourceFile before storing', () => {
            // Original data might or might not have an 'id', _storeItemInRegistry overwrites it
            const originalData = {description: 'Test', extra: true};
            const expectedStoredData = {
                // Original properties:
                description: originalData.description,
                extra: originalData.extra,
                // Augmented properties:
                id: finalRegistryKey, // ID is SET/OVERWRITTEN to final key
                modId: TEST_MOD_ID,
                _sourceFile: TEST_FILENAME,
            };
            mockRegistry.get.mockReturnValue(undefined); // No override

            testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, originalData, TEST_FILENAME);

            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                TEST_CATEGORY,          // Correct category
                finalRegistryKey,       // Correct key
                expect.objectContaining(expectedStoredData) // Check augmented data structure
            );
            // Ensure ALL original properties are still present AND augmented properties are correct
            const actualStoredData = mockRegistry.store.mock.calls[0][2];
            expect(actualStoredData).toHaveProperty('description', originalData.description);
            expect(actualStoredData).toHaveProperty('extra', originalData.extra);
            expect(actualStoredData).toHaveProperty('id', finalRegistryKey);
            expect(actualStoredData).toHaveProperty('modId', TEST_MOD_ID);
            expect(actualStoredData).toHaveProperty('_sourceFile', TEST_FILENAME);
        });

        it('should augment data even if original data had an "id" field', () => {
            // Test that the original ID is overwritten correctly
            const originalData = {id: 'some:otherId', description: 'Test', extra: true};
            const expectedStoredData = {
                id: finalRegistryKey, // ID is OVERWRITTEN
                description: originalData.description,
                extra: originalData.extra,
                modId: TEST_MOD_ID,
                _sourceFile: TEST_FILENAME,
            };
            mockRegistry.get.mockReturnValue(undefined);

            testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, originalData, TEST_FILENAME);

            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                TEST_CATEGORY,
                finalRegistryKey,
                expect.objectContaining(expectedStoredData)
            );
            const actualStoredData = mockRegistry.store.mock.calls[0][2];
            expect(actualStoredData.id).toBe(finalRegistryKey); // Verify specifically it was overwritten
        });


        it('should log debug message on successful storage', () => {
            const data = {value: 'stored'};
            const loaderClassName = testLoader.getLoggerClassName();


            testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);

            expect(mockRegistry.store).toHaveBeenCalledTimes(1); // Ensure store was called
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${loaderClassName} [${TEST_MOD_ID}]: Successfully stored ${TEST_CATEGORY} item '${finalRegistryKey}' from file '${TEST_FILENAME}'.`
            );
        });
    });

    // --- Storage Error Propagation Tests ---
    describe('Storage Error Handling', () => {
        const baseItemId = 'itemFail';
        const data = {value: 'error data'};
        const finalRegistryKey = `${TEST_MOD_ID}:${baseItemId}`;
        const storageError = new Error('Database connection lost');

        beforeEach(() => {
            // Configure store to throw an error for tests in this block
            mockRegistry.store.mockImplementation(() => {
                throw storageError;
            });
            mockRegistry.get.mockReturnValue(undefined); // Ensure no override warning complicates things
        });

        it('should catch errors thrown by registry.store', () => {
            // Use a try/catch block to verify the specific error is re-thrown
            try {
                testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);
                // If it doesn't throw, fail the test
                expect(true).toBe(false);
            } catch (e) {
                // Error was caught and re-thrown, proceed to check logs
                expect(e).toBe(storageError); // Ensure the *original* error is re-thrown
            }
        });

        it('should log an error with context when registry.store fails', () => {
            const loaderClassName = testLoader.getLoggerClassName();

            expect(() => {
                testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);
            }).toThrow(storageError); // Expect it to re-throw

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `${loaderClassName} [${TEST_MOD_ID}]: Failed to store ${TEST_CATEGORY} item with key '${finalRegistryKey}' from file '${TEST_FILENAME}' in data registry.`,
                expect.objectContaining({
                    modId: TEST_MOD_ID,
                    category: TEST_CATEGORY,
                    baseItemId: baseItemId, // Check baseItemId is logged
                    finalRegistryKey: finalRegistryKey,
                    sourceFilename: TEST_FILENAME,
                    error: storageError.message // Log the error message string
                }),
                storageError // Also log the original error object
            );
        });

        it('should re-throw the original error from registry.store', () => {
            expect(() => {
                testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);
            }).toThrow(storageError); // Verify the specific error instance is re-thrown
        });

        it('should not log the success debug message when registry.store fails', () => {
            expect(() => {
                testLoader.publicStoreItemInRegistry(TEST_CATEGORY, TEST_MOD_ID, baseItemId, data, TEST_FILENAME);
            }).toThrow(storageError); // Expect it to re-throw

            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining(`Successfully stored ${TEST_CATEGORY} item`)
            );
        });
    });
});