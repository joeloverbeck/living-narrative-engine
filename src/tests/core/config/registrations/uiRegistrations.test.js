// src/tests/core/config/registrations/uiRegistrations.test.js

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
// import DomRenderer from '../../../../domUI/domRenderer.js'; // Removed (legacy)
import InputHandler from '../../../../core/inputHandler.js';
// --- NEW Imports needed by registerUI factories ---
import {
    UiMessageRenderer,
    DomElementFactory,
    DocumentContext // ****** CORRECTED: Changed from BrowserDocumentContext to match uiRegistrations.js ******
    // Note: Other UI components (TitleRenderer, Facade, etc.) are resolved via container,
    // so direct import isn't strictly needed here unless asserting specific instances.
} from '../../../../domUI/index.js';


// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()}; // Added subscribe/unsubscribe for VED mock completeness

// --- Realistic DOM Mocks ---
let mockInputElement;
let mockDocument; // Mock the document object itself
let mockOutputDiv;
let mockTitleElement;

const setupDomMocks = () => {
    mockDocument = document; // Use the global document provided by JSDOM
    mockInputElement = mockDocument.createElement('input');
    mockOutputDiv = mockDocument.createElement('div');
    mockTitleElement = mockDocument.createElement('h1'); // or appropriate element
    mockOutputDiv.id = 'output-div'; // Give IDs if needed for selectors
    mockTitleElement.id = 'title-element';

    // Ensure necessary structure exists for querySelectors used in tests or setup
    mockDocument.body.innerHTML = `
        <div id="game-container"> <div id="main-content">
                 <ul id="message-list"></ul> </div>
             <div id="action-buttons"></div> </div>`;
    mockDocument.body.appendChild(mockOutputDiv); // Append mocks if they aren't part of innerHTML
    mockDocument.body.appendChild(mockTitleElement);
    mockDocument.body.appendChild(mockInputElement); // Ensure input is in the document

    // Spy on methods that might be called
    jest.spyOn(mockInputElement, 'addEventListener');
    jest.spyOn(mockInputElement, 'focus');
    jest.spyOn(mockDocument, 'querySelector');
    jest.spyOn(mockDocument, 'createElement'); // Spy on element creation
    jest.spyOn(mockDocument.body, 'appendChild');
};

// --- Mock Custom DI Container (Pure JS Version) ---
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance;

    const resolveSpy = jest.fn((token) => {
        const tokenString = String(token); // For logging
        if (instances.has(token)) {
            return instances.get(token);
        }
        const registration = registrations.get(token);
        if (registration) {
            const {factoryOrValue, options} = registration;
            const lifecycle = options?.lifecycle || 'transient';
            let instance;
            if (typeof factoryOrValue === 'function') {
                try {
                    instance = factoryOrValue(containerInstance); // Execute factory
                } catch (factoryError) {
                    console.error(`[Mock Resolve] Error executing factory for ${tokenString}:`, factoryError);
                    // Optionally log dependencies being resolved if error is in factory execution
                    if (options?.dependencies) {
                        console.error(`---> Factory dependencies were: ${options.dependencies.map(String).join(', ')}`);
                    } else if (options?.factoryDependencies) { // Assuming factory deps might be stored differently
                        console.error(`---> Factory dependencies (if applicable): ${options.factoryDependencies.map(String).join(', ')}`);
                    }
                    throw factoryError;
                }
            } else {
                console.warn(`[Mock Resolve] Returning direct value (unexpected for factory-based regs like ${tokenString}?)`);
                instance = factoryOrValue;
            }
            // Cache based on the *effective* lifecycle determined during registration
            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instance !== undefined) {
                instances.set(token, instance);
            }
            return instance;
        }
        // Fallbacks for core mocks if not explicitly registered by test setup
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.EventBus) return mockEventBus;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;

        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}`);
    });

    // --- Mock Register Spy ---
    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        const tokenString = String(token); // For logging
        if (!token) throw new Error('Mock Register Error: Token is required.');

        let effectiveFactory;
        let finalOptions = {...options};
        let registrationType = 'unknown';

        // Simulate Registrar.instance behavior
        if (options?.lifecycle === 'singleton' && typeof factoryOrValueOrClass !== 'function' && !options?.dependencies) {
            registrationType = 'instance';
            const instanceValue = factoryOrValueOrClass;
            effectiveFactory = () => instanceValue; // Store factory returning the instance
            finalOptions = {lifecycle: 'singleton'}; // Effective lifecycle
        }
        // Simulate Registrar.single behavior (class + dependencies)
        else if (options?.dependencies && typeof factoryOrValueOrClass === 'function') {
            registrationType = 'single (class)';
            const ClassConstructor = factoryOrValueOrClass;
            const deps = options.dependencies;

            // --- Pre-flight Check (Mimic registrarHelpers more closely) ---
            if (typeof ClassConstructor !== 'function') {
                console.error(`[Mock Register Pre-Check ERROR] Attempted to register non-function for token ${tokenString} using 'single'. Value:`, ClassConstructor);
                throw new Error(`[Mock Register] Invalid registration for ${tokenString}: TargetClass must be a constructor function.`);
            }
            // --- End Pre-flight Check ---


            effectiveFactory = (cont) => {
                const resolvedContainer = cont || containerInstance;
                if (!resolvedContainer) throw new Error(`[Mock Factory for ${tokenString}] Container self-reference not available.`);

                const dependenciesMap = {};
                const targetClassName = ClassConstructor.name || '[AnonymousClass]';

                deps.forEach((depToken) => {
                    let propName = '';
                    // Basic prop name derivation (same as original test)
                    if (typeof depToken === 'string') {
                        propName = depToken;
                        if (propName.length > 1 && propName.startsWith('I') && propName[1] === propName[1].toUpperCase()) {
                            propName = propName.substring(1);
                        }
                        propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                    } else {
                        // Handle non-string tokens if necessary, maybe Symbol descriptions?
                        propName = `dep_${String(depToken)}`;
                        console.warn(`[Mock Factory for ${tokenString}] Using fallback prop name "${propName}" for token:`, depToken);
                    }

                    try {
                        const resolvedValue = resolvedContainer.resolve(depToken);
                        dependenciesMap[propName] = resolvedValue;
                    } catch (e) {
                        console.error(`[Mock Factory for ${tokenString}] FAILED to resolve dependency: ${String(depToken)} for prop "${propName}"`, e);
                        throw e; // Re-throw resolve errors
                    }
                });

                try {
                    // console.debug(`[Mock Factory for ${tokenString}] Instantiating ${targetClassName} with object map keys:`, Object.keys(dependenciesMap));
                    return new ClassConstructor(dependenciesMap);
                } catch (constructorError)/* istanbul ignore next */ { // Ignore constructor errors in test coverage for the mock itself
                    console.error(`[Mock Factory for ${tokenString}] Error during constructor execution for "${targetClassName}". Map keys: ${Object.keys(dependenciesMap).join(', ')}`, constructorError);
                    // console.error(`[Mock Factory for ${tokenString}] Dependencies Map Content:`, dependenciesMap);
                    throw constructorError; // Re-throw constructor errors
                }
            };
            finalOptions = {lifecycle: 'singleton', dependencies: deps}; // Store effective lifecycle and dependencies
        }
        // Simulate Registrar.singletonFactory / transientFactory behavior
        else if (typeof factoryOrValueOrClass === 'function' && !options?.dependencies) {
            registrationType = options.lifecycle === 'singletonFactory' ? 'singletonFactory' : 'transientFactory';
            effectiveFactory = factoryOrValueOrClass; // Store the provided factory
            finalOptions = options; // Keep original options
        }
        // Fallback / Unknown registration pattern
        else {
            console.warn(`[Mock Register] Registering token ${tokenString} with an unrecognized pattern. Value type: ${typeof factoryOrValueOrClass}, Options:`, options);
            // Fallback: treat as an instance or value registration
            effectiveFactory = () => factoryOrValueOrClass;
            finalOptions = {lifecycle: 'singleton'}; // Assume singleton if unsure
        }

        // console.log(`[Mock Register] Storing registration for: ${tokenString} (Type: ${registrationType}, Lifecycle: ${finalOptions.lifecycle})`);

        registrations.set(token, {
            factoryOrValue: effectiveFactory,
            options: finalOptions
        });

        // Clear cache if re-registering
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
        setupDomMocks(); // Ensure DOM is set up BEFORE creating container/args
        mockContainer = createMockContainer();

        // Define the arguments passed to registerUI
        mockUiArgs = {
            inputElement: mockInputElement,
            document: mockDocument, // Pass the JSDOM document
            outputDiv: mockOutputDiv,
            titleElement: mockTitleElement,
        };

        // Pre-register external dependencies required *by* registerUI or its factories
        // Use the mock container's register method
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        // Reset spy history *before* calling the function under test
        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear(); // Also clear debug logs if checking them
        mockLogger.warn.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = ''; // Clean up DOM
    });

    // Test basic setup and external instance registrations
    it('should register essential external dependencies (document, elements) as singleton instances', () => {
        registerUI(mockContainer, mockUiArgs); // Function under test

        // Check registration calls for the elements passed in mockUiArgs
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.WindowDocument, mockDocument, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.outputDiv, mockOutputDiv, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.inputElement, mockInputElement, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.titleElement, mockTitleElement, expect.objectContaining({lifecycle: 'singleton'}));

        // Verify resolution works correctly
        expect(mockContainer.resolve(tokens.WindowDocument)).toBe(mockDocument);
        expect(mockContainer.resolve(tokens.outputDiv)).toBe(mockOutputDiv);
        expect(mockContainer.resolve(tokens.inputElement)).toBe(mockInputElement);
        expect(mockContainer.resolve(tokens.titleElement)).toBe(mockTitleElement);

        // Check specific logging related to these registrations
        expect(mockLogger.debug).toHaveBeenCalledWith('UI Registrations: Registered window.document instance.');
        expect(mockLogger.debug).toHaveBeenCalledWith('UI Registrations: Registered outputDiv instance.');
        expect(mockLogger.debug).toHaveBeenCalledWith('UI Registrations: Registered inputElement instance.');
        expect(mockLogger.debug).toHaveBeenCalledWith('UI Registrations: Registered titleElement instance.');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting (Refactored DOM UI)...'); // Check start log
    });

    // Test core utility registrations (factories)
    it('should register IDocumentContext via singletonFactory resolving to DocumentContext', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.IDocumentContext);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function)); // Check it's a factory function
        expect(regCall[2]).toEqual({lifecycle: 'singletonFactory'}); // Check options

        // Trigger resolution and check instance type + singleton behavior
        mockContainer.resolve.mockClear(); // Clear resolve history before testing resolution
        const instance1 = mockContainer.resolve(tokens.IDocumentContext);
        // ****** Ensure DocumentContext is correctly imported at the top of this test file ******
        expect(instance1).toBeInstanceOf(DocumentContext);
        expect(mockContainer.resolve(tokens.IDocumentContext)).toBe(instance1); // Singleton check

        // Check dependency resolution *during* factory execution
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WindowDocument);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.IDocumentContext}.`);
    });

    it('should register DomElementFactory via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomElementFactory);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.DomElementFactory);
        // ****** Ensure DomElementFactory is correctly imported at the top ******
        expect(instance1).toBeInstanceOf(DomElementFactory);
        expect(mockContainer.resolve(tokens.DomElementFactory)).toBe(instance1);

        // Check dependency resolution by its factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.DomElementFactory}.`);
    });

    // --- Tests for individual component registrations ---

    // Test UiMessageRenderer (registered with .single)
    it('should register UiMessageRenderer using single()', () => {
        // *** PRE-CONDITION: Ensure UiMessageRenderer IS imported correctly at the top for this test ***
        if (typeof UiMessageRenderer !== 'function') {
            throw new Error("Test pre-condition failed: UiMessageRenderer was not imported correctly for the test.");
        }

        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.UiMessageRenderer);

        expect(regCall).toBeDefined();
        // Check that the CLASS CONSTRUCTOR itself was passed to register
        // This relies on the PRE-CONDITION check above. If UiMessageRenderer is undefined, this test will fail here.
        expect(regCall[1]).toBe(UiMessageRenderer);
        expect(regCall[2]).toEqual(expect.objectContaining({
            lifecycle: 'singleton', // Determined by mock register logic for 'single'
            dependencies: [
                tokens.ILogger,
                tokens.IDocumentContext,
                tokens.IValidatedEventDispatcher,
                tokens.DomElementFactory
            ]
        }));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.UiMessageRenderer);
        expect(instance1).toBeInstanceOf(UiMessageRenderer);
        expect(mockContainer.resolve(tokens.UiMessageRenderer)).toBe(instance1); // Singleton check

        // Check dependencies were resolved by the mock factory when creating the instance
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.UiMessageRenderer}.`);
    });

    // Test TitleRenderer (uses singletonFactory for element injection)
    it('should register TitleRenderer via singletonFactory injecting titleElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.TitleRenderer);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function)); // Factory function
        expect(regCall[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.TitleRenderer);
        // We don't have the actual TitleRenderer class imported, so we can't use instanceof.
        // Check that the factory resolved the expected dependencies.
        expect(instance1).toBeDefined(); // Check instance was created
        expect(mockContainer.resolve(tokens.TitleRenderer)).toBe(instance1); // Singleton check

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.titleElement); // Crucial check
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.TitleRenderer}.`);
    });

    // Test InputStateController (uses singletonFactory for element injection)
    it('should register InputStateController via singletonFactory injecting inputElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.InputStateController);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.InputStateController);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.InputStateController)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement); // Crucial check
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.InputStateController}.`);
    });

    // Test LocationRenderer (uses singletonFactory for element injection)
    it('should register LocationRenderer via singletonFactory injecting outputDiv', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.LocationRenderer);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.LocationRenderer);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.LocationRenderer)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.outputDiv); // Crucial check
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.LocationRenderer}.`);
    });

    // Test InventoryPanel (uses singletonFactory with internal querySelector)
    it('should register InventoryPanel via singletonFactory querying for container', () => {
        // Ensure the container exists for the querySelector spy
        expect(mockDocument.querySelector('#game-container')).toBeDefined();

        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.InventoryPanel);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear(); // Clear before resolving
        const instance1 = mockContainer.resolve(tokens.InventoryPanel);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.InventoryPanel)).toBe(instance1);

        // Check that the factory resolved dependencies AND called querySelector
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        // Check that query was called via the resolved DocumentContext
        // We need to get the DocumentContext instance created by the container
        const docContextInstance = mockContainer.resolve(tokens.IDocumentContext);
        // Now spy on *that instance* if the query happens inside the factory
        const querySpy = jest.spyOn(docContextInstance, 'query');

        // Re-resolve to trigger the factory again (or check the first resolution's calls)
        mockContainer.resolve(tokens.InventoryPanel); // Trigger factory execution
        expect(querySpy).toHaveBeenCalledWith('#game-container');

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.InventoryPanel}.`);
        // Check warning wasn't logged if element exists
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('InventoryPanel'));
    });

    // Test ActionButtonsRenderer (uses singletonFactory with internal querySelector)
    it('should register ActionButtonsRenderer via singletonFactory querying for container', () => {
        expect(mockDocument.querySelector('#action-buttons')).toBeDefined(); // Pre-condition

        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.ActionButtonsRenderer);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.ActionButtonsRenderer);
        expect(instance1).toBeDefined();
        expect(mockContainer.resolve(tokens.ActionButtonsRenderer)).toBe(instance1);

        const docContextInstance = mockContainer.resolve(tokens.IDocumentContext);
        const querySpy = jest.spyOn(docContextInstance, 'query');
        mockContainer.resolve(tokens.ActionButtonsRenderer); // Trigger factory
        expect(querySpy).toHaveBeenCalledWith('#action-buttons');

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.ActionButtonsRenderer}.`);
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('ActionButtonsRenderer'));
    });

    // Test DomMutationService (registered with .single)
    it('should register IDomMutationService using single() resolving to DomMutationService', () => {
        // *** PRE-CONDITION: Ensure DomMutationService IS imported correctly ***
        // Dynamically import within test or ensure it's at top level if needed for instanceof
        // For now, assume it's available for the real registration call.

        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.IDomMutationService);

        expect(regCall).toBeDefined();
        // We expect the Class Constructor to be passed if import worked in uiRegistrations.js
        expect(regCall[1]).toEqual(expect.any(Function)); // Check it's a function (the constructor)
        // Add check for specific class if DomMutationService is imported: expect(regCall[1]).toBe(DomMutationService);
        expect(regCall[2]).toEqual(expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [
                tokens.ILogger,
                tokens.IDocumentContext
            ]
        }));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.IDomMutationService);
        expect(instance1).toBeDefined(); // Check instance created
        // Add instanceof check if DomMutationService class is imported: expect(instance1).toBeInstanceOf(DomMutationService);
        expect(mockContainer.resolve(tokens.IDomMutationService)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.IDomMutationService}.`);
    });


    // --- Test Facade Registration ---
    it('should register DomUiFacade under DomRenderer token using single()', () => {
        // *** PRE-CONDITION: Ensure DomUiFacade is imported correctly ***
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomRenderer); // Registered under legacy token

        expect(regCall).toBeDefined();
        // Expect the DomUiFacade constructor was passed
        expect(regCall[1]).toEqual(expect.any(Function));
        // Add specific check if DomUiFacade imported: expect(regCall[1]).toBe(DomUiFacade);
        expect(regCall[2]).toEqual(expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [ // Check the specific dependencies expected by the facade
                tokens.ActionButtonsRenderer,
                tokens.InventoryPanel,
                tokens.LocationRenderer,
                tokens.TitleRenderer,
                tokens.InputStateController,
                tokens.UiMessageRenderer
            ]
        }));

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.DomRenderer); // Resolve using the legacy token
        expect(instance1).toBeDefined();
        // Add instanceof check if DomUiFacade imported: expect(instance1).toBeInstanceOf(DomUiFacade);
        expect(mockContainer.resolve(tokens.DomRenderer)).toBe(instance1);

        // Check that resolving the facade triggered resolution of its dependencies
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ActionButtonsRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.InventoryPanel);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.LocationRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.TitleRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.InputStateController);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.UiMessageRenderer);
        expect(mockLogger.info).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.DomUiFacade} under legacy token ${tokens.DomRenderer}.`);
    });

    // --- Test Legacy Input Handler ---
    it('should register legacy IInputHandler via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.IInputHandler);

        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function)); // Factory registered
        expect(regCall[2]).toEqual({lifecycle: 'singletonFactory'});

        mockContainer.resolve.mockClear();
        const instance1 = mockContainer.resolve(tokens.IInputHandler);
        expect(instance1).toBeInstanceOf(InputHandler); // Check concrete type
        expect(mockContainer.resolve(tokens.IInputHandler)).toBe(instance1);

        // Check dependencies resolved by the factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.EventBus); // Legacy dependency
        // null dependency is passed directly, not resolved.
        expect(mockLogger.warn).toHaveBeenCalledWith(`UI Registrations: Registered legacy InputHandler against ${tokens.IInputHandler} token (still uses EventBus).`);
    });

    // --- Final Checks ---
    it('should log completion messages', () => {
        registerUI(mockContainer, mockUiArgs);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting (Refactored DOM UI)...');
        // Check one of the debug messages to ensure they are firing
        expect(mockLogger.debug).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.IDocumentContext}.`);
        // Check the facade registration log
        expect(mockLogger.info).toHaveBeenCalledWith(`UI Registrations: Registered ${tokens.DomUiFacade} under legacy token ${tokens.DomRenderer}.`);
        // Check legacy handler warning
        expect(mockLogger.warn).toHaveBeenCalledWith(`UI Registrations: Registered legacy InputHandler against ${tokens.IInputHandler} token (still uses EventBus).`);
        // Check final completion log
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Complete.');
        // Check removal log is NOT present anymore (as the code was removed)
        expect(mockLogger.info).not.toHaveBeenCalledWith('UI Registrations: Removed registration for deprecated legacy DomRenderer class.');
    });

});