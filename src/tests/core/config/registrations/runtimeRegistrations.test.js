// src/tests/core/config/registrations/runtimeRegistrations.test.js

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
/** @typedef {import('../../../../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */ // <<< ADDED Import
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
const mockInputHandler = {enable: jest.fn(), disable: jest.fn(), setCommandCallback: jest.fn()}; // Add methods used in GameLoop/InputSetup
const mockCommandParser = {parse: jest.fn()}; // Add methods used in GameLoop
const mockActionExecutor = {executeAction: jest.fn()}; // Add methods used in GameLoop
const mockEventBus = {dispatch: jest.fn(), subscribe: jest.fn()}; // Add methods used in GameLoop
const mockEntityManager = {activeEntities: new Map()}; // Add properties/methods used in GameLoop
const mockGameDataRepository = {};
const mockActionDiscoverySystem = {getValidActions: jest.fn()}; // Add methods used in GameLoop
const mockvalidatedEventDispatcher = {dispatchValidated: jest.fn()}; // Add methods used in GameLoop/InputSetup
// <<< ADDED Mock for ITurnOrderService >>>
const createMockTurnOrderService = () => ({
    isEmpty: jest.fn(),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    clearCurrentRound: jest.fn(), // Add any other methods used by GameLoop
});

// GameLoop itself is registered here, but InputSetupService depends on it.
// We'll register the mocked GameLoop instance so InputSetupService factory can resolve it.
// Note: registerRuntime will overwrite this with the actual factory later in the tests.
const mockGameLoopInstance = new GameLoop({ // Pass minimal mocks to satisfy constructor
    logger: mockLogger,
    inputHandler: mockInputHandler,
    commandParser: mockCommandParser,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
    actionDiscoverySystem: mockActionDiscoverySystem,
    validatedEventDispatcher: mockvalidatedEventDispatcher,
    entityManager: mockEntityManager,
    gameDataRepository: mockGameDataRepository,
    gameStateManager: mockGameStateManager,
    turnOrderService: createMockTurnOrderService() // Provide the mock service here too
});


// --- Mock Custom DI Container (Copied from interpreterRegistrations.test.js) ---
// This mock container implementation seems reasonable for testing registrations.
// No changes needed here based on the error.
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            const registration = {factoryOrValue, options, instance: undefined};
            registrations.set(token, registration);

            // Simplified singleton instantiation during registration (might not always be desired, but often ok for tests)
            // if (options?.lifecycle === 'singleton') {
            //     if (typeof factoryOrValue === 'function' && registration.instance === undefined) {
            //         try {
            //             const factory = factoryOrValue;
            //             // Don't auto-resolve during registration in this mock to better isolate resolve issues
            //             // registration.instance = factory(container);
            //         } catch (e) {
            //             // console.warn(`Mock container: Error executing factory during registration for ${String(token)}: ${e.message}`);
            //             registration.instance = undefined; // Ensure it remains undefined
            //         }
            //     } else if (typeof factoryOrValue !== 'function') {
            //         registration.instance = factoryOrValue;
            //     }
            // }
        }),
        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                // Keep this throw for detecting missing registrations
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;

            if (options?.lifecycle === 'singleton') {
                if (registration.instance !== undefined) {
                    return registration.instance;
                }
                if (typeof factoryOrValue === 'function') {
                    try {
                        // Execute factory ONLY when resolving a singleton for the first time
                        registration.instance = factoryOrValue(container);
                    } catch (e) {
                        // Log the error originating during factory execution
                        console.error(`Mock container: Error executing factory during resolve for ${String(token)}: ${e.message}`);
                        throw e; // Re-throw the original error
                    }

                } else {
                    // If it's a value (not a factory)
                    registration.instance = factoryOrValue;
                }
                return registration.instance;
            }

            // Handle transient or other lifecycles (execute factory every time)
            if (typeof factoryOrValue === 'function') {
                try {
                    return factoryOrValue(container);
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    throw e;
                }
            }
            // Return value directly if not a factory
            return factoryOrValue;
        }),
        resolveAll: jest.fn((tag) => { // Basic mock for resolveAll
            const resolved = [];
            registrations.forEach((reg, token) => {
                // Check if options exist and tags is an array including the tag
                if (reg.options && Array.isArray(reg.options.tags) && reg.options.tags.includes(tag)) {
                    try {
                        resolved.push(container.resolve(token));
                    } catch (e) {
                        // Optionally log resolution errors during resolveAll
                        // console.warn(`Mock resolveAll: Failed to resolve token ${String(token)} with tag ${tag}: ${e.message}`);
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
    /** @type {ITurnOrderService} */ // <<< ADDED Type hint
    let mockTurnOrderService; // <<< ADDED Variable

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks defined via jest.mock

        mockContainer = createMockContainer();
        mockTurnOrderService = createMockTurnOrderService(); // <<< ADDED Create mock instance

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
        // <<< ADDED Register the missing dependency >>>
        mockContainer.register(tokens.ITurnOrderService, mockTurnOrderService, {lifecycle: 'singleton'});
        // Pre-register the mocked GameLoop instance needed by InputSetupService factory *IF* it were resolved standalone.
        // registerRuntime will overwrite this registration anyway.
        // mockContainer.register(tokens.GameLoop, mockGameLoopInstance, {lifecycle: 'singleton'}); // This might be redundant or potentially confusing, consider removing


        // Clear call counts on the mock service functions/constructors
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockTurnOrderService).forEach(fn => fn.mockClear?.()); // <<< ADDED Clear mock calls
        GameLoop.mockClear();
        InputSetupService.mockClear();
        // Clear mocks on other registered services if needed
        mockInputHandler.enable.mockClear();
        mockInputHandler.disable.mockClear();
        mockInputHandler.setCommandCallback.mockClear();
        // ... clear others as necessary
    });

    it('should register runtime services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerRuntime(mockContainer);
        }).not.toThrow();

        // Assert: Check if main services were registered using the mock's register function
        // Check that register was called with the correct token and a factory function.
        // We don't need to check the exact factory function content here, just that it's a function.
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.GameLoop, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.InputSetupService, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
    });

    it('resolving GameLoop does not throw', () => {
        // Arrange: Register dependencies and then the runtime services
        registerRuntime(mockContainer); // This registers the *actual* factories

        // Act & Assert: Try resolving the key service using the mock container
        let resolvedService;
        expect(() => {
            // This will now execute the factory registered by registerRuntime
            resolvedService = mockContainer.resolve(tokens.GameLoop);
        }).not.toThrow();

        // Assert: Check if something was actually resolved (i.e., the factory executed)
        expect(resolvedService).toBeDefined();
        // Because GameLoop itself is mocked via jest.mock, the factory will return
        // an instance of the *mocked* GameLoop.
        expect(resolvedService).toBeInstanceOf(GameLoop);

        // Assert: Check that the MOCK GameLoop constructor was called via the factory
        expect(GameLoop).toHaveBeenCalledTimes(1); // Should be called once when resolved
        // Check if the factory correctly resolved dependencies and passed them
        expect(GameLoop).toHaveBeenCalledWith(expect.objectContaining({
            gameStateManager: mockGameStateManager,
            inputHandler: mockInputHandler,
            commandParser: mockCommandParser,
            actionExecutor: mockActionExecutor,
            eventBus: mockEventBus,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            actionDiscoverySystem: mockActionDiscoverySystem,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            turnOrderService: mockTurnOrderService, // <<< Check if the mock was passed
            logger: mockLogger
        }));
    });

    it('resolving InputSetupService does not throw', () => {
        // Arrange
        registerRuntime(mockContainer); // Registers actual factories

        // Act & Assert
        let resolvedService;
        expect(() => {
            // Resolving InputSetupService will trigger resolution of its GameLoop dependency,
            // which in turn executes the GameLoop factory (which should now succeed)
            resolvedService = mockContainer.resolve(tokens.InputSetupService);
        }).not.toThrow();

        // Assert: Check if resolved and constructor called
        expect(resolvedService).toBeDefined();
        expect(resolvedService).toBeInstanceOf(InputSetupService); // It resolves to the mock instance
        expect(InputSetupService).toHaveBeenCalledTimes(1);

        // Assert: Check dependencies passed to InputSetupService constructor
        // Note: GameLoop resolved *within* this factory will be the mocked GameLoop instance
        // because the GameLoop token resolves to the result of its own factory execution (which uses the jest.mocked constructor)
        expect(InputSetupService).toHaveBeenCalledWith(expect.objectContaining({
            container: mockContainer, // The factory passes the container itself
            logger: mockLogger,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            gameLoop: expect.any(GameLoop) // Check that *an instance* of the (mocked) GameLoop was passed
        }));

        // Optional: Verify the GameLoop dependency was resolved exactly once during this test
        // (once for InputSetupService's dependency resolution)
        expect(GameLoop).toHaveBeenCalledTimes(1); // Reset in beforeEach ensures this count is per-test
    });
});