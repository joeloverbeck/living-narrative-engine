// src/tests/core/config/registrations/initializerRegistrations.test.js
// ****** MODIFIED FILE ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../src/context/worldContext.js').default} WorldContext */
/** @typedef {import('../../../../src/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../../src/initializers/worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../../../src/initializers/systemInitializer.js').default} SystemInitializer */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerInitializers} from '../../../../src/config/registrations/initializerRegistrations.js';

// --- Dependencies ---
import {tokens} from '../../../../src/config/tokens.js';
import {INITIALIZABLE} from "../../../../src/config/tags.js";

// --- MOCK the Modules (Classes being registered) ---
jest.mock('../../../../src/initializers/worldInitializer.js');
jest.mock('../../../../src/initializers/systemInitializer.js');

// --- Import AFTER mocking ---
import WorldInitializer from '../../../../src/initializers/worldInitializer.js';
import SystemInitializer from '../../../../src/initializers/systemInitializer.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEntityManager = { name: 'MockEntityManager' }; // Add a property to distinguish mock
const mockWorldContext = { name: 'MockWorldContext' };
const mockGameDataRepository = { name: 'MockGameDataRepository' };
const mockvalidatedEventDispatcher = { name: 'MockValidatedEventDispatcher' };


const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            const registration = {factoryOrValue, options: {...options, tags: options.tags || []}, instance: undefined};
            registrations.set(token, registration);
        }),
        resolve: jest.fn((token) => {
            const registrationKey = String(token); // Ensure token is string for Map key
            const registration = registrations.get(registrationKey);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                throw new Error(`Mock Resolve Error: Token not registered: ${registrationKey}. Registered tokens are: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;

            // For singletonFactory, always execute factory if instance not set
            if (options?.lifecycle === 'singletonFactory') {
                if (registration.instance !== undefined) {
                    return registration.instance;
                }
                if (typeof factoryOrValue === 'function') {
                    try {
                        registration.instance = factoryOrValue(container); // Pass container to factory
                    } catch (e) {
                        console.error(`Mock container: Error executing factory for ${registrationKey}: ${e.message}`);
                        throw e;
                    }
                    return registration.instance;
                }
                // This case should not happen for singletonFactory if factoryOrValue is not a function
                registration.instance = factoryOrValue;
                return registration.instance;
            }


            if (options?.lifecycle === 'singleton') {
                if (registration.instance !== undefined) {
                    return registration.instance;
                }
                if (typeof factoryOrValue === 'function' && !(factoryOrValue.prototype instanceof Object)) { // crude check for factory vs class
                    try {
                        registration.instance = factoryOrValue(container);
                    } catch (e) {
                        console.error(`Mock container: Error executing factory for ${registrationKey}: ${e.message}`);
                        throw e;
                    }
                } else {
                    // For direct value or class constructor to be new-ed up elsewhere or if it's a pre-created instance
                    registration.instance = factoryOrValue;
                }
                return registration.instance;
            }

            // Transient resolution
            if (typeof factoryOrValue === 'function' && !(factoryOrValue.prototype instanceof Object)) { // crude check for factory vs class
                try {
                    return factoryOrValue(container);
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory for ${registrationKey}: ${e.message}`);
                    throw e;
                }
            }
            return factoryOrValue;
        }),
        resolveByTag: jest.fn(async (tag) => {
            const resolved = [];
            registrations.forEach((reg, token) => {
                if (reg.options?.tags?.includes(tag)) {
                    try {
                        resolved.push(container.resolve(token));
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
        // Register these with the INTERFACE tokens if that's how they are expected to be resolved by the factories
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        // VVVVVV MODIFIED LINES VVVVVV
        mockContainer.register(tokens.IEntityManager, mockEntityManager, {lifecycle: 'singleton'}); // Use interface token
        mockContainer.register(tokens.IWorldContext, mockWorldContext, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IGameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'}); // Use interface token
        // ^^^^^^ MODIFIED LINES ^^^^^^
        mockContainer.register(tokens.IValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});

        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        if (WorldInitializer.mockClear) WorldInitializer.mockClear();
        if (SystemInitializer.mockClear) SystemInitializer.mockClear();
    });

    it('should register initializer services without throwing errors', () => {
        expect(() => {
            registerInitializers(mockContainer);
        }).not.toThrow();

        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.WorldInitializer,
            expect.any(Function),
            expect.objectContaining({lifecycle: 'singletonFactory'})
        );
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.SystemInitializer,
            expect.any(Function),
            expect.objectContaining({lifecycle: 'singletonFactory'})
        );
    });

    it('resolving WorldInitializer does not throw and calls its constructor with correctly resolved dependencies', () => {
        registerInitializers(mockContainer);
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.WorldInitializer);
        }).not.toThrow();

        expect(resolvedService).toBeDefined();
        expect(WorldInitializer).toHaveBeenCalledTimes(1);
        // Assert that the factory resolved dependencies using INTERFACE tokens (mocked above)
        // and passed these resolved mocks to the WorldInitializer constructor.
        expect(WorldInitializer).toHaveBeenCalledWith({
            entityManager: mockEntityManager, // This is the object registered with tokens.IEntityManager
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository, // This is the object registered with tokens.IGameDataRepository
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            logger: mockLogger
        });
    });

    it('resolving SystemInitializer does not throw and calls its constructor with correctly resolved dependencies', () => {
        registerInitializers(mockContainer);
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.SystemInitializer);
        }).not.toThrow();

        expect(resolvedService).toBeDefined();
        expect(SystemInitializer).toHaveBeenCalledTimes(1);
        expect(SystemInitializer).toHaveBeenCalledWith({
            resolver: mockContainer,
            logger: mockLogger,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            initializationTag: INITIALIZABLE[0]
        });
    });

    // New test to specifically check that WorldInitializer's factory attempts to resolve IEntityManager
    it("WorldInitializer factory should attempt to resolve IEntityManager and IGameDataRepository", () => {
        registerInitializers(mockContainer);

        // Spy on the mock container's resolve specifically for this test
        const resolveSpy = jest.spyOn(mockContainer, 'resolve');

        // Resolve WorldInitializer, which will trigger its factory
        mockContainer.resolve(tokens.WorldInitializer);

        // Check if the factory called c.resolve() with the correct interface tokens
        expect(resolveSpy).toHaveBeenCalledWith(tokens.IEntityManager);
        expect(resolveSpy).toHaveBeenCalledWith(tokens.IGameDataRepository);
        // Optionally, ensure it's not called with the concrete tokens if that was the error source
        expect(resolveSpy).not.toHaveBeenCalledWith(tokens.EntityManager);
        expect(resolveSpy).not.toHaveBeenCalledWith(tokens.GameDataRepository);


        resolveSpy.mockRestore(); // Clean up spy
    });
});