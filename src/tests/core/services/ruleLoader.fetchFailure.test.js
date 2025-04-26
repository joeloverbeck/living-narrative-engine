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
    ...overrides,
});

const createMockDataFetcher = () => ({
    fetch: jest.fn().mockRejectedValue(new Error('Mock Fetcher: Path not configured')),
});

const createMockSchemaValidator = () => {
    const mockValidatorFn = jest.fn(() => ({isValid: true, errors: null}));
    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === 'http://example.com/schemas/system-rule.schema.json') {
                return mockValidatorFn(data);
            }
            return {isValid: true, errors: null};
        }),
        addSchema: jest.fn().mockResolvedValue(undefined),
        isSchemaLoaded: jest.fn().mockReturnValue(true),
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === 'http://example.com/schemas/system-rule.schema.json') {
                return mockValidatorFn;
            }
            return undefined;
        }),
        _mockValidatorFn: mockValidatorFn,
    };
};

const createMockDataRegistry = () => ({
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined),
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
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => schemaId === ruleSchemaId);
        mockValidator.getValidator.mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId) return mockValidator._mockValidatorFn;
            return undefined;
        });
        if (mockValidator._mockValidatorFn) {
            mockValidator._mockValidatorFn.mockImplementation((data) => ({isValid: true}));
        }
        mockRegistry.get.mockReturnValue(undefined);

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
        const resolvedPathOK = `/abs/path/to/mods/${modId}/${ruleType}/${fileOK}`;
        const resolvedPathFail = `/abs/path/to/mods/${modId}/${ruleType}/${fileFail}`;

        const ruleDataOK = {
            rule_id: 'ruleOK_id',
            event_type: 'core:eventOK',
            actions: [{type: 'LOG', parameters: {message: 'Rule OK loaded'}}]
        };

        const fetchError = new Error('404 Not Found');

        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Fetch Failure Test Mod',
            content: {
                rules: [fileOK, fileFail]
            }
        };

        it('should log fetch errors, skip failed files, process valid ones, and return correct count', async () => {
            // Arrange: Configure mocks specific to this test case
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === fileOK) return resolvedPathOK;
                if (mId === modId && type === ruleType && file === fileFail) return resolvedPathFail;
                // console.error(`DEBUG: Unexpected path resolution call: ${mId}, ${type}, ${file}`);
                throw new Error(`Unexpected path resolution call: ${mId}, ${type}, ${file}`);
            });

            // Configure IDataFetcher: Success for OK, Reject for Fail
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                // --- DEBUG LOG ---
                // console.log(`DEBUG: Mock fetcher called with path: "${filePath}"`);
                // console.log(`DEBUG: Comparing with OK path:   "${resolvedPathOK}"`);
                // console.log(`DEBUG: Comparing with Fail path: "${resolvedPathFail}"`);
                // --- END DEBUG ---

                if (filePath === resolvedPathOK) {
                    // --- DEBUG LOG ---
                    // console.log(`DEBUG: Mock fetcher: Matched OK path: "${filePath}" - RESOLVING`);
                    // --- END DEBUG ---
                    return Promise.resolve(JSON.parse(JSON.stringify(ruleDataOK))); // Deep clone
                }
                if (filePath === resolvedPathFail) {
                    // --- DEBUG LOG ---
                    // console.log(`DEBUG: Mock fetcher: Matched Fail path: "${filePath}" - REJECTING`);
                    // --- END DEBUG ---
                    return Promise.reject(fetchError); // Reject with the specific error
                }
                // --- DEBUG LOG ---
                // console.error(`DEBUG: Mock fetcher: UNEXPECTED path: "${filePath}" - REJECTING with fallback error`);
                // --- END DEBUG ---
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // Act
            const count = await loader.loadRulesForMod(modId, manifest);

            // Assert
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathOK);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathFail);

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`RuleLoader [${modId}]: Failed to fetch rule file '${fileFail}'. Skipping.`),
                expect.objectContaining({
                    error: fetchError,
                    modId: modId,
                    filePath: resolvedPathFail
                })
            );

            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${ruleDataOK.rule_id}`,
                ruleDataOK
            );
            expect(mockRegistry.store).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining(fileFail.replace('.json', '')),
                expect.anything()
            );

            // --- DEBUG LOG ---
            // console.log(`DEBUG: Final count returned by loadRulesForMod: ${count}`);
            // --- END DEBUG ---
            expect(count).toBe(1); // <<< FAILING ASSERTION

            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`RuleLoader [${modId}]: Processed 1 out of 2 rule files successfully (some failed).`)
            );

            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered all`)
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`RuleLoader [${modId}]: Loading 2 rule file(s) specified by manifest.`)
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered rule '${modId}:${ruleDataOK.rule_id}' from file '${fileOK}'.`)
            );
        });
    });
});