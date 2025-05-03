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
import InputHandler from '../../../../core/inputHandler.js';
// --- NEW Imports needed by registerUI factories ---
import {
    UiMessageRenderer,
    DomElementFactory,
    DocumentContext,
    DomUiFacade // Needed for instanceof checks
} from '../../../../domUI/index.js';


// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()};

// --- Realistic DOM Mocks ---
let mockInputElement;
let mockDocument;
let mockOutputDiv;
let mockTitleElement;

const setupDomMocks = () => {
    mockDocument = document;
    mockInputElement = mockDocument.createElement('input');
    mockOutputDiv = mockDocument.createElement('div');
    mockTitleElement = mockDocument.createElement('h1');
    mockOutputDiv.id = 'output-div';
    mockTitleElement.id = 'title-element';

    mockDocument.body.innerHTML = `
        <div id="game-container"><div id="main-content"><ul id="message-list"></ul></div><div id="action-buttons"></div></div>`;
    mockDocument.body.appendChild(mockOutputDiv);
    mockDocument.body.appendChild(mockTitleElement);
    mockDocument.body.appendChild(mockInputElement);

    jest.spyOn(mockInputElement, 'addEventListener');
    jest.spyOn(mockInputElement, 'focus');
    jest.spyOn(mockDocument, 'querySelector');
    jest.spyOn(mockDocument, 'createElement');
    jest.spyOn(mockDocument.body, 'appendChild');
};

// --- Mock Custom DI Container (Pure JS Version) ---
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance; // For self-reference within factories/resolvers

    // --- Simplified Register Spy ---
    // Stores arguments exactly as received from Registrar
    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        if (!token) {
            // This error should not happen anymore if Registrar is fixed or wasn't the issue
            console.error('[Mock Register ERROR] Falsy token received unexpectedly!', {
                token,
                factoryOrValueOrClass,
                options
            });
            throw new Error('Mock Register Error: Token is required.');
        }

        // Store exactly what was passed by the Registrar caller
        registrations.set(token, {
            factoryOrValue: factoryOrValueOrClass, // Store original value/class/factory
            options: options                      // Store original options
        });

        // Clear instance cache if re-registering a singleton (based on options passed by Registrar)
        if (options?.lifecycle?.startsWith('singleton') && instances.has(token)) {
            instances.delete(token);
        }
    });

    // --- Adapted Resolve Spy ---
    // Interprets the stored registration data to create/return instances
    const resolveSpy = jest.fn((token) => {
        const tokenString = String(token);

        // 1. Check instance cache
        if (instances.has(token)) {
            return instances.get(token);
        }

        // 2. Check registrations
        const registration = registrations.get(token);
        if (registration) {
            const {factoryOrValue, options} = registration;
            // Determine lifecycle from options passed by Registrar during registration
            const lifecycle = options?.lifecycle || 'transient';
            let instance;

            // 3. Determine HOW to create the instance based on stored data
            const isClassForSingle = typeof factoryOrValue === 'function' && options?.dependencies && options.dependencies.length > 0 && options?.lifecycle === 'singleton';
            const isFactoryFunction = typeof factoryOrValue === 'function' && !isClassForSingle; // Covers singletonFactory and transientFactory

            if (isClassForSingle) {
                // --- Handle 'single' registration (Class constructor + dependencies) ---
                const ClassConstructor = factoryOrValue;
                const deps = options.dependencies;
                const resolvedContainer = containerInstance; // Need self-reference

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
                    // Use object map injection (as per previous successful state)
                    instance = new ClassConstructor(dependenciesMap);
                } catch (constructorError) {
                    console.error(`[Mock Resolve Factory for ${tokenString}] Constructor error for "${targetClassName}"`, constructorError);
                    throw constructorError;
                }
            } else if (isFactoryFunction) {
                // --- Handle 'factory' registration (singletonFactory / transientFactory) ---
                try {
                    instance = factoryOrValue(containerInstance); // Execute the stored factory
                } catch (factoryError) {
                    console.error(`[Mock Resolve] Error executing factory for ${tokenString}:`, factoryError);
                    throw factoryError;
                }
            } else {
                // --- Handle 'instance' registration (Direct value) ---
                instance = factoryOrValue; // The stored value is the instance
            }

            // 4. Cache if singleton
            // Use the lifecycle determined during registration options
            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instance !== undefined) {
                instances.set(token, instance);
            }
            return instance;
        }

        // 5. Fallbacks for core mocks if not registered
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.EventBus) return mockEventBus;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;

        // 6. Throw if token not found
        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}`);
    });


    // --- Set up container self-reference ---
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
        setupDomMocks();
        mockContainer = createMockContainer();

        mockUiArgs = {
            inputElement: mockInputElement,
            document: mockDocument,
            outputDiv: mockOutputDiv,
            titleElement: mockTitleElement,
        };

        // Pre-register core dependencies (as instance registrations)
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'}); // Provide options hinting it's an instance
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        // Clear spies *after* pre-registration
        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    // *** This test should now pass as registerSpy records the actual mockDocument ***
    it('should register essential external dependencies (document, elements) as singleton instances', () => {
        registerUI(mockContainer, mockUiArgs);

        // Assert that registerSpy was called with the actual value (mockDocument, etc.)
        // The third argument (options) depends on what Registrar.instance passes. Let's use expect.anything() for flexibility.
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.WindowDocument, mockDocument, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.outputDiv, mockOutputDiv, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.inputElement, mockInputElement, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.titleElement, mockTitleElement, expect.objectContaining({lifecycle: 'singleton'}));

        // Resolution checks remain the same (resolveSpy should handle instance resolution)
        expect(mockContainer.resolve(tokens.WindowDocument)).toBe(mockDocument);
        expect(mockContainer.resolve(tokens.outputDiv)).toBe(mockOutputDiv);
        expect(mockContainer.resolve(tokens.inputElement)).toBe(mockInputElement);
        expect(mockContainer.resolve(tokens.titleElement)).toBe(mockTitleElement);
        expect(mockContainer.resolve(tokens.WindowDocument)).toBe(mockDocument); // Singleton check

        // Logging checks remain the same
        expect(mockLogger.debug).toHaveBeenCalledWith('UI Registrations: Registered window.document instance.');
        expect(mockLogger.debug).toHaveBeenCalledWith('UI Registrations: Registered outputDiv instance.');
        expect(mockLogger.debug).toHaveBeenCalledWith('UI Registrations: Registered inputElement instance.');
        expect(mockLogger.debug).toHaveBeenCalledWith('UI Registrations: Registered titleElement instance.');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting (Refactored DOM UI)...');
    });

    it('should register IDocumentContext via singletonFactory resolving to DocumentContext', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.IDocumentContext);

        expect(regCall).toBeDefined();
        // Check the factory function was passed directly
        expect(regCall[1]).toEqual(expect.any(Function));
        // Check the options passed by Registrar.singletonFactory
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.IDocumentContext);
        expect(instance1).toBeInstanceOf(DocumentContext);
        expect(mockContainer.resolve(tokens.IDocumentContext)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WindowDocument);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.IDocumentContext}.`);
    });

    it('should register DomElementFactory via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomElementFactory);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.DomElementFactory);
        expect(instance1).toBeInstanceOf(DomElementFactory);
        expect(mockContainer.resolve(tokens.DomElementFactory)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.DomElementFactory}.`);
    });

    // *** This test should now pass as registerSpy records the actual UiMessageRenderer class ***
    it('should register UiMessageRenderer using single()', () => {
        if (typeof UiMessageRenderer !== 'function') {
            throw new Error("Test pre-condition failed: UiMessageRenderer was not imported correctly.");
        }
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.UiMessageRenderer);

        expect(regCall).toBeDefined();
        // Assert that registerSpy received the CLASS CONSTRUCTOR
        expect(regCall[1]).toBe(UiMessageRenderer);
        // Assert the options passed by Registrar.single
        expect(regCall[2]).toEqual(expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [
                tokens.ILogger, tokens.IDocumentContext, tokens.IValidatedEventDispatcher, tokens.DomElementFactory
            ]
        }));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.UiMessageRenderer);
        expect(instance1).toBeInstanceOf(UiMessageRenderer); // resolveSpy should handle creation
        expect(mockContainer.resolve(tokens.UiMessageRenderer)).toBe(instance1); // Singleton check

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.UiMessageRenderer}.`);
    });

    it('should register TitleRenderer via singletonFactory injecting titleElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.TitleRenderer);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.TitleRenderer);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.TitleRenderer)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.titleElement);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.TitleRenderer}.`);
    });

    it('should register InputStateController via singletonFactory injecting inputElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.InputStateController);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.InputStateController);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.InputStateController)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.InputStateController}.`);
    });

    it('should register LocationRenderer via singletonFactory injecting outputDiv', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.LocationRenderer);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.LocationRenderer);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.LocationRenderer)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.outputDiv);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.LocationRenderer}.`);
    });

    it('should register InventoryPanel via singletonFactory querying for container', () => {
        expect(mockDocument.querySelector('#game-container')).toBeDefined();
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.InventoryPanel);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear();
        const docContextInstance = mockContainer.resolve(tokens.IDocumentContext);
        const querySpy = jest.spyOn(docContextInstance, 'query');

        const instance1 = mockContainer.resolve(tokens.InventoryPanel);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.InventoryPanel)).toBe(instance1);

        expect(querySpy).toHaveBeenCalledWith('#game-container');
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.InventoryPanel}.`);
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('InventoryPanel'));
    });

    it('should register ActionButtonsRenderer via singletonFactory querying for container', () => {
        expect(mockDocument.querySelector('#action-buttons')).toBeDefined();
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.ActionButtonsRenderer);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear();
        const docContextInstance = mockContainer.resolve(tokens.IDocumentContext);
        const querySpy = jest.spyOn(docContextInstance, 'query');

        const instance1 = mockContainer.resolve(tokens.ActionButtonsRenderer);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.ActionButtonsRenderer)).toBe(instance1);

        expect(querySpy).toHaveBeenCalledWith('#action-buttons');
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.ActionButtonsRenderer}.`);
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('ActionButtonsRenderer'));
    });

    // REMOVED test for IDomMutationService

    // --- Test Facade Registration ---
    // *** This test should now pass as registerSpy records the actual DomUiFacade class ***
    it('should register DomUiFacade under its own token using single()', () => {
        if (typeof DomUiFacade !== 'function') {
            throw new Error("Test pre-condition failed: DomUiFacade was not imported correctly.");
        }
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomUiFacade);

        expect(regCall).toBeDefined();
        // Assert that registerSpy received the CLASS CONSTRUCTOR
        expect(regCall[1]).toBe(DomUiFacade);
        // Assert the options passed by Registrar.single
        expect(regCall[2]).toEqual(expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [
                tokens.ActionButtonsRenderer, tokens.InventoryPanel, tokens.LocationRenderer,
                tokens.TitleRenderer, tokens.InputStateController, tokens.UiMessageRenderer
            ]
        }));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.DomUiFacade);
        expect(instance1).toBeInstanceOf(DomUiFacade); // resolveSpy should handle creation
        expect(mockContainer.resolve(tokens.DomUiFacade)).toBe(instance1); // Singleton check

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ActionButtonsRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.InventoryPanel);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.LocationRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.TitleRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.InputStateController);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.UiMessageRenderer);
        expect(mockLogger.info).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.DomUiFacade} under its own token.`);
    });

    it('should register legacy IInputHandler via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.IInputHandler);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.IInputHandler);
        expect(instance1).toBeInstanceOf(InputHandler);
        expect(mockContainer.resolve(tokens.IInputHandler)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.EventBus);
        expect(mockLogger.warn).toHaveBeenCalledWith(`UI Registrations: Registered legacy InputHandler against ${tokens.IInputHandler} token (still uses EventBus).`);
    });

    it('should log completion messages', () => {
        registerUI(mockContainer, mockUiArgs);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting (Refactored DOM UI)...');
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.IDocumentContext}.`);
        expect(mockLogger.info).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.DomUiFacade} under its own token.`);
        expect(mockLogger.warn).toHaveBeenCalledWith(`UI Registrations: Registered legacy InputHandler against ${tokens.IInputHandler} token (still uses EventBus).`);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Deprecated registrations (DomRenderer, DomMutationService) removed.');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Complete.');
    });

});