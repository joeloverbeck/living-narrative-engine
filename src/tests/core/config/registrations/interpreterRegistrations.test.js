// src/tests/core/config/registrations/interpreterRegistrations.test.js
// ****** CORRECTED FILE (Removed All DOM/UI Handlers/Services) ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
/** @typedef {import('../../../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../../../logic/operationRegistry.js').default} OperationRegistry */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// --- VVVVV Imports removed VVVVV ---
// /** @typedef {import('../../../../domUI/IDomMutationService.js').IDomMutationService} IDomMutationService */ // REMOVED
// /** @typedef {import('../../../../domUI/uiMessageRenderer.js').UiMessageRenderer} UiMessageRenderer */ // REMOVED (Assuming no other registered handler needs it)
// --- ^^^^^ Imports removed ^^^^^ ---
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerInterpreters} from '../../../../core/config/registrations/interpreterRegistrations.js';

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js'; // Now Corrected

// --- Mock Modules ---
jest.mock('../../../../logic/operationRegistry.js');
jest.mock('../../../../logic/operationInterpreter.js');
jest.mock('../../../../logic/systemLogicInterpreter.js');
jest.mock('../../../../logic/operationHandlers/dispatchEventHandler.js');
jest.mock('../../../../logic/operationHandlers/logHandler.js');
jest.mock('../../../../logic/operationHandlers/modifyComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/addComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/removeComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/queryComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/setVariableHandler.js');
jest.mock('../../../../logic/operationHandlers/querySystemDataHandler.js');
// Mocks for ModifyDomElementHandler and AppendUiMessageHandler already removed

// --- Import AFTER mocking ---
import OperationRegistry from '../../../../logic/operationRegistry.js';
import OperationInterpreter from '../../../../logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../../logic/systemLogicInterpreter.js';
import DispatchEventHandler from '../../../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../../../logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../../../logic/operationHandlers/addComponentHandler.js';
import RemoveComponentHandler from '../../../../logic/operationHandlers/removeComponentHandler.js';
import QueryComponentHandler from '../../../../logic/operationHandlers/queryComponentHandler.js';
import SetVariableHandler from '../../../../logic/operationHandlers/setVariableHandler.js';
import QuerySystemDataHandler from '../../../../logic/operationHandlers/querySystemDataHandler.js';
// Imports for ModifyDomElementHandler and AppendUiMessageHandler already removed

// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), publish: jest.fn(), unsubscribe: jest.fn()};
const mockDataRegistry = {getAllSystemRules: jest.fn().mockReturnValue([])};
const mockJsonLogicService = {evaluate: jest.fn(), addOperation: jest.fn()};
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    getComponentData: jest.fn(),
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
    hasComponent: jest.fn()
};
const mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
const mockSystemDataRegistry = {query: jest.fn(), registerSource: jest.fn()};
// --- VVVVV Mocks removed VVVVV ---
// const mockDomMutationService = {mutate: jest.fn()}; // REMOVED
// const mockUiMessageRenderer = {render: jest.fn()}; // REMOVED (Assuming no handler needs it)
// --- ^^^^^ Mocks removed ^^^^^ ---

// --- Mock DI Container ---
const createMockContainer = () => {
    const registrations = new Map();
    /** @type {AppContainer} */
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            console.log(`[Mock Register] Called. Token type: ${typeof token}, Token value: ${String(token)}`, {options});
            if (token && typeof token !== 'string' && typeof token !== 'symbol') {
                console.warn(`[Mock Register] Received non-standard token type: ${typeof token}`, token);
            }
            if (!token) {
                console.error('[Mock Register] ERROR: Token is falsy!', token);
                throw new Error('Mock Register Error: Token is required.');
            }
            registrations.set(token, {factoryOrValue, options, instance: undefined});
        }),
        resolve: jest.fn((token) => {
            console.log(`[Mock Resolve] Attempting to resolve token: ${String(token)}`);
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(t => String(t)).join(', ');
                console.error(`[Mock Resolve] ERROR: Token not registered: ${String(token)}. Registered: [${registeredTokens}]`);
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }
            const {factoryOrValue, options} = registration;
            const tokenStr = String(token);
            if (options?.lifecycle === 'singleton' || options?.lifecycle === 'singletonFactory') {
                if (registration.instance !== undefined) {
                    console.log(`[Mock Resolve] Returning cached singleton instance for: ${tokenStr}`);
                    return registration.instance;
                }
                console.log(`[Mock Resolve] Creating singleton instance for: ${tokenStr}`);
                if (typeof factoryOrValue === 'function') {
                    try {
                        registration.instance = factoryOrValue(container);
                        console.log(`[Mock Resolve] Successfully created singleton instance for: ${tokenStr}`);
                    } catch (e) {
                        console.error(`[Mock Resolve] ERROR executing factory during singleton resolve for ${tokenStr}: ${e.message}`, e);
                        throw new Error(`Factory error during mock resolve for ${tokenStr}: ${e.message}`, {cause: e});
                    }
                } else {
                    registration.instance = factoryOrValue;
                    console.log(`[Mock Resolve] Caching direct value as singleton instance for: ${tokenStr}`);
                }
                return registration.instance;
            }
            console.log(`[Mock Resolve] Creating transient instance/value for: ${tokenStr}`);
            if (typeof factoryOrValue === 'function') {
                try {
                    const transientInstance = factoryOrValue(container);
                    console.log(`[Mock Resolve] Successfully created transient instance for: ${tokenStr}`);
                    return transientInstance;
                } catch (e) {
                    console.error(`[Mock Resolve] ERROR executing transient factory during resolve for ${tokenStr}: ${e.message}`, e);
                    throw new Error(`Transient factory error during mock resolve for ${tokenStr}: ${e.message}`, {cause: e});
                }
            }
            console.log(`[Mock Resolve] Returning direct transient value for: ${tokenStr}`);
            return factoryOrValue;
        }),
    };
    return container;
};


describe('registerInterpreters', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContainer = createMockContainer();

        // Pre-register core dependencies NEEDED by the interpreter factories
        // These are the services the factories themselves will resolve.
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IDataRegistry, mockDataRegistry, {lifecycle: 'singleton'});
        mockContainer.register(tokens.JsonLogicEvaluationService, mockJsonLogicService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.SystemDataRegistry, mockSystemDataRegistry, {lifecycle: 'singleton'});
        // --- VVVVV Pre-registrations removed VVVVV ---
        // mockContainer.register(tokens.IDomMutationService, mockDomMutationService, {lifecycle: 'singleton'}); // REMOVED
        // mockContainer.register(tokens.UiMessageRenderer, mockUiMessageRenderer, {lifecycle: 'singleton'}); // REMOVED (Assuming no handler needs it)
        // --- ^^^^^ Pre-registrations removed ^^^^^ ---

        // Clear implementation mocks
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockEventBus).forEach(fn => fn.mockClear?.());
        Object.values(mockDataRegistry).forEach(fn => fn.mockClear?.());
        Object.values(mockJsonLogicService).forEach(fn => fn.mockClear?.());
        Object.values(mockEntityManager).forEach(fn => fn.mockClear?.());
        Object.values(mockvalidatedEventDispatcher).forEach(fn => fn.mockClear?.());
        Object.values(mockSystemDataRegistry).forEach(fn => fn.mockClear?.());
        // --- VVVVV Mock clears removed VVVVV ---
        // Object.values(mockDomMutationService).forEach(fn => fn.mockClear?.()); // REMOVED
        // mockUiMessageRenderer.render.mockClear?.(); // REMOVED
        // --- ^^^^^ Mock clears removed ^^^^^ ---

        // Clear constructor mocks defined via jest.mock() for USED handlers/interpreters
        OperationRegistry.mockClear?.();
        if (OperationRegistry.mock?.instances) {
            OperationRegistry.mock.instances.forEach(inst => {
                if (inst?.register?.mockClear) inst.register.mockClear();
            });
        }
        OperationInterpreter.mockClear?.();
        SystemLogicInterpreter.mockClear?.();
        DispatchEventHandler.mockClear?.();
        LogHandler.mockClear?.();
        ModifyComponentHandler.mockClear?.();
        AddComponentHandler.mockClear?.();
        RemoveComponentHandler.mockClear?.();
        QueryComponentHandler.mockClear?.();
        SetVariableHandler.mockClear?.();
        QuerySystemDataHandler.mockClear?.();
        // Clear calls for ModifyDomElementHandler and AppendUiMessageHandler already removed

    }); // End beforeEach

    // --- Tests ---

    it('should register required services without throwing errors', () => {
        expect(() => registerInterpreters(mockContainer)).not.toThrow();

        // Assertions for currently registered handlers and interpreters
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.DispatchEventHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.LogHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ModifyComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.AddComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.RemoveComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.QueryComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.SetVariableHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.QuerySystemDataHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.OperationRegistry, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.OperationInterpreter, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.SystemLogicInterpreter, expect.any(Function), expect.objectContaining({
            lifecycle: 'singletonFactory',
            tags: expect.arrayContaining(['Initializable', 'Shutdownable'])
        }));

        // Explicitly check that removed handlers are NOT registered
        expect(mockContainer.register).not.toHaveBeenCalledWith(tokens.ModifyDomElementHandler, expect.any(Function), expect.anything());
        expect(mockContainer.register).not.toHaveBeenCalledWith(tokens.AppendUiMessageHandler, expect.any(Function), expect.anything());
    });

    it('resolving SystemLogicInterpreter does not throw', () => {
        registerInterpreters(mockContainer);
        let resolved;
        expect(() => {
            resolved = mockContainer.resolve(tokens.SystemLogicInterpreter);
        }).not.toThrow();
        expect(resolved).toBeDefined();
        expect(SystemLogicInterpreter).toHaveBeenCalledTimes(1);
        expect(SystemLogicInterpreter).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger,
            eventBus: mockEventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicService,
            entityManager: mockEntityManager,
            operationInterpreter: expect.anything()
        }));
    });

    it('resolving OperationInterpreter does not throw', () => {
        registerInterpreters(mockContainer);
        let resolved;
        expect(() => {
            resolved = mockContainer.resolve(tokens.OperationInterpreter);
        }).not.toThrow();
        expect(resolved).toBeDefined();
        expect(OperationInterpreter).toHaveBeenCalledTimes(1);
        expect(OperationInterpreter).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger,
            operationRegistry: expect.anything()
        }));
    });

    it('resolving OperationRegistry does not throw and its factory registers handlers', () => {
        registerInterpreters(mockContainer);
        let registry;
        expect(() => {
            registry = mockContainer.resolve(tokens.OperationRegistry);
        }).not.toThrow();
        expect(registry).toBeDefined();
        expect(OperationRegistry).toHaveBeenCalledTimes(1);

        const mockInstance = OperationRegistry.mock.instances[0];
        expect(mockInstance).toBeDefined();
        expect(mockInstance.register).toHaveBeenCalledWith('DISPATCH_EVENT', expect.any(Function));
        expect(mockInstance.register).toHaveBeenCalledWith('LOG', expect.any(Function));
        expect(mockInstance.register).toHaveBeenCalledWith('MODIFY_COMPONENT', expect.any(Function));
        expect(mockInstance.register).toHaveBeenCalledWith('ADD_COMPONENT', expect.any(Function));
        expect(mockInstance.register).toHaveBeenCalledWith('REMOVE_COMPONENT', expect.any(Function));
        expect(mockInstance.register).toHaveBeenCalledWith('QUERY_COMPONENT', expect.any(Function));
        expect(mockInstance.register).toHaveBeenCalledWith('SET_VARIABLE', expect.any(Function));
        expect(mockInstance.register).toHaveBeenCalledWith('QUERY_SYSTEM_DATA', expect.any(Function));

        // Ensure removed handlers weren't called
        expect(mockInstance.register).not.toHaveBeenCalledWith('MODIFY_DOM_ELEMENT', expect.any(Function));
        expect(mockInstance.register).not.toHaveBeenCalledWith('APPEND_UI_MESSAGE', expect.any(Function));
    });

    it('interpreters are registered as singletons', () => {
        registerInterpreters(mockContainer);

        const r1 = mockContainer.resolve(tokens.OperationRegistry);
        const r2 = mockContainer.resolve(tokens.OperationRegistry);
        expect(r1).toBe(r2);
        expect(OperationRegistry).toHaveBeenCalledTimes(1);

        const i1 = mockContainer.resolve(tokens.OperationInterpreter);
        const i2 = mockContainer.resolve(tokens.OperationInterpreter);
        expect(i1).toBe(i2);
        expect(OperationInterpreter).toHaveBeenCalledTimes(1);

        const s1 = mockContainer.resolve(tokens.SystemLogicInterpreter);
        const s2 = mockContainer.resolve(tokens.SystemLogicInterpreter);
        expect(s1).toBe(s2);
        expect(SystemLogicInterpreter).toHaveBeenCalledTimes(1);
    });

    it('resolving SetVariableHandler does not throw', () => {
        registerInterpreters(mockContainer);
        let handler;
        expect(() => {
            handler = mockContainer.resolve(tokens.SetVariableHandler);
        }).not.toThrow();
        expect(handler).toBeDefined();
        expect(SetVariableHandler).toHaveBeenCalledTimes(1);
        expect(SetVariableHandler).toHaveBeenCalledWith(expect.objectContaining({logger: mockLogger}));
    });

    it('resolving QuerySystemDataHandler does not throw', () => {
        registerInterpreters(mockContainer);
        let handler;
        expect(() => {
            handler = mockContainer.resolve(tokens.QuerySystemDataHandler);
        }).not.toThrow();
        expect(handler).toBeDefined();
        expect(QuerySystemDataHandler).toHaveBeenCalledTimes(1);
        expect(QuerySystemDataHandler).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger,
            systemDataRegistry: mockSystemDataRegistry
        }));
    });

    // Tests for AppendUiMessageHandler and ModifyDomElementHandler are now removed.

}); // End describe