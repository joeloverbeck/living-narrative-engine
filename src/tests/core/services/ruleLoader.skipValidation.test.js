// src/tests/core/services/ruleLoader.skipValidation.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import path from 'path'; // Needed for basename operations
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
    // This mock validator function should NOT be called in this test case
    const mockValidatorFn = jest.fn(() => ({isValid: true, errors: null}));
    const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';

    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === ruleSchemaId) {
                return mockValidatorFn(data);
            }
            return {isValid: true, errors: null};
        }),
        addSchema: jest.fn().mockResolvedValue(undefined),
        // Default to true, will be overridden in the test
        isSchemaLoaded: jest.fn().mockReturnValue(true),
        // getValidator should NOT be called if isSchemaLoaded is false
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId) {
                return mockValidatorFn;
            }
            return undefined;
        }),
        // Expose the internal mock function for assertion
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

describe('RuleLoader - Skip Validation Scenario', () => {

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

        // Common mock setup, ISchemaLoaded will be overridden in test
        const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
        mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId); // Ensure config returns the correct ID
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === 'system-rules' ? ruleSchemaId : undefined
        );
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
    describe('Ticket 4.5.4: Test: loadRulesForMod - Handles Missing Rule Schema Correctly (Skip Validation)', () => {
        // Arrange: Define test data and configuration
        const modId = 'test-mod-skip-validation';
        const ruleType = 'system-rules';
        const ruleFile = 'ruleToSkip.json';
        const ruleBasename = 'ruleToSkip'; // Basename used for generated ID
        const resolvedPathSkip = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFile}`;
        const ruleDataSkip = {
            // Minimal valid data, no rule_id needed as it will be generated
            event_type: 'core:test_skip_validation',
            actions: [{type: 'LOG', parameters: {message: 'Rule loaded despite missing schema'}}]
        };
        const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';

        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Skip Schema Validation Test Mod',
            content: {
                rules: [ruleFile]
            }
        };

        it('should skip validation (with warning) but still fetch and store the rule if schema is not loaded', async () => {
            // Arrange: Configure mocks specific to this test case
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFile) return resolvedPathSkip;
                throw new Error(`Unexpected path resolution call: ${mId}, ${type}, ${file}`);
            });

            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathSkip) return Promise.resolve(JSON.parse(JSON.stringify(ruleDataSkip)));
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // *** Crucial configuration: Schema is NOT loaded ***
            mockValidator.isSchemaLoaded.mockImplementation((schemaIdToCheck) => {
                return schemaIdToCheck !== ruleSchemaId; // Return false only for the rule schema ID
            });

            // Act
            const count = await loader.loadRulesForMod(modId, manifest);

            // Assert
            // Verify isSchemaLoaded was checked for the rule schema
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(ruleSchemaId);

            // Verify the warning log was called
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            // *** FIXED Assertion: Match the actual log message from ruleLoader.js ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                // Check the exact string logged when schema is not loaded
                `RuleLoader [${modId}]: Rule schema '${ruleSchemaId}' is configured but not loaded. Skipping validation for ruleToSkip.json.`
                // Note: This specific log call in ruleLoader.js does NOT pass a context object.
            );

            // Verify fetcher was still called
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathSkip);

            // Verify validator was NOT called
            expect(mockValidator.getValidator).not.toHaveBeenCalled();
            expect(mockRuleValidatorFn).not.toHaveBeenCalled(); // The underlying validator function mock

            // Verify registry store was called
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${ruleBasename}`, // Expected generated ID: modId:basename
                ruleDataSkip // Stored the fetched data
            );

            // Verify return value
            expect(count).toBe(1); // The rule was still processed and counted

            // Verify summary info log
            // Verify summary info log
            // The BaseManifestItemLoader logs the final count.
            // Since validation was skipped, the message reflects "Processed" items, not "validated".
            expect(mockLogger.info).toHaveBeenCalledWith(
                // Match the actual final log message observed in the error output
                `Mod [${modId}] - Processed 1/1 rules items.`
            );
            // Optionally, you can also assert the first info log message if it's important
            expect(mockLogger.info).toHaveBeenCalledWith(
                `RuleLoader [${modId}]: Delegating rule loading to BaseManifestItemLoader using manifest key 'rules' and content directory 'system-rules'.`
            );

            // Verify no errors were logged
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });
});