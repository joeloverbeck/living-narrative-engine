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
    }), // --- Other potentially used methods (good practice to include) ---
    getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getRuleBasePath: jest.fn().mockReturnValue('system-rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'), ...overrides,
});

/** Creates a mock IPathResolver service. */
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `/abs/path/to/mods/${modId}/${typeName}/${filename}`), // Mock other methods required by Base constructor or other logic
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`), ...overrides,
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
        }), addSchema: jest.fn().mockResolvedValue(undefined), removeSchema: jest.fn().mockReturnValue(true), // Added for completeness if Base needs it
        isSchemaLoaded: jest.fn().mockImplementation((schemaId) => loadedSchemas.has(schemaId)), // Use map
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) {
                return mockValidatorFn;
            }
            return undefined; // No validator for other schemas by default
        }), // Expose the internal mock function for configuration/assertion
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
    setManifest: jest.fn(), // Add specific getters if needed by other parts, defaulting to undefined
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
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), ...overrides,
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
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === 'system-rules' ? ruleSchemaId : undefined);
        mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

        // Reset common mocks
        mockRuleValidatorFn.mockImplementation((data) => ({isValid: true})); // Default validation pass
        mockRegistry.get.mockReturnValue(undefined); // Default: no rule exists yet

        // Instantiate the loader
        loader = new RuleLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
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
            event_type: 'core:eventOK', actions: [{type: 'LOG', parameters: {message: 'Rule OK loaded'}}]
        };
        const ruleDataFailStore = {
            rule_id: 'ruleFailStore_id', // Explicit ID
            event_type: 'core:eventFailStore', actions: [{type: 'LOG', parameters: {message: 'Rule Fail Store loaded'}}]
        };

        const finalIdOK = `${modId}:${ruleDataOK.rule_id}`;
        const finalIdFailStore = `${modId}:${ruleDataFailStore.rule_id}`;
        const storageError = new Error('DB write failed'); // Specific error for storage

        const manifest = {
            id: modId, version: '1.0.0', name: 'Storage Failure Test Mod', content: {
                rules: [ruleFileOK, ruleFileFailStore] // Process OK then Fail
            }
        };

        // --- Expected Augmented Data (what _storeItemInRegistry prepares) ---
        const expectedPreparedDataOK = {
            ...ruleDataOK, id: finalIdOK, modId: modId, _sourceFile: ruleFileOK
        };
        const expectedPreparedDataFailStore = {
            ...ruleDataFailStore, id: finalIdFailStore, modId: modId, _sourceFile: ruleFileFailStore // Assumes untrimmed filename is passed down
        };
        // --- End Expected Augmented Data ---

        it('should log storage errors, count failed rules as unsuccessful, process others, and return correct count', async () => {
            // Arrange: Configure mocks specific to this test case
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileOK) return resolvedPathOK;
                if (mId === modId && type === ruleType && file === ruleFileFailStore) return resolvedPathFailStore;
                throw new Error(`Unexpected path resolution call: ${mId}, ${type}, ${file}`);
            });

            mockFetcher.fetch.mockImplementation(async (filePath) => {
                // Return copies
                if (filePath === resolvedPathOK) return Promise.resolve(JSON.parse(JSON.stringify(ruleDataOK)));
                if (filePath === resolvedPathFailStore) return Promise.resolve(JSON.parse(JSON.stringify(ruleDataFailStore)));
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // Validator passes for both (already set in beforeEach)

            // Configure IDataRegistry.store: Success for OK, Throw for FailStore
            mockRegistry.store.mockImplementation((type, id, data) => {
                if (type === ruleType && id === finalIdOK) {
                    // Success for the OK rule
                    return; // Simulate successful storage
                }
                if (type === ruleType && id === finalIdFailStore) {
                    throw storageError; // Throw the specific error for the fail rule
                }
                // Fail test if unexpected call happens
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
            // Validator gets original data
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(expect.objectContaining(ruleDataOK));
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(expect.objectContaining(ruleDataFailStore));

            // Verify IDataRegistry.store was ATTEMPTED for both rules with AUGMENTED data
            // --- ** THE CORRECTION IS HERE ** ---
            expect(mockRegistry.store).toHaveBeenCalledTimes(2);
            expect(mockRegistry.store).toHaveBeenCalledWith(ruleType,           // category
                finalIdOK,          // finalRegistryKey
                expectedPreparedDataOK // Prepared augmented data
            );
            expect(mockRegistry.store).toHaveBeenCalledWith(ruleType,           // category
                finalIdFailStore,   // finalRegistryKey
                expectedPreparedDataFailStore // Prepared augmented data (even though store throws)
            );
            // --- ** END CORRECTION ** ---

            // Verify error logging (These assertions seem correct based on the code)
            expect(mockLogger.error).toHaveBeenCalledTimes(2); // Base helper logs, then wrapper logs

            // Error log from BaseManifestItemLoader._storeItemInRegistry's catch block
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Failed to store system-rules item with key '${finalIdFailStore}'`), // Match the helper's log message structure
                expect.objectContaining({ // Match the metadata object
                    modId: modId,
                    baseItemId: ruleDataFailStore.rule_id,
                    finalRegistryKey: finalIdFailStore,
                    category: ruleType,
                    sourceFilename: ruleFileFailStore,
                    error: storageError.message
                }), storageError // Match the full error object
            );

            // Error log from BaseManifestItemLoader._processFileWrapper's catch block
            expect(mockLogger.error).toHaveBeenCalledWith('Error processing file:', // Match the wrapper's log message
                expect.objectContaining({ // Match the metadata object
                    modId: modId, filename: ruleFileFailStore, path: resolvedPathFailStore, typeName: ruleType, // Check typeName is logged
                    error: storageError.message
                }), storageError // Match the full error object
            );

            // Verify the return value (only ruleOK succeeded)
            expect(count).toBe(1);

            // Verify summary and debug logging (These assertions seem correct)
            expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 1/2 rules items. (1 failed)`);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Delegating rule loading to BaseManifestItemLoader`));
            expect(mockLogger.debug).toHaveBeenCalledWith(// Successful storage log from _storeItemInRegistry for ruleOK
                `RuleLoader [${modId}]: Successfully stored system-rules item '${finalIdOK}' from file '${ruleFileOK}'.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(// Failure log from BaseManifestItemLoader._loadItemsInternal for ruleFailStore
                `[${modId}] Failed processing ${ruleFileFailStore}. Reason: ${storageError.message}`);
            // Ensure the successful storage log was NOT called for the failed rule
            expect(mockLogger.debug).not.toHaveBeenCalledWith(`RuleLoader [${modId}]: Successfully stored system-rules item '${finalIdFailStore}' from file '${ruleFileFailStore}'.`);
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected

        });
    });
});