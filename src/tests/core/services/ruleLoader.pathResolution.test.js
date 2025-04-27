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

// --- Mock Service Factories (CORRECTED to be complete) ---

/** Mocks IConfiguration - Needs all methods required by BaseManifestItemLoader */
const createMockConfiguration = (overrides = {}) => ({
    // --- Methods required by BaseManifestItemLoader constructor ---
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'), // Added
    getContentTypeSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
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


/** Mocks IPathResolver - focus on resolveModContentPath */
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `/path/to/mods/${modId}/${typeName}/${filename}`), // Default mock implementation
    // Mock other methods required by Base constructor or other logic
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});

/** Mocks IDataFetcher - focus on fetch */
const createMockDataFetcher = () => ({
    fetch: jest.fn().mockImplementation(async (filePath) => {
        const filenamePart = path.basename(filePath);
        const namePart = path.parse(filenamePart).name;
        // Return data without rule_id, let RuleLoader derive it
        return Promise.resolve({
            event_type: "core:dummy_event",
            actions: [{type: "LOG", parameters: {message: `Loaded from ${filePath}`}}]
        });
    }),
});

/** Mocks ISchemaValidator - needed for successful processing */
const createMockSchemaValidator = () => {
    const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
    const mockRuleValidatorFn = jest.fn((data) => ({
        isValid: data && typeof data.event_type === 'string' && Array.isArray(data.actions),
        errors: null
    }));
    const loadedSchemas = new Map();
    loadedSchemas.set(ruleSchemaId, {}); // Mark as loaded

    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) return mockRuleValidatorFn(data);
            return {isValid: true, errors: null}; // Pass other schemas by default
        }),
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) return mockRuleValidatorFn;
            return undefined;
        }),
        isSchemaLoaded: jest.fn().mockImplementation((schemaId) => loadedSchemas.has(schemaId)), // Use the map
        // --- Methods required by Base constructor ---
        addSchema: jest.fn().mockResolvedValue(undefined), // Mock required methods
        removeSchema: jest.fn().mockReturnValue(true),
        // Expose mock if needed
        _mockValidatorFn: mockRuleValidatorFn,
    };
};

/** Mocks IDataRegistry - needed for successful processing */
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

    // --- Shared Test Data ---
    const modId = 'testMod';
    const ruleType = 'system-rules'; // Type name expected by RuleLoader
    const ruleFileA = 'ruleA.json';
    const ruleFileB = 'rules/ruleB.json'; // Note the subdirectory
    const ruleNameA = 'ruleA'; // Base name for ID
    const ruleNameB = 'ruleB'; // Base name for ID
    const manifest = {
        id: modId, version: '1.0.0', name: 'Path Resolution Test Mod',
        content: {
            rules: [ruleFileA, ruleFileB]
        }
    };

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        // Use corrected, complete mock factories
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockLogger = createMockLogger();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();

        // Ensure rule schema ID is configured
        const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === ruleType ? ruleSchemaId : undefined
        );
        mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);

        loader = new RuleLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );
    });

    // --- Cleanup ---
    afterEach(() => {
        // jest.restoreAllMocks(); // Usually not needed if mocks are recreated in beforeEach
    });

    // --- Test Cases ---

    describe('Successful Path Resolution', () => {
        it('should call IPathResolver.resolveModContentPath for each rule and attempt to fetch the resolved paths', async () => {
            // --- Arrange ---
            const resolvedPathA = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileA}`;
            const resolvedPathB = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileB}`;

            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileA) return resolvedPathA;
                if (mId === modId && type === ruleType && file === ruleFileB) return resolvedPathB;
                throw new Error(`Unexpected resolveModContentPath call: ${mId}, ${type}, ${file}`);
            });

            const dataA = {event_type: "core:eventA", actions: []};
            const dataB = {event_type: "core:eventB", actions: []};
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathA) return Promise.resolve(dataA);
                if (filePath === resolvedPathB) return Promise.resolve(dataB);
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // --- Action ---
            const count = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            expect(count).toBe(2); // Both should succeed

            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(1, modId, ruleType, ruleFileA);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(2, modId, ruleType, ruleFileB);

            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathA);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathB);

            expect(mockRegistry.store).toHaveBeenCalledTimes(2);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${ruleNameA}`, // Derived ID
                expect.objectContaining(dataA)
            );
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${ruleNameB}`, // Derived ID
                expect.objectContaining(dataB)
            );

            expect(mockLogger.error).not.toHaveBeenCalled();
            // Check final summary log
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 2/2 rules items.`
            );
        });
    });

    describe('Path Resolution Failure', () => {
        it('should catch errors from resolveModContentPath, log them, and process other files', async () => {
            // --- Arrange ---
            const resolvedPathA = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileA}`;
            const resolutionError = new Error(`Mock Resolver Error: Cannot resolve ${ruleFileB}`);

            // Configure mock resolver: success for A, throw for B
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileA) return resolvedPathA;
                if (mId === modId && type === ruleType && file === ruleFileB) throw resolutionError;
                throw new Error(`Unexpected resolveModContentPath call: ${mId}, ${type}, ${file}`);
            });

            // Mock fetcher needs to handle the successful path A
            const dataA = {event_type: "core:eventA", actions: []};
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathA) return Promise.resolve(dataA);
                // Fetch should NOT be called for B because resolution fails first
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });


            // --- Action ---
            // Because BaseManifestItemLoader uses Promise.allSettled, it will process A
            // even though resolving B throws. The count returned will be 1.
            const resultCount = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Verify IPathResolver.resolveModContentPath calls (both attempted)
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(1, modId, ruleType, ruleFileA);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(2, modId, ruleType, ruleFileB);

            // 2. Verify error was logged for file B (by _processFileWrapper)
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // --- CORRECTION 2: Match actual error log format ---
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error processing file:', // Actual message
                expect.objectContaining({ // Context object structure
                    modId: modId,
                    filename: ruleFileB,
                    path: 'Path not resolved', // Path is null because resolution failed
                    error: resolutionError.message
                }),
                resolutionError // Full error object as 3rd arg
            );

            // 3. Verify IDataFetcher.fetch was called ONLY for A
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathA);
            expect(mockFetcher.fetch).not.toHaveBeenCalledWith(expect.stringContaining(ruleFileB));

            // 4. Verify only rule A was stored
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${ruleNameA}`, // Derived ID
                expect.objectContaining(dataA)
            );

            // --- CORRECTION 3: Expect count to be 1 due to Promise.allSettled ---
            expect(resultCount).toBe(1); // Should return 1 (for file A)

            // Check final summary log indicates partial success
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 1/2 rules items. (1 failed)`
            );
        });

        it('should process file B if the FIRST resolveModContentPath fails', async () => {
            // --- Arrange ---
            const resolvedPathB = `/abs/path/to/mods/${modId}/${ruleType}/${ruleFileB}`;
            const resolutionError = new Error(`Mock Resolver Error: Cannot resolve ${ruleFileA}`);

            // Configure mock resolver: throw for A, success for B
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFileA) throw resolutionError;
                if (mId === modId && type === ruleType && file === ruleFileB) return resolvedPathB;
                throw new Error(`Unexpected resolveModContentPath call: ${mId}, ${type}, ${file}`);
            });

            // Mock fetcher needs to handle the successful path B
            const dataB = {event_type: "core:eventB", actions: []};
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathB) return Promise.resolve(dataB);
                // Fetch should NOT be called for A because resolution fails first
                return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
            });

            // --- Action ---
            const resultCount = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Verify IPathResolver.resolveModContentPath calls (both attempted)
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(1, modId, ruleType, ruleFileA);
            expect(mockResolver.resolveModContentPath).toHaveBeenNthCalledWith(2, modId, ruleType, ruleFileB);


            // 2. Verify error was logged for file A
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // --- CORRECTION 2: Match actual error log format ---
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error processing file:',
                expect.objectContaining({
                    modId: modId,
                    filename: ruleFileA,
                    path: 'Path not resolved',
                    error: resolutionError.message
                }),
                resolutionError
            );

            // 3. Verify IDataFetcher.fetch was called ONLY for B
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathB);
            expect(mockFetcher.fetch).not.toHaveBeenCalledWith(expect.stringContaining(ruleFileA));


            // 4. Verify only rule B was stored
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${ruleNameB}`, // Derived ID
                expect.objectContaining(dataB)
            );

            // --- CORRECTION 3: Expect count to be 1 due to Promise.allSettled ---
            expect(resultCount).toBe(1); // Should return 1 (for file B)

            // Check final summary log indicates partial success
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 1/2 rules items. (1 failed)`
            );
        });
    });
});