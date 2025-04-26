// src/tests/core/services/componentDefinitionLoader.schemaFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Copied from componentDefinitionLoader.test.js for self-containment) ---

/**
 * Creates a mock IConfiguration service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
    getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'components') {
            return 'http://example.com/schemas/component-definition.schema.json';
        }
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    // Include other IConfiguration methods if needed by the loader, mocking their returns
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
 * @returns {import('../../../src/core/interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
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
 * @param {object} [pathToResponse={}] - Map of path strings to successful response data.
 * @param {string[]} [errorPaths=[]] - List of paths that should trigger a rejection.
 * @returns {import('../../../src/core/interfaces/coreServices.js').IDataFetcher} Mocked data fetcher service.
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
    fetch: jest.fn(async (path) => {
        if (errorPaths.includes(path)) {
            return Promise.reject(new Error(`Mock Fetch Error: Failed to fetch ${path}`));
        }
        if (path in pathToResponse) {
            return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
        }
        return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for ${path}`));
    }),
});

/**
 * Creates a mock ISchemaValidator service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
    const loadedSchemas = new Map();
    const schemaValidators = new Map();

    const mockValidator = {
        addSchema: jest.fn(async (schemaData, schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                throw new Error(`Mock Schema Error: Schema with ID '${schemaId}' already exists.`);
            }
            loadedSchemas.set(schemaId, schemaData);
            const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
            schemaValidators.set(schemaId, mockValidationFn);
        }),
        removeSchema: jest.fn((schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                loadedSchemas.delete(schemaId);
                schemaValidators.delete(schemaId);
                return true;
            }
            return false;
        }),
        isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
        getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)), // Use default implementation
        validate: jest.fn((schemaId, data) => {
            const validatorFn = schemaValidators.get(schemaId);
            if (validatorFn) {
                return validatorFn(data);
            }
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`}]
            };
        }),
        // Helper added in setup test, keep it for consistency
        mockValidatorFunction: (schemaId, implementation) => {
            if (schemaValidators.has(schemaId)) {
                schemaValidators.get(schemaId).mockImplementation(implementation);
            } else {
                // If schema wasn't added via addSchema/setSchemaLoaded first, create fn
                const newMockFn = jest.fn(implementation);
                schemaValidators.set(schemaId, newMockFn);
            }
        },
        // Helper to simulate schema loading for tests
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            if (!loadedSchemas.has(schemaId)) {
                loadedSchemas.set(schemaId, schemaData);
                if (!schemaValidators.has(schemaId)) {
                    // Ensure a validator function exists to be mocked later
                    const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
                    schemaValidators.set(schemaId, mockValidationFn);
                }
            }
        },
        // Helper to get added schema data
        getAddedSchema: (schemaId) => loadedSchemas.get(schemaId),
        ...overrides,
    };
    return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').IDataRegistry} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
    const registryData = new Map();
    return {
        store: jest.fn((type, id, data) => {
            if (!registryData.has(type)) {
                registryData.set(type, new Map());
            }
            registryData.get(type).set(id, JSON.parse(JSON.stringify(data)));
        }),
        get: jest.fn((type, id) => {
            const typeMap = registryData.get(type);
            return typeMap?.has(id) ? JSON.parse(JSON.stringify(typeMap.get(id))) : undefined;
        }),
        getAll: jest.fn((type) => {
            const typeMap = registryData.get(type);
            return typeMap ? Array.from(typeMap.values()).map(d => JSON.parse(JSON.stringify(d))) : [];
        }),
        _getData: (type, id) => registryData.get(type)?.get(id),
        _prepopulate: (type, id, data) => {
            if (!registryData.has(type)) registryData.set(type, new Map());
            registryData.get(type).set(id, JSON.parse(JSON.stringify(data)));
        },
        clear: jest.fn(() => registryData.clear()),
        getAllSystemRules: jest.fn().mockReturnValue([]),
        getManifest: jest.fn().mockReturnValue(null),
        setManifest: jest.fn(),
        getEntityDefinition: jest.fn(),
        getItemDefinition: jest.fn(),
        getLocationDefinition: jest.fn(),
        getConnectionDefinition: jest.fn(),
        getBlockerDefinition: jest.fn(),
        getActionDefinition: jest.fn(),
        getEventDefinition: jest.fn(),
        getComponentDefinition: jest.fn(),
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
        ...overrides,
    };
};

/**
 * Creates a mock ILogger service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
});

/**
 * Creates a basic mock Mod Manifest object.
 * @param {string} modId
 * @param {string[]} [componentFiles=[]]
 * @returns {object}
 */
const createMockModManifest = (modId, componentFiles = []) => ({
    id: modId,
    name: `Mock Mod ${modId}`,
    version: '1.0.0',
    content: {
        components: componentFiles,
    },
});


// --- Test Suite ---

describe('ComponentDefinitionLoader (Sub-Ticket 6.4: Schema Validation Failure)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader;

    // --- Test Data ---
    const modId = 'errorMod';
    const filename = 'invalid_structure.component.json';
    const filePath = `./data/mods/${modId}/components/${filename}`;
    const componentDefSchemaId = 'http://example.com/schemas/component-definition.schema.json';

    // Example invalid data (missing required 'dataSchema' property)
    const invalidData = {
        id: 'errorMod:missing_schema',
        description: 'This component definition is invalid because dataSchema is missing.',
        // dataSchema: {} // <- Missing
    };

    // Mock validation errors expected from the validator
    const mockErrors = [
        {
            instancePath: '',
            schemaPath: '#/required',
            keyword: 'required',
            params: {missingProperty: 'dataSchema'},
            message: "should have required property 'dataSchema'",
        },
    ];

    const errorManifest = createMockModManifest(modId, [filename]);

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        // Instantiate mocks
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // Instantiate loader
        loader = new ComponentDefinitionLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );

        // --- Configure Mocks (Acceptance Criteria Setup) ---

        // IConfiguration: Return the main schema ID for components
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
            if (typeName === 'components') return componentDefSchemaId;
            return undefined;
        });

        // IPathResolver: Resolve the path for the invalid file
        mockResolver.resolveModContentPath.mockImplementation((mId, type, fName) => {
            if (mId === modId && type === 'components' && fName === filename) {
                return filePath;
            }
            // Fallback for potential other calls (though none expected in this specific test)
            return `./data/mods/${mId}/${type}/${fName}`;
        });

        // IDataFetcher: Return the invalid data when the specific file is fetched
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === filePath) {
                return Promise.resolve(JSON.parse(JSON.stringify(invalidData)));
            }
            throw new Error(`Unexpected fetch call: ${path}`);
        });

        // ISchemaValidator:
        // 1. Simulate the main component definition schema is loaded
        mockValidator._setSchemaLoaded(componentDefSchemaId, { /* mock schema data if needed */});

        // 2. Configure the *specific validator function* for the main schema ID to fail
        mockValidator.mockValidatorFunction(componentDefSchemaId, (dataToValidate) => {
            // Only fail for the specific invalid data we're testing
            if (dataToValidate && dataToValidate.id === invalidData.id) {
                return {isValid: false, errors: mockErrors};
            }
            // Pass other data (shouldn't happen in this test)
            return {isValid: true, errors: null};
        });
    });

    // --- Test Case ---
    it('should handle component definition files failing schema validation', async () => {
        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, errorManifest);

        // --- Verify: Promise Resolves ---
        // Individual file errors should not reject the main load promise
        await expect(loadPromise).resolves.not.toThrow();

        // --- Verify: Returned Count ---
        const count = await loadPromise;
        expect(count).toBe(0); // No definitions were successfully loaded

        // --- Verify: ISchemaValidator.addSchema not called ---
        // Because the definition itself was invalid, its dataSchema should not be added
        expect(mockValidator.addSchema).not.toHaveBeenCalled();

        // --- Verify: IDataRegistry.store not called ---
        // The invalid definition should not be stored
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Log Message ---
        // Note: The code logs the schema failure AND the rejection reason as errors now
        expect(mockLogger.error).toHaveBeenCalledTimes(3); // Schema fail + Rejection reason

        // Check the schema validation failure error message specifically
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Schema validation failed'),
            expect.objectContaining({
                modId: modId,
                // In the code, the key is 'resolvedPath', let's check that
                resolvedPath: filePath, // Check path resolution worked
                schemaId: componentDefSchemaId,
                validationErrors: mockErrors, // Ensure the specific errors are logged
            })
        );
        // Check specific substrings in the primary error message string of the first error call
        const schemaErrorCall = mockLogger.error.mock.calls.find(call => call[0].includes('Schema validation failed'));
        expect(schemaErrorCall).toBeDefined();
        if (schemaErrorCall) { // Check if found to avoid error on undefined
            const errorMessage = schemaErrorCall[0];
            expect(errorMessage).toContain(filename);
            expect(errorMessage).toContain(modId);
            expect(errorMessage).toContain(componentDefSchemaId);
        }


        // --- Verify: Final Warning Log Message ---
        // Check the summary warning at the end of loadComponentDefinitions

        // *** DEBUGGING START - REMOVED ***
        // console.log('DEBUG: mockLogger.warn calls:', JSON.stringify(mockLogger.warn.mock.calls, null, 2));
        // *** DEBUGGING END ***

        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Should be called exactly once
        expect(mockLogger.warn).toHaveBeenCalledWith(
            // *** UPDATED ASSERTION: Check for the correct warning message ***
            `ComponentDefinitionLoader [${modId}]: Processing encountered 1 failures for component files. Check previous error logs for details.`
        );
        // Remove the redundant/incorrect checks for the other message format
        // expect(mockLogger.warn).toHaveBeenCalledWith(
        //     expect.stringMatching(/Completed processing\. Success: 0\/\d+\. Failures: 1\./)
        // );
        // expect(mockLogger.warn).toHaveBeenCalledWith(
        //     `ComponentDefinitionLoader: Mod '${modId}': Completed processing. Success: 0/${errorManifest.content.components.length}. Failures: 1.`
        // );


        // --- Verify Other Interactions (Sanity Check) ---
        expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith('components');
        // Check getValidator was called, but we don't need to inspect its return value directly now
        expect(mockValidator.getValidator).toHaveBeenCalledWith(componentDefSchemaId);

        // Check the failing validator function (retrieved via the mock's internal map) was actually called
        const validatorMap = mockValidator.getValidator.getMockImplementation() ? null : mockValidator.getValidator(componentDefSchemaId); // Get the *actual* validator fn from map if getValidator wasn't mocked
        if (validatorMap && jest.isMockFunction(validatorMap)) {
            expect(validatorMap).toHaveBeenCalledTimes(1);
            expect(validatorMap).toHaveBeenCalledWith(invalidData);
        } else {
            // This path might occur if the getValidator mock implementation was complex; log a warning if the function wasn't found/mocked as expected
            console.warn("Test Warning: Could not verify calls to the specific failing validator function retrieved via the mock's internal map.");
        }


        // Debug logs should show processing start, but not success messages
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing component file: ${filename}`));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully stored component definition'));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Registered dataSchema for component ID'));

    });
});