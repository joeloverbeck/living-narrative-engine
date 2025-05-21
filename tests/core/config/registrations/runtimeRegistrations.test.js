// ****** REVISED CORRECTED FILE V12 ******
// src/tests/core/config/registrations/runtimeRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/context/worldContext.js').default} GameStateManager */
/** @typedef {import('../../../../core/interfaces/input.js').IInputHandler} IInputHandler */
/** @typedef {import('../../../../src/commands/commandParser.js').default} CommandParser */
/** @typedef {import('../../../../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('../../../../src/events/eventBus.js').default} EventBus */
/** @typedef {import('../../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../src/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../src/systems/actionDiscoverySystem.js').ActionDiscoverySystem} ActionDiscoverySystem */
/** @typedef {import('../../../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// REMOVED: GameLoop typedef no longer needed in this test context
// /** @typedef {import('../../../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../../../src/setup/inputSetupService.js').default} InputSetupService */
/** @typedef {import('../../../../src/turns/turnManager.js').default} TurnManager */
/** @typedef {import('../../../../src/turns/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../../../src/turns/services/turnHandlerResolver.js').default} TurnHandlerResolver */
/** @typedef {import('../../../../src/turns/handlers/playerTurnHandler.js').default} PlayerTurnHandler */
/** @typedef {import('../../../../src/commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerRuntime} from '../../../../src/config/registrations/runtimeRegistrations.js';
// Import other registration functions needed for dependency setup in tests
import {registerCoreSystems} from '../../../../src/config/registrations/coreSystemsRegistrations.js';
import {registerDomainServices} from '../../../../src/config/registrations/domainServicesRegistrations.js';


// --- Dependencies ---
import {tokens} from '../../../../src/config/tokens.js';
// Import real classes needed for instanceof checks where not mocked
// import {ActionDiscoverySystem} from '../../../../systems/actionDiscoverySystem.js'; // Now mocked
// import TurnHandlerResolver from '../../../../core/services/turnHandlerResolver.js'; // Now mocked
// Import concrete classes for domain services (if needed, but mostly mocked)
import CommandProcessor from '../../../../src/commands/commandProcessor.js';
import CommandParser from '../../../../src/commands/commandParser.js';
import WorldContext from '../../../../src/context/worldContext.js';
import {TurnOrderService} from '../../../../src/turns/order/turnOrderService.js'; // Original for type info if needed


// --- MOCK the Modules (Classes being registered/depended upon) ---
// REMOVED: GameLoop mock - runtimeRegistrations no longer uses it
// jest.mock('../../../../core/gameLoop.js');
jest.mock('../../../../src/setup/inputSetupService.js');
jest.mock('../../../../src/turns/turnManager.js');
jest.mock('../../../../src/turns/handlers/playerTurnHandler.js');
jest.mock('../../../../src/commands/commandProcessor.js');
jest.mock('../../../../src/commands/commandParser.js');
jest.mock('../../../../src/context/worldContext.js');
jest.mock('../../../../src/turns/order/turnOrderService.js'); // Mocking TurnOrderService
// Mock core systems dependencies if needed by other registrations called in tests
jest.mock('../../../../src/systems/actionDiscoverySystem.js'); // Mocking ActionDiscoverySystem
jest.mock('../../../../src/turns/services/turnHandlerResolver.js');


// --- Import AFTER mocking ---
import InputSetupService from '../../../../src/setup/inputSetupService.js';
import TurnManager from '../../../../src/turns/turnManager.js';
import PlayerTurnHandler from '../../../../src/turns/handlers/playerTurnHandler.js';
// Import mocked versions for type checks if needed elsewhere
import CommandProcessorMock from '../../../../src/commands/commandProcessor.js';
import CommandParserMock from '../../../../src/commands/commandParser.js';
import GameStateManagerMock from '../../../../src/context/worldContext.js';
import {TurnOrderService as TurnOrderServiceMock} from '../../../../src/turns/order/turnOrderService.js';
// --- CORRECTION: Import the NAMED export 'ActionDiscoverySystem' and alias it ---
import {ActionDiscoverySystem as ActionDiscoverySystemMock} from '../../../../src/systems/actionDiscoverySystem.js';
import TurnHandlerResolverMock from '../../../../src/turns/services/turnHandlerResolver.js';
// REMOVED: GameLoop import not needed
// import GameLoop from '../../../../core/gameLoop.js';


// --- Mock Implementations (Core & External Dependencies) ---
// Simple object mocks for dependencies NOT registered by coreSystems/runtime/domain
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockInputHandler = {enable: jest.fn(), disable: jest.fn(), setCommandCallback: jest.fn()};
const mockEventBus = {dispatch: jest.fn(), subscribe: jest.fn()};
const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(entityId => undefined),
    getEntity: jest.fn(entityId => undefined),
    hasComponent: jest.fn(() => false), // Add mock hasComponent
};
const mockGameDataRepository = {getActionDefinition: jest.fn(), getAllActionDefinitions: jest.fn(() => [])}; // Mock getAllActionDefinitions
// REMOVED: mockActionDiscoverySystemObject - using imported mock now
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()};

// Mock object for TurnHandlerResolver (overwritten in test by factory)
const createMockTurnHandlerResolverObject = () => ({
    resolveHandler: jest.fn(actor => undefined),
    resolve: jest.fn(type => undefined),
});

// Simple object mocks for other domain services needed by factories but not the focus
const mockActionValidationService = {validateAction: jest.fn(), isValid: jest.fn(() => true)}; // Add mock isValid
const mockTargetResolutionService = {resolveTargets: jest.fn()};
const mockPayloadValueResolverService = {resolveValue: jest.fn()};
const mockPrerequisiteEvaluationService = {evaluatePrerequisites: jest.fn()};
const mockDomainContextCompatibilityChecker = {check: jest.fn()};
const mockJsonLogicEvaluationService = {evaluate: jest.fn()};
const mockActionValidationContextBuilder = {buildContext: jest.fn()};
// REMOVED: mockTurnOrderServiceObject - we now use the imported mock TurnOrderServiceMock

// --- Mock Custom DI Container ---
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
        }),

        // ****** START: CORRECTED RESOLVE METHOD ******
        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }
            const {factoryOrValue, options} = registration;

            // --- Handle Singleton Factory FIRST ---
            // Explicitly check for singletonFactory and assume it needs the container.
            if (options?.lifecycle === 'singletonFactory') {
                if (resolvedInstances.has(token)) {
                    return resolvedInstances.get(token);
                }
                let instance;
                if (typeof factoryOrValue === 'function') { // Assume ALL singletonFactories are functions needing the container
                    try {
                        // <<< ALWAYS pass container for singletonFactory >>>
                        instance = factoryOrValue(container);
                    } catch (e) {
                        // Use a specific error message for this path
                        console.error(`Mock container: Error executing singletonFactory for ${String(token)}: ${e.message}\n${e.stack}`);
                        throw e;
                    }
                } else {
                    // Defensive coding: This shouldn't happen if registration is correct
                    console.error(`Mock container: Invalid registration for singletonFactory ${String(token)}. Expected a function.`);
                    throw new Error(`Invalid singletonFactory registration for ${String(token)}.`);
                }
                resolvedInstances.set(token, instance);
                return instance;
            }
                // --- Handle Regular Singleton SECOND ---
            // Handles classes, simple factories (no args), or direct values registered as singletons.
            else if (options?.lifecycle === 'singleton') {
                if (resolvedInstances.has(token)) {
                    return resolvedInstances.get(token);
                }
                let instance;
                // Check if it's a Jest mock CONSTRUCTOR (e.g., register(token, MockClass))
                if (typeof factoryOrValue === 'function' && jest.isMockFunction(factoryOrValue) && factoryOrValue.prototype && factoryOrValue.prototype.constructor === factoryOrValue) {
                    try {
                        instance = new factoryOrValue(); // Instantiate mock class
                    } catch (e) {
                        console.error(`Mock container: Error invoking Jest mocked constructor for ${String(token)}: ${e.message}\n${e.stack}`);
                        throw e;
                    }
                }
                // Check if it's a non-mock CLASS constructor (e.g., register(token, RealClass))
                else if (typeof factoryOrValue === 'function' && factoryOrValue.prototype && factoryOrValue.prototype.constructor === factoryOrValue && !jest.isMockFunction(factoryOrValue)) {
                    try {
                        // Simplified instantiation for 'singleton' (no container passed)
                        // Assumes no-arg constructor or test provides necessary mocks globally if needed
                        console.warn(`Mock container: Attempting to instantiate non-mock singleton class ${String(token)}. Ensure dependencies are globally mocked or it has a no-arg constructor.`);
                        instance = new factoryOrValue();
                    } catch (e) {
                        console.error(`Mock container: Error instantiating non-mock class for singleton ${String(token)}: ${e.message}\n${e.stack}`);
                        throw e;
                    }
                }
                // Check if it's a SIMPLE factory (no args)
                else if (typeof factoryOrValue === 'function') {
                    try {
                        instance = factoryOrValue(); // Call factory without container
                    } catch (e) {
                        // This is the catch block that was incorrectly being hit before the fix
                        console.error(`Mock container: Error executing simple factory for singleton ${String(token)}: ${e.message}\n${e.stack}`);
                        throw e;
                    }
                }
                // Otherwise, it's a pre-created instance/value
                else {
                    instance = factoryOrValue;
                }
                resolvedInstances.set(token, instance);
                return instance;
            }
                // --- Handle Transient (or default) ---
            // Simplified: Create new instance for functions, return value otherwise
            else {
                if (typeof factoryOrValue === 'function' && jest.isMockFunction(factoryOrValue) && factoryOrValue.prototype && factoryOrValue.prototype.constructor === factoryOrValue) {
                    return new factoryOrValue(); // New mock instance
                } else if (typeof factoryOrValue === 'function') {
                    // Assume transient factories might take container or not. Pass it for flexibility.
                    try {
                        return factoryOrValue(container);
                    } catch (e) {
                        console.error(`Mock container: Error executing transient factory for ${String(token)}: ${e.message}\n${e.stack}`);
                        throw e;
                    }
                }
                return factoryOrValue; // Return value directly
            }
        }),
        // ****** END: CORRECTED RESOLVE METHOD ******


        resolveAll: jest.fn((tag) => {
            // resolveAll implementation remains the same
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
    /** @type {ReturnType<typeof createMockTurnHandlerResolverObject>} */
    let mockTurnHandlerResolverObject; // Keep if needed for setup

    beforeEach(() => {
        jest.clearAllMocks(); // Clear all mocks

        mockContainer = createMockContainer();
        mockTurnHandlerResolverObject = createMockTurnHandlerResolverObject();

        // --- Pre-register CORE dependencies needed by MULTIPLE registration files ---
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        // --- Pre-register MOCKS for services registered OUTSIDE runtimeRegistrations ---
        // Use the Jest-mocked versions directly where available
        mockContainer.register(tokens.IWorldContext, GameStateManagerMock, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ICommandParser, CommandParserMock, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ICommandProcessor, CommandProcessorMock, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ITurnOrderService, TurnOrderServiceMock, {lifecycle: 'singleton'});
        // Use the imported alias ActionDiscoverySystemMock which now points to the correct mock
        mockContainer.register(tokens.IActionDiscoverySystem, ActionDiscoverySystemMock, {lifecycle: 'singleton'});
        mockContainer.register(tokens.TurnHandlerResolver, TurnHandlerResolverMock, {lifecycle: 'singleton'});
        mockContainer.register(tokens.PlayerTurnHandler, PlayerTurnHandler, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ITurnManager, TurnManager, {lifecycle: 'singleton'});

        // UI Mocks
        mockContainer.register(tokens.IInputHandler, mockInputHandler, {lifecycle: 'singleton'});

        // Simple object mocks for remaining dependencies
        mockContainer.register(tokens.ActionValidationService, mockActionValidationService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.TargetResolutionService, mockTargetResolutionService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.PrerequisiteEvaluationService, mockPrerequisiteEvaluationService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.DomainContextCompatibilityChecker, mockDomainContextCompatibilityChecker, {lifecycle: 'singleton'});
        mockContainer.register(tokens.JsonLogicEvaluationService, mockJsonLogicEvaluationService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ActionValidationContextBuilder, mockActionValidationContextBuilder, {lifecycle: 'singleton'});

        // --- Clear specific mock function calls ---
        // Clear functions on simple object mocks
        Object.values(mockLogger).forEach(fn => fn?.mockClear?.());
        Object.values(mockInputHandler).forEach(fn => fn?.mockClear?.());
        Object.values(mockEventBus).forEach(fn => fn?.mockClear?.());
        Object.values(mockEntityManager).forEach(fn => fn?.mockClear?.());
        Object.values(mockGameDataRepository).forEach(fn => fn?.mockClear?.());
        // REMOVED: Clearing mockActionDiscoverySystemObject
        Object.values(mockValidatedEventDispatcher).forEach(fn => fn?.mockClear?.());
        Object.values(mockTurnHandlerResolverObject).forEach(fn => fn?.mockClear?.());
        Object.values(mockActionValidationService).forEach(fn => fn?.mockClear?.());
        Object.values(mockTargetResolutionService).forEach(fn => fn?.mockClear?.());
        Object.values(mockPayloadValueResolverService).forEach(fn => fn?.mockClear?.());
        Object.values(mockPrerequisiteEvaluationService).forEach(fn => fn?.mockClear?.());
        Object.values(mockDomainContextCompatibilityChecker).forEach(fn => fn?.mockClear?.());
        Object.values(mockJsonLogicEvaluationService).forEach(fn => fn?.mockClear?.());
        Object.values(mockActionValidationContextBuilder).forEach(fn => fn?.mockClear?.());
        // REMOVED: Clearing mockTurnOrderServiceObject


        // --- Clear calls on Jest-mocked classes ---
        // Use mockClear on the imported mocked class directly
        InputSetupService.mockClear();
        TurnManager.mockClear();
        PlayerTurnHandler.mockClear();
        CommandProcessorMock.mockClear();
        CommandParserMock.mockClear();
        GameStateManagerMock.mockClear();
        TurnOrderServiceMock.mockClear(); // Should work now
        // Use the imported alias ActionDiscoverySystemMock which now points to the correct mock
        ActionDiscoverySystemMock.mockClear(); // <<< This should now work
        TurnHandlerResolverMock.mockClear();
        // REMOVED: GameLoop.mockClear();
    });

    it('should register runtime services without throwing errors', () => {
        // This test remains the same
        // Arrange & Act
        expect(() => {
            registerRuntime(mockContainer); // Call the function under test
        }).not.toThrow();

        // Assert registrations actually performed by registerRuntime
        const registerCalls = mockContainer.register.mock.calls;

        // Verify InputSetupService was registered by registerRuntime
        const inputSetupCall = registerCalls.find(call => call[0] === tokens.InputSetupService);
        expect(inputSetupCall).toBeDefined();
        if (inputSetupCall) {
            expect(inputSetupCall[1]).toBeInstanceOf(Function); // Factory function
            // Check for 'singletonFactory' specifically
            expect(inputSetupCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));
        }

        // Verify GameLoop was NOT registered by registerRuntime
        const gameLoopCall = registerCalls.find(call => call[0] === tokens.GameLoop);
        expect(gameLoopCall).toBeUndefined();
    });

    // --- REMOVED Obsolete Test Case ---
    // it('resolving GameLoop does not throw', () => {
    //     // ... Test content removed ...
    // });

    it('resolving InputSetupService does not throw', () => {
        // Arrange
        // Pre-register dependencies needed by the InputSetupService factory
        // (These are already done in beforeEach, but double-checking is good)
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        // Register the service using the function under test
        registerRuntime(mockContainer);

        // Act & Assert: Expect resolve NOT to throw
        let resolvedService;
        expect(() => {
            // Clear any previous resolve calls if necessary (e.g., from beforeEach setup)
            // mockContainer.resolve.mockClear(); // Usually done in beforeEach, but can be specific
            resolvedService = mockContainer.resolve(tokens.InputSetupService);
        }).not.toThrow(); // <<<< THIS IS THE MAIN ASSERTION THAT FAILED BEFORE

        // Assert resolved service & constructor call
        expect(resolvedService).toBeDefined();
        // Because InputSetupService itself is mocked, check if the MOCK constructor was called
        expect(InputSetupService).toHaveBeenCalledTimes(1);
        // Check that the mock constructor was called with the dependencies resolved by the factory
        expect(InputSetupService).toHaveBeenCalledWith(expect.objectContaining({
            container: mockContainer, // The factory passes the container itself
            logger: mockLogger, // The factory resolves ILogger -> returns mockLogger
            validatedEventDispatcher: mockValidatedEventDispatcher // Factory resolves IValidatedEventDispatcher -> returns mockValidatedEventDispatcher
        }));

        // Assert Dependencies were resolved BY the factory function WHEN it was executed by mockContainer.resolve
        // We check the mock resolve function's call history
        // It should have been called internally by the factory function
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);

        // Check that other potentially indirect dependencies were NOT resolved *directly* by this factory's execution
        // (This helps ensure the factory only resolves what it immediately needs)
        // Example: InputSetupService doesn't directly need TurnManager
        expect(mockContainer.resolve).not.toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockContainer.resolve).not.toHaveBeenCalledWith(tokens.ICommandProcessor);
        expect(mockContainer.resolve).not.toHaveBeenCalledWith(tokens.IInputHandler); // InputHandler is resolved later by InputSetupService.configureInputHandler
    });
});