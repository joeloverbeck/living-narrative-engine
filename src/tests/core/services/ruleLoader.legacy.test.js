// src/tests/core/services/ruleLoader.legacy.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals'; // Assuming Jest environment
import path from 'path'; // Import path for basename extraction in test assertion
import RuleLoader from '../../../core/services/ruleLoader.js'; // Adjust path as necessary
// Assuming interfaces are defined correctly for type hints/JSDoc
/**
 * @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../core/interfaces/coreServices.js').ModManifest} ModManifest
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
        if (typeName === 'components') {
            return 'http://example.com/schemas/component-definition.schema.json';
        }
        return `http://example.com/schemas/${typeName}.schema.json`; // Generic fallback
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModsBasePath: jest.fn().mockReturnValue('mods'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getRuleBasePath: jest.fn().mockReturnValue('system-rules'), // Relevant for RuleLoader
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

/**
 * Creates a mock IDataFetcher service.
 * Allows specific path responses and error paths.
 * @param {object} [pathToResponse={}] - Map of path strings to successful response data (will be deep cloned).
 * @param {string[]} [errorPaths=[]] - List of paths that should trigger a rejection.
 * @returns {IDataFetcher & { mockSuccess: Function, mockFailure: Function, _getPaths: Function }} Mocked data fetcher service.
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => {
    // Keep internal copies for manipulation via helpers
    let _pathToResponse = {...pathToResponse};
    let _errorPaths = [...errorPaths];

    const fetcher = {
        fetch: jest.fn(async (path) => {
            if (_errorPaths.includes(path)) {
                return Promise.reject(new Error(`Mock Fetch Error: Failed to fetch ${path}`));
            }
            if (Object.prototype.hasOwnProperty.call(_pathToResponse, path)) {
                try {
                    return Promise.resolve(JSON.parse(JSON.stringify(_pathToResponse[path])));
                } catch (e) {
                    return Promise.reject(new Error(`Mock Fetcher Error: Could not clone mock data for path ${path}. Is it valid JSON?`));
                }
            }
            return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for path ${path}`));
        }),
        // Helper to easily add successful responses mid-test
        mockSuccess: function (path, responseData) {
            _pathToResponse[path] = JSON.parse(JSON.stringify(responseData));
            _errorPaths = _errorPaths.filter(p => p !== path);
            // No need to re-assign mockImplementation as it now closes over the internal maps
        },
        // Helper to easily add error responses mid-test
        mockFailure: function (path, errorMessage = `Mock Fetch Error: Failed to fetch ${path}`) {
            if (!_errorPaths.includes(path)) {
                _errorPaths.push(path);
            }
            if (Object.prototype.hasOwnProperty.call(_pathToResponse, path)) {
                delete _pathToResponse[path];
            }
            // No need to re-assign mockImplementation
        },
        // Helper to see configured paths
        _getPaths: () => ({success: Object.keys(_pathToResponse), error: _errorPaths}),
    };
    return fetcher;
};


/**
 * Creates a mock ISchemaValidator service with helpers for configuration.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {ISchemaValidator & {_setSchemaLoaded: Function, mockValidatorFunction: Function, resetValidatorFunction: Function}} Mocked schema validator service with test helpers.
 */
const createMockSchemaValidator = (overrides = {}) => {
    const loadedSchemas = new Map(); // Map<schemaId, schemaData>
    const schemaValidators = new Map(); // Map<schemaId, jest.Mock>

    const mockValidator = {
        addSchema: jest.fn(async (schemaData, schemaId) => {
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
            }
        }),
        removeSchema: jest.fn((schemaId) => {
            const deletedSchemas = loadedSchemas.delete(schemaId);
            const deletedValidators = schemaValidators.delete(schemaId);
            return deletedSchemas || deletedValidators;
        }),
        isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
        getValidator: jest.fn((schemaId) => {
            if (loadedSchemas.has(schemaId) && !schemaValidators.has(schemaId)) {
                const defaultValidFn = jest.fn(() => ({isValid: true, errors: null}));
                schemaValidators.set(schemaId, defaultValidFn);
                return defaultValidFn;
            }
            return schemaValidators.get(schemaId);
        }),
        validate: jest.fn((schemaId, data) => {
            const validatorFn = schemaValidators.get(schemaId);
            if (!loadedSchemas.has(schemaId)) {
                return {isValid: false, errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found.`}]};
            }
            if (validatorFn) {
                return validatorFn(data);
            }
            return {isValid: true, errors: null};
        }),
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
            }
        },
        mockValidatorFunction: (schemaId, implementation) => {
            if (typeof implementation !== 'function') {
                throw new Error('mockValidatorFunction requires a function as the implementation.');
            }
            const mockFn = jest.fn(implementation);
            schemaValidators.set(schemaId, mockFn);
            if (!loadedSchemas.has(schemaId)) {
                loadedSchemas.set(schemaId, {});
            }
            return mockFn;
        },
        resetValidatorFunction: (schemaId) => {
            const defaultPassFn = jest.fn(() => ({isValid: true, errors: null}));
            schemaValidators.set(schemaId, defaultPassFn);
            if (!loadedSchemas.has(schemaId)) {
                loadedSchemas.set(schemaId, {});
            }
        },
        ...overrides,
    };
    return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {IDataRegistry & { _getRawStore: Function }} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
    const registryStore = {};

    return {
        store: jest.fn((type, id, data) => {
            if (!registryStore[type]) {
                registryStore[type] = {};
            }
            try {
                registryStore[type][id] = JSON.parse(JSON.stringify(data));
            } catch (e) {
                console.error(`MockDataRegistry Error: Could not clone data for ${type}/${id}.`, data);
                throw e;
            }
        }),
        get: jest.fn((type, id) => {
            const item = registryStore[type]?.[id];
            try {
                return item ? JSON.parse(JSON.stringify(item)) : undefined;
            } catch (e) {
                console.error(`MockDataRegistry Error: Could not clone retrieved data for ${type}/${id}.`, item);
                return undefined;
            }
        }),
        getAll: jest.fn((type) => {
            const typeData = registryStore[type];
            if (!typeData) return [];
            try {
                return Object.values(typeData).map(item => JSON.parse(JSON.stringify(item)));
            } catch (e) {
                console.error(`MockDataRegistry Error: Could not clone retrieved data for getAll(${type}).`, typeData);
                return [];
            }
        }),
        getAllSystemRules: jest.fn(() => {
            const rules = registryStore['system-rules'];
            if (!rules) return [];
            try {
                return Object.values(rules).map(item => JSON.parse(JSON.stringify(item)));
            } catch (e) {
                console.error(`MockDataRegistry Error: Could not clone retrieved data for getAllSystemRules.`, rules);
                return [];
            }
        }),
        clear: jest.fn(() => {
            Object.keys(registryStore).forEach(key => delete registryStore[key]);
        }),
        getManifest: jest.fn().mockReturnValue(null),
        setManifest: jest.fn(),
        getComponentDefinition: jest.fn(),
        ...overrides,
        _getRawStore: () => registryStore,
    };
};

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

describe('RuleLoader (Sub-Ticket 4.2: Verify Absence of Legacy Discovery)', () => {
    // --- Mocks & Loader Instance ---
    /** @type {IConfiguration} */
    let mockConfig;
    /** @type {IPathResolver} */
    let mockResolver;
    /** @type {IDataFetcher & { mockSuccess: Function, mockFailure: Function, _getPaths: Function }} */
    let mockFetcher;
    /** @type {ISchemaValidator & { _setSchemaLoaded: Function, mockValidatorFunction: Function, resetValidatorFunction: Function }} */
    let mockValidator;
    /** @type {IDataRegistry & { _getRawStore: Function }} */
    let mockRegistry;
    /** @type {ILogger} */
    let mockLogger;
    /** @type {RuleLoader} */
    let loader;

    // --- Shared Test Data ---
    const modId = 'legacy-test-mod';
    const defaultRuleSchemaId = 'http://example.com/schemas/system-rule.schema.json';

    // Example rule content for tests that need valid data
    const validRuleData = {
        // NOTE: rule_id intentionally includes modId prefix to test the loader's handling
        rule_id: `${modId}:valid_rule`,
        event_type: "core:test_event",
        actions: [
            {type: "LOG", parameters: {message: "Test rule executed"}}
        ]
    };
    // The ID expected after the loader prepends the mod ID again
    const expectedStoredRuleId = `${modId}:${validRuleData.rule_id}`;

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher(); // Includes helpers
        mockValidator = createMockSchemaValidator(); // Includes helpers
        mockRegistry = createMockDataRegistry(); // Includes helpers
        mockLogger = createMockLogger();

        // Default config for rule schema
        mockConfig.getRuleSchemaId.mockReturnValue(defaultRuleSchemaId);
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) =>
            typeName === 'system-rules' ? defaultRuleSchemaId : undefined
        );

        // Default setup: rule schema is loaded and validates successfully
        mockValidator._setSchemaLoaded(defaultRuleSchemaId, {});
        mockValidator.resetValidatorFunction(defaultRuleSchemaId);

        loader = new RuleLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );
    });

    // --- Tests ---

    it('should load zero rules and not fetch or store anything if manifest has no "content" field', async () => {
        /** @type {ModManifest} */
        const manifestWithoutContent = {
            id: modId,
            version: '1.0.0',
            name: 'Mod Without Content Field',
            // No 'content' field at all
        };

        // --- Action ---
        const count = await loader.loadRulesForMod(modId, manifestWithoutContent);

        // --- Assert ---
        expect(count).toBe(0);

        // Verify no attempt to fetch based on assumptions
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();

        // Verify nothing stored
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // Verify appropriate logging (Loader logs DEBUG when content.rules is missing)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`No 'content.rules' field found in manifest. No rules to load.`)
        );
        // Check that other key logs weren't called inappropriately
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Loading rules for mod`)); // Not called in this path
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Completed processing.`)); // Not called if nothing processed
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`Invalid 'content.rules' field`));

        // Ensure no error logs related to fetching/processing occurred unnecessarily
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should load zero rules and not fetch or store anything if manifest content has no "rules" field', async () => {
        /** @type {ModManifest} */
        const manifestWithoutRules = {
            id: modId,
            version: '1.0.0',
            name: 'Mod Without Rules Field',
            content: {
                // 'rules' field is missing
                components: ['comp.json']
            }
        };

        // --- Action ---
        const count = await loader.loadRulesForMod(modId, manifestWithoutRules);

        // --- Assert ---
        expect(count).toBe(0);
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // Verify appropriate logging (Loader logs DEBUG when content.rules is missing)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`No 'content.rules' field found in manifest. No rules to load.`)
        );
        // Check that other key logs weren't called inappropriately
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Loading rules for mod`));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Completed processing.`));
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`Invalid 'content.rules' field`));

        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should load zero rules and not fetch or store anything if "content.rules" is empty', async () => {
        /** @type {ModManifest} */
        const manifestWithEmptyRules = {
            id: modId,
            version: '1.0.0',
            name: 'Mod With Empty Rules Array',
            content: {
                rules: [] // Explicitly empty array
            }
        };

        // --- Action ---
        const count = await loader.loadRulesForMod(modId, manifestWithEmptyRules);

        // --- Assert ---
        expect(count).toBe(0);
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // Verify appropriate logging (Loader logs INFO with specific message for empty array)
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Manifest specifies an empty 'content.rules' array. No rules to load.`)
        );
        // Check that other logs weren't called inappropriately
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Found 0 valid rule filenames`)); // Different log message used
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Completed processing.`)); // Not called if nothing processed

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should not attempt legacy discovery even if potential legacy files exist conceptually', async () => {
        const ruleFilenameRelative = 'rules/actual_rule.json'; // The relative path in the manifest
        const ruleFilenameBase = path.basename(ruleFilenameRelative); // The filename part used in logs
        const expectedRulePath = `./data/mods/${modId}/system-rules/${ruleFilenameRelative}`;
        // Define potential legacy paths that *should not* be fetched
        const legacyIndexPath = `./data/mods/${modId}/system-rules/rulesIndex.json`; // Example legacy index
        const legacyDirPath = `./data/mods/${modId}/system-rules/`; // Example legacy directory scan path (less likely direct fetch)

        /** @type {ModManifest} */
        const manifestWithRule = {
            id: modId,
            version: '1.0.0',
            name: 'Mod With One Rule',
            content: {
                rules: [ruleFilenameRelative]
            }
        };

        // --- Arrange Mocks ---
        // Mock the *correct* fetch based on the manifest
        mockFetcher.mockSuccess(expectedRulePath, validRuleData);
        // Mock the resolver for the correct path
        mockResolver.resolveModContentPath.mockImplementation((mId, typeName, file) => {
            if (mId === modId && typeName === 'system-rules' && file === ruleFilenameRelative) {
                return expectedRulePath;
            }
            return `UNEXPECTED_PATH_FOR_${mId}_${typeName}_${file}`;
        });

        // Mock validator success
        mockValidator.resetValidatorFunction(defaultRuleSchemaId);

        // IMPORTANT: Make fetcher *aware* of legacy paths, but expect them *not* to be called.
        // If fetcher wasn't aware, a call to them would result in a generic 404 mock error,
        // which might obscure whether the loader *tried* to call them.
        mockFetcher.mockSuccess(legacyIndexPath, {message: "This is legacy index, should not be fetched!"});
        // No need to mock directory listing unless the legacy logic explicitly fetched directory paths

        // --- Action ---
        const count = await loader.loadRulesForMod(modId, manifestWithRule);

        // --- Assert ---
        expect(count).toBe(1);

        // Verify ONLY the manifest-derived path was resolved and fetched
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'system-rules', ruleFilenameRelative);

        expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(expectedRulePath);

        // CRITICAL: Verify legacy paths were NOT fetched
        expect(mockFetcher.fetch).not.toHaveBeenCalledWith(legacyIndexPath);
        expect(mockFetcher.fetch).not.toHaveBeenCalledWith(legacyDirPath); // Or any other non-manifest path

        // Verify rule was stored with the correctly prepended ID
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        expect(mockRegistry.store).toHaveBeenCalledWith(
            'system-rules',
            expectedStoredRuleId, // Use the ID generated by the loader
            expect.objectContaining(validRuleData)
        );

        // Verify logging indicates success based on the *resolved* paths count
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Loading ${1} rule file(s) specified by manifest.`)
        );
        // *** CORRECTION HERE: Expect the basename in the log message ***
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully processed and registered rule '${expectedStoredRuleId}' from file '${ruleFilenameBase}'.`)
        );
        // The final summary log reflects the success count
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully processed and registered all ${1} validated rule files for mod.`)
        );
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully validated rule definition from`)); // Validation logging seems different now

        // Ensure no errors or major warnings
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Overwriting existing rule')); // Assuming no overwrite in this test
    });

});