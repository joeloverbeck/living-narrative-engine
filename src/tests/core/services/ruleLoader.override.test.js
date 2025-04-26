// src/tests/core/services/ruleLoader.override.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import RuleLoader from '../../../core/services/ruleLoader.js'; // Adjust path as necessary

// Import interfaces for JSDoc typing
/**
 * @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../core/interfaces/coreServices.js').ModManifest} ModManifest
 */

// --- Mock Service Factories (Copied for consistency) ---

/** Creates a mock IConfiguration service. */
const createMockConfiguration = (overrides = {}) => ({
    getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'system-rules') {
            return 'http://example.com/schemas/system-rule.schema.json';
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
    getRuleBasePath: jest.fn().mockReturnValue('system-rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
    ...overrides,
});

/** Creates a mock IPathResolver service. */
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `/abs/path/to/mods/${modId}/${typeName}/${filename}`),
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});

/** Creates a mock IDataFetcher service. */
const createMockDataFetcher = () => ({
    fetch: jest.fn().mockRejectedValue(new Error('Mock Fetcher: Path not configured')),
});

/** Creates a mock ISchemaValidator service. */
const createMockSchemaValidator = () => {
    // Default mock validator function passes validation
    const mockValidatorFn = jest.fn(() => ({isValid: true, errors: null}));
    const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';

    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === ruleSchemaId) {
                return mockValidatorFn(data);
            }
            return {isValid: true, errors: null}; // Default pass for other schemas
        }),
        addSchema: jest.fn().mockResolvedValue(undefined),
        isSchemaLoaded: jest.fn().mockReturnValue(true), // Assume schema is loaded by default
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId) {
                return mockValidatorFn; // Return the mock validator function
            }
            return undefined; // No validator for other schemas by default
        }),
        // Expose the internal mock function for configuration/assertion
        _mockValidatorFn: mockValidatorFn,
    };
};

/** Creates a mock IDataRegistry service. */
const createMockDataRegistry = () => ({
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined), // Default: rule does not exist
    getAllSystemRules: jest.fn().mockReturnValue([]),
});

/** Creates a mock ILogger service. */
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
});

// --- Test Suite ---

describe('RuleLoader - Rule ID Override Handling', () => {

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
        mockRuleValidatorFn = mockValidator._mockValidatorFn; // Get reference

        // Common mock setup for rule loading
        const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => schemaId === ruleSchemaId);
        mockValidator.getValidator.mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId) return mockRuleValidatorFn;
            return undefined;
        });
        // Ensure validator function defaults to valid
        mockRuleValidatorFn.mockImplementation((data) => ({
            isValid: data && typeof data.event_type === 'string' && Array.isArray(data.actions)
        }));
        // Default: rule does not exist yet (overridden in the test)
        mockRegistry.get.mockReturnValue(undefined);

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
    describe('Ticket 4.5.5: Test: loadRulesForMod - Handles Rule ID Overrides Correctly', () => {
        // Arrange: Define test data and configuration
        const modId = 'test-mod-override';
        const ruleType = 'system-rules';
        const ruleFileName = 'existingRule.json'; // Name in the manifest
        const ruleIdInFile = 'existingRule';     // ID defined *inside* the rule file data
        const finalRuleId = `${modId}:${ruleIdInFile}`; // ID used in the registry (modId:ruleId)
        const resolvedPathExisting = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileName}`;

        // Data for the new rule being loaded
        const newRuleData = {
            rule_id: ruleIdInFile, // The ID specified within the file
            event_type: 'new_event',
            actions: [{type: 'LOG', parameters: {message: 'New rule action'}}]
        };

        // Dummy data representing the rule already in the registry
        const existingRuleData = {
            rule_id: ruleIdInFile, // Matches the ID from the file
            event_type: 'old_event',
            actions: [{type: 'LOG', parameters: {message: 'Old rule action'}}]
            // Note: The registry stores the full data, but the loader only cares about its existence
        };

        // Manifest pointing to the rule file
        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Rule Override Test Mod',
            content: {
                rules: [ruleFileName]
            }
        };

        it('should log a warning and overwrite an existing rule ID in the registry', async () => {
            // Arrange: Configure mocks specific to this test case
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileName) return resolvedPathExisting;
                throw new Error(`Unexpected path resolution call: ${mId}, ${type}, ${file}`);
            });

            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathExisting) return Promise.resolve(JSON.parse(JSON.stringify(newRuleData)));
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // Configure validator to pass for the new rule data
            mockRuleValidatorFn.mockImplementation((data) => {
                // Simple validation for testing purposes
                const isValid = data && data.rule_id === ruleIdInFile && typeof data.event_type === 'string' && Array.isArray(data.actions);
                return {isValid};
            });

            // *** Crucial configuration: Registry.get returns the existing rule data for the target ID ***
            mockRegistry.get.mockImplementation((type, id) => {
                if (type === ruleType && id === finalRuleId) {
                    return JSON.parse(JSON.stringify(existingRuleData)); // Return the existing rule
                }
                return undefined; // Not found otherwise
            });

            // Act
            const count = await loader.loadRulesForMod(modId, manifest);

            // Assert
            // 1. Verify IDataRegistry.get was called with the final ID *before* store
            // Jest mocks record call order. We check it was called, and later check store was called.
            expect(mockRegistry.get).toHaveBeenCalledWith(ruleType, finalRuleId);

            // 2. Verify ILogger.warn was called with the override message
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            // *** FIXED ASSERTION: Expect only the string message that is actually logged ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `RuleLoader [${modId}]: Overwriting existing rule with ID '${finalRuleId}' from file '${ruleFileName}'.`
            );

            // 3. Verify IDataRegistry.store was called once with the final ID and *new* data
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                finalRuleId,
                newRuleData // Ensure the *new* data overwrites the old
            );

            // Ensure get was called before store (implicit check via Jest's call order tracking if needed, but explicit checks above suffice)
            const getCallOrder = mockRegistry.get.mock.invocationCallOrder[0];
            const storeCallOrder = mockRegistry.store.mock.invocationCallOrder[0];
            expect(getCallOrder).toBeLessThan(storeCallOrder);

            // 4. Verify the return value is 1 (one rule successfully processed, even with override)
            expect(count).toBe(1);

            // 5. Verify other logs (e.g., success debug log, summary info log)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered rule '${finalRuleId}' from file '${ruleFileName}'.`)
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered all 1 validated rule files for mod`)
            );
            expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
        });
    });
});