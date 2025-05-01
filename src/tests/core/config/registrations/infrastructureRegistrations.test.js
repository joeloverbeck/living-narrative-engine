// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../../core/interfaces/loaders.js').ISchemaLoader} ISchemaLoader */
/** @typedef {import('../../../../core/interfaces/loaders.js').IManifestLoader} IManifestLoader */
/** @typedef {import('../../../../core/interfaces/loaders.js').IComponentDefinitionLoader} IComponentDefinitionLoader */
/** @typedef {import('../../../../core/interfaces/loaders.js').IRuleLoader} IRuleLoader */
/** @typedef {import('../../../../validation/interfaces.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../../core/interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager */
/** @typedef {import('../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../core/loaders/worldLoader.js').default} WorldLoader */
/** @typedef {import('../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerInfrastructure} from '../../../../core/config/registrations/infrastructureRegistrations.js'; // Adjust path if needed

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';

// --- MOCK the Modules (Classes being registered) ---
jest.mock('../../../../core/eventBus.js');
jest.mock('../../../../core/spatialIndexManager.js'); // Mock the concrete implementation
jest.mock('../../../../core/loaders/worldLoader.js');
jest.mock('../../../../core/services/gameDataRepository.js');
jest.mock('../../../../entities/entityManager.js');
jest.mock('../../../../services/validatedEventDispatcher.js');

// --- Import AFTER mocking ---
import EventBus from '../../../../core/eventBus.js';
import SpatialIndexManager from '../../../../core/spatialIndexManager.js';
import WorldLoader from '../../../../core/loaders/worldLoader.js';
import {GameDataRepository} from '../../../../core/services/gameDataRepository.js';
import EntityManager from '../../../../entities/entityManager.js';
import ValidatedEventDispatcher from '../../../../services/validatedEventDispatcher.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
// Mock other external dependencies required by the factories
const mockDataRegistry = {};
const mockSchemaLoader = {};
const mockManifestLoader = {};
const mockComponentDefinitionLoader = {};
const mockRuleLoader = {};
const mockSchemaValidator = {};
const mockConfiguration = {};
// For ISpatialIndexManager, the registration provides its own factory, but we mocked the class it uses.
const mockSpatialIndexManagerInstance = new SpatialIndexManager();
// Mock EventBus instance needed by ValidatedEventDispatcher factory
const mockEventBusInstance = new EventBus();


// --- Mock Custom DI Container (Copied from interpreterRegistrations.test.js) ---
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            const registration = {factoryOrValue, options, instance: undefined};
            registrations.set(token, registration);

            if (options?.lifecycle === 'singleton') {
                if (typeof factoryOrValue === 'function' && registration.instance === undefined) {
                    try {
                        const factory = factoryOrValue;
                        // Simulate resolution during registration for testing purposes
                        registration.instance = factory(container);
                    } catch (e) {
                        // console.warn(`Mock container: Error executing factory during registration for ${String(token)}: ${e.message}`);
                        registration.instance = undefined;
                    }
                } else if (typeof factoryOrValue !== 'function') {
                    registration.instance = factoryOrValue;
                }
            }
        }),
        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;

            if (options?.lifecycle === 'singleton') {
                if (registration.instance !== undefined) {
                    return registration.instance;
                }
                if (typeof factoryOrValue === 'function') {
                    try {
                        registration.instance = factoryOrValue(container);
                    } catch (e) {
                        console.error(`Mock container: Error executing factory during resolve for ${String(token)}: ${e.message}`);
                        throw e;
                    }

                } else {
                    registration.instance = factoryOrValue;
                }
                return registration.instance;
            }

            // Transient or non-singleton
            if (typeof factoryOrValue === 'function') {
                try {
                    return factoryOrValue(container);
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    throw e;
                }
            }
            return factoryOrValue; // Return value directly
        }),
        resolveAll: jest.fn((tag) => { // Basic mock for resolveAll
            const resolved = [];
            registrations.forEach((reg, token) => {
                if (reg.options?.tags?.includes(tag)) {
                    try {
                        resolved.push(container.resolve(token));
                    } catch (e) {
                    }
                }
            });
            return resolved;
        })
    };
    return container;
};


describe('registerInfrastructure', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks defined via jest.mock

        mockContainer = createMockContainer();

        // Pre-register MOCKED core/external dependencies required by infrastructure factories
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IDataRegistry, mockDataRegistry, {lifecycle: 'singleton'});
        mockContainer.register(tokens.SchemaLoader, mockSchemaLoader, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ComponentDefinitionLoader, mockComponentDefinitionLoader, {lifecycle: 'singleton'});
        mockContainer.register(tokens.RuleLoader, mockRuleLoader, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ISchemaValidator, mockSchemaValidator, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IConfiguration, mockConfiguration, {lifecycle: 'singleton'});
        // Register the mocked EventBus instance needed by VED factory
        mockContainer.register(tokens.EventBus, mockEventBusInstance, {lifecycle: 'singleton'});
        // Although ISpatialIndexManager is registered here, its factory uses SpatialIndexManager, which we mocked.
        // Let's pre-register the mock instance for ISpatialIndexManager to satisfy EntityManager factory.
        mockContainer.register(tokens.ISpatialIndexManager, mockSpatialIndexManagerInstance, {lifecycle: 'singleton'});


        // Clear call counts on the mock service functions/constructors
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        EventBus.mockClear();
        SpatialIndexManager.mockClear();
        WorldLoader.mockClear();
        GameDataRepository.mockClear();
        EntityManager.mockClear();
        ValidatedEventDispatcher.mockClear();
    });

    it('should register infrastructure services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerInfrastructure(mockContainer);
        }).not.toThrow();

        // Assert: Check if main services were registered (using the mock register function)
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.EventBus, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ISpatialIndexManager, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.WorldLoader, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.GameDataRepository, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.EntityManager, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
    });

    it('resolving EntityManager does not throw', () => {
        // Arrange: Register dependencies (done in beforeEach) and then the infrastructure services
        registerInfrastructure(mockContainer);

        // Act & Assert: Try resolving a key service
        let resolvedService;
        expect(() => {
            // EntityManager depends on several others registered here or mocked
            resolvedService = mockContainer.resolve(tokens.EntityManager);
        }).not.toThrow();

        // Assert: Check if something was actually resolved
        expect(resolvedService).toBeDefined();

        // Assert: Check that the MOCK EntityManager constructor was called via the factory
        expect(EntityManager).toHaveBeenCalled();
    });

    it('resolving GameDataRepository does not throw', () => {
        // Arrange
        registerInfrastructure(mockContainer);
        // Act & Assert
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.GameDataRepository);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        expect(GameDataRepository).toHaveBeenCalled();
    });
});