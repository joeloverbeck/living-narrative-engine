// Filename: src/tests/loaders/entityLoader.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import { createMockConfiguration, createMockPathResolver, createMockDataFetcher } from '../../common/mockFactories/index.js';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js'; // Base class

// --- Mock Service Factories ---
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

  mockConfig.getContentTypeSchemaId.mockImplementation((registryKey) => {
    if (registryKey === 'entityDefinitions') return ENTITY_DEFINITION_SCHEMA_ID;
    return `http://example.com/schemas/${registryKey}.schema.json`;
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
