// src/tests/loaders/ruleLoader.storeFailure.test.js

// --- Imports ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path'; // Needed for basename operations if IDs are generated from filenames
import RuleLoader from '../../../src/loaders/ruleLoader.js'; // Adjust path as necessary

// Import interfaces for JSDoc typing
/**
 * @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../src/interfaces/coreServices.js').ModManifest} ModManifest
 */

// --- Mock Service Factories (Copied for consistency) ---

/**
 * Creates a mock IConfiguration service.
 *
 * @param overrides
 */
const createMockConfiguration = (overrides = {}) => ({
  // --- Methods required by BaseManifestItemLoader constructor ---
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'rules') {
      return 'http://example.com/schemas/rule.schema.json';
    }
    return `http://example.com/schemas/${registryKey}.schema.json`;
  }),
  // --- Other potentially used methods (good practice to include) ---
  getContentBasePath: jest.fn((registryKey) => `./data/mods/test-mod/${registryKey}`),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
  getRuleBasePath: jest.fn().mockReturnValue('rules'),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 *
 * @param overrides
 */
const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, registryKey, filename) =>
      `/abs/path/to/mods/${modId}/${registryKey}/${filename}`
  ),
  // Mock other methods required by Base constructor or other logic
  resolveContentPath: jest.fn(
    (registryKey, filename) => `./data/${registryKey}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest.fn(
    (modId) => `./data/mods/${modId}/mod-manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
  ...overrides,
});

/** Creates a mock IDataFetcher service. */
const createMockDataFetcher = () => ({
  fetch: jest
    .fn()
    .mockRejectedValue(new Error('Mock Fetcher: Path not configured')),
});

/** Creates a mock ISchemaValidator service. */
const createMockSchemaValidator = () => {
  const mockValidatorFn = jest.fn(() => ({ isValid: true, errors: null }));
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';
  const loadedSchemas = new Map();
  loadedSchemas.set(ruleSchemaId, {}); // Mark schema as loaded

  return {
    validate: jest.fn().mockImplementation((schemaId, data) => {
      if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) {
        return mockValidatorFn(data); // Use mock for rule schema
      }
      return { isValid: true, errors: null }; // Default pass for other schemas
    }),
    addSchema: jest.fn().mockResolvedValue(undefined),
    // --- Base class constructor requires these ---
    removeSchema: jest.fn().mockReturnValue(true),
    isSchemaLoaded: jest
      .fn()
      .mockImplementation((schemaId) => loadedSchemas.has(schemaId)), // Use map
    getValidator: jest.fn().mockImplementation((schemaId) => {
      if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) {
        return mockValidatorFn; // Return mock for rule schema
      }
      return undefined; // No validator for other schemas by default
    }),
    // Expose the internal mock function for configuration/assertion
    _mockValidatorFn: mockValidatorFn,
  };
};

/** Creates a mock IDataRegistry service. */
const createMockDataRegistry = () => ({
  store: jest.fn(), // Default store does nothing (success)
  get: jest.fn().mockReturnValue(undefined), // Default: rule does not exist
  // --- Methods required by Base constructor ---
  getAll: jest.fn(() => []),
  clear: jest.fn(),
  getManifest: jest.fn().mockReturnValue(null),
  setManifest: jest.fn(),
  // --- RuleLoader specific ---
  getAllSystemRules: jest.fn().mockReturnValue([]),
  // Add specific getters if needed by other parts, defaulting to undefined
  getEntityDefinition: jest.fn().mockReturnValue(undefined),
  getItemDefinition: jest.fn().mockReturnValue(undefined),
  getLocationDefinition: jest.fn().mockReturnValue(undefined),
  getConnectionDefinition: jest.fn().mockReturnValue(undefined),
  getBlockerDefinition: jest.fn().mockReturnValue(undefined),
  getActionDefinition: jest.fn().mockReturnValue(undefined),
  getEventDefinition: jest.fn().mockReturnValue(undefined),
  getComponentDefinition: jest.fn().mockReturnValue(undefined),
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
});

/**
 * Creates a mock ILogger service.
 *
 * @param overrides
 */
const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

// --- Test Suite ---

// *** UPDATED describe block title slightly ***
describe('RuleLoader - Storage Failure Handling (via loadItemsForMod)', () => {
  // --- Mocks & Loader Instance ---
  /** @type {IConfiguration} */
  let mockConfig;
  /** @type {IPathResolver} */
  let mockResolver;
  /** @type {IDataFetcher} */
  let mockFetcher;
  /** @type {ISchemaValidator & { _mockValidatorFn: jest.Mock }} */
  let mockValidator;
  /** @type {IDataRegistry} */
  let mockRegistry;
  /** @type {ILogger} */
  let mockLogger;
  /** @type {RuleLoader} */
  let loader;
  /** @type {jest.Mock} */
  let mockRuleValidatorFn; // Reference to the mock validator function

  // --- Shared Test Data ---
  const modId = 'test-mod-store-fail';
  // *** Define constants for RuleLoader specific args ***
  const RULE_CONTENT_KEY = 'rules';
  const RULE_CONTENT_DIR = 'rules';
  const RULE_TYPE_NAME = 'rules';
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';

  // --- Shared Setup ---
  beforeEach(() => {
    jest.clearAllMocks();

    // Instantiate mocks using complete factories
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();
    mockRuleValidatorFn = mockValidator._mockValidatorFn; // Get reference

    // Ensure rule schema ID is configured via base method
    mockConfig.getContentTypeSchemaId.mockImplementation((registryKey) =>
      registryKey === RULE_TYPE_NAME ? ruleSchemaId : undefined
    );
    // Mock specific getter if RuleLoader uses it
    mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

    // Reset common mocks
    mockRuleValidatorFn.mockImplementation(() => ({
      isValid: true,
      errors: null,
    })); // Corrected default pass
    mockRegistry.get.mockReturnValue(undefined); // Default: no rule exists yet

    // Instantiate the loader
    loader = new RuleLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );
  });

  // --- Test Cases ---
  // *** UPDATED describe block title slightly ***
  describe('Ticket 4.5.6: Test: Handles IDataRegistry Storage Failure Gracefully', () => {
    // Arrange: Define test data and configuration
    const ruleFileOK = 'ruleOK.json';
    const ruleFileFailStore = 'ruleFailStore.json';
    const resolvedPathOK = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFileOK}`;
    const resolvedPathFailStore = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFileFailStore}`;

    const ruleDataOK = {
      rule_id: 'ruleOK_id', // Explicit ID
      event_type: 'core:eventOK',
      actions: [{ type: 'LOG', parameters: { message: 'Rule OK loaded' } }],
    };
    const ruleDataFailStore = {
      rule_id: 'ruleFailStore_id', // Explicit ID
      event_type: 'core:eventFailStore',
      actions: [
        { type: 'LOG', parameters: { message: 'Rule Fail Store loaded' } },
      ],
    };

    const finalIdOK = `${modId}:${ruleDataOK.rule_id}`;
    const finalIdFailStore = `${modId}:${ruleDataFailStore.rule_id}`;
    const storageError = new Error('DB write failed'); // Specific error for storage

    const manifest = {
      id: modId,
      version: '1.0.0',
      name: 'Storage Failure Test Mod',
      content: {
        // Use constant for key
        [RULE_CONTENT_KEY]: [ruleFileOK, ruleFileFailStore], // Process OK then Fail
      },
    };

    it('should log storage errors, count failed rules as unsuccessful, process others, and return correct count', async () => {
      // Arrange: Configure mocks specific to this test case
      mockResolver.resolveModContentPath.mockImplementation(
        (mId, type, file) => {
          if (mId === modId && type === RULE_CONTENT_DIR && file === ruleFileOK)
            return resolvedPathOK;
          if (
            mId === modId &&
            type === RULE_CONTENT_DIR &&
            file === ruleFileFailStore
          )
            return resolvedPathFailStore;
          throw new Error(
            `Unexpected path resolution call: ${mId}, ${type}, ${file}`
          );
        }
      );

      mockFetcher.fetch.mockImplementation(async (filePath) => {
        // Return copies
        if (filePath === resolvedPathOK)
          return Promise.resolve(JSON.parse(JSON.stringify(ruleDataOK)));
        if (filePath === resolvedPathFailStore)
          return Promise.resolve(JSON.parse(JSON.stringify(ruleDataFailStore)));
        return Promise.reject(
          new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`)
        );
      });

      // Configure IDataRegistry.store: Success for OK, Throw for FailStore
      mockRegistry.store.mockImplementation((type, id, data) => {
        if (type === RULE_TYPE_NAME && id === finalIdOK) {
          // Success for the OK rule
          return false; // Return false for no overwrite
        }
        if (type === RULE_TYPE_NAME && id === finalIdFailStore) {
          throw storageError; // Throw the specific error for the fail rule
        }
        // Fail test if unexpected call happens
        throw new Error(`Unexpected store call: ${type}, ${id}`);
      });

      // Act
      const result = await loader.loadItemsForMod(
        modId,
        manifest,
        RULE_CONTENT_KEY,
        RULE_CONTENT_DIR,
        RULE_TYPE_NAME
      );

      // Assert
      // Verify fetcher and validator calls occurred for both
      expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathOK);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathFailStore);
      expect(mockRuleValidatorFn).toHaveBeenCalledTimes(2);
      expect(mockRuleValidatorFn).toHaveBeenCalledWith(
        expect.objectContaining(ruleDataOK)
      );
      expect(mockRuleValidatorFn).toHaveBeenCalledWith(
        expect.objectContaining(ruleDataFailStore)
      );

      // Verify IDataRegistry.store was ATTEMPTED for both rules
      expect(mockRegistry.store).toHaveBeenCalledTimes(2);
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        finalIdOK,
        expect.objectContaining({ _fullId: finalIdOK })
      );
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        finalIdFailStore,
        expect.objectContaining({ _fullId: finalIdFailStore })
      );

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledTimes(1);

      // Verify the single error log from BaseManifestItemLoader._processFileWrapper's catch block
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing file:', // Match the wrapper's log message
        expect.objectContaining({
          modId: modId,
          filename: ruleFileFailStore,
          path: resolvedPathFailStore,
          registryKey: 'rules',
          error: storageError.message, // Logs the error message string
        }),
        storageError // Match the full error object
      );

      // Verify the return value object
      expect(result).toEqual({ count: 1, errors: 1, overrides: 0 });

      // Verify summary and debug logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Mod [${modId}] - Processed 1/2 ${RULE_CONTENT_KEY} items. (1 failed)`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Item '${finalIdOK}' (Base: '${ruleDataOK.rule_id}') stored successfully`
        )
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
