// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../../core/gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('../../../../core/worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../../../core/initializers/systemInitializer.js').default} SystemInitializer */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerInitializers} from '../../../../core/config/registrations/initializerRegistrations.js'; // Adjust path if needed

import {INITIALIZABLE} from "../../../../core/tags.js";

// --- Dependencies ---
import {tokens} from '../../../../core/tokens.js';

// --- MOCK the Modules (Classes being registered) ---
jest.mock('../../../../core/gameStateInitializer.js');
jest.mock('../../../../core/worldInitializer.js');
jest.mock('../../../../core/initializers/systemInitializer.js');

// --- Import AFTER mocking ---
import GameStateInitializer from '../../../../core/gameStateInitializer.js';
import WorldInitializer from '../../../../core/worldInitializer.js';
import SystemInitializer from '../../../../core/initializers/systemInitializer.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
// Mock other external dependencies required by the factories
const mockEntityManager = {};
const mockGameStateManager = {};
const mockGameDataRepository = {};
const mockvalidatedEventDispatcher = {};


// --- Mock Custom DI Container (Copied from interpreterRegistrations.test.js) ---
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            // Store tags directly on the registration object for simpler retrieval in mock resolveAll
            const registration = {factoryOrValue, options: {...options, tags: options.tags || []}, instance: undefined};
            registrations.set(token, registration);

            if (options?.lifecycle === 'singleton') {
                if (typeof factoryOrValue === 'function' && registration.instance === undefined) {
                    try {
                        const factory = factoryOrValue;
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

            if (typeof factoryOrValue === 'function') {
                try {
                    return factoryOrValue(container);
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    throw e;
                }
            }
            return factoryOrValue;
        }),
        resolveAll: jest.fn((tag) => { // Mock resolveAll that checks tags
            const resolved = [];
            registrations.forEach((reg, token) => {
                // Check if the registration's options have the requested tag
                // Note: The Registrar helper might store tags differently; adjust if needed.
                // This assumes tags are stored in an array under options.tags.
                if (reg.options?.tags?.includes(tag)) {
                    try {
                        // Resolve the token using the container's resolve method
                        resolved.push(container.resolve(token));
                    } catch (e) {
                        console.warn(`Mock resolveAll: Failed to resolve tagged token ${String(token)}: ${e.message}`);
                        // Decide whether to skip or re-throw based on test needs
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
        jest.clearAllMocks(); // Clear mocks defined via jest.mock

        mockContainer = createMockContainer();

        // Pre-register MOCKED core/external dependencies required by initializer factories
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameStateManager, mockGameStateManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});

        // Clear call counts on the mock service functions/constructors
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        GameStateInitializer.mockClear();
        WorldInitializer.mockClear();
        SystemInitializer.mockClear();
    });

    it('should register initializer services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerInitializers(mockContainer);
        }).not.toThrow();

        // Assert: Check if main services were registered
        // Check for the tags as well for the tagged registrations
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.GameStateInitializer,
            expect.any(Function),
            expect.objectContaining({tags: expect.arrayContaining([INITIALIZABLE[0]])}) // Check tag
        );
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.WorldInitializer,
            expect.any(Function),
            expect.objectContaining({tags: expect.arrayContaining([INITIALIZABLE[0]])}) // Check tag
        );
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.SystemInitializer,
            expect.any(Function),
            expect.anything() // Not tagged explicitly in the test check
        );
    });

    it('resolving GameStateInitializer does not throw', () => {
        // Arrange: Register dependencies and then the initializers
        registerInitializers(mockContainer);

        // Act & Assert: Try resolving a key service
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.GameStateInitializer);
        }).not.toThrow();

        // Assert: Check if something was actually resolved
        expect(resolvedService).toBeDefined();

        // Assert: Check that the MOCK GameStateInitializer constructor was called
        expect(GameStateInitializer).toHaveBeenCalled();
    });

    it('resolving WorldInitializer does not throw', () => {
        // Arrange
        registerInitializers(mockContainer);
        // Act & Assert
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.WorldInitializer);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        expect(WorldInitializer).toHaveBeenCalled();
    });

    it('resolving SystemInitializer does not throw', () => {
        // Arrange
        registerInitializers(mockContainer);
        // Act & Assert
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.SystemInitializer);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        expect(SystemInitializer).toHaveBeenCalled();
    });
});