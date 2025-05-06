// src/tests/core/config/registrations/domainServicesRegistrations.test.js
// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Assuming concrete class if needed
/** @typedef {import('../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../../../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../../../../services/actionValidationService.js').ActionValidationService} ActionValidationService */ // Use concrete class for mock
/** @typedef {import('../../../../services/payloadValueResolverService.js').default} PayloadValueResolverService */
/** @typedef {import('../../../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../../core/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */ // <<< ADDED
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
const mockTargetResolutionServiceInstance = { resolveActionTarget: jest.fn() };
const mockWorldContextInstance = { getLocationOfEntity: jest.fn() };
const mockCommandParserInstance = { parse: jest.fn() };
const mockActionDiscoverySystemInstance = { getValidActions: jest.fn() };
const mockPromptOutputPortInstance = { prompt: jest.fn() };
const mockActionValidationServiceInstance = { validateAction: jest.fn() };
const mockPayloadValueResolverServiceInstance = { resolveValue: jest.fn() };
const mockJsonLogicServiceInstance = {};

// --- MOCK the Modules Directly Inline ---
jest.mock('../../../../services/conditionEvaluationService.js', () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../../../services/itemTargetResolver.js", () => ({ __esModule: true, ItemTargetResolverService: jest.fn() }));
jest.mock("../../../../services/targetResolutionService.js", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        return mockTargetResolutionServiceInstance;
    }),
    ResolutionStatus: {
        FOUND_UNIQUE: 'FOUND_UNIQUE',
        NONE: 'NONE',
        SELF: 'SELF',
        AMBIGUOUS: 'AMBIGUOUS',
        NOT_FOUND: 'NOT_FOUND',
        INVALID_DOMAIN: 'INVALID_DOMAIN',
        FAILED: 'FAILED',
    }
}));
jest.mock("../../../../services/actionValidationContextBuilder.js", () => ({ __esModule: true, ActionValidationContextBuilder: jest.fn() }));
jest.mock("../../../../services/prerequisiteEvaluationService.js", () => ({ __esModule: true, PrerequisiteEvaluationService: jest.fn() }));
jest.mock("../../../../validation/domainContextCompatibilityChecker.js", () => ({ __esModule: true, DomainContextCompatibilityChecker: jest.fn() }));
jest.mock("../../../../services/actionValidationService.js", () => ({ __esModule: true, ActionValidationService: jest.fn().mockImplementation(() => mockActionValidationServiceInstance)}));
jest.mock("../../../../services/payloadValueResolverService.js", () => ({ __esModule: true, default: jest.fn().mockImplementation(() => mockPayloadValueResolverServiceInstance)}));
jest.mock("../../../../core/commandParser.js", () => ({ __esModule: true, default: jest.fn().mockImplementation(() => mockCommandParserInstance)}));
jest.mock('../../../../logic/jsonLogicEvaluationService.js', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => mockJsonLogicServiceInstance)}));
jest.mock('../../../../core/worldContext.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        return mockWorldContextInstance;
    })
}));
jest.mock('../../../../core/commandProcessor.js', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../../core/turnOrder/turnOrderService.js', () => ({ __esModule: true, TurnOrderService: jest.fn() }));
jest.mock('../../../../core/services/playerPromptService.js', () => ({ __esModule: true, default: jest.fn() }));

// --- Import AFTER mocking ---
import ConditionEvaluationService from '../../../../services/conditionEvaluationService.js';
import {ItemTargetResolverService} from "../../../../services/itemTargetResolver.js";
import TargetResolutionService from "../../../../services/targetResolutionService.js";
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
const mockEntityManager = {getComponent: jest.fn(), hasComponent: jest.fn(), getEntity: jest.fn(), getEntityInstance: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn()};
const mockSafeEventDispatcher = { dispatchSafely: jest.fn() }; // <<< ADDED
const mockGameDataRepository = {getActionDefinition: jest.fn(), getRule: jest.fn()};
const mockEventBus = {dispatch: jest.fn(), subscribe: jest.fn()};


const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance;

    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        const tokenString = String(token);
        if (!token) {
            console.error('[Mock Register ERROR] Falsy token received!', { token, factoryOrValueOrClass, options });
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
            if (token === tokens.ISafeEventDispatcher) return mockSafeEventDispatcher; // <<< ADDED FALLBACK
            if (token === tokens.EntityManager) return mockEntityManager;
            if (token === tokens.GameDataRepository) return mockGameDataRepository;
            if (token === tokens.ICommandParser) return mockCommandParserInstance;
            if (token === tokens.IActionDiscoverySystem) return mockActionDiscoverySystemInstance;
            if (token === tokens.IPromptOutputPort) return mockPromptOutputPortInstance;

            const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
            console.error(`[Mock Resolve Error] Token not registered or explicitly mocked via fallback: ${tokenString}. Registered: [${registeredTokens}]`);
            throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}. Registered: [${registeredTokens}]`);
        }

        const { registration: factoryOrValueOrClass, options } = registrationData;
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
            const targetClassName = ClassConstructor.name || '[AnonymousMockClass]';

            deps.forEach((depToken) => {
                let propName = String(depToken);
                if (propName.length > 1 && propName.startsWith('I') && propName[1] === propName[1].toUpperCase()) propName = propName.substring(1);
                propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                try {
                    dependenciesMap[propName] = resolvedContainer.resolve(depToken);
                } catch (e) {
                    console.error(`[Mock Resolve - Class Dep Error] Failed to resolve dependency "${String(depToken)}" (for prop "${propName}") needed by "${targetClassName}" (${tokenString})`, e);
                    throw new Error(`Failed dependency resolution for "${targetClassName}": ${e.message}`, { cause: e });
                }
            });
            try {
                if (ClassConstructor.prototype && ClassConstructor.prototype.constructor === ClassConstructor) {
                    instance = new ClassConstructor(dependenciesMap);
                } else {
                    instance = ClassConstructor(dependenciesMap);
                }
            } catch (constructorError) {
                console.error(`[Mock Resolve - Class Instantiation Error] Constructor error for mocked "${targetClassName}" (${tokenString})`, constructorError);
                throw new Error(`Error constructing mock for ${targetClassName}: ${constructorError.message}`, { cause: constructorError });
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
        resolveByTag: jest.fn((tag) => {
            const resolved = [];
            registrations.forEach((regData, token) => {
                if (regData.options?.tags?.includes(tag)) {
                    try {
                        resolved.push(containerInstance.resolve(token));
                    } catch (e) {
                        console.warn(`[Mock resolveByTag] Failed to resolve tagged instance ${String(token)} for tag "${tag}"`, e);
                    }
                }
            });
            return resolved;
        }),
        disposeSingletons: jest.fn(() => instances.clear()),
        reset: jest.fn(() => {
            registrations.clear();
            instances.clear();
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

        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        // mockContainer.register(tokens.ISafeEventDispatcher, mockSafeEventDispatcher, {lifecycle: 'singleton'}); // Not strictly needed due to fallback
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ICommandParser, mockCommandParserInstance, { lifecycle: 'singleton' });
        mockContainer.register(tokens.IActionDiscoverySystem, mockActionDiscoverySystemInstance, { lifecycle: 'singleton' });
        mockContainer.register(tokens.IPromptOutputPort, mockPromptOutputPortInstance, { lifecycle: 'singleton' });

        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();

        ConditionEvaluationService.mockClear();
        ItemTargetResolverService.mockClear();
        TargetResolutionService.mockClear();
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
        Object.values(mockSafeEventDispatcher).forEach(fn => fn.mockClear?.()); // <<< ADDED CLEAR
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

        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ConditionEvaluationService, ConditionEvaluationService, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ItemTargetResolverService, ItemTargetResolverService, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.TargetResolutionService, TargetResolutionService, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.JsonLogicEvaluationService, JsonLogicEvaluationService, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionValidationContextBuilder, ActionValidationContextBuilder, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PrerequisiteEvaluationService, PrerequisiteEvaluationService, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.DomainContextCompatibilityChecker, DomainContextCompatibilityChecker, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionValidationService, ActionValidationService, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PayloadValueResolverService, PayloadValueResolverService, expect.objectContaining({ lifecycle: 'singleton', dependencies: expect.any(Array) }));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.IWorldContext, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ICommandParser, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ICommandProcessor, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ITurnOrderService, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PlayerPromptService, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
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
            safeEventDispatcher: mockSafeEventDispatcher, // <<< ADDED ASSERTION
            worldContext: mockWorldContextInstance,
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
            worldContext: mockWorldContextInstance,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository
        }));
    });
});