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
        // Specific tests can override this mock's implementation if needed
        // console.log(`Mock Fetcher called for: ${filePath}`); // Debug log
        if (filePath.includes('.json')) {
            // *** Use path.basename for consistency with RuleLoader logic if filename is used for ID ***
            const filenamePart = path.basename(filePath);
            return Promise.resolve({
                rule_id: `rule_from_${filenamePart}`, // Generate ID from filename only
                event_type: "core:dummy_event",
                actions: [{type: "LOG", parameters: {message: `Loaded from ${filePath}`}}]
            });
        }
        // Simulate not found for other paths if necessary
        return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for path ${filePath}`));
    }),
});

// --- Mock SchemaValidator (Now needed for valid input tests) ---
const createMockSchemaValidator = () => {
    const ruleSchemaId = 'http://example.com/schemas/system-rule.schema.json';
    // Mock validator function for the rule schema
    const mockRuleValidatorFn = jest.fn((data) => {
        // Basic validation: check for event_type and actions array
        const isValid = data && typeof data.event_type === 'string' && Array.isArray(data.actions);
        return {
            isValid: isValid,
            errors: isValid ? null : [{message: "Mock validation failed: missing required fields"}]
        };
    });

    return {
        validate: jest.fn().mockImplementation((schemaId, data) => {
            if (schemaId === ruleSchemaId) {
                return mockRuleValidatorFn(data);
            }
            // Default pass for other schemas if needed by other parts
            return {isValid: true, errors: null};
        }),
        addSchema: jest.fn().mockResolvedValue(undefined),
        // Assume rule schema is loaded
        isSchemaLoaded: jest.fn().mockImplementation((schemaId) => schemaId === ruleSchemaId),
        // Return the mock validator function for the rule schema
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (schemaId === ruleSchemaId) {
                return mockRuleValidatorFn;
            }
            return undefined; // No validator for other schemas by default
        }),
    };
};

// --- Mock DataRegistry (Now needed for valid input tests) ---
const createMockDataRegistry = () => ({
    store: jest.fn(),
    // Add get method to check for existing rules (needed by RuleLoader's override check)
    get: jest.fn().mockReturnValue(undefined), // Default: rule does not exist
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

describe('RuleLoader (Sub-Ticket 4.3: Test loadRulesForMod Manifest Input Handling)', () => {
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
    // Removed the spy: let processRulePathsSpy;

    // --- Shared Test Data ---
    const modId = 'manifest-test-mod';
    const ruleType = 'system-rules'; // The type name used for rules

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        // Instantiate mocks needed for #processRulePaths execution
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        loader = new RuleLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );

        // REMOVED SPY: processRulePathsSpy = jest.spyOn(loader, '#processRulePaths').mockResolvedValue(0);
    });

    // --- Cleanup ---
    afterEach(() => {
        // REMOVED SPY RESTORE: processRulePathsSpy.mockRestore();
    });

    // --- Test Cases ---

    // --- Valid Input ---
    describe('Valid Input', () => {
        it('should resolve valid rule filenames and process them successfully', async () => {
            const ruleFile1 = "rule1.json";
            const ruleFile2Relative = "sub/rule2.json"; // Relative path including subfolder
            const ruleFile2Basename = "rule2.json";    // Just the filename part
            const manifest = {
                id: modId, version: '1.0.0', name: 'Valid Test Mod',
                content: {
                    rules: [ruleFile1, ` ${ruleFile2Relative} `] // Include whitespace to test trimming
                }
            };
            const resolvedPath1 = `./data/mods/${modId}/${ruleType}/${ruleFile1}`;
            const resolvedPath2 = `./data/mods/${modId}/${ruleType}/${ruleFile2Relative}`; // Path includes subfolder

            // Configure mock resolver
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFile1) return resolvedPath1;
                if (mId === modId && type === ruleType && file === ruleFile2Relative) return resolvedPath2; // Expect trimmed relative path
                return `unexpected_path_${file}`;
            });

            // Configure fetcher and validator mocks if specific data/validation is needed for these paths
            // Using the default mocks which should allow basic processing

            // --- Action ---
            const count = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Verify IPathResolver.resolveModContentPath calls
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, ruleType, ruleFile1);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, ruleType, ruleFile2Relative); // Verify trimming happened before resolving

            // 2. Verify Fetcher, Validator, Registry were called by #processRulePaths
            // Check that fetch was called for the resolved paths
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPath1);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPath2);

            // Check that validator was used (via getValidator) for the rule schema
            expect(mockValidator.getValidator).toHaveBeenCalledWith(mockConfig.getContentTypeSchemaId('system-rules'));
            // Check that the returned function (mockRuleValidatorFn) was called twice
            const ruleValidatorFn = mockValidator.getValidator(mockConfig.getContentTypeSchemaId('system-rules'));
            expect(ruleValidatorFn).toHaveBeenCalledTimes(2);

            // Check that store was called twice (once per valid rule)
            expect(mockRegistry.store).toHaveBeenCalledTimes(2);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType, // 'system-rules'
                expect.stringContaining(`${modId}:rule_from_${ruleFile1}`), // Generated ID based on mock fetcher using basename
                expect.any(Object) // The fetched rule data
            );
            // *** FIXED: Use the basename for the expected generated ID ***
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType, // 'system-rules'
                expect.stringContaining(`${modId}:rule_from_${ruleFile2Basename}`), // Use basename matching mock fetcher
                expect.any(Object)
            );

            // 3. Return value should be the actual count of successfully processed rules
            expect(count).toBe(2);

            // Verify logging indicates finding and processing files
            // Check the initial filtering log message from loadRulesForMod
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Filtered rule filenames to process: ["${ruleFile1}","${ruleFile2Relative}"]`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading 2 rule file(s) specified by manifest.`));
            // Check for the final success log from #processRulePaths
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully processed and registered all 2 validated rule files for mod.`));
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    // --- Invalid Manifest Structure ---
    describe('Invalid Manifest Structure', () => {
        // These tests remain largely the same as they test code paths that exit *before* #processRulePaths
        it('should return 0 and log appropriately if manifest is null', async () => {
            const count = await loader.loadRulesForMod(modId, null);

            expect(count).toBe(0);
            // *** FIXED: Added modId prefix to expected log message ***
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: No 'content.rules' field found in manifest. No rules to load.`));
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            // Assert fetch/validate/store weren't called
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('should return 0 and log debug if manifest is an empty object', async () => {
            const count = await loader.loadRulesForMod(modId, {});

            expect(count).toBe(0);
            // *** FIXED: Added modId prefix to expected log message ***
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: No 'content.rules' field found in manifest. No rules to load.`));
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return 0 and log debug if manifest.content is null', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: null};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // *** FIXED: Added modId prefix to expected log message ***
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: No 'content.rules' field found in manifest. No rules to load.`));
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return 0 and log debug if manifest.content is an empty object', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // *** FIXED: Added modId prefix to expected log message ***
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: No 'content.rules' field found in manifest. No rules to load.`));
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return 0 and log debug if manifest.content.rules is null', async () => { // <-- Changed test description
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {rules: null}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // *** FIXED: Expect DEBUG log, not WARN, based on code logic for null ***
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: No 'content.rules' field found in manifest. No rules to load.`));
            // Ensure the warning for non-array was NOT called for null
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Expected an array, got'));
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('should return 0 and log warn if manifest.content.rules is not an array (string)', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {rules: "not-an-array"}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // *** FIXED: Added modId prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Invalid 'content.rules' field in manifest. Expected an array, got string`));
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        it('should return 0 and log warn if manifest.content.rules is not an array (number)', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {rules: 123}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // *** FIXED: Added modId prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Invalid 'content.rules' field in manifest. Expected an array, got number`));
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });
    });

    // --- Empty/Invalid Entries in rules Array ---
    describe('Empty/Invalid Entries in rules Array', () => {
        it('should return 0 and log info if manifest.content.rules is an empty array', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {rules: []}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // *** FIXED: Added modId prefix ***
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Manifest specifies an empty 'content.rules' array. No rules to load.`));
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should filter out invalid entries, log warnings, and process only valid ones', async () => {
            const validFile = "valid.json";
            const validFileBasename = "valid.json"; // Basename for ID check
            const manifest = {
                id: modId,
                version: '1.0.0',
                name: 'Mixed Validity Mod',
                content: {
                    // Mix of invalid types, null, empty/whitespace strings, and one valid string
                    rules: ["", null, 123, "   ", undefined, {invalid: true}, validFile, "  "]
                }
            };
            const resolvedValidPath = `./data/mods/${modId}/${ruleType}/${validFile}`;

            // Configure resolver for the valid path
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === validFile) return resolvedValidPath;
                return `unexpected_path_${file}`;
            });

            // --- Action ---
            const count = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Check Logs for Invalid Entries
            // RuleLoader logs warnings for non-null, non-string entries
            // *** FIXED: Added modId prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': 123`));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': {"invalid":true}`));
            // *** FIXED: Assert that undefined IS warned, matching code logic ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': undefined`));
            // Check that null IS NOT warned (skipped silently)
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(': null'));
            // Check that empty/whitespace strings ARE warned
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': (empty string after trimming) ""`));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': (empty string after trimming) "   "`));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': (empty string after trimming) "  "`));


            // 2. Check Path Resolution (Only for the valid entry)
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, ruleType, validFile);

            // 3. Check Fetcher/Validator/Registry calls for the one valid path
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedValidPath);
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            // *** FIXED: Use basename for expected ID ***
            expect(mockRegistry.store).toHaveBeenCalledWith(ruleType, expect.stringContaining(`${modId}:rule_from_${validFileBasename}`), expect.any(Object));

            // 4. Return value should be 1 (only one file processed)
            expect(count).toBe(1);

            // 5. Overall info log should reflect the filtering
            // *** FIXED: Added modId prefix ***
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Filtered rule filenames to process: ["${validFile}"]`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Loading 1 rule file(s) specified by manifest.`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Successfully processed and registered all 1 validated rule files for mod.`));
        });


        it('should return 0 and not call processing if all entries are invalid', async () => {
            const manifest = {
                id: modId,
                version: '1.0.0',
                name: 'All Invalid Mod',
                content: {
                    rules: ["", null, 123, "   ", undefined, {}] // Only invalid entries
                }
            };

            // --- Action ---
            const count = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Check Logs for Invalid Entries (as above)
            // *** FIXED: Added modId prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': 123`));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': {}`));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': (empty string after trimming) ""`));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': (empty string after trimming) "   "`));
            // *** FIXED: Assert that undefined IS warned, matching code logic ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': undefined`));

            // 2. Check Path Resolution (Should not be called)
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();

            // 3. Check Fetcher/Validator/Registry (Should not be called)
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();

            // 4. Return value
            expect(count).toBe(0);

            // 5. Overall info log should reflect no valid files found [cite: 497]
            // *** FIXED: Added modId prefix ***
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`RuleLoader [${modId}]: No valid rule files listed in manifest 'content.rules' after filtering.`));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Loading 0 rule file(s)`)); // Should not log loading 0 files
        });
    });
});