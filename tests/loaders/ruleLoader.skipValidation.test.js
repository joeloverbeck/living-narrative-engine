// src/tests/loaders/ruleLoader.skipValidation.test.js

// --- Imports ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path'; // Needed for basename operations
import RuleLoader from '../../src/loaders/ruleLoader.js'; // Adjust path as necessary

// Import interfaces for JSDoc typing
/**
 * @typedef {import('../../src/interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../src/interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../src/interfaces/coreServices.js').ModManifest} ModManifest
 */

// --- Mock Service Factories (Copied for consistency) ---

/**
 * Creates a mock IConfiguration service.
 *
 * @param overrides
 */
const createMockConfiguration = (overrides = {}) => ({
  getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (typeName === 'rules') {
      return 'http://example.com/schemas/rule.schema.json';
    }
    return `http://example.com/schemas/${typeName}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModsBasePath: jest.fn().mockReturnValue('mods'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
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
    (modId, typeName, filename) =>
      `/abs/path/to/mods/${modId}/${typeName}/${filename}`
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

/** Creates a mock IDataFetcher service. */
const createMockDataFetcher = () => ({
  fetch: jest
    .fn()
    .mockRejectedValue(new Error('Mock Fetcher: Path not configured')),
});

/** Creates a mock ISchemaValidator service. */
const createMockSchemaValidator = () => {
  // This mock validator function should NOT be called in this test case
  const mockValidatorFn = jest.fn(() => ({ isValid: true, errors: null }));
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';
  const loadedSchemas = new Map(); // Start with no schemas loaded by default for this test

  return {
    validate: jest.fn().mockImplementation((schemaId, data) => {
      // This should not be called if isSchemaLoaded returns false
      return {
        isValid: false,
        errors: [{ message: 'Validate should not have been called!' }],
      };
    }),
    addSchema: jest.fn().mockResolvedValue(undefined),
    // Default to true, will be overridden in the test
    isSchemaLoaded: jest.fn().mockReturnValue(true), // Default to true, override in test
    // getValidator should NOT be called if isSchemaLoaded is false
    getValidator: jest.fn().mockImplementation((schemaId) => {
      // This should not be called if isSchemaLoaded returns false
      return undefined;
    }),
    // --- Base class constructor requires these ---
    removeSchema: jest.fn().mockReturnValue(true),
    // Expose the internal mock function for assertion (though not used here)
    _mockValidatorFn: mockValidatorFn,
  };
};

/** Creates a mock IDataRegistry service. */
const createMockDataRegistry = () => ({
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined), // Default: rule does not exist
  // --- Base class constructor requires these ---
  getAll: jest.fn(() => []),
  clear: jest.fn(),
  getManifest: jest.fn().mockReturnValue(null),
  setManifest: jest.fn(),
  // --- RuleLoader specific ---
  getAllSystemRules: jest.fn().mockReturnValue([]),
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
describe('RuleLoader - Skip Validation Scenario (via loadItemsForMod)', () => {
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

  // --- Shared Test Data ---
  const modId = 'test-mod-skip-validation';
  // *** Define constants for RuleLoader specific args ***
  const RULE_CONTENT_KEY = 'rules';
  const RULE_CONTENT_DIR = 'rules';
  const RULE_TYPE_NAME = 'rules';
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';

  // --- Shared Setup ---
  beforeEach(() => {
    jest.clearAllMocks();

    // Instantiate mocks
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // Common mock setup, ISchemaLoaded will be overridden in test
    mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
      typeName === RULE_TYPE_NAME ? ruleSchemaId : undefined
    );
    // Mock specific getter if RuleLoader uses it
    mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);
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
  describe('Ticket 4.5.4: Test: Handles Missing Rule Schema Correctly (Skip Validation)', () => {
    // Arrange: Define test data and configuration
    const ruleFile = 'ruleToSkip.json';
    const ruleBasename = 'ruleToSkip'; // Basename used for generated ID
    const resolvedPathSkip = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFile}`;
    const ruleDataSkip = {
      // Minimal valid data, no rule_id needed as it will be generated
      event_type: 'core:test_skip_validation',
      actions: [
        {
          type: 'LOG',
          parameters: { message: 'Rule loaded despite missing schema' },
        },
      ],
    };

    const manifest = {
      id: modId,
      version: '1.0.0',
      name: 'Skip Schema Validation Test Mod',
      content: {
        // Use constant for key
        [RULE_CONTENT_KEY]: [ruleFile],
      },
    };

    it('should skip validation (with warning) but still fetch and store the rule if schema is not loaded', async () => {
      // Arrange: Configure mocks specific to this test case
      mockResolver.resolveModContentPath.mockImplementation(
        (mId, type, file) => {
          if (mId === modId && type === RULE_CONTENT_DIR && file === ruleFile)
            return resolvedPathSkip;
          throw new Error(
            `Unexpected path resolution call: ${mId}, ${type}, ${file}`
          );
        }
      );

      mockFetcher.fetch.mockImplementation(async (filePath) => {
        if (filePath === resolvedPathSkip)
          return Promise.resolve(JSON.parse(JSON.stringify(ruleDataSkip)));
        return Promise.reject(
          new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`)
        );
      });

      // *** Crucial configuration: Schema is NOT loaded ***
      mockValidator.isSchemaLoaded.mockImplementation((schemaIdToCheck) => {
        return schemaIdToCheck !== ruleSchemaId; // Return false only for the rule schema ID
      });

      // Act
      // *** UPDATED: Call loadItemsForMod ***
      const count = await loader.loadItemsForMod(
        modId,
        manifest,
        RULE_CONTENT_KEY,
        RULE_CONTENT_DIR,
        RULE_TYPE_NAME
      );

      // Assert
      // Verify isSchemaLoaded was checked for the rule schema
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(ruleSchemaId);

      // Verify the warning log was called from _processFetchedItem
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `RuleLoader [${modId}]: Rule schema '${ruleSchemaId}' is configured but not loaded. Skipping validation for ${ruleFile}.` // Match exact message
      );

      // Verify fetcher was still called
      expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathSkip);

      // Verify validator was NOT called
      expect(mockValidator.validate).not.toHaveBeenCalled();
      expect(mockValidator.getValidator).not.toHaveBeenCalled();

      // Verify registry store was called
      expect(mockRegistry.store).toHaveBeenCalledTimes(1);

      // Assert call to store with AUGMENTED data
      const expectedStoredRuleId = `${modId}:${ruleBasename}`; // "test-mod-skip-validation:ruleToSkip"
      const expectedStoredData = {
        ...ruleDataSkip, // Original data properties
        id: expectedStoredRuleId, // Augmented with final ID
        modId: modId, // Augmented with mod ID
        _sourceFile: ruleFile, // Augmented with source file
      };

      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME, // Category 'rules'
        expectedStoredRuleId, // Key "test-mod-skip-validation:ruleToSkip"
        expectedStoredData // Expect the AUGMENTED data object
      );

      // Verify return value
      // *** CORRECTED ASSERTION ***
      expect(count.count).toBe(1); // Check the count property of the returned object

      // Verify summary info log
      expect(mockLogger.info).toHaveBeenCalledWith(
        `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.` // Initial log from loadItemsForMod
      );
      // The summary log is likely called from the base class's _loadItemsInternal helper, check its message
      // Assuming the message includes count/total and content key:
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Mod [${modId}] - Processed 1/1 ${RULE_CONTENT_KEY} items.`
        ) // Use stringContaining if exact message varies
      );

      // Verify no errors were logged
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
