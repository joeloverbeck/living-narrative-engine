// src/tests/core/services/schemaLoader.success.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals'; // Added beforeEach
import SchemaLoader from '../../src/loaders/schemaLoader.js'; // Adjust path RELATIVE TO THIS NEW FILE

// --- Test Constants (Copied from original file - Keep as is) ---
const commonSchemaFile = 'common.schema.json';
const entitySchemaFile = 'entity.schema.json';
const manifestSchemaFile = 'manifest.schema.json';
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

const commonSchemaData = { $id: commonSchemaId, title: 'Common Test' };
const entitySchemaData = { $id: entitySchemaId, title: 'Entity Test' };
const manifestSchemaData = { $id: manifestSchemaId, title: 'Manifest Test' };
const itemSchemaData = { $id: itemSchemaId, title: 'Items Test' };
const locationSchemaData = { $id: locationSchemaId, title: 'Locations Test' };
const connectionSchemaData = {
  $id: connectionSchemaId,
  title: 'Connections Test',
};
const triggerSchemaData = { $id: triggerSchemaId, title: 'Triggers Test' };

// Keep Maps as they are
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
const pathToDataMap = {
  [commonSchemaPath]: commonSchemaData,
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
  let addedSchemasDuringTest; // Keep track for assertions
  let filesToLoadForTest;

  beforeEach(() => {
    jest.clearAllMocks(); // Ensure mocks are clear
    addedSchemasDuringTest = new Set(); // Reset added schemas

    // Create fresh mocks...
    mockConfiguration = {
      getSchemaFiles: jest.fn(),
      getManifestSchemaId: jest.fn(), // Still needed for constructor check test in the other file
      getContentTypeSchemaId: jest.fn(),
      getBaseDataPath: jest.fn(),
      getSchemaBasePath: jest.fn(),
      getContentBasePath: jest.fn(),
      getWorldBasePath: jest.fn(),
    };
    mockPathResolver = {
      resolveSchemaPath: jest.fn(),
      resolveManifestPath: jest.fn(),
      resolveContentPath: jest.fn(),
    };
    mockDataFetcher = {
      fetch: jest.fn(),
    };
    mockSchemaValidator = {
      addSchema: jest.fn(),
      isSchemaLoaded: jest.fn(),
      getValidator: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Configure which files to load...
    // Ensure all relevant files are included based on maps
    const essentialFiles = Object.values(essentialSchemaIdsMap)
      .map((id) => idToFileMap[id])
      .filter(Boolean); // Filter out undefined if an ID has no file mapping
    filesToLoadForTest = [...new Set([commonSchemaFile, ...essentialFiles])];
    mockConfiguration.getSchemaFiles.mockReturnValue(filesToLoadForTest);

    // Configure ID lookups (getManifestSchemaId is not used by loadAndCompileAllSchemas anymore)
    // getContentTypeSchemaId might be used elsewhere, keep mock
    mockConfiguration.getContentTypeSchemaId.mockImplementation(
      (type) => essentialSchemaIdsMap[type]
    );

    // Configure Path Resolution...
    mockPathResolver.resolveSchemaPath.mockImplementation(
      (filename) => `./test/schemas/${filename}`
    );

    // Configure Data Fetching (using the explicitly keyed map)
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      const data = pathToDataMap[path];
      if (data === undefined) {
        // Check specifically for undefined, as null might be valid JSON
        throw new Error(
          `Isolated Test Mock fetch error: Unknown path ${path}. Known paths: ${Object.keys(pathToDataMap).join(', ')}`
        );
      }
      return data;
    });

    // Configure STATEFUL Validator Mocks...
    mockSchemaValidator.addSchema.mockImplementation(
      async (schemaData, schemaId) => {
        if (!schemaId)
          throw new Error('Test Mock Error: addSchema called without schemaId');
        addedSchemasDuringTest.add(schemaId);
        // return undefined; // Jest mocks return undefined by default
      }
    );
    // isSchemaLoaded should return false for all schemas in this success test initially
    mockSchemaValidator.isSchemaLoaded.mockImplementation((id) =>
      addedSchemasDuringTest.has(id)
    ); // Checks against runtime additions

    // Instantiate the SchemaLoader
    schemaLoader = new SchemaLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockLogger
    );
    // Clear constructor log call immediately AFTER instantiation
    mockLogger.info.mockClear();
  });

  // --- The Test ---
  it('[Success] should load and compile schemas successfully', async () => {
    // Arrange phase is done in beforeEach
    const loadedCount = filesToLoadForTest.length; // Expected count

    // Act
    await expect(
      schemaLoader.loadAndCompileAllSchemas()
    ).resolves.toBeUndefined();

    // Assert
    // --- Assertions based on the NEW SchemaLoader logic ---
    expect(mockConfiguration.getSchemaFiles).toHaveBeenCalledTimes(1);

    // getManifestSchemaId is NO LONGER CALLED during loadAndCompileAllSchemas
    expect(mockConfiguration.getManifestSchemaId).not.toHaveBeenCalled();

    // Path resolution, fetch, and isSchemaLoaded are called for each file
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(
      loadedCount
    );
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(loadedCount);
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledTimes(
      loadedCount
    );

    // addSchema is called for each file *because* isSchemaLoaded initially returns false for all
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(loadedCount);

    // Verify each schema file path was resolved
    filesToLoadForTest.forEach((file) => {
      expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledWith(file);
    });

    // Verify each schema was fetched and added (check arguments)
    for (const file of filesToLoadForTest) {
      const path = `./test/schemas/${file}`;
      const data = pathToDataMap[path];
      const id = data?.$id;
      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(path);
      expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(id); // Checked before adding
      expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(data, id); // Added because isSchemaLoaded returned false
    }

    // Check logs
    expect(mockLogger.info).toHaveBeenCalledWith(
      `SchemaLoader: Processing ${loadedCount} schemas listed in configuration...`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `SchemaLoader: Schema processing complete. Added ${loadedCount} new schemas to the validator (others may have been skipped).`
    );
    expect(mockLogger.info).toHaveBeenCalledTimes(2); // Start and End info logs
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
