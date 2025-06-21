// src/tests/loaders/ruleLoader.pathResolution.test.js

// --- Imports ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import path from 'path'; // Needed for basename generation in mock fetcher
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
 * @typedef {import('../../../src/interfaces/coreServices.js').LoadItemsResult} LoadItemsResult // Import the return type
 */

// --- Mock Service Factories (CORRECTED to be complete) ---

/**
 * Mocks IConfiguration - Needs all methods required by BaseManifestItemLoader
 *
 * @param overrides
 */
const createMockConfiguration = (overrides = {}) => ({
  // --- Methods required by BaseManifestItemLoader constructor ---
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'), // Added
  getContentTypeSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  // --- Other potentially used methods (good practice to include) ---
  getContentBasePath: jest.fn((registryKey) => `./data/mods/test-mod/${registryKey}`),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getRuleBasePath: jest.fn().mockReturnValue('rules'), // Keep specific getter if RuleLoader uses it directly
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'), // Keep specific getter
  ...overrides,
});

/**
 * Mocks IPathResolver - focus on resolveModContentPath
 *
 * @param overrides
 */
const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, registryKey, filename) =>
      `/path/to/mods/${modId}/${registryKey}/${filename}`
  ), // Default mock implementation
  // Mock other methods required by Base constructor or other logic
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

/** Mocks IDataFetcher - focus on fetch */
const createMockDataFetcher = () => ({
  fetch: jest.fn().mockImplementation(async (filePath) => {
    // Simpler mock for path resolution tests, just return valid structure
    return Promise.resolve({
      event_type: 'core:dummy_event',
      actions: [
        { type: 'LOG', parameters: { message: `Loaded from ${filePath}` } },
      ],
    });
  }),
});

/** Mocks ISchemaValidator - needed for successful processing */
const createMockSchemaValidator = () => {
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';
  const mockRuleValidatorFn = jest.fn((data) => ({
    // Simple validation for test purposes
    isValid:
      data &&
      typeof data.event_type === 'string' &&
      Array.isArray(data.actions),
    errors: null,
  }));
  const loadedSchemas = new Map();
  loadedSchemas.set(ruleSchemaId, {}); // Mark as loaded

  return {
    validate: jest.fn().mockImplementation((schemaId, data) => {
      if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId))
        return mockRuleValidatorFn(data);
      return { isValid: true, errors: null }; // Pass other schemas by default
    }),
    getValidator: jest.fn().mockImplementation((schemaId) => {
      if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId))
        return mockRuleValidatorFn;
      return undefined;
    }),
    isSchemaLoaded: jest
      .fn()
      .mockImplementation((schemaId) => loadedSchemas.has(schemaId)), // Use the map
    // --- Methods required by Base constructor ---
    addSchema: jest.fn().mockResolvedValue(undefined), // Mock required methods
    removeSchema: jest.fn().mockReturnValue(true),
    // Expose mock if needed
    _mockValidatorFn: mockRuleValidatorFn,
  };
};

/** Mocks IDataRegistry - needed for successful processing */
const createMockDataRegistry = () => ({
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined), // Default: rule does not exist
  // --- Methods required by Base constructor ---
  getAll: jest.fn(() => []),
  getAllSystemRules: jest.fn().mockReturnValue([]), // Keep specific getter if RuleLoader uses it
  clear: jest.fn(),
  getManifest: jest.fn().mockReturnValue(null),
  setManifest: jest.fn(),
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
 * Mocks ILogger - focus on error
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
describe('RuleLoader (Path Resolution & Fetching via loadItemsForMod)', () => {
  // --- Mocks & Loader Instance ---
  /** @type {IConfiguration} */
  let mockConfig;
  /** @type {IPathResolver} */
  let mockResolver;
  /** @type {IDataFetcher} */
  let mockFetcher;
  /** @type {ISchemaValidator} */
  let mockValidator;
  /** @type {IDataRegistry} */
  let mockRegistry;
  /** @type {ILogger} */
  let mockLogger;
  /** @type {RuleLoader} */
  let loader;

  // --- Shared Test Data ---
  const modId = 'testMod';
  // *** Define constants for RuleLoader specific args ***
  const RULE_CONTENT_KEY = 'rules';
  const RULE_CONTENT_DIR = 'rules'; // Matches RuleLoader implementation detail
  const RULE_TYPE_NAME = 'rules'; // Matches RuleLoader implementation detail

  const ruleFileA = 'ruleA.json';
  const ruleFileB = 'rules/ruleB.json'; // Note the subdirectory
  const ruleNameA = 'ruleA'; // Base name for ID
  const ruleNameB = 'ruleB'; // Base name for ID
  const manifest = {
    id: modId,
    version: '1.0.0',
    name: 'Path Resolution Test Mod',
    content: {
      [RULE_CONTENT_KEY]: [ruleFileA, ruleFileB], // Use constant
    },
  };

  // --- Setup ---
  beforeEach(() => {
    jest.clearAllMocks();

    // Use corrected, complete mock factories
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockLogger = createMockLogger();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();

    // Ensure rule schema ID is configured via the base class method access
    const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';
    mockConfig.getContentTypeSchemaId.mockImplementation(
      (registryKey) => (registryKey === RULE_TYPE_NAME ? ruleSchemaId : undefined) // Use constant
    );
    // RuleLoader might still call getRuleSchemaId directly, keep this mock
    mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

    loader = new RuleLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );
  });

  // --- Cleanup ---
  // No afterEach needed with jest.clearAllMocks() in beforeEach

  // --- Test Cases ---

  describe('Successful Path Resolution', () => {
    it('should call IPathResolver.resolveModContentPath for each rule and attempt to fetch the resolved paths', async () => {
      // --- Arrange ---
      // Expected paths based on mocked resolver and RULE_CONTENT_DIR
      const resolvedPathA = `/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFileA}`;
      const resolvedPathB = `/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFileB}`;

      mockResolver.resolveModContentPath.mockImplementation(
        (mId, type, file) => {
          if (mId === modId && type === RULE_CONTENT_DIR && file === ruleFileA)
            return resolvedPathA;
          if (mId === modId && type === RULE_CONTENT_DIR && file === ruleFileB)
            return resolvedPathB;
          throw new Error(
            `Unexpected resolveModContentPath call: ${mId}, ${type}, ${file}`
          );
        }
      );

      const dataA = { event_type: 'core:eventA', actions: [] };
      const dataB = { event_type: 'core:eventB', actions: [] };
      mockFetcher.fetch.mockImplementation(async (filePath) => {
        if (filePath === resolvedPathA) return Promise.resolve(dataA);
        if (filePath === resolvedPathB) return Promise.resolve(dataB);
        return Promise.reject(
          new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`)
        );
      });

      // --- Action ---
      // *** UPDATED: Capture the result object ***
      /** @type {LoadItemsResult} */
      const result = await loader.loadItemsForMod(
        modId,
        manifest,
        RULE_CONTENT_KEY,
        RULE_CONTENT_DIR,
        RULE_TYPE_NAME
      );

      // --- Assert ---
      // *** UPDATED: Assert properties of the result object ***
      expect(result.count).toBe(2); // Check the count property
      expect(result.errors).toBe(0); // Expect no errors
      expect(result.overrides).toBe(0); // Expect no overrides in this basic case

      expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
      // Arguments passed to resolveModContentPath by _processFileWrapper
      expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(
        1,
        modId,
        RULE_CONTENT_DIR,
        ruleFileA
      );
      expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(
        2,
        modId,
        RULE_CONTENT_DIR,
        ruleFileB
      );

      expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathA);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathB);

      expect(mockRegistry.store).toHaveBeenCalledTimes(2);
      // RuleLoader's _processFetchedItem calls _storeItemInRegistry
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        `${modId}:${ruleNameA}`, // Derived ID
        expect.objectContaining({
          id: ruleNameA, // BASE ID
          _fullId: `${modId}:${ruleNameA}`, // QUALIFIED ID
          modId: modId,
          _sourceFile: ruleFileA,
          event_type: 'core:eventA', // From dataA
          actions: [], // From dataA
        })
      );
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        `${modId}:${ruleNameB}`, // Derived ID
        expect.objectContaining({
          id: ruleNameB, // BASE ID
          _fullId: `${modId}:${ruleNameB}`, // QUALIFIED ID
          modId: modId,
          _sourceFile: ruleFileB,
          event_type: 'core:eventB', // From dataB
          actions: [], // From dataB
        })
      );

      expect(mockLogger.error).not.toHaveBeenCalled();
      // Check initial summary log from loadItemsForMod
      expect(mockLogger.info).toHaveBeenCalledWith(
        `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
      );
      // Check final summary log from _loadItemsInternal
      expect(mockLogger.info).toHaveBeenCalledWith(
        // Base class logs the contentKey in the summary message
        `Mod [${modId}] - Processed 2/2 ${RULE_CONTENT_KEY} items.`
      );
    });
  });

  describe('Path Resolution Failure', () => {
    const resolutionError = new Error('Path resolution failed miserably');

    it('should catch errors from resolveModContentPath, log them, and process other files', async () => {
      // --- Arrange ---
      // Fail resolution for ruleFileB
      mockResolver.resolveModContentPath.mockImplementation(
        (mod, type, file) => {
          if (file === ruleFileB) throw resolutionError;
          return `/path/to/mods/${mod}/${RULE_CONTENT_DIR}/${file}`; // Use RULE_CONTENT_DIR
        }
      );

      const resolvedPathA = `/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFileA}`;

      // --- Act ---
      const result = await loader.loadItemsForMod(
        modId,
        manifest,
        RULE_CONTENT_KEY,
        RULE_CONTENT_DIR,
        RULE_TYPE_NAME
      );

      // --- Assert ---
      // 1. Path resolution called for both
      expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);

      // 2. Fetching called only for rule A
      expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathA);

      // 3. Error logged for rule B
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing file:', // Log from BaseManifestItemLoader._processFileWrapper
        expect.objectContaining({
          modId: modId,
          filename: 'rules/ruleB.json',
          path: 'Path not resolved',
          registryKey: 'rules',
          error: 'Path resolution failed miserably',
        }),
        resolutionError
      );

      // 4. Verify only rule A was stored
      expect(mockRegistry.store).toHaveBeenCalledTimes(1);
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        `${modId}:${ruleNameA}`, // Derived ID
        expect.objectContaining({
          _fullId: `${modId}:${ruleNameA}`,
          id: ruleNameA,
          modId: modId,
          _sourceFile: ruleFileA,
          event_type: 'core:dummy_event', // Corrected to match general mockFetcher
          actions: [
            {
              type: 'LOG',
              parameters: { message: `Loaded from ${resolvedPathA}` },
            },
          ],
        })
      );

      // 5. Result Summary: Correct counts
      expect(result.count).toBe(1); // Only rule A loaded
      expect(result.errors).toBe(1); // One error for rule B path resolution
      expect(result.overrides).toBe(0);
    });

    it('should process file B if the FIRST resolveModContentPath fails', async () => {
      // --- Arrange ---
      // Fail resolution for ruleFileA
      mockResolver.resolveModContentPath.mockImplementation(
        (mod, type, file) => {
          if (file === ruleFileA) throw resolutionError;
          return `/path/to/mods/${mod}/${RULE_CONTENT_DIR}/${file}`; // Use RULE_CONTENT_DIR
        }
      );
      const resolvedPathB = `/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFileB}`;

      // --- Act ---
      const result = await loader.loadItemsForMod(
        modId,
        manifest,
        RULE_CONTENT_KEY,
        RULE_CONTENT_DIR,
        RULE_TYPE_NAME
      );

      // --- Assert ---
      // 1. Path resolution called for both
      expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);

      // 2. Fetching called only for rule B
      expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathB);

      // 3. Error logged for rule A
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing file:', // Log from BaseManifestItemLoader._processFileWrapper
        expect.objectContaining({
          modId: modId,
          filename: 'ruleA.json',
          path: 'Path not resolved',
          registryKey: 'rules',
          error: 'Path resolution failed miserably',
        }),
        resolutionError
      );

      // 4. Verify only rule B was stored
      expect(mockRegistry.store).toHaveBeenCalledTimes(1);
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        `${modId}:${ruleNameB}`, // Derived ID
        expect.objectContaining({
          _fullId: `${modId}:${ruleNameB}`,
          id: ruleNameB,
          modId: modId,
          _sourceFile: ruleFileB,
          event_type: 'core:dummy_event', // Corrected to match general mockFetcher
          actions: [
            {
              type: 'LOG',
              parameters: { message: `Loaded from ${resolvedPathB}` },
            },
          ],
        })
      );

      // 5. Result Summary: Correct counts
      expect(result.count).toBe(1); // Only rule B loaded
      expect(result.errors).toBe(1); // One error for rule A path resolution
      expect(result.overrides).toBe(0);
    });
  });
});
