// src/tests/core/config/registrations/loadersRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../services/schemaLoader.js').default} SchemaLoader */ // Ensure path is correct
// Correct the SchemaLoader import path if it's different, e.g.:
// src/tests/core/config/registrations/loadersRegistrations.test.js

// --- JSDoc Imports ---
// ... (keep existing imports) ...
/** @typedef {import('../../../../core/services/schemaLoader.js').default} SchemaLoader */ // Corrected path example
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerLoaders} from '../../../../core/config/registrations/loadersRegistrations.js';

// --- Dependencies ---
import {tokens} from '../../../../core/tokens.js';
import SchemaLoader from '../../../../core/services/schemaLoader.js'; // Import actual class

// --- Mock Implementations (Core Services) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

const mockConfiguration = {
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getSchemaFiles: jest.fn().mockReturnValue(['common.schema.json', 'entity.schema.json']),
    getContentTypeSchemaId: jest.fn((typeName) => { /* ... */
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('./data/schemas'),
    getContentBasePath: jest.fn(typeName => `./data/${typeName}`),
    getWorldBasePath: jest.fn().mockReturnValue('./data/worlds'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getRuleBasePath: jest.fn().mockReturnValue('./data/system-rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
    // getManifestSchemaId: jest.fn().mockReturnValue(undefined), // REMOVED - No longer needed/checked
};

// --- UPDATED mockPathResolver (Provide resolveSchemaPath) ---
const mockPathResolver = {
    resolveSchemaPath: jest.fn(filename => `resolved/schemas/${filename}`), // Method used by SchemaLoader
    resolve: jest.fn(path => `resolved/${path}`) // Keep if needed by other loaders
};

// --- UPDATED mockSchemaValidator (Provide isSchemaLoaded) ---
const mockSchemaValidator = {
    validate: jest.fn().mockReturnValue({valid: true}), // Keep if needed by other loaders
    addSchema: jest.fn(), // Method used by SchemaLoader
    isSchemaLoaded: jest.fn().mockReturnValue(false) // Method used by SchemaLoader
};

// --- UPDATED mockDataFetcher (Provide fetch) ---
const mockDataFetcher = {
    fetch: jest.fn().mockResolvedValue({$id: 'http://example.com/schemas/common.schema.json'}), // Method used by SchemaLoader
    fetchText: jest.fn().mockResolvedValue('{}') // Keep if needed by other loaders
};

const mockDataRegistry = {register: jest.fn(), get: jest.fn()};


// --- Mock Custom DI Container ---
const createMockContainer = () => {
    const registrations = new Map();
    // --- Use a spy on the actual resolve implementation ---
    let containerInstance;
    const resolveSpy = jest.fn((token) => {
        const registration = registrations.get(token);
        if (!registration) {
            // Fallback logic
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.IConfiguration) return mockConfiguration;
            if (token === tokens.IPathResolver) return mockPathResolver;
            if (token === tokens.ISchemaValidator) return mockSchemaValidator;
            if (token === tokens.IDataFetcher) return mockDataFetcher;
            if (token === tokens.IDataRegistry) return mockDataRegistry;
            throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${String(token)}`);
        }
        const {factoryOrValue, options} = registration;
        if (options?.lifecycle === 'singleton') {
            if (registration.instance === undefined) {
                registration.instance = typeof factoryOrValue === 'function' ? factoryOrValue(containerInstance) : factoryOrValue;
            }
            return registration.instance;
        }
        return typeof factoryOrValue === 'function' ? factoryOrValue(containerInstance) : factoryOrValue;
    });

    containerInstance = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            registrations.set(token, {factoryOrValue, options, instance: undefined});
        }),
        // Assign the spy to the container's resolve method
        resolve: resolveSpy,
    };
    return containerInstance;
};


describe('registerLoaders (with Mock DI Container)', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks(); // Clears mocks from previous tests
        mockContainer = createMockContainer(); // Creates a fresh container with fresh spies

        // Register the logger BEFORE calling the function under test
        // This call SHOULD be counted by the assertion in the test.
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});

        // Clear mocks for dependencies that might be called during registration
        mockPathResolver.resolve?.mockClear();
        mockPathResolver.resolveSchemaPath.mockClear();
        mockSchemaValidator.validate?.mockClear();
        mockSchemaValidator.addSchema.mockClear();
        mockSchemaValidator.isSchemaLoaded.mockClear();
        mockDataRegistry.register.mockClear();
        mockDataRegistry.get.mockClear();
        mockDataFetcher.fetch?.mockClear();
        mockDataFetcher.fetchText?.mockClear();
        Object.values(mockConfiguration).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());

        // Clear the container's RESOLVE spy, as its calls depend on the specific test case
        mockContainer.resolve.mockClear();
        // DO NOT clear mockContainer.register here, as we want to count the ILogger registration above
        // along with the registrations done by registerLoaders.
    });

    // Test 'should register all...' passes (assuming previous fixes are applied)
    it('should register all 11 services/loaders as singletons', () => {
        // Arrange: Logger is already registered in beforeEach

        // Act: Register the loaders
        registerLoaders(mockContainer);

        // Assert
        const expectedTokens = [
            tokens.IConfiguration, tokens.IPathResolver, tokens.ISchemaValidator,
            tokens.IDataRegistry, tokens.IDataFetcher, tokens.SchemaLoader,
            tokens.RuleLoader, tokens.GenericContentLoader,
            tokens.ComponentDefinitionLoader, tokens.GameConfigLoader, tokens.ModManifestLoader
        ];
        // Expect 1 (ILogger from beforeEach) + 11 (from registerLoaders) = 12 calls
        expect(mockContainer.register).toHaveBeenCalledTimes(expectedTokens.length + 1);

        // Check that each expected token was registered (ensures no duplicates or wrong tokens)
        expectedTokens.forEach(token => {
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,           // The token itself
                expect.any(Function), // The factory function
                {lifecycle: 'singleton'} // The options object
            );
        });

        // Check the ILogger registration from beforeEach separately if needed, though the count implies it.
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.ILogger,
            mockLogger, // The mock implementation itself (not a factory)
            {lifecycle: 'singleton'}
        );


        // Verify logger calls within registerLoaders
        // Note: The count might change slightly depending on whether the Registrar helper logs.
        // Assuming the pattern `logger.debug('Loaders Registration: Registered ${token}.')`
        expect(mockLogger.debug).toHaveBeenCalledTimes(1 + expectedTokens.length); // 1 "Starting..." + 11 "Registered..."
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // 1 "Completed."
        expect(mockLogger.info).toHaveBeenCalledWith('Loaders Registration: Completed.');
    });


    it('should resolve SchemaLoader successfully (happy path) and respect singleton lifecycle', () => {
        // Arrange
        // Pre-register logger again for this specific test's container instance
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        // Call registerLoaders AFTER registering logger and BEFORE resolving anything else
        registerLoaders(mockContainer);

        // Act: Resolve SchemaLoader twice
        const loader1 = mockContainer.resolve(tokens.SchemaLoader);
        const loader2 = mockContainer.resolve(tokens.SchemaLoader);

        // Assert
        expect(loader1).toBeDefined();
        expect(loader1).toBeInstanceOf(SchemaLoader);
        expect(loader1).toBe(loader2); // Singleton check

        // Verify resolve was called *with* SchemaLoader token (twice explicitly)
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.SchemaLoader);

        expect(mockContainer.resolve).toHaveBeenCalledTimes(10);

        // Verify dependencies were resolved *by the factory* when resolve was called the first time.
        // These checks verify that the factory *did* ask for these tokens at least once.
        const callsToResolve = mockContainer.resolve.mock.calls;
        expect(callsToResolve).toEqual(
            expect.arrayContaining([
                [tokens.SchemaLoader], // From explicit call 1
                [tokens.SchemaLoader], // From explicit call 2
                [tokens.IConfiguration], // From SchemaLoader factory AND IPathResolver factory
                [tokens.IPathResolver], // From SchemaLoader factory
                [tokens.IDataFetcher], // From SchemaLoader factory
                [tokens.ISchemaValidator], // From SchemaLoader factory
                [tokens.ILogger] // From registerLoaders AND SchemaLoader factory
            ])
        );

        // Specific checks (still valid, check they were called at least once)
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IConfiguration);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IPathResolver);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDataFetcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ISchemaValidator);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
    });

    it('should match snapshot for registration calls', () => {
        registerLoaders(mockContainer);
        expect(mockContainer.register.mock.calls).toMatchSnapshot();
    });
});