// src/tests/loaders/ruleLoader.fetchFailure.test.js

// --- Imports ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import RuleLoader from '../../../src/loaders/ruleLoader.js';

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

// --- Mock Service Factories ---
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

const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, typeName, filename) =>
      `/abs/path/to/mods/${modId}/${typeName}/${filename}`
  ),
  // Add other methods if needed by base class constructor or other logic
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

const createMockDataFetcher = () => ({
  fetch: jest
    .fn()
    .mockRejectedValue(new Error('Mock Fetcher: Path not configured')),
});

const createMockSchemaValidator = () => {
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';
  const mockValidatorFn = jest.fn(() => ({ isValid: true, errors: null }));
  const loadedSchemas = new Map();
  loadedSchemas.set(ruleSchemaId, {}); // Mark schema as loaded

  return {
    validate: jest.fn().mockImplementation((schemaId, data) => {
      if (schemaId === ruleSchemaId) {
        return mockValidatorFn(data);
      }
      return { isValid: true, errors: null };
    }),
    addSchema: jest.fn().mockResolvedValue(undefined),
    // --- Base class constructor requires these ---
    removeSchema: jest.fn().mockReturnValue(true),
    isSchemaLoaded: jest
      .fn()
      .mockImplementation((schemaId) => loadedSchemas.has(schemaId)),
    getValidator: jest.fn().mockImplementation((schemaId) => {
      if (loadedSchemas.has(schemaId) && schemaId === ruleSchemaId) {
        return mockValidatorFn;
      }
      return undefined;
    }),
    // Expose the mock function if needed for direct assertion counts
    _mockValidatorFn: mockValidatorFn,
  };
};

const createMockDataRegistry = () => ({
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined),
  // Add other methods if needed by base class constructor or other logic
  getAll: jest.fn(() => []),
  getAllSystemRules: jest.fn(() => []),
  clear: jest.fn(),
  getManifest: jest.fn().mockReturnValue(null),
  setManifest: jest.fn(),
  getComponentDefinition: jest.fn(),
});

const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

// --- Test Suite for Fetch Failure Handling ---
// *** UPDATED describe block title slightly ***
describe('RuleLoader - Fetch Failure Handling (via loadItemsForMod)', () => {
  /** @type {IConfiguration} */
  let mockConfig;
  /** @type {IPathResolver} */
  let mockResolver;
  /** @type {IDataFetcher} */
  let mockFetcher;
  /** @type {ISchemaValidator & { _mockValidatorFn?: jest.Mock }} */
  let mockValidator;
  /** @type {IDataRegistry} */
  let mockRegistry;
  /** @type {ILogger} */
  let mockLogger;
  /** @type {RuleLoader} */
  let loader;

  // --- Shared Test Data ---
  const modId = 'test-mod-fetch-fail';
  // *** Define constants for RuleLoader specific args ***
  const RULE_CONTENT_KEY = 'rules';
  const RULE_CONTENT_DIR = 'rules';
  const RULE_TYPE_NAME = 'rules';
  const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator(); // Already ensures schema is loaded
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // Ensure rule schema ID is configured via base method
    mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
      typeName === RULE_TYPE_NAME ? ruleSchemaId : undefined
    );
    // Mock specific getter if RuleLoader uses it
    mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

    // Default validation pass for the mock validator
    if (mockValidator._mockValidatorFn) {
      mockValidator._mockValidatorFn.mockImplementation(() => ({
        isValid: true,
        errors: null,
      }));
    }
    mockRegistry.get.mockReturnValue(undefined); // Default no existing rule

    loader = new RuleLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );
  });

  describe('Ticket 4.5.2: Fetch Failure Handling', () => {
    const fileOK = 'ruleOK.json';
    const fileFail = 'ruleFail.json';
    const fileOKName = 'ruleOK'; // For derived ID
    const resolvedPathOK = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${fileOK}`;
    const resolvedPathFail = `/abs/path/to/mods/${modId}/${RULE_CONTENT_DIR}/${fileFail}`;

    const ruleDataOK = {
      // No rule_id, let RuleLoader derive it from filename
      event_type: 'core:eventOK',
      actions: [{ type: 'LOG', parameters: { message: 'Rule OK loaded' } }],
    };
    const expectedRuleIdOK = `${modId}:${fileOKName}`; // ID derived from filename

    const fetchError = new Error('404 Not Found'); // Specific error for the failed fetch

    const manifest = {
      id: modId,
      version: '1.0.0',
      name: 'Fetch Failure Test Mod',
      content: {
        // Use constant for key
        [RULE_CONTENT_KEY]: [fileOK, fileFail], // Order matters for predictable processing
      },
    };

    it('should log fetch errors, skip failed files, process valid ones, and return correct count', async () => {
      // Arrange: Configure mocks specific to this test case
      mockResolver.resolveModContentPath.mockImplementation(
        (mId, type, file) => {
          if (mId === modId && type === RULE_CONTENT_DIR && file === fileOK)
            return resolvedPathOK;
          if (mId === modId && type === RULE_CONTENT_DIR && file === fileFail)
            return resolvedPathFail;
          throw new Error(
            `Unexpected path resolution call: ${mId}, ${type}, ${file}`
          );
        }
      );

      // Configure IDataFetcher: Success for OK, Reject for Fail
      mockFetcher.fetch.mockImplementation(async (filePath) => {
        if (filePath === resolvedPathOK) {
          return Promise.resolve(JSON.parse(JSON.stringify(ruleDataOK))); // Deep clone
        }
        if (filePath === resolvedPathFail) {
          return Promise.reject(fetchError); // Reject with the specific error
        }
        return Promise.reject(
          new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`)
        );
      });

      // Act
      // *** UPDATED: Call loadItemsForMod and store the result object ***
      const loadResult = await loader.loadItemsForMod(
        modId,
        manifest,
        RULE_CONTENT_KEY,
        RULE_CONTENT_DIR,
        RULE_TYPE_NAME
      );

      // Assert
      // Verify fetch attempts
      expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathOK);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathFail);

      // Verify error log for the failed file (logged by BaseManifestItemLoader._processFileWrapper)
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing file:', // Actual message
        expect.objectContaining({
          // Check context object structure
          modId: modId,
          filename: fileFail,
          path: resolvedPathFail,
          typeName: RULE_TYPE_NAME, // Type name should be logged
          error: fetchError.message, // Base class logs the message string here
        }),
        fetchError // Base class passes the full error object as the third argument
      );

      // Verify registry store for the successful file only
      expect(mockRegistry.store).toHaveBeenCalledTimes(1);
      const expectedStoredDataOK = {
        // Calculate expected stored data with augmentations
        ...ruleDataOK,
        id: expectedRuleIdOK,
        modId: modId,
        _sourceFile: fileOK,
      };
      expect(mockRegistry.store).toHaveBeenCalledWith(
        RULE_TYPE_NAME,
        expectedRuleIdOK, // Expect the ID derived from filename
        expectedStoredDataOK // Expect the augmented data
      );
      // Ensure store wasn't called for the failed file
      expect(mockRegistry.store).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(fileFail.replace('.json', '')), // ID would be derived from fileFail
        expect.anything()
      );

      // Verify return results object
      // *** UPDATED: Check properties of the loadResult object ***
      expect(loadResult).toEqual({
        count: 1, // Only one rule was successfully processed
        errors: 1, // One file failed to fetch/process
        overrides: 0, // No existing rules were overridden
      });
      // *** REMOVED old assertion: expect(count).toBe(1); ***

      // Verify summary logs
      expect(mockLogger.info).toHaveBeenCalledWith(
        `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.` // Initial log
      );
      // *** UPDATED: Ensure the summary log reflects the numbers from loadResult ***
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Mod [${modId}] - Processed ${loadResult.count}/${manifest.content[RULE_CONTENT_KEY].length} ${RULE_CONTENT_KEY} items. (${loadResult.errors} failed)` // Final summary log
      );

      // Ensure no warnings (apart from potential deprecation warnings from loadAllRules, which wasn't called here)
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
