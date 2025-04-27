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

// --- Mock Service Factories (Copied for consistency) ---

/** Creates a mock IConfiguration service. */
const createMockConfiguration = (overrides = {}) => ({
    // --- Methods required by BaseManifestItemLoader constructor ---
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'system-rules') {
            return 'http://example.com/schemas/system-rule.schema.json';
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
    getRuleBasePath: jest.fn().mockReturnValue('system-rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
    ...overrides,
});

/** Creates a mock IPathResolver service. */
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `/abs/path/to/mods/${modId}/${typeName}/${filename}`),
    // Mock other methods required by Base constructor or other logic
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
    const loadedSchemas = new Map();
    loadedSchemas.set(ruleSchemaId, {}); // Mark schema as loaded

    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) {
                return mockValidatorFn(data);
            }
            return {isValid: true, errors: null}; // Default pass for other schemas
        }),
        addSchema: jest.fn().mockResolvedValue(undefined),
        removeSchema: jest.fn().mockReturnValue(true), // Added for completeness if Base needs it
        isSchemaLoaded: jest.fn().mockImplementation((schemaId) => loadedSchemas.has(schemaId)), // Use map
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) {
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
    // --- Methods required by Base constructor ---
    getAll: jest.fn(() => []),
    getAllSystemRules: jest.fn().mockReturnValue([]),
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

        // Instantiate mocks using complete factories
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
        mockRuleValidatorFn = mockValidator._mockValidatorFn; // Get reference

        // Ensure rule schema ID is configured
        const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === 'system-rules' ? ruleSchemaId : undefined
        );
        mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

        // Reset common mocks
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
        const storageError = new Error('DB write failed'); // Specific error for storage

        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Storage Failure Test Mod',
            content: {
                rules: [ruleFileOK, ruleFileFailStore] // Process OK then Fail
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

            // Validator passes for both (already set in beforeEach)
            // mockRuleValidatorFn.mockImplementation((data) => ({isValid: true}));

            // Configure IDataRegistry.store: Success for OK, Throw for FailStore
            mockRegistry.store.mockImplementation((type, id, data) => {
                if (type === ruleType && id === finalIdOK) {
                    // Store it internally for potential later checks if needed, or just succeed
                    return;
                }
                if (type === ruleType && id === finalIdFailStore) {
                    throw storageError; // Throw the specific error
                }
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

            // Verify IDataRegistry.store was attempted for both rules
            expect(mockRegistry.store).toHaveBeenCalledTimes(2);
            expect(mockRegistry.store).toHaveBeenCalledWith(ruleType, finalIdOK, ruleDataOK);
            expect(mockRegistry.store).toHaveBeenCalledWith(ruleType, finalIdFailStore, ruleDataFailStore);

            // --- CORRECTION 1: Check actual error logs ---
            // Expect two errors: 1 specific from RuleLoader, 1 generic from Base wrapper
            expect(mockLogger.error).toHaveBeenCalledTimes(2);

            // Assert the SPECIFIC storage error from RuleLoader._processFetchedItem's catch block
            expect(mockLogger.error).toHaveBeenCalledWith(
                // Match the message format logged by RuleLoader on storage failure
                `RuleLoader [${modId}]: Failed to store rule '${finalIdFailStore}' from file '${ruleFileFailStore}'. Error: ${storageError.message}`,
                // The second argument is the full error object itself
                storageError
            );

            // Assert the GENERIC error from BaseManifestItemLoader._processFileWrapper's catch block
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error processing file:',
                expect.objectContaining({
                    modId: modId,
                    filename: ruleFileFailStore,
                    path: resolvedPathFailStore,
                    error: storageError.message // Base wrapper logs the message string here
                }),
                storageError // Base wrapper passes the full error object as the third argument
            );
            // --- End Correction 1 ---


            // Verify the return value (only OK rule succeeded)
            expect(count).toBe(1);

            // --- CORRECTION 2: Check actual summary logs ---
            // Verify the final summary log from BaseManifestItemLoader (INFO level)
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 1/2 rules items. (1 failed)`
            );
            // Ensure the specific WARN message wasn't called
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining(`Processed 1 out of 2 rule files successfully`)
            );

            // Verify the initial delegation info log was called
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Delegating rule loading to BaseManifestItemLoader`)
            );
            // Ensure other incorrect INFO logs weren't called
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered all`)
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith( // This info log doesn't exist
                expect.stringContaining(`Loading 2 rule file(s)`)
            );
            // --- End Correction 2 ---


            // --- CORRECTION 3: Check actual debug logs ---
            // Verify the debug log for the successfully processed and STORED rule (ruleOK)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                // This message is logged by RuleLoader AFTER successful store call
                `RuleLoader [${modId}]: Successfully stored rule '${finalIdOK}' from file '${ruleFileOK}'.`
            );
            // Verify the debug log for the failed file processing (logged by BaseManifestItemLoader)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                // This message is logged by BaseLoader after promise rejection
                `[${modId}] Failed processing ${ruleFileFailStore}. Reason: ${storageError.message}`
            );
            // Verify the debug log for successful *processing* but failed *storage* was NOT called for ruleFailStore
            // (because the successful store log happens only if store doesn't throw)
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                `RuleLoader [${modId}]: Successfully stored rule '${finalIdFailStore}' from file '${ruleFileFailStore}'.`
            );
            // --- End Correction 3 ---
        });
    });
});