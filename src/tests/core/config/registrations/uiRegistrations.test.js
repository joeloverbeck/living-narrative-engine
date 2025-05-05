// src/tests/core/config/registrations/uiRegistrations.test.js
// ****** CORRECTED FILE ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../../core/interfaces/IInputHandler.js').IInputHandler} IInputHandler */
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
    DomUiFacade,
    // Also needed by factories using them:
    TitleRenderer,
    InputStateController,
    LocationRenderer,
    InventoryPanel,
    ActionButtonsRenderer
} from '../../../../domUI/index.js';


// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()}; // Keep for potential other tests
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()};

// --- Realistic DOM Mocks ---
let mockInputElement;
let mockDocument;
let mockOutputDiv;
let mockTitleElement;
let mockGameContainer;
let mockActionButtonsContainer;

const setupDomMocks = () => {
    mockDocument = document; // Use jsdom document
    mockInputElement = mockDocument.createElement('input');
    mockOutputDiv = mockDocument.createElement('div');
    mockTitleElement = mockDocument.createElement('h1');
    mockGameContainer = mockDocument.createElement('div');
    mockActionButtonsContainer = mockDocument.createElement('div');

    mockInputElement.id = 'input-element';
    mockOutputDiv.id = 'output-div';
    mockTitleElement.id = 'title-element';
    mockGameContainer.id = 'game-container';
    mockActionButtonsContainer.id = 'action-buttons';

    mockDocument.body.innerHTML = '';
    mockDocument.body.appendChild(mockGameContainer);
    mockGameContainer.appendChild(mockOutputDiv);
    mockGameContainer.appendChild(mockActionButtonsContainer);
    mockDocument.body.appendChild(mockTitleElement);
    mockDocument.body.appendChild(mockInputElement);

    jest.spyOn(mockInputElement, 'addEventListener');
    jest.spyOn(mockInputElement, 'focus');
    jest.spyOn(mockDocument, 'querySelector');
    jest.spyOn(mockDocument, 'createElement');
    jest.spyOn(mockDocument.body, 'appendChild');
};


// --- Mock Custom DI Container (Pure JS Version) ---
// ****** CORRECTED resolveSpy logic for 'single' registration ******
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance;

    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        if (!token) throw new Error('Mock Register Error: Token is required.');
        registrations.set(token, {factoryOrValue: factoryOrValueOrClass, options: options});
        if (options?.lifecycle?.startsWith('singleton') && instances.has(token)) {
            instances.delete(token);
        }
    });

    const resolveSpy = jest.fn((token) => {
        const tokenString = String(token);
        if (instances.has(token)) return instances.get(token);

        const registration = registrations.get(token);
        if (registration) {
            const {factoryOrValue, options} = registration;
            const lifecycle = options?.lifecycle || 'transient';
            let instance;

            // Determine registration type based on stored data
            const isClassForSingle = typeof factoryOrValue === 'function'
                && options?.dependencies
                && Array.isArray(options.dependencies)
                && options?.lifecycle === 'singleton'; // Check based on how Registrar.single passes options
            const isFactoryFunction = typeof factoryOrValue === 'function' && !isClassForSingle; // Covers singletonFactory etc.

            if (isClassForSingle) {
                // --- Handle 'single' registration (Class constructor + dependencies) ---
                const ClassConstructor = factoryOrValue;
                const depsMap = {};
                // Resolve each dependency token listed in the registration options
                options.dependencies.forEach(depToken => {
                    // Derive a plausible property name (e.g., 'logger' from 'ILogger')
                    let propName = String(depToken);
                    if (propName.startsWith('I') && propName.length > 1 && propName[1] === propName[1].toUpperCase()) {
                        propName = propName.substring(1); // Remove leading 'I'
                    }
                    propName = propName.charAt(0).toLowerCase() + propName.slice(1); // Lowercase first letter

                    try {
                        // Recursively resolve the dependency using the container
                        depsMap[propName] = containerInstance.resolve(depToken);
                    } catch (resolveError) {
                        console.error(`[Mock Resolve - isClassForSingle] Failed to resolve dependency '${String(depToken)}' needed by '${ClassConstructor.name}'`);
                        throw resolveError;
                    }
                });
                // Pass the created map as the *single argument* to the constructor
                try {
                    instance = new ClassConstructor(depsMap);
                } catch (constructorError) {
                    console.error(`[Mock Resolve - isClassForSingle] Error constructing '${ClassConstructor.name}' with deps map:`, depsMap, constructorError);
                    throw constructorError;
                }
            } else if (isFactoryFunction) {
                // --- Handle 'factory' registration (singletonFactory / transientFactory) ---
                try {
                    // Pass the container itself to the factory function
                    instance = factoryOrValue(containerInstance);
                } catch (factoryError) {
                    console.error(`[Mock Resolve - Factory] Error executing factory for token ${tokenString}:`, factoryError);
                    // Optional: Add more debug logging here if needed
                    throw factoryError; // Re-throw original error
                }
            } else {
                // --- Handle 'instance' registration (Direct value) ---
                instance = factoryOrValue;
            }

            // Cache if singleton
            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instance !== undefined) {
                instances.set(token, instance);
            }
            return instance;
        }

        // Fallbacks for essential mocks if not explicitly registered by `registerUI`
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
        // Add other essential fallbacks if necessary (e.g., EventBus if still used elsewhere)
        if (token === tokens.EventBus) return mockEventBus;

        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}`);
    });

    // Set up container self-reference AFTER defining resolveSpy
    containerInstance = {
        _registrations: registrations,
        _instances: instances,
        register: registerSpy,
        resolve: resolveSpy,
    };
    return containerInstance;
};
// ****** END OF CORRECTION for resolveSpy ******

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

        // Pre-register core dependencies directly into the mock container
        // This ensures they are available via resolveSpy's fallbacks or direct resolution
        mockContainer._registrations.set(tokens.ILogger, {
            factoryOrValue: mockLogger,
            options: {lifecycle: 'singleton'}
        });
        mockContainer._instances.set(tokens.ILogger, mockLogger);
        mockContainer._registrations.set(tokens.IValidatedEventDispatcher, {
            factoryOrValue: mockValidatedEventDispatcher,
            options: {lifecycle: 'singleton'}
        });
        mockContainer._instances.set(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher);
        mockContainer._registrations.set(tokens.EventBus, {
            factoryOrValue: mockEventBus,
            options: {lifecycle: 'singleton'}
        });
        mockContainer._instances.set(tokens.EventBus, mockEventBus);


        // Clear spies *after* pre-registration if needed (registerSpy is the main one)
        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear(); // Clear resolve spy calls too
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear(); // Clear error mock too
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = ''; // Clean up jsdom
    });

    it('should register essential external dependencies (document, elements) as singleton instances', () => {
        registerUI(mockContainer, mockUiArgs);
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.WindowDocument, mockDocument, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.outputDiv, mockOutputDiv, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.inputElement, mockInputElement, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.titleElement, mockTitleElement, expect.objectContaining({lifecycle: 'singleton'}));
        // Verify resolution works
        expect(mockContainer.resolve(tokens.WindowDocument)).toBe(mockDocument);
        expect(mockContainer.resolve(tokens.outputDiv)).toBe(mockOutputDiv);
        expect(mockContainer.resolve(tokens.inputElement)).toBe(mockInputElement);
        expect(mockContainer.resolve(tokens.titleElement)).toBe(mockTitleElement);
    });

    it('should register IDocumentContext via singletonFactory resolving to DocumentContext', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.IDocumentContext);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        const instance1 = mockContainer.resolve(tokens.IDocumentContext);
        expect(instance1).toBeInstanceOf(DocumentContext);
        expect(mockContainer.resolve(tokens.IDocumentContext)).toBe(instance1);
        // Check dependency resolution within the factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WindowDocument);
    });

    it('should register DomElementFactory via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomElementFactory);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        const instance1 = mockContainer.resolve(tokens.DomElementFactory);
        expect(instance1).toBeInstanceOf(DomElementFactory);
        expect(mockContainer.resolve(tokens.DomElementFactory)).toBe(instance1);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
    });

    it('should register UiMessageRenderer using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.UiMessageRenderer);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toBe(UiMessageRenderer); // Check class constructor was registered
        expect(regCall[2]).toEqual(expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [tokens.ILogger, tokens.IDocumentContext, tokens.IValidatedEventDispatcher, tokens.DomElementFactory]
        }));

        // ****** REMOVED mockClear call ******
        // UiMessageRenderer.mockClear();

        // Now resolve the token - the corrected resolveSpy should handle constructor injection
        const instance1 = mockContainer.resolve(tokens.UiMessageRenderer);

        expect(instance1).toBeDefined();
        // This assertion requires UiMessageRenderer to be a class.
        expect(instance1).toBeInstanceOf(UiMessageRenderer);
        expect(mockContainer.resolve(tokens.UiMessageRenderer)).toBe(instance1); // Check singleton behavior

        // Verify dependencies were resolved during the instantiation by resolveSpy
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
    });

    it('should register TitleRenderer via singletonFactory injecting titleElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.TitleRenderer);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        const instance1 = mockContainer.resolve(tokens.TitleRenderer);
        expect(instance1).toBeDefined();
        expect(instance1).toBeInstanceOf(TitleRenderer); // Check instance type
        expect(mockContainer.resolve(tokens.TitleRenderer)).toBe(instance1);

        // Verify factory dependencies were resolved
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.titleElement); // Specific element injection
    });

    it('should register InputStateController via singletonFactory injecting inputElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.InputStateController);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        const instance1 = mockContainer.resolve(tokens.InputStateController);
        expect(instance1).toBeDefined();
        expect(instance1).toBeInstanceOf(InputStateController);
        expect(mockContainer.resolve(tokens.InputStateController)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement); // Specific element injection
    });

    it('should register LocationRenderer via singletonFactory injecting outputDiv', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.LocationRenderer);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        const instance1 = mockContainer.resolve(tokens.LocationRenderer);
        expect(instance1).toBeDefined();
        expect(instance1).toBeInstanceOf(LocationRenderer);
        expect(mockContainer.resolve(tokens.LocationRenderer)).toBe(instance1);

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.outputDiv); // Specific element injection
    });

    it('should register InventoryPanel via singletonFactory querying for container', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.InventoryPanel);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        // Resolve DocumentContext first to spy on its query method if needed
        const docContextInstance = mockContainer.resolve(tokens.IDocumentContext);
        const querySpy = jest.spyOn(docContextInstance, 'query');

        const instance1 = mockContainer.resolve(tokens.InventoryPanel); // Executes the factory
        expect(instance1).toBeDefined();
        expect(instance1).toBeInstanceOf(InventoryPanel);
        expect(mockContainer.resolve(tokens.InventoryPanel)).toBe(instance1);

        expect(querySpy).toHaveBeenCalledWith('#game-container'); // Check query inside factory
        // Verify other factory dependencies were resolved
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('InventoryPanel')); // Assuming container exists
    });

    it('should register ActionButtonsRenderer via singletonFactory querying for container', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.ActionButtonsRenderer);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        const docContextInstance = mockContainer.resolve(tokens.IDocumentContext);
        const querySpy = jest.spyOn(docContextInstance, 'query');

        const instance1 = mockContainer.resolve(tokens.ActionButtonsRenderer);
        expect(instance1).toBeDefined();
        expect(instance1).toBeInstanceOf(ActionButtonsRenderer);
        expect(mockContainer.resolve(tokens.ActionButtonsRenderer)).toBe(instance1);

        expect(querySpy).toHaveBeenCalledWith('#action-buttons');
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('ActionButtonsRenderer')); // Assuming container exists
    });

    it('should register DomUiFacade under its own token using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomUiFacade);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toBe(DomUiFacade); // Class constructor
        expect(regCall[2]).toEqual(expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [ // Check correct dependencies are listed
                tokens.ActionButtonsRenderer, tokens.InventoryPanel, tokens.LocationRenderer,
                tokens.TitleRenderer, tokens.InputStateController, tokens.UiMessageRenderer
            ]
        }));

        // Resolve the facade - corrected resolveSpy handles nested dependency resolution
        const instance1 = mockContainer.resolve(tokens.DomUiFacade);
        expect(instance1).toBeDefined();
        expect(instance1).toBeInstanceOf(DomUiFacade); // Should now work
        expect(mockContainer.resolve(tokens.DomUiFacade)).toBe(instance1); // Singleton check

        // Verify dependencies were resolved during the facade instantiation
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ActionButtonsRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.InventoryPanel);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.LocationRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.TitleRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.InputStateController);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.UiMessageRenderer); // This nested resolution caused the original error
    });

    // --- InputHandler Test ---
    it('should register IInputHandler via singletonFactory with IValidatedEventDispatcher', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.IInputHandler);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toEqual(expect.any(Function));
        expect(regCall[2]).toEqual(expect.objectContaining({lifecycle: 'singletonFactory'}));

        mockContainer.resolve.mockClear(); // Clear before executing factory via resolve

        const instance1 = mockContainer.resolve(tokens.IInputHandler);
        expect(instance1).toBeInstanceOf(InputHandler);
        expect(mockContainer.resolve(tokens.IInputHandler)).toBe(instance1);

        // Verify the factory resolved the CORRECT dependencies
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher); // Correct dispatcher
        expect(mockContainer.resolve).not.toHaveBeenCalledWith(tokens.EventBus); // Ensure old one wasn't resolved

    });
    // --- End of InputHandler Test ---

    it('should log completion messages', () => {
        registerUI(mockContainer, mockUiArgs);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting (Refactored DOM UI)...');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Complete.');
    });

});