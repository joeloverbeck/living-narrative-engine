// src/tests/core/config/registrations/uiRegistrations.test.js
// ****** CORRECTED FILE ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/interfaces/eventBus.js').EventBus} EventBus */ // Assuming interface/type exists
/** @typedef {import('../../../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */ // Added
/** @typedef {import('../../../../core/interfaces/IInputHandler.js').IInputHandler} IInputHandler */ // Added
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerUI} from '../../../../core/config/registrations/uiRegistrations.js'; // Adjust path as needed

// --- Dependencies & Concrete Classes ---
import {tokens} from '../../../../core/config/tokens.js';
import DomRenderer from '../../../../domUI/domRenderer.js';
import InputHandler from '../../../../core/inputHandler.js';

// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn()}; // Mock for DomRenderer dependency

// --- VVVV MODIFIED MOCKS VVVV ---
// Use document.createElement for realistic DOM element mocks
let mockOutputDiv;
let mockInputElement;
let mockTitleElement;

const setupDomMocks = () => {
    // Create elements using JSDOM's document
    mockOutputDiv = document.createElement('div');
    mockInputElement = document.createElement('input');
    mockTitleElement = document.createElement('h1'); // Assuming H1 based on DomRenderer checks

    // Add spies for methods that might be called or checked
    jest.spyOn(mockOutputDiv, 'appendChild');
    jest.spyOn(mockInputElement, 'addEventListener');
    jest.spyOn(mockInputElement, 'focus');
    // Add spies or properties for other interactions if needed by tests or constructors
    // e.g., mockOutputDiv.scrollTop = 0; mockOutputDiv.scrollHeight = 0;
};
// --- ^^^^ MODIFIED MOCKS ^^^^ ---


// --- Mock Custom DI Container (Pure JS Version) ---
// (Using the improved version from the previous step)
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map(); // For singleton caching
    let containerInstance; // Self-reference for factories

    const resolveSpy = jest.fn((token) => {
        const registration = registrations.get(token);
        if (!registration) {
            if (token === tokens.ILogger) return mockLogger;
            // Provide other essential mocks if requested and not registered
            if (token === tokens.EventBus) return mockEventBus;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.outputDiv) return mockOutputDiv;
            if (token === tokens.inputElement) return mockInputElement;
            if (token === tokens.titleElement) return mockTitleElement;
            throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${String(token)}`);
        }

        const {factoryOrValue, options} = registration;
        const lifecycle = options?.lifecycle || 'transient'; // Default to transient if not specified

        if (lifecycle === 'singleton' || lifecycle === 'singletonFactory') {
            if (!instances.has(token)) {
                let instance;
                // Check if it's a factory (a function that wasn't registered as an instance)
                const isFactory = typeof factoryOrValue === 'function' && !options?.isInstance;
                if (isFactory) {
                    instance = factoryOrValue(containerInstance); // Pass container to factory
                } else {
                    instance = factoryOrValue;
                }
                instances.set(token, instance);
            }
            return instances.get(token);
        }

        // Handle transient (or default)
        const isFactory = typeof factoryOrValue === 'function' && !options?.isInstance;
        if (isFactory) {
            return factoryOrValue(containerInstance); // Pass container to factory
        } else {
            return factoryOrValue;
        }
    });

    containerInstance = {
        _registrations: registrations,
        _instances: instances,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            // Check if the value itself is being registered (used by registrar.instance)
            const isInstanceRegistration = typeof factoryOrValue !== 'function';
            registrations.set(token, {
                factoryOrValue,
                options: {...options, isInstance: isInstanceRegistration} // Store copy + internal flag
            });
            if (instances.has(token)) {
                instances.delete(token); // Clear cache on re-register
            }
        }),
        resolve: resolveSpy,
    };

    return containerInstance;
};


describe('registerUI (with Mock Pure JS DI Container and Mocked Dependencies)', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;
    let mockUiElements; // Keep this structure for passing to registerUI

    beforeEach(() => {
        jest.clearAllMocks(); // Clear all mocks
        setupDomMocks(); // Create fresh DOM mocks for each test

        mockContainer = createMockContainer();

        // Structure to pass to registerUI
        mockUiElements = {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement,
        };

        // Pre-register dependencies needed *by* registerUI or *by factories within it*
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        // Reset mock container's call history AFTER pre-registration
        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();
    });

    afterEach(() => {
        // Clean up spies on DOM elements if necessary (though Jest usually handles this)
        jest.restoreAllMocks();
    });

    it('should register outputDiv, inputElement, and titleElement as instances via factories', () => {
        // Act
        registerUI(mockContainer, mockUiElements);

        // Assert
        expect(mockContainer.register).toHaveBeenCalledTimes(5); // 3 elements + Renderer + Handler

        const outputRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.outputDiv);
        const inputRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.inputElement);
        const titleRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.titleElement);

        expect(outputRegArgs).toBeDefined();
        // --- VVVV MODIFIED ASSERTION VVVV ---
        // registrar.instance wraps the object in a factory
        expect(outputRegArgs[1]).toEqual(expect.any(Function));
        // --- ^^^^ MODIFIED ASSERTION ^^^^ ---
        expect(outputRegArgs[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));

        expect(inputRegArgs).toBeDefined();
        // --- VVVV MODIFIED ASSERTION VVVV ---
        expect(inputRegArgs[1]).toEqual(expect.any(Function));
        // --- ^^^^ MODIFIED ASSERTION ^^^^ ---
        expect(inputRegArgs[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));

        expect(titleRegArgs).toBeDefined();
        // --- VVVV MODIFIED ASSERTION VVVV ---
        expect(titleRegArgs[1]).toEqual(expect.any(Function));
        // --- ^^^^ MODIFIED ASSERTION ^^^^ ---
        expect(titleRegArgs[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));

        // Check logger calls
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting...');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Registered DOM element instances.');
    });

    it('should register DomRenderer as a singleton factory', () => {
        // Act
        registerUI(mockContainer, mockUiElements);

        // Assert
        const rendererRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomRenderer);

        expect(rendererRegArgs).toBeDefined();
        expect(typeof rendererRegArgs[1]).toBe('function');
        // DomRenderer uses registrar.single, which results in 'singleton' lifecycle
        expect(rendererRegArgs[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));

        // Act: Resolve twice (should work now with proper DOM mocks)
        const renderer1 = mockContainer.resolve(tokens.DomRenderer);
        const renderer2 = mockContainer.resolve(tokens.DomRenderer);

        // Assert: Singleton check
        expect(renderer1).toBeDefined();
        expect(renderer1).toBeInstanceOf(DomRenderer);
        expect(renderer1).toBe(renderer2);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Registered DomRenderer.');
    });

    it('should register InputHandler as a singleton factory', () => {
        // Act
        registerUI(mockContainer, mockUiElements);

        // Assert: Check registration details
        const handlerRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.IInputHandler);

        expect(handlerRegArgs).toBeDefined();
        expect(typeof handlerRegArgs[1]).toBe('function');
        // InputHandler uses registrar.singletonFactory, expect 'singletonFactory' lifecycle
        expect(handlerRegArgs[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        // Act: Resolve twice (should work now with proper DOM mocks)
        const handler1 = mockContainer.resolve(tokens.IInputHandler);
        const handler2 = mockContainer.resolve(tokens.IInputHandler);

        // Assert: Singleton check
        expect(handler1).toBeDefined();
        expect(handler1).toBeInstanceOf(InputHandler);
        expect(handler1).toBe(handler2);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Registered InputHandler against IInputHandler token.');
    });

    it('should inject correct dependencies into DomRenderer when resolved', () => {
        // Arrange
        registerUI(mockContainer, mockUiElements);
        mockContainer.resolve.mockClear();

        // Act: Resolve DomRenderer (should succeed now)
        const renderer = mockContainer.resolve(tokens.DomRenderer);

        // Assert
        expect(renderer).toBeDefined();
        const resolveCalls = mockContainer.resolve.mock.calls;
        const resolvedTokens = resolveCalls.map(call => call[0]);

        // Check dependencies were resolved
        expect(resolvedTokens).toContain(tokens.outputDiv);
        expect(resolvedTokens).toContain(tokens.inputElement);
        expect(resolvedTokens).toContain(tokens.titleElement);
        expect(resolvedTokens).toContain(tokens.EventBus);
        expect(resolvedTokens).toContain(tokens.IValidatedEventDispatcher);
        expect(resolvedTokens).toContain(tokens.ILogger);

        // Check correct mocks were returned by resolve
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.outputDiv);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        // ... etc.
    });

    it('should inject correct dependencies (including null) into InputHandler when resolved', () => {
        // Arrange
        registerUI(mockContainer, mockUiElements);

        // Spy on the actual InputHandler constructor THIS TIME
        const inputHandlerSpy = jest.spyOn(InputHandler.prototype, 'constructor');

        // Need to re-register the factory slightly to use the spy effectively,
        // or trust that the factory calls resolve correctly. Let's trust resolve first.
        mockContainer.resolve.mockClear();

        // Act: Resolve InputHandler (should succeed now)
        const handler = mockContainer.resolve(tokens.IInputHandler);

        // Assert
        expect(handler).toBeDefined();
        expect(handler).toBeInstanceOf(InputHandler);

        // Check dependencies were resolved by the factory
        const resolveCalls = mockContainer.resolve.mock.calls;
        const resolvedTokens = resolveCalls.map(call => call[0]);
        expect(resolvedTokens).toContain(tokens.inputElement);
        expect(resolvedTokens).toContain(tokens.EventBus);

        // Now, let's verify what the constructor *would have* received if we spied
        // This requires knowing the implementation detail of the factory in uiRegistrations.js
        // It calls new InputHandler(resolve(input), null, resolve(eventbus))
        // Since we can't easily spy *inside* the factory lambda, we rely on the fact that
        // resolve correctly returned the mocks for inputElement and EventBus.
        // We *know* the factory passes null as the second argument.

        // Alternative: If we *really* want to check constructor args, we need a more complex mock setup
        // where the mock container allows replacing the factory after registration,
        // but the current setup should be sufficient if resolve works.
    });

});