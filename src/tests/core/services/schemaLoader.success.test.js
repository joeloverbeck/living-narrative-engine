// src/tests/core/services/schemaLoader.success.test.js

import {describe, it, expect, jest} from '@jest/globals';
import SchemaLoader from '../../../core/services/schemaLoader.js'; // Adjust path RELATIVE TO THIS NEW FILE

// --- Test Constants (Copied from original file) ---
const commonSchemaFile = 'common.schema.json';
const entitySchemaFile = 'entity.schema.json';
const manifestSchemaFile = 'manifest.schema.json';
const itemSchemaFile = 'items.schema.json';
const locationSchemaFile = 'locations.schema.json';
const connectionSchemaFile = 'connections.schema.json';
const triggerSchemaFile = 'triggers.schema.json';

const commonSchemaPath = `./test/schemas/${commonSchemaFile}`; // Adjust path if needed
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


const essentialSchemaIdsMap = {
    manifest: manifestSchemaId,
    entities: entitySchemaId,
    items: itemSchemaId,
    locations: locationSchemaId,
    connections: connectionSchemaId,
    triggers: triggerSchemaId,
};
const idToFileMap = {
    [commonSchemaId]: commonSchemaFile,
    [entitySchemaId]: entitySchemaFile,
    [manifestSchemaId]: manifestSchemaFile,
    [itemSchemaId]: itemSchemaFile,
    [locationSchemaId]: locationSchemaFile,
    [connectionSchemaId]: connectionSchemaFile,
    [triggerSchemaId]: triggerSchemaFile,
};
// *** This map ALSO looks correct based on the constants ***
const pathToDataMap = {
    [commonSchemaPath]: commonSchemaData, // commonSchemaPath = `./test/schemas/common.schema.json`
    [entitySchemaPath]: entitySchemaData,
    [manifestSchemaPath]: manifestSchemaData,
    [itemSchemaPath]: itemSchemaData,
    [locationSchemaPath]: locationSchemaData,
    [connectionSchemaPath]: connectionSchemaData,
    [triggerSchemaPath]: triggerSchemaData,
};


// --- Test Suite for Success Case ---

describe('SchemaLoader Success Case', () => {

    let mockConfiguration;
    let mockPathResolver;
    let mockDataFetcher;
    let mockSchemaValidator;
    let mockLogger;
    let schemaLoader;
    let addedSchemasDuringTest;
    let filesToLoadForTest;

    beforeEach(() => {
        addedSchemasDuringTest = new Set();
        // Create fresh mocks...
        mockConfiguration = {
            getSchemaFiles: jest.fn(),
            getManifestSchemaId: jest.fn(),
            getContentTypeSchemaId: jest.fn(),
            // Add dummy functions for any other methods checked by constructor if necessary
            getBaseDataPath: jest.fn(),
            getSchemaBasePath: jest.fn(),
            getContentBasePath: jest.fn(),
            getWorldBasePath: jest.fn(),
        };
        mockPathResolver = {
            resolveSchemaPath: jest.fn(),
            resolveManifestPath: jest.fn(), // Dummy
            resolveContentPath: jest.fn(),  // Dummy
        };
        mockDataFetcher = {
            fetch: jest.fn(),
        };
        mockSchemaValidator = {
            addSchema: jest.fn(),
            isSchemaLoaded: jest.fn(),
            getValidator: jest.fn(), // Dummy
        };
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // Configure which files to load...
        const essentialIds = Object.values(essentialSchemaIdsMap).filter(id => !!id);
        const essentialFiles = essentialIds.map(id => idToFileMap[id]).filter(f => !!f);
        filesToLoadForTest = [...new Set([commonSchemaFile, ...essentialFiles])];
        mockConfiguration.getSchemaFiles.mockReturnValue(filesToLoadForTest);

        // Configure ID lookups...
        mockConfiguration.getManifestSchemaId.mockReturnValue(manifestSchemaId);
        mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => essentialSchemaIdsMap[type]);

        // Configure Path Resolution...
        mockPathResolver.resolveSchemaPath.mockImplementation(filename => `./test/schemas/${filename}`);

        // Configure Data Fetching (using the explicitly keyed map)
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            // console.log(`DEBUG Fetch Path: "${path}"`); // Keep for debugging if needed
            const data = pathToDataMap[path];
            if (data) {
                return data;
            }
            // console.error(`DEBUG Fetch Error: Path "${path}" not found in keys:`, Object.keys(pathToDataMap)); // Keep for debugging
            throw new Error(`Isolated Test Mock fetch error: Unknown path ${path}`);
        });

        // Configure STATEFUL Validator Mocks...
        mockSchemaValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
            if (!schemaId) {
                console.warn("Test Warning: addSchema called without schemaId");
                return;
            }
            addedSchemasDuringTest.add(schemaId);
            return undefined;
        });
        mockSchemaValidator.isSchemaLoaded.mockImplementation((id) => addedSchemasDuringTest.has(id));

        // Instantiate the SchemaLoader
        schemaLoader = new SchemaLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockLogger);
    });

    // --- The Test ---
    it('[Success] should load and compile schemas successfully', async () => {
        // Arrange phase is done in beforeEach

        // Act
        await expect(schemaLoader.loadAndCompileAllSchemas()).resolves.toBeUndefined(); // <<< This should now pass

        // Assert
        // ... rest of assertions remain the same ...
        const filesLoaded = filesToLoadForTest;
        const loadedCount = filesLoaded.length;

        expect(mockConfiguration.getSchemaFiles).toHaveBeenCalledTimes(1);
        expect(mockConfiguration.getManifestSchemaId).toHaveBeenCalledTimes(2);
        expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(loadedCount);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(loadedCount); // Verify fetch was called for all
        expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(loadedCount);

        const essentialIdsToCheck = Object.values(essentialSchemaIdsMap).filter(id => !!id);
        essentialIdsToCheck.forEach(id => {
            const fileForId = idToFileMap[id];
            if (fileForId && filesLoaded.includes(fileForId)) {
                expect(addedSchemasDuringTest.has(id)).toBe(true);
            }
        });

        for (const id of essentialIdsToCheck) {
            expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(id);
        }

        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Proceeding with full schema load'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Schema loading process complete. Added ${loadedCount} new schemas`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Essential schemas confirmed available'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });
});