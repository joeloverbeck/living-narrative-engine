// src/tests/core/services/ruleLoader.processing.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
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

describe('RuleLoader (Sub-Ticket 4.5: Test Rule Processing Logic via loadRulesForMod)', () => {

    // --- Mocks & Loader Instance (shared across this sub-ticket suite) ---
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

    // --- Shared Setup (run before each test in this suite) ---
    beforeEach(() => {
        jest.clearAllMocks();

        // Arrange: Instantiate and configure mocks using complete factories
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
        mockRuleValidatorFn.mockImplementation((data) => ({isValid: true})); // Default pass validation
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


    describe('Ticket 4.5.1: Happy Path Rule Processing', () => {
        // --- Test Specific Data ---
        const modId = 'test-mod-happy';
        const ruleType = 'system-rules';
        const fileA = 'ruleA.json';
        const fileBRelative = 'subdir/ruleB.json';
        const fileBBasename = 'ruleB'; // Basename without extension for ID fallback
        const resolvedPathA = `/abs/path/to/mods/${modId}/${ruleType}/${fileA}`;
        const resolvedPathB = `/abs/path/to/mods/${modId}/${ruleType}/${fileBRelative}`;

        const ruleDataA = {
            rule_id: 'ruleA_id', // Explicit ID
            event_type: 'core:eventA',
            actions: [{type: 'LOG', parameters: {message: 'Rule A loaded'}}]
        };
        const ruleDataB = {
            // No explicit rule_id
            event_type: 'core:eventB',
            actions: [{type: 'LOG', parameters: {message: 'Rule B loaded'}}]
        };

        const manifest = {
            id: modId,
            version: '1.0.0',
            name: 'Happy Path Test Mod',
            content: {
                rules: [fileA, `  ${fileBRelative}  `] // Include whitespace
            }
        };

        // --- Test Case ---
        it('should successfully process multiple valid rules from manifest', async () => {
            // Arrange: Configure mocks specific to this test case
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === fileA) return resolvedPathA;
                // Base class trims the filename before resolving
                if (mId === modId && type === ruleType && file === fileBRelative.trim()) return resolvedPathB;
                throw new Error(`Unexpected path resolution call: ${mId}, ${type}, ${file}`);
            });

            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPathA) return Promise.resolve(JSON.parse(JSON.stringify(ruleDataA)));
                if (filePath === resolvedPathB) return Promise.resolve(JSON.parse(JSON.stringify(ruleDataB)));
                return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for path ${filePath}`));
            });

            // Act
            const count = await loader.loadRulesForMod(modId, manifest);

            // Assert
            // Verify IPathResolver.resolveModContentPath calls
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, ruleType, fileA);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, ruleType, fileBRelative.trim()); // Trimmed filename

            // Verify IDataFetcher.fetch calls
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathA);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPathB);

            // Verify ISchemaValidator interactions
            // --- CORRECTION 1: Expect getValidator to be called twice ---
            expect(mockValidator.getValidator).toHaveBeenCalledTimes(2); // Called once per rule processed
            expect(mockValidator.getValidator).toHaveBeenCalledWith('http://example.com/schemas/system-rule.schema.json');
            expect(mockRuleValidatorFn).toHaveBeenCalledTimes(2);
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(ruleDataA);
            expect(mockRuleValidatorFn).toHaveBeenCalledWith(ruleDataB);

            // Verify IDataRegistry.store calls
            expect(mockRegistry.store).toHaveBeenCalledTimes(2);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${ruleDataA.rule_id}`, // modId:explicit_id
                ruleDataA
            );
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${fileBBasename}`,       // modId:filename_base
                ruleDataB
            );

            // Verify return value
            expect(count).toBe(2);

            // --- CORRECTION 2: Verify actual logging ---
            // Verify the initial delegation info log was called
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Delegating rule loading to BaseManifestItemLoader`)
            );
            // Verify the final summary log from BaseManifestItemLoader (INFO level)
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 2/2 rules items.`
            );

            // Verify the debug logs for successful storage
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `RuleLoader [${modId}]: Successfully stored rule '${modId}:${ruleDataA.rule_id}' from file '${fileA}'.`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                // Use the trimmed filename as passed to _processFetchedItem
                `RuleLoader [${modId}]: Successfully stored rule '${modId}:${fileBBasename}' from file '${fileBRelative.trim()}'.`
            );

            // Ensure incorrect logs weren't called
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Loading 2 rule file(s)`) // This info log doesn't exist
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered all`) // This specific wording isn't used
            );
            // Verify no warnings or errors
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            // --- End Correction 2 ---
        });
    });


    // --- Add more describe blocks for future tickets (4.5.3, 4.5.4, etc.) here ---

});