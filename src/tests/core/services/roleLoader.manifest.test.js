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
            const filenamePart = path.basename(filePath); // e.g., "rule1.json", "rule2.json"
            const namePart = path.parse(filenamePart).name; // e.g., "rule1", "rule2"
            return Promise.resolve({
                // Simulate rule_id derived from filename base (as per RuleLoader fallback)
                // This avoids needing rule_id in the test data itself if we assume it's missing
                // rule_id: `rule_from_${namePart}`, // Let RuleLoader generate the ID
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
    const loadedSchemas = new Map();
    loadedSchemas.set(ruleSchemaId, {}); // Mark schema as loaded

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
        isSchemaLoaded: jest.fn().mockImplementation((schemaId) => loadedSchemas.has(schemaId)),
        // Return the mock validator function for the rule schema
        getValidator: jest.fn().mockImplementation((schemaId) => {
            if (loadedSchemas.has(schemaId) && schemaId === ruleSchemaId) {
                return mockRuleValidatorFn;
            }
            return undefined; // No validator for other schemas by default
        }),
        // Helper to check internal state if needed
        _getLoadedSchemas: () => loadedSchemas,
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

    // --- Shared Test Data ---
    const modId = 'manifest-test-mod';
    const ruleType = 'system-rules'; // The type name used for rules
    const defaultRuleSchemaId = 'http://example.com/schemas/system-rule.schema.json';

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator(); // Ensure schema is marked loaded
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // Ensure config returns the rule schema ID correctly
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === ruleType ? defaultRuleSchemaId : undefined
        );
        mockConfig.getRuleSchemaId.mockReturnValue(defaultRuleSchemaId); // Also ensure this returns the ID if RuleLoader uses it directly

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
        // Optional: Restore mocks if they were manipulated in ways not reset by clearAllMocks
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
                    rules: [ruleFile1, ` ${ruleFile2Relative} `] // Include whitespace to test trimming
                }
            };
            const resolvedPath1 = `./data/mods/${modId}/${ruleType}/${ruleFile1}`;
            const resolvedPath2 = `./data/mods/${modId}/${ruleType}/${ruleFile2Relative}`; // Path includes subfolder

            // Configure mock resolver
            mockResolver.resolveModContentPath.mockImplementation((mId, type, file) => {
                if (mId === modId && type === ruleType && file === ruleFile1) return resolvedPath1;
                // The base loader trims the filename before resolving
                if (mId === modId && type === ruleType && file === ruleFile2Relative.trim()) return resolvedPath2;
                throw new Error(`Unexpected resolveModContentPath call: ${mId}, ${type}, ${file}`);
            });

            // Configure fetcher to return data without rule_id (RuleLoader will derive it)
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedPath1) return {event_type: "core:event1", actions: []};
                if (filePath === resolvedPath2) return {event_type: "core:event2", actions: []};
                throw new Error(`Mock Fetch Error: 404 for ${filePath}`);
            });

            // --- Action ---
            const count = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Verify IPathResolver.resolveModContentPath calls
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, ruleType, ruleFile1);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, ruleType, ruleFile2Relative.trim()); // Verify trimming happened before resolving

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
                ruleType,
                `${modId}:${ruleFile1Name}`, // ID derived from filename 'rule1.json'
                expect.objectContaining({event_type: "core:event1"})
            );
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${ruleFile2Name}`, // ID derived from filename 'rule2.json'
                expect.objectContaining({event_type: "core:event2"})
            );

            // 3. Return value should be the actual count of successfully processed rules
            expect(count).toBe(2);

            // Verify logging indicates finding and processing files
            // --- CORRECTION 1: Check actual INFO logs ---
            // Check the initial delegation log
            expect(mockLogger.info).toHaveBeenCalledWith(
                `RuleLoader [${modId}]: Delegating rule loading to BaseManifestItemLoader using manifest key 'rules' and content directory 'system-rules'.`
            );
            // Check the final summary log from BaseManifestItemLoader
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 2/2 rules items.`
            );
            // Ensure the incorrect log wasn't called
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Loading 2 rule file(s)`) // This log doesn't exist
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Successfully processed and registered all 2 validated rule files`) // This specific wording might not be used
            );
            // Ensure no warnings or errors
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    // --- Invalid Manifest Structure ---
    describe('Invalid Manifest Structure', () => {
        // --- CORRECTION 2: Test expects rejection/throw for null manifest ---
        it('should throw error and log error if manifest is null', async () => {
            await expect(loader.loadRulesForMod(modId, null))
                .rejects
                .toThrow(`Invalid manifest provided for mod '${modId}' to RuleLoader.loadRulesForMod.`);

            // Verify ERROR log occurred
            expect(mockLogger.error).toHaveBeenCalledWith(
                `RuleLoader [${modId}]: Invalid manifest provided to loadRulesForMod.`
            );

            // Verify other steps weren't reached
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        // Test for empty object (should also throw)
        it('should return 0 and log debug if manifest is an empty object', async () => {
            // --- Action ---
            // Pass an empty object, expect it to succeed and return 0
            const count = await loader.loadRulesForMod(modId, {});

            // --- Assert ---
            // 1. Expect return value 0
            expect(count).toBe(0);

            // 2. Expect DEBUG log from _extractValidFilenames due to missing 'content'
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Mod '${modId}': Content key 'rules' not found or is null/undefined in manifest. Skipping.`
            );
            // 3. Expect DEBUG log from _loadItemsInternal due to empty filename list
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `No valid rules filenames found for mod ${modId}.`
            );

            // 4. Ensure no processing attempts were made
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();

            // 5. Ensure no warnings or errors were logged
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled(); // No error should be logged
        });

        // Test for manifest.content is null (should return 0 and log debug)
        it('should return 0 and log debug if manifest.content is null', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: null};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith( // Base class logs debug when key is missing
                `Mod '${modId}': Content key 'rules' not found or is null/undefined in manifest. Skipping.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        // Test for manifest.content is empty object (should return 0 and log debug)
        it('should return 0 and log debug if manifest.content is an empty object', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith( // Base class logs debug when key is missing
                `Mod '${modId}': Content key 'rules' not found or is null/undefined in manifest. Skipping.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        // Test for manifest.content.rules is null (should return 0 and log debug)
        it('should return 0 and log debug if manifest.content.rules is null', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {rules: null}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith( // Base class logs debug when key is missing
                `Mod '${modId}': Content key 'rules' not found or is null/undefined in manifest. Skipping.`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled(); // Ensure non-array warning NOT called for null
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        // Test for manifest.content.rules is not an array (string)
        it('should return 0 and log warn if manifest.content.rules is not an array (string)', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {rules: "not-an-array"}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // --- CORRECTION 3: Check actual WARN log message ---
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Mod '${modId}': Expected an array for content key 'rules' but found type 'string'. Skipping.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });

        // Test for manifest.content.rules is not an array (number)
        it('should return 0 and log warn if manifest.content.rules is not an array (number)', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {rules: 123}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // --- CORRECTION 3: Check actual WARN log message ---
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Mod '${modId}': Expected an array for content key 'rules' but found type 'number'. Skipping.`
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
        });
    });

    // --- Empty/Invalid Entries in rules Array ---
    describe('Empty/Invalid Entries in rules Array', () => {
        // Test for manifest.content.rules is empty array
        it('should return 0 and log debug if manifest.content.rules is an empty array', async () => {
            const manifest = {id: modId, version: '1.0.0', name: 'Test', content: {rules: []}};
            const count = await loader.loadRulesForMod(modId, manifest);

            expect(count).toBe(0);
            // Base class logs DEBUG when the extracted list is empty
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `No valid rules filenames found for mod ${modId}.`
            );
            // Ensure the specific INFO log for empty array is NOT called (it doesn't exist)
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Manifest specifies an empty 'content.rules' array`)
            );
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        // Test filtering of invalid entries
        it('should filter out invalid entries, log warnings, and process only valid ones', async () => {
            const validFile = "valid.json";
            const validFileName = "valid"; // For ID check
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
                throw new Error(`Unexpected resolveModContentPath call: ${mId}, ${type}, ${file}`);
            });
            // Configure fetcher for valid path
            mockFetcher.fetch.mockImplementation(async (filePath) => {
                if (filePath === resolvedValidPath) return {event_type: "core:valid_event", actions: []};
                throw new Error(`Mock Fetch Error: 404 for ${filePath}`);
            });

            // --- Action ---
            const count = await loader.loadRulesForMod(modId, manifest);

            // --- Assert ---
            // 1. Check Logs for Invalid Entries (Base class logs warnings)
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in 'rules' list:`, 123);
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in 'rules' list:`, {invalid: true});
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in 'rules' list:`, undefined);
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in 'rules' list after trimming. Skipping.`); // For ""
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in 'rules' list after trimming. Skipping.`); // For "   "
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in 'rules' list after trimming. Skipping.`); // For "  "
            // Check that null is NOT warned (skipped silently by filter logic)
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(': null'));


            // 2. Check Path Resolution (Only for the valid entry)
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
            expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, ruleType, validFile);

            // 3. Check Fetcher/Validator/Registry calls for the one valid path
            expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
            expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedValidPath);
            expect(mockRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockRegistry.store).toHaveBeenCalledWith(
                ruleType,
                `${modId}:${validFileName}`, // ID derived from filename
                expect.objectContaining({event_type: "core:valid_event"})
            );

            // 4. Return value should be 1 (only one file processed)
            expect(count).toBe(1);

            // 5. Overall info/debug logs
            expect(mockLogger.debug).toHaveBeenCalledWith( // Base class logs debug about count
                `Found 1 potential rules files to process for mod ${modId}.`
            );
            // Delegation Info log
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Delegating rule loading`)
            );
            // Final summary Info log
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Mod [${modId}] - Processed 1/1 rules items.` // Should be 1/1 as only 1 was attempted after filtering
            );
        });


        it('should return 0 and log debug if all entries are invalid', async () => {
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
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in 'rules' list:`, 123);
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Invalid non-string entry found in 'rules' list:`, {});
            expect(mockLogger.warn).toHaveBeenCalledWith(`Mod '${modId}': Empty string filename found in 'rules' list after trimming. Skipping.`); // For ""
            // Add checks for other warnings if needed...

            // 2. Check Path Resolution (Should not be called)
            expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();

            // 3. Check Fetcher/Validator/Registry (Should not be called)
            expect(mockFetcher.fetch).not.toHaveBeenCalled();
            expect(mockRegistry.store).not.toHaveBeenCalled();

            // 4. Return value
            expect(count).toBe(0);

            // 5. Overall log should reflect no valid files found
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `No valid rules filenames found for mod ${modId}.`
            );
            // Ensure summary log not called
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining(`Mod [${modId}] - Processed`)
            );
        });
    });
});