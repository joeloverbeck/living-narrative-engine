// src/tests/core/config/registrations/domainServicesRegistrations.test.js
// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */ // Changed to interface
/** @typedef {import('../../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../src/interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */ // Changed to interface
/** @typedef {import('../../../src/events/eventBus.js').default} EventBus */
/** @typedef {import('../../../src/logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../../src/interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../../src/services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../../../services/payloadValueResolverService.js').default} PayloadValueResolverService */
/** @typedef {import('../../../src/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../src/commands/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../../src/interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../../src/interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../../src/commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../../src/turns/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../../src/turns/interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */ // Changed to interface
/** @typedef {import('../../../src/interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../../src/turns/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerDomainServices} from '../../../src/config/registrations/domainServicesRegistrations.js';

// --- Dependencies ---
import {tokens} from '../../../src/config/tokens.js';

// --- MOCK INSTANCES needed for assertions or as return values from mock constructors ---
const mockTargetResolutionServiceInstance = {resolveActionTarget: jest.fn()};
const mockWorldContextInstance = {
    getLocationOfEntity: jest.fn(),
    getCurrentLocation: jest.fn(),
    getCurrentActor: jest.fn()
};
const mockCommandParserInstance = {parse: jest.fn()};
const mockActionDiscoverySystemInstance = {getValidActions: jest.fn()};
const mockPromptOutputPortInstance = {prompt: jest.fn()};
const mockActionValidationServiceInstance = {validateAction: jest.fn()};
const mockPayloadValueResolverServiceInstance = {resolveValue: jest.fn()};
const mockJsonLogicServiceInstance = {};
const mockPlayerPromptServiceInstance = {prompt: jest.fn()}; // Mock instance for IPlayerPromptService

// --- MOCK the Modules Directly Inline ---
jest.mock("../../../src/services/targetResolutionService.js", () => ({
    __esModule: true,
    TargetResolutionService: jest.fn().mockImplementation(() => {
        return mockTargetResolutionServiceInstance;
    }),
    ResolutionStatus: {
        FOUND_UNIQUE: 'FOUND_UNIQUE',
        NONE: 'NONE',
        SELF: 'SELF',
        AMBIGUOUS: 'AMBIGUOUS',
        NOT_FOUND: 'NOT_FOUND',
        ERROR: 'ERROR',
    }
}));
jest.mock("../../../src/services/actionValidationContextBuilder.js", () => ({
    __esModule: true,
    ActionValidationContextBuilder: jest.fn()
}));
jest.mock("../../../src/services/prerequisiteEvaluationService.js", () => ({
    __esModule: true,
    PrerequisiteEvaluationService: jest.fn()
}));
jest.mock("../../../src/validation/domainContextCompatibilityChecker.js", () => ({
    __esModule: true,
    DomainContextCompatibilityChecker: jest.fn()
}));
jest.mock("../../../src/services/actionValidationService.js", () => ({
    __esModule: true,
    ActionValidationService: jest.fn().mockImplementation(() => mockActionValidationServiceInstance)
}));
jest.mock("../../../src/commands/commandParser.js", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockCommandParserInstance)
}));
jest.mock('../../../src/logic/jsonLogicEvaluationService.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockJsonLogicServiceInstance)
}));
jest.mock('../../../src/context/worldContext.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        return mockWorldContextInstance;
    })
}));
jest.mock('../../../src/commands/commandProcessor.js', () => ({__esModule: true, default: jest.fn()}));
jest.mock('../../../src/turns/order/turnOrderService.js', () => ({__esModule: true, TurnOrderService: jest.fn()}));
// PlayerPromptService is now instantiated by its factory, so we mock its constructor.
// The factory for IPlayerPromptService will `new PlayerPromptService(...)`.
jest.mock('../../../src/turns/services/playerPromptService.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockPlayerPromptServiceInstance)
}));


// --- Import AFTER mocking ---
import {
    TargetResolutionService as MockedTargetResolutionService
} from "../../../src/services/targetResolutionService.js";
import {ActionValidationContextBuilder} from "../../../src/services/actionValidationContextBuilder.js";
import {PrerequisiteEvaluationService} from "../../../src/services/prerequisiteEvaluationService.js";
import {DomainContextCompatibilityChecker} from "../../../src/validation/domainContextCompatibilityChecker.js";
import {ActionValidationService} from "../../../src/services/actionValidationService.js";
import CommandParser from "../../../src/commands/commandParser.js";
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import WorldContext from '../../../src/context/worldContext.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import {TurnOrderService} from '../../../src/turns/order/turnOrderService.js';
import PlayerPromptService from '../../../src/turns/services/playerPromptService.js'; // This is the mocked constructor

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEntityManager = {
    getComponent: jest.fn(),
    hasComponent: jest.fn(),
    getEntity: jest.fn(),
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn()
};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn()};
const mockSafeEventDispatcher = {dispatchSafely: jest.fn(), subscribe: jest.fn()};
const mockGameDataRepository = {getActionDefinition: jest.fn(), getRule: jest.fn(), getAllActionDefinitions: jest.fn()};
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
            // Fallbacks for dependencies NOT registered by registerDomainServices itself,
            // but are expected to be in the container from other registration modules.
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.EventBus) return mockEventBus;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.ISafeEventDispatcher) return mockSafeEventDispatcher;
            // These should ideally be caught if not pre-registered in beforeEach for the test context
            if (token === tokens.IEntityManager) return mockEntityManager;
            if (token === tokens.IGameDataRepository) return mockGameDataRepository;
            if (token === tokens.IPlayerPromptService) return mockPlayerPromptServiceInstance;

            if (token === tokens.ICommandParser) return mockCommandParserInstance;
            if (token === tokens.IActionDiscoverySystem) return mockActionDiscoverySystemInstance;
            if (token === tokens.IPromptOutputPort) return mockPromptOutputPortInstance;
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
            && options?.hasOwnProperty('dependencies');
        const isFactoryFunction = typeof factoryOrValueOrClass === 'function' && !isClassRegistration;

        if (isClassRegistration) {
            const ClassConstructor = factoryOrValueOrClass;
            const deps = Array.isArray(options.dependencies) ? options.dependencies : [];
            const resolvedContainer = containerInstance;
            const dependenciesMap = {};
            const dependencyArgs = [];
            const targetClassName = ClassConstructor.name || '[AnonymousMockClass]';
            let expectsOptionsObject = false;

            deps.forEach((depTokenOrConfig) => {
                let depToken = depTokenOrConfig;
                let propName;
                if (typeof depTokenOrConfig === 'object' && depTokenOrConfig.token) {
                    depToken = depTokenOrConfig.token;
                    propName = depTokenOrConfig.propName;
                    expectsOptionsObject = true;
                } else {
                    propName = String(depToken);
                    if (propName.length > 1 && propName.startsWith('I') && propName[1] === propName[1].toUpperCase()) propName = propName.substring(1);
                    propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                }
                try {
                    const resolvedDep = resolvedContainer.resolve(depToken);
                    if (expectsOptionsObject || propName) {
                        dependenciesMap[propName] = resolvedDep;
                    }
                    dependencyArgs.push(resolvedDep);
                } catch (e) {
                    console.error(`[Mock Resolve - Class Dep Error] Failed to resolve dependency "${String(depToken)}" (for prop "${propName}") needed by "${targetClassName}" (${tokenString})`, e);
                    throw new Error(`Failed dependency resolution for "${targetClassName}": ${e.message}`, {cause: e});
                }
            });
            try {
                if (jest.isMockFunction(ClassConstructor) && !ClassConstructor.prototype?.constructor) {
                    instance = ClassConstructor();
                } else if (ClassConstructor.prototype && ClassConstructor.prototype.constructor === ClassConstructor) {
                    instance = new ClassConstructor(dependenciesMap);
                } else {
                    instance = ClassConstructor(dependenciesMap);
                }
            } catch (constructorError) {
                console.error(`[Mock Resolve - Class Instantiation Error] Constructor error for mocked "${targetClassName}" (${tokenString})`, constructorError);
                throw new Error(`Error constructing mock for ${targetClassName}: ${constructorError.message}`, {cause: constructorError});
            }
        } else if (isFactoryFunction) {
            try {
                instance = factoryOrValueOrClass(containerInstance);
            } catch (factoryError) {
                console.error(`[Mock Resolve - Factory Execution Error] Error executing factory for ${tokenString}:`, factoryError);
                throw factoryError;
            }
        } else {
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
        // These represent dependencies that would be registered by other modules (e.g., infrastructure)
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IEntityManager, mockEntityManager, {lifecycle: 'singleton'}); // Use Interface Token
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ISafeEventDispatcher, mockSafeEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IGameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'}); // Use Interface Token
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ICommandParser, mockCommandParserInstance, {lifecycle: 'singleton'}); // For CommandProcessor factory
        mockContainer.register(tokens.IActionDiscoverySystem, mockActionDiscoverySystemInstance, {lifecycle: 'singleton'}); // For PlayerPromptService factory
        mockContainer.register(tokens.IPromptOutputPort, mockPromptOutputPortInstance, {lifecycle: 'singleton'}); // For PlayerPromptService factory
        mockContainer.register(tokens.IWorldContext, mockWorldContextInstance, {lifecycle: 'singleton'}); // For factories
        mockContainer.register(tokens.TargetResolutionService, mockTargetResolutionServiceInstance, {lifecycle: 'singleton'}); // For CommandProcessor factory
        // PlayerPromptService (concrete) is no longer pre-registered; IPlayerPromptService will be registered by SUT.


        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();

        MockedTargetResolutionService.mockClear();
        ActionValidationContextBuilder.mockClear();
        PrerequisiteEvaluationService.mockClear();
        DomainContextCompatibilityChecker.mockClear();
        ActionValidationService.mockClear();
        CommandParser.mockClear();
        JsonLogicEvaluationService.mockClear();
        WorldContext.mockClear();
        CommandProcessor.mockClear();
        TurnOrderService.mockClear();
        PlayerPromptService.mockClear(); // This is the mocked constructor for the concrete class

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
        Object.values(mockPlayerPromptServiceInstance).forEach(fn => fn.mockClear?.());
    });

    it('should register domain services without throwing errors', () => {
        expect(() => {
            registerDomainServices(mockContainer);
        }).not.toThrow();

        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.TargetResolutionService,
            expect.any(Function),
            expect.objectContaining({lifecycle: 'singletonFactory'})
        );
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.JsonLogicEvaluationService, JsonLogicEvaluationService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [tokens.ILogger]
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionValidationContextBuilder, ActionValidationContextBuilder, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [tokens.IEntityManager, tokens.ILogger] // Verify IEntityManager
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PrerequisiteEvaluationService, PrerequisiteEvaluationService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [tokens.ILogger, tokens.JsonLogicEvaluationService, tokens.ActionValidationContextBuilder]
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.DomainContextCompatibilityChecker, DomainContextCompatibilityChecker, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [tokens.ILogger]
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionValidationService, ActionValidationService, expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [tokens.IEntityManager, tokens.ILogger, tokens.DomainContextCompatibilityChecker, tokens.PrerequisiteEvaluationService] // Verify IEntityManager
        }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.IWorldContext, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ICommandParser, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ICommandProcessor, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ITurnOrderService, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        // MODIFIED: Expect IPlayerPromptService token
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.IPlayerPromptService, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
    });

    it('resolving CommandProcessor does not throw and returns instance', () => {
        registerDomainServices(mockContainer);
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.ICommandProcessor);
        }).not.toThrow();

        expect(resolvedService).toBeDefined();
        expect(CommandProcessor).toHaveBeenCalledTimes(1);
        expect(CommandProcessor).toHaveBeenCalledWith(expect.objectContaining({
            commandParser: mockCommandParserInstance,
            targetResolutionService: mockTargetResolutionServiceInstance,
            logger: mockLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            safeEventDispatcher: mockSafeEventDispatcher,
            worldContext: mockWorldContextInstance,
            entityManager: mockEntityManager, // Factory resolves IEntityManager to mockEntityManager
            gameDataRepository: mockGameDataRepository // Factory resolves IGameDataRepository to mockGameDataRepository
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
            // MODIFIED: Resolve IPlayerPromptService token
            resolvedService = mockContainer.resolve(tokens.IPlayerPromptService);
        }).not.toThrow();

        expect(resolvedService).toBeDefined();
        // PlayerPromptService is the mocked constructor for the concrete class
        expect(PlayerPromptService).toHaveBeenCalledTimes(1);
        expect(PlayerPromptService).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystemInstance,
            promptOutputPort: mockPromptOutputPortInstance,
            worldContext: mockWorldContextInstance,
            entityManager: mockEntityManager, // Factory resolves IEntityManager to mockEntityManager
            gameDataRepository: mockGameDataRepository // Factory resolves IGameDataRepository to mockGameDataRepository
        }));
        // The instance returned by resolve should be the one from the mocked PlayerPromptService constructor
        expect(resolvedService).toBe(mockPlayerPromptServiceInstance);
    });
});