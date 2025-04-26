// tests/core/services/componentDefinitionLoader.test.js
// -----------------------------------------------------------------------------
// Sub-Ticket 6.1: Setup Component Loader Test Environment & Mocks
// -----------------------------------------------------------------------------
// This file establishes the testing infrastructure for ComponentDefinitionLoader.
// It includes mock implementations for dependencies (IConfiguration, IPathResolver,
// IDataFetcher, ISchemaValidator, IDataRegistry, ILogger) and a Jest test harness.
// -----------------------------------------------------------------------------

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js'; // Adjust path if necessary

// --- Mock Service Factories ---

/**
 * Creates a mock IConfiguration service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
    getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'components') {
            // Matches the schema provided in the ticket
            return 'http://example.com/schemas/component-definition.schema.json';
        }
        // Default fallback for other types if needed in future tests
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    // Include other IConfiguration methods if needed by the loader, mocking their returns
    ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
 */
const createMockPathResolver = (overrides = {}) => ({
    // Mock the method used by ComponentDefinitionLoader's #processSingleComponentFile
    resolveModContentPath: jest.fn((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    // Include other IPathResolver methods if needed, mocking their returns
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`), // Example for non-mod paths if used elsewhere
    ...overrides,
});

/**
 * Creates a mock IDataFetcher service.
 * Allows configuring responses and errors based on fetched paths.
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
            // Deep clone to prevent tests from modifying the mock response object
            return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
        }
        return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for ${path}`));
    }),
});

/**
 * Creates a mock ISchemaValidator service.
 * Allows tracking calls and configuring return values/errors.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
    // Internal state to simulate loaded schemas for override scenarios
    const loadedSchemas = new Map();
    const schemaValidators = new Map(); // Store mock validator functions per schemaId

    const mockValidator = {
        addSchema: jest.fn(async (schemaData, schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                // Simulate Ajv's behavior: throw if schema exists
                throw new Error(`Mock Schema Error: Schema with ID '${schemaId}' already exists.`);
            }
            // Simulate successful addition
            loadedSchemas.set(schemaId, schemaData);
            // Create a mock validator function for this schema
            const mockValidationFn = jest.fn((data) => {
                // Default mock validation behavior: succeed unless overridden
                // This function can be customized per test using jest.spyOn or specific overrides
                // Check for a special marker to simulate failure
                if (data && data._mock_validation_should_fail) {
                    return {isValid: false, errors: [{message: `Mock validation failed for ${schemaId}`}]};
                }
                return {isValid: true, errors: null};
            });
            schemaValidators.set(schemaId, mockValidationFn);
        }),
        removeSchema: jest.fn((schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                loadedSchemas.delete(schemaId);
                schemaValidators.delete(schemaId);
                return true; // Simulate successful removal
            }
            return false; // Simulate schema not found
        }),
        isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
        getValidator: jest.fn((schemaId) => {
            // Return the specific mock validation function if the schema is "loaded"
            return schemaValidators.get(schemaId);
        }),
        validate: jest.fn((schemaId, data) => {
            const validatorFn = schemaValidators.get(schemaId);
            if (validatorFn) {
                return validatorFn(data); // Use the specific mock validator
            }
            // Simulate schema not found during direct validation
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`}]
            };
        }),
        // Allow overriding default mock methods
        ...overrides,
    };

    // Add helper to easily configure a specific validator function's behavior
    mockValidator.mockValidatorFunction = (schemaId, implementation) => {
        if (schemaValidators.has(schemaId)) {
            schemaValidators.get(schemaId).mockImplementation(implementation);
        } else {
            // If schema wasn't "added" yet, create a mock validator for it
            const newMockFn = jest.fn(implementation);
            schemaValidators.set(schemaId, newMockFn);
        }
    };

    // Helper to check if a schema was 'added'
    mockValidator.getAddedSchema = (schemaId) => loadedSchemas.get(schemaId);


    return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 * Allows tracking calls and simulating existing data for overrides.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').IDataRegistry} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
    // Internal state to simulate stored data
    const registryData = new Map(); // Outer map keys are 'type' (e.g., 'component_definitions')

    return {
        store: jest.fn((type, id, data) => {
            if (!registryData.has(type)) {
                registryData.set(type, new Map());
            }
            // Deep clone to prevent tests modifying stored mock data
            registryData.get(type).set(id, JSON.parse(JSON.stringify(data)));
        }),
        get: jest.fn((type, id) => {
            const typeMap = registryData.get(type);
            // Return a deep clone if found, otherwise undefined
            return typeMap?.has(id) ? JSON.parse(JSON.stringify(typeMap.get(id))) : undefined;
        }),
        // getAll: Not directly used by ComponentDefinitionLoader, but can be mocked if needed
        getAll: jest.fn((type) => {
            const typeMap = registryData.get(type);
            return typeMap ? Array.from(typeMap.values()).map(d => JSON.parse(JSON.stringify(d))) : [];
        }),
        // Utility to check stored data directly in tests
        _getData: (type, id) => {
            const typeMap = registryData.get(type);
            return typeMap?.get(id); // No clone needed for internal check
        },
        // Utility to prepopulate data for override tests
        _prepopulate: (type, id, data) => {
            if (!registryData.has(type)) {
                registryData.set(type, new Map());
            }
            registryData.get(type).set(id, JSON.parse(JSON.stringify(data)));
        },
        // Allow overriding default mock methods
        ...overrides,
    };
};

/**
 * Creates a mock ILogger service.
 * All methods are jest.fn() for tracking calls.
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

// --- Test Utility Functions ---

/**
 * Creates a basic valid mock component definition object.
 * @param {string} id - The component ID (e.g., 'core:health').
 * @param {object} [dataSchema={ type: 'object', properties: {} }] - The data schema object.
 * @param {string} [description=''] - Optional description.
 * @returns {object} A mock component definition object.
 */
const createMockComponentDefinition = (id, dataSchema = {type: 'object', properties: {}}, description = '') => ({
    id: id,
    dataSchema: dataSchema,
    ...(description && {description: description}), // Only include description if provided
});

/**
 * Creates a basic mock Mod Manifest object containing component files.
 * @param {string} modId - The ID of the mod.
 * @param {string[]} componentFiles - Array of component definition filenames.
 * @returns {object} A mock mod manifest object.
 */
const createMockModManifest = (modId, componentFiles = []) => ({
    id: modId,
    name: `Mock Mod ${modId}`,
    version: '1.0.0',
    content: {
        components: componentFiles,
        // Other content types can be added here if needed for broader tests
    },
});


// --- Test Suite ---

describe('ComponentDefinitionLoader Test Setup', () => {
    // Declare variables for mock instances and the loader itself
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader; // Instance of ComponentDefinitionLoader

    // Setup before each test
    beforeEach(() => {
        // *** FIX START: Clear mocks *before* instantiation ***
        // Clear any mock calls from previous tests first
        jest.clearAllMocks();
        // *** FIX END ***

        // Create fresh mock instances for isolation
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // Instantiate the loader with the mocks
        loader = new ComponentDefinitionLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );

        // *** REMOVED jest.clearAllMocks() from here ***
    });

    // --- Basic Setup Verification Test ---
    it('should instantiate ComponentDefinitionLoader with all mock dependencies', () => {
        // AC: A test suite structure is created where ComponentDefinitionLoader
        //     can be instantiated with the configured mocks before each test.
        expect(loader).toBeInstanceOf(ComponentDefinitionLoader);

        // Optional: Verify that the constructor logged its creation message
        // Note: The actual loader code logs 'ComponentDefinitionLoader: Instance created and services injected.'
        // This assertion should now pass because mocks are cleared *before* instantiation.
        expect(mockLogger.info).toHaveBeenCalledWith('ComponentDefinitionLoader: Instance created and services injected.');
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Be precise
    });

    it('should have mock services ready for configuration and tracking', () => {
        // AC: Mock implementations for all required service interfaces are created.
        // AC: Mocks allow configuration of return values and throwing errors.
        // AC: Mocks allow tracking of method calls and arguments.

        // Example: Verify a mock method exists and is a Jest mock
        expect(mockConfig.getContentTypeSchemaId).toBeDefined();
        expect(jest.isMockFunction(mockConfig.getContentTypeSchemaId)).toBe(true);

        expect(mockResolver.resolveModContentPath).toBeDefined();
        expect(jest.isMockFunction(mockResolver.resolveModContentPath)).toBe(true);

        expect(mockFetcher.fetch).toBeDefined();
        expect(jest.isMockFunction(mockFetcher.fetch)).toBe(true);

        expect(mockValidator.addSchema).toBeDefined();
        expect(jest.isMockFunction(mockValidator.addSchema)).toBe(true);
        expect(mockValidator.removeSchema).toBeDefined();
        expect(jest.isMockFunction(mockValidator.removeSchema)).toBe(true);
        expect(mockValidator.isSchemaLoaded).toBeDefined();
        expect(jest.isMockFunction(mockValidator.isSchemaLoaded)).toBe(true);
        expect(mockValidator.getValidator).toBeDefined();
        expect(jest.isMockFunction(mockValidator.getValidator)).toBe(true);
        expect(mockValidator.validate).toBeDefined();
        expect(jest.isMockFunction(mockValidator.validate)).toBe(true);

        expect(mockRegistry.store).toBeDefined();
        expect(jest.isMockFunction(mockRegistry.store)).toBe(true);
        expect(mockRegistry.get).toBeDefined();
        expect(jest.isMockFunction(mockRegistry.get)).toBe(true);

        expect(mockLogger.info).toBeDefined();
        expect(jest.isMockFunction(mockLogger.info)).toBe(true);
        expect(mockLogger.warn).toBeDefined();
        expect(jest.isMockFunction(mockLogger.warn)).toBe(true);
        expect(mockLogger.error).toBeDefined();
        expect(jest.isMockFunction(mockLogger.error)).toBe(true);
        expect(mockLogger.debug).toBeDefined();
        expect(jest.isMockFunction(mockLogger.debug)).toBe(true);

        // Example: Test configurability (can be done in actual tests later)
        const testSchemaId = 'test:schema';
        mockValidator.isSchemaLoaded.mockReturnValueOnce(true);
        expect(mockValidator.isSchemaLoaded(testSchemaId)).toBe(true);
    });

    it('should have utility functions for creating mock data', () => {
        // AC: Basic test utility functions are created for preparing common mock
        //     manifest objects and component definition data.
        const mockDef = createMockComponentDefinition('test:id', {type: 'number'}, 'Test Desc');
        expect(mockDef).toEqual({
            id: 'test:id',
            dataSchema: {type: 'number'},
            description: 'Test Desc',
        });

        const mockManifest = createMockModManifest('testMod', ['comp1.json', 'comp2.json']);
        expect(mockManifest).toEqual({
            id: 'testMod',
            name: 'Mock Mod testMod',
            version: '1.0.0',
            content: {
                components: ['comp1.json', 'comp2.json'],
            },
        });
    });

    // --- Placeholder for Future Tests ---
    // describe('loadComponentDefinitions', () => {
    //   // Tests for the actual loading logic will go here in subsequent tickets (6.2 - 6.5)
    //   it.todo('should correctly process valid component definitions');
    //   it.todo('should handle fetch errors gracefully');
    //   it.todo('should handle primary schema validation failures');
    //   it.todo('should handle missing component IDs or dataSchemas');
    //   it.todo('should correctly register data schemas with the validator');
    //   it.todo('should correctly handle overrides for data schemas');
    //   it.todo('should store validated definitions in the registry');
    //    it.todo('should correctly handle overrides in the registry');
    //    it.todo('should handle errors during schema registration');
    //    it.todo('should handle errors during registry storage');
    // });

});