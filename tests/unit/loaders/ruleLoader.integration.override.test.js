// src/tests/loaders/ruleLoader.integration.override.test.js

// --- Imports ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import RuleLoader from '../../../src/loaders/ruleLoader.js';
// Use the actual InMemoryDataRegistry for stateful testing
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js'; // Adjust path if necessary

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

// --- Mock Service Factories (Adapted for Integration Test) ---

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
  getContentBasePath: jest.fn(
    (registryKey) => `./data/mods/test-mod/${registryKey}`
  ),
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
  resolveModContentPath: jest.fn((modId, registryKey, filename) => {
    return `/abs/path/to/mods/${modId}/${registryKey}/${filename}`;
  }),
  // Mock other methods required by Base constructor or other logic
  resolveContentPath: jest.fn(
    (registryKey, filename) => `./data/${registryKey}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest.fn(
    (modId) => `/abs/path/to/mods/${modId}/mod-manifest.json`
  ), // Use abs path
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
        return mockValidatorFn(data);
      }
      return { isValid: true, errors: null }; // Default pass
    }),
    // --- Methods required by Base constructor ---
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    isSchemaLoaded: jest
      .fn()
      .mockImplementation((schemaId) => loadedSchemas.has(schemaId)), // Use map
    getValidator: jest.fn().mockImplementation((schemaId) => {
      if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) {
        return mockValidatorFn; // Return the mock validator function
      }
      return undefined;
    }),
    // --- Base class constructor requires these ---
    getModsBasePath: jest.fn().mockReturnValue('mods'),
    _mockValidatorFn: mockValidatorFn, // Expose for potential checks if needed
  };
};

// DataRegistry: Using real InMemoryDataRegistry instance below.

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

// --- Test Suite for Rule Override Integration ---

// *** UPDATED describe block title slightly ***
describe('RuleLoader Integration (Rule Override via loadItemsForMod)', () => {
  // --- Mocks & Loader Instance ---
  /** @type {IConfiguration} */
  let mockConfig;
  /** @type {IPathResolver} */
  let mockResolver;
  /** @type {IDataFetcher} */
  let mockFetcher;
  /** @type {ISchemaValidator & { _mockValidatorFn?: jest.Mock }} */
  let mockValidator;
  /** @type {IDataRegistry} */
  let realRegistry; // Using a real registry instance
  /** @type {ILogger} */
  let mockLogger;
  /** @type {RuleLoader} */
  let loader;

  // --- Test Data ---
  const baseModId = 'BaseMod';
  const overrideModId = 'OverrideMod';
  // *** Define constants for RuleLoader specific args ***
  const RULE_CONTENT_KEY = 'rules';
  const RULE_CONTENT_DIR = 'rules';
  const RULE_TYPE_NAME = 'rules';
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';

  const commonFileName = 'common_rule.json';
  const commonRuleIdInFile = 'common_rule'; // ID inside the JSON data

  // Distinct paths resolved by the mock resolver
  const basePath = `/abs/path/to/mods/${baseModId}/${RULE_CONTENT_DIR}/${commonFileName}`;
  const overridePath = `/abs/path/to/mods/${overrideModId}/${RULE_CONTENT_DIR}/${commonFileName}`;

  // Distinguishable rule data for each mod
  const baseRuleData = {
    rule_id: commonRuleIdInFile,
    event_type: 'base_event',
    actions: [{ type: 'LOG', parameters: { message: 'Base rule action' } }],
  };
  const overrideRuleData = {
    rule_id: commonRuleIdInFile, // Same base ID as baseRuleData
    event_type: 'override_event', // Different content
    actions: [{ type: 'LOG', parameters: { message: 'Override rule action' } }],
  };

  // Final registry IDs (Base class prepends mod ID)
  const finalBaseRuleId = `${baseModId}:${commonRuleIdInFile}`;
  const finalOverrideRuleId = `${overrideModId}:${commonRuleIdInFile}`;

  // Mod manifests
  const baseModManifest = {
    id: baseModId,
    version: '1.0.0',
    name: 'Base Content Mod',
    content: {
      // Use constant for key
      [RULE_CONTENT_KEY]: [commonFileName],
    },
  };
  const overrideModManifest = {
    id: overrideModId,
    version: '1.0.0',
    name: 'Override Content Mod',
    content: {
      // Use constant for key
      [RULE_CONTENT_KEY]: [commonFileName], // Same filename
    },
  };

  // --- Setup ---
  beforeEach(() => {
    jest.clearAllMocks();

    // Instantiate mocks using complete factories
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    // --- Use the validator mock that exposes the inner function ---
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    // Instantiate a *real* registry to hold state across loads
    realRegistry = new InMemoryDataRegistry(mockLogger); // Pass mock logger if needed by registry

    // Ensure rule schema ID is configured via base method
    mockConfig.getContentTypeSchemaId.mockImplementation((registryKey) =>
      registryKey === RULE_TYPE_NAME ? ruleSchemaId : undefined
    );
    // Mock specific getter if RuleLoader uses it (Good practice, though base class uses getContentTypeSchemaId)
    mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

    // Configure IDataFetcher mock to return correct data based on path
    mockFetcher.fetch.mockImplementation(async (filePath) => {
      if (filePath === basePath) {
        // Deep clone to prevent mutation issues between tests/loads
        return Promise.resolve(JSON.parse(JSON.stringify(baseRuleData)));
      }
      if (filePath === overridePath) {
        // Deep clone
        return Promise.resolve(JSON.parse(JSON.stringify(overrideRuleData)));
      }
      // Added explicit rejection for unhandled paths
      return Promise.reject(
        new Error(
          `Mock Fetch Error: Unexpected fetch request for path: ${filePath}`
        )
      );
    });

    // Instantiate the loader with the real registry
    loader = new RuleLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator, // Use the validator mock created above
      realRegistry, // Use the real registry instance
      mockLogger
    );
  });

  it('should correctly apply the "last mod wins" principle for rules with overlapping IDs', async () => {
    // --- Act ---
    // 1. Load the BaseMod rule
    const baseLoadResult = await loader.loadItemsForMod(
      baseModId,
      baseModManifest,
      RULE_CONTENT_KEY,
      RULE_CONTENT_DIR,
      RULE_TYPE_NAME
    );

    // --- Assert BaseMod Load ---
    expect(baseLoadResult.count).toBe(1);
    expect(baseLoadResult.errors).toBe(0);
    expect(baseLoadResult.overrides).toBe(0); // First load, no override

    // Verify the base rule is stored correctly
    const expectedStoredBaseData = {
      ...baseRuleData,
      id: commonRuleIdInFile, // BASE ID
      _fullId: finalBaseRuleId, // QUALIFIED ID
      _modId: "BaseMod",
      _sourceFile: commonFileName,
    };
    const storedBaseRule = realRegistry.get(RULE_TYPE_NAME, finalBaseRuleId);
    expect(storedBaseRule).toEqual(expectedStoredBaseData);

    // --- Act ---
    // 2. Load the OverrideMod rule
    const overrideLoadResult = await loader.loadItemsForMod(
      overrideModId,
      overrideModManifest,
      RULE_CONTENT_KEY,
      RULE_CONTENT_DIR,
      RULE_TYPE_NAME
    );

    // --- Assert OverrideMod Load ---
    expect(overrideLoadResult.count).toBe(1);
    expect(overrideLoadResult.errors).toBe(0);
    // An override does NOT occur because the mod IDs are different, resulting in different final keys.
    expect(overrideLoadResult.overrides).toBe(0);

    // Verify the override rule is now stored and has replaced the base version
    const expectedStoredOverrideData = {
      ...overrideRuleData,
      id: commonRuleIdInFile, // BASE ID
      _fullId: finalOverrideRuleId, // QUALIFIED ID
      _modId: "OverrideMod",
      _sourceFile: commonFileName,
    };
    const storedOverrideRule = realRegistry.get(
      RULE_TYPE_NAME,
      finalOverrideRuleId
    );
    expect(storedOverrideRule).toEqual(expectedStoredOverrideData);

    // Let's assume the test wants to verify that the item loaded by OverrideMod is present
    // and the item loaded by BaseMod is ALSO present, because their full keys are different.
    expect(realRegistry.get(RULE_TYPE_NAME, finalBaseRuleId)).toEqual(
      expectedStoredBaseData
    );
    expect(realRegistry.get(RULE_TYPE_NAME, finalOverrideRuleId)).toEqual(
      expectedStoredOverrideData
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('overwrote an existing entry')
    );

    // 4. Verify fetcher and resolver calls
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      baseModId,
      RULE_CONTENT_DIR,
      commonFileName
    );
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      overrideModId,
      RULE_CONTENT_DIR,
      commonFileName
    );

    expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
    expect(mockFetcher.fetch).toHaveBeenCalledWith(basePath);
    expect(mockFetcher.fetch).toHaveBeenCalledWith(overridePath);

    // --- CORRECTED VALIDATOR ASSERTIONS ---
    // 5. Verify that the primary schema validation method was called for both rules
    expect(mockValidator.validate).toHaveBeenCalledTimes(2);
    expect(mockValidator.validate).toHaveBeenCalledWith(
      ruleSchemaId, // Ensure it was called with the correct schema ID
      expect.objectContaining(baseRuleData) // Check the data passed for the first call
    );
    expect(mockValidator.validate).toHaveBeenCalledWith(
      ruleSchemaId, // Ensure it was called with the correct schema ID
      expect.objectContaining(overrideRuleData) // Check the data passed for the second call
    );

    // 6. Optional but recommended: Verify the internal mock function was called (confirms mock logic)
    // This should now pass because mockValidator.validate was called correctly.
    const validatorFn = mockValidator._mockValidatorFn;
    if (validatorFn) {
      expect(validatorFn).toHaveBeenCalledTimes(2); // Check the inner function was indeed triggered
    } else {
      // This path indicates an issue in the mock setup itself.
      throw new Error(
        'Mock validator function (_mockValidatorFn) not found on mockValidator.'
      );
    }
    // --- END CORRECTED VALIDATOR ASSERTIONS ---

    // 7. Verify logging (keep existing logging checks)
    expect(mockLogger.info).toHaveBeenCalledWith(
      // Adjusted constructor name based on actual class name being tested
      `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${baseModId}'.`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      // Adjusted constructor name
      `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${overrideModId}'.`
    );
    // Base class logs this format:
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${baseModId}] - Processed 1/1 ${RULE_CONTENT_KEY} items.`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${overrideModId}] - Processed 1/1 ${RULE_CONTENT_KEY} items.`
    );

    // --- CORRECTED LOG ASSERTIONS ---
    // Base class storage helper logs this format now.
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `RuleLoader [${baseModId}]: Item '${finalBaseRuleId}' (Base: '${commonRuleIdInFile}') stored successfully in category '${RULE_TYPE_NAME}'.`
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `RuleLoader [${overrideModId}]: Item '${finalOverrideRuleId}' (Base: '${commonRuleIdInFile}') stored successfully in category '${RULE_TYPE_NAME}'.`
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
