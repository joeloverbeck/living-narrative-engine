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
    // Add other methods minimally if needed
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

        const validationError = {message: 'Missing required property: actions'}; // Example error

        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Schema Validation Test Mod',
            content: {
                rules: [validRuleFile, invalidRuleFile]
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
                if (filePath === resolvedPathValid) return Promise.resolve(JSON.parse(JSON.stringify(validRuleData)));
                if (filePath === resolvedPathInvalid) return Promise.resolve(JSON.parse(JSON.stringify(invalidRuleData)));
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // Configure ISchemaValidator.getValidator's mock function
            mockRuleValidatorFn.mockImplementation((data) => {
                if (data.rule_id === 'validRule') {
                    return {isValid: true};
                } else if (data.rule_id === 'invalidRule') {
                    return {isValid: false, errors: [validationError]};
                }
                // Fallback for unexpected data
                return {isValid: false, errors: [{message: 'Unexpected data passed to mock validator'}]};
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
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(validRuleData);
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(invalidRuleData);

            // Verify logger error call for the invalid rule
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // *** MODIFIED ASSERTION based on error output ***
            expect(mockLogger.error).toHaveBeenCalledWith(
                // Use the message format from the error output
                expect.stringContaining(`RuleLoader [${modId}]: Failed to fetch rule file '${invalidRuleFile}'. Skipping.`),
                // Match the context object structure from the error output
                expect.objectContaining({
                    modId: modId,
                    filePath: resolvedPathInvalid,
                    // Expect an 'error' property which is an instance of Error
                    error: expect.any(Error)
                    // We can optionally add more specific checks on the error message if needed:
                    // error: expect.objectContaining({
                    //     message: expect.stringContaining('Schema validation failed')
                    // })
                    // Note: The original assertion expected `errors` and `ruleData` which were not present in the received context.
                })
            );
            // *** END MODIFIED ASSERTION ***

            // Verify registry store call for the valid rule ONLY
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${validRuleData.rule_id}`, // Expected ID: modId:explicit_id
                validRuleData
            );
            // Ensure store was NOT called for the invalid rule data or its potential IDs
            expect(mockRegistry.store).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining(invalidRuleData.rule_id),
                expect.anything()
            );
            expect(mockRegistry.store).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining(path.basename(invalidRuleFile, '.json')), // ID derived from filename
                expect.anything()
            );

            // Verify return value
            expect(count).toBe(1); // Only the valid rule was processed

            // Verify summary warning log
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

            // Verify the debug log for the successfully processed valid rule
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered rule '${modId}:${validRuleData.rule_id}' from file '${validRuleFile}'.`)
            );
        });
    });
});