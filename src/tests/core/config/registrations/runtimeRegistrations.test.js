// ****** CORRECTED FILE ******
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
/** @typedef {import('../../../../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
// <<< ADDED Import for the missing dependency type >>>
/** @typedef {import('../../../../core/interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */
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
// jest.mock('../../../../core/turnManager.js'); // Keep commented unless strictly needed

// --- Import AFTER mocking ---
import GameLoop from '../../../../core/gameLoop.js';
import InputSetupService from '../../../../core/setup/inputSetupService.js';
// import TurnManager from '../../../../core/turnManager.js'; // Keep commented

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockGameStateManager = {getCurrentLocation: jest.fn(), getPlayer: jest.fn()}; // Add methods GameLoop needs
const mockInputHandler = {enable: jest.fn(), disable: jest.fn(), setCommandCallback: jest.fn()};
const mockCommandParser = {parse: jest.fn()};
const mockActionExecutor = {executeAction: jest.fn()};
const mockEventBus = {dispatch: jest.fn(), subscribe: jest.fn()};
const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(entityId => undefined),
};
const mockGameDataRepository = {};
const mockActionDiscoverySystem = {getValidActions: jest.fn()};
const mockvalidatedEventDispatcher = {dispatchValidated: jest.fn()};

const createMockTurnManager = () => ({
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn(),
    advanceTurn: jest.fn(),
});

const createMockTurnOrderService = () => ({
    setStrategy: jest.fn(),
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    getNext: jest.fn(),
    isEmpty: jest.fn(() => true),
    startNewRound: jest.fn(),
    clearCurrentRound: jest.fn(),
});

// <<< ADDED Mock for the MISSING TurnHandlerResolver dependency >>>
const createMockTurnHandlerResolver = () => ({
    resolveHandler: jest.fn(actor => {
        // Basic mock: return a dummy handler object or undefined based on actor type
        // For this test, simply having the function exist and be callable is often enough.
        // If GameLoop's logic *depended* on the result, make this more specific.
        console.log(`Mock TurnHandlerResolver: resolveHandler called for actor ${actor?.id}`);
        // Return a generic handler mock if needed
        // return { handleTurn: jest.fn() };
        return undefined; // Or simulate not finding a handler
    }),
});

// This mock instance is less relevant now as the *actual* factory is called in tests.
// const mockTurnManagerForGameLoopMock = createMockTurnManager();
// const mockGameLoopInstance = new GameLoop({ /* ... minimal mocks ... */ });

// --- Mock Custom DI Container ---
const createMockContainer = () => {
    const registrations = new Map();
    const resolvedInstances = new Map();

    const container = {
        _registrations: registrations,
        _resolvedInstances: resolvedInstances,

        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            resolvedInstances.delete(token);
            const registration = {factoryOrValue, options};
            registrations.set(token, registration);
            // console.log(`Mock Container: Registered ${String(token)}`); // Debug logging
        }),

        resolve: jest.fn((token) => {
            // console.log(`Mock Container: Attempting to resolve ${String(token)}`); // Debug logging
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                // console.error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered: [${registeredTokens}]`); // Debug logging
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;

            if (options?.lifecycle === 'singleton') {
                if (resolvedInstances.has(token)) {
                    // console.log(`Mock Container: Returning cached singleton for ${String(token)}`); // Debug logging
                    return resolvedInstances.get(token);
                }
                // console.log(`Mock Container: Creating singleton for ${String(token)}`); // Debug logging
                let instance;
                if (typeof factoryOrValue === 'function') {
                    try {
                        instance = factoryOrValue(container);
                    } catch (e) {
                        console.error(`Mock container: Error executing factory during resolve for ${String(token)}: ${e.message}`);
                        if (e.stack) {
                            console.error(e.stack);
                        }
                        throw e;
                    }
                } else {
                    instance = factoryOrValue;
                }
                resolvedInstances.set(token, instance);
                return instance;
            }

            // Transient or other
            // console.log(`Mock Container: Resolving transient/other for ${String(token)}`); // Debug logging
            if (typeof factoryOrValue === 'function') {
                try {
                    return factoryOrValue(container);
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    if (e.stack) {
                        console.error(e.stack);
                    }
                    throw e;
                }
            }
            return factoryOrValue;
        }),

        resolveAll: jest.fn((tag) => {
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
    /** @type {ITurnOrderService} */
    let mockTurnOrderService;
    // <<< ADDED Variable for the new mock >>>
    /** @type {ITurnHandlerResolver} */
    let mockTurnHandlerResolver;

    beforeEach(() => {
        jest.clearAllMocks();

        mockContainer = createMockContainer();
        mockTurnManager = createMockTurnManager();
        mockTurnOrderService = createMockTurnOrderService();
        // <<< ADDED Instantiate the new mock >>>
        mockTurnHandlerResolver = createMockTurnHandlerResolver();

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
        mockContainer.register(tokens.ITurnOrderService, mockTurnOrderService, {lifecycle: 'singleton'});

        // <<< IMPORTANT FIX: Register the MISSING TurnHandlerResolver mock dependency >>>
        mockContainer.register(tokens.TurnHandlerResolver, mockTurnHandlerResolver, {lifecycle: 'singleton'});

        // Register a mock ITurnManager. registerRuntime will overwrite this with the REAL factory.
        // This is mainly useful if a pre-registered service *itself* needed ITurnManager before registerRuntime runs.
        mockContainer.register(tokens.ITurnManager, mockTurnManager, {lifecycle: 'singleton'});

        // Clear call counts on the mock service functions/constructors
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockTurnManager).forEach(fn => fn.mockClear?.());
        Object.values(mockTurnOrderService).forEach(fn => fn.mockClear?.());
        // <<< ADDED Clear calls for the new mock >>>
        Object.values(mockTurnHandlerResolver).forEach(fn => fn.mockClear?.());
        GameLoop.mockClear(); // Clear calls to the mocked GameLoop constructor
        InputSetupService.mockClear(); // Clear calls to the mocked InputSetupService constructor
        // Clear mocks on other registered services
        mockInputHandler.enable.mockClear();
        mockInputHandler.disable.mockClear();
        mockInputHandler.setCommandCallback.mockClear();
        mockGameStateManager.getCurrentLocation.mockClear();
        mockGameStateManager.getPlayer.mockClear();
        // ... clear others as necessary
    });

    it('should register runtime services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerRuntime(mockContainer);
        }).not.toThrow();

        // Assert: Check if main services were registered using the mock's register function
        // These will overwrite the initial mock registrations if tokens match
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
            // This executes GameLoop factory -> resolves its dependencies (incl. TurnHandlerResolver)
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
            // ITurnManager factory runs, resolves ITurnOrderService (mock), returns TurnManager instance
            turnManager: expect.anything(), // Actual TurnManager instance (since not mocked) or mock if module mocked
            // <<< ADDED Check for the new dependency >>>
            turnHandlerResolver: mockTurnHandlerResolver, // Expect the mock we registered
            logger: mockLogger
        }));

        // Optional: Verify the type of the resolved turnManager if TurnManager class is available
        const constructorArgs = GameLoop.mock.calls[0][0];
        const resolvedTurnManager = constructorArgs.turnManager;
        expect(resolvedTurnManager).toBeDefined();
        // Check for expected methods (assuming TurnManager module isn't jest.mocked)
        expect(resolvedTurnManager.start).toBeDefined();
        expect(resolvedTurnManager.getCurrentActor).toBeDefined();

        // Verify mocks for dependencies resolved *during* factory execution were called
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnOrderService);
        // <<< ADDED Check resolve was called for the new dependency >>>
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.TurnHandlerResolver);
    });

    it('resolving InputSetupService does not throw', () => {
        // Arrange
        registerRuntime(mockContainer); // Registers actual factories

        // Act & Assert
        let resolvedService;
        expect(() => {
            // Resolving InputSetupService -> GameLoop factory -> resolves deps (incl. TurnHandlerResolver)
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
            // GameLoop is resolved internally, its factory runs, returns mock instance
            gameLoop: expect.any(GameLoop) // Check that *an instance* of the (mocked) GameLoop was passed
        }));

        // Verify GameLoop factory ran (and thus its constructor mock was called) exactly once during this test
        expect(GameLoop).toHaveBeenCalledTimes(1);
        // Verify TurnHandlerResolver was resolved during the nested dependency resolution for GameLoop
        // <<< ADDED Check resolve was called for the new dependency >>>
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.TurnHandlerResolver);
    });
});