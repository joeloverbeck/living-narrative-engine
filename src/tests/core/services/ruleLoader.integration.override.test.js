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
        if (typeName === 'rules') {
            return 'http://example.com/schemas/rule.schema.json';
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
    getRuleBasePath: jest.fn().mockReturnValue('rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/rule.schema.json'),
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
    const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';
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
        // --- Base class constructor requires these ---
        getModsBasePath: jest.fn().mockReturnValue('mods'),
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

// *** UPDATED describe block title slightly ***
describe('RuleLoader Integration (Rule Override via loadItemsForMod)', () => {

    // --- Mocks & Loader Instance ---
    /** @type {IConfiguration} */
    let mockConfig;
    /** @type {IPathResolver} */
    let mockResolver;
    /** @type {IDataFetcher} */
    let mockFetcher;
    /** @type {ISchemaValidator & { _mockValidatorFn?: jest.Mock }} */
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
    // *** Define constants for RuleLoader specific args ***
    const RULE_CONTENT_KEY = 'rules';
    const RULE_CONTENT_DIR = 'rules';
    const RULE_TYPE_NAME = 'rules';
    const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';

    const commonFileName = 'common_rule.json';
    const commonRuleIdInFile = 'common_rule'; // ID inside the JSON data

    // Distinct paths resolved by the mock resolver
    const basePath = `/abs/path/to/mods/${baseModId}/${RULE_CONTENT_DIR}/${commonFileName}`;
    const overridePath = `/abs/path/to/mods/${overrideModId}/${RULE_CONTENT_DIR}/${commonFileName}`;

    // Distinguishable rule data for each mod
    const baseRuleData = {
        rule_id: commonRuleIdInFile,
        event_type: 'base_event',
        actions: [{type: 'LOG', parameters: {message: 'Base rule action'}}]
    };
    const overrideRuleData = {
        rule_id: commonRuleIdInFile, // Same base ID as baseRuleData
        event_type: 'override_event', // Different content
        actions: [{type: 'LOG', parameters: {message: 'Override rule action'}}]
    };

    // Final registry IDs (Base class prepends mod ID)
    const finalBaseRuleId = `${baseModId}:${commonRuleIdInFile}`;
    const finalOverrideRuleId = `${overrideModId}:${commonRuleIdInFile}`;

    // Mod manifests
    const baseModManifest = {
        id: baseModId,
        version: '1.0.0',
        name: 'Base Content Mod',
        content: {
            // Use constant for key
            [RULE_CONTENT_KEY]: [commonFileName]
        }
    };
    const overrideModManifest = {
        id: overrideModId,
        version: '1.0.0',
        name: 'Override Content Mod',
        content: {
            // Use constant for key
            [RULE_CONTENT_KEY]: [commonFileName] // Same filename
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
        realRegistry = new InMemoryDataRegistry(mockLogger); // Pass mock logger if needed by registry

        // Ensure rule schema ID is configured via base method
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === RULE_TYPE_NAME ? ruleSchemaId : undefined
        );
        // Mock specific getter if RuleLoader uses it
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
        // *** UPDATED: Call loadItemsForMod ***
        const countBase = await loader.loadItemsForMod(
            baseModId,
            baseModManifest,
            RULE_CONTENT_KEY,
            RULE_CONTENT_DIR,
            RULE_TYPE_NAME
        );

        // --- Assert Intermediate State ---
        expect(countBase).toBe(1);
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning expected, keys are different

        // Define expected STORED data for base rule
        const expectedStoredBaseData = {
            ...baseRuleData,
            id: finalBaseRuleId, // BaseMod:common_rule
            modId: baseModId,
            _sourceFile: commonFileName
        };

        const storedBaseRule = realRegistry.get(RULE_TYPE_NAME, finalBaseRuleId);
        expect(storedBaseRule).toEqual(expectedStoredBaseData); // Compare with augmented data

        // --- Act ---
        // 2. Load the OverrideMod rule
        // *** UPDATED: Call loadItemsForMod ***
        const countOverride = await loader.loadItemsForMod(
            overrideModId,
            overrideModManifest,
            RULE_CONTENT_KEY,
            RULE_CONTENT_DIR,
            RULE_TYPE_NAME
        );

        // --- Assert Final State ---
        expect(countOverride).toBe(1);

        // 1. Verify ILogger.warn was NOT called for overwrite
        // (Base class checks for overwrite using the FINAL key, which includes modId)
        expect(mockLogger.warn).not.toHaveBeenCalled();

        // Define expected STORED override data
        const expectedStoredOverrideData = {
            ...overrideRuleData,
            id: finalOverrideRuleId, // OverrideMod:common_rule
            modId: overrideModId,
            _sourceFile: commonFileName
        };

        // 2. Verify IDataRegistry contains the *override* data under the *override* mod's final ID
        const storedOverrideRule = realRegistry.get(RULE_TYPE_NAME, finalOverrideRuleId);
        expect(storedOverrideRule).toEqual(expectedStoredOverrideData); // Compare with augmented data

        // 3. Verify the rule data under the *base* mod's final ID is still present and unchanged
        const storedRuleUnderBaseKey = realRegistry.get(RULE_TYPE_NAME, finalBaseRuleId);
        expect(storedRuleUnderBaseKey).toEqual(expectedStoredBaseData); // Compare with augmented data

        // 4. Verify fetcher, resolver, validator calls
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(baseModId, RULE_CONTENT_DIR, commonFileName);
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(overrideModId, RULE_CONTENT_DIR, commonFileName);

        expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(basePath);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(overridePath);

        // Schema validation was retrieved and called for both rules
        expect(mockValidator.getValidator).toHaveBeenCalledTimes(2);
        const validatorFn = mockValidator._mockValidatorFn;
        if (validatorFn) { // Check if the mock function exists
            expect(validatorFn).toHaveBeenCalledTimes(2);
            expect(validatorFn).toHaveBeenCalledWith(expect.objectContaining(baseRuleData));
            expect(validatorFn).toHaveBeenCalledWith(expect.objectContaining(overrideRuleData));
        } else {
            // Fail test if the validator mock wasn't exposed correctly
            throw new Error("Mock validator function (_mockValidatorFn) not found on mockValidator.");
        }


        // Verify logging
        expect(mockLogger.info).toHaveBeenCalledWith(
            `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${baseModId}'.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${overrideModId}'.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [${baseModId}] - Processed 1/1 ${RULE_CONTENT_KEY} items.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [${overrideModId}] - Processed 1/1 ${RULE_CONTENT_KEY} items.`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            // Debug log from _storeItemInRegistry after successful storage
            `RuleLoader [${baseModId}]: Successfully stored ${RULE_TYPE_NAME} item '${finalBaseRuleId}' from file '${commonFileName}'.`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            // Debug log from _storeItemInRegistry after successful storage
            `RuleLoader [${overrideModId}]: Successfully stored ${RULE_TYPE_NAME} item '${finalOverrideRuleId}' from file '${commonFileName}'.`
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});