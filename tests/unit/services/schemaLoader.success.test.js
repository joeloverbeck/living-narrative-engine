// src/tests/services/schemaLoader.success.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals'; // Added beforeEach
import SchemaLoader from '../../../src/loaders/schemaLoader.js'; // Adjust path RELATIVE TO THIS NEW FILE

// --- Test Constants (Copied from original file - Keep as is) ---
const commonSchemaFile = 'common.schema.json';
const entityDefinitionSchemaFile = 'entity-definition.schema.json';
const entityInstanceSchemaFile = 'entity-instance.schema.json';
const manifestSchemaFile = 'manifest.schema.json';
const itemSchemaFile = 'items.schema.json';
const locationSchemaFile = 'locations.schema.json';
const connectionSchemaFile = 'connections.schema.json';
const triggerSchemaFile = 'triggers.schema.json';

const commonSchemaPath = `./test/schemas/${commonSchemaFile}`;
const entityDefinitionSchemaPath = `./test/schemas/${entityDefinitionSchemaFile}`;
const entityInstanceSchemaPath = `./test/schemas/${entityInstanceSchemaFile}`;
const manifestSchemaPath = `./test/schemas/${manifestSchemaFile}`;
const itemSchemaPath = `./test/schemas/${itemSchemaFile}`;
const locationSchemaPath = `./test/schemas/${locationSchemaFile}`;
const connectionSchemaPath = `./test/schemas/${connectionSchemaFile}`;
const triggerSchemaPath = `./test/schemas/${triggerSchemaFile}`;

const commonSchemaId = 'test://schemas/common';
const entityDefinitionSchemaId = 'test://schemas/entity-definition';
const entityInstanceSchemaId = 'test://schemas/entity-instance';
const manifestSchemaId = 'test://schemas/manifest';
const itemSchemaId = 'test://schemas/items';
const locationSchemaId = 'test://schemas/locations';
const connectionSchemaId = 'test://schemas/connections';
const triggerSchemaId = 'test://schemas/triggers';

const commonSchemaData = { $id: commonSchemaId, title: 'Common Test' };
const entityDefinitionSchemaData = {
  $id: entityDefinitionSchemaId,
  title: 'Entity Definition Test',
};
const entityInstanceSchemaData = {
  $id: entityInstanceSchemaId,
  title: 'Entity Instance Test',
};
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
  entityDefinitions: entityDefinitionSchemaId,
  entityInstances: entityInstanceSchemaId,
  items: itemSchemaId,
  locations: locationSchemaId,
  connections: connectionSchemaId,
  triggers: triggerSchemaId,
};
const idToFileMap = {
  [commonSchemaId]: commonSchemaFile,
  [entityDefinitionSchemaId]: entityDefinitionSchemaFile,
  [entityInstanceSchemaId]: entityInstanceSchemaFile,
  [manifestSchemaId]: manifestSchemaFile,
  [itemSchemaId]: itemSchemaFile,
  [locationSchemaId]: locationSchemaFile,
  [connectionSchemaId]: connectionSchemaFile,
  [triggerSchemaId]: triggerSchemaFile,
};
const pathToDataMap = {
  [commonSchemaPath]: commonSchemaData,
  [entityDefinitionSchemaPath]: entityDefinitionSchemaData,
  [entityInstanceSchemaPath]: entityInstanceSchemaData,
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
    };
    mockPathResolver = {
      resolveSchemaPath: jest.fn(),
      resolveContentPath: jest.fn(),
    };
    mockDataFetcher = {
      fetch: jest.fn(),
    };
    mockSchemaValidator = {
      addSchema: jest.fn(),
      addSchemas: jest.fn(),
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
    mockSchemaValidator.addSchemas.mockImplementation(async (schemasArray) => {
      if (!Array.isArray(schemasArray) || schemasArray.length === 0) {
        throw new Error(
          'Test Mock Error: addSchemas called with invalid input'
        );
      }
      // Add all schema IDs to the tracking set
      schemasArray.forEach((schema) => {
        if (schema && schema.$id) {
          addedSchemasDuringTest.add(schema.$id);
        }
      });
    });
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
    mockLogger.debug.mockClear();
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

    // Path resolution and fetch are called for each file
    expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledTimes(
      loadedCount
    );
    expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(loadedCount);

    // addSchemas is called once with all schemas in batch
    expect(mockSchemaValidator.addSchemas).toHaveBeenCalledTimes(1);
    expect(mockSchemaValidator.addSchema).not.toHaveBeenCalled(); // Old method should not be called

    // Verify each schema file path was resolved
    filesToLoadForTest.forEach((file) => {
      expect(mockPathResolver.resolveSchemaPath).toHaveBeenCalledWith(file);
    });

    // Verify each schema was fetched
    for (const file of filesToLoadForTest) {
      const path = `./test/schemas/${file}`;
      const data = pathToDataMap[path];
      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(path);
    }

    // Verify addSchemas was called with the correct array of schema data
    const expectedSchemaData = filesToLoadForTest.map((file) => {
      const path = `./test/schemas/${file}`;
      return pathToDataMap[path];
    });
    expect(mockSchemaValidator.addSchemas).toHaveBeenCalledWith(
      expectedSchemaData
    );

    // Check logs
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `SchemaLoader: Processing ${loadedCount} schemas listed in configuration (batch registration)...`
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `SchemaLoader: Batch schema registration complete. Added ${loadedCount} schemas.`
    );
    expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Start and End logs
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
