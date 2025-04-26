// src/tests/core/services/ruleLoader.storeFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import path from 'path'; // Needed for basename operations if IDs are generated from filenames
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

// --- Mock Service Factories (Copied from ruleLoader.processing.test.js for consistency) ---

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
        isSchemaLoaded: jest.fn().mockReturnValue(true), // Default to true
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId) {
                return mockValidatorFn;
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

describe('RuleLoader - Storage Failure Handling', () => {

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
        mockRuleValidatorFn.mockImplementation((data) => ({isValid: true})); // Default validation pass
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
    describe('Ticket 4.5.6: Test: loadRulesForMod - Handles IDataRegistry Storage Failure Gracefully', () => {
        // Arrange: Define test data and configuration
        const modId = 'test-mod-store-fail';
        const ruleType = 'system-rules';
        const ruleFileOK = 'ruleOK.json';
        const ruleFileFailStore = 'ruleFailStore.json';
        const resolvedPathOK = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileOK}`;
        const resolvedPathFailStore = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileFailStore}`;

        const ruleDataOK = {
            rule_id: 'ruleOK_id', // Explicit ID
            event_type: 'core:eventOK',
            actions: [{type: 'LOG', parameters: {message: 'Rule OK loaded'}}]
        };
        const ruleDataFailStore = {
            rule_id: 'ruleFailStore_id', // Explicit ID
            event_type: 'core:eventFailStore',
            actions: [{type: 'LOG', parameters: {message: 'Rule Fail Store loaded'}}]
        };

        const finalIdOK = `${modId}:${ruleDataOK.rule_id}`;
        const finalIdFailStore = `${modId}:${ruleDataFailStore.rule_id}`;
        const storageError = new Error('DB write failed');

        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Storage Failure Test Mod',
            content: {
                rules: [ruleFileOK, ruleFileFailStore]
            }
        };

        it('should log storage errors, count failed rules as unsuccessful, process others, and return correct count', async () => {
            // Arrange: Configure mocks specific to this test case
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileOK) return resolvedPathOK;
                if (mId === modId && type === ruleType && file === ruleFileFailStore) return resolvedPathFailStore;
                throw new Error(`Unexpected path resolution call: ${mId}, ${type}, ${file}`);
            });

            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathOK) return Promise.resolve(JSON.parse(JSON.stringify(ruleDataOK)));
                if (filePath === resolvedPathFailStore) return Promise.resolve(JSON.parse(JSON.stringify(ruleDataFailStore)));
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // Validator passes for both
            mockRuleValidatorFn.mockImplementation((data) => ({isValid: true}));

            // Configure IDataRegistry.store: Success for OK, Throw for FailStore
            mockRegistry.store.mockImplementation((type, id, data) => {
                if (type === ruleType && id === finalIdOK) {
                    // Implicit success (do nothing, as per default mock)
                    return;
                }
                if (type === ruleType && id === finalIdFailStore) {
                    throw storageError; // Throw the specific error
                }
                // Throw if called unexpectedly
                throw new Error(`Unexpected store call: ${type}, ${id}`);
            });

            // Act
            const count = await loader.loadRulesForMod(modId, manifest);

            // Assert
            // Verify fetcher and validator calls occurred for both
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathOK);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathFailStore);
            expect(mockRuleValidatorFn).toHaveBeenCalledTimes(2);
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(ruleDataOK);
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(ruleDataFailStore);

            // Verify IDataRegistry.store was called (or attempted) for both rules
            expect(mockRegistry.store).toHaveBeenCalledTimes(2);
            expect(mockRegistry.store).toHaveBeenCalledWith(ruleType, finalIdOK, ruleDataOK);
            expect(mockRegistry.store).toHaveBeenCalledWith(ruleType, finalIdFailStore, ruleDataFailStore);

            // Verify ILogger.error was called for the storage failure
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // *** CORRECTION: ***
            // Check the log message and context that were ACTUALLY received,
            // indicating the error was caught by the outer catch block.
            expect(mockLogger.error).toHaveBeenCalledWith(
                // Expect the "Failed to fetch" message
                expect.stringContaining(`RuleLoader [${modId}]: Failed to fetch rule file '${ruleFileFailStore}'. Skipping.`),
                // Expect the context associated with the outer catch block
                expect.objectContaining({
                    error: storageError, // The original storage error should still be the cause
                    modId: modId,
                    filePath: resolvedPathFailStore // Check for filePath instead of finalId/ruleData
                })
            );
            // *** END CORRECTION ***

            // Verify the return value of loadRulesForMod is 1 (only ruleOK succeeded storage implicitly)
            // Note: Even though the store call for ruleOK didn't throw, the failure
            // during ruleFailStore processing (caught by the outer catch) prevents
            // successfulLoads from being incremented for ruleFailStore.
            expect(count).toBe(1);

            // Verify ILogger.warn was called indicating partial success
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`RuleLoader [${modId}]: Processed 1 out of 2 rule files successfully (some failed).`)
            );

            // Verify the final "Successfully processed all..." info log was NOT called
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered all`)
            );

            // Verify the initial loading log
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`RuleLoader [${modId}]: Loading 2 rule file(s) specified by manifest.`)
            );

            // Verify the debug log for the successfully processed and stored rule (ruleOK)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered rule '${finalIdOK}' from file '${ruleFileOK}'.`)
            );
            // Verify the debug log was NOT called for the failed rule (ruleFailStore)
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered rule '${finalIdFailStore}' from file '${ruleFileFailStore}'.`)
            );
        });
    });
});