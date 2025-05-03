// src/tests/core/config/registrations/domainServicesRegistrations.test.js
// ****** CORRECTED FILE ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Assuming concrete class if needed
/** @typedef {import('../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../../../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../../../../services/actionValidationService.js').default} ActionValidationService */
/** @typedef {import('../../../../services/payloadValueResolverService.js').default} PayloadValueResolverService */
/** @typedef {import('../../../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../../core/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../../../core/interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../../../core/interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../../../core/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../../../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerDomainServices} from '../../../../core/config/registrations/domainServicesRegistrations.js';

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';

// --- REMOVED top-level const mock... = jest.fn() declarations ---
// const mockConditionEvaluationService = jest.fn(); // REMOVED
// ... and so on for all others ...

// --- MOCK the Modules Directly Inline ---
jest.mock('../../../../services/conditionEvaluationService.js', () => ({
    __esModule: true,
    default: jest.fn() // Create mock inline
}));
jest.mock("../../../../services/itemTargetResolver.js", () => ({
    __esModule: true,
    ItemTargetResolverService: jest.fn() // Create mock inline
}));
jest.mock("../../../../services/targetResolutionService.js", () => ({
    __esModule: true,
    default: jest.fn() // Create mock inline
}));
jest.mock("../../../../services/actionValidationContextBuilder.js", () => ({
    __esModule: true,
    ActionValidationContextBuilder: jest.fn() // Create mock inline
}));
jest.mock("../../../../services/prerequisiteEvaluationService.js", () => ({
    __esModule: true,
    PrerequisiteEvaluationService: jest.fn() // Create mock inline
}));
jest.mock("../../../../validation/domainContextCompatibilityChecker.js", () => ({
    __esModule: true,
    DomainContextCompatibilityChecker: jest.fn() // Create mock inline
}));
jest.mock("../../../../services/actionValidationService.js", () => ({
    __esModule: true,
    ActionValidationService: jest.fn() // Create mock inline
}));
jest.mock("../../../../services/payloadValueResolverService.js", () => ({
    __esModule: true,
    default: jest.fn() // Create mock inline
}));
jest.mock("../../../../actions/actionExecutor.js", () => ({
    __esModule: true,
    default: jest.fn() // Create mock inline
}));
jest.mock("../../../../core/commandParser.js", () => ({
    __esModule: true,
    default: jest.fn() // Create mock inline
}));
jest.mock('../../../../logic/jsonLogicEvaluationService.js', () => ({
    __esModule: true,
    default: jest.fn() // Create mock inline
}));
jest.mock('../../../../core/worldContext.js', () => ({
    __esModule: true,
    default: jest.fn() // Create mock inline
}));
jest.mock('../../../../core/commandProcessor.js', () => ({
    __esModule: true,
    default: jest.fn() // Create mock inline
}));
jest.mock('../../../../core/turnOrder/turnOrderService.js', () => ({
    __esModule: true,
    TurnOrderService: jest.fn() // Create mock inline
}));


// --- Import AFTER mocking ---
// These imports now point to the mocks created inline above
import ConditionEvaluationService from '../../../../services/conditionEvaluationService.js';
import {ItemTargetResolverService} from "../../../../services/itemTargetResolver.js";
import TargetResolutionService from "../../../../services/targetResolutionService.js";
import {ActionValidationContextBuilder} from "../../../../services/actionValidationContextBuilder.js";
import {PrerequisiteEvaluationService} from "../../../../services/prerequisiteEvaluationService.js";
import {DomainContextCompatibilityChecker} from "../../../../validation/domainContextCompatibilityChecker.js";
import {ActionValidationService} from "../../../../services/actionValidationService.js";
import PayloadValueResolverService from "../../../../services/payloadValueResolverService.js";
import ActionExecutor from "../../../../actions/actionExecutor.js";
import CommandParser from "../../../../core/commandParser.js";
import JsonLogicEvaluationService from '../../../../logic/jsonLogicEvaluationService.js';
import WorldContext from '../../../../core/worldContext.js';
import CommandProcessor from '../../../../core/commandProcessor.js';
import {TurnOrderService} from '../../../../core/turnOrder/turnOrderService.js';


// --- Mock Implementations (Core & External Dependencies) ---
// These are for dependencies NOT mocked via jest.mock above
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEntityManager = {getComponent: jest.fn(), hasComponent: jest.fn(), getEntity: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn()};
const mockGameDataRepository = {getActionDefinition: jest.fn(), getRule: jest.fn()};
const mockEventBus = {dispatch: jest.fn(), subscribe: jest.fn()};
// Create an *instance* of the mocked JsonLogic service if needed by other mocks/code
// Note: JsonLogicEvaluationService imported above now refers to the jest.fn() mock constructor
const mockJsonLogicServiceInstance = new JsonLogicEvaluationService();


// --- *** USE THE REFINED MOCK CONTAINER from uiRegistrations.test.js *** ---
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance; // For self-reference within factories/resolvers

    // --- Simplified Register Spy ---
    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        if (!token) {
            console.error('[Mock Register ERROR] Falsy token received unexpectedly!', {
                token,
                factoryOrValueOrClass,
                options
            });
            throw new Error('Mock Register Error: Token is required.');
        }
        registrations.set(token, {
            factoryOrValue: factoryOrValueOrClass,
            options: options
        });
        if (options?.lifecycle?.startsWith('singleton') && instances.has(token)) {
            instances.delete(token);
        }
    });

    // --- Adapted Resolve Spy ---
    const resolveSpy = jest.fn((token) => {
        const tokenString = String(token);
        if (instances.has(token)) return instances.get(token); // Check cache first

        const registration = registrations.get(token);
        if (registration) {
            const {factoryOrValue, options} = registration;
            const lifecycle = options?.lifecycle || 'transient';
            let instance;

            const isClassForSingle = typeof factoryOrValue === 'function' && options?.dependencies && options.dependencies.length > 0 && options?.lifecycle === 'singleton';
            const isFactoryFunction = typeof factoryOrValue === 'function' && !isClassForSingle;

            if (isClassForSingle) { // Handle 'single' registration (Class + dependencies)
                const ClassConstructor = factoryOrValue;
                const deps = options.dependencies;
                const resolvedContainer = containerInstance;
                const dependenciesMap = {};
                const targetClassName = ClassConstructor.name || '[AnonymousClass]';
                deps.forEach((depToken) => {
                    let propName = String(depToken);
                    if (propName.length > 1 && propName.startsWith('I') && propName[1] === propName[1].toUpperCase()) propName = propName.substring(1);
                    propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                    try {
                        dependenciesMap[propName] = resolvedContainer.resolve(depToken);
                    } catch (e) {
                        console.error(`[Mock Resolve Factory for ${tokenString}] FAILED dependency: ${String(depToken)} for prop "${propName}"`, e);
                        throw e;
                    }
                });
                try {
                    instance = new ClassConstructor(dependenciesMap); // Inject map
                } catch (constructorError) {
                    console.error(`[Mock Resolve Factory for ${tokenString}] Constructor error for "${targetClassName}"`, constructorError);
                    throw constructorError;
                }
            } else if (isFactoryFunction) { // Handle 'factory' registration
                try {
                    instance = factoryOrValue(containerInstance); // Execute factory
                } catch (factoryError) {
                    console.error(`[Mock Resolve] Error executing factory for ${tokenString}:`, factoryError);
                    throw factoryError;
                }
            } else { // Handle 'instance' registration
                instance = factoryOrValue; // Return direct value
            }

            // Cache if singleton
            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instance !== undefined) {
                instances.set(token, instance);
            }
            return instance;
        }

        // Fallbacks for core mocks if not registered by test setup
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.EventBus) return mockEventBus;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
        if (token === tokens.EntityManager) return mockEntityManager;
        if (token === tokens.GameDataRepository) return mockGameDataRepository;
        // Return the instance created from the mocked constructor
        if (token === tokens.JsonLogicEvaluationService) return mockJsonLogicServiceInstance;

        // Throw if token truly not found
        const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${String(token)}. Registered: [${registeredTokens}]`);
    });

    // --- Set up container self-reference ---
    containerInstance = {
        _registrations: registrations,
        _instances: instances,
        register: registerSpy,
        resolve: resolveSpy,
        resolveAll: jest.fn((tag) => { // Basic resolveAll mock
            const resolved = [];
            registrations.forEach((reg, token) => {
                if (reg.options?.tags?.includes(tag)) {
                    try {
                        resolved.push(containerInstance.resolve(token));
                    } catch (e) { /* ignore */
                    }
                }
            });
            return resolved;
        })
    };
    return containerInstance;
};


describe('registerDomainServices', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        // Clear mocks defined via jest.mock *AND* regular jest.fn mocks
        jest.clearAllMocks(); // Clears call history etc. for mocks from jest.mock

        mockContainer = createMockContainer();

        // Pre-register MOCKED core/external dependencies required by domain services
        // These are instances/values
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.JsonLogicEvaluationService, mockJsonLogicServiceInstance, {lifecycle: 'singleton'});

        // Pre-register services that are dependencies *within* the bundle
        // Register the *mocked constructors* (which are now jest.fn())
        // The mock resolver will handle calling `new` on these if needed.
        mockContainer.register(tokens.TargetResolutionService, TargetResolutionService, {
            lifecycle: 'singleton',
            dependencies: []
        });
        mockContainer.register(tokens.ActionValidationContextBuilder, ActionValidationContextBuilder, {
            lifecycle: 'singleton',
            dependencies: []
        });
        mockContainer.register(tokens.DomainContextCompatibilityChecker, DomainContextCompatibilityChecker, {
            lifecycle: 'singleton',
            dependencies: []
        });
        mockContainer.register(tokens.PrerequisiteEvaluationService, PrerequisiteEvaluationService, {
            lifecycle: 'singleton',
            dependencies: []
        });
        mockContainer.register(tokens.PayloadValueResolverService, PayloadValueResolverService, {
            lifecycle: 'singleton',
            dependencies: []
        });
        mockContainer.register(tokens.ActionValidationService, ActionValidationService, {
            lifecycle: 'singleton',
            dependencies: []
        });
        mockContainer.register(tokens.IWorldContext, WorldContext, {lifecycle: 'singleton', dependencies: []});
        mockContainer.register(tokens.ICommandParser, CommandParser, {lifecycle: 'singleton', dependencies: []});


        // Clear call counts on the mock container methods *after* pre-registration
        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();

        // --- Clear Mocks Using Imported Variables ---
        // Clear the inline mocks created via jest.mock factories
        ConditionEvaluationService.mockClear();
        ItemTargetResolverService.mockClear();
        TargetResolutionService.mockClear();
        ActionValidationContextBuilder.mockClear();
        PrerequisiteEvaluationService.mockClear();
        DomainContextCompatibilityChecker.mockClear();
        ActionValidationService.mockClear();
        PayloadValueResolverService.mockClear();
        ActionExecutor.mockClear();
        CommandParser.mockClear();
        JsonLogicEvaluationService.mockClear();
        WorldContext.mockClear();
        CommandProcessor.mockClear();
        TurnOrderService.mockClear();
        // Also clear the non-jest.mock mocks
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockEntityManager).forEach(fn => fn.mockClear?.());
        Object.values(mockValidatedEventDispatcher).forEach(fn => fn.mockClear?.());
        Object.values(mockGameDataRepository).forEach(fn => fn.mockClear?.());
        Object.values(mockEventBus).forEach(fn => fn.mockClear?.());

    });

    it('should register domain services without throwing errors', () => {
        expect(() => {
            registerDomainServices(mockContainer);
        }).not.toThrow();

        // Assert: Check registrations - expecting Class constructors for .single
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ConditionEvaluationService, ConditionEvaluationService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ItemTargetResolverService, ItemTargetResolverService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.TargetResolutionService, TargetResolutionService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.JsonLogicEvaluationService, JsonLogicEvaluationService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionValidationContextBuilder, ActionValidationContextBuilder, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PrerequisiteEvaluationService, PrerequisiteEvaluationService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.DomainContextCompatibilityChecker, DomainContextCompatibilityChecker, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionValidationService, ActionValidationService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PayloadValueResolverService, PayloadValueResolverService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.IActionExecutor, ActionExecutor, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.IWorldContext, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ICommandParser, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ICommandProcessor, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ITurnOrderService, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
    });

    it('resolving ActionExecutor does not throw and returns instance', () => {
        registerDomainServices(mockContainer);
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.IActionExecutor);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        // Check that the MOCK ActionExecutor constructor (jest.fn()) was called
        expect(ActionExecutor).toHaveBeenCalledTimes(1);
    });

    it('resolving CommandProcessor does not throw and returns instance', () => {
        registerDomainServices(mockContainer);
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.ICommandProcessor);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        // Check that the MOCK CommandProcessor constructor (jest.fn()) was called by the factory
        expect(CommandProcessor).toHaveBeenCalledTimes(1);
    });

    it('resolving TurnOrderService does not throw and returns instance', () => {
        registerDomainServices(mockContainer);
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.ITurnOrderService);
        }).not.toThrow();
        expect(resolvedService).toBeDefined();
        // Check that the MOCK TurnOrderService constructor (jest.fn()) was called by the factory
        expect(TurnOrderService).toHaveBeenCalledTimes(1);
    });

});