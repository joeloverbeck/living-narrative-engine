// src/tests/loaders/ruleLoader.test.js

// --- Imports ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals'; // Assuming Jest environment
import RuleLoader from '../../../src/loaders/ruleLoader.js'; // Adjust path as necessary
// Import interfaces for JSDoc typing if desired
// import { IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, IDataRegistry, ILogger } from '../../../interfaces/coreServices';

// --- Mock Service Factories (Adapted from ComponentLoader tests) ---

/**
 * Creates a mock IConfiguration service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
  getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
  // Updated to specifically handle 'rules' and return ruleSchemaId
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (typeName === 'rules') {
      // Delegate to getRuleSchemaId or return a fixed value if getRuleSchemaId isn't used directly
      // Assuming RuleLoader might use this OR getRuleSchemaId directly.
      // Let's use a default value here and allow overriding getRuleSchemaId separately.
      return 'http://example.com/schemas/rule.schema.json';
    }
    // Add other types if needed for different loaders tested in the same context potentially
    if (typeName === 'components') {
      return 'http://example.com/schemas/component.schema.json';
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
  // Explicitly mock getRuleSchemaId as RuleLoader might use it
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
 */
const createMockPathResolver = (overrides = {}) => ({
  // resolveModContentPath is the key method needed by loaders iterating mod content
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
  // resolveRulePath might be used if loading non-mod rules, ensure it's mocked
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
  ...overrides,
});

/**
 * Creates a mock IDataFetcher service.
 * Allows specific path responses and error paths.
 *
 * @param {object} [pathToResponse] - Map of path strings to successful response data (will be deep cloned).
 * @param {string[]} [errorPaths] - List of paths that should trigger a rejection.
 * @returns {import('../../../src/interfaces/coreServices.js').IDataFetcher} Mocked data fetcher service.
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
  fetch: jest.fn(async (path) => {
    if (errorPaths.includes(path)) {
      return Promise.reject(
        new Error(`Mock Fetch Error: Failed to fetch ${path}`)
      );
    }
    if (Object.prototype.hasOwnProperty.call(pathToResponse, path)) {
      // Deep clone to prevent tests from modifying the mock response object state
      try {
        return Promise.resolve(
          JSON.parse(JSON.stringify(pathToResponse[path]))
        );
      } catch (e) {
        // Handle cases where mock data isn't valid JSON if needed, though usually it should be
        return Promise.reject(
          new Error(
            `Mock Fetcher Error: Could not clone mock data for path ${path}. Is it valid JSON?`
          )
        );
      }
    }
    // Default behavior if path is not explicitly mocked for success or error
    return Promise.reject(
      new Error(`Mock Fetch Error: 404 Not Found for path ${path}`)
    );
  }),
  // Helper to easily add successful responses mid-test
  mockSuccess: function (path, responseData) {
    // Ensure deep cloning
    pathToResponse[path] = JSON.parse(JSON.stringify(responseData));
    if (errorPaths.includes(path)) {
      errorPaths = errorPaths.filter((p) => p !== path);
    }
    // Re-assign the mock function to capture the updated closures
    this.fetch.mockImplementation(async (p) => {
      if (errorPaths.includes(p))
        return Promise.reject(
          new Error(`Mock Fetch Error: Failed to fetch ${p}`)
        );
      if (Object.prototype.hasOwnProperty.call(pathToResponse, p))
        return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[p])));
      return Promise.reject(
        new Error(`Mock Fetch Error: 404 Not Found for path ${p}`)
      );
    });
  },
  // Helper to easily add error responses mid-test
  mockFailure: function (
    path,
    errorMessage = `Mock Fetch Error: Failed to fetch ${path}`
  ) {
    if (!errorPaths.includes(path)) {
      errorPaths.push(path);
    }
    if (Object.prototype.hasOwnProperty.call(pathToResponse, path)) {
      delete pathToResponse[path];
    }
    // Re-assign the mock function to capture the updated closures
    this.fetch.mockImplementation(async (p) => {
      if (errorPaths.includes(p))
        return Promise.reject(new Error(errorMessage)); // Use provided message
      if (Object.prototype.hasOwnProperty.call(pathToResponse, p))
        return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[p])));
      return Promise.reject(
        new Error(`Mock Fetch Error: 404 Not Found for path ${p}`)
      );
    });
  },
});

/**
 * Creates a mock ISchemaValidator service with helpers for configuration.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').ISchemaValidator & {_setSchemaLoaded: Function, mockValidatorFunction: Function}} Mocked schema validator service with test helpers.
 */
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map(); // Map<schemaId, schemaData>
  const schemaValidators = new Map(); // Map<schemaId, jest.Mock>

  const mockValidator = {
    addSchema: jest.fn(async (schemaData, schemaId) => {
      loadedSchemas.set(schemaId, schemaData);
      // Ensure a mock validator function exists, default to valid
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
      // Optionally: Could add basic schema syntax check here if needed
    }),
    removeSchema: jest.fn((schemaId) => {
      const deletedSchemas = loadedSchemas.delete(schemaId);
      const deletedValidators = schemaValidators.delete(schemaId);
      return deletedSchemas || deletedValidators; // Return true if either was present
    }),
    isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
    getValidator: jest.fn((schemaId) => {
      // Ensure a validator fn exists if schema is considered loaded, avoids undefined return if only _setSchemaLoaded was used
      if (loadedSchemas.has(schemaId) && !schemaValidators.has(schemaId)) {
        const defaultValidFn = jest.fn(() => ({ isValid: true, errors: null }));
        schemaValidators.set(schemaId, defaultValidFn);
        return defaultValidFn;
      }
      return schemaValidators.get(schemaId);
    }),
    validate: jest.fn((schemaId, data) => {
      const validatorFn = schemaValidators.get(schemaId);
      if (!loadedSchemas.has(schemaId)) {
        // Check if schema is even supposed to be loaded
        return {
          isValid: false,
          errors: [
            { message: `Mock Schema Error: Schema '${schemaId}' not found.` },
          ],
        };
      }
      if (validatorFn) {
        return validatorFn(data); // Call the specific mock implementation
      }
      // Should not happen if getValidator ensures fn exists, but as fallback:
      return { isValid: true, errors: null }; // Default to valid if loaded but no specific mock fn found
    }),
    // --- Test Helpers ---
    // Helper to simulate schema loading state for tests
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      loadedSchemas.set(schemaId, schemaData);
      // Ensure a default validator function exists if none was set via mockValidatorFunction
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    },
    // Helper to allow tests to customize validator behavior per schema
    mockValidatorFunction: (schemaId, implementation) => {
      // Ensure implementation is a function
      if (typeof implementation !== 'function') {
        throw new Error(
          'mockValidatorFunction requires a function as the implementation.'
        );
      }
      const mockFn = jest.fn(implementation);
      schemaValidators.set(schemaId, mockFn);
      // Automatically mark schema as loaded if we define its validator
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, {}); // Add placeholder schema data
      }
      return mockFn; // Return the jest mock function for further assertions if needed
    },
    // Helper to reset validator mock function to default pass
    resetValidatorFunction: (schemaId) => {
      if (schemaValidators.has(schemaId)) {
        schemaValidators
          .get(schemaId)
          .mockImplementation(() => ({ isValid: true, errors: null }));
      } else {
        // If it doesn't exist, create the default pass validator
        const defaultPassFn = jest.fn(() => ({ isValid: true, errors: null }));
        schemaValidators.set(schemaId, defaultPassFn);
        // Ensure schema is marked loaded
        if (!loadedSchemas.has(schemaId)) {
          loadedSchemas.set(schemaId, {});
        }
      }
    },
    ...overrides,
  };
  return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IDataRegistry} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
  // Use a simple object to store data by type, then by ID for easier inspection
  const registryStore = {}; // { type: { id: data } }

  return {
    // Store deep copies to prevent test interference
    store: jest.fn((type, id, data) => {
      if (!registryStore[type]) {
        registryStore[type] = {};
      }
      try {
        registryStore[type][id] = JSON.parse(JSON.stringify(data));
      } catch (e) {
        console.error(
          `MockDataRegistry Error: Could not clone data for ${type}/${id}. Is it valid JSON?`,
          data
        );
        throw e; // Rethrow error to fail test
      }
    }),
    // Return deep copies to prevent test interference
    get: jest.fn((type, id) => {
      const item = registryStore[type]?.[id];
      try {
        return item ? JSON.parse(JSON.stringify(item)) : undefined;
      } catch (e) {
        console.error(
          `MockDataRegistry Error: Could not clone retrieved data for ${type}/${id}.`,
          item
        );
        return undefined; // Or rethrow depending on desired strictness
      }
    }),
    getAll: jest.fn((type) => {
      const typeData = registryStore[type];
      if (!typeData) return [];
      try {
        // Return deep copies
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
    // Specific getter relevant for RuleLoader tests
    getAllSystemRules: jest.fn(() => {
      const rules = registryStore['rules']; // Assuming 'rules' is the type used
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
      // Reset the internal store
      Object.keys(registryStore).forEach((key) => delete registryStore[key]);
    }),
    // --- Include other methods from IDataRegistry interface as needed ---
    getManifest: jest.fn().mockReturnValue(null),
    setManifest: jest.fn((data) => {
      /* Store manifest if needed */
    }),
    // Add specific getters if RuleLoader ever needs them (unlikely)
    getComponentDefinition: jest.fn(),
    // ... etc based on IDataRegistry interface
    ...overrides,
    // Helper for inspecting stored data directly in tests if needed
    _getRawStore: () => registryStore,
  };
};

/**
 * Creates a mock ILogger service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

// --- Test Suite ---

describe('RuleLoader (Sub-Ticket 4.1: Test Setup & Mocking)', () => {
  // --- Declare Mocks & Loader ---
  let mockConfig; //: IConfiguration; // Add type hints if using TypeScript/JSDoc
  let mockResolver; //: IPathResolver;
  let mockFetcher; //: IDataFetcher & { mockSuccess: Function, mockFailure: Function }; // Include helper types
  let mockValidator; //: ISchemaValidator & { _setSchemaLoaded: Function, mockValidatorFunction: Function, resetValidatorFunction: Function }; // Include helper types
  let mockRegistry; //: IDataRegistry & { _getRawStore: Function }; // Include helper types
  let mockLogger; //: ILogger;
  let loader; //: RuleLoader;

  // --- Shared Test Data ---
  const defaultRuleSchemaId = 'http://example.com/schemas/rule.schema.json';
  const modId = 'test-mod';

  // --- Helper Functions for Mock Scenario Setup ---

  /**
   * Sets up the mock fetcher to return specific data for a given path.
   *
   * @param path
   * @param data
   */
  const setupMockFetcherSuccess = (path, data) => {
    mockFetcher.mockSuccess(path, data);
  };

  /**
   * Sets up the mock fetcher to return an error for a given path.
   *
   * @param path
   * @param error
   */
  const setupMockFetcherFailure = (
    path,
    error = new Error(`Mock Fetch Error: Failed to fetch ${path}`)
  ) => {
    // Pass the error message or error object to the helper
    mockFetcher.mockFailure(path, error.message || error);
  };

  /**
   * Sets up the mock validator to return success for the rule schema (or specified schema).
   *
   * @param schemaId
   */
  const setupMockValidatorSuccess = (schemaId = defaultRuleSchemaId) => {
    // Use the reset helper which ensures it passes and schema is marked loaded
    mockValidator.resetValidatorFunction(schemaId);
  };

  /**
   * Sets up the mock validator to return failure with specific errors for the rule schema (or specified schema).
   *
   * @param errors
   * @param schemaId
   */
  const setupMockValidatorFailure = (
    errors,
    schemaId = defaultRuleSchemaId
  ) => {
    if (!Array.isArray(errors)) {
      errors = [{ message: errors }]; // Wrap single error message
    }
    mockValidator.mockValidatorFunction(schemaId, (data) => ({
      isValid: false,
      errors: errors,
    }));
    // Ensure schema is marked loaded even if validation fails
    mockValidator._setSchemaLoaded(schemaId, {});
  };

  // --- Setup (Runs before each test) ---
  beforeEach(() => {
    // Reset mocks for isolation between tests
    jest.clearAllMocks();

    // Instantiate fresh mocks for each test
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher(); // Gets helpers attached
    mockValidator = createMockSchemaValidator(); // Gets helpers attached
    mockRegistry = createMockDataRegistry(); // Gets helpers attached
    mockLogger = createMockLogger();

    // --- Default Mock Configurations ---
    // Ensure the rule schema ID is consistently returned
    mockConfig.getRuleSchemaId.mockReturnValue(defaultRuleSchemaId);
    mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
      if (typeName === 'rules') {
        return defaultRuleSchemaId;
      }
      return undefined; // Or handle other types if necessary
    });

    // Simulate the primary rule schema being 'loaded' successfully by default
    mockValidator._setSchemaLoaded(defaultRuleSchemaId, {
      /* mock schema object if needed */
    });
    // Default validation behavior for the rule schema (passes)
    setupMockValidatorSuccess(defaultRuleSchemaId); // Use helper for consistency

    // Instantiate the RuleLoader with the fresh mocks
    loader = new RuleLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );
  });

  // --- Cleanup (Optional: Runs after each test) ---
  afterEach(() => {
    // jest.clearAllMocks() in beforeEach is usually sufficient.
    // Add any specific cleanup needed beyond mock resetting.
  });

  // --- Test Cases ---

  it('should correctly instantiate RuleLoader with all dependencies mocked', () => {
    expect(loader).toBeDefined();
    expect(loader).toBeInstanceOf(RuleLoader);
    // Verify that the constructor received the mocks (if they are stored on the instance)
    // Example: expect(loader.dependencyInjection).toBe(mockConfig);
    // This depends on the RuleLoader's internal implementation.
  });

  it('should have mocks configured and ready for verification', () => {
    // Check that mock functions exist and are Jest mocks
    expect(jest.isMockFunction(mockConfig.getRuleSchemaId)).toBe(true);
    expect(jest.isMockFunction(mockResolver.resolveModContentPath)).toBe(true);
    expect(jest.isMockFunction(mockFetcher.fetch)).toBe(true);
    expect(jest.isMockFunction(mockValidator.validate)).toBe(true);
    expect(jest.isMockFunction(mockRegistry.store)).toBe(true);
    expect(jest.isMockFunction(mockLogger.info)).toBe(true);

    // Verify mocks haven't been called yet after setup
    expect(mockConfig.getRuleSchemaId).not.toHaveBeenCalled();
    expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
    expect(mockFetcher.fetch).not.toHaveBeenCalled();
    // Note: isSchemaLoaded and getValidator might be called during loader instantiation
    // depending on RuleLoader's constructor logic. Adjust expectations if needed.
    // Example: expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(defaultRuleSchemaId);
    expect(mockValidator.validate).not.toHaveBeenCalled();
    expect(mockRegistry.store).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('mocks should allow configuration per test using helpers', async () => {
    const testPath = `./data/mods/${modId}/system-rules/rule1.json`;
    const testData = {
      rule_id: 'test-rule',
      event_type: 'test-event',
      actions: [],
    };
    const validationErrors = [{ message: 'Invalid condition format' }];

    // Configure mocks for a specific scenario
    setupMockFetcherSuccess(testPath, testData);
    setupMockValidatorFailure(validationErrors, defaultRuleSchemaId);

    // Simulate an action that would trigger these mocks (actual call depends on RuleLoader method)
    // e.g., await loader.loadRulesFromMod(modId, manifestWithRuleFile);

    // Verify the mocks behaved as configured
    // Example verification AFTER the action:
    // expect(mockFetcher.fetch).toHaveBeenCalledWith(testPath);
    // const validationResult = mockValidator.validate(defaultRuleSchemaId, testData);
    // expect(validationResult.isValid).toBe(false);
    // expect(validationResult.errors).toEqual(validationErrors);

    // Example direct check of mock setup:
    await expect(mockFetcher.fetch(testPath)).resolves.toEqual(testData); // Check fetcher setup
    expect(mockValidator.validate(defaultRuleSchemaId, {})).toEqual({
      isValid: false,
      errors: validationErrors,
    }); // Check validator setup
  });

  it('should reset mocks between tests', () => {
    // Call a mock in this test
    mockLogger.info('First test call');
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('First test call');

    // The beforeEach for the *next* test will call jest.clearAllMocks(),
    // ensuring this call doesn't interfere with subsequent tests.
    // We can simulate this by calling clearAllMocks manually if needed,
    // but the test runner handles this automatically.
  });

  // --- Placeholder for Future Tests ---
  // describe('loadRulesFromMod', () => {
  //     // Tests for specific RuleLoader methods will go here,
  //     // utilizing the setup and helper functions.
  //     it('should load a valid rule file successfully', async () => {
  //          // Arrange: use helpers setupMockFetcherSuccess, setupMockValidatorSuccess
  //          // Act: call loader.loadRulesFromMod(...)
  //          // Assert: check mockRegistry.store, mockLogger calls, return value
  //     });
  //
  //     it('should handle fetch errors gracefully', async () => {
  //          // Arrange: use helpers setupMockFetcherFailure
  //          // Act: call loader.loadRulesFromMod(...)
  //          // Assert: check mockLogger.error, return value (e.g., count = 0)
  //     });
  //
  //     it('should handle validation errors gracefully', async () => {
  //          // Arrange: use helpers setupMockFetcherSuccess, setupMockValidatorFailure
  //          // Act: call loader.loadRulesFromMod(...)
  //          // Assert: check mockLogger.error, mockRegistry.store (should not be called), return value
  //     });
  // });
});
