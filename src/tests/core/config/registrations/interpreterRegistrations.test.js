// src/core/config/registrations/interpreterRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../../../logic/operationRegistry.js').default} OperationRegistry */
/** @typedef {import('../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Or EventBus if that's the primary dependency for DispatchEventHandler
/** @typedef {any} AppContainer */ // Using 'any' as the custom container type isn't defined

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerInterpreters} from '../../../../core/config/registrations/interpreterRegistrations.js'; // Adjust path if needed

// --- Dependencies ---
import {tokens} from '../../../../core/tokens.js';

// --- MOCK the Modules to prevent constructor errors and simplify testing ---
// Mock the core services that SystemLogicInterpreter and its dependencies need
jest.mock('../../../../logic/operationRegistry.js');
jest.mock('../../../../logic/operationInterpreter.js');
jest.mock('../../../../logic/systemLogicInterpreter.js');
// Mock the handlers (we don't need their internal logic for this test)
jest.mock('../../../../logic/operationHandlers/dispatchEventHandler.js');
jest.mock('../../../../logic/operationHandlers/logHandler.js');
jest.mock('../../../../logic/operationHandlers/modifyComponentHandler.js');
jest.mock('../../../../logic/operationHandlers/queryComponentHandler.js');

// --- Import AFTER mocking ---
import OperationRegistry from '../../../../logic/operationRegistry.js';
import OperationInterpreter from '../../../../logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../../logic/systemLogicInterpreter.js';
import DispatchEventHandler from '../../../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../../../logic/operationHandlers/modifyComponentHandler.js';
import QueryComponentHandler from '../../../../logic/operationHandlers/queryComponentHandler.js';


// --- Mock Implementations (Core Services) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), publish: jest.fn()};
const mockDataRegistry = {getAllSystemRules: jest.fn().mockReturnValue([])}; // SLI needs this method
const mockJsonLogicService = {evaluate: jest.fn(), addOperation: jest.fn()};
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    getComponentData: jest.fn(),
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
    hasComponent: jest.fn()
};
const mockValidatedDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)}; // Needed by DispatchEventHandler factory


// --- Mock Custom DI Container (Copied from uiRegistrations.test.js) ---
// --- Mock Custom DI Container (Copied from uiRegistrations.test.js) ---
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            // 1. Store the initial registration details
            registrations.set(token, {factoryOrValue, options, instance: undefined});

            // --- FIX START ---
            // 2. Retrieve the stored registration object so we can work with it
            const registration = registrations.get(token);
            // --- FIX END ---

            // Simulate factory execution immediately for singletons during registration for simplicity in testing resolution later
            // This isn't strictly how Awilix works but helps verify factory dependencies here.
            if (options?.lifecycle === 'singleton') {
                // 3. Now operate on the 'registration' object retrieved from the map
                if (typeof factoryOrValue === 'function' && registration.instance === undefined) {
                    try {
                        const factory = factoryOrValue; // Or use registration.factoryOrValue
                        // Try to execute factory immediately to catch missing deps early in tests
                        // Note: This might resolve dependencies before they are registered if order is wrong.
                        // A more robust mock container might delay execution until resolve.
                        registration.instance = factory(container); // Store instance back into the map's object
                    } catch (e) {
                        // console.warn(`Mock container: Error executing factory during registration for ${String(token)}: ${e.message}`);
                        // Don't store instance if factory fails during registration simulation
                        registration.instance = undefined; // Ensure it's undefined on error
                    }
                } else if (typeof factoryOrValue !== 'function') {
                    // If it was registered as a value, store it as the instance
                    registration.instance = factoryOrValue; // Store instance back into the map's object
                }
            }
        }),
        resolve: jest.fn((token) => {
            const registration = registrations.get(token); // Correctly retrieves here
            if (!registration) {
                // Provide more context in the error message
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;

            if (options?.lifecycle === 'singleton') {
                if (registration.instance !== undefined) {
                    return registration.instance;
                }
                // Factory execution moved primarily to registration simulation above
                // If instance wasn't created there (e.g., non-singleton or error), try now.
                if (typeof factoryOrValue === 'function') {
                    try {
                        // Store the created instance back for subsequent resolves
                        registration.instance = factoryOrValue(container); // Pass container
                    } catch (e) {
                        console.error(`Mock container: Error executing factory during resolve for ${String(token)}: ${e.message}`);
                        throw e; // Re-throw resolve errors
                    }

                } else {
                    // If it was a value originally, it should have been set during register
                    // but handle case where it wasn't (e.g., error during register)
                    registration.instance = factoryOrValue;
                }
                return registration.instance;
            }

            // Transient or non-singleton
            if (typeof factoryOrValue === 'function') {
                try {
                    return factoryOrValue(container); // Pass container
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    throw e; // Re-throw resolve errors
                }
            }
            return factoryOrValue; // Return value directly for non-singletons/non-factories
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
        // These need to be registered *before* calling registerInterpreters
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IDataRegistry, mockDataRegistry, {lifecycle: 'singleton'});
        mockContainer.register(tokens.JsonLogicEvaluationService, mockJsonLogicService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ValidatedEventDispatcher, mockValidatedDispatcher, {lifecycle: 'singleton'}); // For DispatchEventHandler

        // Clear call counts on the mock service functions
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockEventBus).forEach(fn => fn.mockClear?.());
        Object.values(mockDataRegistry).forEach(fn => fn.mockClear?.());
        Object.values(mockJsonLogicService).forEach(fn => fn.mockClear?.());
        Object.values(mockEntityManager).forEach(fn => fn.mockClear?.());
        Object.values(mockValidatedDispatcher).forEach(fn => fn.mockClear?.());

        // Clear call counts on the MOCKED Class constructors
        OperationRegistry.mockClear();
        OperationInterpreter.mockClear();
        SystemLogicInterpreter.mockClear();
        DispatchEventHandler.mockClear();
        LogHandler.mockClear();
        ModifyComponentHandler.mockClear();
        QueryComponentHandler.mockClear();
    });

    it('should register required services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerInterpreters(mockContainer);
        }).not.toThrow();

        // Assert registration calls (optional but good sanity check)
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.DispatchEventHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.LogHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ModifyComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.QueryComponentHandler, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.OperationRegistry, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.OperationInterpreter, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.SystemLogicInterpreter, expect.any(Function), expect.objectContaining({lifecycle: 'singleton'}));
    });


    it('resolving SystemLogicInterpreter does not throw', () => {
        // Arrange: Register dependencies (done in beforeEach) and then the interpreters
        registerInterpreters(mockContainer);

        // Act & Assert: Try resolving the final interpreter. It shouldn't throw if all dependencies are correctly registered and mocked.
        let resolvedInterpreter;
        expect(() => {
            resolvedInterpreter = mockContainer.resolve(tokens.SystemLogicInterpreter);
        }).not.toThrow();

        // Assert: Check if something was actually resolved
        expect(resolvedInterpreter).toBeDefined();

        // Assert: Check that the MOCK SystemLogicInterpreter constructor was called via the factory
        // Note: Due to the mock container simulating factory execution on register, this might be 1 here.
        // If the mock container executed factories lazily on resolve, it would be called during the resolve step above.
        // Let's check if it was called at least once (either during register or resolve simulation).
        expect(SystemLogicInterpreter).toHaveBeenCalledTimes(1);

        // Verify dependencies were passed correctly (using the mocked constructor call)
        expect(SystemLogicInterpreter).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger,
            eventBus: mockEventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicService,
            entityManager: mockEntityManager,
            // We need to ensure OperationInterpreter mock instance was passed
            // The mock container needs refinement to reliably return mock instances from factories
            // For now, we check the type was expected. A better mock would check the instance.
            operationInterpreter: expect.anything() // Check that *some* value was passed for this key
        }));

        // Verify the OperationRegistry factory was called and it registered handlers (requires spying/mocking registry instance methods)
        // This setup is getting complex with the simple mock container. A real DI container or more sophisticated mock is needed for deeper verification.
        // For now, we focus on the primary acceptance criteria: resolving SLI doesn't throw.
    });

    it('resolving OperationInterpreter does not throw', () => {
        registerInterpreters(mockContainer);
        let resolvedInterpreter;
        expect(() => {
            resolvedInterpreter = mockContainer.resolve(tokens.OperationInterpreter);
        }).not.toThrow();
        expect(resolvedInterpreter).toBeDefined();
        expect(OperationInterpreter).toHaveBeenCalledTimes(1); // Check mock constructor call
    });

    it('resolving OperationRegistry does not throw and its factory registers handlers', () => {
        registerInterpreters(mockContainer);
        let resolvedRegistry;
        expect(() => {
            resolvedRegistry = mockContainer.resolve(tokens.OperationRegistry);
        }).not.toThrow();
        expect(resolvedRegistry).toBeDefined();
        expect(OperationRegistry).toHaveBeenCalledTimes(1); // Check mock constructor call

        // Because OperationRegistry itself is mocked, we need to check the mock's methods
        // The mock instance is returned by resolve()
        const mockRegistryInstance = OperationRegistry.mock.instances[0];
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('LOG', expect.any(Function)); // Expecting the bound execute fn
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('DISPATCH_EVENT', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('MODIFY_COMPONENT', expect.any(Function));
        expect(mockRegistryInstance.register).toHaveBeenCalledWith('QUERY_COMPONENT', expect.any(Function));
    });

    it('interpreters are registered as singletons', () => {
        registerInterpreters(mockContainer);

        const r1 = mockContainer.resolve(tokens.OperationRegistry);
        const r2 = mockContainer.resolve(tokens.OperationRegistry);
        expect(r1).toBe(r2);
        expect(OperationRegistry).toHaveBeenCalledTimes(1); // Constructor mock called only once

        const i1 = mockContainer.resolve(tokens.OperationInterpreter);
        const i2 = mockContainer.resolve(tokens.OperationInterpreter);
        expect(i1).toBe(i2);
        expect(OperationInterpreter).toHaveBeenCalledTimes(1); // Constructor mock called only once

        const s1 = mockContainer.resolve(tokens.SystemLogicInterpreter);
        const s2 = mockContainer.resolve(tokens.SystemLogicInterpreter);
        expect(s1).toBe(s2);
        expect(SystemLogicInterpreter).toHaveBeenCalledTimes(1); // Constructor mock called only once
    });


});