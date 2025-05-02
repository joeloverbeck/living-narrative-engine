// src/tests/core/config/registrations/initializerRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../core/worldContext.js').default} WorldContext */ // Corrected typedef name if GameStateManager was a typo
/** @typedef {import('../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// REMOVED: GameStateInitializer typedef
/** @typedef {import('../../../../core/initializers/worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../../../core/initializers/systemInitializer.js').default} SystemInitializer */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerInitializers} from '../../../../core/config/registrations/initializerRegistrations.js'; // Adjust path if needed

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';
import {INITIALIZABLE} from "../../../../core/config/tags.js"; // Import needed for SystemInitializer test

// --- MOCK the Modules (Classes being registered) ---
// REMOVED: GameStateInitializer mock
jest.mock('../../../../core/initializers/worldInitializer.js');
jest.mock('../../../../core/initializers/systemInitializer.js');

// --- Import AFTER mocking ---
// REMOVED: GameStateInitializer import
import WorldInitializer from '../../../../core/initializers/worldInitializer.js';
import SystemInitializer from '../../../../core/initializers/systemInitializer.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
// Mock other external dependencies required by the factories
const mockEntityManager = {};
const mockWorldContext = {}; // Use corrected name if applicable
const mockGameDataRepository = {};
const mockvalidatedEventDispatcher = {};


// --- Mock Custom DI Container ---
// (createMockContainer function remains the same as provided)
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => { // Keep options here for the mock's internal use
            if (!token) throw new Error('Mock Register Error: Token is required.');
            // Store tags and other options directly on the registration object
            const registration = {factoryOrValue, options: {...options, tags: options.tags || []}, instance: undefined};
            registrations.set(token, registration);

            // Simplified singleton instantiation for mock - real logic might differ
            if (options?.lifecycle === 'singleton') {
                // Avoid immediate instantiation in mock register unless necessary for specific tests
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
                        // Instantiate singleton on first resolve
                        registration.instance = factoryOrValue(container);
                    } catch (e) {
                        console.error(`Mock container: Error executing factory during resolve for ${String(token)}: ${e.message}`);
                        throw e; // Re-throw resolve errors
                    }
                } else {
                    // Handle non-factory singletons
                    registration.instance = factoryOrValue;
                }
                return registration.instance;
            }

            // Transient resolution
            if (typeof factoryOrValue === 'function') {
                try {
                    return factoryOrValue(container);
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    throw e; // Re-throw resolve errors
                }
            }
            // Handle non-factory transients
            return factoryOrValue;
        }),
        // Mock resolveByTag needed for SystemInitializer resolution
        resolveByTag: jest.fn(async (tag) => {
            const resolved = [];
            registrations.forEach((reg, token) => {
                // Check the tags stored during registration
                if (reg.options?.tags?.includes(tag)) {
                    try {
                        resolved.push(container.resolve(token)); // Use mock resolve
                    } catch (e) {
                        console.warn(`Mock resolveByTag: Failed to resolve tagged token ${String(token)}: ${e.message}`);
                    }
                }
            });
            return resolved;
        })
    };
    return container;
};


describe('registerInitializers', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks();

        mockContainer = createMockContainer();

        // Pre-register MOCKED core/external dependencies required by initializer factories
        // These calls to register DO include the options object
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IWorldContext, mockWorldContext, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});

        // Clear call counts ONLY for the mocked CLASS constructors/methods, not the container itself yet
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        WorldInitializer.mockClear();
        SystemInitializer.mockClear();
    });

    it('should register initializer services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerInitializers(mockContainer);
        }).not.toThrow();

        // Assert: Check if main services were registered via the container's register method.
        // The Registrar helper calls container.register internally.
        // We check the arguments received by the mock container.register.

        // ----- VVVVVV START OF CORRECTION VVVVVV -----
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.WorldInitializer,
            expect.any(Function), // It's registered via a factory provided to the Registrar
            // Assert the third argument (options) IS passed by the Registrar helper
            expect.objectContaining({lifecycle: 'singletonFactory'})
        );
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.SystemInitializer,
            expect.any(Function), // It's registered via a factory provided to the Registrar
            // Assert the third argument (options) IS passed by the Registrar helper
            expect.objectContaining({lifecycle: 'singletonFactory'})
        );
        // ----- ^^^^^^ END OF CORRECTION ^^^^^^ -----
    });

    it('resolving WorldInitializer does not throw and calls constructor', () => {
        // Arrange
        registerInitializers(mockContainer); // Register the services
        // Act & Assert
        let resolvedService;
        expect(() => {
            // Resolve simulates the container creating the instance via the factory
            resolvedService = mockContainer.resolve(tokens.WorldInitializer);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        // Verify the factory called the mock constructor (happens during resolve for singletons in this mock setup)
        expect(WorldInitializer).toHaveBeenCalledTimes(1);
        expect(WorldInitializer).toHaveBeenCalledWith({ // Verify correct dependencies were resolved by the factory
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            logger: mockLogger
        });
    });

    it('resolving SystemInitializer does not throw and calls constructor', () => {
        // Arrange
        registerInitializers(mockContainer); // Register the services
        // Act & Assert
        let resolvedService;
        expect(() => {
            // Resolve simulates the container creating the instance via the factory
            resolvedService = mockContainer.resolve(tokens.SystemInitializer);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        // Verify the factory called the mock constructor (happens during resolve for singletons in this mock setup)
        expect(SystemInitializer).toHaveBeenCalledTimes(1);
        expect(SystemInitializer).toHaveBeenCalledWith({ // Verify correct dependencies were resolved by the factory
            resolver: mockContainer, // The factory passes the container itself
            logger: mockLogger,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            initializationTag: INITIALIZABLE[0]
        });
    });
});