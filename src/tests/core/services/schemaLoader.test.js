// src/tests/core/services/schemaLoader.test.js

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import SchemaLoader from '../../../core/services/schemaLoader.js'; // Adjust path as needed

// --- Mocks Setup ---

// Mock Interface Implementations using jest.fn()
const mockConfiguration = {
    getSchemaFiles: jest.fn(),
    getManifestSchemaId: jest.fn(),
    getContentTypeSchemaId: jest.fn(), // Add other methods if SchemaLoader constructor checks them, though not used in loadAndCompileAllSchemas directly
    getBaseDataPath: jest.fn(),
    getSchemaBasePath: jest.fn(),
    getContentBasePath: jest.fn(),
    getWorldBasePath: jest.fn(),
};

const mockPathResolver = {
    resolveSchemaPath: jest.fn(), // Add other methods if needed by other parts (not needed for this test)
    resolveManifestPath: jest.fn(), resolveContentPath: jest.fn(),
};

const mockDataFetcher = {
    fetch: jest.fn(),
};

const mockSchemaValidator = {
    addSchema: jest.fn(),
    isSchemaLoaded: jest.fn(), // Add getValidator if constructor checks it (not used in loadAndCompileAllSchemas)
    getValidator: jest.fn(),
};

const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
};

// --- Test Suite ---

describe('SchemaLoader', () => {
    let schemaLoader;

    // Test Data
    const commonSchemaFile = 'common.schema.json';
    const entitySchemaFile = 'entity.schema.json';
    const manifestSchemaFile = 'manifest.schema.json'; // Added for verification tests
    const itemSchemaFile = 'items.schema.json';
    const locationSchemaFile = 'locations.schema.json';
    const connectionSchemaFile = 'connections.schema.json';
    const triggerSchemaFile = 'triggers.schema.json';

    const commonSchemaPath = `./test/schemas/${commonSchemaFile}`;
    const entitySchemaPath = `./test/schemas/${entitySchemaFile}`;
    const manifestSchemaPath = `./test/schemas/${manifestSchemaFile}`;
    const itemSchemaPath = `./test/schemas/${itemSchemaFile}`;
    const locationSchemaPath = `./test/schemas/${locationSchemaFile}`;
    const connectionSchemaPath = `./test/schemas/${connectionSchemaFile}`;
    const triggerSchemaPath = `./test/schemas/${triggerSchemaFile}`;

    const commonSchemaId = 'test://schemas/common';
    const entitySchemaId = 'test://schemas/entity';
    const manifestSchemaId = 'test://schemas/manifest';
    const itemSchemaId = 'test://schemas/items';
    const locationSchemaId = 'test://schemas/locations';
    const connectionSchemaId = 'test://schemas/connections';
    const triggerSchemaId = 'test://schemas/triggers';

    const commonSchemaData = {$id: commonSchemaId, title: 'Common Test'};
    const entitySchemaData = {$id: entitySchemaId, title: 'Entity Test'};
    const manifestSchemaData = {$id: manifestSchemaId, title: 'Manifest Test'};
    const itemSchemaData = {$id: itemSchemaId, title: 'Items Test'};
    const locationSchemaData = {$id: locationSchemaId, title: 'Locations Test'};
    const connectionSchemaData = {$id: connectionSchemaId, title: 'Connections Test'};
    const triggerSchemaData = {$id: triggerSchemaId, title: 'Triggers Test'};

    const allSchemaFiles = [commonSchemaFile, entitySchemaFile, manifestSchemaFile, itemSchemaFile, locationSchemaFile, connectionSchemaFile, triggerSchemaFile,];
    const allSchemaPaths = [commonSchemaPath, entitySchemaPath, manifestSchemaPath, itemSchemaPath, locationSchemaPath, connectionSchemaPath, triggerSchemaPath,];
    const allSchemaData = [commonSchemaData, entitySchemaData, manifestSchemaData, itemSchemaData, locationSchemaData, connectionSchemaData, triggerSchemaData,];
    const allSchemaIds = [commonSchemaId, entitySchemaId, manifestSchemaId, itemSchemaId, locationSchemaId, connectionSchemaId, triggerSchemaId,];
    const essentialSchemaIdsMap = {
        manifest: manifestSchemaId,
        entities: entitySchemaId,
        items: itemSchemaId,
        locations: locationSchemaId,
        connections: connectionSchemaId,
        triggers: triggerSchemaId,
    };

    // <<< NEW: Variable to track added schemas within a test >>>
    let addedSchemasDuringTest;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        // <<< NEW: Initialize the Set for each test >>>
        addedSchemasDuringTest = new Set();

        // Default successful mock configuration
        mockConfiguration.getSchemaFiles.mockReturnValue([commonSchemaFile, entitySchemaFile]);
        mockConfiguration.getManifestSchemaId.mockReturnValue(manifestSchemaId);
        mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => essentialSchemaIdsMap[type]);
        mockPathResolver.resolveSchemaPath.mockImplementation(filename => `./test/schemas/${filename}`);

        // <<< MODIFIED: Default addSchema mock - tracks the ID >>>
        mockSchemaValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
            if (!schemaId) { // Basic guard against bad data in tests
                console.warn("Test Warning: addSchema called without schemaId");
                return;
            }
            addedSchemasDuringTest.add(schemaId); // Simulate adding to validator state
            return undefined; // Simulate successful add
        });

        // <<< MODIFIED: Default isSchemaLoaded mock - reflects the tracked state >>>
        mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => {
            // Check if the schema was "added" during this test run
            return addedSchemasDuringTest.has(id);
        });

        mockDataFetcher.fetch.mockImplementation(async (path) => {
            // Handle the default files
            if (path === commonSchemaPath) return commonSchemaData;
            if (path === entitySchemaPath) return entitySchemaData;
            // Handle files needed for other tests (like verification)
            const index = allSchemaPaths.indexOf(path);
            if (index !== -1) return allSchemaData[index];
            // Default error for unexpected paths
            throw new Error(`Mock fetch error: Unknown path ${path}`);
        });

        // Instantiate the SchemaLoader with mocks
        schemaLoader = new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockLogger);
        // Clear constructor log call for cleaner test verification
        mockLogger.info.mockClear();
    });

    // --- Test Scenarios ---

    it('[Skip Loading] should skip loading if manifest schema is already loaded', async () => {
        // Arrange
        mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => {
            return id === manifestSchemaId; // Only manifest schema is loaded
        });

        // Act
        await expect(schemaLoader.loadAndCompileAllSchemas()).resolves.toBeUndefined();

        // Assert
        expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(1); // Only for the initial check
        expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledTimes(1); // Only the initial check
        expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(manifestSchemaId);

        // Crucially, these should NOT be called
        expect(mockPathResolver.resolveSchemaPath).not.toHaveBeenCalled();
        expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
        expect(mockSchemaValidator.addSchema).not.toHaveBeenCalled();
        expect(mockConfiguration.getContentTypeSchemaId).not.toHaveBeenCalled(); // Verification step is skipped

        // Check logs
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Essential schemas appear to be already loaded'));
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Only the skip message
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('[Fetch Error] should reject and log error if fetching a schema fails', async () => {
        // Arrange
        const fetchError = new Error('Network Error');
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === commonSchemaPath) return commonSchemaData;
            if (path === entitySchemaPath) throw fetchError; // Fail fetching the second schema
            throw new Error(`Mock fetch error: Unknown path ${path}`);
        });

        // Act & Assert
        await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(`Failed processing schema ${entitySchemaFile}: ${fetchError.message}`);

        // Assertions
        expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(2); // Called for both
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2); // Attempted both fetches
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(commonSchemaPath);
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(entitySchemaPath);

        // addSchema only called for the successful one
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(commonSchemaData, commonSchemaId);

        // Check logs
        expect(mockLogger.error).toHaveBeenCalledWith(// Update this line to match the new format:
            `SchemaLoader: Failed to load or process schema ${entitySchemaFile} (ID: unknown, Path: ${entitySchemaPath})`, expect.any(Error) // The original thrown error inside the loop
        );
        expect(mockLogger.error).toHaveBeenCalledWith('SchemaLoader: One or more schemas failed to load. Aborting further data loading.', expect.any(Error) // The aggregate error from Promise.all rejection
        );
        // No completion or verification logs
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Schema loading process complete'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Essential schemas confirmed'));
    });

    it('[Missing $id] should reject and log error if a fetched schema is missing $id', async () => {
        // Arrange
        const schemaWithoutId = {title: 'Schema Without ID'}; // Missing $id
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === commonSchemaPath) return commonSchemaData;
            if (path === entitySchemaPath) return schemaWithoutId; // Return invalid data
            throw new Error(`Mock fetch error: Unknown path ${path}`);
        });

        // Act & Assert
        await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(`Schema file ${entitySchemaFile} (at ${entitySchemaPath}) is missing required '$id' property.`);

        // Assertions
        expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(entitySchemaPath);

        // addSchema only called for the valid one
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(commonSchemaData, commonSchemaId);


        // Check logs
// Option 1: Expect both calls specifically (more robust)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Validator missing essential schema")); // Check the new log
        expect(mockLogger.info).toHaveBeenCalledWith(`SchemaLoader: Loading 2 schemas listed in configuration...`);

// Option 2: If you only care that "Loading..." was logged eventually,
// ensure other assertions aren't interfering. Option 1 is generally better.

// Check the error logs (These should already be correct based on the schemaLoader code)
        expect(mockLogger.error).toHaveBeenCalledWith(`SchemaLoader: Schema file ${entitySchemaFile} (at ${entitySchemaPath}) is missing required '$id' property.`);
        expect(mockLogger.error).toHaveBeenCalledWith('SchemaLoader: One or more schemas failed to load. Aborting further data loading.', expect.any(Error));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Schema loading process complete'));
    });

    it('[addSchema Error] should reject and log error if validator.addSchema fails', async () => {
        // Arrange
        const addSchemaError = new Error('Invalid Schema Structure');
        mockSchemaValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
            if (schemaId === commonSchemaId) return; // First one succeeds
            if (schemaId === entitySchemaId) throw addSchemaError; // Second one fails
        });

        // Act & Assert
        await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(`Failed processing schema ${entitySchemaFile}: ${addSchemaError.message}`);

        // Assertions
        expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(2); // Attempted for both
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(commonSchemaData, commonSchemaId);
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(entitySchemaData, entitySchemaId);


        // Check logs
        expect(mockLogger.error).toHaveBeenCalledWith(
            // Update this line to match the new format:
            `SchemaLoader: Failed to load or process schema ${entitySchemaFile} (ID: ${entitySchemaId}, Path: ${entitySchemaPath})`,
            addSchemaError // The specific error from addSchema
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            'SchemaLoader: One or more schemas failed to load. Aborting further data loading.',
            expect.any(Error) // Aggregate error
        );
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Schema loading process complete'));
    });

    // <<< MODIFIED: [Verification Failure] Test - Override isSchemaLoaded carefully >>>
    it('[Verification Failure] should reject and log error if an essential schema is missing after loading', async () => {
        // Arrange: Load all schemas listed in allSchemaFiles
        mockConfiguration.getSchemaFiles.mockReturnValue(allSchemaFiles);
        // Fetcher and default addSchema (which tracks added schemas) are used from beforeEach

        const missingEssentialId = itemSchemaId;

        // Override isSchemaLoaded specifically for this test's scenario
        mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => {
            // Force the specific essential schema to appear missing *always* in this test
            if (id === missingEssentialId) {
                return false;
            }
            // For all other schemas, behave like the default: check if addSchema was called for it.
            return addedSchemasDuringTest.has(id);
        });

        // Act & Assert
        await expect(schemaLoader.loadAndCompileAllSchemas()).rejects.toThrow(`SchemaLoader: One or more prerequisite schemas are not available in the validator after loading attempt. Check logs.`);

        // Assertions ... (keep checks for resolvePath, fetch, addSchema, isSchemaLoaded calls) ...
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(allSchemaFiles.length);
        expect(addedSchemasDuringTest.size).toBe(allSchemaFiles.length);
        expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(missingEssentialId);


        // <<< FIXED: Check the specific log message that IS generated >>>
        expect(mockLogger.error).toHaveBeenCalledWith(`SchemaLoader: CRITICAL - Essential schema ${missingEssentialId} failed to load or compile. Content loading cannot proceed reliably.`);
        // <<< REMOVED/COMMENTED: This assertion was incorrect for this log call >>>
        // expect(mockLogger.error).toHaveBeenCalledWith(
        //    expect.stringContaining('SchemaLoader: One or more prerequisite schemas are not available'), // Message from the thrown error
        //    expect.any(Error)
        // );

        // Optional: Verify that the "CRITICAL" log was called exactly once (if only one schema failed)
        // We can filter the calls to mockLogger.error
        const criticalLogCalls = mockLogger.error.mock.calls.filter(call => call[0].includes('CRITICAL - Essential schema'));
        expect(criticalLogCalls).toHaveLength(1);


        // Loading itself completed
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Schema loading process complete. Added ${allSchemaFiles.length} new schemas`));
        // Verification failed
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Essential schemas confirmed available'));
    });


    it('[No Schema Files] should resolve successfully and log warning if no schema files are configured', async () => {
        // Arrange
        mockConfiguration.getSchemaFiles.mockReturnValue([]); // No files

        // Act
        await expect(schemaLoader.loadAndCompileAllSchemas()).resolves.toBeUndefined();

        // Assert
        expect(mockConfiguration.getSchemaFiles).toHaveBeenCalledTimes(1);
        // Crucially, none of the loading machinery should be called
        expect(mockConfiguration.getManifestSchemaId).not.toHaveBeenCalled(); // Skip check not needed
        expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
        expect(mockPathResolver.resolveSchemaPath).not.toHaveBeenCalled();
        expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
        expect(mockSchemaValidator.addSchema).not.toHaveBeenCalled();
        expect(mockConfiguration.getContentTypeSchemaId).not.toHaveBeenCalled(); // Verification skipped

        // Check logs
        expect(mockLogger.warn).toHaveBeenCalledWith('SchemaLoader: No schema files listed in configuration. Skipping schema loading.');
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).not.toHaveBeenCalled(); // No info logs expected
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
    });

    it('should handle case where manifestSchemaId is not configured', async () => {
        // Arrange
        mockConfiguration.getManifestSchemaId.mockReturnValue(undefined); // No manifest ID
        mockConfiguration.getSchemaFiles.mockReturnValue([commonSchemaFile]); // Provide one file
        mockDataFetcher.fetch.mockResolvedValue(commonSchemaData);
        mockSchemaValidator.addSchema.mockResolvedValue(undefined);

        // FIX: Make isSchemaLoaded return false initially so addSchema is called
        let calledOnce = false;
        mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => {
            // The initial check for manifest ID happens, but ID is undefined - shouldn't matter here
            // We care about the check for commonSchemaId before adding it
            if (id === commonSchemaId) {
                return false; // Indicate commonSchema is NOT loaded yet
            }
            // Assume essential schemas (like entitySchemaId) *are* loaded for the final verification step in this test
            return true;
        });


        // Act
        await expect(schemaLoader.loadAndCompileAllSchemas()).resolves.toBeUndefined();

        // Assert
        // Check that loading still proceeded
        expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledWith(commonSchemaFile);
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(commonSchemaPath);
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(1); // Should be called now
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(commonSchemaData, commonSchemaId); // <--- This should now pass

        // Check initial log message
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Manifest Schema ID not configured. Proceeding with schema load'));

        // Check verification step (it filters out undefined manifest ID)
        expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(entitySchemaId); // Verification check still runs for others
        // Note: isSchemaLoaded(commonSchemaId) might be called again here, the mock should return true now

        // REFINED MOCK (if needed for verification pass):
        let addedSet = new Set();
        mockSchemaValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
            addedSet.add(schemaId);
        });
        mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => {
            if (id === commonSchemaId) {
                // Return false before it's added, true after (for verification)
                return addedSet.has(id);
            }
            // Assume others needed for verification are loaded
            return essentialSchemaIdsMap.entities === id || essentialSchemaIdsMap.items === id; // Or simply return true if not commonId
        });
        // Rerun with this refined mock if the simpler one fails assertion checks later in the test


        // Check final success log
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Essential schemas confirmed available'));
    });

    it('should not try to add a schema if it is already loaded', async () => {
        // Arrange
        mockConfiguration.getSchemaFiles.mockReturnValue([commonSchemaFile, entitySchemaFile]);

        // FIX: Stateful mock for isSchemaLoaded and track addSchema calls
        let addedSchemas = new Set();
        mockSchemaValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
            addedSchemas.add(schemaId); // Track which schemas were added
            return undefined;
        });

        mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => {
            // 1. Initial manifest check to trigger full load
            // Use mock.calls.length to reliably detect the very first call
            if (id === manifestSchemaId && mockSchemaValidator.isSchemaLoaded.mock.calls.length <= 1) {
                return false;
            }
            // 2. commonSchema is pre-loaded
            if (id === commonSchemaId) {
                return true;
            }
            // 3. For entitySchemaId (and potentially others during verification):
            // Return true if it was added OR if it's an essential schema assumed to be OK for this test
            // We know entitySchemaId *should* be added.
            if (addedSchemas.has(id)) {
                return true; // It was successfully added
            }

            // If it's entitySchemaId *before* it's added, return false
            if (id === entitySchemaId) {
                return false;
            }

            // 4. For other essential schemas during verification, assume they are loaded
            // This depends on what `essentialSchemaIdsMap` contains. If only entitySchemaId is relevant:
            // return false; // Or be more specific if other essentials matter:
            return [manifestSchemaId, itemSchemaId, locationSchemaId, connectionSchemaId, triggerSchemaId].includes(id); // Assume other essentials ARE loaded
        });


        // Act
        await expect(schemaLoader.loadAndCompileAllSchemas()).resolves.toBeUndefined(); // <--- This should now pass

        // Assert
        expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2); // Fetches both

        // Only adds the one not already loaded (entitySchema)
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(entitySchemaData, entitySchemaId);
        expect(mockSchemaValidator.addSchema).not.toHaveBeenCalledWith(commonSchemaData, commonSchemaId);

        // Ensure addSchema tracking worked
        expect(addedSchemas.has(entitySchemaId)).toBe(true);

        // Verify the final checks passed for essential schemas
        expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(entitySchemaId); // Should have returned true during verification

        // Correct count in log message
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Schema loading process complete. Added 1 new schemas'));
        // Ensure verification success log is present
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Essential schemas confirmed available'));
    });


    // Optional: Test constructor dependency validation (less critical than core logic)
    describe('Constructor Dependency Validation', () => {
        it('should throw error if configuration is missing or invalid', () => {
            expect(() => new SchemaLoader(null, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockLogger)).toThrow(/configuration/);
            expect(() => new SchemaLoader({}, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockLogger)).toThrow(/configuration/);
        });
        it('should throw error if pathResolver is missing or invalid', () => {
            expect(() => new SchemaLoader(mockConfiguration, null, mockDataFetcher, mockSchemaValidator, mockLogger)).toThrow(/pathResolver/);
            expect(() => new SchemaLoader(mockConfiguration, {}, mockDataFetcher, mockSchemaValidator, mockLogger)).toThrow(/pathResolver/);
        });
        it('should throw error if fetcher is missing or invalid', () => {
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, null, mockSchemaValidator, mockLogger)).toThrow(/fetcher/);
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, {}, mockSchemaValidator, mockLogger)).toThrow(/fetcher/);
        });
        it('should throw error if validator is missing or invalid', () => {
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, null, mockLogger)).toThrow(/validator/);
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, {}, mockLogger)).toThrow(/validator/);
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, {addSchema: jest.fn()}, mockLogger)).toThrow(/validator/); // Missing isSchemaLoaded
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, {isSchemaLoaded: jest.fn()}, mockLogger)).toThrow(/validator/); // Missing addSchema
        });
        it('should throw error if logger is missing or invalid', () => {
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, null)).toThrow(/logger/);
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, {})).toThrow(/logger/);
            expect(() => new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, {info: jest.fn()})).toThrow(/logger/); // Missing error
        });
    });

});