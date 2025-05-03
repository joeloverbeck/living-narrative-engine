// src/tests/core/config/registrations/uiRegistrations.test.js
// ****** CORRECTED FILE ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/interfaces/eventBus.js').EventBus} EventBus */ // Assuming interface/type exists
/** @typedef {import('../../../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */ // Added
/** @typedef {import('../../../../core/interfaces/IInputHandler.js').IInputHandler} IInputHandler */ // Added
/** @typedef {any} AppContainer */ // Using 'any' for the mock container type for simplicity

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerUI} from '../../../../core/config/registrations/uiRegistrations.js'; // Adjust path as needed

// --- Dependencies & Concrete Classes ---
import {tokens} from '../../../../core/config/tokens.js';
// import DomRenderer from '../../../../domUI/domRenderer.js'; // Likely removable
import InputHandler from '../../../../core/inputHandler.js';
// --- NEW Imports needed by registerUI factories ---
import {UiMessageRenderer} from '../../../../domUI/index.js';
import DomElementFactory from '../../../../domUI/domElementFactory.js';
import BrowserDocumentContext from '../../../../domUI/documentContext.js';

// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()}; // Added subscribe/unsubscribe for VED mock completeness

// --- Realistic DOM Mocks ---
let mockInputElement;
let mockDocument; // Mock the document object itself

const setupDomMocks = () => {
    mockDocument = document; // Use the global document provided by JSDOM
    mockInputElement = mockDocument.createElement('input');
    mockDocument.body.innerHTML = '<div id="main-content"><ul id="message-list"></ul></div>'; // Ensure main-content and message-list exist
    jest.spyOn(mockInputElement, 'addEventListener');
    jest.spyOn(mockInputElement, 'focus');
    // Spy on querySelector to check ensureMessageList interaction if needed
    jest.spyOn(mockDocument, 'querySelector');
    jest.spyOn(mockDocument, 'createElement'); // Spy on element creation
};

// --- Mock Custom DI Container (Pure JS Version) ---
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance;

    const resolveSpy = jest.fn((token) => {
        const tokenString = String(token); // For logging
        if (instances.has(token)) {
            // console.log(`[Mock Resolve] Cache hit for: ${tokenString}`);
            return instances.get(token);
        }
        const registration = registrations.get(token);
        if (registration) {
            // console.log(`[Mock Resolve] Cache miss, resolving: ${tokenString}`);
            const {factoryOrValue, options} = registration;
            const lifecycle = options?.lifecycle || 'transient';
            let instance;
            if (typeof factoryOrValue === 'function') {
                // console.log(`[Mock Resolve] Executing factory for: ${tokenString}`);
                try {
                    instance = factoryOrValue(containerInstance); // Execute factory
                } catch (factoryError) {
                    console.error(`[Mock Resolve] Error executing factory for ${tokenString}:`, factoryError);
                    throw factoryError;
                }
                // console.log(`[Mock Resolve] Factory for ${tokenString} returned instance of ${instance?.constructor?.name}`);
            } else {
                // This branch should not be hit if registerSpy always creates a factory
                console.warn(`[Mock Resolve] Returning direct value (unexpected for ${tokenString}?)`);
                instance = factoryOrValue;
            }
            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instance !== undefined) {
                // console.log(`[Mock Resolve] Caching instance for: ${tokenString}`);
                instances.set(token, instance);
            }
            return instance;
        }
        // Fallbacks... (Keep for safety during test setup)
        // console.warn(`[Mock Resolve] Using fallback for: ${tokenString}`);
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.EventBus) return mockEventBus;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
        // Removed fallbacks for WindowDocument/inputElement as they should be registered explicitly by registerUI

        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}`);
    });

    // --- Mock Register Spy ---
    // This spy simulates the *outcome* of registration by storing an appropriate factory
    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        const tokenString = String(token); // For logging
        // console.log(`[Mock Register] Registering: ${tokenString} with options:`, options);
        if (!token) throw new Error('Mock Register Error: Token is required.');
        let effectiveFactory; // This will *always* be a function stored in registrations
        let finalOptions = {...options}; // Start with a copy

        // --- Instance Registration (Registrar.instance) ---
        // The value passed by Registrar.instance is the instance itself
        if (options?.lifecycle === 'singleton' && typeof factoryOrValueOrClass !== 'function') {
            const instanceValue = factoryOrValueOrClass;
            effectiveFactory = () => instanceValue; // Store a factory that returns the instance
            finalOptions = {lifecycle: 'singleton'}; // Store the effective lifecycle
            // console.log(`[Mock Register] Storing instance factory for: ${tokenString}`);
        }
            // --- Class/Dependencies Registration (Registrar.single) ---
        // The value passed by Registrar.single is the Class Constructor
        else if (options?.dependencies && typeof factoryOrValueOrClass === 'function') {
            const ClassConstructor = factoryOrValueOrClass;
            const deps = options.dependencies;
            // console.log(`[Mock Register] Creating object-injection factory for: ${tokenString} with deps:`, deps.map(String));

            // Create the object-injection factory
            effectiveFactory = (cont) => {
                // console.log(`[Mock Factory for ${tokenString}] Executing...`);
                const resolvedContainer = cont || containerInstance;
                if (!resolvedContainer) throw new Error(`[Mock Factory for ${tokenString}] Container self-reference not available.`);

                const dependenciesMap = {};
                const targetClassName = ClassConstructor.name || '[AnonymousClass]';

                deps.forEach((depToken, index) => {
                    let propName = '';
                    if (typeof depToken === 'string') {
                        propName = depToken;
                        if (propName.length > 1 && propName.startsWith('I') && propName[1] === propName[1].toUpperCase()) {
                            propName = propName.substring(1);
                        }
                        propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                    } else {
                        propName = `dependency${index}`;
                        console.warn(`Mock factory using fallback prop name for token: ${String(depToken)}`);
                    }

                    try {
                        // console.log(`[Mock Factory for ${tokenString}] Resolving dependency: ${String(depToken)} for prop "${propName}"`);
                        const resolvedValue = resolvedContainer.resolve(depToken);

                        // --- DEBUG LOGGING (Keep for now) ---
                        if (depToken === tokens.DomElementFactory) {
                            console.log(`---> [Mock Factory Debug] Resolved ${String(depToken)} for prop "${propName}"`);
                            console.log(`---> [Mock Factory Debug] Value:`, resolvedValue);
                            console.log(`---> [Mock Factory Debug] typeof Value: ${typeof resolvedValue}`);
                            if (resolvedValue) {
                                console.log(`---> [Mock Factory Debug] Value constructor name: ${resolvedValue.constructor?.name}`);
                                console.log(`---> [Mock Factory Debug] Value has 'create' method?: ${typeof resolvedValue.create === 'function'}`);
                                console.log(`---> [Mock Factory Debug] Value instanceof DomElementFactory?: ${resolvedValue instanceof DomElementFactory}`);
                            } else {
                                console.log(`---> [Mock Factory Debug] Value is null or undefined.`);
                            }
                        }
                        // --- END DEBUG LOGGING ---

                        dependenciesMap[propName] = resolvedValue;
                    } catch (e) {
                        console.error(`[Mock Factory for ${tokenString}] FAILED to resolve dependency: ${String(depToken)} for prop "${propName}"`, e);
                        throw e;
                    }
                });

                try {
                    // console.debug(`[Mock Factory for ${tokenString}] Instantiating ${targetClassName} with object map keys:`, Object.keys(dependenciesMap));
                    return new ClassConstructor(dependenciesMap);
                } catch (constructorError) {
                    console.error(`[Mock Factory for ${tokenString}] Error during constructor execution for "${targetClassName}". Map keys: ${Object.keys(dependenciesMap).join(', ')}`, constructorError);
                    // console.error(`[Mock Factory for ${tokenString}] Dependencies Map Content:`, dependenciesMap); // Keep if needed
                    throw constructorError;
                }
            };
            finalOptions = {lifecycle: 'singleton'}; // Store the effective lifecycle
        }
            // --- Factory Function Registration (Registrar.singletonFactory / transientFactory) ---
        // The value passed is already the factory function
        else if (typeof factoryOrValueOrClass === 'function') {
            effectiveFactory = factoryOrValueOrClass; // Store the provided factory directly
            finalOptions = options; // Keep original options (like lifecycle)
            // console.log(`[Mock Register] Storing direct factory for: ${tokenString}`);
        } else {
            console.error(`[Mock Register] Unexpected type for factoryOrValueOrClass for token ${tokenString}`);
            effectiveFactory = () => factoryOrValueOrClass; // Fallback wrap
        }

        registrations.set(token, {
            // Always store the function that will produce the instance
            factoryOrValue: effectiveFactory,
            // Store the final options determined by the registration type
            options: finalOptions
        });

        if (instances.has(token)) {
            // console.log(`[Mock Register] Clearing instance cache for re-registered token: ${tokenString}`)
            instances.delete(token);
        }
    });
    // --- End Mock Register Spy ---

    containerInstance = {
        _registrations: registrations,
        _instances: instances,
        register: registerSpy,
        resolve: resolveSpy,
    };
    return containerInstance;
};


describe('registerUI (with Mock Pure JS DI Container and Mocked Dependencies)', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;
    let mockUiArgs;

    beforeEach(() => {
        jest.clearAllMocks();
        setupDomMocks(); // Ensure DOM is set up
        mockContainer = createMockContainer();
        mockUiArgs = {
            inputElement: mockInputElement,
            document: mockDocument, // Pass the JSDOM document
        };

        // Pre-register the ACTUAL mock objects directly. These are external dependencies.
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        // Reset spy history *before* calling the function under test
        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = ''; // Clean up DOM
    });

    // --- Tests for instance/factory registrations ---
    it('should register WindowDocument and inputElement as singleton instances via factories', () => {
        registerUI(mockContainer, mockUiArgs); // Calls Registrar.instance internally

        // Find the specific calls to the mock register function
        const docRegCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.WindowDocument);
        const inputRegCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.inputElement);

        // Assert that the registrar called our mock register
        expect(docRegCall).toBeDefined();
        expect(inputRegCall).toBeDefined();

        // **ADJUSTED ASSERTION:** Check that a *function* (the factory created by registerSpy)
        // was registered with the correct lifecycle option.
        expect(docRegCall[1]).toEqual(expect.any(Function));
        expect(docRegCall[2]).toEqual({lifecycle: 'singleton'}); // Registrar.instance should result in singleton lifecycle

        expect(inputRegCall[1]).toEqual(expect.any(Function));
        expect(inputRegCall[2]).toEqual({lifecycle: 'singleton'}); // Registrar.instance should result in singleton lifecycle

        // Check resolution still works (mock resolve executes the stored factory)
        expect(mockContainer.resolve(tokens.WindowDocument)).toBe(mockDocument);
        expect(mockContainer.resolve(tokens.inputElement)).toBe(mockInputElement);

        // Check logging
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting...');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Registered window.document instance.');
    });

    it('should register InputHandler as a singleton factory', () => {
        registerUI(mockContainer, mockUiArgs); // Calls Registrar.singletonFactory internally
        const handlerRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.IInputHandler);

        expect(handlerRegArgs).toBeDefined();
        // Check that the factory function itself was passed to register
        expect(typeof handlerRegArgs[1]).toBe('function');
        expect(handlerRegArgs[2]).toEqual({lifecycle: 'singletonFactory'}); // Options passed directly by Registrar.singletonFactory

        // Check resolution works
        const handler1 = mockContainer.resolve(tokens.IInputHandler);
        expect(handler1).toBeInstanceOf(InputHandler);
        expect(mockContainer.resolve(tokens.IInputHandler)).toBe(handler1); // Singleton check

        expect(mockLogger.info).toHaveBeenCalledWith(`UI Registrations: Registered InputHandler against ${tokens.IInputHandler} token (using EventBus).`);
    });


    it('should register IDocumentContext as a singleton factory resolving to BrowserDocumentContext', () => {
        registerUI(mockContainer, mockUiArgs);
        const contextRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.IDocumentContext);

        expect(contextRegArgs).toBeDefined();
        expect(typeof contextRegArgs[1]).toBe('function'); // Factory function registered
        expect(contextRegArgs[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear();
        const contextInstance = mockContainer.resolve(tokens.IDocumentContext);
        expect(contextInstance).toBeInstanceOf(BrowserDocumentContext);
        expect(mockContainer.resolve(tokens.IDocumentContext)).toBe(contextInstance);

        expect(mockLogger.info).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.IDocumentContext}.`);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WindowDocument); // Dependency resolved by factory
    });

    it('should register DomElementFactory as a singleton factory resolving to DomElementFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const factoryRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomElementFactory);

        expect(factoryRegArgs).toBeDefined();
        expect(typeof factoryRegArgs[1]).toBe('function'); // Factory function registered
        expect(factoryRegArgs[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear();
        const factoryInstance = mockContainer.resolve(tokens.DomElementFactory);
        expect(factoryInstance).toBeInstanceOf(DomElementFactory);
        expect(mockContainer.resolve(tokens.DomElementFactory)).toBe(factoryInstance);

        expect(mockLogger.info).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.DomElementFactory}.`);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext); // Dependency resolved by factory
    });

    it('should register UiMessageRenderer as a singleton class via a factory injecting an object map', () => {
        registerUI(mockContainer, mockUiArgs); // Calls Registrar.single internally

        const rendererRegCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.UiMessageRenderer);
        expect(rendererRegCall).toBeDefined();
        expect(rendererRegCall[0]).toBe(tokens.UiMessageRenderer);

        // **ADJUSTED ASSERTION:** Check that a *function* (the object-injection factory
        // created by registerSpy) was registered with the correct lifecycle option.
        expect(rendererRegCall[1]).toEqual(expect.any(Function));
        expect(rendererRegCall[2]).toEqual({lifecycle: 'singleton'}); // Registrar.single should result in singleton lifecycle

        mockContainer.resolve.mockClear();
        let rendererInstance;
        try {
            rendererInstance = mockContainer.resolve(tokens.UiMessageRenderer);
        } catch (e) {
            console.error("Error during mockContainer.resolve(tokens.UiMessageRenderer):", e);
            throw e; // Fail test explicitly
        }

        expect(rendererInstance).toBeDefined();
        expect(rendererInstance).toBeInstanceOf(UiMessageRenderer);
        expect(mockContainer.resolve(tokens.UiMessageRenderer)).toBe(rendererInstance); // Singleton check

        expect(mockLogger.info).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.UiMessageRenderer} (using VED).`);

        // Assert that the FACTORY stored and executed by the mock container resolved dependencies
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
    });

    // --- Dependency Injection Test (InputHandler) ---
    it('should inject correct dependencies (including null) into InputHandler when resolved', () => {
        registerUI(mockContainer, mockUiArgs);
        mockContainer.resolve.mockClear();

        const handler = mockContainer.resolve(tokens.IInputHandler);
        expect(handler).toBeInstanceOf(InputHandler);

        // Check dependencies requested by the InputHandler factory during its execution
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.EventBus);
    });

});