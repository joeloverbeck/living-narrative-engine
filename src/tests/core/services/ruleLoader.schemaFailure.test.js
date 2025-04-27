// src/tests/core/services/ruleLoader.schemaFailure.test.js

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
    store: jest.fn(),
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

describe('RuleLoader - Schema Validation Failure Handling', () => {

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
    describe('Ticket 4.5.3: Schema Validation Failure Handling', () => {
        // Arrange: Define test data and configuration
        const modId = 'test-mod-schema-fail';
        const ruleType = 'system-rules';
        const validRuleFile = 'validRule.json';
        const invalidRuleFile = 'invalidRule.json';
        const resolvedPathValid = `/abs/path/to/mods/${modId}/${ruleType}/${validRuleFile}`;
        const resolvedPathInvalid = `/abs/path/to/mods/${modId}/${ruleType}/${invalidRuleFile}`;

        const validRuleData = {
            rule_id: 'validRule', // Explicit ID for clarity
            event_type: 'core:test_valid',
            actions: [{type: 'LOG', parameters: {message: 'Valid rule loaded'}}]
        };
        const invalidRuleData = {
            rule_id: 'invalidRule',
            event_type: 'core:test_invalid',
            // Missing 'actions' field, which should cause schema validation failure
        };

        const validationError = {message: 'Missing required property: actions'}; // Example error object
        // Prepare the stringified version as it appears in the log
        const stringifiedErrorDetails = JSON.stringify([validationError], null, 2);

        // --- Expected Augmented Data (for the valid rule only) ---
        const expectedStoredValidData = {
            ...validRuleData,
            id: `${modId}:${validRuleData.rule_id}`,
            modId: modId,
            _sourceFile: validRuleFile
        };
        // --- End Expected Augmented Data ---

        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Schema Validation Test Mod',
            content: {
                rules: [validRuleFile, invalidRuleFile] // Process valid then invalid
            }
        };

        it('should log schema errors, skip invalid rules, store valid ones, and return correct count', async () => {
            // Arrange: Configure mocks specific to this test case
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === validRuleFile) return resolvedPathValid;
                if (mId === modId && type === ruleType && file === invalidRuleFile) return resolvedPathInvalid;
                throw new Error(`Unexpected path resolution call: ${mId}, ${type}, ${file}`);
            });

            mockFetcher.fetch.mockImplementation(async (filePath) => {
                // Return copies
                if (filePath === resolvedPathValid) return Promise.resolve(JSON.parse(JSON.stringify(validRuleData)));
                if (filePath === resolvedPathInvalid) return Promise.resolve(JSON.parse(JSON.stringify(invalidRuleData)));
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // Configure ISchemaValidator's mock function to fail for invalidRuleData
            mockRuleValidatorFn.mockImplementation((data) => {
                // Check based on a unique property of the data
                if (data.event_type === validRuleData.event_type) {
                    return {isValid: true, errors: null};
                } else if (data.event_type === invalidRuleData.event_type) {
                    return {isValid: false, errors: [validationError]}; // Return the specific error
                }
                // Fallback for safety, though should not be reached if fetch mock is correct
                return {
                    isValid: false,
                    errors: [{message: `Unexpected data passed to mock validator: ${JSON.stringify(data)}`}]
                };
            });

            // Act
            const count = await loader.loadRulesForMod(modId, manifest);

            // Assert
            // Verify fetcher calls
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathValid);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathInvalid);

            // Verify validator function calls
            expect(mockValidator.getValidator).toHaveBeenCalledWith('http://example.com/schemas/system-rule.schema.json');
            expect(mockRuleValidatorFn).toHaveBeenCalledTimes(2);
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(expect.objectContaining(validRuleData));
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(expect.objectContaining(invalidRuleData));

            // Verify error logging (These assertions seem correct)
            expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific schema error + Generic wrapper error

            // Assert the SPECIFIC schema validation error from RuleLoader._processFetchedItem
            // NOTE: RuleLoader._processFetchedItem logs the error *message* string directly.
            const expectedSpecificErrorMessage = `RuleLoader [${modId}]: Schema validation failed for rule file '${invalidRuleFile}' at ${resolvedPathInvalid}. Errors:\n${stringifiedErrorDetails}`;
            expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificErrorMessage); // Logs only the message string

            // Assert the GENERIC error from BaseManifestItemLoader._processFileWrapper's catch block
            const expectedGenericError = new Error(`Schema validation failed for ${invalidRuleFile} in mod ${modId}.`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error processing file:', // Wrapper's message prefix
                expect.objectContaining({ // Metadata object
                    modId: modId,
                    filename: invalidRuleFile,
                    path: resolvedPathInvalid,
                    typeName: ruleType,
                    error: expectedGenericError.message // The message from the error thrown by _processFetchedItem
                }),
                expectedGenericError // The actual Error object thrown
            );

            // Verify registry store call for the valid rule ONLY with AUGMENTED data
            // --- ** THE CORRECTION IS HERE ** ---
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,                             // category
                `${modId}:${validRuleData.rule_id}`,  // finalRegistryKey
                expectedStoredValidData               // Augmented data object
            );
            // Ensure store was NOT called for the invalid rule
            expect(mockRegistry.store).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining(invalidRuleData.rule_id),
                expect.anything()
            );
            // --- ** END CORRECTION ** ---

            // Verify return value
            expect(count).toBe(1);

            // Verify summary and debug logging (These assertions seem correct)
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 1/2 rules items. (1 failed)`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Delegating rule loading to BaseManifestItemLoader`)
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                // Successful storage log from _storeItemInRegistry for validRule
                `RuleLoader [${modId}]: Successfully stored system-rules item '${modId}:${validRuleData.rule_id}' from file '${validRuleFile}'.`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                // Failure log from BaseManifestItemLoader._loadItemsInternal for invalidRule
                `[${modId}] Failed processing ${invalidRuleFile}. Reason: Schema validation failed for ${invalidRuleFile} in mod ${modId}.`
            );
            // Ensure the successful storage log was NOT called for the invalid rule
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining(`Successfully stored system-rules item '${modId}:${invalidRuleData.rule_id}'`)
            );
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected

        });
    });
});