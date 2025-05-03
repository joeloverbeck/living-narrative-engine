// src/tests/core/config/registrations/interpreterRegistrations.test.js

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
/** @typedef {import('../../../../domUI/domRenderer.js').default} DomRenderer */ // Added for DomRenderer type hinting
/** @typedef {any} AppContainer */ // Using 'any' as the custom container type isn't defined

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerInterpreters} from '../../../../core/config/registrations/interpreterRegistrations.js'; // Adjust path if needed

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';

// --- MOCK the Modules to prevent constructor errors and simplify testing ---
// Mock the core services that SystemLogicInterpreter and its dependencies need
jest.mock('../../../../logic/operationRegistry.js');
jest.mock('../../../../logic/operationInterpreter.js');
jest.mock('../../../../logic/systemLogicInterpreter.js');
// Mock the handlers (we don't need their internal logic for this test)
jest.mock('../../../../logic/operationHandlers/dispatchEventHandler.js');
jest.mock('../../../../logic/operationHandlers/logHandler.js');
jest.mock('../../../../logic/operationHandlers/modifyComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/addComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/removeComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/queryComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/modifyDomElementHandler.js');
jest.mock('../../../../logic/operationHandlers/appendUiMessageHandler.js');
jest.mock('../../../../logic/operationHandlers/setVariableHandler.js');
jest.mock('../../../../logic/operationHandlers/querySystemDataHandler.js');


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
import ModifyDomElementHandler from '../../../../logic/operationHandlers/modifyDomElementHandler.js';
import AppendUiMessageHandler from '../../../../logic/operationHandlers/appendUiMessageHandler.js';
import SetVariableHandler from '../../../../logic/operationHandlers/setVariableHandler.js';
import QuerySystemDataHandler from '../../../../logic/operationHandlers/querySystemDataHandler.js';


// --- Mock Implementations (Core Services) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), publish: jest.fn(), unsubscribe: jest.fn()}; // Added unsubscribe for SLI shutdown test if needed
const mockDataRegistry = {getAllSystemRules: jest.fn().mockReturnValue([])}; // SLI needs this method
const mockJsonLogicService = {evaluate: jest.fn(), addOperation: jest.fn()};
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    getComponentData: jest.fn(),
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
    hasComponent: jest.fn()
};
const mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)}; // Needed by DispatchEventHandler factory
const mockSystemDataRegistry = {
    query: jest.fn(),
    registerSource: jest.fn()
};
// DR-01.7: Pre-register tokens.DomRenderer dummy
const mockDomRenderer = {renderMessage: jest.fn(), mutate: jest.fn()};


// --- Mock Custom DI Container (Copied from uiRegistrations.test.js) ---
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            // Store the registration details including lifecycle
            registrations.set(token, {factoryOrValue, options, instance: undefined});

            // --- Refined Simulation ---
            // Let's *not* execute the factory immediately here. The original Awilix behavior
            // is lazy execution on first resolve for singletons. Simulating that in resolve
            // is more accurate and less prone to dependency order issues during registration.
            // We only store the value directly if it's not a function and lifecycle is 'singleton'
            const registration = registrations.get(token);
            if (options?.lifecycle === 'singleton' && typeof factoryOrValue !== 'function') {
                registration.instance = factoryOrValue;
            }
        }),
        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;
            const tokenStr = String(token); // For error messages

            // ****** FIX 2: Handle 'singleton' and 'singletonFactory' lifecycles ******
            if (options?.lifecycle === 'singleton' || options?.lifecycle === 'singletonFactory') {
                // If an instance already exists, return it
                if (registration.instance !== undefined) {
                    // console.debug(`Mock Resolve: Returning existing singleton instance for ${tokenStr}`);
                    return registration.instance;
                }

                // If it's a factory function, execute it *once* to create the instance
                if (typeof factoryOrValue === 'function') {
                    // console.debug(`Mock Resolve: Creating singleton instance via factory for ${tokenStr}`);
                    try {
                        // Store the created instance back *before* returning
                        registration.instance = factoryOrValue(container); // Pass container
                    } catch (e) {
                        console.error(`Mock container: Error executing factory during singleton resolve for ${tokenStr}: ${e.message}`, e);
                        throw e; // Re-throw resolve errors
                    }
                } else {
                    // If it was registered as a value (and somehow instance wasn't set in register), set it now.
                    // This case should ideally be covered by the register logic adjustment.
                    // console.debug(`Mock Resolve: Returning singleton value for ${tokenStr}`);
                    registration.instance = factoryOrValue;
                }
                return registration.instance; // Return the newly created or existing instance
            }

            // --- Transient or other lifecycles ---
            // console.debug(`Mock Resolve: Executing transient factory/returning value for ${tokenStr}`);
            if (typeof factoryOrValue === 'function') {
                try {
                    return factoryOrValue(container); // Execute factory every time
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${tokenStr}: ${e.message}`, e);
                    throw e; // Re-throw resolve errors
                }
            }
            return factoryOrValue; // Return value directly for non-functions/non-singletons
        }),
    };
    return container;
};


describe('registerInterpreters', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        // Reset mocks defined via jest.mock
        jest.clearAllMocks();

        mockContainer = createMockContainer();

        // Pre-register MOCKED core dependencies required by the interpreters and handlers
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IDataRegistry, mockDataRegistry, {lifecycle: 'singleton'});
        mockContainer.register(tokens.JsonLogicEvaluationService, mockJsonLogicService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.SystemDataRegistry, mockSystemDataRegistry, {lifecycle: 'singleton'});
        // DR-01.7: Register the DomRenderer dummy
        mockContainer.register(tokens.DomRenderer, mockDomRenderer, {lifecycle: 'singleton'});


        // Clear call counts on the mock service functions
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockEventBus).forEach(fn => fn.mockClear?.());
        Object.values(mockDataRegistry).forEach(fn => fn.mockClear?.());
        Object.values(mockJsonLogicService).forEach(fn => fn.mockClear?.());
        Object.values(mockEntityManager).forEach(fn => fn.mockClear?.());
        Object.values(mockvalidatedEventDispatcher).forEach(fn => fn.mockClear?.());
        Object.values(mockSystemDataRegistry).forEach(fn => fn.mockClear?.());
        // DR-01.7: Clear DomRenderer mock calls
        Object.values(mockDomRenderer).forEach(fn => fn.mockClear?.());

        // Clear call counts on the MOCKED Class constructors
        OperationRegistry.mockClear();
        OperationInterpreter.mockClear();
        SystemLogicInterpreter.mockClear();
        DispatchEventHandler.mockClear();
        LogHandler.mockClear();
        ModifyComponentHandler.mockClear();
        AddComponentHandler.mockClear();
        RemoveComponentHandler.mockClear();
        QueryComponentHandler.mockClear();
        ModifyDomElementHandler.mockClear();
        AppendUiMessageHandler.mockClear();
        SetVariableHandler.mockClear();
        QuerySystemDataHandler.mockClear();
    });

    it('should register required services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerInterpreters(mockContainer);
        }).not.toThrow();

        // ****** FIX 1: Assert using the correct 'singletonFactory' lifecycle ******
        // Assert registration calls (optional but good sanity check)
        // Handlers (registered via singletonFactory)
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.DispatchEventHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.LogHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ModifyComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.AddComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.RemoveComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.QueryComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ModifyDomElementHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.AppendUiMessageHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.SetVariableHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.QuerySystemDataHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));

        // Core interpreters/registry (registered via singletonFactory)
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.OperationRegistry, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.OperationInterpreter, expect.any(Function), expect.objectContaining({lifecycle: 'singletonFactory'}));
        // SystemLogicInterpreter might have tags, check for lifecycle specifically
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.SystemLogicInterpreter,
            expect.any(Function),
            expect.objectContaining({lifecycle: 'singletonFactory'}) // Check lifecycle specifically
            // expect.objectContaining({lifecycle: 'singletonFactory', tags: expect.arrayContaining(['initializable', 'shutdownable'])}) // More specific if needed
        );
    });


    it('resolving SystemLogicInterpreter does not throw', () => {
        // Arrange
        registerInterpreters(mockContainer);

        // Act & Assert
        let resolvedInterpreter;
        expect(() => {
            resolvedInterpreter = mockContainer.resolve(tokens.SystemLogicInterpreter);
        }).not.toThrow();

        // Assert
        expect(resolvedInterpreter).toBeDefined();
        // With the corrected mock container, the factory should be called only once on the first resolve.
        expect(SystemLogicInterpreter).toHaveBeenCalledTimes(1);

        // Verify dependencies were passed correctly (using the mocked constructor call)
        // The mock container now executes factories, so we expect instances here
        expect(SystemLogicInterpreter).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger, // Resolved from container
            eventBus: mockEventBus, // Resolved from container
            dataRegistry: mockDataRegistry, // Resolved from container
            jsonLogicEvaluationService: mockJsonLogicService, // Resolved from container
            entityManager: mockEntityManager, // Resolved from container
            // Check that the resolved OperationInterpreter mock instance was passed
            operationInterpreter: expect.any(OperationInterpreter) // Instance expected
        }));
    });

    it('resolving OperationInterpreter does not throw', () => {
        registerInterpreters(mockContainer);
        let resolvedInterpreter;
        expect(() => {
            resolvedInterpreter = mockContainer.resolve(tokens.OperationInterpreter);
        }).not.toThrow();
        expect(resolvedInterpreter).toBeDefined();
        expect(OperationInterpreter).toHaveBeenCalledTimes(1); // Constructor mock called only once now
    });

    it('resolving OperationRegistry does not throw and its factory registers handlers', () => {
        registerInterpreters(mockContainer);
        let resolvedRegistry;
        expect(() => {
            resolvedRegistry = mockContainer.resolve(tokens.OperationRegistry);
        }).not.toThrow();
        expect(resolvedRegistry).toBeDefined();
        expect(OperationRegistry).toHaveBeenCalledTimes(1); // Constructor mock called only once now

        // The factory function provided during registration is responsible for calling .register on the *actual* registry instance.
        // Since OperationRegistry itself is mocked, the mock constructor is called, and we check its instance methods.
        const mockRegistryInstance = OperationRegistry.mock.instances[0];
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('LOG', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('DISPATCH_EVENT', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('MODIFY_COMPONENT', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('ADD_COMPONENT', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('REMOVE_COMPONENT', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('QUERY_COMPONENT', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('MODIFY_DOM_ELEMENT', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('APPEND_UI_MESSAGE', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('SET_VARIABLE', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('QUERY_SYSTEM_DATA', expect.any(Function));
    });

    // This test should now pass thanks to Fix 2 in createMockContainer
    it('interpreters are registered as singletons', () => {
        registerInterpreters(mockContainer);

        const r1 = mockContainer.resolve(tokens.OperationRegistry);
        const r2 = mockContainer.resolve(tokens.OperationRegistry);
        // Check instance equality
        expect(r1).toBe(r2); // <<< SHOULD PASS NOW
        // Constructor should only be called once due to singleton behavior
        expect(OperationRegistry).toHaveBeenCalledTimes(1);

        const i1 = mockContainer.resolve(tokens.OperationInterpreter);
        const i2 = mockContainer.resolve(tokens.OperationInterpreter);
        expect(i1).toBe(i2); // <<< SHOULD PASS NOW
        expect(OperationInterpreter).toHaveBeenCalledTimes(1);

        const s1 = mockContainer.resolve(tokens.SystemLogicInterpreter);
        const s2 = mockContainer.resolve(tokens.SystemLogicInterpreter);
        expect(s1).toBe(s2); // <<< SHOULD PASS NOW
        expect(SystemLogicInterpreter).toHaveBeenCalledTimes(1);
    });

    it('resolving SetVariableHandler does not throw', () => {
        registerInterpreters(mockContainer);
        let handler;
        expect(() => {
            handler = mockContainer.resolve(tokens.SetVariableHandler);
        }).not.toThrow();
        expect(handler).toBeDefined();
        expect(SetVariableHandler).toHaveBeenCalledTimes(1); // Constructor mock called only once now
        expect(SetVariableHandler).toHaveBeenCalledWith({logger: mockLogger});
    });

    it('resolving QuerySystemDataHandler does not throw', () => {
        registerInterpreters(mockContainer);
        let handler;
        expect(() => {
            handler = mockContainer.resolve(tokens.QuerySystemDataHandler);
        }).not.toThrow();
        expect(handler).toBeDefined();
        expect(QuerySystemDataHandler).toHaveBeenCalledTimes(1); // Constructor mock called only once now
        expect(QuerySystemDataHandler).toHaveBeenCalledWith({
            logger: mockLogger,
            systemDataRegistry: mockSystemDataRegistry // Check the mock was passed
        });
    });

    // DR-01.7: Add tests for AppendUiMessageHandler and ModifyDomElementHandler
    it('resolving AppendUiMessageHandler does not throw', () => {
        registerInterpreters(mockContainer);
        let handler;
        expect(() => {
            handler = mockContainer.resolve(tokens.AppendUiMessageHandler);
        }).not.toThrow();
        expect(handler).toBeDefined();
        expect(AppendUiMessageHandler).toHaveBeenCalledTimes(1); // Singleton factory
        // Apply the requested expectation update:
        expect(AppendUiMessageHandler).toHaveBeenCalledWith({
            logger: mockLogger,
            domRenderer: expect.any(Object) // Checks if the resolved dependency is an object (our mockDomRenderer)
        });
        // Optionally check if it's the specific mock instance
        expect(AppendUiMessageHandler).toHaveBeenCalledWith(expect.objectContaining({
            domRenderer: mockDomRenderer
        }));
    });

    it('resolving ModifyDomElementHandler does not throw', () => {
        registerInterpreters(mockContainer);
        let handler;
        expect(() => {
            handler = mockContainer.resolve(tokens.ModifyDomElementHandler);
        }).not.toThrow();
        expect(handler).toBeDefined();
        expect(ModifyDomElementHandler).toHaveBeenCalledTimes(1); // Singleton factory
        // Apply the requested expectation update:
        expect(ModifyDomElementHandler).toHaveBeenCalledWith({
            logger: mockLogger,
            domRenderer: expect.any(Object) // Checks if the resolved dependency is an object (our mockDomRenderer)
        });
        // Optionally check if it's the specific mock instance
        expect(ModifyDomElementHandler).toHaveBeenCalledWith(expect.objectContaining({
            domRenderer: mockDomRenderer
        }));
    });
});