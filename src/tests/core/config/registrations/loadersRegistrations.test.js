// Filename: src/tests/core/config/registrations/loadersRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../../core/services/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../../../core/services/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../../../core/services/componentLoader.js').default} ComponentDefinitionLoader */
/** @typedef {import('../../../../core/services/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../../../core/services/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../../../core/services/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../../../core/services/eventLoader.js').default} EventLoader */
/** @typedef {import('../../../../core/services/entityLoader.js').default} EntityLoader */ // Corrected path
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerLoaders} from '../../../../core/config/registrations/loadersRegistrations.js'; // Corrected path

// --- Dependencies ---
import {tokens} from '../../../../core/tokens.js';
import SchemaLoader from '../../../../core/services/schemaLoader.js'; // Import actual class
// Import other actual loader classes if needed for instanceof checks
import RuleLoader from '../../../../core/services/ruleLoader.js';
import ComponentLoader from '../../../../core/services/componentLoader.js';
import GameConfigLoader from '../../../../core/services/gameConfigLoader.js';
import ModManifestLoader from '../../../../core/services/modManifestLoader.js';
import ActionLoader from '../../../../core/services/actionLoader.js';
import EventLoader from '../../../../core/services/eventLoader.js';
import EntityLoader from '../../../../core/services/entityLoader.js';
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
            'system-rules': 'http://example.com/schemas/system-rule.schema.json',
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
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
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
    // --- Use a spy on the actual resolve implementation ---
    let containerInstance;
    const resolveSpy = jest.fn((token) => {
        const registration = registrations.get(token);
        if (!registration) {
            // Fallback logic for base dependencies if not explicitly registered *before* resolve is called
            if (token === tokens.ILogger) return mockLogger;
            throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${String(token)}`);
        }
        const {factoryOrValue, options} = registration;
        // Correct handling for singletonFactory and single
        const isFactory = typeof factoryOrValue === 'function' && !options?.isInstance;

        if (options?.lifecycle === 'singleton') {
            if (registration.instance === undefined) {
                // If it's a factory, call it; otherwise, use the value directly
                registration.instance = isFactory ? factoryOrValue(containerInstance) : factoryOrValue;
            }
            return registration.instance;
        }
        // For transient or other lifecycles, call factory if it's one, else return value
        return isFactory ? factoryOrValue(containerInstance) : factoryOrValue;
    });


    containerInstance = {
        _registrations: registrations,
        // Simplified register spy, capturing token, factory/value, and options
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            // Mark if it's an instance registration for resolver logic
            // IMPORTANT: Create a *copy* of options before modifying to avoid affecting caller's object
            const internalOptions = {...options};
            internalOptions.isInstance = typeof factoryOrValue !== 'function' || options?.lifecycle === 'instance';
            registrations.set(token, {factoryOrValue, options: internalOptions, instance: undefined}); // Store modified options
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
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton', isInstance: true}); // Mark as instance

        // Clear mocks for dependencies that might be called during registration
        // (Ensure all methods on mocks are cleared)
        Object.values(mockPathResolver).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        Object.values(mockSchemaValidator).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        Object.values(mockDataFetcher).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        Object.values(mockDataRegistry).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        Object.values(mockConfiguration).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();

        // Clear ONLY the resolve spy's history. Keep register history.
        mockContainer.resolve.mockClear();
        // *** Keep register mock history: mockContainer.register.mockClear(); ***
    });

    // Test 'should register all...' passes
    it('should register all 14 services/loaders (+ ILogger) as singletons', () => {
        // Arrange: Logger is already registered in beforeEach

        // Act: Register the loaders
        registerLoaders(mockContainer);

        // Assert
        // Corrected list including Infra + Loaders registered by the function
        const expectedTokens = [
            // Infrastructure Interfaces
            tokens.IConfiguration, tokens.IPathResolver, tokens.ISchemaValidator,
            tokens.IDataRegistry, tokens.IDataFetcher,
            // Specific Loaders
            tokens.SchemaLoader, tokens.RuleLoader,
            tokens.ComponentDefinitionLoader, tokens.GameConfigLoader, tokens.ModManifestLoader,
            tokens.ActionLoader, tokens.EventLoader, tokens.EntityLoader // <<< Using EntityLoader token
        ];
        const expectedRegistrationCount = expectedTokens.length; // Should be 14

        // Expect 1 (ILogger from beforeEach) + 14 (from registerLoaders) = 15 calls
        expect(mockContainer.register).toHaveBeenCalledTimes(expectedRegistrationCount + 1); // Expect 15

        // Check that each expected token was registered with a factory and singleton lifecycle
        expectedTokens.forEach(token => {
            // Check if the token exists before asserting
            if (!token) {
                console.error(`Test Error: Expected token is undefined. Check tokens.js and expectedTokens array.`);
                // Find which token is missing
                const definedTokens = Object.keys(tokens);
                const missing = expectedTokens.find(t => !definedTokens.includes(Object.keys(tokens).find(k => tokens[k] === t)));
                throw new Error(`Undefined token found in expectedTokens array: possibly ${missing ? String(missing) : 'unknown'}. Check tokens.js.`);
            }
            // **** MODIFICATION HERE ****
            // Use expect.objectContaining for the options object
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,                   // The token itself
                expect.any(Function),    // The factory function
                expect.objectContaining({ // Check that the object CONTAINS this property
                    lifecycle: 'singleton'
                })
            );
            // **** END MODIFICATION ****
        });

        // Check the ILogger registration from beforeEach separately for clarity
        // It was call #1 before registerLoaders ran
        // Use objectContaining here too for consistency, although toEqual would also work
        // if the mock registration logic is correct
        expect(mockContainer.register.mock.calls[0]).toEqual([
            tokens.ILogger,
            mockLogger,
            expect.objectContaining({lifecycle: 'singleton', isInstance: true})
        ]);


        // Verify logger calls within registerLoaders
        // 1 "Starting..." + 14 "Registered..." = 15 debug logs
        // 1 "Completed." = 1 info log
        expect(mockLogger.debug).toHaveBeenCalledTimes(1 + expectedRegistrationCount);
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Loaders Registration: Completed.');
    });


    it('should resolve SchemaLoader successfully (happy path) and respect singleton lifecycle', () => {
        // Arrange
        // registerLoaders needs ILogger available when called
        // (ILogger is registered in beforeEach)
        registerLoaders(mockContainer); // This registers SchemaLoader factory

        // Act: Resolve SchemaLoader twice
        const loader1 = mockContainer.resolve(tokens.SchemaLoader);
        const loader2 = mockContainer.resolve(tokens.SchemaLoader);

        // Assert
        expect(loader1).toBeDefined();
        expect(loader1).toBeInstanceOf(SchemaLoader);
        expect(loader1).toBe(loader2); // Singleton check

        // Verify dependencies were resolved by the factory during the *first* resolve call.
        const callsToResolve = mockContainer.resolve.mock.calls;

        // Check which tokens were resolved AT LEAST ONCE.
        const resolvedTokens = new Set(callsToResolve.map(call => call[0]));

        // Explicitly check the dependencies needed JUST for SchemaLoader's factory
        expect(resolvedTokens).toContain(tokens.IConfiguration);
        expect(resolvedTokens).toContain(tokens.IPathResolver);
        expect(resolvedTokens).toContain(tokens.IDataFetcher);
        expect(resolvedTokens).toContain(tokens.ISchemaValidator);
        // ILogger is resolved by registerLoaders itself AND by the factory
        expect(resolvedTokens).toContain(tokens.ILogger);

        // Check the explicit resolve calls for SchemaLoader happened
        expect(resolvedTokens).toContain(tokens.SchemaLoader);
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

    // Add more tests for other loaders if needed...
    // Example: Test resolving EntityLoader
    it('should resolve EntityLoader successfully and respect singleton lifecycle', () => {
        // Arrange
        // (ILogger is registered in beforeEach)
        registerLoaders(mockContainer);

        // Act
        const loader1 = mockContainer.resolve(tokens.EntityLoader);
        const loader2 = mockContainer.resolve(tokens.EntityLoader);

        // Assert
        expect(loader1).toBeDefined();
        expect(loader1).toBeInstanceOf(EntityLoader);
        expect(loader1).toBe(loader2); // Singleton check

        // Verify dependencies were resolved
        const resolvedTokens = new Set(mockContainer.resolve.mock.calls.map(call => call[0]));
        expect(resolvedTokens).toContain(tokens.IConfiguration);
        expect(resolvedTokens).toContain(tokens.IPathResolver);
        expect(resolvedTokens).toContain(tokens.IDataFetcher);
        expect(resolvedTokens).toContain(tokens.ISchemaValidator);
        expect(resolvedTokens).toContain(tokens.IDataRegistry);
        expect(resolvedTokens).toContain(tokens.ILogger);
    });
});
