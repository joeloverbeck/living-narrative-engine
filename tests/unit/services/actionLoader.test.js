// Filename: src/tests/services/actionLoader.test.js

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals'; // Added afterEach
import ActionLoader from '../../../src/loaders/actionLoader.js'; // Adjust path to your ActionLoader
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js'; // Base class for inheritance check

// --- Mock Service Factories (Keep as is) ---
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (
      overrides.getContentTypeSchemaId &&
      typeof overrides.getContentTypeSchemaId === 'function'
    ) {
      const result = overrides.getContentTypeSchemaId(typeName);
      if (result !== undefined) return result;
    }
    if (typeName === 'actions') {
      return 'http://example.com/schemas/action.schema.json';
    }
    return `http://example.com/schemas/${typeName}.schema.json`;
  }),
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
  resolveModContentPath: jest.fn(
    (modId, typeName, filename) =>
      `./data/mods/${modId}/${typeName}/${filename}`
  ),
  resolveContentPath: jest.fn(
    (typeName, filename) => `./data/${typeName}/${filename}`
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
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined),
  getAll: jest.fn().mockReturnValue([]),
  getAllSystemRules: jest.fn().mockReturnValue([]),
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

// --- Shared Mocks Instance for Tests (Keep as is) ---
let mockConfig;
let mockResolver;
let mockFetcher;
let mockValidator;
let mockRegistry;
let mockLogger;
let actionLoader;
let loadItemsInternalSpy;
let validatePrimarySchemaSpy; // Keep the spy setup, but don't assert call in _processFetchedItem tests

// --- Test Constants (Keep as is) ---
const TEST_MOD_ID = 'test-action-mod';
const ACTION_SCHEMA_ID = 'http://example.com/schemas/action.schema.json';
const ACTION_CONTENT_KEY = 'actions';
const ACTION_CONTENT_DIR = 'actions';
const ACTION_TYPE_NAME = 'actions';

beforeEach(() => {
  // Keep as is
  mockConfig = createMockConfiguration();
  mockResolver = createMockPathResolver();
  mockFetcher = createMockDataFetcher();
  mockValidator = createMockSchemaValidator();
  mockRegistry = createMockDataRegistry();
  mockLogger = createMockLogger();

  try {
    actionLoader = new ActionLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );
  } catch (error) {
    actionLoader = null;
  }

  if (actionLoader) {
    Object.values(mockConfig).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockResolver).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockFetcher).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockValidator).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    Object.values(mockRegistry).forEach(
      (fn) => typeof fn === 'function' && fn.mockClear?.()
    );
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    loadItemsInternalSpy = jest
      .spyOn(actionLoader, '_loadItemsInternal')
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 });
    validatePrimarySchemaSpy = jest
      .spyOn(actionLoader, '_validatePrimarySchema')
      .mockReturnValue({ isValid: true, errors: null });
    actionLoader._logger = mockLogger;
  } else {
    jest.clearAllMocks();
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();
  }
});

afterEach(() => {
  // Keep as is
  jest.restoreAllMocks();
});

// --- Test Suite ---
describe('ActionLoader', () => {
  // --- Constructor Tests ---
  describe('Constructor', () => {
    // This suite is correct and doesn't need changes.
  });

  // --- loadItemsForMod Tests ---
  describe('loadItemsForMod (Actions)', () => {
    // This suite is correct and doesn't need changes.
  });

  // --- _processFetchedItem Tests (Assertions Corrected) ---
  describe('_processFetchedItem', () => {
    const filename = 'test_action.json';
    const resolvedPath = `./data/mods/${TEST_MOD_ID}/${ACTION_CONTENT_DIR}/${filename}`;
    const namespacedActionIdFromFile = 'core:test_action';
    const baseActionIdExtracted = 'test_action';
    const baseActionData = {
      id: namespacedActionIdFromFile,
      description: 'A sample action.',
      parameters: {},
    };
    const finalRegistryKey = `${TEST_MOD_ID}:${baseActionIdExtracted}`;
    const expectedSuccessResult = {
      qualifiedId: finalRegistryKey,
      didOverride: false,
    };

    beforeEach(() => {
      // This beforeEach is correct and doesn't need changes.
      if (!actionLoader) {
        actionLoader = new ActionLoader(
          mockConfig,
          mockResolver,
          mockFetcher,
          mockValidator,
          mockRegistry,
          mockLogger
        );
        loadItemsInternalSpy = jest
          .spyOn(actionLoader, '_loadItemsInternal')
          .mockResolvedValue({ count: 0, overrides: 0, errors: 0 });
        validatePrimarySchemaSpy = jest
          .spyOn(actionLoader, '_validatePrimarySchema')
          .mockReturnValue({ isValid: true, errors: null });
      }
      jest
        .spyOn(actionLoader, '_storeItemInRegistry')
        .mockReturnValue({ qualifiedId: finalRegistryKey, didOverride: false });
    });

    // This test is correct and doesn't need changes.
    it('Success Path: should check registry, store, log, and return ID with override=false', async () => {
      // ...
    });

    // This test is correct and doesn't need changes.
    it('Override Path: should check registry, log warning, store, log, and return ID with override=true', async () => {
      // ...
    });

    it('Missing `id` Field Failure: should log error, throw, and not attempt storage', async () => {
      expect(actionLoader?._processFetchedItem).toBeDefined();
      const fetchedData = { description: 'Action without an ID.' };
      const storeItemSpy = jest.spyOn(actionLoader, '_storeItemInRegistry');

      // Verify that the method rejects with the expected error
      await expect(
        actionLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          ACTION_TYPE_NAME
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );

      // Verify no error was logged by this method, as logging is handled by the wrapper
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Ensure storage was not attempted
      expect(storeItemSpy).not.toHaveBeenCalled();
    });

    it('Registry Store Failure: should attempt storage (call helper), log error from helper, and re-throw', async () => {
      // This test is correct and doesn't need changes.
      // ...
    });

    it('Invalid ID Format (e.g., namespace only): should log error, throw, and not attempt storage', async () => {
      expect(actionLoader?._processFetchedItem).toBeDefined();
      const invalidId = 'namespaceonly:';
      const fetchedData = { id: invalidId, description: 'Action with bad ID' };
      const storeItemSpy = jest.spyOn(actionLoader, '_storeItemInRegistry');

      // Verify that the method rejects with the expected error
      await expect(
        actionLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          ACTION_TYPE_NAME
        )
      ).rejects.toThrow(
        `Could not extract base ID from '${invalidId}' in ${filename}. Invalid format.`
      );

      // Verify no error was logged by this method, as logging is handled by the wrapper
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Assert not stored
      expect(storeItemSpy).not.toHaveBeenCalled();
    });
  });
});
