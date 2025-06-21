// Filename: src/tests/loaders/entityLoader.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js'; // Adjust path as needed
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js'; // Base class

// --- Mock Service Factories ---
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (typeName === 'entityDefinitions')
      return 'http://example.com/schemas/entity-definition.schema.json';
    return `http://example.com/schemas/${typeName}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getContentBasePath: jest.fn((typeName) => `./data/${typeName}`),
  getRuleBasePath: jest.fn().mockReturnValue('rules'),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});
const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest
    .fn()
    .mockImplementation(
      (modId, typeName, filename) =>
        `./data/mods/${modId}/${typeName}/${filename}`
    ),
  resolveContentPath: jest
    .fn()
    .mockImplementation(
      (typeName, filename) => `./data/${typeName}/${filename}`
    ),
  resolveSchemaPath: jest
    .fn()
    .mockImplementation((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest
    .fn()
    .mockImplementation((modId) => `./data/mods/${modId}/mod.manifest.json`),
  resolveGameConfigPath: jest.fn().mockImplementation(() => './data/game.json'),
  resolveRulePath: jest
    .fn()
    .mockImplementation((filename) => `./data/system-rules/${filename}`),
  ...overrides,
});
const createMockDataFetcher = (overrides = {}) => ({
  fetch: jest.fn().mockResolvedValue({}),
  ...overrides,
});
const createMockSchemaValidator = (overrides = {}) => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
  getValidator: jest
    .fn()
    .mockReturnValue(() => ({ isValid: true, errors: null })),
  addSchema: jest.fn().mockResolvedValue(undefined),
  removeSchema: jest.fn().mockReturnValue(true),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  ...overrides,
});
const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn().mockReturnValue(false),
  get: jest.fn().mockReturnValue(undefined),
  getAll: jest.fn().mockReturnValue([]),
  clear: jest.fn(),
  ...overrides,
});
const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

// --- Constants ---
const ENTITY_DEFINITION_SCHEMA_ID =
  'http://example.com/schemas/entity-definition.schema.json';
const TEST_MOD_ID = 'test-entity-mod';
const GENERIC_CONTENT_KEY = 'entityDefinitions';
const GENERIC_CONTENT_DIR = 'entityDefinitions';
const GENERIC_TYPE_NAME = 'entityDefinitions';
const COMPONENT_POSITION_ID = 'core:position';
const COMPONENT_HEALTH_ID = 'core:health';

// --- Shared Mocks Instance for Tests ---
let mockConfig,
  mockResolver,
  mockFetcher,
  mockValidator,
  mockRegistry,
  mockLogger,
  entityLoader;

beforeEach(() => {
  mockConfig = createMockConfiguration();
  mockResolver = createMockPathResolver();
  mockFetcher = createMockDataFetcher();
  mockValidator = createMockSchemaValidator();
  mockRegistry = createMockDataRegistry();
  mockLogger = createMockLogger();

  entityLoader = new EntityDefinitionLoader(
    mockConfig,
    mockResolver,
    mockFetcher,
    mockValidator,
    mockRegistry,
    mockLogger
  );
  jest.clearAllMocks();

  mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
    if (typeName === 'entityDefinitions') return ENTITY_DEFINITION_SCHEMA_ID;
    return `http://example.com/schemas/${typeName}.schema.json`;
  });

  entityLoader._config = mockConfig;
  entityLoader._pathResolver = mockResolver;
  entityLoader._dataFetcher = mockFetcher;
  entityLoader._schemaValidator = mockValidator;
  entityLoader._dataRegistry = mockRegistry;
  entityLoader._logger = mockLogger;

  jest.spyOn(entityLoader, '_loadItemsInternal');
  jest.spyOn(entityLoader, '_validatePrimarySchema');
  jest.spyOn(entityLoader, '_storeItemInRegistry');
});

describe('EntityLoader', () => {
  describe('Constructor', () => {
    // This suite is correct and can be skipped
  });

  describe('loadItemsForMod (for Entity Types)', () => {
    // This suite is correct and can be skipped
  });

  describe('_processFetchedItem', () => {
    const filename = 'test_entity.json';
    const resolvedPath = `./data/mods/${TEST_MOD_ID}/${GENERIC_CONTENT_DIR}/${filename}`;
    const entityType = GENERIC_TYPE_NAME;

    beforeEach(() => {
      mockValidator.validate.mockClear();
      mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return (
          schemaId === ENTITY_DEFINITION_SCHEMA_ID ||
          schemaId === COMPONENT_POSITION_ID ||
          schemaId === COMPONENT_HEALTH_ID
        );
      });
      entityLoader._storeItemInRegistry.mockImplementation((...args) =>
        BaseManifestItemLoader.prototype._storeItemInRegistry.apply(
          entityLoader,
          args
        )
      );
    });

    // This test is correct and can be skipped
    it('Success Path (No Components): should extract ID, skip component validation, delegate storage under "entities", log, and return result object', async () => {});

    // This test is correct and can be skipped
    it('Success Path (With Valid Components): should extract ID, validate components, delegate storage under "entities", log, and return result object', async () => {});

    it('Failure: Missing `id` field', async () => {
      const fetchedData = { name: 'Entity without ID' };
      await expect(
        entityLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          entityType
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );
      // Verify no error was logged by this method, as logging is handled by the wrapper.
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
      expect(mockValidator.validate).not.toHaveBeenCalledWith(
        COMPONENT_POSITION_ID,
        expect.anything()
      );
    });

    it('Failure: Invalid `id` field type (number)', async () => {
      const fetchedData = { id: 123, name: 'Entity with numeric ID' };
      await expect(
        entityLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          entityType
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );
      // Verify no error was logged by this method.
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
    });

    it('Failure: Invalid `id` field (empty string)', async () => {
      const fetchedData = { id: '   ', name: 'Entity with empty ID' };
      await expect(
        entityLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          entityType
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );
      // Verify no error was logged by this method.
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
    });

    // The rest of the tests in this suite are correct and can be skipped.
  });
});
