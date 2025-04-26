// src/tests/core/services/ruleLoader.pathResolution.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import path from 'path'; // Needed for basename generation in mock fetcher
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

// --- Mock Service Factories (Simplified/Adapted for this specific test focus) ---

/** Mocks IConfiguration - only needed methods required */
const createMockConfiguration = (overrides = {}) => ({
    // Need rule schema ID for validation step inside processRulePaths
    getContentTypeSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'), // Also potentially used
    // Other methods mocked minimally if needed by constructor or underlying logic
    ...overrides,
});

/** Mocks IPathResolver - focus on resolveModContentPath */
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `/path/to/mods/${modId}/${typeName}/${filename}`), // Default mock implementation
    // Mock other methods minimally if needed
    ...overrides,
});

/** Mocks IDataFetcher - focus on fetch */
const createMockDataFetcher = () => ({
    // Mock fetch to simulate successful loading based on path
    fetch: jest.fn().mockImplementation(async (filePath) => {
        // Return minimal valid rule data if path seems okay
        // Use basename for rule_id generation as in other tests
        const filenamePart = path.basename(filePath);
        return Promise.resolve({
            rule_id: `rule_from_${filenamePart}`, // Generate ID from filename
            event_type: "core:dummy_event",
            actions: [{type: "LOG", parameters: {message: `Loaded from ${filePath}`}}]
        });
    }),
});

/** Mocks ISchemaValidator - needed for successful processing */
const createMockSchemaValidator = () => {
    const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
    const mockRuleValidatorFn = jest.fn((data) => ({
        // Ensure mock validation passes for the happy path test
        isValid: data && typeof data.event_type === 'string' && Array.isArray(data.actions),
        errors: null
    }));
    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === ruleSchemaId) return mockRuleValidatorFn(data);
            return {isValid: true, errors: null}; // Pass other schemas by default
        }),
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId) return mockRuleValidatorFn;
            return undefined;
        }),
        isSchemaLoaded: jest.fn().mockReturnValue(true), // Assume schema is loaded
        addSchema: jest.fn().mockResolvedValue(undefined),
        removeSchema: jest.fn().mockReturnValue(true),
    };
};

/** Mocks IDataRegistry - needed for successful processing */
const createMockDataRegistry = () => ({
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined), // Default: rule does not exist
    getAllSystemRules: jest.fn().mockReturnValue([]),
});


/** Mocks ILogger - focus on error */
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
});

// --- Test Suite ---

describe('RuleLoader (Sub-Ticket 4.4: Test loadRulesForMod Path Resolution Logic)', () => {
    // --- Mocks & Loader Instance ---
    /** @type {IConfiguration} */
    let mockConfig;
    /** @type {IPathResolver} */
    let mockResolver;
    /** @type {IDataFetcher} */
    let mockFetcher;
    /** @type {ISchemaValidator} */
    let mockValidator;
    /** @type {IDataRegistry} */
    let mockRegistry;
    /** @type {ILogger} */
    let mockLogger;
    /** @type {RuleLoader} */
    let loader;
    // REMOVED: let processRulePathsSpy;

    // --- Shared Test Data ---
    const modId = 'testMod';
    const ruleType = 'system-rules'; // Type name expected by RuleLoader
    const ruleFileA = 'ruleA.json';
    const ruleFileB = 'rules/ruleB.json'; // Note the subdirectory
    const baseRuleIdA = 'rule_from_ruleA.json'; // From mock fetcher
    const baseRuleIdB = 'rule_from_ruleB.json'; // From mock fetcher (using basename)
    const manifest = {
        id: modId, version: '1.0.0', name: 'Path Resolution Test Mod',
        content: {
            rules: [ruleFileA, ruleFileB]
        }
    };

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockLogger = createMockLogger();
        // Instantiate all mocks needed for the full process now
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();

        loader = new RuleLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );

        // REMOVED: Spying attempt
    });

    // --- Cleanup ---
    afterEach(() => {
        // REMOVED: Spy restore
    });

    // --- Test Cases ---

    describe('Successful Path Resolution', () => {
        it('should call IPathResolver.resolveModContentPath for each rule and attempt to fetch the resolved paths', async () => {
            // --- Arrange ---
            // Define specific resolved paths for clarity
            const resolvedPathA = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileA}`;
            const resolvedPathB = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileB}`; // Keep subdirectory structure

            // Configure mock resolver to return these specific paths
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileA) return resolvedPathA;
                if (mId === modId && type === ruleType && file === ruleFileB) return resolvedPathB; // Match the relative path from manifest
                return `unexpected_path_for_${file}`;
            });

            // Mock fetcher needs to know what data to return for these specific paths
            const dataA = {rule_id: baseRuleIdA, event_type: "core:eventA", actions: []};
            const dataB = {rule_id: baseRuleIdB, event_type: "core:eventB", actions: []};
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathA) return Promise.resolve(dataA);
                if (filePath === resolvedPathB) return Promise.resolve(dataB);
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });


            // --- Action ---
            await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Verify IPathResolver.resolveModContentPath calls
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(1, modId, ruleType, ruleFileA);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(2, modId, ruleType, ruleFileB); // Should be called with the relative path

            // 2. Verify IDataFetcher.fetch was called with the resolved paths
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathA);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathB);

            // 3. Verify successful processing occurred (e.g., store was called)
            expect(mockRegistry.store).toHaveBeenCalledTimes(2);
            // *** FIXED Assertion: Use expect.objectContaining or match the exact object ***
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${baseRuleIdA}`, // Final ID generated by RuleLoader
                expect.objectContaining({rule_id: baseRuleIdA}) // Verify the data object structure
            );
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${baseRuleIdB}`, // Final ID generated by RuleLoader
                expect.objectContaining({rule_id: baseRuleIdB}) // Verify the data object structure
            );

            // 4. Verify no errors were logged
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    describe('Path Resolution Failure', () => {
        it('should catch errors from resolveModContentPath, log them, and prevent fetching data', async () => {
            // --- Arrange ---
            const resolvedPathA = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileA}`;
            const resolutionError = new Error(`Mock Resolver Error: Cannot resolve ${ruleFileB}`);

            // Configure mock resolver: success for A, throw for B
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileA) return resolvedPathA;
                if (mId === modId && type === ruleType && file === ruleFileB) throw resolutionError;
                return `unexpected_path_for_${file}`;
            });

            // --- Action ---
            // Now expect loadRulesForMod to catch the error internally and return 0
            const resultCount = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Verify IPathResolver.resolveModContentPath calls (both attempted)
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(1, modId, ruleType, ruleFileA);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(2, modId, ruleType, ruleFileB);

            // 2. Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Should be called once from the catch block in loadRulesForMod
            expect(mockLogger.error).toHaveBeenCalledWith(
                // Check message includes the failing filename specifically
                expect.stringContaining(`RuleLoader [${modId}]: Failed to resolve path for rule file '${ruleFileB}'`),
                expect.objectContaining({ // Check context object
                    modId: modId,
                    filename: ruleFileB, // Verify failing filename is logged
                    manifestRules: manifest.content.rules,
                    error: resolutionError // Verify the original error is included
                })
            );

            // 3. Verify IDataFetcher.fetch was NOT called
            expect(mockFetcher.fetch).not.toHaveBeenCalled();

            // 4. Verify nothing was stored
            expect(mockRegistry.store).not.toHaveBeenCalled();

            // 5. Verify return value indicates failure (0 rules loaded)
            expect(resultCount).toBe(0); // Should return 0 now instead of throwing
        });

        it('should return 0 and not fetch data if the FIRST resolveModContentPath fails', async () => {
            // --- Arrange ---
            const resolutionError = new Error(`Mock Resolver Error: Cannot resolve ${ruleFileA}`);

            // Configure mock resolver: throw for A
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileA) throw resolutionError;
                // We expect it to fail before trying to resolve B
                return `unexpected_path_for_${file}`;
            });

            // --- Action ---
            // Expect loadRulesForMod to catch the error internally and return 0
            const resultCount = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Verify IPathResolver.resolveModContentPath calls (only the first attempted)
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(1, modId, ruleType, ruleFileA);

            // 2. Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                // Check message includes the failing filename specifically
                expect.stringContaining(`RuleLoader [${modId}]: Failed to resolve path for rule file '${ruleFileA}'`),
                expect.objectContaining({
                    modId: modId,
                    filename: ruleFileA, // Verify failing filename is logged
                    error: resolutionError
                })
            );

            // 3. Verify IDataFetcher.fetch was NOT called
            expect(mockFetcher.fetch).not.toHaveBeenCalled();

            // 4. Verify nothing was stored
            expect(mockRegistry.store).not.toHaveBeenCalled();

            // 5. Verify return value indicates failure
            expect(resultCount).toBe(0); // Should return 0 now instead of throwing
        });
    });
});