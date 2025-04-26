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

// --- UPDATED mockConfiguration (Remove getManifestSchemaId as it's no longer checked) ---
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
        jest.clearAllMocks();
        mockContainer = createMockContainer();

        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});

        // Clear mocks - ensure spies on container methods are also cleared if applicable
        mockPathResolver.resolve?.mockClear(); // Optional chaining if resolve might not exist
        mockPathResolver.resolveSchemaPath.mockClear();
        mockSchemaValidator.validate?.mockClear();
        mockSchemaValidator.addSchema.mockClear();
        mockSchemaValidator.isSchemaLoaded.mockClear();
        mockDataRegistry.register.mockClear();
        mockDataRegistry.get.mockClear();
        mockDataFetcher.fetch?.mockClear();
        mockDataFetcher.fetchText?.mockClear();
        Object.values(mockConfiguration).forEach(mockFn => typeof mockFn?.mockClear === 'function' && mockFn.mockClear());

        // Clear the container's own mock functions/spies
        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear(); // Clear the spy
    });

    // Test 'should register all...' passes (assuming previous fixes are applied)
    it('should register all 11 services/loaders as singletons', () => {
        registerLoaders(mockContainer);
        const expectedTokens = [
            tokens.IConfiguration, tokens.IPathResolver, tokens.ISchemaValidator,
            tokens.IDataRegistry, tokens.IDataFetcher, tokens.SchemaLoader,
            tokens.RuleLoader, tokens.GenericContentLoader,
            tokens.ComponentDefinitionLoader, tokens.GameConfigLoader, tokens.ModManifestLoader
        ];
        // Logger (pre-registered) + 11 loaders/services = 12
        expect(mockContainer.register).toHaveBeenCalledTimes(expectedTokens.length + 1);
        // ... other assertions for this test
        expect(mockLogger.debug).toHaveBeenCalledTimes(13); // 1 start + 11 registers
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // 1 complete
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

        // --- CORRECTED ASSERTION ---
        // Verify the *total* number of calls to the container's resolve method.
        // 1 (Logger in registerLoaders)
        // + 1 (SchemaLoader - explicit call 1)
        // + 1 (IConfiguration - factory dep)
        // + 1 (IPathResolver - factory dep)
        // + 1 (IConfiguration - IPathResolver factory dep)
        // + 1 (IDataFetcher - factory dep)
        // + 1 (ISchemaValidator - factory dep)
        // + 1 (ILogger - factory dep)
        // + 1 (SchemaLoader - explicit call 2)
        // = 9 Total Calls
        expect(mockContainer.resolve).toHaveBeenCalledTimes(9);

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