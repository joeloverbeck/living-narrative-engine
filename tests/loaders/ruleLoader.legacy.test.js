// src/tests/core/loaders/ruleLoader.legacy.test.js

// --- Imports ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals'; // Assuming Jest environment
import path from 'path'; // Import path for basename extraction in test assertion
import RuleLoader from '../../src/loaders/ruleLoader.js'; // Adjust path as necessary
// Assuming interfaces are defined correctly for type hints/JSDoc
/**
 * @typedef {import('../../src/interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../src/interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../src/interfaces/coreServices.js').ModManifest} ModManifest
 */

// --- Mock Service Factories (Copied from ruleLoader.test.js for consistency) ---

/**
 * Creates a mock IConfiguration service.
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
  getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (typeName === 'rules') {
      return 'http://example.com/schemas/rule.schema.json';
    }
    if (typeName === 'components') {
      return 'http://example.com/schemas/component-definition.schema.json';
    }
    return `http://example.com/schemas/${typeName}.schema.json`; // Generic fallback
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModsBasePath: jest.fn().mockReturnValue('mods'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getRuleBasePath: jest.fn().mockReturnValue('rules'), // Relevant for RuleLoader
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {IPathResolver} Mocked path resolver service.
 */
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
  resolveManifestPath: jest.fn(
    (worldName) => `./data/worlds/${worldName}.world.json`
  ),
  ...overrides,
});

/**
 * Creates a mock IDataFetcher service.
 * Allows specific path responses and error paths.
 * @param {object} [pathToResponse] - Map of path strings to successful response data (will be deep cloned).
 * @param {string[]} [errorPaths] - List of paths that should trigger a rejection.
 * @returns {IDataFetcher & { mockSuccess: Function, mockFailure: Function, _getPaths: Function }} Mocked data fetcher service.
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => {
  // Keep internal copies for manipulation via helpers
  let _pathToResponse = { ...pathToResponse };
  let _errorPaths = [...errorPaths];

  const fetcher = {
    fetch: jest.fn(async (path) => {
      if (_errorPaths.includes(path)) {
        return Promise.reject(
          new Error(`Mock Fetch Error: Failed to fetch ${path}`)
        );
      }
      if (Object.prototype.hasOwnProperty.call(_pathToResponse, path)) {
        try {
          // Ensure we return a fresh copy each time to mimic real fetching
          return Promise.resolve(
            JSON.parse(JSON.stringify(_pathToResponse[path]))
          );
        } catch (e) {
          return Promise.reject(
            new Error(
              `Mock Fetcher Error: Could not clone mock data for path ${path}. Is it valid JSON?`
            )
          );
        }
      }
      return Promise.reject(
        new Error(`Mock Fetch Error: 404 Not Found for path ${path}`)
      );
    }),
    // Helper to easily add successful responses mid-test
    mockSuccess: function (path, responseData) {
      _pathToResponse[path] = responseData; // Store original, clone on fetch
      _errorPaths = _errorPaths.filter((p) => p !== path);
    },
    // Helper to easily add error responses mid-test
    mockFailure: function (
      path,
      errorMessage = `Mock Fetch Error: Failed to fetch ${path}`
    ) {
      if (!_errorPaths.includes(path)) {
        _errorPaths.push(path);
      }
      if (Object.prototype.hasOwnProperty.call(_pathToResponse, path)) {
        delete _pathToResponse[path];
      }
    },
    // Helper to see configured paths
    _getPaths: () => ({
      success: Object.keys(_pathToResponse),
      error: _errorPaths,
    }),
  };
  return fetcher;
};

/**
 * Creates a mock ISchemaValidator service with helpers for configuration.
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {ISchemaValidator & {_setSchemaLoaded: Function, mockValidatorFunction: Function, resetValidatorFunction: Function}} Mocked schema validator service with test helpers.
 */
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map(); // Map<schemaId, schemaData>
  const schemaValidators = new Map(); // Map<schemaId, jest.Mock>

  const mockValidator = {
    addSchema: jest.fn(async (schemaData, schemaId) => {
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    }),
    removeSchema: jest.fn((schemaId) => {
      const deletedSchemas = loadedSchemas.delete(schemaId);
      const deletedValidators = schemaValidators.delete(schemaId);
      return deletedSchemas || deletedValidators;
    }),
    isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
    getValidator: jest.fn((schemaId) => {
      if (loadedSchemas.has(schemaId) && !schemaValidators.has(schemaId)) {
        // Lazy initialization of default validator if schema loaded but no specific mock set
        const defaultValidFn = jest.fn(() => ({ isValid: true, errors: null }));
        schemaValidators.set(schemaId, defaultValidFn);
        return defaultValidFn;
      }
      return schemaValidators.get(schemaId);
    }),
    validate: jest.fn((schemaId, data) => {
      const validatorFn = schemaValidators.get(schemaId);
      if (!loadedSchemas.has(schemaId)) {
        return {
          isValid: false,
          errors: [
            { message: `Mock Schema Error: Schema '${schemaId}' not found.` },
          ],
        };
      }
      if (validatorFn) {
        return validatorFn(data); // Call the mock function
      }
      // Default pass if schema loaded but no specific validator function mock set
      return { isValid: true, errors: null };
    }),
    // Test Helper: Directly mark a schema as loaded
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        // Ensure a default validator mock exists if setting schema loaded directly
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    },
    // Test Helper: Mock the validation function for a specific schema
    mockValidatorFunction: (schemaId, implementation) => {
      if (typeof implementation !== 'function') {
        throw new Error(
          'mockValidatorFunction requires a function as the implementation.'
        );
      }
      const mockFn = jest.fn(implementation);
      schemaValidators.set(schemaId, mockFn);
      // Ensure schema is marked as loaded when setting a validator
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, {});
      }
      return mockFn;
    },
    // Test Helper: Reset a validator function to the default pass behavior
    resetValidatorFunction: (schemaId) => {
      const defaultPassFn = jest.fn(() => ({ isValid: true, errors: null }));
      schemaValidators.set(schemaId, defaultPassFn);
      // Ensure schema is marked as loaded when resetting
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, {});
      }
    },
    // --- Base class constructor requires these ---
    getModsBasePath: jest.fn().mockReturnValue('mods'), // Add any missing methods required by base
    ...overrides,
  };
  return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {IDataRegistry & { _getRawStore: Function }} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
  const registryStore = {};

  return {
    store: jest.fn((type, id, data) => {
      if (!registryStore[type]) {
        registryStore[type] = {};
      }
      try {
        // Store a deep clone to prevent test side effects from mutations after storing
        registryStore[type][id] = JSON.parse(JSON.stringify(data));
      } catch (e) {
        console.error(
          `MockDataRegistry Error: Could not clone data for ${type}/${id}.`,
          data
        );
        throw e;
      }
    }),
    get: jest.fn((type, id) => {
      const item = registryStore[type]?.[id];
      try {
        // Return a deep clone to prevent test side effects from mutations after getting
        return item ? JSON.parse(JSON.stringify(item)) : undefined;
      } catch (e) {
        console.error(
          `MockDataRegistry Error: Could not clone retrieved data for ${type}/${id}.`,
          item
        );
        return undefined;
      }
    }),
    getAll: jest.fn((type) => {
      const typeData = registryStore[type];
      if (!typeData) return [];
      try {
        return Object.values(typeData).map((item) =>
          JSON.parse(JSON.stringify(item))
        );
      } catch (e) {
        console.error(
          `MockDataRegistry Error: Could not clone retrieved data for getAll(${type}).`,
          typeData
        );
        return [];
      }
    }),
    getAllSystemRules: jest.fn(() => {
      const rules = registryStore['rules'];
      if (!rules) return [];
      try {
        return Object.values(rules).map((item) =>
          JSON.parse(JSON.stringify(item))
        );
      } catch (e) {
        console.error(
          `MockDataRegistry Error: Could not clone retrieved data for getAllSystemRules.`,
          rules
        );
        return [];
      }
    }),
    clear: jest.fn(() => {
      Object.keys(registryStore).forEach((key) => delete registryStore[key]);
    }),
    getManifest: jest.fn().mockReturnValue(null),
    setManifest: jest.fn(),
    getComponentDefinition: jest.fn(),
    ...overrides,
    _getRawStore: () => registryStore, // Helper to inspect internal state if needed
  };
};

/**
 * Creates a mock ILogger service.
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

// --- Test Suite ---

describe('RuleLoader (Sub-Ticket 4.2: Verify Absence of Legacy Discovery)', () => {
  // --- Mocks & Loader Instance ---
  /** @type {IConfiguration} */
  let mockConfig;
  /** @type {IPathResolver} */
  let mockResolver;
  /** @type {IDataFetcher & { mockSuccess: Function, mockFailure: Function, _getPaths: Function }} */
  let mockFetcher;
  /** @type {ISchemaValidator & { _setSchemaLoaded: Function, mockValidatorFunction: Function, resetValidatorFunction: Function }} */
  let mockValidator;
  /** @type {IDataRegistry & { _getRawStore: Function }} */
  let mockRegistry;
  /** @type {ILogger} */
  let mockLogger;
  /** @type {RuleLoader} */
  let loader;

  // --- Shared Test Data ---
  const modId = 'legacy-test-mod';
  // *** Define constants for RuleLoader specific args ***
  const RULE_CONTENT_KEY = 'rules';
  const RULE_CONTENT_DIR = 'rules';
  const RULE_TYPE_NAME = 'rules';

  const defaultRuleSchemaId = 'http://example.com/schemas/rule.schema.json';

  // Example rule content for tests that need valid data
  const validRuleData = {
    rule_id: 'valid_rule', // Base ID (un-prefixed)
    event_type: 'core:test_event',
    actions: [{ type: 'LOG', parameters: { message: 'Test rule executed' } }],
  };
  // Expected final ID after RuleLoader prefixes it
  const expectedStoredRuleId = `${modId}:${validRuleData.rule_id}`;

  // --- Setup ---
  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher(); // Includes helpers
    mockValidator = createMockSchemaValidator(); // Includes helpers
    mockRegistry = createMockDataRegistry(); // Includes helpers
    mockLogger = createMockLogger();

    // Default config for rule schema ID via base class method
    mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
      typeName === RULE_TYPE_NAME ? defaultRuleSchemaId : undefined
    );
    // Also mock specific getter if RuleLoader uses it
    mockConfig.getRuleSchemaId.mockReturnValue(defaultRuleSchemaId);

    // Default setup: rule schema is loaded and validates successfully
    mockValidator._setSchemaLoaded(defaultRuleSchemaId, {});
    mockValidator.resetValidatorFunction(defaultRuleSchemaId);

    loader = new RuleLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );
  });

  // --- Tests ---

  it('should load zero rules and not fetch or store anything if manifest has no "content" field', async () => {
    /** @type {ModManifest} */
    const manifestWithoutContent = {
      id: modId,
      version: '1.0.0',
      name: 'Mod Without Content Field',
      // No 'content' field at all
    };

    // --- Action ---
    // *** UPDATED: Call loadItemsForMod ***
    // *** CHANGED: Capture result object instead of just count ***
    const result = await loader.loadItemsForMod(
      modId,
      manifestWithoutContent,
      RULE_CONTENT_KEY,
      RULE_CONTENT_DIR,
      RULE_TYPE_NAME
    );

    // --- Assert ---
    // *** CHANGED: Assert result.count ***
    expect(result.count).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.overrides).toBe(0);

    // Verify initial INFO log from base class
    expect(mockLogger.info).toHaveBeenCalledWith(
      `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
    );

    // Verify debug log about missing content key (from base class)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${RULE_CONTENT_KEY}' not found or is null/undefined in manifest. Skipping.`
    );
    // Verify debug log about empty list (from base class)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `No valid ${RULE_CONTENT_KEY} filenames found for mod ${modId}.`
    );

    // Verify no attempt to fetch or resolve paths
    expect(mockFetcher.fetch).not.toHaveBeenCalled();
    expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
    expect(mockRegistry.store).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    // Ensure final summary log NOT called (because count is 0)
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining(`Mod [${modId}] - Processed`)
    );
  });

  it('should load zero rules and not fetch or store anything if manifest content has no "rules" field', async () => {
    /** @type {ModManifest} */
    const manifestWithoutRules = {
      id: modId,
      version: '1.0.0',
      name: 'Mod Without Rules Field',
      content: {
        components: ['comp.json'], // 'rules' field is missing
      },
    };

    // --- Action ---
    // *** UPDATED: Call loadItemsForMod ***
    // *** CHANGED: Capture result object instead of just count ***
    const result = await loader.loadItemsForMod(
      modId,
      manifestWithoutRules,
      RULE_CONTENT_KEY,
      RULE_CONTENT_DIR,
      RULE_TYPE_NAME
    );

    // --- Assert ---
    // *** CHANGED: Assert result.count ***
    expect(result.count).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.overrides).toBe(0);

    // Verify initial INFO log
    expect(mockLogger.info).toHaveBeenCalledWith(
      `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
    );
    // Verify debug log about missing content key
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Mod '${modId}': Content key '${RULE_CONTENT_KEY}' not found or is null/undefined in manifest. Skipping.`
    );
    // Verify debug log about empty list
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `No valid ${RULE_CONTENT_KEY} filenames found for mod ${modId}.`
    );

    expect(mockFetcher.fetch).not.toHaveBeenCalled();
    expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
    expect(mockRegistry.store).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    // Ensure final summary log NOT called (because count is 0)
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining(`Mod [${modId}] - Processed`)
    );
  });

  it('should load zero rules and not fetch or store anything if "content.rules" is empty', async () => {
    /** @type {ModManifest} */
    const manifestWithEmptyRules = {
      id: modId,
      version: '1.0.0',
      name: 'Mod With Empty Rules Array',
      content: {
        // Use constant for key
        [RULE_CONTENT_KEY]: [], // Explicitly empty array
      },
    };

    // --- Action ---
    // *** UPDATED: Call loadItemsForMod ***
    // *** CHANGED: Capture result object instead of just count ***
    const result = await loader.loadItemsForMod(
      modId,
      manifestWithEmptyRules,
      RULE_CONTENT_KEY,
      RULE_CONTENT_DIR,
      RULE_TYPE_NAME
    );

    // --- Assert ---
    // *** CHANGED: Assert result.count ***
    expect(result.count).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.overrides).toBe(0);

    // Verify initial INFO log
    expect(mockLogger.info).toHaveBeenCalledWith(
      `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
    );
    // Verify the debug log indicating no valid filenames found (from base class)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `No valid ${RULE_CONTENT_KEY} filenames found for mod ${modId}.`
    );

    // Verify no fetches or stores happened
    expect(mockFetcher.fetch).not.toHaveBeenCalled();
    expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
    expect(mockRegistry.store).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    // Ensure final summary log NOT called (because count is 0)
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining(`Mod [${modId}] - Processed`)
    );
  });

  it('should not attempt legacy discovery even if potential legacy files exist conceptually', async () => {
    const ruleFilenameRelative = 'actual_rule.json'; // The relative path in the manifest

    // Define potential legacy paths that *should not* be fetched
    const legacyIndexPath = `./data/mods/${modId}/${RULE_CONTENT_DIR}/rulesIndex.json`; // Example legacy index
    const legacyDirPath = `./data/mods/${modId}/${RULE_CONTENT_DIR}/`;

    // Use the valid rule data defined earlier
    const currentValidRuleData = validRuleData; // rule_id: "valid_rule"
    const currentExpectedStoredRuleId = expectedStoredRuleId; // "legacy-test-mod:valid_rule"

    // Define the path the loader *should* resolve and fetch
    const expectedResolvedPath = `./data/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFilenameRelative}`;

    /** @type {ModManifest} */
    const manifestWithRule = {
      id: modId,
      version: '1.0.0',
      name: 'Mod With One Rule',
      content: {
        // Use constant for key
        [RULE_CONTENT_KEY]: [ruleFilenameRelative],
      },
    };

    // --- Arrange Mocks ---
    mockFetcher.mockSuccess(expectedResolvedPath, currentValidRuleData);
    mockResolver.resolveModContentPath.mockImplementation(
      (mId, typeName, file) => {
        if (
          mId === modId &&
          typeName === RULE_CONTENT_DIR &&
          file === ruleFilenameRelative
        ) {
          return expectedResolvedPath;
        }
        throw new Error(
          `Unexpected resolveModContentPath call: ${mId}, ${typeName}, ${file}`
        );
      }
    );
    mockValidator.resetValidatorFunction(defaultRuleSchemaId);
    mockValidator._setSchemaLoaded(defaultRuleSchemaId);

    // Make fetcher aware of legacy paths, but expect them *not* to be called.
    mockFetcher.mockSuccess(legacyIndexPath, {
      message: 'This is legacy index, should not be fetched!',
    });

    // --- Action ---
    // *** UPDATED: Call loadItemsForMod ***
    // *** CHANGED: Capture result object instead of just count ***
    const result = await loader.loadItemsForMod(
      modId,
      manifestWithRule,
      RULE_CONTENT_KEY,
      RULE_CONTENT_DIR,
      RULE_TYPE_NAME
    );

    // --- Assert ---
    // *** CHANGED: Assert result.count ***
    expect(result.count).toBe(1); // Expect one rule to be loaded successfully
    expect(result.errors).toBe(0);
    expect(result.overrides).toBe(0);

    // Verify ONLY the manifest-derived path was resolved and fetched
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      modId,
      RULE_CONTENT_DIR,
      ruleFilenameRelative
    );

    expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
    expect(mockFetcher.fetch).toHaveBeenCalledWith(expectedResolvedPath);

    // CRITICAL: Verify legacy paths were NOT fetched
    expect(mockFetcher.fetch).not.toHaveBeenCalledWith(legacyIndexPath);
    expect(mockFetcher.fetch).not.toHaveBeenCalledWith(legacyDirPath);

    // Verify rule was stored with the correctly prefixed ID
    expect(mockRegistry.store).toHaveBeenCalledTimes(1);
    expect(mockRegistry.store).toHaveBeenCalledWith(
      RULE_TYPE_NAME,
      currentExpectedStoredRuleId, // Expect "legacy-test-mod:valid_rule"
      expect.objectContaining(currentValidRuleData) // Check data structure
    );

    // Verify relevant logging occurred
    expect(mockLogger.info).toHaveBeenCalledWith(
      `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
    );
    // Verify final summary log IS called (because count > 0)
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 1/1 ${RULE_CONTENT_KEY} items.`
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
