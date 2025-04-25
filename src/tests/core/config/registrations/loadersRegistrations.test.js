// src/core/config/registrations/loadersRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../services/schemaLoader.js').default} SchemaLoader */
/** @typedef {any} AppContainer */ // Using 'any' as the custom container type isn't defined

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerLoaders} from '../../../../core/config/registrations/loadersRegistrations.js'; // Adjust path as needed

// --- Dependencies ---
import {tokens} from '../../../../core/tokens.js';

// --- MOCK the Actual Loader/Service Classes (Optional but safe) ---
// If constructors have complex logic or side effects, mocking prevents issues.
// Here, they mainly store dependencies, so mocking might not be strictly needed if
// the mock container provides all dependencies correctly. We'll skip full class mocks
// for brevity, assuming the mock container handles dependency resolution sufficiently for the test.
// jest.mock('../../../../core/services/schemaLoader.js'); // Example if needed

// --- Mock Implementations (Core Services) ---
const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), // Added debug
};
const mockConfiguration = { /* Mock methods if needed by DefaultPathResolver */};
const mockPathResolver = {resolve: jest.fn(path => `resolved/${path}`)};
const mockSchemaValidator = {validate: jest.fn().mockReturnValue({valid: true})};
const mockDataRegistry = {register: jest.fn(), get: jest.fn()};
const mockDataFetcher = {fetchText: jest.fn().mockResolvedValue('{}')};

// --- Mock Custom DI Container (Copied from uiRegistrations.test.js) ---
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations, // Expose for snapshot testing
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            registrations.set(token, {factoryOrValue, options, instance: undefined});
        }),
        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                // Simulate fallback for testing dependencies of registered items
                if (token === tokens.ILogger) return mockLogger;
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}`);
            }
            const {factoryOrValue, options} = registration;
            if (options?.lifecycle === 'singleton') {
                if (registration.instance !== undefined) {
                    return registration.instance;
                }
                if (typeof factoryOrValue !== 'function') {
                    registration.instance = factoryOrValue;
                } else {
                    const factory = factoryOrValue;
                    registration.instance = factory(container); // Pass container
                }
                return registration.instance;
            }
            if (typeof factoryOrValue === 'function') {
                return factoryOrValue(container); // Pass container
            }
            return factoryOrValue;
        }),
    };
    return container;
};

describe('registerLoaders (with Mock DI Container)', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks like mockLogger.debug
        mockContainer = createMockContainer();

        // Pre-register the ABSOLUTELY ESSENTIAL dependency for registerLoaders itself: ILogger
        // The other dependencies (IConfig, IPathResolver etc.) are registered *by* registerLoaders,
        // so the mock container's resolve needs to handle them when the factories are invoked.
        // We'll register mock instances directly for simplicity *within* the test setup
        // to ensure the factories created by registerLoaders can resolve them.
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});

        // Clear mocks used *within* registerLoaders
        mockPathResolver.resolve.mockClear();
        mockSchemaValidator.validate.mockClear();
        mockDataRegistry.register.mockClear();
        mockDataRegistry.get.mockClear();
        mockDataFetcher.fetchText.mockClear();
    });

    it('should register all 10 services/loaders as singletons', () => {
        // Arrange
        registerLoaders(mockContainer);

        // Assert: Check registration calls
        const expectedTokens = [
            tokens.IConfiguration, tokens.IPathResolver, tokens.ISchemaValidator,
            tokens.IDataRegistry, tokens.IDataFetcher, tokens.SchemaLoader,
            tokens.ManifestLoader, tokens.RuleLoader, tokens.GenericContentLoader,
            tokens.ComponentDefinitionLoader
        ];

        expect(mockContainer.register).toHaveBeenCalledTimes(expectedTokens.length + 1); // +1 for the pre-registered mockLogger

        expectedTokens.forEach(token => {
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,
                expect.any(Function), // All are registered via factories (single or singletonFactory)
                expect.objectContaining({lifecycle: 'singleton'})
            );
        });

        // Assert: Check logger calls (debug level)
        expect(mockLogger.debug).toHaveBeenCalledWith('Loaders Registration: Starting core services and data loaders...');
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.IConfiguration}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.IPathResolver}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.ISchemaValidator}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.IDataRegistry}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.IDataFetcher}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.SchemaLoader}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.ManifestLoader}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.RuleLoader}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.GenericContentLoader}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Loaders Registration: Registered ${tokens.ComponentDefinitionLoader}.`);
        expect(mockLogger.debug).toHaveBeenCalledWith('Loaders Registration: Completed.');
    });

    it('should resolve SchemaLoader successfully (happy path) and respect singleton lifecycle', () => {
        // Arrange: Pre-register mocks needed by the SchemaLoader factory
        // (These will be resolved *by* the factory function when SchemaLoader is resolved)
        // The mock container's resolve needs to be able to return these when called by the factory.
        // We achieve this by ensuring they *get* registered by registerLoaders first,
        // or by enhancing the mock container's resolve logic to provide them if not found.
        // Let's enhance mock resolve slightly for robustness.

        const enhancedMockContainer = createMockContainer();
        // Enhance resolve to return specific mocks if not found in registrations map
        enhancedMockContainer.resolve = jest.fn((token) => {
            const registration = enhancedMockContainer._registrations.get(token);
            if (!registration) {
                // Provide mocks directly if resolve is called for them
                if (token === tokens.ILogger) return mockLogger;
                if (token === tokens.IConfiguration) return mockConfiguration;
                if (token === tokens.IPathResolver) return mockPathResolver;
                if (token === tokens.ISchemaValidator) return mockSchemaValidator;
                if (token === tokens.IDataFetcher) return mockDataFetcher;
                // No need for IDataRegistry mock here for SchemaLoader
                throw new Error(`Enhanced Mock Resolve Error: Token not registered or mocked: ${String(token)}`);
            }
            // ... rest of original resolve logic ...
            const {factoryOrValue, options} = registration;
            if (options?.lifecycle === 'singleton') {
                if (registration.instance !== undefined) return registration.instance;
                registration.instance = typeof factoryOrValue === 'function' ? factoryOrValue(enhancedMockContainer) : factoryOrValue;
                return registration.instance;
            }
            return typeof factoryOrValue === 'function' ? factoryOrValue(enhancedMockContainer) : factoryOrValue;
        });
        // Pre-register logger as it's resolved *by* registerLoaders itself
        enhancedMockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});

        registerLoaders(enhancedMockContainer); // Register everything

        // Act: Resolve SchemaLoader twice
        const loader1 = enhancedMockContainer.resolve(tokens.SchemaLoader);
        const loader2 = enhancedMockContainer.resolve(tokens.SchemaLoader);

        // Assert
        expect(loader1).toBeDefined();
        expect(loader1).toBeInstanceOf(Object); // Basic check, can't instanceof actual class easily without importing it here
        expect(loader1).toBe(loader2); // Singleton check

        // Verify that the resolve method was called for SchemaLoader
        expect(enhancedMockContainer.resolve).toHaveBeenCalledWith(tokens.SchemaLoader);

        // Optional: Verify dependencies were resolved during SchemaLoader instantiation
        // This relies on the factory function inside registerLoaders being called correctly by resolve.
        // We expect resolve to have been called for SchemaLoader's deps *during* the first resolve(SchemaLoader) call.
        expect(enhancedMockContainer.resolve).toHaveBeenCalledWith(tokens.IConfiguration);
        expect(enhancedMockContainer.resolve).toHaveBeenCalledWith(tokens.IPathResolver);
        expect(enhancedMockContainer.resolve).toHaveBeenCalledWith(tokens.IDataFetcher);
        expect(enhancedMockContainer.resolve).toHaveBeenCalledWith(tokens.ISchemaValidator);
        expect(enhancedMockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger); // Logger resolved by registerLoaders AND potentially by factory
    });

    it('should match snapshot for registration calls', () => {
        // Arrange
        registerLoaders(mockContainer);

        // Assert
        // Snapshot the calls made to the mock container's register function
        expect(mockContainer.register.mock.calls).toMatchSnapshot();
    });
});