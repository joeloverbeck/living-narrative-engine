// Filename: src/tests/core/config/registrations/loadersRegistrations.test.js
// ****** CORRECTED FILE ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../../core/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../../../core/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../../../core/loaders/componentLoader.js').default} ComponentDefinitionLoader */
/** @typedef {import('../../../../core/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../../../core/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../../../core/loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../../../core/loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../../../core/loaders/entityLoader.js').default} EntityLoader */ // Corrected path
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerLoaders} from '../../../../core/config/registrations/loadersRegistrations.js'; // Corrected path

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';
import SchemaLoader from '../../../../core/loaders/schemaLoader.js'; // Import actual class
// Import other actual loader classes if needed for instanceof checks
import RuleLoader from '../../../../core/loaders/ruleLoader.js';
import ComponentLoader from '../../../../core/loaders/componentLoader.js';
import GameConfigLoader from '../../../../core/loaders/gameConfigLoader.js';
import ModManifestLoader from '../../../../core/modding/modManifestLoader.js';
import ActionLoader from '../../../../core/loaders/actionLoader.js';
import EventLoader from '../../../../core/loaders/eventLoader.js';
import EntityLoader from '../../../../core/loaders/entityLoader.js';
import StaticConfiguration from '../../../../core/services/staticConfiguration.js';
import DefaultPathResolver from '../../../../core/services/defaultPathResolver.js';
import AjvSchemaValidator from '../../../../core/services/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../../core/services/inMemoryDataRegistry.js';
import WorkspaceDataFetcher from '../../../../core/services/workspaceDataFetcher.js';


// --- Mock Implementations (Core Services) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

const mockConfiguration = {
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getSchemaFiles: jest.fn().mockReturnValue(['common.schema.json', 'entity.schema.json']),
    getContentTypeSchemaId: jest.fn((typeName) => {
        const map = { /* map based on actual config if needed */
            'components': 'http://example.com/schemas/component-definition.schema.json',
            'actions': 'http://example.com/schemas/action-definition.schema.json',
            'events': 'http://example.com/schemas/event-definition.schema.json',
            'entities': 'http://example.com/schemas/entity.schema.json', // Needed by EntityLoader
            'rules': 'http://example.com/schemas/rule.schema.json',
            'game': 'http://example.com/schemas/game.schema.json',
            'mod-manifest': 'http://example.com/schemas/mod.manifest.schema.json',
        };
        return map[typeName];
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('./data/schemas'),
    getContentBasePath: jest.fn(typeName => `./data/${typeName}`),
    getWorldBasePath: jest.fn().mockReturnValue('./data/worlds'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModsBasePath: jest.fn().mockReturnValue('mods'), // Needed for ModManifestLoader etc.
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'), // Needed
    getRuleBasePath: jest.fn().mockReturnValue('./data/system-rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/rule.schema.json'),
};

// Provide all methods used by ANY loader being registered
const mockPathResolver = {
    resolveSchemaPath: jest.fn(filename => `resolved/schemas/${filename}`),
    resolveModContentPath: jest.fn((modId, typeName, filename) => `resolved/mods/${modId}/${typeName}/${filename}`),
    resolveModManifestPath: jest.fn(modId => `resolved/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => 'resolved/game.json'),
    resolveRulePath: jest.fn(filename => `resolved/rules/${filename}`),
    // Add other methods if necessary
};

// Provide all methods used by ANY loader being registered
const mockSchemaValidator = {
    validate: jest.fn().mockReturnValue({isValid: true}),
    addSchema: jest.fn(),
    isSchemaLoaded: jest.fn().mockReturnValue(true), // Assume schemas are loaded for resolver tests
    getValidator: jest.fn((schemaId) => {
        // Return a mock validator function
        const mockValidateFn = jest.fn().mockReturnValue({isValid: true, errors: null});
        // Ajv attaches errors to the function itself
        mockValidateFn.errors = null;
        return mockValidateFn;
    }),
    removeSchema: jest.fn().mockReturnValue(true), // Needed by ComponentLoader
};

// Provide all methods used by ANY loader being registered
const mockDataFetcher = {
    fetch: jest.fn().mockResolvedValue({
        $id: 'http://example.com/schemas/common.schema.json', // Default for schema load
        id: 'test-id', // Default for content load
        dataSchema: {} // Default for component load
    }),
};

const mockDataRegistry = {
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined), // Default to not finding existing items
    getAll: jest.fn().mockReturnValue([]),
    // Add other methods if necessary
};


// --- Mock Custom DI Container ---
const createMockContainer = () => {
    const registrations = new Map();
    let containerInstance; // Define containerInstance to be accessible in resolveSpy

    const resolveSpy = jest.fn((token) => {
        const registration = registrations.get(token);
        if (!registration) {
            // Fallback logic for base dependencies if not explicitly registered *before* resolve is called
            if (token === tokens.ILogger) return mockLogger;
            // Return basic mocks for other common dependencies if needed for factory resolution
            if (token === tokens.IConfiguration) return mockConfiguration;
            if (token === tokens.IPathResolver) return mockPathResolver;
            if (token === tokens.IDataFetcher) return mockDataFetcher;
            if (token === tokens.ISchemaValidator) return mockSchemaValidator;
            if (token === tokens.IDataRegistry) return mockDataRegistry;

            throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${String(token)}`);
        }
        const {factoryOrValue, options} = registration;
        const isFactory = typeof factoryOrValue === 'function' && !options?.isInstance;

        // --- VVVV MODIFIED SECTION VVVV ---
        // Correct handling for BOTH singleton and singletonFactory lifecycles
        if (options?.lifecycle === 'singleton' || options?.lifecycle === 'singletonFactory') {
            // Check if instance already exists on the registration entry
            if (registration.instance === undefined) {
                // Create and cache instance if it doesn't exist
                // If it's a factory, call it with the container; otherwise, use the value directly.
                registration.instance = isFactory ? factoryOrValue(containerInstance) : factoryOrValue;
            }
            // Return the cached instance
            return registration.instance;
        }
        // --- ^^^^ MODIFIED SECTION ^^^^ ---

        // For transient or unspecified lifecycles, create new instance if it's a factory
        return isFactory ? factoryOrValue(containerInstance) : factoryOrValue;
    });


    containerInstance = {
        _registrations: registrations,
        // Simplified register spy, capturing token, factory/value, and options
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            // Mark if it's an instance registration for resolver logic
            const internalOptions = {...options}; // Copy options
            internalOptions.isInstance = typeof factoryOrValue !== 'function' || options?.lifecycle === 'instance'; // isInstance is internal mock detail
            // Store the original options from the call as well for snapshot testing
            registrations.set(token, {
                factoryOrValue,
                options: options, // Store original options for snapshot/assertions
                internalOptions: internalOptions, // Store internal options for mock resolve logic
                instance: undefined // Initialize instance cache
            });
        }),
        resolve: resolveSpy,
    };
    return containerInstance;
};


describe('registerLoaders (with Mock DI Container)', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContainer = createMockContainer();

        // Register the logger BEFORE calling the function under test
        // Use internalOptions here for the mock's logic
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'}); // Register with original options

        // Clear mocks for dependencies that might be called during registration
        Object.values(mockPathResolver).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        Object.values(mockSchemaValidator).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        Object.values(mockDataFetcher).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        Object.values(mockDataRegistry).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        Object.values(mockConfiguration).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();

        mockContainer.resolve.mockClear();
        // Keep register mock history
    });

    it('should register all 14 services/loaders (+ ILogger) as singletons', () => {
        // Arrange: Logger is already registered in beforeEach

        // Act: Register the loaders
        registerLoaders(mockContainer);

        // Assert
        const expectedTokens = [
            // Infrastructure Interfaces
            tokens.IConfiguration, tokens.IPathResolver, tokens.ISchemaValidator,
            tokens.IDataRegistry, tokens.IDataFetcher,
            // Specific Loaders
            tokens.SchemaLoader, tokens.RuleLoader,
            tokens.ComponentDefinitionLoader, tokens.GameConfigLoader, tokens.ModManifestLoader,
            tokens.ActionLoader, tokens.EventLoader, tokens.EntityLoader
        ];
        const expectedRegistrationCount = expectedTokens.length; // 14

        // Expect 1 (ILogger from beforeEach) + 14 (from registerLoaders) = 15 calls
        expect(mockContainer.register).toHaveBeenCalledTimes(expectedRegistrationCount + 1);

        // Check that each expected token was registered with a factory
        expectedTokens.forEach(token => {
            if (!token) {
                throw new Error(`Undefined token found in expectedTokens array. Check tokens.js.`);
            }
            // --- VVVV MODIFIED SECTION VVVV ---
            // Check only for token and factory. Rely on snapshot for lifecycle details.
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,                   // The token itself
                expect.any(Function),    // The factory function
                expect.any(Object)       // Options object (details checked in snapshot)
            );
            // --- ^^^^ MODIFIED SECTION ^^^^ ---
        });

        // Check the ILogger registration from beforeEach separately
        expect(mockContainer.register.mock.calls[0][0]).toBe(tokens.ILogger);
        expect(mockContainer.register.mock.calls[0][1]).toBe(mockLogger);
        expect(mockContainer.register.mock.calls[0][2]).toEqual({lifecycle: 'singleton'});


        // Verify logger calls within registerLoaders
        expect(mockLogger.debug).toHaveBeenCalledTimes(1 + expectedRegistrationCount); // 1 Starting + 14 Registered
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Loaders Registration: Completed.');
    });


    it('should resolve SchemaLoader successfully (happy path) and respect singleton lifecycle', () => {
        // Arrange
        registerLoaders(mockContainer);

        // Act: Resolve SchemaLoader twice
        const loader1 = mockContainer.resolve(tokens.SchemaLoader);
        const loader2 = mockContainer.resolve(tokens.SchemaLoader);

        // Assert
        expect(loader1).toBeDefined();
        expect(loader1).toBeInstanceOf(SchemaLoader);
        // This should now pass because the mock resolve handles singletonFactory correctly
        expect(loader1).toBe(loader2); // Singleton check

        // Verify dependencies were resolved by the factory during the *first* resolve call.
        const callsToResolve = mockContainer.resolve.mock.calls;
        const resolvedTokens = new Set(callsToResolve.map(call => call[0]));

        // Check dependencies needed for SchemaLoader factory were resolved at least once
        expect(resolvedTokens).toContain(tokens.IConfiguration);
        expect(resolvedTokens).toContain(tokens.IPathResolver);
        expect(resolvedTokens).toContain(tokens.IDataFetcher);
        expect(resolvedTokens).toContain(tokens.ISchemaValidator);
        expect(resolvedTokens).toContain(tokens.ILogger); // Resolved by registerLoaders AND factory

        // Check SchemaLoader itself was resolved twice
        expect(callsToResolve.filter(call => call[0] === tokens.SchemaLoader).length).toBe(2);
    });

    it('should match snapshot for registration calls', () => {
        // Arrange: Logger registration happens in beforeEach
        // Act
        registerLoaders(mockContainer);
        // Assert
        // Snapshot all calls including the ILogger from beforeEach
        expect(mockContainer.register.mock.calls).toMatchSnapshot();
    });

    it('should resolve EntityLoader successfully and respect singleton lifecycle', () => {
        // Arrange
        registerLoaders(mockContainer);

        // Act
        const loader1 = mockContainer.resolve(tokens.EntityLoader);
        const loader2 = mockContainer.resolve(tokens.EntityLoader);

        // Assert
        expect(loader1).toBeDefined();
        expect(loader1).toBeInstanceOf(EntityLoader);
        // This should now pass because the mock resolve handles singletonFactory correctly
        expect(loader1).toBe(loader2); // Singleton check

        // Verify dependencies were resolved
        const resolvedTokens = new Set(mockContainer.resolve.mock.calls.map(call => call[0]));
        expect(resolvedTokens).toContain(tokens.IConfiguration);
        expect(resolvedTokens).toContain(tokens.IPathResolver);
        expect(resolvedTokens).toContain(tokens.IDataFetcher);
        expect(resolvedTokens).toContain(tokens.ISchemaValidator);
        expect(resolvedTokens).toContain(tokens.IDataRegistry);
        expect(resolvedTokens).toContain(tokens.ILogger);

        // Check EntityLoader itself was resolved twice
        expect(mockContainer.resolve.mock.calls.filter(call => call[0] === tokens.EntityLoader).length).toBe(2);
    });
});