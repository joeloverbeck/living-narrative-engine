// Filename: src/tests/loaders/eventLoader.test.js

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import EventLoader from '../../../src/loaders/eventLoader.js';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';

// --- Mock Service Factories ---
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'), // <<< CORRECTION: Added missing method
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (
      overrides.getContentTypeSchemaId &&
      typeof overrides.getContentTypeSchemaId === 'function'
    ) {
      const result = overrides.getContentTypeSchemaId(registryKey);
      if (result !== undefined) return result;
    }
    if (registryKey === 'events') {
      return 'http://example.com/schemas/event.schema.json';
    }
    return `http://example.com/schemas/${registryKey}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getContentBasePath: jest.fn((registryKey) => `./data/${registryKey}`),
  ...overrides,
});
const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, registryKey, filename) =>
      `./data/mods/${modId}/${registryKey}/${filename}`
  ),
  resolveContentPath: jest.fn(
    (registryKey, filename) => `./data/${registryKey}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest.fn(
    (modId) => `./data/mods/${modId}/mod.manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
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

// --- Shared Mocks Instance & Test Constants ---
let mockConfig,
  mockResolver,
  mockFetcher,
  mockValidator,
  mockRegistry,
  mockLogger,
  eventLoader;
let validatePrimarySchemaSpy, storeItemInRegistrySpy, loadItemsInternalSpy;
const realStoreItemInRegistry =
  BaseManifestItemLoader.prototype._storeItemInRegistry;
const TEST_MOD_ID = 'test-event-mod';
const EVENT_CONTENT_KEY = 'events';
const EVENT_CONTENT_DIR = 'events';
const EVENT_TYPE_NAME = 'events';

beforeEach(() => {
  mockConfig = createMockConfiguration();
  mockResolver = createMockPathResolver();
  mockFetcher = createMockDataFetcher();
  mockValidator = createMockSchemaValidator();
  mockRegistry = createMockDataRegistry();
  mockLogger = createMockLogger();

  validatePrimarySchemaSpy = jest.spyOn(
    BaseManifestItemLoader.prototype,
    '_validatePrimarySchema'
  );
  storeItemInRegistrySpy = jest.spyOn(
    BaseManifestItemLoader.prototype,
    '_storeItemInRegistry'
  );
  loadItemsInternalSpy = jest.spyOn(
    BaseManifestItemLoader.prototype,
    '_loadItemsInternal'
  );

  eventLoader = new EventLoader(
    mockConfig,
    mockResolver,
    mockFetcher,
    mockValidator,
    mockRegistry,
    mockLogger
  );
  jest.clearAllMocks();
  eventLoader._logger = mockLogger;

  loadItemsInternalSpy.mockResolvedValue({ count: 0, overrides: 0, errors: 0 });
  validatePrimarySchemaSpy.mockReturnValue({ isValid: true, errors: null });
  storeItemInRegistrySpy.mockImplementation((...args) =>
    realStoreItemInRegistry.apply(eventLoader, args)
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('EventLoader', () => {
  describe('Constructor', () => {
    /* Unchanged */
  });
  describe('loadItemsForMod', () => {
    /* Unchanged */
  });
  describe('_processFetchedItem', () => {
    const filename = 'test_event.json';
    const resolvedPath = `./data/mods/${TEST_MOD_ID}/${EVENT_CONTENT_DIR}/${filename}`;

    beforeEach(() => {
      mockValidator.isSchemaLoaded.mockReturnValue(false);
      mockValidator.addSchema.mockResolvedValue(undefined);
      mockRegistry.get.mockReturnValue(undefined);
    });

    // The tests below were fixed in the previous step and are correct.
    // They will now pass because the EventLoader can be instantiated successfully.
    it('Failure: Missing `id` field in data', async () => {
      const fetchedData = { description: 'Event without ID' };
      await expect(
        eventLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          EVENT_TYPE_NAME
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
    });

    it('Failure: Invalid `id` field type (not string)', async () => {
      const fetchedData = { id: 123, description: 'Numeric ID' };
      await expect(
        eventLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          EVENT_TYPE_NAME
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
    });

    it('Failure: Cannot extract base ID (e.g., only colon)', async () => {
      const fetchedData = { id: ':', description: 'Just a colon' };
      await expect(
        eventLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          EVENT_TYPE_NAME
        )
      ).rejects.toThrow(
        `Could not extract base ID from ':' in ${filename}. Invalid format.`
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(storeItemInRegistrySpy).not.toHaveBeenCalled();
    });
  });
});
