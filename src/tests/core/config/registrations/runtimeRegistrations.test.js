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
/** @typedef {import('../../../../core/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
// <<< ADDED Import for the missing dependency type >>>
/** @typedef {import('../../../../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
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
// <<< ADDED Mock for TurnManager if its constructor is complex or has side effects >>>
// jest.mock('../../../../core/turnManager.js'); // Add this if needed, but maybe not required just to resolve the dependency

// --- Import AFTER mocking ---
import GameLoop from '../../../../core/gameLoop.js';
import InputSetupService from '../../../../core/setup/inputSetupService.js';
// <<< ADDED Import TurnManager AFTER mocking if you mocked it above >>>
// import TurnManager from '../../../../core/turnManager.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockGameStateManager = {};
const mockInputHandler = {enable: jest.fn(), disable: jest.fn(), setCommandCallback: jest.fn()};
const mockCommandParser = {parse: jest.fn()};
const mockActionExecutor = {executeAction: jest.fn()};
const mockEventBus = {dispatch: jest.fn(), subscribe: jest.fn()};
const mockEntityManager = {
    activeEntities: new Map(),
    // Add the method expected by the TurnManager constructor
    getEntityInstance: jest.fn(entityId => {
        // Optional: Provide basic mock behavior if needed later in the turn manager logic
        // For now, just having the function exist is enough to pass the constructor check.
        // console.log(`Mock EntityManager: getEntityInstance called for ${entityId}`);
        return undefined; // Or return a mock entity if needed
    }),
    // Add any other methods TurnManager might *actually call* during its operation if necessary
    // For example:
    // getEntitiesWithComponents: jest.fn(() => []),
    // addComponent: jest.fn(),
    // removeComponent: jest.fn(),
};
const mockGameDataRepository = {};
const mockActionDiscoverySystem = {getValidActions: jest.fn()};
const mockvalidatedEventDispatcher = {dispatchValidated: jest.fn()};

const createMockTurnManager = () => ({
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn(),
    advanceTurn: jest.fn(),
    // Add any other methods expected by consumers (like GameLoop)
});

// <<< ADDED Mock for the missing dependency >>>
const createMockTurnOrderService = () => ({
    // Add mock methods needed by the TurnManager *constructor* or tests, if any.
    // Often, just having the object registered is enough for DI resolution tests.
    setStrategy: jest.fn(),
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    getNext: jest.fn(),
    isEmpty: jest.fn(() => true),
    startNewRound: jest.fn(),
    clearCurrentRound: jest.fn(),
});


// Create a mock TurnManager instance ONLY needed if GameLoop mock requires it
const mockTurnManagerForGameLoopMock = createMockTurnManager();
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
    turnManager: mockTurnManagerForGameLoopMock
});


// --- Mock Custom DI Container ---
// (Your existing createMockContainer implementation seems fine)
const createMockContainer = () => {
    const registrations = new Map();
    const resolvedInstances = new Map(); // Added cache for singleton behavior verification

    const container = {
        _registrations: registrations,
        _resolvedInstances: resolvedInstances, // Expose for testing if needed

        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            // Clear any cached instance if re-registering
            resolvedInstances.delete(token);
            const registration = {factoryOrValue, options};
            registrations.set(token, registration);
        }),

        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                // Keep this throw for detecting missing registrations
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;

            // --- Singleton Logic ---
            if (options?.lifecycle === 'singleton') {
                if (resolvedInstances.has(token)) {
                    return resolvedInstances.get(token);
                }

                let instance;
                if (typeof factoryOrValue === 'function') {
                    try {
                        // Execute factory ONLY when resolving a singleton for the first time
                        instance = factoryOrValue(container); // Pass container to factory
                    } catch (e) {
                        // Log the error originating during factory execution
                        // Use console.error for visibility during tests
                        console.error(`Mock container: Error executing factory during resolve for ${String(token)}: ${e.message}`);
                        // Include stack trace for better debugging if available
                        if (e.stack) {
                            console.error(e.stack);
                        }
                        throw e; // Re-throw the original error to fail the test
                    }
                } else {
                    // If it's a value (not a factory)
                    instance = factoryOrValue;
                }
                resolvedInstances.set(token, instance); // Cache the instance
                return instance;
            }

            // --- Transient or other lifecycles (execute factory every time or return value) ---
            if (typeof factoryOrValue === 'function') {
                try {
                    // Execute factory every time for non-singletons
                    return factoryOrValue(container); // Pass container to factory
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    if (e.stack) {
                        console.error(e.stack);
                    }
                    throw e;
                }
            }

            // Return value directly if not a factory and not singleton (or singleton already handled)
            return factoryOrValue;
        }),

        resolveAll: jest.fn((tag) => { // Basic mock for resolveAll
            const resolved = [];
            registrations.forEach((reg, token) => {
                if (reg.options && Array.isArray(reg.options.tags) && reg.options.tags.includes(tag)) {
                    try {
                        resolved.push(container.resolve(token));
                    } catch (e) {
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
    /** @type {ITurnManager} */
    let mockTurnManager;
    // <<< ADDED Variable for the new mock >>>
    /** @type {ITurnOrderService} */
    let mockTurnOrderService;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks defined via jest.mock

        mockContainer = createMockContainer();
        mockTurnManager = createMockTurnManager();
        // <<< ADDED Instantiate the new mock >>>
        mockTurnOrderService = createMockTurnOrderService();

        // Pre-register MOCKED core/external dependencies required by runtime factories
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IGameStateManager, mockGameStateManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IInputHandler, mockInputHandler, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ICommandParser, mockCommandParser, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IActionExecutor, mockActionExecutor, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IActionDiscoverySystem, mockActionDiscoverySystem, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});

        // <<< IMPORTANT FIX: Register the MISSING mock dependency >>>
        mockContainer.register(tokens.ITurnOrderService, mockTurnOrderService, {lifecycle: 'singleton'});

        // Register the mock TurnManager. registerRuntime will register the *real* factory
        // for ITurnManager later, which is fine. This mock might still be needed
        // if other *pre-registered* mocks depend directly on ITurnManager resolving
        // *before* registerRuntime is called (unlikely in this setup, but safe to keep).
        mockContainer.register(tokens.ITurnManager, mockTurnManager, {lifecycle: 'singleton'});

        // Pre-registering the mocked GameLoop instance is less useful now.
        // The tests rely on resolving GameLoop *after* registerRuntime,
        // which means the *actual* factory registered by registerRuntime will be used.
        // Commenting this out as it might cause confusion.
        // mockContainer.register(tokens.GameLoop, mockGameLoopInstance, {lifecycle: 'singleton'});

        // Clear call counts on the mock service functions/constructors
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockTurnManager).forEach(fn => fn.mockClear?.());
        // <<< ADDED Clear calls for the new mock >>>
        Object.values(mockTurnOrderService).forEach(fn => fn.mockClear?.());
        GameLoop.mockClear();
        InputSetupService.mockClear();
        // Clear mocks on other registered services
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
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ITurnManager, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.GameLoop, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.InputSetupService, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
    });

    it('resolving GameLoop does not throw', () => {
        // Arrange: Register dependencies and then the runtime services
        registerRuntime(mockContainer); // Registers the *actual* factories

        // Act & Assert: Try resolving the key service using the mock container
        let resolvedService;
        expect(() => {
            // This executes GameLoop factory -> ITurnManager factory -> resolves ITurnOrderService (now mocked)
            resolvedService = mockContainer.resolve(tokens.GameLoop);
        }).not.toThrow(); // <<< This should now pass

        // Assert: Check if resolved and basic properties
        expect(resolvedService).toBeDefined();
        // Because GameLoop itself is mocked via jest.mock, the factory resolves dependencies,
        // calls the constructor, and jest returns the mocked instance.
        expect(resolvedService).toBeInstanceOf(GameLoop);

        // Assert: Check that the MOCK GameLoop constructor was called via the factory
        expect(GameLoop).toHaveBeenCalledTimes(1);
        // Check dependencies passed to GameLoop constructor
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
            // It resolves ITurnManager, which executes its factory, which resolves the *mock* ITurnOrderService
            // The ITurnManager factory then returns a TurnManager instance (or its mock if jest.mocked)
            // which is then passed here. We expect *an* object here.
            // If TurnManager itself is NOT jest.mocked, this will be a real TurnManager instance.
            // If TurnManager IS jest.mocked, this will be the mocked TurnManager instance.
            // Since we didn't explicitly mock TurnManager module, let's expect any object for now.
            turnManager: expect.anything(), // More specific check below
            logger: mockLogger
        }));

        // Optional: Verify the type of the resolved turnManager if TurnManager class is available
        const resolvedTurnManager = GameLoop.mock.calls[0][0].turnManager;
        expect(resolvedTurnManager).toBeDefined();
        // If you added `jest.mock('../../../../core/turnManager.js');`
        // expect(resolvedTurnManager).toBeInstanceOf(TurnManager); // Check it's the mocked instance
        // If you did NOT mock TurnManager module, you might check for expected methods
        expect(resolvedTurnManager.start).toBeDefined();
        expect(resolvedTurnManager.getCurrentActor).toBeDefined();

        // Optional: Check if the ITurnOrderService mock was resolved *during* ITurnManager factory execution
        // This relies on the mockContainer's resolve mock tracking calls
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnOrderService);

    });

    it('resolving InputSetupService does not throw', () => {
        // Arrange
        registerRuntime(mockContainer); // Registers actual factories

        // Act & Assert
        let resolvedService;
        expect(() => {
            // Resolving InputSetupService -> GameLoop factory -> ITurnManager factory -> resolves ITurnOrderService (mocked)
            resolvedService = mockContainer.resolve(tokens.InputSetupService);
        }).not.toThrow(); // <<< This should now pass

        // Assert: Check if resolved and constructor called
        expect(resolvedService).toBeDefined();
        expect(resolvedService).toBeInstanceOf(InputSetupService); // It resolves to the mock instance
        expect(InputSetupService).toHaveBeenCalledTimes(1);

        // Assert: Check dependencies passed to InputSetupService constructor
        expect(InputSetupService).toHaveBeenCalledWith(expect.objectContaining({
            container: mockContainer,
            logger: mockLogger,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            // GameLoop is resolved internally, which itself resolves ITurnManager -> ITurnOrderService
            gameLoop: expect.any(GameLoop) // Check that *an instance* of the (mocked) GameLoop was passed
        }));

        // Optional: Verify GameLoop dependency was resolved exactly once during this test
        expect(GameLoop).toHaveBeenCalledTimes(1);
        // Optional: Verify ITurnOrderService was resolved during the nested dependency resolution
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnOrderService);
    });
});