// test/core/services/worldLoader.test.js

import WorldLoader from '../../../core/services/worldLoader.js';
import {beforeEach, describe, expect, jest, test} from "@jest/globals";
// Import other necessary classes if needed for type checking mocks, though often not required with jest.fn()
// import SchemaLoader from '../../../src/core/services/schemaLoader.js';
// import ManifestLoader from '../../../src/core/services/manifestLoader.js';
// ... etc.

// Mock dependencies
const mockRegistry = {
    clear: jest.fn(),
    setManifest: jest.fn(),
    getManifest: jest.fn(),
    store: jest.fn(), // Added for completeness as ComponentDefinitionLoader uses it
    getAll: jest.fn().mockReturnValue([]), // Added for logLoadSummary call
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Added for completeness
};

const mockSchemaLoader = {
    loadAndCompileAllSchemas: jest.fn(),
};

const mockManifestLoader = {
    loadAndValidateManifest: jest.fn(),
};

const mockContentLoader = {
    loadContentFiles: jest.fn(),
};

const mockComponentDefinitionLoader = {
    loadComponentDefinitions: jest.fn(),
};

const mockValidator = {
    isSchemaLoaded: jest.fn(),
    addSchema: jest.fn(), // Added for completeness as ComponentDefinitionLoader uses it
    getValidator: jest.fn(), // Added for completeness as ComponentDefinitionLoader uses it
    validate: jest.fn(), // Added for completeness
};

const mockConfiguration = {
    getManifestSchemaId: jest.fn(),
    getContentTypeSchemaId: jest.fn(),
    // Mock other IConfiguration methods used indirectly if necessary
    getBaseDataPath: jest.fn().mockReturnValue('/fake/data'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getSchemaBasePath: jest.fn().mockReturnValue('/fake/data/schemas'),
    getContentBasePath: jest.fn().mockReturnValue('/fake/data/content'),
    getWorldBasePath: jest.fn().mockReturnValue('/fake/data/worlds'),
};

// --- Test Suite ---

describe('WorldLoader', () => {
    let worldLoader;
    const testWorldName = 'test-world';
    const essentialSchemaIds = {
        manifest: 'schema://core/manifest',
        events: 'schema://content/events',
        actions: 'schema://content/actions',
        entities: 'schema://content/entities',
        items: 'schema://content/items',
        locations: 'schema://content/locations',
        connections: 'schema://content/connections',
        triggers: 'schema://content/triggers',
        components: 'schema://content/components', // Definition schema
        // Add any other IDs returned by getContentTypeSchemaId in the real implementation
    };
    const criticalContentTypes = [
        'events', 'actions', 'entities', 'items', 'locations',
        'connections', 'triggers', 'components'
    ];

    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();

        // Configure standard successful schema loading
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

        // Configure IConfiguration to return the essential IDs
        mockConfiguration.getManifestSchemaId.mockReturnValue(essentialSchemaIds.manifest);
        mockConfiguration.getContentTypeSchemaId.mockImplementation(typeName => {
            return essentialSchemaIds[typeName];
        });

        // Mock manifest loader to return basic valid manifest on success
        mockManifestLoader.loadAndValidateManifest.mockResolvedValue({
            worldName: testWorldName,
            contentFiles: {
                // Add dummy entries if needed by later steps being tested
                components: ['comp1.component.json'],
                items: ['item1.json'],
            },
        });
        // Mock registry getManifest to return the manifest *after* setManifest is called
        mockRegistry.getManifest.mockReturnValue(null); // Default state
        mockRegistry.setManifest.mockImplementation((manifestData) => {
            mockRegistry.getManifest.mockReturnValue(manifestData);
        });

        // Configure other loaders to succeed by default
        mockComponentDefinitionLoader.loadComponentDefinitions.mockResolvedValue(undefined);
        mockContentLoader.loadContentFiles.mockResolvedValue(undefined);


        // Instantiate WorldLoader with mocked dependencies
        worldLoader = new WorldLoader(
            mockRegistry,
            mockLogger,
            mockSchemaLoader,
            mockManifestLoader,
            mockContentLoader,
            mockComponentDefinitionLoader,
            mockValidator,
            mockConfiguration
        );
    });

    describe('loadWorld - Essential Schema Verification', () => {

        test('AC1 & AC5: should proceed successfully if all essential schemas are loaded', async () => {
            // Arrange: Configure ISchemaValidator to report all essential schemas as loaded
            mockValidator.isSchemaLoaded.mockReturnValue(true); // Simple mock for this case

            // Act
            await expect(worldLoader.loadWorld(testWorldName)).resolves.toBeUndefined();

            // Assert
            // 1. Check call order (Schema -> Verify -> Manifest)
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalled(); // Verification step ran
            expect(mockManifestLoader.loadAndValidateManifest).toHaveBeenCalledTimes(1);

            // Verify the calls happened in the correct order
            // (Jest doesn't have a built-in easy way to check exact async call order across mocks,
            // but checking they were all called implies the flow likely continued correctly without error)
            // We can infer order: If manifestLoader was called, schemaLoader must have been called first
            // and the essential schema check must have passed.

            // 2. Check specific essential schemas were checked
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.manifest);
            for (const type of criticalContentTypes) {
                expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds[type]);
            }

            // 3. Check no missing schema error was logged or thrown
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Essential prerequisite schema missing'));
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during loadWorld'));

            // 4. Check subsequent steps were called (ManifestLoader already checked)
            expect(mockRegistry.setManifest).toHaveBeenCalledTimes(1);
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).toHaveBeenCalledTimes(1);
            // Check GenericContentLoader was called for types *other* than components
            expect(mockContentLoader.loadContentFiles).toHaveBeenCalledWith('items', ['item1.json']);
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalledWith('components', expect.anything());

            // 5. Check registry clear was only called once at the start
            expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
        });

        test('AC2, AC3 & AC4: should throw error and log if an essential schema is missing', async () => {
            const missingSchemaId = essentialSchemaIds.entities; // Choose one schema to be missing

            // Arrange: Configure ISchemaValidator to report one schema as missing
            mockValidator.isSchemaLoaded.mockImplementation(schemaId => {
                return schemaId !== missingSchemaId; // Returns false only for the missing one
            });

            // Act & Assert: Expect loadWorld to reject with a specific error
            await expect(worldLoader.loadWorld(testWorldName)).rejects.toThrow(
                `WorldLoader failed to load world '${testWorldName}': WorldLoader: Essential prerequisite schema(s) missing after schema loading. Cannot proceed.`
            );

            // Assert: Check logging and call order
            // 1. Check SchemaLoader was called
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);

            // 2. Check ISchemaValidator was called (at least until the missing one was found)
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.manifest); // Example check
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(missingSchemaId);

            // 3. Check the specific error message was logged for the missing schema
            expect(mockLogger.error).toHaveBeenCalledWith(
                `WorldLoader: Essential prerequisite schema missing: ID '${missingSchemaId}'`
            );

            // 4. Check the overall critical error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during loadWorld for '${testWorldName}'. Load process halted.`),
                expect.any(Error) // Checks that an error object was passed as the second arg
            );

            // 5. Check subsequent loading steps were *NOT* called
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled();
            expect(mockRegistry.setManifest).not.toHaveBeenCalled();
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).not.toHaveBeenCalled();
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();

            // 6. Check registry was cleared twice (start and error handler)
            expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        });

        test('AC2, AC3 & AC4: should throw error and log if multiple essential schemas are missing', async () => {
            const missingSchemaId1 = essentialSchemaIds.actions;
            const missingSchemaId2 = essentialSchemaIds.locations;
            const missingSchemas = [missingSchemaId1, missingSchemaId2];

            // Arrange: Configure ISchemaValidator
            mockValidator.isSchemaLoaded.mockImplementation(schemaId => {
                return !missingSchemas.includes(schemaId);
            });

            // Act & Assert: Expect loadWorld to reject
            await expect(worldLoader.loadWorld(testWorldName)).rejects.toThrow(
                `WorldLoader failed to load world '${testWorldName}': WorldLoader: Essential prerequisite schema(s) missing after schema loading. Cannot proceed.`
            );

            // Assert: Check logging and call order
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalled();

            // Check *both* missing schemas were logged individually
            expect(mockLogger.error).toHaveBeenCalledWith(
                `WorldLoader: Essential prerequisite schema missing: ID '${missingSchemaId1}'`
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                `WorldLoader: Essential prerequisite schema missing: ID '${missingSchemaId2}'`
            );

            // Check the overall critical error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during loadWorld for '${testWorldName}'. Load process halted.`),
                expect.any(Error)
            );

            // Check subsequent loading steps were *NOT* called
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled();
            expect(mockRegistry.setManifest).not.toHaveBeenCalled();
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).not.toHaveBeenCalled();
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();

            // Check registry was cleared twice
            expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        });

        test('AC4: Verification should happen AFTER schema loading and BEFORE manifest loading', async () => {
            // Arrange: Configure ISchemaValidator to report all essential schemas as loaded
            mockValidator.isSchemaLoaded.mockReturnValue(true);

            // Act
            await worldLoader.loadWorld(testWorldName);

            // Assert: Use Jest's mock call order inspection
            const schemaLoaderCallOrder = mockSchemaLoader.loadAndCompileAllSchemas.mock.invocationCallOrder[0];
            // Find the first call to isSchemaLoaded (it's called multiple times)
            const firstValidatorCallOrder = mockValidator.isSchemaLoaded.mock.invocationCallOrder[0];
            const manifestLoaderCallOrder = mockManifestLoader.loadAndValidateManifest.mock.invocationCallOrder[0];

            expect(schemaLoaderCallOrder).toBeDefined();
            expect(firstValidatorCallOrder).toBeDefined();
            expect(manifestLoaderCallOrder).toBeDefined();

            // Verify the sequence
            expect(schemaLoaderCallOrder).toBeLessThan(firstValidatorCallOrder);
            expect(firstValidatorCallOrder).toBeLessThan(manifestLoaderCallOrder);
        });
    });

    // Add other tests for WorldLoader constructor or other methods if needed
});