// src/tests/core/services/ruleLoader.manifest.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
// *** ADDED path import for basename extraction in test ***
import path from 'path';
import RuleLoader from '../../../core/services/ruleLoader.js'; // Adjust path as necessary
// Import interfaces for JSDoc typing
/**
 * @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../core/interfaces/coreServices.js').ModManifest} ModManifest // Assuming ModManifest type exists or define basic structure
 */

// --- Mock Service Factories (Copied from ruleLoader.test.js for consistency) ---

/**
 * Creates a mock IConfiguration service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
    getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'rules') {
            return 'http://example.com/schemas/rule.schema.json';
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
    getRuleBasePath: jest.fn().mockReturnValue('rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/rule.schema.json'),
    ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {IPathResolver} Mocked path resolver service.
 */
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});

// --- Mock DataFetcher (Now needed for valid input tests) ---
const createMockDataFetcher = () => ({
    fetch: jest.fn().mockImplementation(async (filePath) => { // Renamed variable for clarity
        // Default success for valid paths, return minimal valid rule data
        if (filePath.includes('.json')) {
            const filenamePart = path.basename(filePath); // e.g., "rule1.json", "rule2.json"
            // No need to provide rule_id, RuleLoader derives it
            return Promise.resolve({
                event_type: "core:dummy_event",
                actions: [{type: "LOG", parameters: {message: `Loaded from ${filePath}`}}]
            });
        }
        return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for path ${filePath}`));
    }),
});

// --- Mock SchemaValidator (Now needed for valid input tests) ---
const createMockSchemaValidator = () => {
    const ruleSchemaId = 'http://example.com/schemas/rule.schema.json';
    // Mock validator function for the rule schema
    const mockRuleValidatorFn = jest.fn((data) => {
        const isValid = data && typeof data.event_type === 'string' && Array.isArray(data.actions);
        return {
            isValid: isValid,
            errors: isValid ? null : [{message: "Mock validation failed: missing required fields"}]
        };
    });
    const loadedSchemas = new Map();
    loadedSchemas.set(ruleSchemaId, {}); // Mark schema as loaded

    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === ruleSchemaId) {
                return mockRuleValidatorFn(data);
            }
            return {isValid: true, errors: null};
        }),
        addSchema: jest.fn().mockResolvedValue(undefined),
        isSchemaLoaded: jest.fn().mockImplementation((schemaId) => loadedSchemas.has(schemaId)),
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (loadedSchemas.has(schemaId) && schemaId === ruleSchemaId) {
                return mockRuleValidatorFn;
            }
            return undefined;
        }),
        // --- Base class constructor requires these ---
        removeSchema: jest.fn().mockReturnValue(true),
        _getLoadedSchemas: () => loadedSchemas,
    };
};

// --- Mock DataRegistry (Now needed for valid input tests) ---
const createMockDataRegistry = () => ({
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined), // Default: rule does not exist
    // --- Base class constructor requires these ---
    getAll: jest.fn(() => []),
    clear: jest.fn(),
    getManifest: jest.fn().mockReturnValue(null),
    setManifest: jest.fn(),
    // --- RuleLoader specific (if used directly) ---
    getAllSystemRules: jest.fn().mockReturnValue([]),
});

/**
 * Creates a mock ILogger service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
});

// --- Test Suite ---

// *** UPDATED describe block title slightly ***
describe('RuleLoader (Manifest Input Handling via loadItemsForMod)', () => {
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
    const modId = 'manifest-test-mod';
    // *** Define constants for RuleLoader specific args ***
    const RULE_CONTENT_KEY = 'rules';
    const RULE_CONTENT_DIR = 'rules';
    const RULE_TYPE_NAME = 'rules';

    const defaultRuleSchemaId = 'http://example.com/schemas/rule.schema.json';

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator(); // Ensure schema is marked loaded
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // Ensure config returns the rule schema ID correctly via base class method
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === RULE_TYPE_NAME ? defaultRuleSchemaId : undefined
        );
        // Also mock the specific getter if RuleLoader uses it
        mockConfig.getRuleSchemaId.mockReturnValue(defaultRuleSchemaId);

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

    // --- Valid Input ---
    describe('Valid Input', () => {
        it('should resolve valid rule filenames and process them successfully', async () => {
            const ruleFile1 = "rule1.json";
            const ruleFile1Name = "rule1"; // Base name part for ID generation
            const ruleFile2Relative = "sub/rule2.json"; // Relative path including subfolder
            const ruleFile2Name = "rule2"; // Base name part for ID generation

            const manifest = {
                id: modId, version: '1.0.0', name: 'Valid Test Mod',
                content: {
                    // Use constant for content key
                    [RULE_CONTENT_KEY]: [ruleFile1, ` ${ruleFile2Relative} `] // Include whitespace to test trimming
                }
            };
            // Expected paths based on mock resolver and RULE_CONTENT_DIR
            const resolvedPath1 = `./data/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFile1}`;
            const resolvedPath2 = `./data/mods/${modId}/${RULE_CONTENT_DIR}/${ruleFile2Relative.trim()}`; // Path includes subfolder, use trimmed filename

            // Configure mock resolver
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === RULE_CONTENT_DIR && file === ruleFile1) return resolvedPath1;
                if (mId === modId && type === RULE_CONTENT_DIR && file === ruleFile2Relative.trim()) return resolvedPath2;
                throw new Error(`Unexpected resolveModContentPath call: ${mId}, ${type}, ${file}`);
            });

            // Configure fetcher to return data without rule_id (RuleLoader will derive it)
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPath1) return {event_type: "core:event1", actions: []};
                if (filePath === resolvedPath2) return {event_type: "core:event2", actions: []};
                throw new Error(`Mock Fetch Error: 404 for ${filePath}`);
            });

            // --- Action ---
            // *** UPDATED: Call loadItemsForMod with all required arguments ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            // --- Assert ---
            // 1. Verify Path Resolver calls
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, RULE_CONTENT_DIR, ruleFile1);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, RULE_CONTENT_DIR, ruleFile2Relative.trim()); // Verify trimming happened before resolving

            // 2. Verify Fetcher, Validator, Registry were called
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPath1);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPath2);

            // Check that validator was retrieved and used
            expect(mockValidator.getValidator).toHaveBeenCalledWith(defaultRuleSchemaId);
            const ruleValidatorFn = mockValidator.getValidator(defaultRuleSchemaId);
            expect(ruleValidatorFn).toHaveBeenCalledTimes(2);

            // Check that store was called twice with correctly derived IDs
            expect(mockRegistry.store).toHaveBeenCalledTimes(2);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                RULE_TYPE_NAME,
                `${modId}:${ruleFile1Name}`, // ID derived from filename 'rule1.json'
                expect.objectContaining({event_type: "core:event1"})
            );
            expect(mockRegistry.store).toHaveBeenCalledWith(
                RULE_TYPE_NAME,
                `${modId}:${ruleFile2Name}`, // ID derived from filename 'rule2.json'
                expect.objectContaining({event_type: "core:event2"})
            );

            // 3. Return value should be the actual count of successfully processed rules
            expect(count).toBe(2);

            // Verify logging
            expect(mockLogger.info).toHaveBeenCalledWith(
                `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 2/2 ${RULE_CONTENT_KEY} items.`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    // --- Invalid Manifest Structure ---
    describe('Invalid Manifest Structure', () => {

        // *** UPDATED TEST for null manifest based on BaseManifestItemLoader behavior ***
        it('should return 0 and log error if manifest is null', async () => {
            // --- Action ---
            const count = await loader.loadItemsForMod(
                modId,
                null, // Invalid manifest
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            // --- Assert ---
            expect(count).toBe(0); // Should return 0 based on base class validation

            // Verify ERROR log occurred from base class
            expect(mockLogger.error).toHaveBeenCalledWith(
                `RuleLoader: Invalid 'modManifest' provided for loading ${RULE_TYPE_NAME} for mod '${modId}'. Must be a non-null object. Received: object` // typeof null is 'object'
            );

            // Verify other steps weren't reached
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('should return 0 and log debug if manifest is an empty object', async () => {
            // --- Action ---
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                {}, // Empty manifest
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            // --- Assert ---
            expect(count).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Mod '${modId}': Content key '${RULE_CONTENT_KEY}' not found or is null/undefined in manifest. Skipping.`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `No valid ${RULE_CONTENT_KEY} filenames found for mod ${modId}.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return 0 and log debug if manifest.content is null', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: null};
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            expect(count).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Mod '${modId}': Content key '${RULE_CONTENT_KEY}' not found or is null/undefined in manifest. Skipping.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return 0 and log debug if manifest.content is an empty object', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {}};
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            expect(count).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Mod '${modId}': Content key '${RULE_CONTENT_KEY}' not found or is null/undefined in manifest. Skipping.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return 0 and log debug if manifest.content.rules is null', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {[RULE_CONTENT_KEY]: null}};
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            expect(count).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Mod '${modId}': Content key '${RULE_CONTENT_KEY}' not found or is null/undefined in manifest. Skipping.`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('should return 0 and log warn if manifest.content.rules is not an array (string)', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {[RULE_CONTENT_KEY]: "not-an-array"}};
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            expect(count).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Mod '${modId}': Expected an array for content key '${RULE_CONTENT_KEY}' but found type 'string'. Skipping.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('should return 0 and log warn if manifest.content.rules is not an array (number)', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {[RULE_CONTENT_KEY]: 123}};
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            expect(count).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Mod '${modId}': Expected an array for content key '${RULE_CONTENT_KEY}' but found type 'number'. Skipping.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });
    });

    // --- Empty/Invalid Entries in rules Array ---
    describe('Empty/Invalid Entries in rules Array', () => {
        it('should return 0 and log debug if manifest.content.rules is an empty array', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {[RULE_CONTENT_KEY]: []}};
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            expect(count).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `No valid ${RULE_CONTENT_KEY} filenames found for mod ${modId}.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should filter out invalid entries, log warnings, and process only valid ones', async () => {
            const validFile = "valid.json";
            const validFileName = "valid"; // For ID check
            const manifest = {
                id: modId,
                version: '1.0.0',
                name: 'Mixed Validity Mod',
                content: {
                    // Use constant for content key
                    [RULE_CONTENT_KEY]: ["", null, 123, "   ", undefined, {invalid: true}, validFile, "  "]
                }
            };
            const resolvedValidPath = `./data/mods/${modId}/${RULE_CONTENT_DIR}/${validFile}`;

            // Configure resolver and fetcher for the valid path
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === RULE_CONTENT_DIR && file === validFile) return resolvedValidPath;
                throw new Error(`Unexpected resolveModContentPath call: ${mId}, ${type}, ${file}`);
            });
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedValidPath) return {event_type: "core:valid_event", actions: []};
                throw new Error(`Mock Fetch Error: 404 for ${filePath}`);
            });

            // --- Action ---
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            // --- Assert ---
            // 1. Check Warnings (from base class _extractValidFilenames)
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in '${RULE_CONTENT_KEY}' list:`, 123);
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in '${RULE_CONTENT_KEY}' list:`, {invalid: true});
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in '${RULE_CONTENT_KEY}' list:`, undefined);
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in '${RULE_CONTENT_KEY}' list after trimming. Skipping.`); // For ""
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in '${RULE_CONTENT_KEY}' list after trimming. Skipping.`); // For "   "
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in '${RULE_CONTENT_KEY}' list after trimming. Skipping.`); // For "  "

            // 2. Check Path Resolution (Only for the valid entry)
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, RULE_CONTENT_DIR, validFile);

            // 3. Check Fetcher/Validator/Registry calls for the one valid path
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedValidPath);
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                RULE_TYPE_NAME,
                `${modId}:${validFileName}`, // ID derived from filename
                expect.objectContaining({event_type: "core:valid_event"})
            );

            // 4. Return value should be 1
            expect(count).toBe(1);

            // 5. Overall logs
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Found 1 potential ${RULE_CONTENT_KEY} files to process for mod ${modId}.`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `RuleLoader: Loading ${RULE_TYPE_NAME} definitions for mod '${modId}'.`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 1/1 ${RULE_CONTENT_KEY} items.`
            );
        });


        it('should return 0 and log debug if all entries are invalid', async () => {
            const manifest = {
                id: modId,
                version: '1.0.0',
                name: 'All Invalid Mod',
                content: {
                    // Use constant for content key
                    [RULE_CONTENT_KEY]: ["", null, 123, "   ", undefined, {}] // Only invalid entries
                }
            };

            // --- Action ---
            // *** UPDATED: Call loadItemsForMod ***
            const count = await loader.loadItemsForMod(
                modId,
                manifest,
                RULE_CONTENT_KEY,
                RULE_CONTENT_DIR,
                RULE_TYPE_NAME
            );

            // --- Assert ---
            // 1. Check Warnings (from base class _extractValidFilenames)
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in '${RULE_CONTENT_KEY}' list:`, 123);
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in '${RULE_CONTENT_KEY}' list:`, {});
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in '${RULE_CONTENT_KEY}' list:`, undefined);
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in '${RULE_CONTENT_KEY}' list after trimming. Skipping.`); // For ""
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in '${RULE_CONTENT_KEY}' list after trimming. Skipping.`); // For "   "

            // 2. Check Path Resolution, Fetcher, Registry (Should not be called)
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();

            // 3. Return value
            expect(count).toBe(0);

            // 4. Overall log should reflect no valid files found
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `No valid ${RULE_CONTENT_KEY} filenames found for mod ${modId}.`
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Mod [${modId}] - Processed`)
            );
        });
    });
});