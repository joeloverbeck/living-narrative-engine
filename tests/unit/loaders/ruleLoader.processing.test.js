// src/tests/loaders/ruleLoader.processing.test.js

// --- Imports ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import path from 'path'; // Needed for basename operations
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
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (typeName === 'rules') {
      return 'http://example.com/schemas/rule.schema.json';
    }
    return `http://example.com/schemas/${typeName}.schema.json`;
  }),
  // --- Other potentially used methods (good practice to include) ---
  getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
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
  // Mock other methods required by Base constructor or other logic
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
  // const mockValidatorFn = jest.fn(() => ({isValid: true, errors: null})); // No longer needed for direct assertion
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';
  const loadedSchemas = new Map();
  loadedSchemas.set(ruleSchemaId, {}); // Mark schema as loaded

  return {
    // The primary method called by _validatePrimarySchema
    validate: jest.fn().mockImplementation((schemaId, data) => {
      if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) {
        // Simulate successful validation for the correct schema
        return { isValid: true, errors: null };
      }
      // Simulate success for any other schema ID called unexpectedly, or failure if preferred
      return { isValid: true, errors: null };
    }),
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true), // Added for completeness if Base needs it
    // The other primary method called by _validatePrimarySchema
    isSchemaLoaded: jest
      .fn()
      .mockImplementation((schemaId) => loadedSchemas.has(schemaId)), // Use map
    // getValidator is NOT called by the base class validation logic
    getValidator: jest.fn().mockImplementation((schemaId) => {
      // console.warn("SchemaValidator mock: getValidator was called unexpectedly"); // Optional warning
      return undefined;
    }),
    // --- Base class constructor requires these ---
    // getModsBasePath: jest.fn().mockReturnValue('mods'), // This isn't needed on SchemaValidator
    // Expose the internal mock function for configuration/assertion - NO LONGER NEEDED
    // _mockValidatorFn: mockValidatorFn,
  };
};

/** Creates a mock IDataRegistry service. */
const createMockDataRegistry = () => ({
  store: jest.fn(),
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
describe('RuleLoader (Rule Processing Logic via loadItemsForMod)', () => {
  // --- Mocks & Loader Instance (shared across this sub-ticket suite) ---
  /** @type {IConfiguration} */
  let mockConfig;
  /** @type {IPathResolver} */
  let mockResolver;
  /** @type {IDataFetcher} */
  let mockFetcher;
  /** @type {ISchemaValidator} */ // Removed { _mockValidatorFn: jest.Mock }
  let mockValidator;
  /** @type {IDataRegistry} */
  let mockRegistry;
  /** @type {ILogger} */
  let mockLogger;
  /** @type {RuleLoader} */
  let loader;
  // /** @type {jest.Mock} */ // No longer needed
  // let mockRuleValidatorFn; // Reference to the mock validator function

  // --- Shared Test Data ---
  const modId = 'test-mod-processing';
  // *** Define constants for RuleLoader specific args ***
  const RULE_CONTENT_KEY = 'rules';
  const RULE_CONTENT_DIR = 'rules';
  const RULE_TYPE_NAME = 'rules';
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';

  // --- Shared Setup (run before each test in this suite) ---
  beforeEach(() => {
    jest.clearAllMocks();

    // Arrange: Instantiate and configure mocks using complete factories
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();
    // mockRuleValidatorFn = mockValidator._mockValidatorFn; // No longer needed

    // Ensure rule schema ID is configured via base method
    mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
      typeName === RULE_TYPE_NAME ? ruleSchemaId : undefined
    );
    // Mock specific getter if RuleLoader uses it
    mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

    // Reset common mocks
    // Mocking the behavior of `validate` directly in the factory is sufficient
    // mockRuleValidatorFn.mockImplementation(() => ({isValid: true, errors: null})); // No longer needed
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

  describe('Ticket 4.5.1: Happy Path Rule Processing', () => {
    // --- Test Specific Data ---
    const fileA = 'ruleA.json';
    const fileBRelative = 'subdir/ruleB.json';
    const fileBBasename = 'ruleB'; // Basename without extension for ID fallback
    const resolvedPathA = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${fileA}`;
    const resolvedPathB = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${fileBRelative}`;

    const ruleDataA = {
      rule_id: 'ruleA_id', // Explicit ID
      event_type: 'core:eventA',
      actions: [{ type: 'LOG', parameters: { message: 'Rule A loaded' } }],
    };
    const ruleDataB = {
      // No explicit rule_id
      event_type: 'core:eventB',
      actions: [{ type: 'LOG', parameters: { message: 'Rule B loaded' } }],
    };

    // --- Manifest ---
    const manifest = {
      id: modId,
      version: '1.0.0',
      name: 'Happy Path Test Mod',
      content: {
        // Use constant for key
        [RULE_CONTENT_KEY]: [fileA, `  ${fileBRelative}  `], // Include whitespace
      },
    };

    // --- Expected Augmented Data ---
    // This is what _storeItemInRegistry actually stores
    const expectedStoredDataA = {
      ...ruleDataA, // Original data
      id: ruleDataA.rule_id, // BASE ID
      _fullId: `${modId}:${ruleDataA.rule_id}`, // QUALIFIED ID
      modId: modId, // Added by helper
      _sourceFile: fileA, // Added by helper
    };

    const expectedStoredDataB = {
      ...ruleDataB, // Original data
      id: fileBBasename, // BASE ID (derived from filename)
      _fullId: `${modId}:${fileBBasename}`, // QUALIFIED ID
      modId: modId, // Added by helper
      _sourceFile: fileBRelative.trim(), // Added by helper (uses trimmed filename)
    };

    // --- Test Case ---
    it('should successfully process multiple valid rules from manifest', async () => {
      // Arrange: Configure mocks specific to this test case
      mockResolver.resolveModContentPath.mockImplementation(
        (mId, type, file) => {
          if (mId === modId && type === RULE_CONTENT_DIR && file === fileA)
            return resolvedPathA;
          // Base class trims the filename before resolving
          if (
            mId === modId &&
            type === RULE_CONTENT_DIR &&
            file === fileBRelative.trim()
          )
            return resolvedPathB;
          throw new Error(
            `Unexpected path resolution call: ${mId}, ${type}, ${file}`
          );
        }
      );

      mockFetcher.fetch.mockImplementation(async (filePath) => {
        // Return copies to prevent accidental mutation during processing
        if (filePath === resolvedPathA)
          return Promise.resolve(JSON.parse(JSON.stringify(ruleDataA)));
        if (filePath === resolvedPathB)
          return Promise.resolve(JSON.parse(JSON.stringify(ruleDataB)));
        return Promise.reject(
          new Error(`Mock Fetch Error: 404 Not Found for path ${filePath}`)
        );
      });

      // Act
      // *** UPDATED: Call loadItemsForMod ***
      // 'result' now holds the { count, errors, overrides } object
      const result = await loader.loadItemsForMod(
        modId,
        manifest,
        RULE_CONTENT_KEY,
        RULE_CONTENT_DIR,
        RULE_TYPE_NAME
      );

      // Assert
      // Verify IPathResolver.resolveModContentPath calls
      expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
      expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
        modId,
        RULE_CONTENT_DIR,
        fileA
      );
      expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
        modId,
        RULE_CONTENT_DIR,
        fileBRelative.trim()
      ); // Trimmed filename

      // Verify IDataFetcher.fetch calls
      expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathA);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathB);

      // <<< --- CORRECTED VALIDATOR ASSERTIONS --- >>>
      // Verify ISchemaValidator interactions (isSchemaLoaded is implicitly checked by flow continuing)
      // Check that the main 'validate' method was called correctly
      expect(mockValidator.validate).toHaveBeenCalledTimes(2);
      // Check validate was called with the correct schema ID and the ORIGINAL data
      expect(mockValidator.validate).toHaveBeenCalledWith(
        ruleSchemaId,
        expect.objectContaining(ruleDataA)
      );
      expect(mockValidator.validate).toHaveBeenCalledWith(
        ruleSchemaId,
        expect.objectContaining(ruleDataB)
      );
      // Ensure getValidator was NOT called by the validation flow
      expect(mockValidator.getValidator).not.toHaveBeenCalled();
      // <<< --- END OF CORRECTED ASSERTIONS --- >>>

      // Verify IDataRegistry.store calls with AUGMENTED data
      expect(mockRegistry.store).toHaveBeenCalledTimes(2);
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME, // category
        `${modId}:${ruleDataA.rule_id}`, // finalRegistryKey (modId:baseRuleId)
        expect.objectContaining(expectedStoredDataA) // The augmented data object
      );
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME, // category
        `${modId}:${fileBBasename}`, // finalRegistryKey (modId:baseRuleId derived from filename)
        expect.objectContaining(expectedStoredDataB) // The augmented data object
      );

      // --- !!! CORRECTED ASSERTION !!! ---
      // Verify return value (check properties of the result object)
      expect(result.count).toBe(2); // Check the 'count' property
      expect(result.errors).toBe(0); // Check the 'errors' property
      expect(result.overrides).toBe(0); // Check the 'overrides' property
      // --- !!! END OF CORRECTION !!! ---

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
      );
      // --- !!! CORRECTED LOG ASSERTION !!! ---
      // Check the log message from the *base* class - matches the actual output
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Mod [${modId}] - Processed ${result.count}/${manifest.content[RULE_CONTENT_KEY].length} ${RULE_CONTENT_KEY} items.` // Removed Overrides/Errors part
      );
      // --- !!! END OF CORRECTION !!! ---
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected on happy path
      expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected on happy path
    });

    // --- Test Case for explicit rule_id vs. filename-derived id ---
    it('should correctly derive rule_id if not present, and use explicit rule_id if present', async () => {
      const fileWithId = 'explicitRule.json';
      const fileWithoutId = 'deriveRule.json';
      const deriveRuleBasename = 'deriveRule'; // For ID derivation

      const resolvedPathWithId = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${fileWithId}`;
      const resolvedPathWithoutId = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${fileWithoutId}`;

      const dataWithId = {
        rule_id: 'explicit_id',
        event_type: 'core:event_explicit',
        actions: [],
      };
      const dataWithoutId = {
        event_type: 'core:event_derived',
        actions: [],
      };

      mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
        if (file === fileWithId) return resolvedPathWithId;
        if (file === fileWithoutId) return resolvedPathWithoutId;
        return null;
      });

      mockFetcher.fetch.mockImplementation(async (filePath) => {
        if (filePath === resolvedPathWithId) return dataWithId;
        if (filePath === resolvedPathWithoutId) return dataWithoutId;
        return null;
      });

      const manifest = {
        id: modId,
        name: 'ID Derivation Test',
        version: '1.0.0',
        content: { [RULE_CONTENT_KEY]: [fileWithId, fileWithoutId] },
      };

      await loader.loadItemsForMod(
        modId,
        manifest,
        RULE_CONTENT_KEY,
        RULE_CONTENT_DIR,
        RULE_TYPE_NAME
      );

      const finalExplicitId = `${modId}:${dataWithId.rule_id}`;
      const finalDerivedId = `${modId}:${deriveRuleBasename}`;

      const expectedStoredExplicit = {
        ...dataWithId,
        id: dataWithId.rule_id, // BASE ID
        _fullId: finalExplicitId, // QUALIFIED ID
        modId: modId,
        _sourceFile: fileWithId,
      };
      const expectedStoredDerived = {
        ...dataWithoutId,
        id: deriveRuleBasename, // BASE ID
        _fullId: finalDerivedId, // QUALIFIED ID
        modId: modId,
        _sourceFile: fileWithoutId,
      };

      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        finalExplicitId,
        expect.objectContaining(expectedStoredExplicit)
      );
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        finalDerivedId,
        expect.objectContaining(expectedStoredDerived)
      );
    });
  });

  // --- Add more describe blocks for future tickets (4.5.3, 4.5.4, etc.) here ---
});
