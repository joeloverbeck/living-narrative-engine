// ****** REVISED CORRECTED FILE V4 ******
// src/tests/core/config/registrations/runtimeRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../../../../core/interfaces/input.js').IInputHandler} IInputHandler */
/** @typedef {import('../../../../core/commandParser.js').default} CommandParser */
/** @typedef {import('../../../../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../systems/actionDiscoverySystem.js').ActionDiscoverySystem} ActionDiscoverySystem */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../../../core/setup/inputSetupService.js').default} InputSetupService */
// --- MODIFIED: Typedef uses real class name now ---
/** @typedef {import('../../../../core/turnManager.js').default} TurnManager */
/** @typedef {import('../../../../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../../../core/services/turnHandlerResolver.js').default} TurnHandlerResolver */
/** @typedef {import('../../../../core/handlers/playerTurnHandler.js').default} PlayerTurnHandler */
/** @typedef {import('../../../../core/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerRuntime} from '../../../../core/config/registrations/runtimeRegistrations.js';
import {registerCoreSystems} from '../../../../core/config/registrations/coreSystemsRegistrations.js';

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';
// Import real classes needed for instanceof checks where not mocked
import {ActionDiscoverySystem} from '../../../../systems/actionDiscoverySystem.js';
import TurnHandlerResolver from '../../../../core/services/turnHandlerResolver.js';

// --- MOCK the Modules (Classes being registered/depended upon) ---
jest.mock('../../../../core/gameLoop.js');
jest.mock('../../../../core/setup/inputSetupService.js');
// <<< ADDED: Mock TurnManager similar to GameLoop >>>
jest.mock('../../../../core/turnManager.js');
jest.mock('../../../../core/handlers/playerTurnHandler.js');
// jest.mock('../../../../systems/actionDiscoverySystem.js'); // DO NOT MOCK
// jest.mock('../../../../core/services/turnHandlerResolver.js'); // DO NOT MOCK

// --- Import AFTER mocking ---
import GameLoop from '../../../../core/gameLoop.js';
import InputSetupService from '../../../../core/setup/inputSetupService.js';
// <<< ADDED: Import mocked TurnManager >>>
import TurnManager from '../../../../core/turnManager.js';
import PlayerTurnHandler from '../../../../core/handlers/playerTurnHandler.js';

// --- Mock Implementations (Core & External Dependencies) ---
// Simple object mocks for dependencies NOT registered by coreSystems/runtime
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockGameStateManager = {getCurrentLocation: jest.fn(), getPlayer: jest.fn()};
const mockInputHandler = {enable: jest.fn(), disable: jest.fn(), setCommandCallback: jest.fn()};
const mockCommandParser = {parse: jest.fn()};
const mockActionExecutor = {executeAction: jest.fn()};
const mockEventBus = {dispatch: jest.fn(), subscribe: jest.fn()};
const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(entityId => undefined),
};
const mockGameDataRepository = {};
const mockActionDiscoverySystemObject = {getValidActions: jest.fn()}; // Overwritten in test
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn()};

// Factory for mock TurnOrderService (dependency of TurnManager factory)
const createMockTurnOrderService = () => ({
    setStrategy: jest.fn(), addEntity: jest.fn(), removeEntity: jest.fn(), getNext: jest.fn(),
    isEmpty: jest.fn(() => true), startNewRound: jest.fn(), clearCurrentRound: jest.fn(),
});

// Mock object for TurnHandlerResolver (overwritten in test)
const createMockTurnHandlerResolverObject = () => ({
    resolveHandler: jest.fn(actor => undefined),
});

// Use the jest-mocked PlayerTurnHandler constructor
const mockPlayerTurnHandlerInstance = new PlayerTurnHandler({ /* Mocks */});
// Simple object mock for CommandProcessor (dependency of PlayerTurnHandler factory)
const mockCommandProcessor = {processCommand: jest.fn()};
// Simple object mock for ActionValidationService (dependency of ActionDiscoverySystem factory)
const mockActionValidationService = {validateAction: jest.fn()};
// Other potential mocks needed by system constructors registered in coreSystems
const mockConditionEvaluationService = {evaluateCondition: jest.fn()};
const mockItemTargetResolverService = {resolveTarget: jest.fn()};


// --- Mock Custom DI Container ---
// (createMockContainer function remains the same)
const createMockContainer = () => {
    const registrations = new Map();
    const resolvedInstances = new Map();

    const container = {
        _registrations: registrations,
        _resolvedInstances: resolvedInstances,

        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            resolvedInstances.delete(token); // Invalidate cache on re-register
            const registration = {factoryOrValue, options};
            registrations.set(token, registration);
            // console.log(`Mock Container: Registered ${String(token)} with options ${JSON.stringify(options)}`);
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

            if (options?.lifecycle === 'singleton' || options?.lifecycle === 'singletonFactory') { // Handle both common singleton patterns
                if (resolvedInstances.has(token)) {
                    // console.log(`Mock Container: Returning cached singleton for ${String(token)}`); // Debug logging
                    return resolvedInstances.get(token);
                }
                // console.log(`Mock Container: Creating singleton for ${String(token)}`); // Debug logging
                let instance;
                if (typeof factoryOrValue === 'function' && registration.factoryOrValue.length > 0) { // Check if it's likely a factory function expecting the container
                    try {
                        instance = factoryOrValue(container); // Assume it's a factory c => new Service(c.resolve(...))
                    } catch (e) {
                        console.error(`Mock container: Error executing factory during resolve for ${String(token)}: ${e.message}`);
                        if (e.stack) {
                            console.error(e.stack);
                        }
                        throw e; // Re-throw original error for Jest
                    }
                } else if (typeof factoryOrValue === 'function') {
                    // Could be a class constructor or a factory that doesn't need the container
                    try {
                        // Check if it looks like a class constructor
                        if (factoryOrValue.prototype && factoryOrValue.prototype.constructor === factoryOrValue) {
                            // If the class itself IS mocked by jest.mock, calling new() returns the mock constructor's return value
                            // If the class is NOT mocked, this calls the real constructor
                            instance = new factoryOrValue();
                        } else {
                            instance = factoryOrValue(); // Try calling as a zero-arg factory
                        }
                    } catch (e) {
                        // Fallback: maybe it *was* expecting the container despite zero args declared
                        try {
                            instance = factoryOrValue(container);
                        } catch (finalE) {
                            console.error(`Mock container: Error executing factory/constructor during resolve for ${String(token)} (tried multiple ways): ${finalE.message}`);
                            if (finalE.stack) {
                                console.error(finalE.stack);
                            }
                            throw finalE; // Re-throw final error
                        }
                    }
                } else {
                    instance = factoryOrValue; // It's a pre-created instance/value
                }
                // console.log(`Mock Container: Caching and returning for ${String(token)}:`, instance); // Added log
                resolvedInstances.set(token, instance);
                return instance;
            }

            // Transient or other lifecycles
            if (typeof factoryOrValue === 'function' && registration.factoryOrValue.length > 0) {
                try {
                    const transientInstance = factoryOrValue(container);
                    // console.log(`Mock Container: Returning transient instance for ${String(token)}:`, transientInstance); // Added log
                    return transientInstance;
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    if (e.stack) {
                        console.error(e.stack);
                    }
                    throw e;
                }
            } else if (typeof factoryOrValue === 'function') {
                try {
                    if (factoryOrValue.prototype && factoryOrValue.prototype.constructor === factoryOrValue) {
                        const transientInstance = new factoryOrValue();
                        // console.log(`Mock Container: Returning transient instance for ${String(token)}:`, transientInstance); // Added log
                        return transientInstance;
                    } else {
                        const transientInstance = factoryOrValue();
                        // console.log(`Mock Container: Returning transient instance for ${String(token)}:`, transientInstance); // Added log
                        return transientInstance;
                    }
                } catch (e) {
                    try {
                        const transientInstance = factoryOrValue(container); // Fallback
                        // console.log(`Mock Container: Returning transient instance for ${String(token)}:`, transientInstance); // Added log
                        return transientInstance;
                    } catch (finalE) {
                        console.error(`Mock container: Error executing transient factory/constructor during resolve for ${String(token)} (tried multiple ways): ${finalE.message}`);
                        if (finalE.stack) {
                            console.error(finalE.stack);
                        }
                        throw finalE;
                    }
                }
            }
            // console.log(`Mock Container: Returning value for ${String(token)}:`, factoryOrValue); // Added log
            return factoryOrValue; // Return value directly
        }),

        resolveAll: jest.fn((tag) => {
            const resolved = [];
            registrations.forEach((reg, token) => {
                if (reg.options && Array.isArray(reg.options.tags) && reg.options.tags.includes(tag)) {
                    try {
                        resolved.push(container.resolve(token));
                    } catch (e) {
                        console.warn(`Mock resolveAll: Failed to resolve token ${String(token)} with tag ${tag}: ${e.message}`);
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
    // Create instances of mock *objects* in beforeEach
    /** @type {ReturnType<typeof createMockTurnOrderService>} */
    let mockTurnOrderService;
    /** @type {ReturnType<typeof createMockTurnHandlerResolverObject>} */
    let mockTurnHandlerResolverObject;
    /** @type {PlayerTurnHandler} */
    let mockPlayerTurnHandler;
    /** @type {typeof mockCommandProcessor} */
    let mockCommandProcessorValue;

    beforeEach(() => {
        jest.clearAllMocks();

        mockContainer = createMockContainer();
        mockTurnOrderService = createMockTurnOrderService();
        mockTurnHandlerResolverObject = createMockTurnHandlerResolverObject();
        mockPlayerTurnHandler = new PlayerTurnHandler({/* minimalist mocks if needed */});
        mockCommandProcessorValue = {processCommand: jest.fn()};

        // Pre-register ALL MOCKED dependencies required by factories
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IGameStateManager, mockGameStateManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IInputHandler, mockInputHandler, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ICommandParser, mockCommandParser, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IActionExecutor, mockActionExecutor, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IActionDiscoverySystem, mockActionDiscoverySystemObject, {lifecycle: 'singleton'}); // Gets overwritten
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ITurnOrderService, mockTurnOrderService, {lifecycle: 'singleton'}); // Needed by TurnManager factory
        mockContainer.register(tokens.TurnHandlerResolver, mockTurnHandlerResolverObject, {lifecycle: 'singleton'}); // Gets overwritten

        // Register mocks needed by coreSystemsRegistrations factories
        mockContainer.register(tokens.PlayerTurnHandler, mockPlayerTurnHandler, {lifecycle: 'singleton'}); // Needed by THR factory
        mockContainer.register(tokens.ICommandProcessor, mockCommandProcessorValue, {lifecycle: 'singleton'}); // Needed by PlayerTurnHandler factory
        mockContainer.register(tokens.ConditionEvaluationService, mockConditionEvaluationService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ItemTargetResolverService, mockItemTargetResolverService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ActionValidationService, mockActionValidationService, {lifecycle: 'singleton'}); // Needed by ADS factory

        // Clear mocks
        Object.values(mockLogger).forEach(fn => fn?.mockClear?.());
        Object.values(mockGameStateManager).forEach(fn => fn?.mockClear?.());
        Object.values(mockInputHandler).forEach(fn => fn?.mockClear?.());
        // ... clear other mocks ...
        Object.values(mockTurnHandlerResolverObject).forEach(fn => fn?.mockClear?.());
        Object.values(mockCommandProcessorValue).forEach(fn => fn?.mockClear?.());
        Object.values(mockActionValidationService).forEach(fn => fn?.mockClear?.());

        GameLoop.mockClear();
        InputSetupService.mockClear();
        PlayerTurnHandler.mockClear();
        // <<< ADDED: Clear TurnManager mock >>>
        TurnManager.mockClear();
    });

    it('should register runtime services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerRuntime(mockContainer);
        }).not.toThrow();

        // Assert registrations by registerRuntime
        const registerCalls = mockContainer.register.mock.calls;
        const gameLoopCall = registerCalls.find(call => call[0] === tokens.GameLoop);
        const inputSetupCall = registerCalls.find(call => call[0] === tokens.InputSetupService);

        expect(gameLoopCall).toBeDefined();
        if (gameLoopCall) {
            expect(gameLoopCall[1]).toBeInstanceOf(Function);
            expect(gameLoopCall[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));
        }
        expect(inputSetupCall).toBeDefined();
        if (inputSetupCall) {
            expect(inputSetupCall[1]).toBeInstanceOf(Function);
            expect(inputSetupCall[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));
        }

        // Assert ITurnManager was NOT registered in *this* scope
        const callsDuringTest = mockContainer.register.mock.calls.slice(mockContainer.register.mock.calls.length - (gameLoopCall ? 1 : 0) - (inputSetupCall ? 1 : 0));
        const turnManagerCallDuringTest = callsDuringTest.find(call => call[0] === tokens.ITurnManager);
        expect(turnManagerCallDuringTest).toBeUndefined();
    });

    it('resolving GameLoop does not throw', () => {
        // Arrange
        registerCoreSystems(mockContainer); // Registers factories (ADS, THR, ITurnManager)
        registerRuntime(mockContainer);    // Registers GameLoop factory

        // Act
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.GameLoop);
        }).not.toThrow();

        // Assert Resolved Service
        expect(resolvedService).toBeDefined();
        expect(resolvedService).toBeInstanceOf(GameLoop); // Jest mock instance

        // Assert GameLoop Constructor Called
        expect(GameLoop).toHaveBeenCalledTimes(1);
        const constructorArgs = GameLoop.mock.calls[0][0];

        // Assert Standard Dependencies (mocks from beforeEach)
        expect(constructorArgs.gameStateManager).toBe(mockGameStateManager);
        expect(constructorArgs.inputHandler).toBe(mockInputHandler);
        // ... other standard deps ...
        expect(constructorArgs.validatedEventDispatcher).toBe(mockValidatedEventDispatcher);
        expect(constructorArgs.logger).toBe(mockLogger);

        // Assert Dependencies whose factories were registered by coreSystems
        expect(constructorArgs.actionDiscoverySystem).toBeInstanceOf(ActionDiscoverySystem); // Real instance
        expect(constructorArgs.turnHandlerResolver).toBeInstanceOf(TurnHandlerResolver); // Real instance

        // --- Assert TurnManager is now the MOCK instance ---
        expect(constructorArgs.turnManager).toBeDefined();
        expect(constructorArgs.turnManager).toBeInstanceOf(TurnManager); // Should be the Jest mock instance

        // --- Optionally: Assert the TurnManager mock constructor was called ---
        // This happens when the ITurnManager factory from coreSystems executes
        expect(TurnManager).toHaveBeenCalledTimes(1);
        // We could even check args passed to TurnManager mock constructor if needed
        // expect(TurnManager).toHaveBeenCalledWith(expect.objectContaining({
        //     turnOrderService: mockTurnOrderService,
        //     entityManager: mockEntityManager,
        //     logger: mockLogger,
        //     dispatcher: mockValidatedEventDispatcher
        // }));


        // Verify resolves occurred during factory execution
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IGameStateManager);
        // ... other resolve checks ...
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IActionDiscoverySystem);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.TurnHandlerResolver);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager); // Factory runs, returns TurnManager mock instance
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnOrderService); // Resolved by ITurnManager factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.PlayerTurnHandler); // Resolved by THR factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ActionValidationService); // Resolved by ADS factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ICommandProcessor); // Resolved by PlayerTurnHandler factory
    });

    it('resolving InputSetupService does not throw', () => {
        // Arrange
        registerCoreSystems(mockContainer);
        registerRuntime(mockContainer);

        // Act
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.InputSetupService);
        }).not.toThrow();

        // Assert resolved service & constructor call
        expect(resolvedService).toBeDefined();
        expect(resolvedService).toBeInstanceOf(InputSetupService);
        expect(InputSetupService).toHaveBeenCalledTimes(1);
        expect(InputSetupService).toHaveBeenCalledWith(expect.objectContaining({
            container: mockContainer,
            logger: mockLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            gameLoop: expect.any(GameLoop) // Resolved GameLoop mock instance
        }));

        // Assert GameLoop factory execution
        expect(GameLoop).toHaveBeenCalledTimes(1);
        // Assert TurnManager factory execution (called via GameLoop resolution)
        expect(TurnManager).toHaveBeenCalledTimes(1);

        // Assert nested resolutions occurred
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnOrderService);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.TurnHandlerResolver);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IActionDiscoverySystem);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ActionValidationService);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.PlayerTurnHandler);
    });
});