// src/tests/core/services/ruleLoader.integration.override.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import path from 'path';
import RuleLoader from '../../../core/services/ruleLoader.js';
// Use the actual InMemoryDataRegistry for stateful testing
import InMemoryDataRegistry from '../../../core/services/inMemoryDataRegistry.js'; // Adjust path if necessary

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

// --- Mock Service Factories (Adapted for Integration Test) ---

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
    resolveModContentPath: jest.fn((modId, typeName, filename) => {
        return `/abs/path/to/mods/${modId}/${typeName}/${filename}`;
    }),
    // Mock other methods required by Base constructor or other logic
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `/abs/path/to/mods/${modId}/mod.manifest.json`), // Use abs path
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
            return {isValid: true, errors: null}; // Default pass
        }),
        // --- Methods required by Base constructor ---
        addSchema: jest.fn().mockResolvedValue(undefined),
        removeSchema: jest.fn().mockReturnValue(true),
        isSchemaLoaded: jest.fn().mockImplementation((schemaId) => loadedSchemas.has(schemaId)), // Use map
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId && loadedSchemas.has(schemaId)) {
                return mockValidatorFn; // Return the mock validator function
            }
            return undefined;
        }),
        _mockValidatorFn: mockValidatorFn, // Expose for potential checks if needed
    };
};

// DataRegistry: Using real InMemoryDataRegistry instance below.

/** Creates a mock ILogger service. */
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
});

// --- Test Suite for Rule Override Integration ---

describe('RuleLoader Integration (Sub-Ticket 4.7: Rule Override "Last Mod Wins")', () => {

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
    let realRegistry; // Using a real registry instance
    /** @type {ILogger} */
    let mockLogger;
    /** @type {RuleLoader} */
    let loader;

    // --- Test Data ---
    const baseModId = 'BaseMod';
    const overrideModId = 'OverrideMod';
    const ruleType = 'system-rules';
    const commonFileName = 'common_rule.json';
    const commonRuleIdInFile = 'common_rule'; // ID inside the JSON data

    // Distinct paths resolved by the mock resolver
    const basePath = `/abs/path/to/mods/${baseModId}/${ruleType}/${commonFileName}`;
    const overridePath = `/abs/path/to/mods/${overrideModId}/${ruleType}/${commonFileName}`;

    // Distinguishable rule data for each mod
    const baseRuleData = {
        rule_id: commonRuleIdInFile,
        event_type: 'base_event',
        actions: [{type: 'LOG', parameters: {message: 'Base rule action'}}]
    };
    const overrideRuleData = {
        rule_id: commonRuleIdInFile, // Same ID as baseRuleData
        event_type: 'override_event', // Different content
        actions: [{type: 'LOG', parameters: {message: 'Override rule action'}}]
    };

    // Final registry IDs (RuleLoader prepends mod ID)
    const finalBaseRuleId = `${baseModId}:${commonRuleIdInFile}`;
    const finalOverrideRuleId = `${overrideModId}:${commonRuleIdInFile}`;

    // Mod manifests
    const baseModManifest = {
        id: baseModId,
        version: '1.0.0',
        name: 'Base Content Mod',
        content: {
            rules: [commonFileName]
        }
    };
    const overrideModManifest = {
        id: overrideModId,
        version: '1.0.0',
        name: 'Override Content Mod',
        content: {
            rules: [commonFileName] // Same filename
        }
    };


    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        // Instantiate mocks using complete factories
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator(); // Always validates true
        mockLogger = createMockLogger();
        // Instantiate a *real* registry to hold state across loads
        // Assuming InMemoryDataRegistry might need a logger
        realRegistry = new InMemoryDataRegistry(mockLogger);

        // Ensure rule schema ID is configured
        const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === ruleType ? ruleSchemaId : undefined
        );
        mockConfig.getRuleSchemaId.mockReturnValue(ruleSchemaId);


        // Configure IDataFetcher mock to return correct data based on path
        mockFetcher.fetch.mockImplementation(async (filePath) => {
            if (filePath === basePath) {
                return Promise.resolve(JSON.parse(JSON.stringify(baseRuleData))); // Deep clone
            }
            if (filePath === overridePath) {
                return Promise.resolve(JSON.parse(JSON.stringify(overrideRuleData))); // Deep clone
            }
            return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${filePath}`));
        });

        // Instantiate the loader with the real registry
        loader = new RuleLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            realRegistry, // Use the real registry instance
            mockLogger
        );
    });

    // --- Test Case ---
    it('should correctly apply the "last mod wins" principle for rules with overlapping IDs', async () => {
        // --- Act ---
        // 1. Load the BaseMod rule
        const countBase = await loader.loadRulesForMod(baseModId, baseModManifest);

        // --- Assert Intermediate State ---
        expect(countBase).toBe(1);
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning yet expected

        // --- ** CORRECTION 1: Define expected STORED data ** ---
        const expectedStoredBaseData = {
            ...baseRuleData,
            id: finalBaseRuleId, // BaseMod:common_rule
            modId: baseModId,
            _sourceFile: commonFileName
        };
        // --- ** END CORRECTION 1 ** ---

        const storedBaseRule = realRegistry.get(ruleType, finalBaseRuleId);
        // --- ** CORRECTION 2: Assert against STORED data ** ---
        expect(storedBaseRule).toEqual(expectedStoredBaseData); // Compare with augmented data
        // --- ** END CORRECTION 2 ** ---

        // --- Act ---
        // 2. Load the OverrideMod rule (which conceptually overrides)
        const countOverride = await loader.loadRulesForMod(overrideModId, overrideModManifest);

        // --- Assert Final State ---
        expect(countOverride).toBe(1);

        // 1. Verify ILogger.warn was NOT called for the overwrite
        //    (Because the final registry keys are different: BaseMod:common_rule vs OverrideMod:common_rule)
        expect(mockLogger.warn).not.toHaveBeenCalled();

        // --- ** CORRECTION 3: Define expected STORED override data ** ---
        const expectedStoredOverrideData = {
            ...overrideRuleData,
            id: finalOverrideRuleId, // OverrideMod:common_rule
            modId: overrideModId,
            _sourceFile: commonFileName
        };
        // --- ** END CORRECTION 3 ** ---

        // 2. Verify IDataRegistry contains the *override* data under the *override* mod's final ID
        const storedOverrideRule = realRegistry.get(ruleType, finalOverrideRuleId);
        // --- ** CORRECTION 4: Assert against STORED override data ** ---
        expect(storedOverrideRule).toEqual(expectedStoredOverrideData); // Compare with augmented data
        // --- ** END CORRECTION 4 ** ---

        // 3. Verify the rule data under the *base* mod's final ID is still present and unchanged
        const storedRuleUnderBaseKey = realRegistry.get(ruleType, finalBaseRuleId);
        // --- ** CORRECTION 5: Assert against STORED base data again ** ---
        expect(storedRuleUnderBaseKey).toEqual(expectedStoredBaseData); // Compare with augmented data
        // --- ** END CORRECTION 5 ** ---

        // 4. Verify fetcher, resolver, validator calls (remain the same)
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(baseModId, ruleType, commonFileName);
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(overrideModId, ruleType, commonFileName);

        expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(basePath);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(overridePath);

        // Schema validation was retrieved and called for both rules
        expect(mockValidator.getValidator).toHaveBeenCalledTimes(2); // Called once per loadRulesForMod call
        const validatorFn = mockValidator._mockValidatorFn; // Use the exposed mock function reference
        expect(validatorFn).toHaveBeenCalledTimes(2); // Called once per rule file
        expect(validatorFn).toHaveBeenCalledWith(expect.objectContaining(baseRuleData)); // Validator sees original data
        expect(validatorFn).toHaveBeenCalledWith(expect.objectContaining(overrideRuleData)); // Validator sees original data

        // Verify logging (remain the same)
        expect(mockLogger.info).toHaveBeenCalledWith(
            `RuleLoader [${baseModId}]: Delegating rule loading to BaseManifestItemLoader using manifest key 'rules' and content directory 'system-rules'.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `RuleLoader [${overrideModId}]: Delegating rule loading to BaseManifestItemLoader using manifest key 'rules' and content directory 'system-rules'.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [${baseModId}] - Processed 1/1 rules items.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [${overrideModId}] - Processed 1/1 rules items.`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            // Debug log from _storeItemInRegistry after successful storage
            `RuleLoader [${baseModId}]: Successfully stored system-rules item '${finalBaseRuleId}' from file '${commonFileName}'.`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            // Debug log from _storeItemInRegistry after successful storage
            `RuleLoader [${overrideModId}]: Successfully stored system-rules item '${finalOverrideRuleId}' from file '${commonFileName}'.`
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});