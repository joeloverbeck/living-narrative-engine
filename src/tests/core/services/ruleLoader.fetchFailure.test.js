// src/tests/core/services/ruleLoader.fetchFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import path from 'path';
import RuleLoader from '../../../core/services/ruleLoader.js';

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

// --- Mock Service Factories ---
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

const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `/abs/path/to/mods/${modId}/${typeName}/${filename}`),
    // Add other methods if needed by base class constructor or other logic
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});

const createMockDataFetcher = () => ({
    fetch: jest.fn().mockRejectedValue(new Error('Mock Fetcher: Path not configured')),
});

const createMockSchemaValidator = () => {
    const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
    const mockValidatorFn = jest.fn(() => ({isValid: true, errors: null}));
    const loadedSchemas = new Map();
    loadedSchemas.set(ruleSchemaId, {}); // Mark schema as loaded

    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === ruleSchemaId) {
                return mockValidatorFn(data);
            }
            return {isValid: true, errors: null};
        }),
        addSchema: jest.fn().mockResolvedValue(undefined),
        isSchemaLoaded: jest.fn().mockImplementation((schemaId) => loadedSchemas.has(schemaId)),
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
describe('RuleLoader - Fetch Failure Handling', () => {
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

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator(); // Already ensures schema is loaded
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // Ensure rule schema ID is configured
        const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === 'system-rules' ? ruleSchemaId : undefined
        );
        mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

        // Default validation pass for the mock validator
        if (mockValidator._mockValidatorFn) {
            mockValidator._mockValidatorFn.mockImplementation(() => ({isValid: true, errors: null}));
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
        const modId = 'test-mod-fetch-fail';
        const ruleType = 'system-rules';
        const fileOK = 'ruleOK.json';
        const fileFail = 'ruleFail.json';
        const fileOKName = 'ruleOK'; // For derived ID
        const resolvedPathOK = `/abs/path/to/mods/${modId}/${ruleType}/${fileOK}`;
        const resolvedPathFail = `/abs/path/to/mods/${modId}/${ruleType}/${fileFail}`;

        const ruleDataOK = {
            // No rule_id, let RuleLoader derive it from filename
            event_type: 'core:eventOK',
            actions: [{type: 'LOG', parameters: {message: 'Rule OK loaded'}}]
        };
        const expectedRuleIdOK = `${modId}:${fileOKName}`; // ID derived from filename

        const fetchError = new Error('404 Not Found'); // Specific error for the failed fetch

        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Fetch Failure Test Mod',
            content: {
                rules: [fileOK, fileFail] // Order matters for predictable processing
            }
        };

        it('should log fetch errors, skip failed files, process valid ones, and return correct count', async () => {
            // Arrange: Configure mocks specific to this test case
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === fileOK) return resolvedPathOK;
                if (mId === modId && type === ruleType && file === fileFail) return resolvedPathFail;
                throw new Error(`Unexpected path resolution call: ${mId}, ${type}, ${file}`);
            });

            // Configure IDataFetcher: Success for OK, Reject for Fail
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathOK) {
                    return Promise.resolve(JSON.parse(JSON.stringify(ruleDataOK))); // Deep clone
                }
                if (filePath === resolvedPathFail) {
                    return Promise.reject(fetchError); // Reject with the specific error
                }
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // Act
            const count = await loader.loadRulesForMod(modId, manifest);

            // Assert
            // Verify fetch attempts
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathOK);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathFail);

            // Verify error log for the failed file (logged by BaseManifestItemLoader._processFileWrapper)
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // --- CORRECTION 1: Match the actual log call ---
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error processing file:', // Actual message
                expect.objectContaining({ // Check context object structure
                    modId: modId,
                    filename: fileFail,
                    path: resolvedPathFail,
                    error: fetchError.message // Base class logs the message string here
                }),
                fetchError // Base class passes the full error object as the third argument
            );

            // Verify registry store for the successful file only
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                expectedRuleIdOK, // Expect the ID derived from filename
                expect.objectContaining(ruleDataOK) // Check data content
            );
            // Ensure store wasn't called for the failed file
            expect(mockRegistry.store).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining(fileFail.replace('.json', '')), // ID would be derived from fileFail
                expect.anything()
            );

            // Verify return count
            expect(count).toBe(1); // Only one rule was successfully processed

            // --- CORRECTION 2: Check actual summary logs ---
            // Verify the final summary log from BaseManifestItemLoader
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 1/2 rules items. (1 failed)`
            );
            // Ensure the initial delegation log was also called
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Delegating rule loading to BaseManifestItemLoader`)
            );
            // Ensure non-existent logs weren't called
            expect(mockLogger.warn).not.toHaveBeenCalledWith( // This specific warning doesn't exist
                expect.stringContaining(`Processed 1 out of 2 rule files successfully`)
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith( // This info log doesn't exist
                expect.stringContaining(`Loading 2 rule file(s)`)
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith( // This specific success wording isn't used
                expect.stringContaining(`Successfully processed and registered all`)
            );

            // Verify debug log for the failed file processing (logged by BaseManifestItemLoader)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[${modId}] Failed processing ${fileFail}. Reason: ${fetchError.message}`
            );
        });
    });
});