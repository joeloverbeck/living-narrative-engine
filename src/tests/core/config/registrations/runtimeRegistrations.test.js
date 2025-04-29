// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../../../../core/interfaces/input.js').IInputHandler} IInputHandler */ // Assuming token maps to an interface/type
/** @typedef {import('../../../../core/commandParser.js').default} CommandParser */
/** @typedef {import('../../../../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../systems/actionDiscoverySystem.js').default} ActionDiscoverySystem */ // Assuming type
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../../../core/setup/inputSetupService.js').default} InputSetupService */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerRuntime} from '../../../../core/config/registrations/runtimeRegistrations.js'; // Adjust path if needed

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';

// --- MOCK the Modules (Classes being registered) ---
jest.mock('../../../../core/gameLoop.js');
jest.mock('../../../../core/setup/inputSetupService.js');

// --- Import AFTER mocking ---
import GameLoop from '../../../../core/gameLoop.js';
import InputSetupService from '../../../../core/setup/inputSetupService.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
// Mock the numerous dependencies required by the GameLoop and InputSetupService factories
const mockGameStateManager = {};
const mockInputHandler = {};
const mockCommandParser = {};
const mockActionExecutor = {};
const mockEventBus = {};
const mockEntityManager = {};
const mockGameDataRepository = {};
const mockActionDiscoverySystem = {};
const mockvalidatedEventDispatcher = {};
// GameLoop itself is registered here, but InputSetupService depends on it.
// We'll register the mocked GameLoop instance so InputSetupService factory can resolve it.
const mockGameLoopInstance = new GameLoop();

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


describe('registerRuntime', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks defined via jest.mock

        mockContainer = createMockContainer();

        // Pre-register MOCKED core/external dependencies required by runtime factories
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameStateManager, mockGameStateManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.InputHandler, mockInputHandler, {lifecycle: 'singleton'});
        mockContainer.register(tokens.CommandParser, mockCommandParser, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ActionExecutor, mockActionExecutor, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ActionDiscoverySystem, mockActionDiscoverySystem, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});
        // Pre-register the mocked GameLoop instance needed by InputSetupService factory
        mockContainer.register(tokens.GameLoop, mockGameLoopInstance, {lifecycle: 'singleton'});


        // Clear call counts on the mock service functions/constructors
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        GameLoop.mockClear();
        InputSetupService.mockClear();
    });

    it('should register runtime services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            // Note: registerRuntime will re-register GameLoop over the mock instance pre-registered above.
            // The mock container's register logic should handle this overwrite.
            registerRuntime(mockContainer);
        }).not.toThrow();

        // Assert: Check if main services were registered
        // Use expect.anything() for options as Registrar helper might add/modify them.
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.GameLoop, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.InputSetupService, expect.any(Function), expect.anything());
    });

    it('resolving GameLoop does not throw', () => {
        // Arrange: Register dependencies and then the runtime services
        registerRuntime(mockContainer);

        // Act & Assert: Try resolving the key service
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.GameLoop);
        }).not.toThrow();

        // Assert: Check if something was actually resolved
        expect(resolvedService).toBeDefined();

        // Assert: Check that the MOCK GameLoop constructor was called via the factory
        // It might be called once during the InputSetupService pre-registration and once here,
        // depending on the mock container's exact behavior. Check it was called at least once.
        expect(GameLoop).toHaveBeenCalled();
    });

    it('resolving InputSetupService does not throw', () => {
        // Arrange
        registerRuntime(mockContainer);
        // Act & Assert
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.InputSetupService);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        expect(InputSetupService).toHaveBeenCalled();
    });
});