// src/tests/core/config/registrations/domainServicesRegistrations.test.js
// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
// Corrected typedef to point to the interface, though the mock instance is what matters for interaction
/** @typedef {import('../../../../core/interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../../../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../../../services/payloadValueResolverService.js').default} PayloadValueResolverService */
/** @typedef {import('../../../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../../core/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../../core/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../../../core/interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../../../core/interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../../../core/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../../../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../../../core/services/playerPromptService.js').default} PlayerPromptService */
/** @typedef {import('../../../../core/interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../../../core/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerDomainServices} from '../../../../core/config/registrations/domainServicesRegistrations.js';

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';

// --- MOCK INSTANCES needed for assertions or as return values from mock constructors ---
const mockTargetResolutionServiceInstance = {resolveActionTarget: jest.fn()};
const mockWorldContextInstance = {
    getLocationOfEntity: jest.fn(),
    getCurrentLocation: jest.fn(),
    getCurrentActor: jest.fn()
}; // Added missing methods
const mockCommandParserInstance = {parse: jest.fn()};
const mockActionDiscoverySystemInstance = {getValidActions: jest.fn()};
const mockPromptOutputPortInstance = {prompt: jest.fn()};
const mockActionValidationServiceInstance = {validateAction: jest.fn()};
const mockPayloadValueResolverServiceInstance = {resolveValue: jest.fn()};
const mockJsonLogicServiceInstance = {}; // Assuming it needs no methods for these tests

// --- MOCK the Modules Directly Inline ---
jest.mock('../../../../services/conditionEvaluationService.js', () => ({__esModule: true, default: jest.fn()}));
jest.mock("../../../../services/itemTargetResolver.js", () => ({
    __esModule: true,
    ItemTargetResolverService: jest.fn()
}));

// CORRECTED MOCK for targetResolutionService.js
// It exports a named 'TargetResolutionService' class.
jest.mock("../../../../services/targetResolutionService.js", () => ({
    __esModule: true,
    TargetResolutionService: jest.fn().mockImplementation(() => { // Mock the NAMED export
        return mockTargetResolutionServiceInstance;
    }),
    // Note: ResolutionStatus is imported from '../types/resolutionStatus.js' in the actual file,
    // not exported by targetResolutionService.js. This mock part is for test convenience if needed.
    ResolutionStatus: {
        FOUND_UNIQUE: 'FOUND_UNIQUE',
        NONE: 'NONE',
        SELF: 'SELF',
        AMBIGUOUS: 'AMBIGUOUS',
        NOT_FOUND: 'NOT_FOUND',
        ERROR: 'ERROR', // Aligned with typical use from `resolutionStatus.js`
    }
}));
jest.mock("../../../../services/actionValidationContextBuilder.js", () => ({
    __esModule: true,
    ActionValidationContextBuilder: jest.fn()
}));
jest.mock("../../../../services/prerequisiteEvaluationService.js", () => ({
    __esModule: true,
    PrerequisiteEvaluationService: jest.fn()
}));
jest.mock("../../../../validation/domainContextCompatibilityChecker.js", () => ({
    __esModule: true,
    DomainContextCompatibilityChecker: jest.fn()
}));
jest.mock("../../../../services/actionValidationService.js", () => ({
    __esModule: true,
    ActionValidationService: jest.fn().mockImplementation(() => mockActionValidationServiceInstance)
}));
jest.mock("../../../../services/payloadValueResolverService.js", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockPayloadValueResolverServiceInstance)
}));
jest.mock("../../../../core/commandParser.js", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockCommandParserInstance)
}));
jest.mock('../../../../logic/jsonLogicEvaluationService.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockJsonLogicServiceInstance)
}));
jest.mock('../../../../core/worldContext.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        return mockWorldContextInstance;
    })
}));
jest.mock('../../../../core/commandProcessor.js', () => ({__esModule: true, default: jest.fn()}));
jest.mock('../../../../core/turnOrder/turnOrderService.js', () => ({__esModule: true, TurnOrderService: jest.fn()}));
jest.mock('../../../../core/services/playerPromptService.js', () => ({__esModule: true, default: jest.fn()}));

// --- Import AFTER mocking ---
import ConditionEvaluationService from '../../../../services/conditionEvaluationService.js';
import {ItemTargetResolverService} from "../../../../services/itemTargetResolver.js";
// CORRECTED Import for the mocked named export
import {
    TargetResolutionService as MockedTargetResolutionService
} from "../../../../services/targetResolutionService.js";
import {ActionValidationContextBuilder} from "../../../../services/actionValidationContextBuilder.js";
import {PrerequisiteEvaluationService} from "../../../../services/prerequisiteEvaluationService.js";
import {DomainContextCompatibilityChecker} from "../../../../validation/domainContextCompatibilityChecker.js";
import {ActionValidationService} from "../../../../services/actionValidationService.js";
import PayloadValueResolverService from "../../../../services/payloadValueResolverService.js";
import CommandParser from "../../../../core/commandParser.js";
import JsonLogicEvaluationService from '../../../../logic/jsonLogicEvaluationService.js';
import WorldContext from '../../../../core/worldContext.js';
import CommandProcessor from '../../../../core/commandProcessor.js';
import {TurnOrderService} from '../../../../core/turnOrder/turnOrderService.js';
import PlayerPromptService from '../../../../core/services/playerPromptService.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEntityManager = {
    getComponent: jest.fn(),
    hasComponent: jest.fn(),
    getEntity: jest.fn(),
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn()
}; // Added getEntitiesInLocation
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn()};
const mockSafeEventDispatcher = {dispatchSafely: jest.fn(), subscribe: jest.fn()}; // Added subscribe for completeness
const mockGameDataRepository = {getActionDefinition: jest.fn(), getRule: jest.fn(), getAllActionDefinitions: jest.fn()}; // Added getAllActionDefinitions
const mockEventBus = {dispatch: jest.fn(), subscribe: jest.fn()};


const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance;

    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        const tokenString = String(token);
        if (!token) {
            console.error('[Mock Register ERROR] Falsy token received!', {token, factoryOrValueOrClass, options});
            throw new Error('Mock Register Error: Token is required.');
        }
        registrations.set(token, {
            registration: factoryOrValueOrClass,
            options: options
        });
        const lifecycle = options?.lifecycle || 'singleton';
        if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instances.has(token)) {
            instances.delete(token);
        }
    });

    const resolveSpy = jest.fn((token) => {
        const tokenString = String(token);
        const lifecycleFromRegistration = registrations.get(token)?.options?.lifecycle;
        const isSingleton = lifecycleFromRegistration === 'singleton' || lifecycleFromRegistration === 'singletonFactory';

        if (isSingleton && instances.has(token)) {
            return instances.get(token);
        }

        const registrationData = registrations.get(token);
        if (!registrationData) {
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.EventBus) return mockEventBus;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.ISafeEventDispatcher) return mockSafeEventDispatcher;
            if (token === tokens.EntityManager) return mockEntityManager;
            if (token === tokens.GameDataRepository) return mockGameDataRepository;
            if (token === tokens.ICommandParser) return mockCommandParserInstance;
            if (token === tokens.IActionDiscoverySystem) return mockActionDiscoverySystemInstance;
            if (token === tokens.IPromptOutputPort) return mockPromptOutputPortInstance;
            // Fallback for TargetResolutionService if requested directly (though usually through factory)
            if (token === tokens.TargetResolutionService) return mockTargetResolutionServiceInstance;
            if (token === tokens.IWorldContext) return mockWorldContextInstance;


            const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
            console.error(`[Mock Resolve Error] Token not registered or explicitly mocked via fallback: ${tokenString}. Registered: [${registeredTokens}]`);
            throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}. Registered: [${registeredTokens}]`);
        }

        const {registration: factoryOrValueOrClass, options} = registrationData;
        const lifecycle = options?.lifecycle || 'singleton';
        let instance;

        const isClassRegistration = typeof factoryOrValueOrClass === 'function'
            && options?.hasOwnProperty('dependencies'); // True for r.single()
        const isFactoryFunction = typeof factoryOrValueOrClass === 'function' && !isClassRegistration; // True for r.singletonFactory() or direct factory

        if (isClassRegistration) {
            const ClassConstructor = factoryOrValueOrClass;
            const deps = Array.isArray(options.dependencies) ? options.dependencies : [];
            const resolvedContainer = containerInstance; // Use the fully formed container for resolving deps
            const dependenciesMap = {}; // For classes expecting an options object
            const dependencyArgs = []; // For classes expecting positional arguments

            const targetClassName = ClassConstructor.name || '[AnonymousMockClass]';

            // This simplistic dependency resolution assumes constructor takes an object
            // or positional args. Modify if your mock classes have different constructor signatures.
            let expectsOptionsObject = false; // Determine this based on your convention or class structure
            // Example: if deps are like ['dep1', {token: 'dep2', propName: 'logger'}], etc.

            deps.forEach((depTokenOrConfig) => {
                let depToken = depTokenOrConfig;
                let propName; // For options object

                if (typeof depTokenOrConfig === 'object' && depTokenOrConfig.token) {
                    depToken = depTokenOrConfig.token;
                    propName = depTokenOrConfig.propName;
                    expectsOptionsObject = true;
                } else {
                    // Infer propName for options object, or rely on positional for args array
                    propName = String(depToken);
                    if (propName.length > 1 && propName.startsWith('I') && propName[1] === propName[1].toUpperCase()) propName = propName.substring(1);
                    propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                }

                try {
                    const resolvedDep = resolvedContainer.resolve(depToken);
                    if (expectsOptionsObject || propName) { // Simple check, might need refinement
                        dependenciesMap[propName] = resolvedDep;
                    }
                    dependencyArgs.push(resolvedDep);
                } catch (e) {
                    console.error(`[Mock Resolve - Class Dep Error] Failed to resolve dependency "${String(depToken)}" (for prop "${propName}") needed by "${targetClassName}" (${tokenString})`, e);
                    throw new Error(`Failed dependency resolution for "${targetClassName}": ${e.message}`, {cause: e});
                }
            });
            try {
                // Heuristic: if ClassConstructor is a Jest mock fn (common for these tests)
                // and it's not a class itself (no prototype), it might be a factory-like mock.
                // Or, if it's a real class, use `new`.
                if (jest.isMockFunction(ClassConstructor) && !ClassConstructor.prototype?.constructor) {
                    // If dependencies were intended for an options object, pass dependenciesMap
                    // This part is tricky without knowing the exact structure of all mocked classes
                    // For most of your direct class mocks (ConditionEval, ItemTargetResolver, etc.), they are jest.fn()
                    // and don't take constructor args in the mock itself. The factory pattern is safer.
                    instance = ClassConstructor(); // Mocked classes usually return their instance directly
                } else if (ClassConstructor.prototype && ClassConstructor.prototype.constructor === ClassConstructor) {
                    // If expecting an options object (common for services)
                    // This depends on how your actual classes vs. mocks are structured
                    // For this setup, many "classes" are just jest.fn()
                    // Let's assume for this test, if it's a class mock it doesn't need complex DI via options object
                    instance = new ClassConstructor(dependenciesMap); // Or new ClassConstructor(...dependencyArgs);
                } else {
                    // It's a function that's not a class, possibly a factory-like mock constructor
                    instance = ClassConstructor(dependenciesMap); // Or ClassConstructor(...dependencyArgs);
                }

            } catch (constructorError) {
                console.error(`[Mock Resolve - Class Instantiation Error] Constructor error for mocked "${targetClassName}" (${tokenString})`, constructorError);
                throw new Error(`Error constructing mock for ${targetClassName}: ${constructorError.message}`, {cause: constructorError});
            }
        } else if (isFactoryFunction) {
            try {
                instance = factoryOrValueOrClass(containerInstance); // Pass the container to the factory
            } catch (factoryError) {
                console.error(`[Mock Resolve - Factory Execution Error] Error executing factory for ${tokenString}:`, factoryError);
                throw factoryError;
            }
        } else { // It's a direct value registration
            instance = factoryOrValueOrClass;
        }

        if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instance !== undefined) {
            instances.set(token, instance);
        }
        return instance;
    });

    containerInstance = {
        _registrations: registrations,
        _instances: instances,
        register: registerSpy,
        resolve: resolveSpy,
        resolveByTag: jest.fn((tag) => { /* ... */
        }),
        disposeSingletons: jest.fn(() => instances.clear()),
        reset: jest.fn(() => { /* ... */
        })
    };
    return containerInstance;
};


describe('registerDomainServices', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContainer = createMockContainer();

        // Pre-register essential shared services that factories might resolve
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ISafeEventDispatcher, mockSafeEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ICommandParser, mockCommandParserInstance, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IActionDiscoverySystem, mockActionDiscoverySystemInstance, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IPromptOutputPort, mockPromptOutputPortInstance, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IWorldContext, mockWorldContextInstance, {lifecycle: 'singleton'}); // Pre-register for factory resolution
        // Pre-registering TargetResolutionService with its mock instance for CommandProcessor factory
        mockContainer.register(tokens.TargetResolutionService, mockTargetResolutionServiceInstance, {lifecycle: 'singleton'});


        mockContainer.register.mockClear(); // Clear after setup registrations
        mockContainer.resolve.mockClear();

        ConditionEvaluationService.mockClear();
        ItemTargetResolverService.mockClear();
        MockedTargetResolutionService.mockClear(); // Use the imported mocked constructor
        ActionValidationContextBuilder.mockClear();
        PrerequisiteEvaluationService.mockClear();
        DomainContextCompatibilityChecker.mockClear();
        ActionValidationService.mockClear();
        PayloadValueResolverService.mockClear();
        CommandParser.mockClear();
        JsonLogicEvaluationService.mockClear();
        WorldContext.mockClear();
        CommandProcessor.mockClear();
        TurnOrderService.mockClear();
        PlayerPromptService.mockClear();

        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockEntityManager).forEach(fn => fn.mockClear?.());
        Object.values(mockValidatedEventDispatcher).forEach(fn => fn.mockClear?.());
        Object.values(mockSafeEventDispatcher).forEach(fn => fn.mockClear?.());
        Object.values(mockGameDataRepository).forEach(fn => fn.mockClear?.());
        Object.values(mockEventBus).forEach(fn => fn.mockClear?.());
        Object.values(mockJsonLogicServiceInstance).forEach(fn => fn.mockClear?.());
        Object.values(mockWorldContextInstance).forEach(fn => fn.mockClear?.());
        Object.values(mockCommandParserInstance).forEach(fn => fn.mockClear?.());
        Object.values(mockTargetResolutionServiceInstance).forEach(fn => fn.mockClear?.());
        Object.values(mockActionValidationServiceInstance).forEach(fn => fn.mockClear?.());
        Object.values(mockPayloadValueResolverServiceInstance).forEach(fn => fn.mockClear?.());
        Object.values(mockActionDiscoverySystemInstance).forEach(fn => fn.mockClear?.());
        Object.values(mockPromptOutputPortInstance).forEach(fn => fn.mockClear?.());
    });

    it('should register domain services without throwing errors', () => {
        expect(() => {
            registerDomainServices(mockContainer);
        }).not.toThrow();

        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ConditionEvaluationService, ConditionEvaluationService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ItemTargetResolverService, ItemTargetResolverService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: expect.any(Array)
        }));

        // CORRECTED ASSERTION for TargetResolutionService
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.TargetResolutionService,
            expect.any(Function), // It's registered with a factory function
            expect.objectContaining({lifecycle: 'singletonFactory'}) // And these options
        );

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
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.IWorldContext, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        // For ICommandParser, the registration in SUT is container.register(token, factory, options)
        // So the second arg is a function, third is options.
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ICommandParser, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ICommandProcessor, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ITurnOrderService, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PlayerPromptService, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
    });

    it('resolving CommandProcessor does not throw and returns instance', () => {
        registerDomainServices(mockContainer); // This will register factories

        // Ensure dependencies for CommandProcessor factory are resolvable from the mockContainer
        // The factory for ICommandProcessor will call container.resolve for its dependencies.
        // These resolves should hit the pre-registered mocks or fallbacks.

        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.ICommandProcessor);
        }).not.toThrow();

        expect(resolvedService).toBeDefined();
        // Check that the CommandProcessor constructor (the mock) was called by the factory
        expect(CommandProcessor).toHaveBeenCalledTimes(1);
        expect(CommandProcessor).toHaveBeenCalledWith(expect.objectContaining({
            commandParser: mockCommandParserInstance,
            targetResolutionService: mockTargetResolutionServiceInstance, // Factory resolves this to the pre-registered mock instance
            logger: mockLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            safeEventDispatcher: mockSafeEventDispatcher,
            worldContext: mockWorldContextInstance, // Factory resolves this
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository
        }));
    });

    it('resolving TurnOrderService does not throw and returns instance', () => {
        registerDomainServices(mockContainer);
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.ITurnOrderService);
        }).not.toThrow();

        expect(resolvedService).toBeDefined();
        expect(TurnOrderService).toHaveBeenCalledTimes(1);
        expect(TurnOrderService).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger
        }));
    });

    it('resolving PlayerPromptService does not throw and returns instance', () => {
        registerDomainServices(mockContainer);
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.PlayerPromptService);
        }).not.toThrow();

        expect(resolvedService).toBeDefined();
        expect(PlayerPromptService).toHaveBeenCalledTimes(1);
        expect(PlayerPromptService).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystemInstance,
            promptOutputPort: mockPromptOutputPortInstance,
            worldContext: mockWorldContextInstance, // Factory resolves this
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository
        }));
    });
});
